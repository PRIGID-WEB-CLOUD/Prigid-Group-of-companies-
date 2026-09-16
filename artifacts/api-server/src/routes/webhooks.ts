import { Router } from "express";
import { randomUUID } from "crypto";
import { db, messagesTable, channelCredentialsTable } from "@workspace/db";
import { addEvent } from "./channels";
import { eventBus } from "../lib/eventBus";
import { logger } from "../lib/logger";
import { eq, sql } from "drizzle-orm";

const router = Router();

// Helper to resolve storeId from recipientId (Page ID, WABA ID, etc)
async function resolveStoreIdFromRecipient(recipientId: string): Promise<string | null> {
  if (!recipientId) return null;
  const [match] = await db.select({ storeId: channelCredentialsTable.storeId })
    .from(channelCredentialsTable)
    .where(sql`${channelCredentialsTable.data}->>'page_id' = ${recipientId} OR 
               ${channelCredentialsTable.data}->>'waba_id' = ${recipientId} OR 
               ${channelCredentialsTable.data}->>'phone_number_id' = ${recipientId} OR 
               ${channelCredentialsTable.data}->>'ig_user_id' = ${recipientId} OR
               ${channelCredentialsTable.data}->>'catalog_id' = ${recipientId}`)
    .limit(1);
  return match?.storeId ?? null;
}

// Helper to extract Meta verification
async function handleMetaVerify(req: any, res: any, channelName: string) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  logger.info({ mode, token, challenge, channelName }, "Meta Webhook verification requested");

  if (mode === "subscribe") {
    // Read the expected token from environment variable, falling back to "Luxe"
    const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN || "Luxe";

    // Strictly validate the verify token
    if (token === expectedToken) {
      // Note: verification event is logged without storeId because we don't know the store yet during GET verification
      res.set("Content-Type", "text/plain");
      return res.status(200).send(String(challenge));
    } else {
      logger.warn({ received: token, expected: expectedToken }, "Meta Webhook verification token mismatch");
    }
  }
  return res.status(403).send("Forbidden: Verification failed due to token mismatch");
}

// GET Verification endpoints
router.get("/webhooks/whatsapp", (req, res, next) => handleMetaVerify(req, res, "whatsapp").catch(next));
router.get("/webhooks/facebook", (req, res, next) => handleMetaVerify(req, res, "facebook").catch(next));
router.get("/webhooks/instagram", (req, res, next) => handleMetaVerify(req, res, "instagram").catch(next));
router.get("/webhooks/commerce", (req, res, next) => handleMetaVerify(req, res, "commerce").catch(next));
router.get("/webhooks/ads", (req, res, next) => handleMetaVerify(req, res, "ads").catch(next));
router.get("/webhooks/meta", (req, res, next) => handleMetaVerify(req, res, "meta").catch(next));

// Handlers for webhook processing
async function processWhatsAppWebhook(payload: any) {
  const entries = payload?.entry || [];
  for (const entry of entries) {
    const recipientId = entry.id;
    const storeId = await resolveStoreIdFromRecipient(recipientId);
    if (!storeId) {
      logger.warn({ recipientId }, "[Meta WhatsApp Webhook] Unmapped recipient ID; dropping event to preserve tenant boundary");
      continue;
    }

    const changes = entry?.changes || [];
    for (const change of changes) {
      const value = change?.value;
      const messages = value?.messages || [];
      const contacts = value?.contacts || [];

      for (const message of messages) {
        // Ignore echo messages (messages sent by the business itself)
        if (message.from === value?.metadata?.display_phone_number || (message as any).is_echo) {
          logger.info({ from: message.from }, "Ignoring WhatsApp echo message");
          continue;
        }

        const senderId = message.from; // phone number/wa_id
        const contact = contacts.find((c: any) => c.wa_id === senderId);
        const customerName = contact?.profile?.name || `WhatsApp User (${senderId})`;
        const text = message.text?.body || `[Unsupported message type: ${message.type}]`;
        const messageId = message.id || randomUUID();
        const timestampSec = parseInt(message.timestamp, 10) || Math.floor(Date.now() / 1000);
        const threadId = `whatsapp_${senderId}`;

        const [inserted] = await db.insert(messagesTable).values({
          id: messageId,
          storeId,
          threadId,
          sender: "customer",
          text,
          timestamp: new Date(timestampSec * 1000),
          status: "delivered",
          type: "message",
          customerName,
          phone: senderId,
          email: "",
          channel: "whatsapp",
          channelType: "chat",
          recipientId
        }).returning();

        await addEvent("whatsapp", "Message received", `From ${customerName}: "${text.slice(0, 50)}"`, "sync", storeId);

        eventBus.publish({
          type: "new_message",
          storeId,
          payload: inserted
        } as any);
      }
    }
  }
}

async function processFacebookWebhook(payload: any) {
  const entries = payload?.entry || [];
  for (const entry of entries) {
    const recipientId = entry.id;
    const storeId = await resolveStoreIdFromRecipient(recipientId);
    if (!storeId) {
      logger.warn({ recipientId }, "[Meta Facebook Webhook] Unmapped recipient ID; dropping event to preserve tenant boundary");
      continue;
    }

    // 1. Messenger DMs
    if (entry?.messaging) {
      for (const messagingEvent of entry.messaging) {
        const message = messagingEvent.message;
        const senderId = messagingEvent.sender?.id;

        if (message && senderId) {
          const isEcho = !!message.is_echo;
          if (isEcho) {
            logger.info({ senderId }, "Ignoring Facebook Messenger echo message");
            continue;
          }
          
          const text = message.text || (message.attachments ? "[Media Attachment]" : "[Unsupported Message]");
          const messageId = message.mid || randomUUID();
          const customerName = `Facebook User (${senderId})`;
          const threadId = `facebook_${senderId}`;

          const [inserted] = await db.insert(messagesTable).values({
            id: messageId,
            storeId,
            threadId,
            sender: isEcho ? "admin" : "customer",
            text,
            timestamp: new Date(messagingEvent.timestamp || Date.now()),
            status: "delivered",
            type: "message",
            customerName,
            phone: senderId,
            email: "",
            channel: "facebook",
            channelType: "chat",
            recipientId
          }).returning();

          await addEvent("facebook", isEcho ? "Outgoing message echo" : "Messenger message received", `From ${isEcho ? "Admin" : customerName}: "${text.slice(0, 50)}"`, "sync", storeId);

          eventBus.publish({
            type: "new_message",
            storeId,
            payload: inserted
          } as any);
        }
      }
    }

    // 2. Feed comments
    if (entry?.changes) {
      for (const change of entry.changes) {
        const value = change?.value;

        if (change.field === "feed" && value?.item === "comment" && value?.verb === "add") {
          const senderId = value.sender_id;
          const customerName = value.sender_name || `Facebook User (${senderId})`;
          const text = value.message || "";
          const commentId = value.comment_id || randomUUID();
          const threadId = `facebook_${senderId}`;

          const [inserted] = await db.insert(messagesTable).values({
            id: commentId,
            storeId,
            threadId,
            sender: "customer",
            text,
            timestamp: new Date((value.created_time || Math.floor(Date.now() / 1000)) * 1000),
            status: "delivered",
            type: "comment",
            customerName,
            phone: senderId,
            email: "",
            channel: "facebook",
            channelType: "comment",
            postCaption: value.post_id ? `Post ID: ${value.post_id}` : undefined,
            recipientId
          }).returning();

          await addEvent("facebook", "Comment received", `From ${customerName} on post: "${text.slice(0, 50)}"`, "sync", storeId);

          eventBus.publish({
            type: "new_message",
            storeId,
            payload: inserted
          } as any);
        }
      }
    }
  }
}

async function processInstagramWebhook(payload: any) {
  const entries = payload?.entry || [];
  for (const entry of entries) {
    const recipientId = entry.id;
    const storeId = await resolveStoreIdFromRecipient(recipientId);
    if (!storeId) {
      logger.warn({ recipientId }, "[Meta Instagram Webhook] Unmapped recipient ID; dropping event to preserve tenant boundary");
      continue;
    }

    // 1. Instagram DMs
    if (entry?.messaging) {
      for (const messagingEvent of entry.messaging) {
        const message = messagingEvent.message;
        const senderId = messagingEvent.sender?.id;

        if (message && senderId) {
          const isEcho = !!message.is_echo;
          if (isEcho) {
            logger.info({ senderId }, "Ignoring Instagram DM echo message");
            continue;
          }
          
          const text = message.text || (message.attachments ? "[Media Attachment]" : "[Unsupported Message]");
          const messageId = message.mid || randomUUID();
          const customerName = `Instagram User (${senderId})`;
          const threadId = `instagram_${senderId}`;

          const [inserted] = await db.insert(messagesTable).values({
            id: messageId,
            storeId,
            threadId,
            sender: isEcho ? "admin" : "customer",
            text,
            timestamp: new Date(messagingEvent.timestamp || Date.now()),
            status: "delivered",
            type: "message",
            customerName,
            phone: senderId,
            email: "",
            channel: "instagram",
            channelType: "chat",
            recipientId
          }).returning();

          await addEvent("instagram", isEcho ? "Outgoing DM echo" : "DM received", `From ${isEcho ? "Admin" : customerName}: "${text.slice(0, 50)}"`, "sync", storeId);

          eventBus.publish({
            type: "new_message",
            storeId,
            payload: inserted
          } as any);
        }
      }
    }

    // 2. Instagram Comments
    if (entry?.changes) {
      for (const change of entry.changes) {
        const value = change?.value;

        if (change.field === "comments") {
          const senderId = value?.from?.id;
          const customerName = value?.from?.username || `Instagram User (${senderId})`;
          const text = value?.text || "";
          const commentId = value?.id || randomUUID();
          const threadId = `instagram_${senderId}`;

          const [inserted] = await db.insert(messagesTable).values({
            id: commentId,
            storeId,
            threadId,
            sender: "customer",
            text,
            timestamp: new Date(),
            status: "delivered",
            type: "comment",
            customerName,
            phone: senderId,
            email: "",
            channel: "instagram",
            channelType: "comment",
            postCaption: value?.media?.id ? `Media ID: ${value.media.id}` : undefined,
            recipientId
          }).returning();

          await addEvent("instagram", "Comment received", `From ${customerName}: "${text.slice(0, 50)}"`, "sync", storeId);

          eventBus.publish({
            type: "new_message",
            storeId,
            payload: inserted
          } as any);
        }
      }
    }
  }
}

// POST Event endpoints
router.post("/webhooks/whatsapp", async (req, res) => {
  const payload = req.body;
  logger.info({ payload }, "WhatsApp Webhook Payload Received");

  try {
    await processWhatsAppWebhook(payload);
    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Error processing WhatsApp webhook");
    return res.status(500).json({ error: String(err) });
  }
});

router.post("/webhooks/facebook", async (req, res) => {
  const payload = req.body;
  logger.info({ payload }, "Facebook Webhook Payload Received");

  try {
    await processFacebookWebhook(payload);
    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Error processing Facebook webhook");
    return res.status(500).json({ error: String(err) });
  }
});

router.post("/webhooks/instagram", async (req, res) => {
  const payload = req.body;
  logger.info({ payload }, "Instagram Webhook Payload Received");

  try {
    await processInstagramWebhook(payload);
    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Error processing Instagram webhook");
    return res.status(500).json({ error: String(err) });
  }
});

// POST Commerce/Catalog Webhook endpoint
router.post("/webhooks/commerce", async (req, res) => {
  const payload = req.body;
  logger.info({ payload }, "Meta Commerce Webhook Payload Received");

  try {
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (change) {
      const recipientId = entry?.id;
      const storeId = await resolveStoreIdFromRecipient(recipientId);
      if (!storeId) {
        logger.warn({ recipientId }, "[Meta Commerce Webhook] Unmapped recipient ID; ignoring event to preserve tenant boundary");
        return res.status(200).json({ ok: true });
      }

      await addEvent(
        "commerce",
        "Catalog sync event",
        `Catalog event received: field="${change.field}", verb="${value?.verb || "update"}"`,
        "info",
        storeId
      );
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Error processing Commerce webhook");
    return res.status(500).json({ error: String(err) });
  }
});

// POST Ads Webhook endpoint
router.post("/webhooks/ads", async (req, res) => {
  const payload = req.body;
  logger.info({ payload }, "Meta Ads Webhook Payload Received");

  try {
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0];

    if (change) {
      const recipientId = entry?.id;
      const storeId = await resolveStoreIdFromRecipient(recipientId);
      if (!storeId) {
        logger.warn({ recipientId }, "[Meta Ads Webhook] Unmapped recipient ID; ignoring event to preserve tenant boundary");
        return res.status(200).json({ ok: true });
      }

      await addEvent(
        "ads",
        "Ad account event",
        `Ad event received: field="${change.field}", id="${change.value?.ad_id || "unknown"}"`,
        "info",
        storeId
      );
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Error processing Ads webhook");
    return res.status(500).json({ error: String(err) });
  }
});

// A unified catch-all endpoint for any Meta webhook integration
router.post("/webhooks/meta", async (req, res) => {
  const payload = req.body;
  const objectType = payload?.object;

  logger.info({ objectType, hasEntry: !!payload?.entry }, "Unified Meta Webhook Payload Received");

  try {
    if (objectType === "whatsapp_business_account") {
      await processWhatsAppWebhook(payload);
      return res.status(200).json({ ok: true, channel: "whatsapp" });
    } else if (objectType === "page") {
      await processFacebookWebhook(payload);
      return res.status(200).json({ ok: true, channel: "facebook" });
    } else if (objectType === "instagram") {
      await processInstagramWebhook(payload);
      return res.status(200).json({ ok: true, channel: "instagram" });
    } else {
      logger.warn({ objectType }, "Received Meta webhook with unknown object type");
      return res.status(200).json({ received: true, note: "Unknown or unsupported object type" });
    }
  } catch (err: any) {
    logger.error({ err: err.message, stack: err.stack }, "Error processing unified Meta webhook");
    return res.status(500).json({ error: String(err.message || err) });
  }
});

export default router;
