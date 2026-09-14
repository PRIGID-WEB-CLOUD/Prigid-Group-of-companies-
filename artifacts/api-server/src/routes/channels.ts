import { Router, type Response } from "express";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, createHmac } from "crypto";
import { requireAdmin } from "../middleware/requireAdmin";
import { logger } from "../lib/logger";
import { eventBus } from "../lib/eventBus";
import {
  db,
  channelCredentialsTable,
  channelConfigsTable,
  channelEventLogsTable,
  channelWebhooksTable,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { type TenantRequest } from "../middleware/tenantContext";

const router = Router();
router.use("/channels", requireAdmin);

type ChannelStatus = "CONNECTED" | "PAUSED" | "DISCONNECTED";
type EventType = "sync" | "error" | "warning" | "info";

const CHANNELS = ["facebook", "instagram", "commerce", "ads", "whatsapp", "twitter"] as const;
const META_API_VERSION = process.env.META_API_VERSION ?? "v21.0";
export const SECRET_FIELDS = new Set([
  "app_secret", "page_access_token", "bearer_token", "api_secret",
  "access_token", "access_token_secret", "system_access_token", "webhook_verify_token",
  "master_access_token", "client_secret",
]);
const CREDENTIAL_FIELDS: Record<typeof CHANNELS[number], string[]> = {
  facebook: ["page_id", "catalog_id", "catalog_name", "app_id", "app_secret", "page_access_token", "pixel_id", "ad_account_id", "source"],
  instagram: ["ig_user_id", "page_access_token", "source"],
  commerce: ["catalog_id", "catalog_name", "page_access_token", "source"],
  ads: ["ad_account_id", "ad_account_name", "pixel_id", "page_access_token", "source"],
  whatsapp: ["phone_number_id", "waba_id", "system_access_token", "webhook_verify_token", "source"],
  twitter: ["api_key", "api_secret", "access_token", "access_token_secret", "bearer_token", "client_id", "client_secret"],
};
const credentialSchemas = Object.fromEntries(
  CHANNELS.map((channel) => [
    channel,
    z.object(Object.fromEntries(CREDENTIAL_FIELDS[channel].map((field) => [field, z.string().max(4096).optional()]))).strict(),
  ]),
) as unknown as Record<typeof CHANNELS[number], z.ZodType<Record<string, string | undefined>>>;

export function encryptionKey() {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY || "luxe-boutique-default-secret-key-32b";
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `enc:v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptSecret(value: string) {
  if (!value.startsWith("enc:v1:")) return value;
  const [, , ivText, tagText, ciphertextText] = value.split(":");
  const iv = Buffer.from(ivText, "base64url");
  const tag = Buffer.from(tagText, "base64url");
  const ciphertext = Buffer.from(ciphertextText, "base64url");
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Unable to decrypt channel credential. Verify CREDENTIAL_ENCRYPTION_KEY.");
  }
}

function maskSecret(value: string) {
  return `••••••••••••${value.slice(-4)}`;
}

function publicCredentials(data: Record<string, string>) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [
    key,
    SECRET_FIELDS.has(key) ? maskSecret(value) : value,
  ]));
}

type LiveCheck = { pass: boolean; detail: string; account?: Record<string, unknown> };

async function metaGraphGet(path: string, token: string, fields: string) {
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}${path}`);
  url.searchParams.set("fields", fields);
  const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json() as Record<string, unknown>;
  const providerError = data.error as Record<string, string> | undefined;
  return {
    ok: response.ok && !providerError,
    data,
    error: providerError?.message ?? `Provider returned HTTP ${response.status}`,
  };
}

async function verifyConnection(channelId: string, creds: Record<string, string>): Promise<LiveCheck> {
  if (channelId === "facebook") {
    if (!creds.page_id || !creds.page_access_token) {
      throw new Error("Missing Facebook Page ID or Page Access Token. Configure credentials in Channel Settings.");
    }
    const r = await metaGraphGet(`/${creds.page_id}`, creds.page_access_token, "id,name,fan_count,followers_count");
    return r.ok ? { pass: true, detail: "Facebook Page API responded successfully.", account: { id: r.data.id, name: r.data.name, followers: r.data.followers_count } } : { pass: false, detail: r.error };
  }
  if (channelId === "instagram") {
    if (!creds.ig_user_id || !creds.page_access_token) {
      throw new Error("Missing Instagram Business Account ID or Page Access Token. Configure credentials in Channel Settings.");
    }
    const r = await metaGraphGet(`/${creds.ig_user_id}`, creds.page_access_token, "id,name,username,followers_count,media_count");
    return r.ok ? { pass: true, detail: "Instagram Graph API responded successfully.", account: { id: r.data.id, name: r.data.name, username: r.data.username, followers: r.data.followers_count, mediaCount: r.data.media_count } } : { pass: false, detail: r.error };
  }
  if (channelId === "commerce") {
    if (!creds.catalog_id || !creds.page_access_token) {
      throw new Error("Missing Meta Catalog ID or Page Access Token. Configure credentials in Channel Settings.");
    }
    const r = await metaGraphGet(`/${creds.catalog_id}`, creds.page_access_token, "id,name,product_count,vertical");
    return r.ok ? { pass: true, detail: "Meta Commerce catalog API responded successfully.", account: { id: r.data.id, name: r.data.name, productCount: r.data.product_count, vertical: r.data.vertical } } : { pass: false, detail: r.error };
  }
  if (channelId === "ads") {
    if (!creds.ad_account_id || !creds.page_access_token) {
      throw new Error("Missing Meta Ad Account ID or Page Access Token. Configure credentials in Channel Settings.");
    }
    const id = creds.ad_account_id.startsWith("act_") ? creds.ad_account_id : `act_${creds.ad_account_id}`;
    const r = await metaGraphGet(`/${id}`, creds.page_access_token, "id,name,currency,account_status");
    return r.ok ? { pass: true, detail: "Meta Ads API responded successfully.", account: { id: r.data.id, name: r.data.name, currency: r.data.currency, status: r.data.account_status } } : { pass: false, detail: r.error };
  }
  if (channelId === "whatsapp") {
    if (!creds.phone_number_id || !creds.system_access_token) {
      throw new Error("Missing WhatsApp Phone Number ID or System Access Token. Configure credentials in Channel Settings.");
    }
    const r = await metaGraphGet(`/${creds.phone_number_id}`, creds.system_access_token, "display_phone_number,quality_rating,status,verified_name");
    return r.ok ? { pass: true, detail: "WhatsApp Business API responded successfully.", account: { phoneNumber: r.data.display_phone_number, quality: r.data.quality_rating, status: r.data.status, verifiedName: r.data.verified_name } } : { pass: false, detail: r.error };
  }
  if (channelId === "twitter") {
    const hasOauth1 = 
      creds["api_key"]?.trim() && 
      creds["api_secret"]?.trim() && 
      creds["access_token"]?.trim() && 
      creds["access_token_secret"]?.trim();

    const bearerToken = creds["bearer_token"]?.trim();

    if (!hasOauth1 && !bearerToken) {
      throw new Error("Missing X/Twitter credentials. Configure API Key/Secret and Access Token/Secret, or a Bearer Token in Channel Settings.");
    }

    const endpointUrl = "https://api.twitter.com/2/users/me";
    const queryParams = { "user.fields": "name,username" };

    let response: any;
    if (hasOauth1) {
      const oauthSignLocal = (
        method: string,
        url: string,
        params: Record<string, string>,
        consumerSecret: string,
        tokenSecret: string,
      ): string => {
        const enc = encodeURIComponent;
        const sorted = Object.entries(params).sort(([a], [b]) => (a < b ? -1 : 1));
        const paramStr = sorted.map(([k, v]) => `${enc(k)}=${enc(v)}`).join("&");
        const base = `${method.toUpperCase()}&${enc(url)}&${enc(paramStr)}`;
        const sigKey = `${enc(consumerSecret)}&${enc(tokenSecret)}`;
        return createHmac("sha1", sigKey).update(base).digest("base64");
      };

      const oauthParams: Record<string, string> = {
        oauth_consumer_key:     creds["api_key"]!,
        oauth_token:            creds["access_token"]!,
        oauth_signature_method: "HMAC-SHA1",
        oauth_version:          "1.0",
        oauth_timestamp:        String(Math.floor(Date.now() / 1000)),
        oauth_nonce:            randomUUID().replace(/-/g, ""),
      };

      const signatureParams = { ...oauthParams, ...queryParams };
      oauthParams["oauth_signature"] = oauthSignLocal(
        "GET",
        endpointUrl,
        signatureParams,
        creds["api_secret"]!,
        creds["access_token_secret"]!,
      );

      const authHeader =
        "OAuth " +
        Object.entries(oauthParams)
          .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
          .join(", ");

      const queryString = new URLSearchParams(queryParams).toString();
      const fullUrl = `${endpointUrl}?${queryString}`;

      response = await fetch(fullUrl, { headers: { Authorization: authHeader } });

      // Self-healing: if OAuth 1.0a fails with 401/403, and bearerToken is present, try fallback
      if (!(response as any).ok && ((response as any).status === 401 || (response as any).status === 403) && bearerToken) {
        console.warn(`[Twitter/X verifyChannel] OAuth 1.0a verification returned HTTP ${(response as any).status}. Trying fallback to App Bearer Token...`);
        const queryStringFallback = new URLSearchParams(queryParams).toString();
        const fallbackUrl = `${endpointUrl}?${queryStringFallback}`;
        response = await fetch(fallbackUrl, { headers: { Authorization: `Bearer ${bearerToken}` } });
      }
    } else {
      const queryString = new URLSearchParams(queryParams).toString();
      const fullUrl = `${endpointUrl}?${queryString}`;
      response = await fetch(fullUrl, { headers: { Authorization: `Bearer ${bearerToken}` } });
    }

    const text = await (response as any).text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(text); } catch { data = { rawText: text }; }

    return (response as any).ok
      ? { pass: true, detail: "X/Twitter API responded successfully.", account: (data.data as Record<string, unknown> | undefined) }
      : { pass: false, detail: (data.detail as string) ?? (data.title as string) ?? `Provider returned HTTP ${(response as any).status}` };
  }
  return { pass: false, detail: `Unsupported channel: ${channelId}.` };
}
const DEFAULT_WEBHOOKS = [
  { webhookId: "order_created", label: "Order Created", url: "/webhooks/order-created", active: true },
  { webhookId: "product_updated", label: "Product Updated", url: "/webhooks/product-updated", active: true },
  { webhookId: "cart_abandoned", label: "Cart Abandoned", url: "/webhooks/cart-abandoned", active: false },
  { webhookId: "customer_signup", label: "Customer Sign-up", url: "/webhooks/customer-signup", active: true },
];

export async function getChannelCredentials(channel: string, storeId: string): Promise<Record<string, string>> {
  const [row] = await db.select().from(channelCredentialsTable)
    .where(and(eq(channelCredentialsTable.channel, channel), eq(channelCredentialsTable.storeId, storeId))).limit(1);
  const stored = row?.data ?? {};
  const decrypted = Object.fromEntries(Object.entries(stored).map(([key, value]) => [key, decryptSecret(value as any)]));
  return decrypted;
}

export async function persistCredentials(channel: string, data: Record<string, string>, storeId: string) {
  const encrypted = Object.fromEntries(Object.entries(data).map(([key, value]) => [
    key,
    SECRET_FIELDS.has(key) && value ? encryptSecret(value) : value,
  ]));
  await db.insert(channelCredentialsTable)
    .values({ channel, storeId, data: encrypted, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [channelCredentialsTable.channel, channelCredentialsTable.storeId],
      set: { data: encrypted, updatedAt: new Date() },
    });
}

export async function ensureDefaults(storeId: string) {
  for (const channelId of CHANNELS) {
    const creds = await getChannelCredentials(channelId, storeId);
    const hasCreds = Object.values(creds).some((v) => Boolean(v && !v.startsWith("••••")));

    await db.insert(channelConfigsTable)
      .values({
        id: randomUUID(),
        storeId,
        channelId,
        status: "DISCONNECTED",
        latency: 0,
        lastSync: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [channelConfigsTable.channelId, channelConfigsTable.storeId],
        set: hasCreds
          ? { updatedAt: new Date() }
          : { status: "DISCONNECTED", latency: 0, updatedAt: new Date() },
      });
  }

  for (const webhook of DEFAULT_WEBHOOKS) {
    await db.insert(channelWebhooksTable)
      .values({ id: randomUUID(), storeId, ...webhook })
      .onConflictDoNothing({ target: [channelWebhooksTable.webhookId, channelWebhooksTable.storeId] });
  }
}

type AuditActor = {
  adminUserId?: string;
  adminEmail?: string;
  ip?: string;
  userAgent?: string;
};

export async function addEvent(
  channel: string,
  event: string,
  detail: string,
  type: EventType = "info",
  storeId: string,
  actor: AuditActor = {},
) {
  try {
    const id = randomUUID();
    const createdAt = new Date();
    const payload = {
      id,
      storeId,
      channel,
      event,
      detail,
      type,
      adminUserId: actor.adminUserId ?? null,
      adminEmail: actor.adminEmail ?? null,
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
      createdAt,
    };
    await db.insert(channelEventLogsTable).values(payload);
    
    // Publish via eventBus to admin clients in real time
    eventBus.publish({
      type: "channel_event",
      payload: {
        ...payload,
        createdAt: createdAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error({ err: error, channel, event }, "Failed to write channel event");
  }
}

export async function auditActor(req: TenantRequest): Promise<AuditActor> {
  return {
    adminUserId: (req as any).adminUser?.id,
    adminEmail: (req as any).adminUser?.email,
    ip: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
  };
}

router.get("/channels/configs", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  return res.json(await db.select().from(channelConfigsTable).where(eq(channelConfigsTable.storeId, storeId)));
});

router.put("/channels/configs/:channelId/status", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const channelId = req.params.channelId as string;
  const parsedStatus = z.enum(["CONNECTED", "PAUSED", "DISCONNECTED"]).safeParse(req.body.status);
  if (!parsedStatus.success) return res.status(400).json({ error: "Invalid channel status." });
  const status: ChannelStatus = parsedStatus.data;
  if (status === "CONNECTED") {
    return res.status(400).json({ error: "A channel can only become CONNECTED after a successful live test or sync." });
  }
  const [updated] = await db.update(channelConfigsTable)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(channelConfigsTable.channelId, channelId), eq(channelConfigsTable.storeId, storeId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Channel not found" });
  addEvent(channelId, `Status changed to ${status}`, `Channel is now ${status.toLowerCase()}.`, "warning", storeId);
  return res.json(updated);
});

router.post("/channels/configs/:channelId/verify", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const channelId = req.params.channelId as string;
  const [config] = await db.select().from(channelConfigsTable).where(and(eq(channelConfigsTable.channelId, channelId), eq(channelConfigsTable.storeId, storeId))).limit(1);
  if (!config) return res.status(404).json({ error: "Channel not found" });
  const startedAt = performance.now();
  try {
    const result = await verifyConnection(channelId, await getChannelCredentials(channelId, storeId));
    const latency = Math.round(performance.now() - startedAt);
    if (!result.pass) throw new Error(result.detail);
    const [updated] = await db.update(channelConfigsTable)
      .set({ latency, status: "CONNECTED", updatedAt: new Date() })
      .where(and(eq(channelConfigsTable.channelId, channelId), eq(channelConfigsTable.storeId, storeId))).returning();
    addEvent(channelId, "Connection verification passed", `${result.detail} (${latency}ms)`, "sync", storeId);
    return res.json({ ...updated, account: result.account, operation: "connection_verification" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const latency = Math.round(performance.now() - startedAt);
    await db.update(channelConfigsTable).set({ status: "DISCONNECTED", latency, updatedAt: new Date() })
      .where(and(eq(channelConfigsTable.channelId, channelId), eq(channelConfigsTable.storeId, storeId)));
    addEvent(channelId, "Connection verification failed", `${detail} (${latency}ms)`, "error", storeId);
    return res.status(502).json({ error: detail, latency });
  }
});

router.post("/channels/configs/verify-all", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const configs = await db.select().from(channelConfigsTable).where(eq(channelConfigsTable.storeId, storeId));
  if (configs.length === 0) {
    return res.status(409).json({
      ok: false,
      error: "No channels are available to synchronize.",
      results: [],
    });
  }
  const results = await Promise.all(configs.map(async (config) => {
    const startedAt = performance.now();
    try {
      const result = await verifyConnection(config.channelId, await getChannelCredentials(config.channelId, storeId));
      const latency = Math.round(performance.now() - startedAt);
      if (!result.pass) throw new Error(result.detail);
      await db.update(channelConfigsTable).set({ latency, status: "CONNECTED", lastSync: new Date(), updatedAt: new Date() })
        .where(and(eq(channelConfigsTable.channelId, config.channelId), eq(channelConfigsTable.storeId, storeId)));
      addEvent(config.channelId, "Connection verification passed", `${result.detail} (${latency}ms)`, "sync", storeId);
      return { channelId: config.channelId, ok: true, latency, account: result.account, operation: "connection_verification" };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const latency = Math.round(performance.now() - startedAt);
      await db.update(channelConfigsTable).set({ status: "DISCONNECTED", latency, updatedAt: new Date() })
        .where(and(eq(channelConfigsTable.channelId, config.channelId), eq(channelConfigsTable.storeId, storeId)));
      addEvent(config.channelId, "Connection verification failed", `${detail} (${latency}ms)`, "error", storeId);
      return { channelId: config.channelId, ok: false, latency, error: detail };
    }
  }));
  const failed = results.filter((result) => !result.ok).length;
  addEvent("system", failed ? "Connection verification completed with failures" : "Connection verification completed", `${results.length - failed}/${results.length} channels verified.`, failed ? "warning" : "sync", storeId);
  return res.status(failed ? 207 : 200).json({ ok: failed === 0 && results.length > 0, results });
});

router.post("/channels/configs/:channelId/test", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const channelId = req.params.channelId as string;
  const [config] = await db.select().from(channelConfigsTable)
    .where(and(eq(channelConfigsTable.channelId, channelId), eq(channelConfigsTable.storeId, storeId))).limit(1);
  if (!config) return res.status(404).json({ error: "Channel not found" });
  const startedAt = performance.now();
  let result: LiveCheck;
  try {
    result = await verifyConnection(channelId, await getChannelCredentials(channelId, storeId));
  } catch (error) {
    result = { pass: false, detail: error instanceof Error ? error.message : String(error) };
  }

  const latency = Math.round(performance.now() - startedAt);
  await db.update(channelConfigsTable)
    .set({ latency, status: result.pass ? "CONNECTED" : "DISCONNECTED", updatedAt: new Date() })
    .where(and(eq(channelConfigsTable.channelId, channelId), eq(channelConfigsTable.storeId, storeId)));
  addEvent(
    channelId,
    result.pass ? "Live connection test passed" : "Live connection test failed",
    `${result.detail} (${latency}ms)`,
    result.pass ? "sync" : "error",
    storeId
  );
  return res.json({ pass: result.pass, ok: result.pass, latency, detail: result.detail, account: result.account });
});

router.get("/channels/events", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  return res.json(await db.select().from(channelEventLogsTable).where(eq(channelEventLogsTable.storeId, storeId)).orderBy(desc(channelEventLogsTable.createdAt)).limit(200));
});

router.delete("/channels/events", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  await db.delete(channelEventLogsTable).where(eq(channelEventLogsTable.storeId, storeId));
  return res.json({ ok: true });
});

router.get("/channels/webhooks", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  return res.json(await db.select().from(channelWebhooksTable).where(eq(channelWebhooksTable.storeId, storeId)));
});

router.put("/channels/webhooks/:webhookId", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const [updated] = await db.update(channelWebhooksTable)
    .set({ active: Boolean(req.body.active), updatedAt: new Date() })
    .where(and(eq(channelWebhooksTable.webhookId, req.params.webhookId as string), eq(channelWebhooksTable.storeId, storeId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Webhook not found" });
  return res.json(updated);
});

router.get("/channels/credentials/:channel", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const channel = req.params.channel as string;
  if (!CHANNELS.includes(channel as typeof CHANNELS[number])) return res.status(404).json({ error: "Unknown channel." });
  return res.json(publicCredentials(await getChannelCredentials(channel, storeId)));
});

router.put("/channels/credentials/:channel", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const channel = req.params.channel as string;
  if (!CHANNELS.includes(channel as typeof CHANNELS[number])) return res.status(404).json({ error: "Unknown channel." });
  const parsed = credentialSchemas[channel as typeof CHANNELS[number]].safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid credential fields.", details: parsed.error.flatten() });
  const existing = await getChannelCredentials(channel, storeId);
  const data = { ...existing };
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined || (SECRET_FIELDS.has(key) && value.startsWith("••••"))) continue;
    if (value === "") delete data[key];
    else data[key] = value;
  }
  await persistCredentials(channel, data, storeId);
  await addEvent(channel, "API credentials updated", "Credentials saved to database.", "info", storeId, await auditActor(req));
  return res.json({ ok: true, credentials: publicCredentials(data) });
});

router.delete("/channels/credentials/:channel", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const channel = req.params.channel as string;
  if (!CHANNELS.includes(channel as typeof CHANNELS[number])) return res.status(404).json({ error: "Unknown channel." });
  await persistCredentials(channel, {}, storeId);
  await addEvent(channel, "API credentials cleared", "All credentials removed.", "warning", storeId, await auditActor(req));
  return res.json({ ok: true });
});

export default router;
