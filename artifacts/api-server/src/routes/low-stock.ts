import { Router } from "express";
import { db, productsTable, productVariantsTable, appSettingsTable, storesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAdmin";
import { eventBus } from "../lib/eventBus";
import { sendEmail, buildLowStockAlertEmail, getConfiguredSender, getStoreUrl } from "../services/mailer";
import { sendWhatsAppNotification, buildWhatsAppLowStockAlertMessage } from "../services/whatsappService";
import { type TenantRequest } from "../middleware/tenantContext";

const router = Router();
router.use("/admin/low-stock", requireAdmin);

const THRESHOLD_KEY = "low_stock_threshold";
const LAST_CHECKED_KEY = "low_stock_last_checked_at";

async function readSettings(storeId: string) {
  const rows = await db.select().from(appSettingsTable)
    .where(and(eq(appSettingsTable.key, THRESHOLD_KEY), eq(appSettingsTable.storeId, storeId)));
  const checkedRows = await db.select().from(appSettingsTable)
    .where(and(eq(appSettingsTable.key, LAST_CHECKED_KEY), eq(appSettingsTable.storeId, storeId)));
  const parsed = Number(rows[0]?.value);
  return {
    threshold: Number.isFinite(parsed) && parsed >= 0 ? parsed : 5,
    lastCheckedAt: checkedRows[0]?.value ?? null,
  };
}

async function writeSetting(key: string, value: string, storeId: string) {
  await db.insert(appSettingsTable).values({ key, value, storeId, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [appSettingsTable.key, appSettingsTable.storeId], set: { value, updatedAt: new Date() } });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function fetchLowStockProducts(limit: number, storeId: string) {
  const products = await db.select().from(productsTable).where(and(eq(productsTable.status, "ACTIVE"), eq(productsTable.storeId, storeId)));
  const allVariants = await db.select().from(productVariantsTable).where(eq(productVariantsTable.storeId, storeId));

  const variantStockMap = new Map<string, number>();
  const productHasVariants = new Set<string>();

  for (const v of allVariants) {
    productHasVariants.add(v.productId);
    const prev = variantStockMap.get(v.productId) || 0;
    variantStockMap.set(v.productId, prev + (v.stock ?? 0));
  }

  const result: Array<{ id: string; name: string; stock: number }> = [];

  for (const p of products) {
    if (!p.trackQuantity) continue;

    let effectiveStock = p.stock ?? 0;
    if (productHasVariants.has(p.id)) {
      effectiveStock = variantStockMap.get(p.id) ?? 0;
      if (p.stock !== effectiveStock) {
        db.update(productsTable)
          .set({ stock: effectiveStock })
          .where(and(eq(productsTable.id, p.id), eq(productsTable.storeId, storeId)))
          .catch(() => {});
      }
    }

    if (effectiveStock <= limit) {
      result.push({ id: p.id, name: p.name, stock: effectiveStock });
    }
  }

  return result;
}

export async function checkAndEmitLowStock(storeId: string) {
  const { threshold } = await readSettings(storeId);
  const products = await fetchLowStockProducts(threshold, storeId);
  const checkedAt = new Date().toISOString();
  await writeSetting(LAST_CHECKED_KEY, checkedAt, storeId);

  // Always publish low_stock payload (even if products is empty or reduced) so clients auto-clear restocked products
  eventBus.publish({
    type: "low_stock",
    storeId,
    payload: { products, threshold, checkedAt },
  });

  if (products.length === 0) return;

  // Dispatch low stock email & WhatsApp alert
  try {
    const adminEmail = await getConfiguredSender(storeId);
    const adminUrl = await getStoreUrl(storeId);
    const emailData = buildLowStockAlertEmail({ products, threshold, adminUrl });
    await sendEmail({ to: adminEmail, ...emailData, storeId });

    const itemList = products.map((p) => `• ${p.name}: *${p.stock} units left*`).join("\n");
    const waText = buildWhatsAppLowStockAlertMessage({
      itemCount: products.length,
      threshold,
      itemList,
      adminUrl: `${adminUrl}/seller/products`,
    });
    sendWhatsAppNotification(adminEmail, waText, storeId).catch(() => {});
  } catch (err) {
    console.error(`[Low Stock Alert Email Failed for store ${storeId}]:`, err);
  }
}

async function checkAllStores() {
  const stores = await db.select().from(storesTable);
  for (const store of stores) {
    await checkAndEmitLowStock(store.id).catch(() => {});
  }
}

// Run check every 5 minutes
setInterval(() => { checkAllStores().catch(() => {}); }, 5 * 60 * 1000);

// Initial check after 30s so the server is fully ready
setTimeout(() => { checkAllStores().catch(() => {}); }, 30_000);

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/admin/low-stock", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const settings = await readSettings(storeId);
  const products = await fetchLowStockProducts(settings.threshold, storeId);
  return res.json({ products, threshold: settings.threshold, checkedAt: settings.lastCheckedAt });
});

router.post("/admin/low-stock/check", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const { threshold } = await readSettings(storeId);
  const products = await fetchLowStockProducts(threshold, storeId);
  const checkedAt = new Date().toISOString();
  await writeSetting(LAST_CHECKED_KEY, checkedAt, storeId);
  eventBus.publish({ type: "low_stock", storeId, payload: { products, threshold, checkedAt } });
  return res.json({ products, threshold, checkedAt });
});

router.get("/admin/low-stock/settings", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const { threshold } = await readSettings(storeId);
  return res.json({ threshold });
});

router.put("/admin/low-stock/settings", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const { threshold: t } = req.body as { threshold: number };
  if (typeof t !== "number" || t < 0 || t > 10000) {
    return res.status(400).json({ error: "threshold must be a number between 0 and 10000" });
  }
  const threshold = Math.floor(t);
  await writeSetting(THRESHOLD_KEY, String(threshold), storeId);
  checkAndEmitLowStock(storeId).catch(() => {});
  return res.json({ threshold });
});

export default router;
