import { type Request, type Response, type NextFunction } from "express";
import { db, storesTable, sessionsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { extractTenantFromHost, validateTenantSlug, sanitizeTenantSlug, type TenantHostInfo } from "@workspace/tenant-routing";
import { logger } from "../lib/logger";
import { createHash } from "node:crypto";

export interface TenantRequest extends Request {
  storeId?: string;
  store?: typeof storesTable.$inferSelect;
  tenantInfo?: TenantHostInfo;
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

export async function isUserAdminOfStore(req: Request, storeId: string): Promise<boolean> {
  const token = extractToken(req);
  if (!token) return false;

  try {
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
    
    const role = row.user.role?.toUpperCase();
    return role === "ADMIN" || role === "SUPER_ADMIN" || role === "PLATFORM_ADMIN";
  } catch (err) {
    logger.error({ err, storeId }, "Error checking admin status");
    return false;
  }
}

/**
 * Middleware to resolve and enforce tenant isolation for all requests.
 * Extracts tenant from:
 * 1. Hostname subdomain (e.g. "atelier-celeste.prigidcommerce.com" or "atelier-celeste.ais-dev-xxx.run.app")
 * 2. Hostname custom domain (e.g. "www.atelierceleste.com", "moretti.it")
 * 3. Verified HTTP headers (X-Store-Id or X-Publishable-Key)
 * 4. Explicit scoped query / cookie (in development / preview fallback)
 */
export async function tenantResolver(req: TenantRequest, res: Response, next: NextFunction) {
  const checkPath = req.path.startsWith("/api") ? req.path : `/api${req.path}`;

  // Platform-level routes that do not require store isolation
  if (
    checkPath === "/api/health" ||
    checkPath.startsWith("/api/platform-admin") ||
    checkPath.startsWith("/api/marketplace") ||
    checkPath.startsWith("/api/auth/seller") ||
    checkPath.startsWith("/api/admin/stores")
  ) {
    return next();
  }

  const hostHeader = (req.headers["x-forwarded-host"] || req.get("host") || req.hostname) as string;
  const tenantInfo = extractTenantFromHost(hostHeader);
  req.tenantInfo = tenantInfo;

  const storeIdHeader = (req.headers["x-store-id"] || req.query.storeId) as string;
  const pubKeyHeader = (req.headers["x-publishable-key"] || req.query.publishableKey) as string;
  const querySlug = req.query.store as string | undefined;

  try {
    const allStores = await db.select().from(storesTable);
    let storeRecord: (typeof storesTable.$inferSelect) | undefined;

    // 1. Resolve by Tenant Subdomain
    if (tenantInfo.type === "subdomain" && tenantInfo.slug) {
      const sanitizedSlug = sanitizeTenantSlug(tenantInfo.slug);
      storeRecord = allStores.find((s: any) => s.slug === sanitizedSlug);
      
      if (!storeRecord) {
        return res.status(404).json({
          error: "Store Not Found",
          code: "TENANT_NOT_FOUND",
          message: `No active boutique found for subdomain "${tenantInfo.slug}".`,
        });
      }
    }
    // 2. Resolve by Custom Domain
    else if (tenantInfo.type === "custom_domain" && tenantInfo.domain) {
      const domainToMatch = tenantInfo.domain.toLowerCase().replace(/^www\./, "");
      storeRecord = allStores.find((s: any) => {
        if (!s.customDomain) return false;
        const normalized = s.customDomain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0];
        return normalized === domainToMatch || s.customDomain.toLowerCase() === tenantInfo.domain;
      });

      if (!storeRecord) {
        return res.status(404).json({
          error: "Store Not Found",
          code: "CUSTOM_DOMAIN_NOT_MAPPED",
          message: `No active boutique found for custom domain "${tenantInfo.domain}".`,
        });
      }
    }
    // 3. Resolve by explicit headers (e.g. mobile app, POS, or internal authenticated calls)
    else if (storeIdHeader) {
      storeRecord = allStores.find((s: any) => s.id === storeIdHeader);
    } else if (pubKeyHeader) {
      storeRecord = allStores.find((s: any) => s.publishableKey === pubKeyHeader || s.publishable_key === pubKeyHeader);
    }
    // 4. Resolve by query parameter in development/preview
    else if (querySlug && validateTenantSlug(querySlug)) {
      storeRecord = allStores.find((s: any) => s.slug === querySlug);
    }
    // 5. Master domain request with cookie or dev fallback
    else if (tenantInfo.type === "master") {
      const cookieSlug = req.cookies?.prigid_store_slug;
      if (cookieSlug && validateTenantSlug(cookieSlug)) {
        storeRecord = allStores.find((s: any) => s.slug === cookieSlug);
      }
      
      // If still not resolved on master domain for admin/seller endpoints
      if (!storeRecord && (checkPath.startsWith("/api/admin") || checkPath.startsWith("/api/settings") || checkPath.startsWith("/api/team"))) {
        storeRecord = allStores[0];
      }
    }

    if (!storeRecord) {
      return res.status(404).json({
        error: "Tenant Not Found",
        code: "TENANT_RESOLUTION_FAILED",
        message: "Unable to identify the store tenant for this request. Please access via the boutique's dedicated subdomain.",
      });
    }

    // Enforce Suspended status
    if (storeRecord.status === "suspended" || storeRecord.publishStatus === "SUSPENDED") {
      return res.status(403).json({
        error: "Store Suspended",
        code: "STORE_SUSPENDED",
        message: "This boutique has been suspended. Please contact PRIGID Commerce Group support.",
      });
    }

    // Publication status enforcement for public storefront endpoints
    const isPublicStorefrontEndpoint = 
      !checkPath.startsWith("/api/admin") && 
      !checkPath.startsWith("/api/settings") && 
      !checkPath.startsWith("/api/team") &&
      !checkPath.startsWith("/api/auth/seller");
    
    if (isPublicStorefrontEndpoint && storeRecord.publishStatus !== "PUBLISHED") {
      const isAdmin = await isUserAdminOfStore(req, storeRecord.id);
      if (!isAdmin) {
        return res.status(403).json({
          error: "Private Atelier",
          code: "STORE_UNPUBLISHED",
          message: "This boutique is currently configuring its digital showroom and is not publicly accessible.",
          isPublished: false,
        });
      }
    }

    // Attach verified tenant context to the request
    req.storeId = storeRecord.id;
    req.store = storeRecord;
    
    next();
  } catch (error) {
    logger.error({ err: error, path: req.path }, "Tenant resolution failed");
    return res.status(500).json({ error: "Internal Server Error during tenant resolution" });
  }
}
