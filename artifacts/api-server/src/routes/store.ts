import { Router, type Request, type Response } from "express";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import {
  db, productsTable, categoriesTable, ordersTable, productVariantsTable,
  mediaItemsTable, blogPostsTable, couponsTable, usersTable, teamMembersTable,
  paymentTransactionsTable, orderItemsTable, appSettingsTable, providerPluginsTable,
  messagesTable, showroomLocationsTable,
  type AddressSnapshot, type OrderItem,
} from "@workspace/db";
import { and, eq, ne, desc, sql, like, gte, gt, isNull, lt, or, inArray } from "drizzle-orm";
import { eprolo } from "../services/eprolo";
import { getEproloConfig } from "./eprolo";
import { getSessionUser, requireAdmin } from "../middleware/requireAdmin";
import { validate } from "../middleware/validate";
import { z } from "zod";
import { eventBus } from "../lib/eventBus";
import { decryptCredential } from "../services/credentialVault";
import { cartPricing } from "./ecommerce";
import { sendEmail, buildOrderConfirmationEmail, buildOrderStatusUpdateEmail, getStoreUrl } from "../services/mailer";
import { checkAndEmitLowStock } from "./low-stock";
import {
  sendWhatsAppNotification,
  buildWhatsAppOrderConfirmationMessage,
  buildWhatsAppOrderStatusUpdateMessage,
} from "../services/whatsappService";

const router = Router();
const CART_COOKIE = "luxe_cart";

router.get("/store/branding", async (_req, res) => {
  try {
    const keys = [
      "store_name", "store_email", "store_currency", "store_timezone",
      "brand_primary_color", "brand_bg_color", "brand_logo_url",
      "brand_typography", "brand_valet_instructions", "brand_hospitality_notes"
    ];
    const rows = await db.select().from(appSettingsTable).where(inArray(appSettingsTable.key, keys));
    const branding = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return res.json({
      store_name: branding.store_name || "LUXE Boutique",
      store_email: branding.store_email || "",
      store_currency: branding.store_currency || "USD",
      store_timezone: branding.store_timezone || "UTC",
      brand_primary_color: branding.brand_primary_color || "#006c49",
      brand_bg_color: branding.brand_bg_color || "#0f172a",
      brand_logo_url: branding.brand_logo_url || "",
      brand_typography: branding.brand_typography || "Georgia, serif",
      brand_valet_instructions: branding.brand_valet_instructions || "Complimentary valet parking is available at the main entrance.",
      brand_hospitality_notes: branding.brand_hospitality_notes || "Enjoy our signature champagne service upon your arrival.",
    });
  } catch (error) {
    console.error("[Branding Error]", error);
    return res.status(500).json({ error: "Failed to fetch store branding." });
  }
});

async function checkoutSessionId(req: Request, res: Response) {
  const user = await getSessionUser(req);
  if (user) return `user:${user.id}`;
  const existing = req.cookies?.[CART_COOKIE] as string | undefined;
  if (existing && /^[A-Za-z0-9_-]{40,}$/.test(existing)) return `anon:${existing}`;
  const token = randomBytes(32).toString("base64url");
  res.cookie(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 180 * 24 * 60 * 60 * 1000,
  });
  return `anon:${token}`;
}

// ── Products ──────────────────────────────────────────────────────────────────

async function enrichProduct(p: typeof productsTable.$inferSelect) {
  const cat = p.categoryId
    ? (await db.select().from(categoriesTable).where(eq(categoriesTable.id, p.categoryId)).limit(1))[0]
    : null;
  const variants = await db.select().from(productVariantsTable)
    .where(eq(productVariantsTable.productId, p.id));
  return {
    ...p,
    category: cat ? { id: cat.id, name: cat.name } : null,
    variants,
  };
}

const productSchema = z.object({
  name: z.preprocess(
    (val) => (typeof val === "string" ? val.trim() : String(val ?? "")),
    z.string().min(1, "Product name is required")
  ),
  price: z.preprocess((val) => {
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }, z.number().min(0, "Price must be a valid non-negative number")),
  categoryId: z.preprocess(
    (val) => (val === "" || val === "null" || val === undefined ? null : String(val)),
    z.string().nullable().optional()
  ),
  stock: z.preprocess((val) => {
    if (typeof val === "number") return Math.round(val);
    if (typeof val === "string") {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }, z.number().int().min(0, "Stock must be a non-negative integer")),
  trackQuantity: z.preprocess(
    (val) => (typeof val === "boolean" ? val : Boolean(val)),
    z.boolean().optional().default(true)
  ),
  status: z.preprocess((val) => {
    if (typeof val === "string") {
      const upper = val.toUpperCase();
      if (["ACTIVE", "DRAFT", "ARCHIVED"].includes(upper)) return upper;
    }
    return "ACTIVE";
  }, z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional().default("ACTIVE")),
  imageUrl: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : String(val)),
    z.string().nullable().optional()
  ),
  description: z.preprocess(
    (val) => (val == null ? "" : String(val)),
    z.string().optional().default("")
  ),
  tags: z.preprocess((val) => {
    if (Array.isArray(val)) return JSON.stringify(val);
    if (typeof val === "string") return val;
    return null;
  }, z.string().nullable().optional()),
  metaSyncEnabled: z.preprocess(
    (val) => (typeof val === "boolean" ? val : Boolean(val)),
    z.boolean().optional().default(true)
  ),
  eproloProductId: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : String(val)),
    z.string().trim().max(200).nullable().optional()
  ),
  compareAtPrice: z.preprocess(
    (val) => (val === "" || val == null ? null : typeof val === "string" ? parseFloat(val) || null : typeof val === "number" ? val : null),
    z.number().nullable().optional()
  ),
  images: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
});

const variantSchema = z.object({
  size: z.string().trim().max(100).optional(),
  color: z.string().trim().max(100).optional(),
  stock: z.preprocess((val) => {
    if (typeof val === "number") return Math.round(val);
    if (typeof val === "string") return parseInt(val, 10) || 0;
    return 0;
  }, z.number().int().min(0).optional()),
  price: z.preprocess((val) => {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === "number") return val;
    if (typeof val === "string") return parseFloat(val) || 0;
    return null;
  }, z.number().min(0).nullable().optional()),
  sku: z.string().trim().max(100).optional(),
  eproloProductId: z.string().trim().max(200).nullable().optional(),
  eproloVariantId: z.string().trim().max(200).nullable().optional(),
});

router.get("/products", async (_req, res) => {
  const user = await getSessionUser(_req);
  const canManage = user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN");
  const prods = await db.select().from(productsTable)
    .where(canManage ? undefined : ne(productsTable.status, "ARCHIVED"))
    .orderBy(desc(productsTable.createdAt));
  const enriched = await Promise.all(prods.map(enrichProduct));
  res.json(enriched);
});

router.post("/products", requireAdmin, validate(productSchema), async (req, res) => {
  const body = req.body as z.infer<typeof productSchema>;
  const allowed = ["name", "price", "categoryId", "stock", "trackQuantity", "status", "imageUrl", "description", "tags", "metaSyncEnabled", "eproloProductId"];
  const insertData: Record<string, unknown> = { id: randomUUID() };
  for (const k of allowed) {
    if (k in body && (body as Record<string, unknown>)[k] !== undefined) {
      insertData[k] = (body as Record<string, unknown>)[k];
    }
  }
  const [p] = await db.insert(productsTable).values(insertData as typeof productsTable.$inferInsert).returning();
  checkAndEmitLowStock().catch(() => {});
  return res.status(201).json(await enrichProduct(p));
});

router.get("/products/:id", async (req, res) => {
  const productId = req.params.id as string;
  const user = await getSessionUser(req);
  const canManage = user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN");
  const rows = await db.select().from(productsTable).where(and(
    eq(productsTable.id, productId),
    ...(canManage ? [] : [ne(productsTable.status, "ARCHIVED")]),
  )).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Product not found" });
  return res.json(await enrichProduct(rows[0]));
});

router.put("/products/:id", requireAdmin, async (req, res) => {
  const productId = req.params.id as string;
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    const issueDetails = parsed.error.issues.map(i => `${i.path.join(".") || "field"}: ${i.message}`).join(", ");
    return res.status(400).json({ error: `Invalid product fields: ${issueDetails}`, details: parsed.error.flatten(), issues: parsed.error.issues });
  }
  const allowed = ["name", "price", "categoryId", "stock", "trackQuantity", "status", "imageUrl", "description", "tags", "metaSyncEnabled", "eproloProductId"];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in parsed.data && (parsed.data as Record<string, unknown>)[k] !== undefined) {
      updates[k] = (parsed.data as Record<string, unknown>)[k];
    }
  }
  const rows = await db.update(productsTable).set(updates).where(eq(productsTable.id, productId)).returning();
  if (!rows[0]) return res.status(404).json({ error: "Product not found" });
  checkAndEmitLowStock().catch(() => {});
  return res.json(await enrichProduct(rows[0]));
});

router.delete("/products/:id", requireAdmin, async (req, res) => {
  const productId = req.params.id as string;
  await db.delete(productsTable).where(eq(productsTable.id, productId));
  checkAndEmitLowStock().catch(() => {});
  return res.json({ ok: true });
});

// ── Manual sync (stamp updatedAt to mark as manually synced) ──────────────────
router.post("/products/:id/sync", requireAdmin, async (req, res) => {
  const productId = req.params.id as string;
  const rows = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Product not found" });
  const updates = req.body as Partial<typeof productsTable.$inferInsert>;
  const allowed = ["name", "price", "stock", "status", "imageUrl", "description", "tags"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in updates) patch[k] = (updates as Record<string, unknown>)[k];
  const [updated] = await db.update(productsTable).set(patch).where(eq(productsTable.id, productId)).returning();
  return res.json({ ok: true, product: updated, syncedAt: new Date().toISOString() });
});

// ── Product Variants ──────────────────────────────────────────────────────────

// Helper to keep parent product stock synchronized with variant totals & check low stock
async function syncVariantStockToProduct(productId: string) {
  try {
    const variants = await db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, productId));
    if (variants.length > 0) {
      const totalStock = variants.reduce((acc, v) => acc + (v.stock ?? 0), 0);
      await db.update(productsTable).set({ stock: totalStock }).where(eq(productsTable.id, productId));
    }
    await checkAndEmitLowStock();
  } catch (err) {
    console.error("Failed to sync variant stock:", err);
  }
}

router.get("/products/:id/variants", async (req, res) => {
  const productId = req.params.id as string;
  const rows = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Product not found" });
  return res.json(await db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, productId)));
});

router.post("/products/:id/variants", requireAdmin, async (req, res) => {
  const productId = req.params.id as string;
  const rows = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Product not found" });
  const parsed = variantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid variant fields.", details: parsed.error.flatten() });
  const [variant] = await db.insert(productVariantsTable).values({
    id: randomUUID(),
    productId,
    size: parsed.data.size ?? "",
    color: parsed.data.color ?? "",
    stock: parsed.data.stock ?? 0,
    price: parsed.data.price ?? null,
    sku: parsed.data.sku ?? "",
    eproloProductId: parsed.data.eproloProductId ?? null,
    eproloVariantId: parsed.data.eproloVariantId ?? null,
  }).returning();

  syncVariantStockToProduct(productId).catch(() => {});
  return res.status(201).json(variant);
});

router.put("/products/:id/variants/:variantId", requireAdmin, async (req, res) => {
  const productId = req.params.id as string;
  const variantId = req.params.variantId as string;
  const parsed = variantSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid variant fields.", details: parsed.error.flatten() });
  const updates: Record<string, unknown> = parsed.data;
  const [updated] = await db.update(productVariantsTable)
    .set(updates)
    .where(and(eq(productVariantsTable.id, variantId), eq(productVariantsTable.productId, productId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Variant not found" });

  syncVariantStockToProduct(productId).catch(() => {});
  return res.json(updated);
});

router.delete("/products/:id/variants/:variantId", requireAdmin, async (req, res) => {
  const productId = req.params.id as string;
  await db.delete(productVariantsTable).where(and(
    eq(productVariantsTable.id, req.params.variantId as string),
    eq(productVariantsTable.productId, productId),
  ));

  syncVariantStockToProduct(productId).catch(() => {});
  return res.json({ ok: true });
});

const generateMatrixSchema = z.object({
  sizes: z.array(z.string().trim().min(1)).min(1),
  colors: z.array(z.string().trim().min(1)).min(1),
  defaultPrice: z.number().int().min(0).optional().nullable(),
  defaultStock: z.number().int().min(0).optional().default(10),
});

router.post("/products/:id/generate-variants", requireAdmin, async (req, res) => {
  const productId = req.params.id as string;
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const parsed = generateMatrixSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Sizes and colors lists are required." });

  const { sizes, colors, defaultPrice, defaultStock } = parsed.data;

  // Existing variants check to avoid duplicates
  const existing = await db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, productId));
  const existingKeySet = new Set(existing.map(v => `${v.size.toLowerCase()}_${v.color.toLowerCase()}`));

  const newVariantsToInsert: Array<typeof productVariantsTable.$inferInsert> = [];

  for (const size of sizes) {
    for (const color of colors) {
      const key = `${size.toLowerCase()}_${color.toLowerCase()}`;
      if (!existingKeySet.has(key)) {
        const cleanName = product.name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 4).toUpperCase();
        const cleanSize = size.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        const cleanColor = color.replace(/[^a-zA-Z0-9]/g, "").substring(0, 3).toUpperCase();
        const sku = `${cleanName}-${cleanSize}-${cleanColor}`;

        newVariantsToInsert.push({
          id: randomUUID(),
          productId,
          size,
          color,
          price: defaultPrice ?? product.price,
          stock: defaultStock,
          sku,
        });
      }
    }
  }

  if (newVariantsToInsert.length > 0) {
    await db.insert(productVariantsTable).values(newVariantsToInsert);
  }

  syncVariantStockToProduct(productId).catch(() => {});

  const allVariants = await db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, productId));
  return res.json({
    createdCount: newVariantsToInsert.length,
    variants: allVariants,
  });
});

// ── Orders ────────────────────────────────────────────────────────────────────

router.get("/orders", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  return res.json(rows);
});

router.get("/admin/notifications/unread-count", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select({
      id: ordersTable.id,
      status: ordersTable.status,
    }).from(ordersTable);
    
    const seenIdsQuery = (req.query.seenIds as string ?? "");
    const seenIdsSet = new Set(seenIdsQuery.split(",").filter(Boolean));
    
    const actionableOrders = rows.filter((o) => {
      return o.status === "PENDING" || o.status === "PROCESSING" || o.status === "PAID";
    });

    const unreadCount = actionableOrders.filter(o => !seenIdsSet.has(o.id)).length;
    const actionableIds = actionableOrders.map(o => o.id);

    return res.json({ unreadCount, actionableIds });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch unread count from database." });
  }
});

router.get("/orders/:id", requireAdmin, async (req, res) => {
  const orderId = req.params.id as string;
  const rows = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Order not found" });
  return res.json(rows[0]);
});

// ── Payments and checkout lifecycle ──────────────────────────────────────────
type CheckoutAddress = AddressSnapshot;
type PendingCheckout = {
  customerId?: string;
  customerName: string;
  customerEmail: string;
  items: Array<{ productId: string; quantity: number; price: number; name: string }>;
  couponCode?: string;
  shippingAddress: CheckoutAddress;
  billingAddress?: CheckoutAddress;
};

const checkoutAddressSchema = z.record(z.string().trim().min(1).max(200));
const checkoutItemSchema = z.object({
  productId: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(100),
});
const checkoutSchema = z.object({
  customerName: z.string().trim().min(1).max(120).default("Guest"),
  customerEmail: z.string().trim().toLowerCase().email(),
  items: z.array(checkoutItemSchema).min(1).max(100).optional(),
  couponCode: z.string().trim().max(64).optional(),
  shippingAddress: z.union([z.string().trim().min(10).max(1000), checkoutAddressSchema]),
  billingAddress: checkoutAddressSchema.optional(),
  paystackRef: z.string().trim().max(200).optional(),
});
const paymentInitializeSchema = z.object({
  customerName: z.string().trim().min(1).max(120).default("Guest"),
  customerEmail: z.string().trim().toLowerCase().email(),
  provider: z.literal("paystack").default("paystack"),
  couponCode: z.string().trim().max(64).optional(),
  shippingAddress: z.union([z.string().trim().min(10).max(1000), checkoutAddressSchema]),
  billingAddress: checkoutAddressSchema.optional(),
  callbackUrl: z.string().url().max(1000),
});

function addressSnapshot(value: string | Record<string, string>): CheckoutAddress {
  return typeof value === "string" ? { address: value.trim() } : Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, item.trim()]).filter(([, item]) => item),
  );
}

async function paymentSetting(key: string) {
  const [row] = await db.select({ value: appSettingsTable.value })
    .from(appSettingsTable).where(eq(appSettingsTable.key, key)).limit(1);
  return row?.value ? decryptCredential(row.value) : null;
}

async function findUsableCouponForCheckout(code: string, subtotal: number) {
  const [coupon] = await db.select().from(couponsTable)
    .where(eq(couponsTable.code, code.trim().toUpperCase())).limit(1);
  if (!coupon || !coupon.active || (coupon.expiresAt && coupon.expiresAt <= new Date())) {
    return { error: "Coupon code not found or expired." } as const;
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { error: "Coupon usage limit reached." } as const;
  }
  if (subtotal < Number(coupon.minOrderAmount)) {
    return { error: `Minimum order amount is ${coupon.minOrderAmount}.` } as const;
  }
  const discount = coupon.discountType === "PERCENTAGE"
    ? Math.min(subtotal, Math.floor((subtotal * Number(coupon.discountValue)) / 100))
    : Math.min(subtotal, Number(coupon.discountValue));
  return { coupon, discount } as const;
}

async function paystackSecret() {
  const configured = await paymentSetting("paystack_secret_key");
  if (configured) return configured;
  const [provider] = await db.select().from(providerPluginsTable)
    .where(eq(providerPluginsTable.name, "paystack")).limit(1);
  return provider?.apiKey ? decryptCredential(provider.apiKey) : null;
}

async function paystackCurrency() {
  const configured = await paymentSetting("store_currency");
  return configured && ["GHS", "NGN", "USD", "ZAR", "KES"].includes(configured.toUpperCase())
    ? configured.toUpperCase()
    : "USD";
}

async function paystackRequest(path: string, init: RequestInit = {}) {
  const secret = await paystackSecret();
  if (!secret) throw Object.assign(new Error("Paystack is not configured. Add a Paystack secret key in admin settings."), { statusCode: 503 });
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({})) as { status?: boolean; message?: string; data?: Record<string, unknown> };
  if (!response.ok || body.status !== true) {
    throw Object.assign(new Error(body.message || "Paystack request failed."), { statusCode: 502 });
  }
  return body.data ?? {};
}

function validPaystackSignature(rawBody: string, received: string, secret: string) {
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(received, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function paymentReference(data: Record<string, unknown>) {
  return typeof data.reference === "string" ? data.reference : null;
}

async function tryAutoForwardToEprolo(order: typeof ordersTable.$inferSelect) {
  if (order.paymentStatus !== "PAID") return;
  const cfg = await getEproloConfig();
  if (!cfg) return;
  const address = order.shippingAddress;
  if (!address || !address.name || !address.phone || !(address.address || address.line1) || !address.city ||
      !(address.state || address.province) || !(address.postalCode || address.postCode) ||
      !address.country || !address.countryCode) {
    console.warn(`[Eprolo] Skipping order ${order.id}: complete shipping address is required.`);
    return;
  }
  const items = Array.isArray(order.items) ? order.items : [];
  const fulfillmentItems = items
    .filter((item) => item.eproloVariantId && item.qty > 0)
    .map((item) => ({ variantId: item.eproloVariantId!, quantity: item.qty }));
  if (!fulfillmentItems.length) return;

  try {
    const eproloOrderId = await eprolo.createOrder(cfg, {
      orderId: order.id,
      customer: {
        name: address.name,
        phone: address.phone,
        address: address.address || address.line1,
        city: address.city,
        province: address.state || address.province,
        provinceCode: address.stateCode || address.provinceCode || address.state || address.province,
        postCode: address.postalCode || address.postCode,
        country: address.country,
        countryCode: address.countryCode,
      },
      items: fulfillmentItems,
    });
    console.log(`[Eprolo] Auto-forwarded paid order ${order.id} → Eprolo order ${eproloOrderId}`);
  } catch (err) {
    console.error(`[Eprolo] Auto-forward failed for paid order ${order.id}:`, err instanceof Error ? err.message : err);
  }
}

async function finalizePaidTransaction(reference: string, gatewayData: Record<string, unknown>) {
  const order = await db.transaction(async (tx) => {
    const [transaction] = await tx.select().from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.reference, reference)).limit(1);
    if (!transaction) throw Object.assign(new Error("Payment transaction not found."), { statusCode: 404 });
    if (transaction.status === "failed") throw Object.assign(new Error("This payment transaction has failed."), { statusCode: 409 });
    if (transaction.orderId) {
      const [existingOrder] = await tx.select().from(ordersTable).where(eq(ordersTable.id, transaction.orderId)).limit(1);
      if (existingOrder) return existingOrder;
    }
    if (gatewayData.status !== "success") {
      await tx.update(paymentTransactionsTable).set({ status: "failed", updatedAt: new Date() })
        .where(eq(paymentTransactionsTable.id, transaction.id));
      throw Object.assign(new Error("Payment was not successful."), { statusCode: 402 });
    }
    if (Number(gatewayData.amount) !== transaction.amount) {
      throw Object.assign(new Error("Payment amount does not match the checkout total."), { statusCode: 400 });
    }

    const metadata = transaction.metadata as PendingCheckout;
    const authoritativeItems: OrderItem[] = [];
    let subtotal = 0;
    for (const item of metadata.items) {
      const [product] = await tx.select().from(productsTable)
        .where(and(eq(productsTable.id, item.productId), eq(productsTable.status, "ACTIVE"))).limit(1);
      if (!product) throw Object.assign(new Error(`Product ${item.productId} is no longer available.`), { statusCode: 409 });
      const stockCondition = or(eq(productsTable.trackQuantity, false), gte(productsTable.stock, item.quantity));
      const [reserved] = await tx.update(productsTable)
        .set({ stock: product.trackQuantity ? sql`${productsTable.stock} - ${item.quantity}` : sql`${productsTable.stock}` })
        .where(and(eq(productsTable.id, product.id), stockCondition)).returning();
      if (!reserved) throw Object.assign(new Error(`${product.name} is out of stock or has insufficient stock.`), { statusCode: 409 });
      subtotal += item.price * item.quantity;
      authoritativeItems.push({ productId: product.id, name: product.name, qty: item.quantity, price: item.price });
    }

    let discount = 0;
    if (metadata.couponCode) {
      const [coupon] = await tx.select().from(couponsTable)
        .where(eq(couponsTable.code, metadata.couponCode.toUpperCase())).limit(1);
      if (!coupon || !coupon.active || (coupon.expiresAt && coupon.expiresAt <= new Date()) ||
          (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) ||
          subtotal < Number(coupon.minOrderAmount)) {
        throw Object.assign(new Error("The paid checkout coupon is no longer valid; payment requires manual review."), { statusCode: 409 });
      }
      discount = coupon.discountType === "PERCENTAGE"
        ? Math.min(subtotal, Math.floor((subtotal * Number(coupon.discountValue)) / 100))
        : Math.min(subtotal, Number(coupon.discountValue));
      const [redeemed] = await tx.update(couponsTable)
        .set({ usedCount: sql`${couponsTable.usedCount} + 1`, updatedAt: new Date() })
        .where(and(eq(couponsTable.id, coupon.id), eq(couponsTable.active, true),
          or(isNull(couponsTable.expiresAt), gt(couponsTable.expiresAt, new Date())),
          or(isNull(couponsTable.maxUses), lt(couponsTable.usedCount, coupon.maxUses)))).returning();
      if (!redeemed) throw Object.assign(new Error("The paid checkout coupon is no longer available; payment requires manual review."), { statusCode: 409 });
    }

    const expectedAmount = Math.max(0, subtotal - discount) * 100;
    if (expectedAmount !== transaction.amount) {
      throw Object.assign(new Error("The catalog total changed after payment; payment requires manual review."), { statusCode: 409 });
    }
    const [created] = await tx.insert(ordersTable).values({
      id: randomUUID(),
      customerName: metadata.customerName,
      customerId: metadata.customerId,
      customerEmail: metadata.customerEmail,
      total: Math.max(0, subtotal - discount),
      status: "PROCESSING",
      paymentStatus: "PAID",
      paymentProvider: transaction.provider,
      paymentReference: transaction.reference,
      paidAt: new Date(),
      items: authoritativeItems,
      shippingAddress: metadata.shippingAddress,
      billingAddress: metadata.billingAddress,
    }).returning();
    await tx.insert(orderItemsTable).values(authoritativeItems.map((item) => ({
      id: randomUUID(),
      orderId: created.id,
      productId: item.productId,
      variantId: item.variantId ?? null,
      sku: item.sku ?? "",
      productName: item.name,
      unitPrice: item.price,
      quantity: item.qty,
      total: item.price * item.qty,
      eproloVariantId: item.eproloVariantId ?? null,
    })));
    await tx.update(paymentTransactionsTable).set({
      status: "paid", orderId: created.id, verifiedAt: new Date(), updatedAt: new Date(),
    }).where(eq(paymentTransactionsTable.id, transaction.id));
    return created;
  });

  eventBus.publish({ type: "new_order", payload: {
    id: order.id, customerName: order.customerName, customerEmail: order.customerEmail,
    total: order.total, status: order.status, createdAt: order.createdAt.toISOString(),
  }});
  void tryAutoForwardToEprolo(order);

  // Dispatch order confirmation email & WhatsApp notification asynchronously
  getStoreUrl().then((storeUrl) => {
    const items = Array.isArray(order.items) ? order.items.map((i: any) => ({ name: i.name, qty: i.qty ?? i.quantity ?? 1, price: i.price ?? 0 })) : [];
    const emailData = buildOrderConfirmationEmail({
      orderId: order.id,
      customerName: order.customerName,
      items,
      total: order.total,
      storeUrl,
    });
    sendEmail({ to: order.customerEmail, ...emailData }).catch(() => {});

    const itemSummary = items.map((i) => `${i.name} (x${i.qty})`).join(", ");
    const waText = buildWhatsAppOrderConfirmationMessage({
      orderId: order.id,
      recipientName: order.customerName,
      total: order.total,
      itemSummary,
      orderUrl: `${storeUrl}/account/orders`,
    });
    sendWhatsAppNotification(order.customerEmail, waText).catch(() => {});
  }).catch(() => {});

  return order;
}

// Payment endpoints are unified and handled via paymentsRouter (/api/payments/*)

async function verifyPaystackReference(reference: string) {
  return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
}

// Order creation is payment-gated. Legacy clients may call this after redirect;
// the payment reference is verified again and the idempotent finalizer is used.
router.post("/orders", async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.paystackRef) {
    return res.status(402).json({ error: "Complete payment before creating an order." });
  }
  const data = await verifyPaystackReference(parsed.data.paystackRef);
  const order = await finalizePaidTransaction(parsed.data.paystackRef, data);
  return res.status(200).json(order);
});

const updateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]).optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]).optional(),
  orderId: z.string().optional(),
  id: z.string().optional(),
});

router.put("/orders/:id", requireAdmin, async (req, res) => {
  const orderId = req.params.id as string;
  const parsed = updateOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid order status.", details: parsed.error.flatten() });
  const updates: Record<string, unknown> = {};
  if (parsed.data.status) updates.status = parsed.data.status;
  if (parsed.data.paymentStatus) updates.paymentStatus = parsed.data.paymentStatus;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No valid fields to update." });

  const rows = await db.update(ordersTable).set(updates).where(eq(ordersTable.id, orderId)).returning();
  if (!rows[0]) return res.status(404).json({ error: "Order not found" });
  eventBus.publish({ type: "order_updated", payload: { id: rows[0].id, status: rows[0].status } });

  if (parsed.data.status) {
    const updatedOrder = rows[0];
    getStoreUrl().then((storeUrl) => {
      const emailData = buildOrderStatusUpdateEmail({
        orderId: updatedOrder.id,
        customerName: updatedOrder.customerName,
        status: updatedOrder.status,
        storeUrl,
      });
      sendEmail({ to: updatedOrder.customerEmail, ...emailData }).catch(() => {});

      const waText = buildWhatsAppOrderStatusUpdateMessage({
        orderId: updatedOrder.id,
        recipientName: updatedOrder.customerName,
        status: updatedOrder.status,
        orderUrl: `${storeUrl}/account/orders`,
      });
      sendWhatsAppNotification(updatedOrder.customerEmail, waText).catch(() => {});
    }).catch(() => {});
  }

  return res.json(rows[0]);
});

router.put("/orders", requireAdmin, async (req, res) => {
  const parsed = updateOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid order status.", details: parsed.error.flatten() });
  const orderId = parsed.data.orderId || parsed.data.id;
  if (!orderId) return res.status(400).json({ error: "Order ID is required." });
  const updates: Record<string, unknown> = {};
  if (parsed.data.status) updates.status = parsed.data.status;
  if (parsed.data.paymentStatus) updates.paymentStatus = parsed.data.paymentStatus;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No valid fields to update." });

  const rows = await db.update(ordersTable).set(updates).where(eq(ordersTable.id, orderId)).returning();
  if (!rows[0]) return res.status(404).json({ error: "Order not found" });
  eventBus.publish({ type: "order_updated", payload: { id: rows[0].id, status: rows[0].status } });

  if (parsed.data.status) {
    const updatedOrder = rows[0];
    getStoreUrl().then((storeUrl) => {
      const emailData = buildOrderStatusUpdateEmail({
        orderId: updatedOrder.id,
        customerName: updatedOrder.customerName,
        status: updatedOrder.status,
        storeUrl,
      });
      sendEmail({ to: updatedOrder.customerEmail, ...emailData }).catch(() => {});

      const waText = buildWhatsAppOrderStatusUpdateMessage({
        orderId: updatedOrder.id,
        recipientName: updatedOrder.customerName,
        status: updatedOrder.status,
        orderUrl: `${storeUrl}/account/orders`,
      });
      sendWhatsAppNotification(updatedOrder.customerEmail, waText).catch(() => {});
    }).catch(() => {});
  }

  return res.json(rows[0]);
});

// ── Categories ────────────────────────────────────────────────────────────────

router.get("/categories", async (_req, res) => {
  const rows = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  const withCount = await Promise.all(rows.map(async (c) => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(eq(productsTable.categoryId, c.id));
    return { ...c, productCount: count ?? 0 };
  }));
  return res.json(withCount);
});

router.post("/categories", requireAdmin, async (req, res) => {
  const { name, description } = req.body as { name: string; description: string };
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const [cat] = await db.insert(categoriesTable).values({ id: randomUUID(), name, slug, description: description ?? "" }).returning();
  return res.status(201).json({ ...cat, productCount: 0 });
});

router.put("/categories/:id", requireAdmin, async (req, res) => {
  const categoryId = req.params.id as string;
  const allowed = ["name", "description"];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
  if (req.body.name) updates["slug"] = String(req.body.name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const rows = await db.update(categoriesTable).set(updates).where(eq(categoriesTable.id, categoryId)).returning();
  if (!rows[0]) return res.status(404).json({ error: "Category not found" });
  return res.json(rows[0]);
});

router.delete("/categories/:id", requireAdmin, async (req, res) => {
  const categoryId = req.params.id as string;
  await db.delete(categoriesTable).where(eq(categoriesTable.id, categoryId));
  return res.json({ ok: true });
});

// ── Blog Posts ────────────────────────────────────────────────────────────────

router.get("/posts", async (_req, res) => {
  return res.json(await db.select().from(blogPostsTable).orderBy(desc(blogPostsTable.createdAt)));
});

router.post("/posts", requireAdmin, async (req, res) => {
  const { title, content, status, authorName } = req.body as { title?: string; content?: string; status?: string; authorName?: string };
  const slug = (title ?? "post").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const [post] = await db.insert(blogPostsTable).values({
    id: randomUUID(), title: title ?? "", slug, content: content ?? "",
    status: status ?? "DRAFT", authorName: authorName ?? "Admin",
    publishedAt: status === "PUBLISHED" ? new Date() : null,
  }).returning();
  return res.status(201).json(post);
});

router.get("/posts/:id", async (req, res) => {
  const [p] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, req.params.id as string)).limit(1);
  if (!p) return res.status(404).json({ error: "Post not found" });
  return res.json(p);
});

router.put("/posts/:id", requireAdmin, async (req, res) => {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ["title", "content", "status", "authorName"]) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (req.body.title) updates.slug = String(req.body.title).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (req.body.status === "PUBLISHED") updates.publishedAt = new Date();
  const [updated] = await db.update(blogPostsTable).set(updates).where(eq(blogPostsTable.id, req.params.id as string)).returning();
  if (!updated) return res.status(404).json({ error: "Post not found" });
  return res.json(updated);
});

router.delete("/posts/:id", requireAdmin, async (req, res) => {
  await db.delete(blogPostsTable).where(eq(blogPostsTable.id, req.params.id as string));
  return res.json({ ok: true });
});

// ── Media ─────────────────────────────────────────────────────────────────────

router.get("/media", requireAdmin, async (_req, res) => {
  const items = await db.select().from(mediaItemsTable).orderBy(desc(mediaItemsTable.createdAt));
  const assets = items.map((i) => ({
    id: i.id,
    publicId: i.id,
    url: i.url,
    secureUrl: i.url,
    originalName: i.filename,
    format: i.filename.split(".").pop() || "jpg",
    width: null,
    height: null,
    bytes: i.size,
    folder: "uploads",
    createdAt: i.createdAt.toISOString(),
  }));
  return res.json({
    assets,
    items,
    cloudinaryConfigured: true,
  });
});

router.delete("/media/:id", requireAdmin, async (req, res) => {
  await db.delete(mediaItemsTable).where(eq(mediaItemsTable.id, req.params.id as string));
  return res.json({ ok: true });
});

// ── Users / Customers ─────────────────────────────────────────────────────────

router.get("/users", requireAdmin, async (_req, res) => {
  const customers = await db.select()
    .from(usersTable)
    .where(and(ne(usersTable.role, "ADMIN"), ne(usersTable.role, "SUPER_ADMIN")))
    .orderBy(desc(usersTable.createdAt));
  return res.json(customers);
});

router.delete("/users/bulk", requireAdmin, async (req, res) => {
  const { ids } = req.body as { ids?: string[] };
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No user IDs provided" });
  }
  try {
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    return res.json({ success: true, message: `Deleted ${ids.length} users` });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.put("/users/bulk", requireAdmin, async (req, res) => {
  const { ids, role } = req.body as { ids?: string[], role?: string };
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No user IDs provided" });
  }
  if (!role) {
    return res.status(400).json({ error: "No role provided to update" });
  }
  try {
    await db.update(usersTable).set({ role }).where(inArray(usersTable.id, ids));
    return res.json({ success: true, message: `Updated ${ids.length} users` });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.delete("/users/:id", requireAdmin, async (req, res) => {
  const userId = req.params.id as string;
  try {
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    return res.json({ success: true, message: "User deleted" });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ── Coupons ───────────────────────────────────────────────────────────────────

router.get("/coupons", requireAdmin, async (_req, res) => {
  return res.json(await db.select().from(couponsTable).orderBy(desc(couponsTable.createdAt)));
});

router.post("/coupons", requireAdmin, async (req, res) => {
  const [coupon] = await db.insert(couponsTable).values({
    id: randomUUID(),
    code: String(req.body.code ?? "").trim().toUpperCase(),
    description: String(req.body.description ?? ""),
    discountType: req.body.discountType ?? "PERCENTAGE",
    discountValue: Number(req.body.discountValue ?? 0),
    minOrderAmount: Number(req.body.minOrderAmount ?? 0),
    maxUses: req.body.maxUses == null ? null : Number(req.body.maxUses),
    usedCount: 0,
    active: req.body.active ?? true,
    expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
  }).returning();
  return res.status(201).json(coupon);
});

router.put("/coupons/:id", requireAdmin, async (req, res) => {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ["description", "discountType", "active"]) if (key in req.body) updates[key] = req.body[key];
  for (const key of ["discountValue", "minOrderAmount", "maxUses", "usedCount"]) {
    if (key in req.body) updates[key] = req.body[key] == null ? null : Number(req.body[key]);
  }
  if ("expiresAt" in req.body) updates.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
  const [updated] = await db.update(couponsTable).set(updates).where(eq(couponsTable.id, req.params.id as string)).returning();
  if (!updated) return res.status(404).json({ error: "Coupon not found" });
  return res.json(updated);
});

router.delete("/coupons/:id", requireAdmin, async (req, res) => {
  await db.delete(couponsTable).where(eq(couponsTable.id, req.params.id as string));
  return res.json({ ok: true });
});

// ── Team ──────────────────────────────────────────────────────────────────────

router.get("/team", requireAdmin, async (_req, res) => {
  const teamDb = await db.select().from(teamMembersTable);
  const adminUsers = await db.select().from(usersTable)
    .where(or(eq(usersTable.role, "ADMIN"), eq(usersTable.role, "SUPER_ADMIN")));

  const normalizedAdmins = adminUsers.map(user => ({
    id: user.id,
    email: user.email,
    name: user.name || "Administrator",
    role: user.role === "SUPER_ADMIN" ? "Owner" : "Admin",
    status: "active",
    invitedBy: null,
    inviteToken: null,
    lastLoginAt: null,
    createdAt: user.createdAt,
  }));

  const normalizedTeam = teamDb.map(m => ({
    id: m.id,
    email: m.email,
    name: m.name || "Team Member",
    role: m.role || "Editor",
    status: (m.status || "active").toLowerCase(),
    invitedBy: m.invitedBy,
    inviteToken: m.inviteToken,
    lastLoginAt: m.lastLoginAt,
    createdAt: m.createdAt,
  }));

  const combined = [...normalizedAdmins, ...normalizedTeam];
  return res.json(combined);
});

router.post("/team/invite", requireAdmin, async (req, res) => {
  const { email, role } = req.body as { email: string; role: string };
  const token = randomUUID();
  await db.insert(teamMembersTable).values({
    id: randomUUID(), name: "", email, role: role ?? "EDITOR", status: "Invited",
    inviteToken: token, inviteExpiresAt: new Date(Date.now() + 86400000 * 7),
  });
  return res.status(201).json({ ok: true, token });
});

router.get("/team/accept", async (req, res) => {
  const { token } = req.query as { token?: string };
  if (!token) return res.status(400).json({ error: "token is required" });
  const [member] = await db.select({ email: teamMembersTable.email })
    .from(teamMembersTable).where(eq(teamMembersTable.inviteToken, token)).limit(1);
  if (!member) return res.status(404).json({ error: "Invite not found or expired" });
  return res.json({ ok: true, email: member.email });
});

router.post("/team/accept", async (req, res) => {
  const { token, name } = req.body as { token: string; name: string };
  if (!token) return res.status(400).json({ error: "token is required" });
  const [member] = await db.update(teamMembersTable)
    .set({ name, status: "Active", inviteToken: null, inviteExpiresAt: null })
    .where(eq(teamMembersTable.inviteToken, token)).returning();
  if (!member) return res.status(404).json({ error: "Invite not found or expired" });

  // Auto-register into usersTable as ADMIN so they can request OTP login
  await db.insert(usersTable).values({
    id: randomUUID(),
    name,
    email: member.email,
    role: "ADMIN",
    passwordHash: "",
  }).onConflictDoUpdate({
    target: usersTable.email,
    set: { name, role: "ADMIN" }
  });

  return res.json({ ok: true, name: member.name });
});

const contactSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  subject: z.string().min(1),
  message: z.string().min(1),
});

const appointmentSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  location: z.string().min(1),
  date: z.string().min(1),
  service: z.string().min(1),
  notes: z.string().optional(),
});

router.post("/appointments", validate(appointmentSchema), async (req, res) => {
  const { name, email, phone, location, date, service, notes } = req.body as z.infer<typeof appointmentSchema>;
  const threadId = `appointment:${randomUUID()}`;
  try {
    const formattedText = `📅 VIP PRIVATE APPOINTMENT BOOKING REQUEST\n` +
      `• Service: ${service}\n` +
      `• Showroom: ${location}\n` +
      `• Preferred Date: ${date}\n` +
      `• Client Contact: ${phone} / ${email}\n` +
      (notes ? `• Client Notes: ${notes}` : "");

    await db.insert(messagesTable).values({
      id: randomUUID(),
      threadId,
      sender: "customer",
      text: formattedText,
      customerName: name,
      email,
      phone,
      channel: "appointment",
      channelType: "chat",
      status: "sent",
      type: "message",
    });

    return res.status(201).json({
      success: true,
      message: "VIP Private Appointment request confirmed and synced with Concierge Calendar.",
      appointment: { name, email, phone, location, date, service, threadId },
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to book appointment. Please try again." });
  }
});

router.post("/contact", validate(contactSchema), async (req, res) => {
  const { fullName, email, subject, message } = req.body as z.infer<typeof contactSchema>;
  const threadId = `contact:${randomUUID()}`;
  try {
    await db.insert(messagesTable).values({
      id: randomUUID(),
      threadId,
      sender: "customer",
      text: `[Subject: ${subject}]\n\n${message}`,
      customerName: fullName,
      email,
      phone: "",
      channel: "contact",
      channelType: "chat",
      status: "sent",
      type: "message",
    });
    return res.status(201).json({ success: true, message: "Inquiry received successfully. Our concierge team will respond within 24 operational hours." });
  } catch {
    return res.status(500).json({ error: "Failed to submit inquiry. Please try again." });
  }
});

export default router;

// Orders Bulk Operations
router.delete("/orders/bulk", requireAdmin, async (req, res) => {
  const { ids } = req.body as { ids?: string[] };
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No order IDs provided" });
  }
  try {
    await db.delete(ordersTable).where(inArray(ordersTable.id, ids));
    return res.json({ success: true, message: `Deleted ${ids.length} orders` });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.put("/orders/bulk", requireAdmin, async (req, res) => {
  const { ids, status, paymentStatus } = req.body as { ids?: string[], status?: string, paymentStatus?: string };
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No order IDs provided" });
  }
  const updates: Record<string, string> = {};
  if (status) updates.status = status;
  if (paymentStatus) updates.paymentStatus = paymentStatus;
  
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No status provided to update" });
  }
  
  try {
    await db.update(ordersTable).set(updates).where(inArray(ordersTable.id, ids));
    return res.json({ success: true, message: `Updated ${ids.length} orders` });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.delete("/orders/:id", requireAdmin, async (req, res) => {
  const orderId = req.params.id as string;
  try {
    await db.delete(ordersTable).where(eq(ordersTable.id, orderId));
    return res.json({ success: true, message: "Order deleted" });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ── Showroom Locations API Endpoints ──────────────────────────────────────────

router.get("/showroom-locations", async (_req, res) => {
  try {
    const locs = await db.select().from(showroomLocationsTable).where(eq(showroomLocationsTable.active, true));
    return res.json(locs);
  } catch (err) {
    console.error("Error fetching showroom locations:", err);
    return res.status(500).json({ error: "Failed to fetch showroom locations" });
  }
});

router.get("/admin/showroom-locations", requireAdmin, async (_req, res) => {
  try {
    const locs = await db.select().from(showroomLocationsTable).orderBy(showroomLocationsTable.name);
    return res.json(locs);
  } catch (err) {
    console.error("Error fetching admin showroom locations:", err);
    return res.status(500).json({ error: "Failed to fetch showroom locations" });
  }
});

router.post("/admin/showroom-locations", requireAdmin, async (req, res) => {
  try {
    const { name, address, city, country, phone, email, hours, imageUrl, active } = req.body;
    if (!name || !address || !city || !country) {
      return res.status(400).json({ error: "Name, address, city, and country are required" });
    }
    const id = `loc-${randomUUID().slice(0, 8)}`;
    await db.insert(showroomLocationsTable).values({
      id,
      name,
      address,
      city,
      country,
      phone: phone || "",
      email: email || "",
      hours: hours || "",
      imageUrl: imageUrl || "",
      active: active !== undefined ? active : true,
    });
    return res.status(201).json({ success: true, id });
  } catch (err) {
    console.error("Error creating showroom location:", err);
    return res.status(500).json({ error: "Failed to create showroom location" });
  }
});

router.put("/admin/showroom-locations/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { name, address, city, country, phone, email, hours, imageUrl, active } = req.body;
    await db.update(showroomLocationsTable)
      .set({
        name,
        address,
        city,
        country,
        phone,
        email,
        hours,
        imageUrl,
        active,
        updatedAt: new Date(),
      })
      .where(eq(showroomLocationsTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    console.error("Error updating showroom location:", err);
    return res.status(500).json({ error: "Failed to update showroom location" });
  }
});

router.delete("/admin/showroom-locations/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string;
    await db.delete(showroomLocationsTable).where(eq(showroomLocationsTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting showroom location:", err);
    return res.status(500).json({ error: "Failed to delete showroom location" });
  }
});
