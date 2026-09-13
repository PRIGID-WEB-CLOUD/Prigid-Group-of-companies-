import { Router } from "express";
import { randomUUID } from "crypto";
import { db, messagesTable } from "@workspace/db";
import { requireAdmin } from "../middleware/requireAdmin";
import { addEvent, getChannelCredentials } from "./channels";
import { eventBus } from "../lib/eventBus";
import { logger } from "../lib/logger";
import { eq, desc, asc, sql, or, and } from "drizzle-orm";

const router = Router();
router.use("/chat", requireAdmin);
router.use("/crm", requireAdmin);
router.use("/inbox", requireAdmin);

// Helper to get active asset IDs
async function getActiveAssetIds() {
  const [fbCreds, igCreds, waCreds] = await Promise.all([
    getChannelCredentials("facebook"),
    getChannelCredentials("instagram"),
    getChannelCredentials("whatsapp")
  ]);

  const ids: string[] = [];
  if (fbCreds.page_id) ids.push(fbCreds.page_id);
  if (igCreds.ig_user_id) ids.push(igCreds.ig_user_id);
  if (waCreds.waba_id) ids.push(waCreds.waba_id); // WABA ID is used as recipientId in webhooks
  if (waCreds.phone_number_id) ids.push(waCreds.phone_number_id);

  return ids;
}

// Health check for CRM database connectivity
router.get("/chat/health", async (_req, res) => {
  try {
    const rows = await db.execute(sql`SELECT count(*) FROM ${messagesTable}`);
    res.json({ ok: true, count: rows.rows[0].count });
  } catch (err: any) {
    logger.error({ err }, "CRM Health Check Failed");
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Fetch messages filtered by active assets
router.get("/chat/messages", async (req, res) => {
  try {
    const activeIds = await getActiveAssetIds();
    
    // If no assets are connected, we still might want to show non-meta channels (if any)
    // but for Meta specifically, we filter.
    // If activeIds is empty, and we want to be strict, we'd return nothing for meta.
    
    let query = db.select().from(messagesTable);
    
    if (activeIds.length > 0) {
      // Filter where recipientId is in activeIds OR recipientId is null (backward compatibility/internal notes)
      // Actually, for strict asset switching, we only show messages for the active ones.
      query = query.where(
        or(
          sql`${messagesTable.recipientId} IN (${activeIds.join(',')})`,
          sql`${messagesTable.recipientId} IS NULL`,
          eq(messagesTable.channel, "whatsapp") // WhatsApp often uses phone_number_id but let's be safe
        )
      ) as any;
    }

    const list = await query.orderBy(asc(messagesTable.timestamp));
    return res.json(list);
  } catch (err) {
    logger.error({ err }, "Error fetching chat messages");
    return res.status(500).json({ error: String(err) });
  }
});

// Admin sends message, comment reply, or adds note
router.post("/chat/messages", async (req, res) => {
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
    const creds = await getChannelCredentials(channel);
    if (channel === "whatsapp") recipientId = creds["waba_id"] || creds["phone_number_id"];
    else if (channel === "facebook") recipientId = creds["page_id"];
    else if (channel === "instagram") recipientId = creds["ig_user_id"];

    const [inserted] = await db.insert(messagesTable).values({
      id: messageId,
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
        const waCreds = await getChannelCredentials("whatsapp");
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
              await addEvent("whatsapp", "Outbound message failed", `Meta API Error: ${errorMsg}`, "error");
            } else {
              await db.update(messagesTable).set({ status: "delivered" }).where(eq(messagesTable.id, messageId));
              inserted.status = "delivered";
            }
          } catch (err) {
            logger.error({ err }, "Error calling outgoing WhatsApp API");
            await addEvent("whatsapp", "Outbound message failed", `Network Error: ${String(err)}`, "error");
          }
        }
      } else if (channel === "facebook" || channel === "instagram") {
        const creds = await getChannelCredentials(channel);
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
              await addEvent(channel, "Outbound message failed", `Meta API Error: ${errorMsg}`, "error");
            } else {
              await db.update(messagesTable).set({ status: "delivered" }).where(eq(messagesTable.id, messageId));
              inserted.status = "delivered";
            }
          } catch (err) {
            logger.error({ err, channel }, "Error calling outgoing Meta Messaging API");
            await addEvent(channel, "Outbound message failed", `Network Error: ${String(err)}`, "error");
          }
        }
      }
    }

    // Add Audit Log
    const actionLabel = type === "note" ? "Note added" : "Reply sent";
    await addEvent(channel, actionLabel, `To ${customerName}: "${text.slice(0, 50)}"`, "info");

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
router.post("/chat/threads/:threadId/clear-unread", async (req, res) => {
  const { threadId } = req.params;

  try {
    // Update all customer messages in this thread to "read"
    await db.update(messagesTable)
      .set({ status: "read" })
      .where(eq(messagesTable.threadId, threadId));

    // Also broadcast a system read sync event to any active UI clients
    eventBus.publish({
      type: "new_message",
      payload: { threadId, action: "clear-unread", sender: "system" } as any
    } as any);

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Error clearing unread for thread " + threadId);
    return res.status(500).json({ error: String(err) });
  }
});

// Clear all CRM chat messages
router.delete("/chat/messages", async (req, res) => {
  try {
    await db.delete(messagesTable);

    // Broadcast sync event to all active UI clients to refresh threads
    eventBus.publish({
      type: "new_message",
      payload: { action: "clear-all", sender: "system" } as any
    } as any);

    return res.json({ ok: true, message: "All CRM chat messages cleared successfully" });
  } catch (err) {
    logger.error({ err }, "Error clearing all chat messages");
    return res.status(500).json({ error: String(err) });
  }
});

// Delete an individual chat thread
router.delete("/chat/threads/:threadId", async (req, res) => {
  const { threadId } = req.params;
  try {
    await db.delete(messagesTable).where(eq(messagesTable.threadId, threadId));

    eventBus.publish({
      type: "new_message",
      payload: { action: "delete-thread", threadId, sender: "system" } as any
    } as any);

    return res.json({ ok: true, message: `Thread ${threadId} deleted successfully` });
  } catch (err) {
    logger.error({ err }, `Error deleting thread ${threadId}`);
    return res.status(500).json({ error: String(err) });
  }
});

// Delete an individual message
router.delete("/chat/messages/:messageId", async (req, res) => {
  const { messageId } = req.params;
  try {
    const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId));
    await db.delete(messagesTable).where(eq(messagesTable.id, messageId));

    if (msg) {
      eventBus.publish({
        type: "new_message",
        payload: { action: "delete-message", messageId, threadId: msg.threadId, sender: "system" } as any
      } as any);
    }

    return res.json({ ok: true, message: `Message ${messageId} deleted successfully` });
  } catch (err) {
    logger.error({ err }, `Error deleting message ${messageId}`);
    return res.status(500).json({ error: String(err) });
  }
});

export default router;
