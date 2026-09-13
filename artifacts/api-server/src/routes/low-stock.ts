import { Router } from "express";
import { db, productsTable, productVariantsTable, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAdmin";
import { eventBus } from "../lib/eventBus";
import { sendEmail, buildLowStockAlertEmail, getConfiguredSender, getStoreUrl } from "../services/mailer";
import { sendWhatsAppNotification, buildWhatsAppLowStockAlertMessage } from "../services/whatsappService";

const router = Router();
router.use("/admin/low-stock", requireAdmin);

const THRESHOLD_KEY = "low_stock_threshold";
const LAST_CHECKED_KEY = "low_stock_last_checked_at";

async function readSettings() {
  const rows = await db.select().from(appSettingsTable)
    .where(eq(appSettingsTable.key, THRESHOLD_KEY));
  const checkedRows = await db.select().from(appSettingsTable)
    .where(eq(appSettingsTable.key, LAST_CHECKED_KEY));
  const parsed = Number(rows[0]?.value);
  return {
    threshold: Number.isFinite(parsed) && parsed >= 0 ? parsed : 5,
    lastCheckedAt: checkedRows[0]?.value ?? null,
  };
}

async function writeSetting(key: string, value: string) {
  await db.insert(appSettingsTable).values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function fetchLowStockProducts(limit: number) {
  const products = await db.select().from(productsTable).where(eq(productsTable.status, "ACTIVE"));
  const allVariants = await db.select().from(productVariantsTable);

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
          .where(eq(productsTable.id, p.id))
          .catch(() => {});
      }
    }

    if (effectiveStock <= limit) {
      result.push({ id: p.id, name: p.name, stock: effectiveStock });
    }
  }

  return result;
}

export async function checkAndEmitLowStock() {
  const { threshold } = await readSettings();
  const products = await fetchLowStockProducts(threshold);
  const checkedAt = new Date().toISOString();
  await writeSetting(LAST_CHECKED_KEY, checkedAt);

  // Always publish low_stock payload (even if products is empty or reduced) so clients auto-clear restocked products
  eventBus.publish({
    type: "low_stock",
    payload: { products, threshold, checkedAt },
  });

  if (products.length === 0) return;

  // Dispatch low stock email & WhatsApp alert
  try {
    const adminEmail = await getConfiguredSender();
    const adminUrl = await getStoreUrl();
    const emailData = buildLowStockAlertEmail({ products, threshold, adminUrl });
    await sendEmail({ to: adminEmail, ...emailData });

    const itemList = products.map((p) => `• ${p.name}: *${p.stock} units left*`).join("\n");
    const waText = buildWhatsAppLowStockAlertMessage({
      itemCount: products.length,
      threshold,
      itemList,
      adminUrl: `${adminUrl}/admin/products`,
    });
    sendWhatsAppNotification(adminEmail, waText).catch(() => {});
  } catch (err) {
    console.error("[Low Stock Alert Email Failed]:", err);
  }
}

// Run check every 5 minutes
setInterval(() => { checkAndEmitLowStock().catch(() => {}); }, 5 * 60 * 1000);

// Initial check after 30s so the server is fully ready
setTimeout(() => { checkAndEmitLowStock().catch(() => {}); }, 30_000);

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/admin/low-stock", async (_req, res) => {
  const settings = await readSettings();
  const products = await fetchLowStockProducts(settings.threshold);
  return res.json({ products, threshold: settings.threshold, checkedAt: settings.lastCheckedAt });
});

router.post("/admin/low-stock/check", async (_req, res) => {
  const { threshold } = await readSettings();
  const products = await fetchLowStockProducts(threshold);
  const checkedAt = new Date().toISOString();
  await writeSetting(LAST_CHECKED_KEY, checkedAt);
  eventBus.publish({ type: "low_stock", payload: { products, threshold, checkedAt } });
  return res.json({ products, threshold, checkedAt });
});

router.get("/admin/low-stock/settings", async (_req, res) => {
  const { threshold } = await readSettings();
  return res.json({ threshold });
});

router.put("/admin/low-stock/settings", async (req, res) => {
  const { threshold: t } = req.body as { threshold: number };
  if (typeof t !== "number" || t < 0 || t > 10000) {
    return res.status(400).json({ error: "threshold must be a number between 0 and 10000" });
  }
  const threshold = Math.floor(t);
  await writeSetting(THRESHOLD_KEY, String(threshold));
  checkAndEmitLowStock().catch(() => {});
  return res.json({ threshold });
});

export default router;
