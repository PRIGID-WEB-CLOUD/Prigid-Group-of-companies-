import { type Request, type Response, type NextFunction } from "express";
import { db, sessionsTable, usersTable, teamMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";

export const SESSION_COOKIE = "luxe_session";

function sessionDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type UserRole = "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamRole?: "Owner" | "Admin" | "Editor" | "Viewer";
}

declare global {
  namespace Express {
    interface Request {
      adminUser?: StoredUser;
    }
  }
}

export async function resolveTeamRole(email: string, systemRole: UserRole): Promise<"Owner" | "Admin" | "Editor" | "Viewer"> {
  const [member] = await db.select({ role: teamMembersTable.role })
    .from(teamMembersTable)
    .where(eq(teamMembersTable.email, email))
    .limit(1);
  
  if (member) {
    const r = member.role.trim().toLowerCase();
    if (r === "owner") return "Owner";
    if (r === "admin") return "Admin";
    if (r === "editor") return "Editor";
    if (r === "viewer") return "Viewer";
  }

  if (systemRole === "SUPER_ADMIN") return "Owner";
  return "Admin";
}

function toStoredUser(user: typeof usersTable.$inferSelect, teamRole?: "Owner" | "Admin" | "Editor" | "Viewer"): StoredUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    teamRole,
  };
}

function extractToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (cookieToken) return cookieToken;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return undefined;
}

export async function getSessionUser(req: Request): Promise<StoredUser | null> {
  const token = extractToken(req);
  if (!token) return null;
  const rows = await db
    .select({ user: usersTable, session: sessionsTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(eq(sessionsTable.token, sessionDigest(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (new Date() > row.session.expiresAt) return null;
  
  const systemRole = row.user.role as UserRole;
  const teamRole = await resolveTeamRole(row.user.email, systemRole);
  return toStoredUser(row.user, teamRole);
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Authentication required." });

  const rows = await db
    .select({ user: usersTable, expiresAt: sessionsTable.expiresAt })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(eq(sessionsTable.token, sessionDigest(token)))
    .limit(1);

  const row = rows[0];
  if (!row) return res.status(401).json({ error: "Session expired — please log in again." });
  if (new Date() > row.expiresAt) return res.status(401).json({ error: "Session expired — please log in again." });

  const systemRole = row.user.role as UserRole;
  if (systemRole !== "ADMIN" && systemRole !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Admin access required." });
  }

  // Resolve active fine-grained team role
  const teamRole = await resolveTeamRole(row.user.email, systemRole);
  req.adminUser = toStoredUser(row.user, teamRole);

  const method = req.method;
  const path = req.path;

  // 1. Viewer has STRICTLY read-only access
  if (teamRole === "Viewer") {
    if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      return res.status(403).json({ error: "Access Denied: Viewers do not have permission to make changes." });
    }
  }

  // 2. Editor can ONLY execute writes on Media, Blog Posts, and Coupons
  if (teamRole === "Editor") {
    if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      const allowedWritePaths = [
        "/media",
        "/blog",
        "/coupons",
        "/uploads"
      ];
      const isAllowed = allowedWritePaths.some(p => path.startsWith(p));
      if (!isAllowed) {
        return res.status(403).json({ error: "Access Denied: Editors are restricted to managing blog posts, coupons, and media assets." });
      }
    }
  }

  // 3. Only Owner (Super Admin) and standard Admin can make administrative modifications to team or API configurations
  if (teamRole === "Admin" || teamRole === "Editor" || teamRole === "Viewer") {
    const restrictedActions = [
      "/apikeys",
      "/settings",
      "/team"
    ];
    const isRestrictedPath = restrictedActions.some(p => path.startsWith(p));
    if (isRestrictedPath && ["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      return res.status(403).json({ error: "Access Denied: Only the store Owner is authorized to perform this administrative change." });
    }

    if (path.startsWith("/apikeys") || path.startsWith("/settings")) {
      if (["POST", "PUT", "DELETE", "PATCH"].includes(method) || path.includes("/keys")) {
        return res.status(403).json({ error: "Access Denied: Only the store Owner is authorized to configure API keys and settings." });
      }
    }
  }

  return next();
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Authentication required." });

  const rows = await db
    .select({ user: usersTable, expiresAt: sessionsTable.expiresAt })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(eq(sessionsTable.token, sessionDigest(token)))
    .limit(1);

  const row = rows[0];
  if (!row) return res.status(401).json({ error: "Session expired — please log in again." });
  if (new Date() > row.expiresAt) return res.status(401).json({ error: "Session expired — please log in again." });

  const systemRole = row.user.role as UserRole;
  const teamRole = await resolveTeamRole(row.user.email, systemRole);

  if (teamRole !== "Owner") {
    return res.status(403).json({ error: "Super admin / Owner access required." });
  }

  req.adminUser = toStoredUser(row.user, teamRole);
  return next();
}
