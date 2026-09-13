import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, userPushTokensTable } from "@workspace/db";
import { getSessionUser } from "../middleware/requireAdmin";

const router = Router();

router.post("/push-tokens/register", async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Authentication required." });

  const { token, platform } = req.body as { token?: string; platform?: string };
  if (!token) return res.status(400).json({ error: "token is required." });

  await db
    .insert(userPushTokensTable)
    .values({ userId: user.id, token, platform: platform ?? "unknown" })
    .onConflictDoUpdate({
      target: userPushTokensTable.userId,
      set: { token, platform: platform ?? "unknown", updatedAt: new Date() },
    });

  return res.status(201).json({ ok: true, userId: user.id });
});

router.delete("/push-tokens/unregister", async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Authentication required." });

  await db.delete(userPushTokensTable).where(eq(userPushTokensTable.userId, user.id));
  return res.json({ ok: true });
});

router.get("/push-tokens", async (req, res) => {
  const user = await getSessionUser(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return res.status(403).json({ error: "Admin access required." });
  }

  const all = await db.select().from(userPushTokensTable);
  return res.json(all);
});

export default router;
