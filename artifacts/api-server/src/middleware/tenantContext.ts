import { type Request, type Response, type NextFunction } from "express";
import { db, storesTable, sessionsTable, usersTable } from "@workspace/db";
import { eq, or, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import { createHash } from "node:crypto";

export interface TenantRequest extends Request {
  storeId?: string;
  store?: typeof storesTable.$inferSelect;
}

function sessionDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function extractToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.["luxe_session"] as string | undefined;
  if (cookieToken) return cookieToken;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return undefined;
}

async function isUserAdminOfStore(req: Request, storeId: string): Promise<boolean> {
  const token = extractToken(req);
  if (!token) return false;

  const rows = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(and(
      eq(sessionsTable.token, sessionDigest(token)),
      eq(sessionsTable.storeId, storeId)
    ))
    .limit(1);

  const row = rows[0];
  if (!row) return false;
  
  const role = row.user.role.toUpperCase();
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * Middleware to resolve the tenant (store) for the current request.
 * Scans headers for X-Store-Id or X-Publishable-Key, or falls back to hostname.
 */
export async function tenantResolver(req: TenantRequest, res: Response, next: NextFunction) {
  const checkPath = req.path.startsWith("/api") ? req.path : `/api${req.path}`;
  if (
    checkPath === "/api/health" ||
    checkPath.startsWith("/api/platform-admin") ||
    checkPath.startsWith("/api/marketplace") ||
    checkPath.startsWith("/api/auth/seller") ||
    checkPath.startsWith("/api/admin/stores")
  ) {
    return next();
  }

  const storeIdHeader = (req.headers["x-store-id"] || req.query.storeId) as string;
  const pubKeyHeader = (req.headers["x-publishable-key"] || req.query.publishableKey) as string;
  const slugQuery = (req.query.store || req.cookies?.prigid_store_slug) as string;
  const host = req.hostname;

  try {
    let storeRecord;

    const allStores = await db.select().from(storesTable);

    if (storeIdHeader) {
      storeRecord = allStores.find((s: any) => s.id === storeIdHeader);
    } else if (pubKeyHeader) {
      storeRecord = allStores.find((s: any) => s.publishableKey === pubKeyHeader || s.publishable_key === pubKeyHeader);
    } else if (slugQuery) {
      storeRecord = allStores.find((s: any) => s.slug === slugQuery);
    } else if (host && !host.includes("localhost") && !host.endsWith(".run.app") && !host.endsWith(".aistudio.app") && !host.endsWith(".prigidcommerce.com")) {
      // Resolve by custom domain
      storeRecord = allStores.find((s: any) => s.customDomain === host || s.custom_domain === host);
    } else if (host && host.endsWith(".prigidcommerce.com")) {
      // Resolve by slug subdomain
      const slug = host.split(".")[0];
      if (slug !== "www" && slug !== "platform") {
        storeRecord = allStores.find((s: any) => s.slug === slug);
      }
    }

    if (!storeRecord) {
      // Fallback: If no store resolved, check if we have a default "main" store for the environment
      storeRecord = allStores[0] || null;
    }

    if (!storeRecord) {
      return res.status(404).json({
        error: "Tenant not found",
        message: "No store identified for this request. Please provide valid tenant parameters or custom domain."
      });
    }

    if (storeRecord.status === "suspended" || storeRecord.publishStatus === "SUSPENDED") {
      return res.status(403).json({
        error: "Store suspended",
        message: "This store has been suspended. Please contact Prigid Commerce Group support."
      });
    }

    // Publication status enforcement for public storefront endpoints
    const isPublicEndpoint = !checkPath.startsWith("/api/admin") && !checkPath.startsWith("/api/settings") && !checkPath.startsWith("/api/team");
    
    if (isPublicEndpoint && storeRecord.publishStatus !== "PUBLISHED") {
      const isAdmin = await isUserAdminOfStore(req, storeRecord.id);
      if (!isAdmin) {
        return res.status(403).json({
          error: "Private Atelier",
          message: "This store is under curation and is not publicly accessible.",
          isPublished: false,
        });
      }
    }

    req.storeId = storeRecord.id;
    req.store = storeRecord;
    
    next();
  } catch (error) {
    logger.error({ err: error, path: req.path }, "Tenant resolution failed");
    return res.status(500).json({ error: "Internal Server Error during tenant resolution" });
  }
}
