import { Router } from "express";
import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db, newsletterCampaignsTable, newsletterSubscribersTable } from "@workspace/db";
import { requireAdmin } from "../middleware/requireAdmin";
import { sendEmail, buildNewsletterWelcomeEmail, getStoreUrl } from "../services/mailer";

const router = Router();

router.get("/newsletter", requireAdmin, async (_req, res) => {
  return res.json(await db.select().from(newsletterSubscribersTable).orderBy(desc(newsletterSubscribersTable.subscribedAt)));
});

router.post("/newsletter", async (req, res) => {
  const { email, name } = req.body as { email?: string; name?: string };
  if (!email || !email.includes("@")) return res.status(400).json({ error: "A valid email is required." });
  const [existing] = await db.select().from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.email, email)).limit(1);
  if (existing) return res.json({ ok: true, alreadySubscribed: true, subscriber: existing });
  const [subscriber] = await db.insert(newsletterSubscribersTable)
    .values({ id: randomUUID(), email, name: name ?? null }).returning();

  // Dispatch newsletter welcome email asynchronously
  getStoreUrl().then((storeUrl) => {
    const emailData = buildNewsletterWelcomeEmail({ email: subscriber.email, storeUrl });
    sendEmail({ to: subscriber.email, ...emailData }).catch(() => {});
  }).catch(() => {});

  return res.status(201).json({ ok: true, subscriber });
});

router.delete("/newsletter/:id", requireAdmin, async (req, res) => {
  await db.delete(newsletterSubscribersTable).where(eq(newsletterSubscribersTable.id, req.params.id as string));
  return res.json({ ok: true });
});

router.get("/newsletter/export", requireAdmin, async (_req, res) => {
  const subscribers = await db.select().from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.active, true));
  const escapeCsv = (value: string | null) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = [
    "email,name,subscribedAt",
    ...subscribers.map((s) => [s.email, s.name, s.subscribedAt.toISOString()].map(escapeCsv).join(",")),
  ].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="subscribers-${Date.now()}.csv"`);
  return res.send(rows);
});

router.get("/newsletter/campaigns", requireAdmin, async (_req, res) => {
  return res.json(await db.select().from(newsletterCampaignsTable).orderBy(desc(newsletterCampaignsTable.createdAt)));
});

router.post("/newsletter/send", requireAdmin, async (req, res) => {
  const { subject, body, scheduledFor } = req.body as { subject?: string; body?: string; scheduledFor?: string };
  if (!subject || !body) return res.status(400).json({ error: "subject and body are required." });
  const [{ count }] = await db.select({ count: newsletterSubscribersTable.id })
    .from(newsletterSubscribersTable).where(eq(newsletterSubscribersTable.active, true));
  const [campaign] = await db.insert(newsletterCampaignsTable).values({
    id: randomUUID(), subject, body, recipientCount: count ? Number(count) : 0,
    status: scheduledFor ? "SCHEDULED" : "DRAFT",
    scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
  }).returning();
  return res.status(201).json(campaign);
});

router.put("/newsletter/campaigns/:id", requireAdmin, async (req, res) => {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ["subject", "body", "status"]) if (key in req.body) updates[key] = req.body[key];
  if ("scheduledFor" in req.body) updates.scheduledFor = req.body.scheduledFor ? new Date(req.body.scheduledFor) : null;
  const [campaign] = await db.update(newsletterCampaignsTable).set(updates)
    .where(eq(newsletterCampaignsTable.id, req.params.id as string)).returning();
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  return res.json(campaign);
});

router.delete("/newsletter/campaigns/:id", requireAdmin, async (req, res) => {
  await db.delete(newsletterCampaignsTable).where(eq(newsletterCampaignsTable.id, req.params.id as string));
  return res.json({ ok: true });
});

router.post("/newsletter/campaigns/:id/resend", requireAdmin, async (req, res) => {
  const [campaign] = await db.select().from(newsletterCampaignsTable)
    .where(eq(newsletterCampaignsTable.id, req.params.id as string)).limit(1);
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  const [{ count }] = await db.select({ count: newsletterSubscribersTable.id })
    .from(newsletterSubscribersTable).where(eq(newsletterSubscribersTable.active, true));
  const [resent] = await db.insert(newsletterCampaignsTable).values({
    id: randomUUID(), subject: campaign.subject, body: campaign.body,
    recipientCount: count ? Number(count) : 0, status: "DRAFT",
  }).returning();
  return res.status(201).json(resent);
});

export default router;