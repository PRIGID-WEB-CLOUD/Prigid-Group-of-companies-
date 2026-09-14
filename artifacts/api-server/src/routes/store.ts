import { Router, type Request, type Response } from "express";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import {
  db, productsTable, categoriesTable, ordersTable, productVariantsTable,
  mediaItemsTable, blogPostsTable, couponsTable, usersTable, teamMembersTable,
  paymentTransactionsTable, orderItemsTable, appSettingsTable, providerPluginsTable,
  messagesTable, showroomLocationsTable, storesTable,
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
import { type TenantRequest } from "../middleware/tenantContext";

const router = Router();
const CART_COOKIE = "luxe_cart";

const BOUTIQUE_METADATA: Record<string, {
  name: string;
  short_name: string;
  tagline: string;
  primary_color: string;
  bg_color: string;
  typography: string;
  hero_headline: string;
  hero_subheadline: string;
  hero_image: string;
  valet: string;
  hospitality: string;
  currency: string;
}> = {
  "maison-moretti": {
    name: "Maison Moretti Milano",
    short_name: "MORETTI",
    tagline: "Florentine Bespoke Leathercraft & Footwear",
    primary_color: "#854d0e",
    bg_color: "#18181b",
    typography: "'Playfair Display', Georgia, serif",
    hero_headline: "Hand-Burnished <br /><span class=\"italic font-light\">Florentine Leather</span>",
    hero_subheadline: "Master craftsmen hand-stitching Louisiana alligator, Tuscan calfskin, and bespoke weekender luggage in Milan.",
    hero_image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=2012&auto=format&fit=crop",
    valet: "Chauffeured arrival service at Via Montenapoleone salon entrance.",
    hospitality: "Bespoke leather monogramming and espresso bar upon your arrival.",
    currency: "EUR",
  },
  "aurelia-jewels": {
    name: "Aurelia Haute Joaillerie",
    short_name: "AURELIA",
    tagline: "High Jewelry, Rare Diamonds & Solitaires",
    primary_color: "#b45309",
    bg_color: "#0f172a",
    typography: "'Cinzel', 'Playfair Display', serif",
    hero_headline: "Brilliance in <br /><span class=\"italic font-light\">Pure Platinum & Gold</span>",
    hero_subheadline: "Ethically sourced certified diamonds, untreated Ceylon sapphires, and bespoke heirloom commissions.",
    hero_image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=2070&auto=format&fit=crop",
    valet: "Discreet subterranean security entrance and armored courier dispatch.",
    hospitality: "Private gemological viewing vault with dedicated master jeweler consultation.",
    currency: "USD",
  },
  "kurogane": {
    name: "Kurogane Horology",
    short_name: "KUROGANE",
    tagline: "Precision Haute Horlogerie & Complications",
    primary_color: "#0284c7",
    bg_color: "#090d16",
    typography: "'Manrope', 'Inter', sans-serif",
    hero_headline: "The Art of <br /><span class=\"italic font-light\">Micro-Mechanical Mastery</span>",
    hero_subheadline: "Handcrafted complications, skeleton tourbillons, and titanium cases engineered to one-tenth of a micron in Tokyo.",
    hero_image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=2087&auto=format&fit=crop",
    valet: "Private Ginza penthouse reception and executive transfer service.",
    hospitality: "Master watchmaker bench preview and ceremonial matcha service.",
    currency: "USD",
  },
  "atelier-celeste": {
    name: "Atelier Céleste",
    short_name: "CÉLESTE",
    tagline: "Haute Couture, Silk Eveningwear & Tailoring",
    primary_color: "#4338ca",
    bg_color: "#09090b",
    typography: "'Noto Serif', 'Georgia', serif",
    hero_headline: "Silk Georgette & <br /><span class=\"italic font-light\">Bespoke Silhouettes</span>",
    hero_subheadline: "Made-to-measure evening gowns, double-breasted tuxedo suiting, and pure Grade-A Mongolian cashmere.",
    hero_image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=2076&auto=format&fit=crop",
    valet: "Complimentary private concierge and valet available at Mayfair Atelier entrance.",
    hospitality: "Private salon fittings and vintage champagne service upon arrival.",
    currency: "GBP",
  },
  "luxe-boutique": {
    name: "Luxe Boutique Ateliers",
    short_name: "LUXE",
    tagline: "Flagship Luxury Fashion, Objects & Decor",
    primary_color: "#006c49",
    bg_color: "#0f172a",
    typography: "'Playfair Display', Georgia, serif",
    hero_headline: "Architectural <br /><span class=\"italic font-light\">Elegance</span>",
    hero_subheadline: "Discover our latest release: A study in precision tailoring, fine leathercraft, and sculptural decor.",
    hero_image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop",
    valet: "Complimentary valet parking is available at the main entrance.",
    hospitality: "Enjoy our signature champagne service upon your arrival.",
    currency: "USD",
  },
};

router.get("/store/branding", async (req: TenantRequest, res: Response) => {
  try {
    const store = req.store;
    if (!store) return res.status(404).json({ error: "Store not found" });

    const user = await getSessionUser(req, store.id).catch(() => null);
    const isAdmin = user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN");

    const meta = BOUTIQUE_METADATA[store.slug] || BOUTIQUE_METADATA["luxe-boutique"];

    return res.json({
      store_id: store.id,
      store_slug: store.slug,
      store_name: store.name || meta.name,
      brand_logo_text: meta.short_name,
      brand_tagline: meta.tagline,
      store_email: "",
      store_currency: store.currency || meta.currency || "USD",
      store_timezone: "UTC",
      isPublished: store.publishStatus === "PUBLISHED" || store.isPublished === true,
      isAdmin: Boolean(isAdmin),
      brand_primary_color: meta.primary_color,
      brand_bg_color: meta.bg_color,
      brand_logo_url: "",
      brand_typography: meta.typography,
      brand_hero_headline: meta.hero_headline,
      brand_hero_subheadline: meta.hero_subheadline,
      brand_hero_image: meta.hero_image,
      brand_valet_instructions: meta.valet,
      brand_hospitality_notes: meta.hospitality,
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

async function enrichProduct(p: typeof productsTable.$inferSelect, storeId: string) {
  const cat = p.categoryId
    ? (await db.select().from(categoriesTable).where(and(eq(categoriesTable.id, p.categoryId), eq(categoriesTable.storeId, storeId))).limit(1))[0]
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

router.get("/products", async (req: TenantRequest, res: Response) => {
  const user = await getSessionUser(req);
  const canManage = user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN");
  const storeId = req.storeId!;

  const prods = await db.select().from(productsTable)
    .where(and(
      eq(productsTable.storeId, storeId),
      canManage ? undefined : ne(productsTable.status, "ARCHIVED")
    ))
    .orderBy(desc(productsTable.createdAt));
  const enriched = await Promise.all(prods.map(p => enrichProduct(p, storeId)));
  res.json(enriched);
});

router.post("/products", requireAdmin, validate(productSchema), async (req: TenantRequest, res: Response) => {
  const body = req.body as z.infer<typeof productSchema>;
  const allowed = ["name", "price", "categoryId", "stock", "trackQuantity", "status", "imageUrl", "description", "tags", "metaSyncEnabled", "eproloProductId"];
  const insertData: Record<string, unknown> = { 
    id: randomUUID(),
    storeId: req.storeId!,
  };
  for (const k of allowed) {
    if (k in body && (body as Record<string, unknown>)[k] !== undefined) {
      insertData[k] = (body as Record<string, unknown>)[k];
    }
  }
  const [p] = await db.insert(productsTable).values(insertData as typeof productsTable.$inferInsert).returning();
  checkAndEmitLowStock(req.storeId!).catch(() => {});
  return res.status(201).json(await enrichProduct(p, req.storeId!));
});

router.get("/products/:id", async (req: TenantRequest, res: Response) => {
  const productId = req.params.id as string;
  const user = await getSessionUser(req);
  const canManage = user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN");
  const storeId = req.storeId!;

  const rows = await db.select().from(productsTable).where(and(
    eq(productsTable.id, productId),
    eq(productsTable.storeId, storeId),
    ...(canManage ? [] : [ne(productsTable.status, "ARCHIVED")]),
  )).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Product not found" });
  return res.json(await enrichProduct(rows[0], storeId));
});

router.put("/products/:id", requireAdmin, async (req: TenantRequest, res: Response) => {
  const productId = req.params.id as string;
  const storeId = req.storeId!;
  
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
  const rows = await db.update(productsTable)
    .set(updates)
    .where(and(eq(productsTable.id, productId), eq(productsTable.storeId, storeId)))
    .returning();
  if (!rows[0]) return res.status(404).json({ error: "Product not found" });
  checkAndEmitLowStock(storeId).catch(() => {});
  return res.json(await enrichProduct(rows[0], storeId));
});

router.delete("/products/:id", requireAdmin, async (req: TenantRequest, res: Response) => {
  const productId = req.params.id as string;
  const storeId = req.storeId!;
  await db.delete(productsTable).where(and(eq(productsTable.id, productId), eq(productsTable.storeId, storeId)));
  checkAndEmitLowStock(storeId).catch(() => {});
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
async function syncVariantStockToProduct(productId: string, storeId: string) {
  try {
    const variants = await db.select().from(productVariantsTable).where(and(eq(productVariantsTable.productId, productId), eq(productVariantsTable.storeId, storeId)));
    if (variants.length > 0) {
      const totalStock = variants.reduce((acc, v) => acc + (v.stock ?? 0), 0);
      await db.update(productsTable).set({ stock: totalStock }).where(and(eq(productsTable.id, productId), eq(productsTable.storeId, storeId)));
    }
    await checkAndEmitLowStock(storeId);
  } catch (err) {
    console.error("Failed to sync variant stock:", err);
  }
}

router.get("/products/:id/variants", async (req: TenantRequest, res) => {
  const productId = req.params.id as string;
  const storeId = req.storeId!;
  const rows = await db.select().from(productsTable).where(and(eq(productsTable.id, productId), eq(productsTable.storeId, storeId))).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Product not found" });
  return res.json(await db.select().from(productVariantsTable).where(and(eq(productVariantsTable.productId, productId), eq(productVariantsTable.storeId, storeId))));
});

router.post("/products/:id/variants", requireAdmin, async (req: TenantRequest, res) => {
  const productId = req.params.id as string;
  const storeId = req.storeId!;
  const rows = await db.select().from(productsTable).where(and(eq(productsTable.id, productId), eq(productsTable.storeId, storeId))).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Product not found" });
  const parsed = variantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid variant fields.", details: parsed.error.flatten() });
  const [variant] = await db.insert(productVariantsTable).values({
    id: randomUUID(),
    storeId,
    productId,
    size: parsed.data.size ?? "",
    color: parsed.data.color ?? "",
    stock: parsed.data.stock ?? 0,
    price: parsed.data.price ?? null,
    sku: parsed.data.sku ?? "",
    eproloProductId: parsed.data.eproloProductId ?? null,
    eproloVariantId: parsed.data.eproloVariantId ?? null,
  }).returning();

  syncVariantStockToProduct(productId, storeId).catch(() => {});
  return res.status(201).json(variant);
});

router.put("/products/:id/variants/:variantId", requireAdmin, async (req: TenantRequest, res) => {
  const productId = req.params.id as string;
  const variantId = req.params.variantId as string;
  const storeId = req.storeId!;
  const parsed = variantSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid variant fields.", details: parsed.error.flatten() });
  const updates: Record<string, unknown> = parsed.data;
  const [updated] = await db.update(productVariantsTable)
    .set(updates)
    .where(and(eq(productVariantsTable.id, variantId), eq(productVariantsTable.productId, productId), eq(productVariantsTable.storeId, storeId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Variant not found" });

  syncVariantStockToProduct(productId, storeId).catch(() => {});
  return res.json(updated);
});

router.delete("/products/:id/variants/:variantId", requireAdmin, async (req: TenantRequest, res) => {
  const productId = req.params.id as string;
  const storeId = req.storeId!;
  await db.delete(productVariantsTable).where(and(
    eq(productVariantsTable.id, req.params.variantId as string),
    eq(productVariantsTable.productId, productId),
    eq(productVariantsTable.storeId, storeId)
  ));

  syncVariantStockToProduct(productId, storeId).catch(() => {});
  return res.json({ ok: true });
});

const generateMatrixSchema = z.object({
  sizes: z.array(z.string().trim().min(1)).min(1),
  colors: z.array(z.string().trim().min(1)).min(1),
  defaultPrice: z.number().int().min(0).optional().nullable(),
  defaultStock: z.number().int().min(0).optional().default(10),
});

router.post("/products/:id/generate-variants", requireAdmin, async (req: TenantRequest, res) => {
  const productId = req.params.id as string;
  const storeId = req.storeId!;
  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.id, productId), eq(productsTable.storeId, storeId))).limit(1);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const parsed = generateMatrixSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Sizes and colors lists are required." });

  const { sizes, colors, defaultPrice, defaultStock } = parsed.data;

  // Existing variants check to avoid duplicates
  const existing = await db.select().from(productVariantsTable).where(and(eq(productVariantsTable.productId, productId), eq(productVariantsTable.storeId, storeId)));
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
          storeId,
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

  syncVariantStockToProduct(productId, storeId).catch(() => {});

  const allVariants = await db.select().from(productVariantsTable).where(and(eq(productVariantsTable.productId, productId), eq(productVariantsTable.storeId, storeId)));
  return res.json({
    createdCount: newVariantsToInsert.length,
    variants: allVariants,
  });
});

// ── Orders ────────────────────────────────────────────────────────────────────

router.get("/orders", requireAdmin, async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const rows = await db.select().from(ordersTable)
    .where(eq(ordersTable.storeId, storeId))
    .orderBy(desc(ordersTable.createdAt));
  return res.json(rows);
});

router.get("/admin/notifications/unread-count", requireAdmin, async (req: TenantRequest, res: Response) => {
  try {
    const storeId = req.storeId!;
    const rows = await db.select({
      id: ordersTable.id,
      status: ordersTable.status,
    }).from(ordersTable)
      .where(eq(ordersTable.storeId, storeId));
    
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

router.get("/orders/:id", requireAdmin, async (req: TenantRequest, res: Response) => {
  const orderId = req.params.id as string;
  const storeId = req.storeId!;
  const rows = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.storeId, storeId)))
    .limit(1);
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
  const cfg = await getEproloConfig(order.storeId);
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

  eventBus.publish({ type: "new_order", storeId: order.storeId, payload: {
    id: order.id, storeId: order.storeId, customerName: order.customerName, customerEmail: order.customerEmail,
    total: order.total, status: order.status, createdAt: order.createdAt.toISOString(),
  }});
  void tryAutoForwardToEprolo(order);

  // Dispatch order confirmation email & WhatsApp notification asynchronously
  getStoreUrl(order.storeId).then((storeUrl) => {
    const items = Array.isArray(order.items) ? order.items.map((i: any) => ({ name: i.name, qty: i.qty ?? i.quantity ?? 1, price: i.price ?? 0 })) : [];
    const emailData = buildOrderConfirmationEmail({
      orderId: order.id,
      customerName: order.customerName,
      items,
      total: order.total,
      storeUrl,
    });
    sendEmail({ to: order.customerEmail, ...emailData, storeId: order.storeId }).catch(() => {});

    const itemSummary = items.map((i) => `${i.name} (x${i.qty})`).join(", ");
    const waText = buildWhatsAppOrderConfirmationMessage({
      orderId: order.id,
      recipientName: order.customerName,
      total: order.total,
      itemSummary,
      orderUrl: `${storeUrl}/account/orders`,
    });
    sendWhatsAppNotification(order.customerEmail, waText, order.storeId).catch(() => {});
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

router.put("/orders/:id", requireAdmin, async (req: TenantRequest, res) => {
  const orderId = req.params.id as string;
  const storeId = req.storeId!;
  const parsed = updateOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid order status.", details: parsed.error.flatten() });
  const updates: Record<string, unknown> = {};
  if (parsed.data.status) updates.status = parsed.data.status;
  if (parsed.data.paymentStatus) updates.paymentStatus = parsed.data.paymentStatus;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No valid fields to update." });

  const rows = await db.update(ordersTable).set(updates).where(and(eq(ordersTable.id, orderId), eq(ordersTable.storeId, storeId))).returning();
  if (!rows[0]) return res.status(404).json({ error: "Order not found" });
  eventBus.publish({ type: "order_updated", storeId, payload: { id: rows[0].id, storeId, status: rows[0].status } });

  if (parsed.data.status) {
    const updatedOrder = rows[0];
    getStoreUrl(storeId).then((storeUrl) => {
      const emailData = buildOrderStatusUpdateEmail({
        orderId: updatedOrder.id,
        customerName: updatedOrder.customerName,
        status: updatedOrder.status,
        storeUrl,
      });
      sendEmail({ to: updatedOrder.customerEmail, ...emailData, storeId }).catch(() => {});

      const waText = buildWhatsAppOrderStatusUpdateMessage({
        orderId: updatedOrder.id,
        recipientName: updatedOrder.customerName,
        status: updatedOrder.status,
        orderUrl: `${storeUrl}/account/orders`,
      });
      sendWhatsAppNotification(updatedOrder.customerEmail, waText, storeId).catch(() => {});
    }).catch(() => {});
  }

  return res.json(rows[0]);
});

router.put("/orders", requireAdmin, async (req: TenantRequest, res) => {
  const parsed = updateOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid order status.", details: parsed.error.flatten() });
  const orderId = parsed.data.orderId || parsed.data.id;
  const storeId = req.storeId!;
  if (!orderId) return res.status(400).json({ error: "Order ID is required." });
  const updates: Record<string, unknown> = {};
  if (parsed.data.status) updates.status = parsed.data.status;
  if (parsed.data.paymentStatus) updates.paymentStatus = parsed.data.paymentStatus;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No valid fields to update." });

  const rows = await db.update(ordersTable).set(updates).where(and(eq(ordersTable.id, orderId), eq(ordersTable.storeId, storeId))).returning();
  if (!rows[0]) return res.status(404).json({ error: "Order not found" });
  eventBus.publish({ type: "order_updated", storeId, payload: { id: rows[0].id, storeId, status: rows[0].status } });

  if (parsed.data.status) {
    const updatedOrder = rows[0];
    getStoreUrl(storeId).then((storeUrl) => {
      const emailData = buildOrderStatusUpdateEmail({
        orderId: updatedOrder.id,
        customerName: updatedOrder.customerName,
        status: updatedOrder.status,
        storeUrl,
      });
      sendEmail({ to: updatedOrder.customerEmail, ...emailData, storeId }).catch(() => {});

      const waText = buildWhatsAppOrderStatusUpdateMessage({
        orderId: updatedOrder.id,
        recipientName: updatedOrder.customerName,
        status: updatedOrder.status,
        orderUrl: `${storeUrl}/account/orders`,
      });
      sendWhatsAppNotification(updatedOrder.customerEmail, waText, storeId).catch(() => {});
    }).catch(() => {});
  }

  return res.json(rows[0]);
});

// ── Categories ────────────────────────────────────────────────────────────────

router.get("/categories", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const rows = await db.select().from(categoriesTable)
    .where(eq(categoriesTable.storeId, storeId))
    .orderBy(categoriesTable.name);
  const withCount = await Promise.all(rows.map(async (c) => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(productsTable)
      .where(and(eq(productsTable.categoryId, c.id), eq(productsTable.storeId, storeId)));
    return { ...c, productCount: count ?? 0 };
  }));
  return res.json(withCount);
});

router.post("/categories", requireAdmin, async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const { name, description } = req.body as { name: string; description: string };
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const [cat] = await db.insert(categoriesTable).values({ 
    id: randomUUID(), 
    storeId,
    name, 
    slug, 
    description: description ?? "" 
  }).returning();
  return res.status(201).json({ ...cat, productCount: 0 });
});

router.put("/categories/:id", requireAdmin, async (req: TenantRequest, res: Response) => {
  const categoryId = req.params.id as string;
  const storeId = req.storeId!;
  const allowed = ["name", "description"];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
  if (req.body.name) updates["slug"] = String(req.body.name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const rows = await db.update(categoriesTable)
    .set(updates)
    .where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.storeId, storeId)))
    .returning();
  if (!rows[0]) return res.status(404).json({ error: "Category not found" });
  return res.json(rows[0]);
});

router.delete("/categories/:id", requireAdmin, async (req: TenantRequest, res: Response) => {
  const categoryId = req.params.id as string;
  const storeId = req.storeId!;
  await db.delete(categoriesTable).where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.storeId, storeId)));
  return res.json({ ok: true });
});

// ── Blog Posts ────────────────────────────────────────────────────────────────

router.get("/posts", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  return res.json(await db.select().from(blogPostsTable)
    .where(eq(blogPostsTable.storeId, storeId))
    .orderBy(desc(blogPostsTable.createdAt)));
});

router.post("/posts", requireAdmin, async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const { title, content, status, authorName } = req.body as { title?: string; content?: string; status?: string; authorName?: string };
  const slug = (title ?? "post").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const [post] = await db.insert(blogPostsTable).values({
    id: randomUUID(), 
    storeId,
    title: title ?? "", 
    slug, 
    content: content ?? "",
    status: status ?? "DRAFT", 
    authorName: authorName ?? "Admin",
    publishedAt: status === "PUBLISHED" ? new Date() : null,
  }).returning();
  return res.status(201).json(post);
});

router.get("/posts/:id", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const [p] = await db.select().from(blogPostsTable)
    .where(and(eq(blogPostsTable.id, req.params.id as string), eq(blogPostsTable.storeId, storeId)))
    .limit(1);
  if (!p) return res.status(404).json({ error: "Post not found" });
  return res.json(p);
});

router.put("/posts/:id", requireAdmin, async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ["title", "content", "status", "authorName"]) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (req.body.title) updates.slug = String(req.body.title).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (req.body.status === "PUBLISHED") updates.publishedAt = new Date();
  const [updated] = await db.update(blogPostsTable)
    .set(updates)
    .where(and(eq(blogPostsTable.id, req.params.id as string), eq(blogPostsTable.storeId, storeId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Post not found" });
  return res.json(updated);
});

router.delete("/posts/:id", requireAdmin, async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  await db.delete(blogPostsTable).where(and(eq(blogPostsTable.id, req.params.id as string), eq(blogPostsTable.storeId, storeId)));
  return res.json({ ok: true });
});

// ── Media ─────────────────────────────────────────────────────────────────────

router.get("/media", requireAdmin, async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const items = await db.select().from(mediaItemsTable)
    .where(eq(mediaItemsTable.storeId, storeId))
    .orderBy(desc(mediaItemsTable.createdAt));
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

router.delete("/media/:id", requireAdmin, async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  await db.delete(mediaItemsTable).where(and(eq(mediaItemsTable.id, req.params.id as string), eq(mediaItemsTable.storeId, storeId)));
  return res.json({ ok: true });
});

// ── Users / Customers ─────────────────────────────────────────────────────────

router.get("/users", requireAdmin, async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const customers = await db.select()
    .from(usersTable)
    .where(and(
      eq(usersTable.storeId, storeId),
      ne(usersTable.role, "ADMIN"), 
      ne(usersTable.role, "SUPER_ADMIN")
    ))
    .orderBy(desc(usersTable.createdAt));
  return res.json(customers);
});

router.delete("/users/bulk", requireAdmin, async (req: TenantRequest, res: Response) => {
  const { ids } = req.body as { ids?: string[] };
  const storeId = req.storeId!;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No user IDs provided" });
  }
  try {
    await db.delete(usersTable).where(and(inArray(usersTable.id, ids), eq(usersTable.storeId, storeId)));
    return res.json({ success: true, message: `Deleted ${ids.length} users` });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.put("/users/bulk", requireAdmin, async (req: TenantRequest, res: Response) => {
  const { ids, role } = req.body as { ids?: string[], role?: string };
  const storeId = req.storeId!;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No user IDs provided" });
  }
  if (!role) {
    return res.status(400).json({ error: "No role provided to update" });
  }
  try {
    await db.update(usersTable)
      .set({ role })
      .where(and(inArray(usersTable.id, ids), eq(usersTable.storeId, storeId)));
    return res.json({ success: true, message: `Updated ${ids.length} users` });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.delete("/users/:id", requireAdmin, async (req: TenantRequest, res: Response) => {
  const userId = req.params.id as string;
  const storeId = req.storeId!;
  try {
    await db.delete(usersTable).where(and(eq(usersTable.id, userId), eq(usersTable.storeId, storeId)));
    return res.json({ success: true, message: "User deleted" });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ── Coupons ───────────────────────────────────────────────────────────────────

router.get("/coupons", requireAdmin, async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  return res.json(await db.select().from(couponsTable)
    .where(eq(couponsTable.storeId, storeId))
    .orderBy(desc(couponsTable.createdAt)));
});

router.post("/coupons", requireAdmin, async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const [coupon] = await db.insert(couponsTable).values({
    id: randomUUID(),
    storeId,
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
router.delete("/orders/bulk", requireAdmin, async (req: TenantRequest, res: Response) => {
  const { ids } = req.body as { ids?: string[] };
  const storeId = req.storeId!;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No order IDs provided" });
  }
  try {
    await db.delete(ordersTable).where(and(inArray(ordersTable.id, ids), eq(ordersTable.storeId, storeId)));
    return res.json({ success: true, message: `Deleted ${ids.length} orders` });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.put("/orders/bulk", requireAdmin, async (req: TenantRequest, res: Response) => {
  const { ids, status, paymentStatus } = req.body as { ids?: string[], status?: string, paymentStatus?: string };
  const storeId = req.storeId!;
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
    await db.update(ordersTable).set(updates).where(and(inArray(ordersTable.id, ids), eq(ordersTable.storeId, storeId)));
    return res.json({ success: true, message: `Updated ${ids.length} orders` });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.delete("/orders/:id", requireAdmin, async (req: TenantRequest, res: Response) => {
  const orderId = req.params.id as string;
  const storeId = req.storeId!;
  try {
    await db.delete(ordersTable).where(and(eq(ordersTable.id, orderId), eq(ordersTable.storeId, storeId)));
    return res.json({ success: true, message: "Order deleted" });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ── Showroom Locations API Endpoints ──────────────────────────────────────────

router.get("/showroom-locations", async (req: TenantRequest, res: Response) => {
  try {
    const storeId = req.storeId!;
    const locs = await db.select().from(showroomLocationsTable).where(and(eq(showroomLocationsTable.active, true), eq(showroomLocationsTable.storeId, storeId)));
    return res.json(locs);
  } catch (err) {
    console.error("Error fetching showroom locations:", err);
    return res.status(500).json({ error: "Failed to fetch showroom locations" });
  }
});

router.get("/admin/showroom-locations", requireAdmin, async (req: TenantRequest, res: Response) => {
  try {
    const storeId = req.storeId!;
    const locs = await db.select().from(showroomLocationsTable).where(eq(showroomLocationsTable.storeId, storeId)).orderBy(showroomLocationsTable.name);
    return res.json(locs);
  } catch (err) {
    console.error("Error fetching admin showroom locations:", err);
    return res.status(500).json({ error: "Failed to fetch showroom locations" });
  }
});

router.post("/admin/showroom-locations", requireAdmin, async (req: TenantRequest, res: Response) => {
  try {
    const storeId = req.storeId!;
    const { name, address, city, country, phone, email, hours, imageUrl, active } = req.body;
    if (!name || !address || !city || !country) {
      return res.status(400).json({ error: "Name, address, city, and country are required" });
    }
    const id = `loc-${randomUUID().slice(0, 8)}`;
    await db.insert(showroomLocationsTable).values({
      id,
      storeId,
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

router.put("/admin/showroom-locations/:id", requireAdmin, async (req: TenantRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const storeId = req.storeId!;
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
      .where(and(eq(showroomLocationsTable.id, id), eq(showroomLocationsTable.storeId, storeId)));
    return res.json({ success: true });
  } catch (err) {
    console.error("Error updating showroom location:", err);
    return res.status(500).json({ error: "Failed to update showroom location" });
  }
});

router.delete("/admin/showroom-locations/:id", requireAdmin, async (req: TenantRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const storeId = req.storeId!;
    await db.delete(showroomLocationsTable).where(and(eq(showroomLocationsTable.id, id), eq(showroomLocationsTable.storeId, storeId)));
    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting showroom location:", err);
    return res.status(500).json({ error: "Failed to delete showroom location" });
  }
});
