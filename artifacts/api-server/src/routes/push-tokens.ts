import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, userPushTokensTable } from "@workspace/db";
import { getSessionUser } from "../middleware/requireAdmin";
import { type TenantRequest } from "../middleware/tenantContext";

const router = Router();

router.post("/push-tokens/register", async (req: TenantRequest, res) => {
  const user = await getSessionUser(req);
  const storeId = req.storeId!;
  if (!user) return res.status(401).json({ error: "Authentication required." });

  const { token, platform } = req.body as { token?: string; platform?: string };
  if (!token) return res.status(400).json({ error: "token is required." });

  await db
    .insert(userPushTokensTable)
    .values({ userId: user.id, storeId, token, platform: platform ?? "unknown" })
    .onConflictDoUpdate({
      target: [userPushTokensTable.userId, userPushTokensTable.storeId],
      set: { token, platform: platform ?? "unknown", updatedAt: new Date() },
    });

  return res.status(201).json({ ok: true, userId: user.id });
});

router.delete("/push-tokens/unregister", async (req: TenantRequest, res) => {
  const user = await getSessionUser(req);
  const storeId = req.storeId!;
  if (!user) return res.status(401).json({ error: "Authentication required." });

  await db.delete(userPushTokensTable).where(and(eq(userPushTokensTable.userId, user.id), eq(userPushTokensTable.storeId, storeId)));
  return res.json({ ok: true });
});

router.get("/push-tokens", async (req: TenantRequest, res) => {
  const user = await getSessionUser(req);
  const storeId = req.storeId!;
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return res.status(403).json({ error: "Admin access required." });
  }

  const all = await db.select().from(userPushTokensTable).where(eq(userPushTokensTable.storeId, storeId));
  return res.json(all);
});

export default router;
