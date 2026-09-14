import { Router, type Response } from "express";
import { randomUUID } from "crypto";
import { requireAdmin } from "../middleware/requireAdmin";
import { eprolo, type EproloConfig } from "../services/eprolo";
import { db, productsTable, categoriesTable, providerPluginsTable, ordersTable } from "@workspace/db";
import { eq, like, and } from "drizzle-orm";
import { decryptCredential } from "../services/credentialVault";
import { eventBus } from "../lib/eventBus";
import { sendEmail, buildOrderStatusUpdateEmail, getStoreUrl } from "../services/mailer";
import { sendWhatsAppNotification, buildWhatsAppOrderStatusUpdateMessage } from "../services/whatsappService";
import { type TenantRequest } from "../middleware/tenantContext";

const router = Router();

export async function getEproloConfig(storeId: string): Promise<EproloConfig | null> {
  const [provider] = await db.select().from(providerPluginsTable)
    .where(and(eq(providerPluginsTable.name, "eprolo"), eq(providerPluginsTable.storeId, storeId))).limit(1);
  if (!provider?.apiKey || !provider.apiSecret) return null;
  return { apiKey: decryptCredential(provider.apiKey), apiSecret: decryptCredential(provider.apiSecret) };
}

async function requireConfig(res: Response, storeId: string): Promise<EproloConfig | null> {
  const config = await getEproloConfig(storeId);
  if (!config) {
    res.status(400).json({ error: "Eprolo credentials not configured. Go to Providers → Configure Eprolo and save your API Key + Secret first." });
    return null;
  }
  return config;
}

// ── Browse Eprolo catalog ────────────────────────────────────────────────────
router.get("/eprolo/products", requireAdmin, async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const config = await requireConfig(res, storeId);
  if (!config) return;
  const { page_size = "20", page_num = "1", typeid } = req.query as Record<string, string>;
  try {
    const products = await eprolo.getProducts(config, { page_size: Number(page_size), page_num: Number(page_num), typeid });
    return res.json({ products, page: Number(page_num), pageSize: Number(page_size) });
  } catch (err: unknown) {
    return res.status(502).json({ error: err instanceof Error ? err.message : "Eprolo request failed" });
  }
});

// ── Get product detail ────────────────────────────────────────────────────────
router.get("/eprolo/products/:id", requireAdmin, async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const config = await requireConfig(res, storeId);
  if (!config) return;
  const id = req.params.id as string;
  const { product_id = id } = req.query as { product_id?: string };
  try {
    const detail = await eprolo.getProductDetail(config, id, product_id);
    return res.json(detail);
  } catch (err: unknown) {
    return res.status(502).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

// ── Sync inventory stock levels ───────────────────────────────────────────────
router.post("/eprolo/sync", requireAdmin, async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const config = await requireConfig(res, storeId);
  if (!config) return;
  try {
    const inventory = await eprolo.syncInventory(config);
    let updated = 0;
    for (const item of inventory) {
      const stockValue = item.num !== undefined ? Number(item.num) : (item.stock !== undefined ? Number(item.stock) : 0);
      const eproloId   = item.productid || item.id;
      if (!eproloId) continue;
      const result = await db.update(productsTable)
        .set({ stock: stockValue })
        .where(and(eq(productsTable.id, eproloId), eq(productsTable.storeId, storeId)));
      if ((result.rowCount ?? 0) > 0) updated++;
    }
    return res.json({ ok: true, synced: inventory.length, updated, message: `Synced ${inventory.length} items, updated ${updated} store products.` });
  } catch (err: unknown) {
    return res.status(502).json({ error: err instanceof Error ? err.message : "Sync failed" });
  }
});

// ── Import a product from Eprolo into the store catalog ──────────────────────
router.post("/eprolo/import", requireAdmin, async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const config = await requireConfig(res, storeId);
  if (!config) return;
  const { product } = req.body as { product?: Record<string, unknown> };
  if (!product) return res.status(400).json({ error: "product is required" });

  try {
    // Ensure category exists
    const rawCat = String(product.product_type || product.vendor || "Dropship");
    const catName = rawCat.split(">").pop()?.trim() || rawCat;
    const catSlug = catName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    let category = (await db.select().from(categoriesTable).where(and(eq(categoriesTable.slug, catSlug), eq(categoriesTable.storeId, storeId))).limit(1))[0];
    if (!category) {
      const [c] = await db.insert(categoriesTable).values({ id: randomUUID(), storeId, name: catName, slug: catSlug, description: `Imported from Eprolo` }).returning();
      category = c;
    }

    // Map Eprolo product to store schema
    const images: string[] = ((product.imagelist as { src: string }[] | undefined) ?? []).map((i) => i.src);
    const primaryImage = images[0] ?? null;
    const price = Math.round(Number(product.cost || product.price || 0));

    const [newProduct] = await db.insert(productsTable).values({
      id:          randomUUID(),
      storeId,
      name:        String(product.title || product.name || "Eprolo Product"),
      description: String(product.body_html || product.description || "High quality dropship product."),
      price,
      imageUrl:    primaryImage,
      categoryId:  category.id,
      status:      "DRAFT",
      trackQuantity: true,
      stock:       100,
      tags:        "eprolo,dropship",
      eproloProductId: String(product.productid || product.id || ""),
    }).returning();

    return res.status(201).json({ ok: true, product: newProduct, message: `"${newProduct.name}" added to staging for review before publishing.` });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Import failed" });
  }
});

// ── Check if Eprolo is configured (public — used to conditionally show UI) ────
router.get("/eprolo/configured", requireAdmin, (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  return getEproloConfig(storeId).then((cfg) => res.json({ configured: !!cfg }));
});

// ── Staged (DRAFT) Eprolo products awaiting review ───────────────────────────
router.get("/eprolo/staged", requireAdmin, async (req: TenantRequest, res: Response) => {
  try {
    const storeId = req.storeId!;
    const rows = await db.select().from(productsTable)
      .where(and(eq(productsTable.status, "DRAFT"), like(productsTable.tags, "%eprolo%"), eq(productsTable.storeId, storeId)));
    return res.json(rows);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

// ── Publish a staged product (DRAFT → ACTIVE) ─────────────────────────────────
router.post("/eprolo/staged/:id/publish", requireAdmin, async (req: TenantRequest, res: Response) => {
  try {
    const storeId = req.storeId!;
    const id = req.params.id as string;
    const rows = await db.update(productsTable)
      .set({ status: "ACTIVE" })
      .where(and(eq(productsTable.id, id), like(productsTable.tags, "%eprolo%"), eq(productsTable.storeId, storeId)))
      .returning();
    if (!rows[0]) return res.status(404).json({ error: "Staged product not found" });
    return res.json({ ok: true, product: rows[0] });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Publish failed" });
  }
});

// ── Reject (delete) a staged product ─────────────────────────────────────────
router.delete("/eprolo/staged/:id", requireAdmin, async (req: TenantRequest, res: Response) => {
  try {
    const storeId = req.storeId!;
    const id = req.params.id as string;
    await db.delete(productsTable)
      .where(and(eq(productsTable.id, id), like(productsTable.tags, "%eprolo%"), eq(productsTable.storeId, storeId)));
    res.json({ ok: true });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Reject failed" });
  }
});

// ── Eprolo webhook receiver (tracking updates) ────────────────────────────────
// NOTE: Eprolo webhooks don't send a store identifier.
// This is a limitation. We might need a lookup table (eproloOrderId -> storeId)
// or iterate through stores if order ID is unique across system.
// For now, we'll try to find the order by ID across all stores.
router.post("/webhooks/eprolo", async (req, res) => {
  const rawBody  = JSON.stringify(req.body);
  const md5sign  = req.headers["md5sign"] as string | undefined;

  // We can't easily verify signature without storeId here because secrets are per-store.
  // One way is to find the order first to get the storeId.

  const shipments = Array.isArray(req.body) ? req.body : [req.body];
  for (const s of shipments) {
    if (s.order_id) {
      try {
        // Find order across all stores to identify the tenant
        const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, s.order_id)).limit(1);
        if (!order) continue;

        const storeId = order.storeId;
        const config = await getEproloConfig(storeId);
        const signKey = config?.apiSecret;

        if (!signKey || !md5sign || !eprolo.verifyWebhook(rawBody, signKey, md5sign)) {
          console.warn(`[Eprolo webhook] Signature verification failed for store ${storeId} or missing config`);
          continue;
        }

        console.log(`[Eprolo webhook] Order ${s.order_id} shipped via ${s.tracking_company} — ${s.tracking_url}`);
        
        const rows = await db.update(ordersTable)
          .set({ status: "SHIPPED" })
          .where(and(eq(ordersTable.id, s.order_id), eq(ordersTable.storeId, storeId)))
          .returning();
        
        if (rows[0]) {
          const updatedOrder = rows[0];
          eventBus.publish({ type: "order_updated", storeId, payload: { id: updatedOrder.id, storeId, status: "SHIPPED" } });

          getStoreUrl(storeId).then((storeUrl) => {
            const emailData = buildOrderStatusUpdateEmail({
              orderId: updatedOrder.id,
              customerName: updatedOrder.customerName,
              status: "SHIPPED",
              storeUrl,
            });
            sendEmail({ to: updatedOrder.customerEmail, ...emailData, storeId }).catch(() => {});

            const waText = buildWhatsAppOrderStatusUpdateMessage({
              orderId: updatedOrder.id,
              recipientName: updatedOrder.customerName,
              status: "SHIPPED",
              orderUrl: `${storeUrl}/account/orders`,
            });
            sendWhatsAppNotification(updatedOrder.customerEmail, waText, storeId).catch(() => {});
          }).catch(() => {});
        }
      } catch (err) {
        console.error(`[Eprolo webhook error] Failed to update order ${s.order_id}:`, err);
      }
    }
  }

  return res.json({ code: 0, msg: "success" });
});

export default router;
