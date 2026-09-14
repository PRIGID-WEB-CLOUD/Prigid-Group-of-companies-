import { Router, type Response } from "express";
import { randomUUID } from "crypto";
import { db, messagesTable } from "@workspace/db";
import { requireAdmin } from "../middleware/requireAdmin";
import { addEvent, getChannelCredentials } from "./channels";
import { eventBus } from "../lib/eventBus";
import { logger } from "../lib/logger";
import { eq, desc, asc, sql, or, and } from "drizzle-orm";
import { type TenantRequest } from "../middleware/tenantContext";

const router = Router();
router.use("/chat", requireAdmin);
router.use("/crm", requireAdmin);
router.use("/inbox", requireAdmin);

// Helper to get active asset IDs
async function getActiveAssetIds(storeId: string) {
  const [fbCreds, igCreds, waCreds] = await Promise.all([
    getChannelCredentials("facebook", storeId),
    getChannelCredentials("instagram", storeId),
    getChannelCredentials("whatsapp", storeId)
  ]);

  const ids: string[] = [];
  if (fbCreds.page_id) ids.push(fbCreds.page_id);
  if (igCreds.ig_user_id) ids.push(igCreds.ig_user_id);
  if (waCreds.waba_id) ids.push(waCreds.waba_id); // WABA ID is used as recipientId in webhooks
  if (waCreds.phone_number_id) ids.push(waCreds.phone_number_id);

  return ids;
}

// Health check for CRM database connectivity
router.get("/chat/health", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  try {
    const rows = await db.execute(sql`SELECT count(*) as count FROM ${messagesTable} WHERE store_id = ${storeId}`);
    res.json({ ok: true, count: rows.rows[0].count });
  } catch (err: any) {
    logger.error({ err }, "CRM Health Check Failed");
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Fetch messages filtered by active assets
router.get("/chat/messages", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  try {
    const activeIds = await getActiveAssetIds(storeId);
    
    // If no assets are connected, we still might want to show non-meta channels (if any)
    // but for Meta specifically, we filter.
    // If activeIds is empty, and we want to be strict, we'd return nothing for meta.
    
    let filters = eq(messagesTable.storeId, storeId);
    
    if (activeIds.length > 0) {
      // Filter where recipientId is in activeIds OR recipientId is null (backward compatibility/internal notes)
      // Actually, for strict asset switching, we only show messages for the active ones.
      filters = and(
        filters,
        or(
          sql`${messagesTable.recipientId} IN (${activeIds.join(',')})`,
          sql`${messagesTable.recipientId} IS NULL`,
          eq(messagesTable.channel, "whatsapp") // WhatsApp often uses phone_number_id but let's be safe
        )
      ) as any;
    }

    const list = await db.select().from(messagesTable)
      .where(filters)
      .orderBy(asc(messagesTable.timestamp));
    return res.json(list);
  } catch (err) {
    logger.error({ err }, "Error fetching chat messages");
    return res.status(500).json({ error: String(err) });
  }
});

// Admin sends message, comment reply, or adds note
router.post("/chat/messages", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const {
    threadId,
    text,
    channel,
    channelType = "chat",
    customerName,
    phone = "",
    email = "",
    type = "message" // "message" | "comment" | "note"
  } = req.body as {
    threadId: string;
    text: string;
    channel: "whatsapp" | "facebook" | "instagram";
    channelType?: "chat" | "comment";
    customerName: string;
    phone?: string;
    email?: string;
    type?: "message" | "comment" | "note";
  };

  if (!threadId || !text || !channel || !customerName) {
    return res.status(400).json({ error: "Missing required fields: threadId, text, channel, customerName" });
  }

  try {
    const messageId = randomUUID();
    const sender = type === "note" ? "system" : "admin";
    
    // Determine recipientId from current credentials
    let recipientId: string | undefined;
    const creds = await getChannelCredentials(channel, storeId);
    if (channel === "whatsapp") recipientId = creds["waba_id"] || creds["phone_number_id"];
    else if (channel === "facebook") recipientId = creds["page_id"];
    else if (channel === "instagram") recipientId = creds["ig_user_id"];

    const [inserted] = await db.insert(messagesTable).values({
      id: messageId,
      storeId,
      threadId,
      sender,
      text,
      timestamp: new Date(),
      status: "sent",
      type,
      customerName,
      phone,
      email,
      channel,
      channelType,
      recipientId
    }).returning();

    // Trigger Outgoing Live Messaging API if credentials exist
    if (type === "message" && channelType === "chat" && phone) {
      if (channel === "whatsapp") {
        const waCreds = await getChannelCredentials("whatsapp", storeId);
        const phoneNumberId = waCreds["phone_number_id"];
        const token = waCreds["system_access_token"];
        if (phoneNumberId && token) {
          try {
            const r = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phone.replace(/\D/g, ""), // clean non-digits
                type: "text",
                text: { preview_url: false, body: text },
              }),
            });
            const resData = await r.json() as Record<string, any>;
            if (!r.ok || resData.error) {
              const errorMsg = resData.error?.message || "Unknown Meta API error";
              logger.warn({ error: resData.error }, "WhatsApp API rejection on outgoing message");
              await addEvent("whatsapp", "Outbound message failed", `Meta API Error: ${errorMsg}`, "error", storeId);
            } else {
              await db.update(messagesTable).set({ status: "delivered" }).where(and(eq(messagesTable.id, messageId), eq(messagesTable.storeId, storeId)));
              inserted.status = "delivered";
            }
          } catch (err) {
            logger.error({ err }, "Error calling outgoing WhatsApp API");
            await addEvent("whatsapp", "Outbound message failed", `Network Error: ${String(err)}`, "error", storeId);
          }
        }
      } else if (channel === "facebook" || channel === "instagram") {
        const creds = await getChannelCredentials(channel, storeId);
        const token = creds["page_access_token"];
        if (token) {
          try {
            // For both FB Messenger and IG Direct, we use the same messaging API
            const r = await fetch(`https://graph.facebook.com/v21.0/me/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recipient: { id: phone },
                message: { text },
                access_token: token
              }),
            });
            const resData = await r.json() as Record<string, any>;
            if (!r.ok || resData.error) {
              const errorMsg = resData.error?.message || "Unknown Meta API error";
              logger.warn({ error: resData.error, channel }, "Meta Messaging API rejection on outgoing message");
              await addEvent(channel, "Outbound message failed", `Meta API Error: ${errorMsg}`, "error", storeId);
            } else {
              await db.update(messagesTable).set({ status: "delivered" }).where(and(eq(messagesTable.id, messageId), eq(messagesTable.storeId, storeId)));
              inserted.status = "delivered";
            }
          } catch (err) {
            logger.error({ err, channel }, "Error calling outgoing Meta Messaging API");
            await addEvent(channel, "Outbound message failed", `Network Error: ${String(err)}`, "error", storeId);
          }
        }
      }
    }

    // Add Audit Log
    const actionLabel = type === "note" ? "Note added" : "Reply sent";
    await addEvent(channel, actionLabel, `To ${customerName}: "${text.slice(0, 50)}"`, "info", storeId);

    // Broadcast in real-time to other connected dashboards
    eventBus.publish({
      type: "new_message",
      payload: inserted
    } as any);

    return res.status(201).json(inserted);
  } catch (err) {
    logger.error({ err }, "Error sending CRM message");
    return res.status(500).json({ error: String(err) });
  }
});

// Clear/read all unread messages for a thread
router.post("/chat/threads/:threadId/clear-unread", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const { threadId } = req.params;

  try {
    // Update all customer messages in this thread to "read"
    await db.update(messagesTable)
      .set({ status: "read" })
      .where(and(eq(messagesTable.threadId, threadId as string), eq(messagesTable.storeId, storeId)));

    // Also broadcast a system read sync event to any active UI clients
    eventBus.publish({
      type: "new_message",
      payload: { threadId, action: "clear-unread", sender: "system", storeId } as any
    } as any);

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Error clearing unread for thread " + threadId);
    return res.status(500).json({ error: String(err) });
  }
});

// Clear all CRM chat messages
router.delete("/chat/messages", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  try {
    await db.delete(messagesTable).where(eq(messagesTable.storeId, storeId));

    // Broadcast sync event to all active UI clients to refresh threads
    eventBus.publish({
      type: "new_message",
      payload: { action: "clear-all", sender: "system", storeId } as any
    } as any);

    return res.json({ ok: true, message: "All CRM chat messages cleared successfully" });
  } catch (err) {
    logger.error({ err }, "Error clearing all chat messages");
    return res.status(500).json({ error: String(err) });
  }
});

// Delete an individual chat thread
router.delete("/chat/threads/:threadId", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const { threadId } = req.params;
  try {
    await db.delete(messagesTable).where(and(eq(messagesTable.threadId, threadId as string), eq(messagesTable.storeId, storeId)));

    eventBus.publish({
      type: "new_message",
      payload: { action: "delete-thread", threadId, sender: "system", storeId } as any
    } as any);

    return res.json({ ok: true, message: `Thread ${threadId} deleted successfully` });
  } catch (err) {
    logger.error({ err }, `Error deleting thread ${threadId}`);
    return res.status(500).json({ error: String(err) });
  }
});

// Delete an individual message
router.delete("/chat/messages/:messageId", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const { messageId } = req.params;
  try {
    const [msg] = await db.select().from(messagesTable).where(and(eq(messagesTable.id, messageId as string), eq(messagesTable.storeId, storeId)));
    await db.delete(messagesTable).where(and(eq(messagesTable.id, messageId as string), eq(messagesTable.storeId, storeId)));

    if (msg) {
      eventBus.publish({
        type: "new_message",
        payload: { action: "delete-message", messageId, threadId: msg.threadId, sender: "system", storeId } as any
      } as any);
    }

    return res.json({ ok: true, message: `Message ${messageId} deleted successfully` });
  } catch (err) {
    logger.error({ err }, `Error deleting message ${messageId}`);
    return res.status(500).json({ error: String(err) });
  }
});

export default router;
