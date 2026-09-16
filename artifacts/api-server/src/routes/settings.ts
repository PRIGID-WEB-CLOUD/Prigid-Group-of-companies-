import { Router, type Response } from "express";
import { createHash, randomBytes, randomUUID } from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireAdmin, getSessionUser } from "../middleware/requireAdmin";
import { eprolo } from "../services/eprolo";
import { sendEmail, loadBrandingCache } from "../services/mailer";
import { db, apiKeysTable, appSettingsTable, providerPluginsTable, storesTable } from "@workspace/db";
import { encryptCredential, decryptCredential, isEncryptedCredential } from "../services/credentialVault";
import { testCloudinaryConnection } from "../services/cloudinary";
import { type TenantRequest } from "../middleware/tenantContext";

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

async function readSettings(storeId: string) {
  const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.storeId, storeId));
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

router.get("/settings", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const settings = await readSettings(storeId);
  return res.json({ settings: safeSettings(settings), status: configured(settings) });
});

router.get("/settings/tenant-domain", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  try {
    const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
    if (!store) return res.status(404).json({ error: "Store not found." });
    return res.json({ slug: store.slug, customDomain: store.customDomain || "", isPublished: store.isPublished ?? false });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to fetch domain details." });
  }
});

router.put("/settings/tenant-domain", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const { slug, customDomain, isPublished } = req.body as { slug?: string; customDomain?: string; isPublished?: boolean };
  
  if (slug !== undefined && !slug.trim()) {
    return res.status(400).json({ error: "Subdomain slug cannot be empty." });
  }

  try {
    const updatePayload: Record<string, any> = {};
    if (slug !== undefined) {
      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
      // Verify uniqueness of slug if changing
      const [existingSlug] = await db.select().from(storesTable).where(and(eq(storesTable.slug, cleanSlug), eq(storesTable.id, storeId)));
      if (!existingSlug) {
        const [duplicateSlug] = await db.select().from(storesTable).where(eq(storesTable.slug, cleanSlug)).limit(1);
        if (duplicateSlug) {
          return res.status(400).json({ error: "This subdomain is already taken by another store." });
        }
      }
      updatePayload.slug = cleanSlug;
    }

    if (customDomain !== undefined) {
      const cleanDomain = customDomain.trim().toLowerCase() || null;
      if (cleanDomain) {
        const [existingDomain] = await db.select().from(storesTable).where(and(eq(storesTable.customDomain, cleanDomain), eq(storesTable.id, storeId)));
        if (!existingDomain) {
          const [duplicateDomain] = await db.select().from(storesTable).where(eq(storesTable.customDomain, cleanDomain)).limit(1);
          if (duplicateDomain) {
            return res.status(400).json({ error: "This custom domain is already registered to another store." });
          }
        }
      }
      updatePayload.customDomain = cleanDomain;
    }

    if (isPublished !== undefined) {
      if (isPublished) {
        const [currentStore] = await db.select().from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
        if (currentStore && (currentStore.status === "suspended" || currentStore.publishStatus === "SUSPENDED")) {
          return res.status(403).json({ error: "This store has been suspended by SaaS administration and cannot be published." });
        }
        updatePayload.publishStatus = "PUBLISHED";
        updatePayload.isPublished = true;
      } else {
        updatePayload.publishStatus = "UNPUBLISHED";
        updatePayload.isPublished = false;
      }
    }

    await db.update(storesTable).set(updatePayload).where(eq(storesTable.id, storeId));
    return res.json({ ok: true, slug: updatePayload.slug, customDomain: updatePayload.customDomain, isPublished: updatePayload.isPublished });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to save domain details." });
  }
});

router.get("/admin/stores", async (req: TenantRequest, res: Response) => {
  try {
    const user = await getSessionUser(req).catch(() => null);
    if (!user || user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Platform administration access required." });
    }

    const stores = await db.select().from(storesTable);
    return res.json(stores);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to list platform stores." });
  }
});

router.post("/admin/stores/:id/suspend", async (req: TenantRequest, res: Response) => {
  const { id } = req.params;
  try {
    const user = await getSessionUser(req).catch(() => null);
    if (!user || user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Platform administration access required." });
    }

    await db.update(storesTable).set({
      status: "suspended",
      publishStatus: "SUSPENDED",
      isPublished: false,
    }).where(eq(storesTable.id, id as string));

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to suspend store." });
  }
});

router.post("/admin/stores/:id/unsuspend", async (req: TenantRequest, res: Response) => {
  const { id } = req.params;
  try {
    const user = await getSessionUser(req).catch(() => null);
    if (!user || user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Platform administration access required." });
    }

    await db.update(storesTable).set({
      status: "active",
      publishStatus: "UNPUBLISHED",
      isPublished: false,
    }).where(eq(storesTable.id, id as string));

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to unsuspend store." });
  }
});

router.get("/settings/google-config", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const rows = await db.select().from(appSettingsTable).where(and(eq(appSettingsTable.storeId, storeId), inArray(appSettingsTable.key, ["google_client_id", "google_client_secret"])));
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  
  return res.json({
    clientId: process.env.GOOGLE_CLIENT_ID || settings.google_client_id || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || (settings.google_client_secret ? decryptCredential(settings.google_client_secret) : ""),
  });
});

router.put("/settings", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  for (const [key, value] of Object.entries(req.body as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    if (SECRET_SETTINGS.has(key) && value === "●●●●●●●●") continue;
    const storedValue = SECRET_SETTINGS.has(key) && value
      ? (isEncryptedCredential(value) ? value : encryptCredential(value))
      : value;
    await db.insert(appSettingsTable).values({ id: randomUUID(), storeId, key, value: storedValue, updatedAt: new Date() })
      .onConflictDoUpdate({ target: [appSettingsTable.storeId, appSettingsTable.key], set: { value: storedValue, updatedAt: new Date() } });
  }
  const settings = await readSettings(storeId);
  await loadBrandingCache(storeId).catch((err) => console.error("Failed to refresh branding cache:", err));
  return res.json({ settings: safeSettings(settings), status: configured(settings) });
});

router.post("/settings/test/email", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const settings = await readSettings(storeId);
  const sentTo = settings.store_email || (req as any).user?.email;
  if (!sentTo) {
    return res.status(400).json({ error: "Store email address is not configured. Please save a Store Email in settings first." });
  }
  try {
    await sendEmail({
      to: sentTo,
      subject: "Luxe Boutique Notification Test",
      text: "Your Luxe Boutique notification settings are operational.",
      html: "<p>Your Luxe Boutique notification settings are operational.</p>",
      storeId,
    });
    return res.json({ ok: true, sentTo });
  } catch (error) {
    console.error("[Settings] Notification test failed:", error instanceof Error ? error.message : error);
    return res.status(500).json({ error: "Failed to dispatch test notification." });
  }
});

router.post("/settings/test/cloudinary", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  try {
    const result = await testCloudinaryConnection(storeId);
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

router.get("/apikeys", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const keys = await db.select().from(apiKeysTable).where(eq(apiKeysTable.storeId, storeId)).orderBy(desc(apiKeysTable.createdAt));
  return res.json(keys.map(safeKey));
});

router.post("/apikeys", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const { name } = req.body as { name?: string };
  if (!name) return res.status(400).json({ error: "name is required." });
  const { rawKey, keyPrefix } = makeKey();
  const [key] = await db.insert(apiKeysTable).values({
    id: randomUUID(), storeId, name, keyHash: createHash("sha256").update(rawKey).digest("hex"), keyPrefix,
  }).returning();
  return res.status(201).json({ ...safeKey(key), rawKey });
});

router.delete("/apikeys/:id", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const [key] = await db.update(apiKeysTable)
    .set({ revokedAt: new Date() }).where(and(eq(apiKeysTable.id, req.params.id as string), eq(apiKeysTable.storeId, storeId))).returning();
  if (!key) return res.status(404).json({ error: "API key not found." });
  return res.json({ ok: true });
});

router.delete("/apikeys/:id/permanent", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  await db.delete(apiKeysTable).where(and(eq(apiKeysTable.id, req.params.id as string), eq(apiKeysTable.storeId, storeId)));
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

async function getProvider(name: string, storeId: string) {
  const [existing] = await db.select().from(providerPluginsTable)
    .where(and(eq(providerPluginsTable.name, name), eq(providerPluginsTable.storeId, storeId))).limit(1);
  if (existing) return existing;
  const metadata = PROVIDER_CATALOG.find((provider) => provider.name === name);
  if (!metadata) return null;
  const [created] = await db.insert(providerPluginsTable).values({
    id: randomUUID(), storeId, ...metadata,
  }).returning();
  return created;
}

router.get("/providers", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const providers = await Promise.all(PROVIDER_CATALOG.map((provider) => getProvider(provider.name, storeId)));
  return res.json(providers.filter(Boolean).map((provider) => safeProvider(provider!)));
});

router.put("/providers/:name", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const provider = await getProvider(req.params.name as string, storeId);
  if (!provider) return res.status(404).json({ error: "Provider not found" });
  const raw = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ["apiKey", "apiSecret", "enabled"]) {
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
    .where(and(eq(providerPluginsTable.id, provider.id), eq(providerPluginsTable.storeId, storeId))).returning();
  return res.json(safeProvider(updated));
});

router.post("/providers/:name/connect", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const provider = await getProvider(req.params.name as string, storeId);
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
    }).where(and(eq(providerPluginsTable.id, provider.id), eq(providerPluginsTable.storeId, storeId)));
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
  }).where(and(eq(providerPluginsTable.id, provider.id), eq(providerPluginsTable.storeId, storeId))).returning();
  return res.json({ connected: true, provider: safeProvider(updated) });
});

router.post("/providers/:name/disconnect", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const name = req.params.name as string;

  if (name === "google") {
    await db.delete(appSettingsTable)
      .where(and(eq(appSettingsTable.storeId, storeId), inArray(appSettingsTable.key, ["google_client_id", "google_client_secret"])));
    return res.json({ ok: true });
  }

  const provider = await getProvider(name, storeId);
  if (provider) await db.update(providerPluginsTable)
    .set({ connected: false, updatedAt: new Date() }).where(and(eq(providerPluginsTable.id, provider.id), eq(providerPluginsTable.storeId, storeId)));
  return res.json({ ok: true });
});

export default router;
