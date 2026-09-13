import { Router } from "express";
import { createHash, randomBytes, randomUUID } from "crypto";
import { desc, eq, inArray } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAdmin";
import { eprolo } from "../services/eprolo";
import { sendEmail, loadBrandingCache } from "../services/mailer";
import { db, apiKeysTable, appSettingsTable, providerPluginsTable } from "@workspace/db";
import { encryptCredential, decryptCredential, isEncryptedCredential } from "../services/credentialVault";
import { testCloudinaryConnection } from "../services/cloudinary";

const router = Router();
router.use("/settings", requireAdmin);
router.use("/apikeys", requireAdmin);
router.use("/providers", requireAdmin);

const DEFAULT_SETTINGS: Record<string, string> = { store_name: "LUXE BOUTIQUE" };
const SECRET_SETTINGS = new Set([
  "cloudinary_api_secret", "paystack_secret_key", "flutterwave_secret_key",
  "stripe_secret_key", "eprolo_api_key", "eprolo_api_secret", "smtp_pass",
]);
const PROVIDER_CATALOG = [
  { name: "eprolo", label: "Eprolo", description: "Dropshipping and fulfillment automation." },
  { name: "printful", label: "Printful", description: "Print-on-demand fulfillment." },
  { name: "shipbob", label: "ShipBob", description: "Global e-commerce fulfillment and warehousing." },
  { name: "gooten", label: "Gooten", description: "Global print-on-demand manufacturing." },
  { name: "dhl", label: "DHL Express", description: "International courier and automated express shipping." },
];

async function readSettings() {
  const rows = await db.select().from(appSettingsTable);
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((row) => [row.key, row.value])) };
}

function safeSettings(settings: Record<string, string>) {
  return Object.fromEntries(Object.entries(settings).map(([key, value]) => [
    key,
    SECRET_SETTINGS.has(key) && value ? "●●●●●●●●" : value,
  ]));
}

function configured(settings: Record<string, string>) {
  return {
    cloudinaryConfigured: Boolean(settings.cloudinary_cloud_name && settings.cloudinary_api_key && settings.cloudinary_api_secret),
  };
}

router.get("/settings", async (_req, res) => {
  const settings = await readSettings();
  return res.json({ settings: safeSettings(settings), status: configured(settings) });
});

router.get("/settings/google-config", async (_req, res) => {
  const rows = await db.select().from(appSettingsTable).where(inArray(appSettingsTable.key, ["google_client_id", "google_client_secret"]));
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  
  return res.json({
    clientId: process.env.GOOGLE_CLIENT_ID || settings.google_client_id || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || (settings.google_client_secret ? decryptCredential(settings.google_client_secret) : ""),
  });
});

router.put("/settings", async (req, res) => {
  for (const [key, value] of Object.entries(req.body as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    if (SECRET_SETTINGS.has(key) && value === "●●●●●●●●") continue;
    const storedValue = SECRET_SETTINGS.has(key) && value
      ? (isEncryptedCredential(value) ? value : encryptCredential(value))
      : value;
    await db.insert(appSettingsTable).values({ key, value: storedValue, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: storedValue, updatedAt: new Date() } });
  }
  const settings = await readSettings();
  await loadBrandingCache().catch((err) => console.error("Failed to refresh branding cache:", err));
  return res.json({ settings: safeSettings(settings), status: configured(settings) });
});

router.post("/settings/test/email", async (_req, res) => {
  const settings = await readSettings();
  const sentTo = settings.store_email || "admin@luxeboutique.com";
  try {
    await sendEmail({
      to: sentTo,
      subject: "Luxe Boutique Notification Test",
      text: "Your Luxe Boutique notification settings are operational.",
      html: "<p>Your Luxe Boutique notification settings are operational.</p>",
    });
    return res.json({ ok: true, sentTo });
  } catch (error) {
    console.error("[Settings] Notification test failed:", error instanceof Error ? error.message : error);
    return res.status(500).json({ error: "Failed to dispatch test notification." });
  }
});

router.post("/settings/test/cloudinary", async (_req, res) => {
  try {
    const result = await testCloudinaryConnection();
    return res.json({
      ok: true,
      message: `Cloudinary connected successfully to cloud '${result.cloudName}'. Upload adapter is active.`,
      cloudName: result.cloudName,
    });
  } catch (err: any) {
    console.error("[Settings] Cloudinary test failed:", err?.message || err);
    return res.status(400).json({
      error: err?.message || "Failed to verify Cloudinary credentials.",
    });
  }
});

function makeKey() {
  const rawKey = `pk_live_${randomBytes(32).toString("base64url")}`;
  return { rawKey, keyPrefix: rawKey.slice(0, 12) };
}

function safeKey(key: typeof apiKeysTable.$inferSelect) {
  const { keyHash: _, ...safe } = key;
  return safe;
}

router.get("/apikeys", async (_req, res) => {
  const keys = await db.select().from(apiKeysTable).orderBy(desc(apiKeysTable.createdAt));
  return res.json(keys.map(safeKey));
});

router.post("/apikeys", async (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name) return res.status(400).json({ error: "name is required." });
  const { rawKey, keyPrefix } = makeKey();
  const [key] = await db.insert(apiKeysTable).values({
    id: randomUUID(), name, keyHash: createHash("sha256").update(rawKey).digest("hex"), keyPrefix,
  }).returning();
  return res.status(201).json({ ...safeKey(key), rawKey });
});

router.delete("/apikeys/:id", async (req, res) => {
  const [key] = await db.update(apiKeysTable)
    .set({ revokedAt: new Date() }).where(eq(apiKeysTable.id, req.params.id as string)).returning();
  if (!key) return res.status(404).json({ error: "API key not found." });
  return res.json({ ok: true });
});

router.delete("/apikeys/:id/permanent", async (req, res) => {
  await db.delete(apiKeysTable).where(eq(apiKeysTable.id, req.params.id as string));
  return res.json({ ok: true });
});

function safeProvider(provider: typeof providerPluginsTable.$inferSelect) {
  return {
    id: provider.id, name: provider.name, label: provider.label, description: provider.description,
    mode: provider.mode, enabled: provider.enabled, connected: provider.connected,
    webhookUrl: provider.webhookUrl, lastSyncAt: provider.lastSyncAt, lastError: provider.lastError,
    updatedAt: provider.updatedAt, logoUrl: provider.logoUrl, storeId: provider.storeId,
    apiKeyConfigured: Boolean(provider.apiKey), apiSecretConfigured: Boolean(provider.apiSecret),
  };
}

async function getProvider(name: string) {
  const [existing] = await db.select().from(providerPluginsTable)
    .where(eq(providerPluginsTable.name, name)).limit(1);
  if (existing) return existing;
  const metadata = PROVIDER_CATALOG.find((provider) => provider.name === name);
  if (!metadata) return null;
  const [created] = await db.insert(providerPluginsTable).values({
    id: randomUUID(), ...metadata,
  }).returning();
  return created;
}

router.get("/providers", async (_req, res) => {
  const providers = await Promise.all(PROVIDER_CATALOG.map((provider) => getProvider(provider.name)));
  return res.json(providers.filter(Boolean).map((provider) => safeProvider(provider!)));
});

router.put("/providers/:name", async (req, res) => {
  const provider = await getProvider(req.params.name as string);
  if (!provider) return res.status(404).json({ error: "Provider not found" });
  const raw = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ["apiKey", "apiSecret", "storeId", "enabled"]) {
    if (!(key in raw)) continue;
    const value = raw[key];
    if ((key === "apiKey" || key === "apiSecret") && typeof value === "string") {
      if (value === "●●●●●●●●") continue;
      updates[key] = value ? encryptCredential(value) : null;
    } else {
      updates[key] = value;
    }
  }
  const [updated] = await db.update(providerPluginsTable).set(updates)
    .where(eq(providerPluginsTable.id, provider.id)).returning();
  return res.json(safeProvider(updated));
});

router.post("/providers/:name/connect", async (req, res) => {
  const provider = await getProvider(req.params.name as string);
  if (!provider) return res.status(404).json({ error: "Provider not found" });
  if (!provider.apiKey) return res.status(400).json({ connected: false, error: "No API key saved — add your key first." });
  const apiKey = decryptCredential(provider.apiKey);
  const apiSecret = provider.apiSecret ? decryptCredential(provider.apiSecret) : null;

  if (provider.name === "eprolo") {
    if (!apiSecret) return res.status(400).json({ connected: false, error: "Eprolo requires both API Key and API Secret." });
    const result = await eprolo.testConnection({ apiKey, apiSecret });
    await db.update(providerPluginsTable).set({
      connected: result.ok, lastError: result.ok ? null : result.message,
      lastSyncAt: result.ok ? new Date() : provider.lastSyncAt, updatedAt: new Date(),
    }).where(eq(providerPluginsTable.id, provider.id));
    return res.json({ connected: result.ok, message: result.message });
  }

  if (provider.name === "paystack") {
    try {
      const response = await fetch("https://api.paystack.co/bank", { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) return res.json({ connected: false, error: "Invalid Paystack secret key." });
    } catch { return res.json({ connected: false, error: "Could not reach Paystack API." }); }
  } else if (provider.name === "flutterwave") {
    try {
      const response = await fetch("https://api.flutterwave.com/v3/banks/NG", { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) return res.json({ connected: false, error: "Invalid Flutterwave secret key." });
    } catch { return res.json({ connected: false, error: "Could not reach Flutterwave API." }); }
  } else {
    return res.status(501).json({ connected: false, error: "Stripe connection testing is not configured." });
  }

  const [updated] = await db.update(providerPluginsTable).set({
    connected: true, lastError: null, lastSyncAt: new Date(), updatedAt: new Date(),
  }).where(eq(providerPluginsTable.id, provider.id)).returning();
  return res.json({ connected: true, provider: safeProvider(updated) });
});

router.post("/providers/:name/disconnect", async (req, res) => {
  const name = req.params.name as string;

  if (name === "google") {
    // If google disconnect is requested, we will delete the app_settings config keys
    // This removes the Google credentials globally as requested
    await db.delete(appSettingsTable)
      .where(inArray(appSettingsTable.key, ["google_client_id", "google_client_secret"]));
    // Note: The frontend checks the process.env as fallback. If they set it in ENV, they must unset it there.
    // For now we just return ok.
    return res.json({ ok: true });
  }

  const provider = await getProvider(name);
  if (provider) await db.update(providerPluginsTable)
    .set({ connected: false, updatedAt: new Date() }).where(eq(providerPluginsTable.id, provider.id));
  return res.json({ ok: true });
});

export default router;