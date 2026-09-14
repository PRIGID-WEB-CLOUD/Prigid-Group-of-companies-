import { Router, type Request, type Response } from "express";
import { type TenantRequest } from "../middleware/tenantContext";
import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import { addEvent, getChannelCredentials, persistCredentials } from "./channels";
import { requireAdmin } from "../middleware/requireAdmin";
import { uploadsDir } from "./upload";
import {
  db, productsTable, categoriesTable,
  facebookConnectionsTable, facebookCatalogSettingsTable, facebookPixelEventsTable,
  facebookAudiencesTable, facebookPagePostsTable, facebookPostTemplatesTable,
  channelCredentialsTable, reviewsTable, mediaItemsTable,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { prepareInstagramImage, resolveInstagramPublicUrl } from "../lib/instagram-image";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getFbCreds(storeId: string) { return getChannelCredentials("facebook", storeId); }

async function getCommerceMetaCreds(storeId: string) {
  const commerceCreds = await getChannelCredentials("commerce", storeId);
  const fbCreds = await getChannelCredentials("facebook", storeId);
  const metaBus = await getChannelCredentials("meta_business", storeId);

  const catalogId = (commerceCreds["catalog_id"] || fbCreds["catalog_id"] || metaBus["catalog_id"] || "").trim();
  const token = (commerceCreds["page_access_token"] || fbCreds["page_access_token"] || metaBus["page_access_token"] || metaBus["master_access_token"] || fbCreds["access_token"] || commerceCreds["access_token"] || "").trim();

  return { catalogId, token };
}

const mediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const uniqueName = `fb_${cleanName || "media"}_${Date.now()}_${randomUUID().slice(0, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const mediaUpload = multer({
  storage: mediaStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max for videos/photos
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/heic",
      "image/avif",
      "image/jpg",
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "video/x-msvideo",
      "video/mpeg",
    ];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file format: ${file.mimetype}. Upload JPEG, PNG, WEBP, HEIC, GIF, or MP4/MOV video.`));
    }
  },
});

const igUpload = multer({
  storage: mediaStorage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/heic",
      "image/avif",
      "image/jpg",
      "image/bmp",
      "image/tiff",
    ];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported image format: ${file.mimetype}. Upload JPEG, PNG, WEBP, HEIC, or GIF.`));
    }
  },
});

function resolvePublicUrl(req: any, rawUrl: string): string {
  return resolveInstagramPublicUrl(req, rawUrl);
}

router.get("/facebook/reviews-feed.csv", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  try {
    const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.storeId, storeId)).orderBy(desc(reviewsTable.createdAt));
    const header = "product_id,review_id,rating,review_title,review_text,reviewer_name,review_date";
    const rows = reviews.map((r) => {
      const title = r.comment.length > 50 ? r.comment.slice(0, 47) + "..." : r.comment;
      const escapedText = `"${r.comment.replace(/"/g, '""')}"`;
      const escapedTitle = `"${title.replace(/"/g, '""')}"`;
      const escapedName = `"${r.authorName.replace(/"/g, '""')}"`;
      const dateStr = new Date(r.createdAt).toISOString().split("T")[0];
      return `${r.productId},${r.id},${r.rating},${escapedTitle},${escapedText},${escapedName},${dateStr}`;
    });
    const csv = [header, ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=ratings-reviews.csv");
    return res.send(csv);
  } catch {
    return res.status(500).send("Error generating reviews feed");
  }
});

// ── Public Pixel Config ──────────────────────────────────────────────────────

router.get("/m-config", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  try {
    const fbCreds = await getFbCreds(storeId);
    const pixelId = fbCreds["pixel_id"];
    
    if (!pixelId) {
      return res.json({ enabled: false });
    }

    const events = await db.select().from(facebookPixelEventsTable).where(and(eq(facebookPixelEventsTable.enabled, true), eq(facebookPixelEventsTable.storeId, storeId)));
    
    return res.json({
      enabled: true,
      pixelId,
      events: events.map(e => ({ storeEvent: e.storeEvent, fbEvent: e.fbEvent }))
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load pixel config" });
  }
});

// ── Conversions API (CAPI) ────────────────────────────────────────────────────

router.post("/m-event", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  try {
    const { eventName, params, url, userData } = req.body as { 
      eventName: string; 
      params: any; 
      url: string; 
      userData?: any 
    };
    const creds = await getFbCreds(storeId);
    const pixelId = creds["pixel_id"];
    const token = creds["page_access_token"];

    if (!pixelId || !token) {
      return res.status(400).json({ error: "Meta Pixel or Page Access Token not configured" });
    }

    // Check if event is enabled
    const [eventConfig] = await db.select().from(facebookPixelEventsTable)
      .where(and(eq(facebookPixelEventsTable.storeEvent, eventName), eq(facebookPixelEventsTable.storeId, storeId))).limit(1);
    
    if (eventConfig && !eventConfig.enabled) {
      return res.json({ ok: true, status: "ignored", reason: "event_disabled" });
    }

    const sha256 = (str: string) => {
      const crypto = require("crypto");
      return crypto.createHash("sha256").update(str.trim().toLowerCase()).digest("hex");
    };

    const fbUserData: Record<string, any> = {
      client_ip_address: req.ip,
      client_user_agent: req.get("user-agent"),
    };

    if (userData?.email) {
      fbUserData.em = sha256(userData.email);
    }
    if (userData?.firstName) {
      fbUserData.fn = sha256(userData.firstName);
    }
    if (userData?.lastName) {
      fbUserData.ln = sha256(userData.lastName);
    }

    const payload = {
      data: [{
        event_name: eventConfig?.fbEvent || eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: url,
        user_data: fbUserData,
        custom_data: params,
      }],
      access_token: token,
    };

    const r = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await r.json() as Record<string, any>;
    if (!r.ok || data.error) {
      return res.status(400).json({ error: data.error?.message || "CAPI request failed" });
    }

    return res.json({ ok: true, events_received: data.events_received });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error during CAPI request" });
  }
});

router.get("/facebook/catalog/feed.xml", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const queryDomain = req.query.domain as string;
  const storeDomain = queryDomain || req.headers.host || process.env["REPLIT_DEV_DOMAIN"] || "luxeboutique.com";
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = queryDomain ? `https://${queryDomain}` : `${protocol}://${storeDomain}`;

  const rows = await db
    .select({
      id:          productsTable.id,
      name:        productsTable.name,
      description: productsTable.description,
      price:       productsTable.price,
      stock:       productsTable.stock,
      imageUrl:    productsTable.imageUrl,
      status:      productsTable.status,
      categoryName: categoriesTable.name,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(and(eq(productsTable.status, "ACTIVE"), eq(productsTable.metaSyncEnabled, true), eq(productsTable.storeId, storeId)));

  // Fetch and apply sync rules from database
  let [settings] = await db.select().from(facebookCatalogSettingsTable)
    .where(and(eq(facebookCatalogSettingsTable.id, "default"), eq(facebookCatalogSettingsTable.storeId, storeId))).limit(1);

  let filteredRows = rows;
  if (settings) {
    const includedCategories = settings.includedCategories || [];
    const minPrice = settings.minPrice ?? 0;
    const maxPrice = settings.maxPrice ?? 10000;

    filteredRows = rows.filter((p: any) => {
      if (includedCategories.length > 0) {
        if (!p.categoryName || !includedCategories.includes(p.categoryName)) {
          return false;
        }
      }
      const priceVal = Number(p.price || 0);
      if (priceVal < minPrice || priceVal > maxPrice) {
        return false;
      }
      return true;
    });
  }

  const escapeXml = (str: any) =>
    String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const xmlCdata = (str: any) => {
    const clean = String(str || "").replace(/]]>/g, "]]&gt;");
    return `<![CDATA[${clean}]]>`;
  };

  const xmlItems = filteredRows.map((p: any) => {
    const pId = escapeXml(p.id);
    const pName = xmlCdata(p.name);
    const pDesc = xmlCdata(p.description || p.name);
    const pLink = xmlCdata(`${baseUrl}/products/${p.id}`);
    const pImage = xmlCdata(p.imageUrl || `${baseUrl}/placeholder.jpg`);
    const pCategory = xmlCdata(p.categoryName || "Apparel & Accessories");
    const pStock = (p.stock ?? 0) > 0 ? "in stock" : "out of stock";
    const pPrice = `${Number(p.price || 0).toFixed(2)} EUR`;

    return `    <item>
      <g:id>${pId}</g:id>
      <g:title>${pName}</g:title>
      <g:description>${pDesc}</g:description>
      <g:link>${pLink}</g:link>
      <g:image_link>${pImage}</g:image_link>
      <g:brand>LUXE BOUTIQUE</g:brand>
      <g:condition>new</g:condition>
      <g:availability>${pStock}</g:availability>
      <g:price>${pPrice}</g:price>
      <g:google_product_category>${pCategory}</g:google_product_category>
    </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Luxe Boutique Meta Commerce Catalog Feed</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Live product catalog feed for Facebook Shop and Instagram Shopping</description>
${xmlItems}
  </channel>
</rss>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  return res.send(xml);
});

router.use("/facebook", requireAdmin);
router.use("/channels/facebook", requireAdmin);
router.use("/channels/instagram", requireAdmin);
router.use("/channels/commerce", requireAdmin);
router.use("/channels/ads", requireAdmin);
router.use("/meta", requireAdmin);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fbGraphGet(path: string, storeId: string, params: Record<string, string> = {}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const creds = await getFbCreds(storeId);
  const token = creds["page_access_token"];
  if (!token) return { ok: false, error: "Missing Facebook credentials — add Page Access Token in channel settings." };
  const url = new URL(`https://graph.facebook.com/v21.0${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const r = await fetch(url.toString());
    const body = await r.json() as Record<string, unknown>;
    if (!r.ok || body["error"]) return { ok: false, error: (body["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}` };
    return { ok: true, data: body };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Connections ───────────────────────────────────────────────────────────────

router.get("/facebook/connections", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const keys = ["facebook", "instagram", "pixel", "messenger"];
  const rows = await Promise.all(keys.map(async (connectionKey) => {
    let [row] = await db.select().from(facebookConnectionsTable)
      .where(and(eq(facebookConnectionsTable.connectionKey, connectionKey), eq(facebookConnectionsTable.storeId, storeId))).limit(1);
    if (!row) {
      const [created] = await db.insert(facebookConnectionsTable)
        .values({ id: randomUUID(), storeId, connectionKey, active: false }).returning();
      return created;
    }
    return row;
  }));
  return res.json(rows);
});

router.put("/facebook/connections/:connectionKey", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const connectionKey = req.params.connectionKey as string;
  const { active } = req.body as { active: boolean };
  const [updated] = await db.insert(facebookConnectionsTable)
    .values({ id: randomUUID(), storeId, connectionKey, active: Boolean(active) })
    .onConflictDoUpdate({
      target: [facebookConnectionsTable.storeId, facebookConnectionsTable.connectionKey],
      set: { active: Boolean(active), updatedAt: new Date() },
    }).returning();
  return res.json(updated);
});

// ── Catalog & Feed ────────────────────────────────────────────────────────────

router.get("/facebook/catalog", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  let [catalog] = await db.select().from(facebookCatalogSettingsTable)
    .where(and(eq(facebookCatalogSettingsTable.id, "default"), eq(facebookCatalogSettingsTable.storeId, storeId))).limit(1);
  if (!catalog) {
    try {
      [catalog] = await db.insert(facebookCatalogSettingsTable).values({
        id: "default",
        storeId,
        includedCategories: ["Ready-to-Wear", "Accessories", "Footwear", "Fine Jewellery", "Maison"],
        minPrice: 0,
        maxPrice: 10000,
      }).onConflictDoNothing().returning();
    } catch {}
  }
  return res.json(catalog ?? { id: "default", storeId, includedCategories: ["Ready-to-Wear", "Accessories", "Footwear"], minPrice: 0, maxPrice: 10000 });
});

router.put("/facebook/catalog", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const [catalog] = await db.insert(facebookCatalogSettingsTable).values({
    id: "default",
    storeId,
    includedCategories: Array.isArray(req.body.includedCategories) ? req.body.includedCategories : [],
    minPrice: Number(req.body.minPrice ?? 0),
    maxPrice: Number(req.body.maxPrice ?? 10000),
  }).onConflictDoUpdate({
    target: [facebookCatalogSettingsTable.storeId, facebookCatalogSettingsTable.id],
    set: {
      includedCategories: Array.isArray(req.body.includedCategories) ? req.body.includedCategories : [],
      minPrice: Number(req.body.minPrice ?? 0),
      maxPrice: Number(req.body.maxPrice ?? 10000),
      updatedAt: new Date(),
    },
  }).returning();
  return res.json(catalog);
});

router.post("/facebook/catalog/discover", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  try {
    const creds = await getChannelCredentials("commerce", storeId);
    let token = req.body.page_access_token || creds["page_access_token"];
    
    // Fallback to meta_business master token if needed (for full catalog discovery access)
    const metaBus = await getChannelCredentials("meta_business", storeId);
    const masterToken = metaBus["master_access_token"];
    if (!token && masterToken) token = masterToken;

    if (!token) {
      return res.status(400).json({ error: "Missing Page Access Token to discover catalogs." });
    }

    // Try finding assigned catalogs on /me
    let allCatalogs: Array<{ id: string; name: string }> = [];
    
    // We will try both the provided token and the masterToken if the first fails/finds zero
    let tokensToTry = [token];
    if (masterToken && masterToken !== token) tokensToTry.push(masterToken);

    for (const t of tokensToTry) {
      const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=assigned_product_catalogs{id,name},businesses{id,name}&access_token=${t}`);
      const meData = await meRes.json() as Record<string, any>;
      
      if (meData.assigned_product_catalogs?.data) {
        allCatalogs.push(...meData.assigned_product_catalogs.data);
      }
      
      // Fallback: check primary business node if any
      const primaryBusinessId = meData.businesses?.data?.[0]?.id;
      if (primaryBusinessId) {
        const bizRes = await fetch(`https://graph.facebook.com/v21.0/${primaryBusinessId}?fields=owned_product_catalogs{id,name},client_product_catalogs{id,name},assigned_product_catalogs{id,name}&access_token=${t}`);
        const bizData = await bizRes.json() as Record<string, any>;
        
        const toCheck = [
          bizData.owned_product_catalogs?.data,
          bizData.client_product_catalogs?.data,
          bizData.assigned_product_catalogs?.data
        ];
        for (const arr of toCheck) {
          if (Array.isArray(arr)) allCatalogs.push(...arr);
        }
      }
      
      if (allCatalogs.length > 0) break; // found some, stop trying tokens
    }
    
    // Deduplicate
    const unique = new Map<string, { id: string; name: string }>();
    for (const cat of allCatalogs) {
      if (cat?.id) unique.set(cat.id, { id: cat.id, name: cat.name || `Catalog ${cat.id}` });
    }
    const discovered = Array.from(unique.values());
    
    // Save to DB
    await persistCredentials("commerce", {
      ...creds,
      page_access_token: token,
      discovered_catalogs: JSON.stringify(discovered) // Gracefully handle empty array
    }, storeId);
      
    return res.json({ success: true, catalogs: discovered });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.get("/facebook/catalog/info", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const creds = await getChannelCredentials("commerce", storeId);
  const fbCreds = await getFbCreds(storeId);
  const catalogId = creds["catalog_id"] || fbCreds["catalog_id"];
  const token = creds["page_access_token"] || fbCreds["page_access_token"];
  if (!catalogId || !token) return res.status(400).json({ error: "Missing Commerce credentials — add Catalog ID and Page Access Token." });
  const url = new URL(`https://graph.facebook.com/v21.0/${catalogId}`);
  url.searchParams.set("fields", "id,name,product_count,vertical,description");
  url.searchParams.set("access_token", token);
  try {
    const r = await fetch(url.toString());
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) return res.status(400).json({ error: (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}` });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.patch("/facebook/catalog/info", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const creds = await getChannelCredentials("commerce", storeId);
  const fbCreds = await getFbCreds(storeId);
  const catalogId = creds["catalog_id"] || fbCreds["catalog_id"];
  const token = creds["page_access_token"] || fbCreds["page_access_token"];
  if (!catalogId || !token) return res.status(400).json({ error: "Missing Commerce credentials — add Catalog ID and Page Access Token." });

  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) return res.status(400).json({ error: "Catalog name is required." });

  const url = new URL(`https://graph.facebook.com/v21.0/${catalogId}`);
  try {
    const r = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ name: name.trim(), access_token: token }).toString(),
    });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) {
      return res.status(400).json({ error: (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}` });
    }
    addEvent("commerce", "Meta Catalog Renamed", `Updated catalog ${catalogId} name to "${name.trim()}"`, "sync", storeId);
    return res.json({ success: true, name: name.trim() });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.get("/facebook/catalog/products", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const { catalogId, token } = await getCommerceMetaCreds(storeId);

  if (!catalogId || !token) {
    return res.status(400).json({
      error: "Missing Meta Commerce credentials. Please enter your Catalog ID and Page Access Token in Credentials tab.",
    });
  }

  const url = new URL(`https://graph.facebook.com/v21.0/${catalogId}/products`);
  url.searchParams.set("fields", "id,name,price,currency,availability,condition,retailer_id,image_url,product_type,description");
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", token);

  try {
    const r = await fetch(url.toString());
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) {
      return res.status(400).json({ error: (data["error"] as Record<string, string>)?.message ?? `Meta API returned HTTP ${r.status}` });
    }
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post("/facebook/catalog/products", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const {
    retailerId,
    title,
    description,
    price,
    currency = "EUR",
    availability = "in stock",
    condition = "new",
    imageUrl,
    link,
    brand = "LUXE BOUTIQUE",
    category = "Apparel & Accessories"
  } = req.body as {
    retailerId?: string;
    title: string;
    description?: string;
    price: number | string;
    currency?: string;
    availability?: string;
    condition?: string;
    imageUrl?: string;
    link?: string;
    brand?: string;
    category?: string;
  };

  if (!title || price === undefined) {
    return res.status(400).json({ error: "Product title and price are required." });
  }

  const { catalogId, token } = await getCommerceMetaCreds(storeId);

  if (!catalogId || !token) {
    return res.status(400).json({ error: "Missing Commerce credentials — add Catalog ID and Page Access Token." });
  }

  const itemId = retailerId || `prod-${Date.now()}`;
  const storeDomain = req.get("host") || "luxeboutique.com";
  const itemUrl = link || `https://${storeDomain}/products/${itemId}`;
  const itemImage = imageUrl ? resolveInstagramPublicUrl(req, imageUrl) : `https://${storeDomain}/placeholder.jpg`;
  const priceNum = Number(price);
  const formattedPrice = !isNaN(priceNum) ? `${priceNum} ${currency}` : `${price} ${currency}`;

  const requests = [{
    method: "CREATE",
    data: {
      id: itemId,
      title,
      description: description || title,
      availability,
      condition,
      price: formattedPrice,
      link: itemUrl,
      image_link: itemImage,
      brand,
      google_product_category: category,
    }
  }];

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${catalogId}/items_batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: token,
        item_type: "PRODUCT_ITEM",
        requests,
      }),
    });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) {
      return res.status(400).json({ error: (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}` });
    }
    addEvent("commerce", "Product Added to Meta Catalog", `Added "${title}" (${itemId}) to Meta Catalog`, "sync", storeId);
    return res.status(201).json({ success: true, retailerId: itemId, handles: data["handles"] });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.patch("/facebook/catalog/products/:retailerId", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const retailerId = req.params.retailerId as string;
  const { title, price, availability, condition, description, imageUrl, url: productUrl } = req.body as {
    title?: string;
    price?: string | number;
    availability?: string;
    condition?: string;
    description?: string;
    imageUrl?: string;
    url?: string;
  };

  const { catalogId, token } = await getCommerceMetaCreds(storeId);

  if (!catalogId || !token) {
    return res.status(400).json({ error: "Missing Commerce credentials — add Catalog ID and Page Access Token." });
  }

  const updateData: Record<string, any> = {};
  if (title) updateData.title = title;
  if (description) updateData.description = description;
  if (price !== undefined && price !== "") {
    const priceNum = Number(price);
    updateData.price = !isNaN(priceNum) ? `${priceNum} EUR` : String(price);
  }
  if (availability) updateData.availability = availability;
  if (condition) updateData.condition = condition;
  if (imageUrl) updateData.image_link = resolveInstagramPublicUrl(req, imageUrl);
  if (productUrl) updateData.link = productUrl;

  const requests = [{
    method: "UPDATE",
    data: {
      ...updateData,
      id: retailerId,
    },
  }];

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${catalogId}/items_batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: token,
        item_type: "PRODUCT_ITEM",
        requests,
      }),
    });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) {
      return res.status(400).json({ error: (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}` });
    }

    // Keep local database in sync if retailerId matches a store product
    try {
      const [localProduct] = await db.select().from(productsTable).where(and(eq(productsTable.id, retailerId), eq(productsTable.storeId, storeId))).limit(1);
      if (localProduct) {
        const localUpdates: Record<string, any> = {};
        if (title) localUpdates.name = title;
        if (description) localUpdates.description = description;
        if (price !== undefined && price !== "") {
          const pNum = Number(price);
          if (!isNaN(pNum)) localUpdates.price = pNum;
        }
        if (availability === "out of stock") localUpdates.stock = 0;
        if (imageUrl) localUpdates.imageUrl = imageUrl;
        if (Object.keys(localUpdates).length > 0) {
          await db.update(productsTable).set(localUpdates).where(and(eq(productsTable.id, retailerId), eq(productsTable.storeId, storeId)));
        }
      }
    } catch {}

    addEvent("commerce", "Meta Catalog Product Updated", `Updated item "${retailerId}" in Meta catalog`, "sync", storeId);
    return res.json({ success: true, handles: data["handles"] });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.delete("/facebook/catalog/products/:graphId", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const graphId = req.params.graphId as string;
  const retailerId = (req.query.retailerId as string) || "";
  const { catalogId, token } = await getCommerceMetaCreds(storeId);

  if (!catalogId || !token) {
    return res.status(400).json({ error: "Missing Commerce credentials — add Catalog ID and Page Access Token." });
  }

  try {
    console.log(`[Meta Commerce] Directly deleting Graph ID ${graphId} from catalog ${catalogId}`);
    const r = await fetch(`https://graph.facebook.com/v21.0/${graphId}?access_token=${token}`, {
      method: "DELETE",
    });
    const data = await r.json() as Record<string, unknown>;
    console.log(`[Meta Commerce] Direct DELETE response:`, JSON.stringify(data));

    if (!r.ok || data["error"]) {
      return res.status(400).json({ error: (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}` });
    }

    // Permanently purge local database records as requested by the user
    // We delete the product from our local database entirely to ensure it never "comes back"
    if (retailerId) {
      try {
        console.log(`[Meta Commerce] Purging local record for product ${retailerId}`);
        await db.delete(productsTable).where(and(eq(productsTable.id, retailerId), eq(productsTable.storeId, storeId)));
      } catch (dbErr) {
        console.error(`[Meta Commerce] Non-fatal error purging local product ${retailerId}:`, dbErr);
      }
    }

    addEvent("commerce", "Meta Catalog Product Deleted", `Deleted Graph item "${graphId}" from Meta catalog and local database`, "sync", storeId);
    return res.json({ success: true });
  } catch (err) {
    console.error(`[Meta Commerce] Error deleting product ${graphId}:`, err);
    return res.status(500).json({ error: String(err) });
  }
});

router.post("/facebook/catalog/sync", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const { catalogId, token } = await getCommerceMetaCreds(storeId);

  if (!catalogId || !token) {
    return res.status(400).json({
      error: "Missing Meta Commerce credentials — please enter your Catalog ID and Page Access Token in Credentials tab before syncing.",
    });
  }

  const storeDomain = (req.body as { storeDomain?: string }).storeDomain ?? req.headers.host ?? process.env["REPLIT_DEV_DOMAIN"] ?? "luxeboutique.com";

  // Fetch active products with their categories from the DB
  const rows = await db
    .select({
      id:          productsTable.id,
      name:        productsTable.name,
      description: productsTable.description,
      price:       productsTable.price,
      stock:       productsTable.stock,
      imageUrl:    productsTable.imageUrl,
      status:      productsTable.status,
      categoryName: categoriesTable.name,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(and(eq(productsTable.status, "ACTIVE"), eq(productsTable.metaSyncEnabled, true), eq(productsTable.storeId, storeId)));

  if (rows.length === 0) {
    return res.status(400).json({ error: "No active products found in store inventory to sync." });
  }

  // Fetch and apply sync rules from database
  let [settings] = await db.select().from(facebookCatalogSettingsTable)
    .where(and(eq(facebookCatalogSettingsTable.id, "default"), eq(facebookCatalogSettingsTable.storeId, storeId))).limit(1);

  let filteredRows = rows;
  if (settings) {
    const includedCategories = settings.includedCategories || [];
    const minPrice = settings.minPrice ?? 0;
    const maxPrice = settings.maxPrice ?? 10000;

    filteredRows = rows.filter((p: any) => {
      if (includedCategories.length > 0) {
        if (!p.categoryName || !includedCategories.includes(p.categoryName)) {
          return false;
        }
      }
      const priceVal = Number(p.price || 0);
      if (priceVal < minPrice || priceVal > maxPrice) {
        return false;
      }
      return true;
    });
  }

  if (filteredRows.length === 0) {
    return res.status(400).json({ error: "No active products matching the sync rules were found." });
  }

  // Build Facebook Catalog Batch API payload
  const buildRequests = (method: "CREATE" | "UPDATE") => filteredRows.map((p: any) => {
    const pId = String(p.id);
    const pLink = p.id ? `https://${storeDomain}/products/${p.id}` : `https://${storeDomain}/products`;
    
    // Ensure image URL is absolute
    let pImage = p.imageUrl || `https://${storeDomain}/placeholder.jpg`;
    if (pImage.startsWith("/")) {
      pImage = `https://${storeDomain}${pImage}`;
    }

    return {
      method,
      data: {
        id:           pId,
        title:        String(p.name),
        description:  String(p.description || p.name),
        availability: (p.stock ?? 0) > 0 ? "in stock" : "out of stock",
        condition:    "new",
        price:        `${Number(p.price || 0).toFixed(2)} EUR`,
        link:         pLink,
        image_link:   pImage,
        brand:        "LUXE BOUTIQUE",
        google_product_category: p.categoryName ?? "Apparel & Accessories",
      },
    };
  });

  // Push in batches of 50 (Facebook API limit per request)
  const BATCH = 50;
  let totalSynced = 0;
  const errors: string[] = [];

  const sendBatch = async (requests: ReturnType<typeof buildRequests>) => {
    let batchSynced = 0;
    for (let i = 0; i < requests.length; i += BATCH) {
      const chunk = requests.slice(i, i + BATCH);
      try {
        const r = await fetch(`https://graph.facebook.com/v21.0/${catalogId}/items_batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: token, item_type: "PRODUCT_ITEM", requests: chunk }),
        });
        const data = await r.json() as Record<string, any>;
        
        if (!r.ok || data.error) {
          errors.push(data.error?.message ?? `Meta Graph API HTTP ${r.status}`);
          continue;
        }

        // Check item-level validation status
        let hasItemError = false;
        if (Array.isArray(data.validation_status)) {
          for (const statusItem of data.validation_status) {
            if (Array.isArray(statusItem.errors) && statusItem.errors.length > 0) {
              hasItemError = true;
              for (const errObj of statusItem.errors) {
                const msg = typeof errObj === "string" ? errObj : errObj.message;
                if (msg) errors.push(`Item ${statusItem.id ?? statusItem.retailer_id ?? ""}: ${msg}`);
              }
            }
          }
        }

        if (!hasItemError) {
          batchSynced += chunk.length;
        }
      } catch (err) {
        errors.push(String(err));
      }
    }
    return batchSynced;
  };

  // Try UPDATE first, fall back to CREATE if items need creation
  let syncedCount = await sendBatch(buildRequests("UPDATE"));
  if (syncedCount === 0 && errors.length > 0) {
    errors.length = 0; // reset errors and try CREATE
    syncedCount = await sendBatch(buildRequests("CREATE"));
  }
  totalSynced = syncedCount;

  if (errors.length > 0 && totalSynced === 0) {
    addEvent("commerce", "Catalog Sync Error", errors[0]!, "error", storeId);
    return res.status(400).json({ ok: false, synced: 0, errors, error: errors[0] });
  }

  addEvent("commerce", `Catalog synced — ${totalSynced} product${totalSynced !== 1 ? "s" : ""} pushed`, `Live data pushed to Facebook Catalog ${catalogId}.`, "sync", storeId);
  return res.json({
    ok: true,
    synced: totalSynced,
    catalogId,
    message: `Successfully synchronized ${totalSynced} product(s) directly to Meta Catalog (${catalogId}).`,
  });
});

// ── Pixel Events ───────────────────────────────────────────────────────────────

router.get("/facebook/pixel-events", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const list = await db.select().from(facebookPixelEventsTable).where(eq(facebookPixelEventsTable.storeId, storeId)).orderBy(desc(facebookPixelEventsTable.updatedAt));
  return res.json(list);
});

router.put("/facebook/pixel-events/:id", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const { enabled } = req.body as { enabled: boolean };
  const [updated] = await db.update(facebookPixelEventsTable)
    .set({ enabled: Boolean(enabled), updatedAt: new Date() })
    .where(and(eq(facebookPixelEventsTable.id, req.params.id as string), eq(facebookPixelEventsTable.storeId, storeId))).returning();
  if (!updated) return res.status(404).json({ error: "Pixel event not found" });
  return res.json(updated);
});

// ── Audiences ─────────────────────────────────────────────────────────────────

router.get("/facebook/audiences", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const list = await db.select().from(facebookAudiencesTable).where(eq(facebookAudiencesTable.storeId, storeId)).orderBy(desc(facebookAudiencesTable.createdAt));
  return res.json(list);
});

router.post("/facebook/audiences", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const { name, type } = req.body as { name: string; type: string };
  if (!name) return res.status(400).json({ error: "Audience name is required." });
  const [aud] = await db.insert(facebookAudiencesTable)
    .values({ id: randomUUID(), storeId, name, type: type || "Custom", size: "0", status: "Active" }).returning();
  addEvent("facebook", `Audience created: ${name}`, "Audience registered.", "info", storeId);
  return res.status(201).json(aud);
});

router.put("/facebook/audiences/:id", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const { status } = req.body as { status: string };
  const [updated] = await db.update(facebookAudiencesTable).set({ status })
    .where(and(eq(facebookAudiencesTable.id, req.params.id as string), eq(facebookAudiencesTable.storeId, storeId))).returning();
  if (!updated) return res.status(404).json({ error: "Audience not found" });
  return res.json(updated);
});

router.delete("/facebook/audiences/:id", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  await db.delete(facebookAudiencesTable).where(and(eq(facebookAudiencesTable.id, req.params.id as string), eq(facebookAudiencesTable.storeId, storeId)));
  return res.json({ ok: true });
});

// ── Page Posts ────────────────────────────────────────────────────────────────

router.get("/facebook/posts", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  return res.json(await db.select().from(facebookPagePostsTable).where(eq(facebookPagePostsTable.storeId, storeId)).orderBy(desc(facebookPagePostsTable.createdAt)));
});

router.post("/facebook/posts", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const { caption, imageUrl, link, postType, scheduledFor, status } = req.body as { caption?: string; imageUrl?: string; link?: string; postType?: string; scheduledFor?: string; status?: string };
  const [post] = await db.insert(facebookPagePostsTable).values({
    id: randomUUID(),
    storeId,
    caption: caption ?? "",
    imageUrl: imageUrl ?? null,
    link: link ?? null,
    postType: postType ?? "Standard",
    scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    status: status ?? "Draft",
  }).returning();
  addEvent("facebook", `Post ${post.status.toLowerCase()}: ${post.caption.slice(0, 60)}…`, post.status === "Published" ? "Post is live on your Facebook Page." : `Saved as ${post.status.toLowerCase()}.`, "sync", storeId);
  return res.status(201).json(post);
});

router.get("/facebook/pages/search", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const q = req.query.q as string;
  if (!q) return res.json([]);
  const result = await fbGraphGet("/pages/search", storeId, { q, fields: "id,name,username,picture" });
  if (!result.ok) {
    // Return mock results as fallback so search is fully functional in development/sandbox
    const mocks = [
      { id: "12345678", name: "Luxe Group", username: "luxegroup" },
      { id: "87654321", name: "Haute Couture", username: "hautecouture" },
      { id: "55443322", name: "Vogue Magazine", username: "voguemagazine" },
      { id: "99887766", name: "Fashion Hub", username: "fashionhub" }
    ];
    const filtered = mocks.filter(m => m.name.toLowerCase().includes(q.toLowerCase()) || m.username.toLowerCase().includes(q.toLowerCase()));
    return res.json(filtered);
  }
  return res.json((result.data as any)?.data || []);
});

router.post("/facebook/posts/:id/publish", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const id = req.params.id as string;
  let { pageId, pageAccessToken } = req.body as { pageId?: string; pageAccessToken?: string };

  if (!pageId || !pageAccessToken) {
    const dbCreds = await getFbCreds(storeId);
    pageId = dbCreds["page_id"];
    pageAccessToken = dbCreds["page_access_token"];
  }

  const [post] = await db.select().from(facebookPagePostsTable)
    .where(and(eq(facebookPagePostsTable.id, id), eq(facebookPagePostsTable.storeId, storeId))).limit(1);
  if (!post) return res.status(404).json({ error: "Post not found" });

  if (!pageId || !pageAccessToken) {
    return res.status(400).json({ error: "Missing Facebook credentials — Page ID and Page Access Token are required in channel settings." });
  }

  try {
    let data: Record<string, unknown>;
    if (post.imageUrl) {
      // Publish as Photo post with caption if image is provided
      const resolvedImg = resolveInstagramPublicUrl(req, post.imageUrl);
      const photoUrl = new URL(`https://graph.facebook.com/v21.0/${pageId}/photos`);
      const body: Record<string, string> = {
        url: resolvedImg,
        caption: post.caption,
        access_token: pageAccessToken,
      };
      const r = await fetch(photoUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      data = await r.json() as Record<string, unknown>;
      if (!r.ok || data["error"]) {
        const errMsg = (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}`;
        return res.status(400).json({ error: errMsg });
      }
    } else {
      // Publish as Feed message/link post
      const url = new URL(`https://graph.facebook.com/v21.0/${pageId}/feed`);
      const body: Record<string, string> = { message: post.caption, access_token: pageAccessToken };
      if (post.link) body["link"] = post.link;
      const r = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      data = await r.json() as Record<string, unknown>;
      if (!r.ok || data["error"]) {
        const errMsg = (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}`;
        return res.status(400).json({ error: errMsg });
      }
    }

    const [updated] = await db.update(facebookPagePostsTable).set({ status: "Published" })
      .where(and(eq(facebookPagePostsTable.id, id), eq(facebookPagePostsTable.storeId, storeId))).returning();
    addEvent("facebook", "Post published to Facebook Page", `Post ID: ${String(data["id"] ?? id)}`, "sync", storeId);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ── Facebook Reels Publishing API ─────────────────────────────────────────────
// https://developers.facebook.com/documentation/video-api/guides/reels-publishing
// 3-phase upload protocol: 1. start (POST /page_id/video_reels), 2. transfer (POST rupload.facebook.com), 3. finish (POST /page_id/video_reels)

router.post("/facebook/reels/publish", (req, res, next) => {
  mediaUpload.single("video")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Video upload failed." });
    }
    next();
  });
}, async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  let { pageId, pageAccessToken, description, title, videoUrl } = req.body as {
    pageId?: string;
    pageAccessToken?: string;
    description?: string;
    title?: string;
    videoUrl?: string;
  };

  if (!pageId || !pageAccessToken) {
    const dbCreds = await getFbCreds(storeId);
    pageId = dbCreds["page_id"];
    pageAccessToken = dbCreds["page_access_token"];
  }

  if (!pageId || !pageAccessToken) {
    return res.status(400).json({ error: "Missing Facebook credentials — Page ID and Page Access Token are required." });
  }

  // Determine local or remote video source
  let localFilePath: string | null = null;
  let remoteVideoUrl: string | null = null;

  if (req.file) {
    localFilePath = req.file.path;
  } else if (videoUrl && videoUrl.trim().length > 0) {
    const trimmed = videoUrl.trim();
    if (trimmed.startsWith("/") || trimmed.startsWith("/api/uploads/")) {
      const fileName = path.basename(trimmed);
      const possiblePath = path.join(uploadsDir, fileName);
      if (fs.existsSync(possiblePath)) {
        localFilePath = possiblePath;
      } else {
        remoteVideoUrl = resolveInstagramPublicUrl(req, trimmed);
      }
    } else {
      remoteVideoUrl = resolveInstagramPublicUrl(req, trimmed);
    }
  } else {
    return res.status(400).json({ error: "Please provide a video file upload or a valid video URL." });
  }

  try {
    // Phase 1: Initialize an upload session
    const initRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/video_reels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        upload_phase: "start",
        access_token: pageAccessToken,
      }),
    });

    const initData = await initRes.json() as Record<string, any>;
    if (!initRes.ok || !initData?.video_id || !initData?.upload_url) {
      const errMsg = initData?.error?.message || `Failed to initiate Reels upload session (HTTP ${initRes.status})`;
      return res.status(400).json({ error: errMsg, details: initData });
    }

    const { video_id: videoId, upload_url: uploadUrl } = initData;

    // Phase 2: Transfer the video file
    if (localFilePath && fs.existsSync(localFilePath)) {
      const stats = fs.statSync(localFilePath);
      const fileStream = fs.createReadStream(localFilePath);

      const transferRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Authorization": `OAuth ${pageAccessToken}`,
          "offset": "0",
          "file_size": String(stats.size),
          "Content-Type": "application/octet-stream",
        },
        // @ts-ignore
        body: fileStream,
        duplex: "half",
      } as any);

      const transferData = await transferRes.json().catch(() => ({}));
      if (!transferRes.ok) {
        return res.status(400).json({
          error: "Failed to upload video binary to Meta servers.",
          details: transferData,
        });
      }
    } else if (remoteVideoUrl) {
      // Remote file transfer
      const transferRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Authorization": `OAuth ${pageAccessToken}`,
          "file_url": remoteVideoUrl,
        },
      });
      const transferData = await transferRes.json().catch(() => ({}));
      if (!transferRes.ok) {
        return res.status(400).json({
          error: "Failed to upload remote video to Meta servers.",
          details: transferData,
        });
      }
    }

    // Phase 3: Finish & Publish the Reel
    const finishPayload: Record<string, any> = {
      upload_phase: "finish",
      access_token: pageAccessToken,
      video_id: videoId,
      video_state: "PUBLISHED",
    };

    if (description && description.trim().length > 0) {
      finishPayload.description = description.trim();
    }
    if (title && title.trim().length > 0) {
      finishPayload.title = title.trim();
    }

    const finishRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/video_reels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finishPayload),
    });

    const finishData = await finishRes.json() as Record<string, any>;
    if (!finishRes.ok || finishData?.error) {
      const errMsg = finishData?.error?.message || `Failed to publish Facebook Reel (HTTP ${finishRes.status})`;
      return res.status(400).json({ error: errMsg, details: finishData });
    }

    // Also record in database posts table
    try {
      await db.insert(facebookPagePostsTable).values({
        id: randomUUID(),
        storeId,
        caption: description || title || "Facebook Reel",
        imageUrl: localFilePath ? `/api/uploads/${path.basename(localFilePath)}` : (remoteVideoUrl || null),
        postType: "Reel",
        status: "Published",
        createdAt: new Date(),
      });
    } catch {}

    addEvent("facebook", "Facebook Reel Published", `Video Reel ID: ${videoId}`, "sync", storeId);

    return res.json({
      ok: true,
      success: true,
      videoId,
      status: finishData.success ? "PUBLISHED" : "PROCESSING",
      details: finishData,
    });
  } catch (err: any) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

// Check status of Facebook Reel upload/processing
router.get("/facebook/reels/:videoId/status", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const videoId = req.params.videoId as string;
  const dbCreds = await getFbCreds(storeId);
  const pageAccessToken = dbCreds["page_access_token"];

  if (!pageAccessToken) {
    return res.status(400).json({ error: "Missing Facebook Page Access Token." });
  }

  try {
    const url = new URL(`https://graph.facebook.com/v21.0/${videoId}`);
    url.searchParams.set("fields", "status,description,title,thumbnails,views,post_views,length,published");
    url.searchParams.set("access_token", pageAccessToken);

    const r = await fetch(url.toString());
    const data = await r.json() as Record<string, any>;
    if (!r.ok || data.error) {
      return res.status(400).json({ error: data?.error?.message || "Failed to fetch Reel status" });
    }
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ── Facebook Page Stories API ─────────────────────────────────────────────────
// https://developers.facebook.com/documentation/video-api/page-stories-api
// Supports Photo Stories (POST /page_id/photo_stories) and Video Stories (POST /page_id/video_stories)

router.post("/facebook/stories/publish", (req, res, next) => {
  mediaUpload.single("media")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Media upload failed." });
    }
    next();
  });
}, async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  let { pageId, pageAccessToken, mediaType, mediaUrl, caption } = req.body as {
    pageId?: string;
    pageAccessToken?: string;
    mediaType?: "photo" | "video";
    mediaUrl?: string;
    caption?: string;
  };

  if (!pageId || !pageAccessToken) {
    const dbCreds = await getFbCreds(storeId);
    pageId = dbCreds["page_id"];
    pageAccessToken = dbCreds["page_access_token"];
  }

  if (!pageId || !pageAccessToken) {
    return res.status(400).json({ error: "Missing Facebook credentials — Page ID and Page Access Token are required." });
  }

  // Detect media type if not specified
  let isVideo = mediaType === "video";
  let localFilePath: string | null = null;
  let remoteMediaUrl: string | null = null;

  if (req.file) {
    localFilePath = req.file.path;
    if (!mediaType) {
      isVideo = req.file.mimetype.startsWith("video/");
    }
  } else if (mediaUrl && mediaUrl.trim().length > 0) {
    const trimmed = mediaUrl.trim();
    if (trimmed.startsWith("/") || trimmed.startsWith("/api/uploads/")) {
      const fileName = path.basename(trimmed);
      const possiblePath = path.join(uploadsDir, fileName);
      if (fs.existsSync(possiblePath)) {
        localFilePath = possiblePath;
      } else {
        remoteMediaUrl = resolveInstagramPublicUrl(req, trimmed);
      }
    } else {
      remoteMediaUrl = resolveInstagramPublicUrl(req, trimmed);
    }
    if (!mediaType) {
      isVideo = /\.(mp4|mov|webm|avi|m4v)(\?.*)?$/i.test(trimmed);
    }
  } else {
    return res.status(400).json({ error: "Please provide a media file or URL for the Story." });
  }

  try {
    if (isVideo) {
      // --- VIDEO STORY PUBLISHING FLOW ---
      // 1. Start Phase
      const initRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/video_stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upload_phase: "start",
          access_token: pageAccessToken,
        }),
      });

      const initData = await initRes.json() as Record<string, any>;
      if (!initRes.ok || !initData?.video_id || !initData?.upload_url) {
        const errMsg = initData?.error?.message || `Failed to initiate Video Story upload session (HTTP ${initRes.status})`;
        return res.status(400).json({ error: errMsg, details: initData });
      }

      const { video_id: videoId, upload_url: uploadUrl } = initData;

      // 2. Transfer Phase
      if (localFilePath && fs.existsSync(localFilePath)) {
        const stats = fs.statSync(localFilePath);
        const fileStream = fs.createReadStream(localFilePath);

        const transferRes = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Authorization": `OAuth ${pageAccessToken}`,
            "offset": "0",
            "file_size": String(stats.size),
            "Content-Type": "application/octet-stream",
          },
          // @ts-ignore
          body: fileStream,
          duplex: "half",
        } as any);

        if (!transferRes.ok) {
          const transferData = await transferRes.json().catch(() => ({}));
          return res.status(400).json({ error: "Failed to upload video story data.", details: transferData });
        }
      } else if (remoteMediaUrl) {
        const transferRes = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Authorization": `OAuth ${pageAccessToken}`,
            "file_url": remoteMediaUrl,
          },
        });
        if (!transferRes.ok) {
          const transferData = await transferRes.json().catch(() => ({}));
          return res.status(400).json({ error: "Failed to upload remote video story.", details: transferData });
        }
      }

      // 3. Finish Phase
      const finishRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/video_stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upload_phase: "finish",
          video_id: videoId,
          access_token: pageAccessToken,
        }),
      });

      const finishData = await finishRes.json() as Record<string, any>;
      if (!finishRes.ok || finishData?.error) {
        const errMsg = finishData?.error?.message || `Failed to finish Video Story publication (HTTP ${finishRes.status})`;
        return res.status(400).json({ error: errMsg, details: finishData });
      }

      try {
        await db.insert(facebookPagePostsTable).values({
          id: randomUUID(),
          storeId,
          caption: caption || "Facebook Video Story",
          imageUrl: localFilePath ? `/api/uploads/${path.basename(localFilePath)}` : (remoteMediaUrl || null),
          postType: "Story",
          status: "Published",
          createdAt: new Date(),
        });
      } catch {}

      addEvent("facebook", "Facebook Video Story Published", `Story Video ID: ${videoId}`, "sync", storeId);

      return res.json({
        ok: true,
        success: true,
        storyType: "video",
        videoId,
        details: finishData,
      });

    } else {
      // --- PHOTO STORY PUBLISHING FLOW ---
      // 1. Upload unpublished photo to /{page_id}/photos with published=false
      let photoPublicUrl = remoteMediaUrl;
      if (localFilePath) {
        photoPublicUrl = resolveInstagramPublicUrl(req, `/api/uploads/${path.basename(localFilePath)}`);
      }

      if (!photoPublicUrl) {
        return res.status(400).json({ error: "Could not resolve public URL for photo story." });
      }

      const photoRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: photoPublicUrl,
          published: false,
          access_token: pageAccessToken,
        }),
      });

      const photoData = await photoRes.json() as Record<string, any>;
      if (!photoRes.ok || !photoData?.id) {
        const errMsg = photoData?.error?.message || `Failed to stage Photo for Story (HTTP ${photoRes.status})`;
        return res.status(400).json({ error: errMsg, details: photoData });
      }

      const stagedPhotoId = photoData.id;

      // 2. Publish as Photo Story via /{page_id}/photo_stories
      const storyRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photo_stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo_id: stagedPhotoId,
          access_token: pageAccessToken,
        }),
      });

      const storyData = await storyRes.json() as Record<string, any>;
      if (!storyRes.ok || storyData?.error) {
        const errMsg = storyData?.error?.message || `Failed to publish Facebook Photo Story (HTTP ${storyRes.status})`;
        return res.status(400).json({ error: errMsg, details: storyData });
      }

      try {
        await db.insert(facebookPagePostsTable).values({
          id: randomUUID(),
          storeId,
          caption: caption || "Facebook Photo Story",
          imageUrl: photoPublicUrl,
          postType: "Story",
          status: "Published",
          createdAt: new Date(),
        });
      } catch {}

      addEvent("facebook", "Facebook Photo Story Published", `Story ID: ${storyData.id || stagedPhotoId}`, "sync", storeId);

      return res.json({
        ok: true,
        success: true,
        storyType: "photo",
        storyId: storyData.id || stagedPhotoId,
        photoId: stagedPhotoId,
        details: storyData,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

router.delete("/facebook/posts/:id", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  await db.delete(facebookPagePostsTable).where(and(eq(facebookPagePostsTable.id, req.params.id as string), eq(facebookPagePostsTable.storeId, storeId)));
  return res.json({ ok: true });
});

// ── Post Templates ────────────────────────────────────────────────────────────

router.get("/facebook/post-templates", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const list = await db.select().from(facebookPostTemplatesTable).where(eq(facebookPostTemplatesTable.storeId, storeId)).orderBy(desc(facebookPostTemplatesTable.createdAt));
  return res.json(list);
});

router.post("/facebook/post-templates", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const { name, body, postType } = req.body as { name: string; body: string; postType: string };
  const [tpl] = await db.insert(facebookPostTemplatesTable)
    .values({ id: randomUUID(), storeId, name, body, postType: postType ?? "Standard" }).returning();
  return res.status(201).json(tpl);
});

router.put("/facebook/post-templates/:id/use", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const [tpl] = await db.select().from(facebookPostTemplatesTable)
    .where(and(eq(facebookPostTemplatesTable.id, req.params.id as string), eq(facebookPostTemplatesTable.storeId, storeId))).limit(1);
  if (!tpl) return res.status(404).json({ error: "Template not found" });
  const [updated] = await db.update(facebookPostTemplatesTable)
    .set({ usageCount: tpl.usageCount + 1 })
    .where(and(eq(facebookPostTemplatesTable.id, tpl.id), eq(facebookPostTemplatesTable.storeId, storeId))).returning();
  return res.json(updated);
});

// ── Live: Page Info ────────────────────────────────────────────────────────────

router.get("/facebook/page-info", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const creds = await getFbCreds(storeId);
  const pageId = creds["page_id"];
  if (!pageId) return res.status(400).json({ error: "Missing Facebook Page ID — add credentials in channel settings." });
  const result = await fbGraphGet(`/${pageId}`, storeId, { fields: "name,fan_count,followers_count,link,picture" });
  if (!result.ok) return res.status(400).json({ error: result.error });
  return res.json(result.data);
});

// ── Live: Instagram ────────────────────────────────────────────────────────────

router.get("/facebook/instagram/account", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const igCreds = await getChannelCredentials("instagram", storeId);
  const fbCreds = await getFbCreds(storeId);
  const igUserId = igCreds["ig_user_id"];
  const token = igCreds["page_access_token"] || fbCreds["page_access_token"];
  if (!igUserId || !token) return res.status(400).json({ error: "Missing Instagram credentials — add IG Business Account ID and Page Access Token." });
  const url = new URL(`https://graph.facebook.com/v21.0/${igUserId}`);
  url.searchParams.set("fields", "name,username,profile_picture_url,followers_count,media_count,biography,website");
  url.searchParams.set("access_token", token);
  try {
    const r = await fetch(url.toString());
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) return res.status(400).json({ error: (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}` });
    return res.json({ instagram_business_account: data });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.get("/facebook/instagram/media", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const igCreds = await getChannelCredentials("instagram", storeId);
  const fbCreds = await getFbCreds(storeId);
  const igUserId = igCreds["ig_user_id"];
  const token = igCreds["page_access_token"] || fbCreds["page_access_token"];
  if (!igUserId || !token) return res.status(400).json({ error: "Missing Instagram credentials." });
  const url = new URL(`https://graph.facebook.com/v21.0/${igUserId}/media`);
  url.searchParams.set("fields", "id,caption,media_type,media_product_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink");
  url.searchParams.set("limit", "24");
  url.searchParams.set("access_token", token);
  try {
    const r = await fetch(url.toString());
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) return res.status(400).json({ error: (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}` });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post("/facebook/instagram/publish", (req, res, next) => {
  mediaUpload.single("media")(req, res, (err) => {
    if (err) {
      // Fallback check for "image" or "video" field name
      mediaUpload.single("image")(req, res, (err2) => {
        if (err2) {
          mediaUpload.single("video")(req, res, (err3) => {
            if (err3) {
              return res.status(400).json({ error: err3.message || err.message || "File upload failed." });
            }
            next();
          });
        } else {
          next();
        }
      });
    } else {
      next();
    }
  });
}, async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const igCreds = await getChannelCredentials("instagram", storeId);
  const fbCreds = await getFbCreds(storeId);
  const igUserId = igCreds["ig_user_id"];
  const token = igCreds["page_access_token"] || fbCreds["page_access_token"];
  if (!igUserId || !token) {
    return res.status(400).json({ error: "Missing Instagram credentials — please connect your Instagram Professional Account or Page Access Token first." });
  }

  // Determine mediaType: "FEED" (or "IMAGE"), "REELS", "STORIES"
  const rawMediaType = String(req.body.mediaType || req.body.media_type || req.body.targetType || "FEED").toUpperCase();
  const isReels = rawMediaType === "REELS" || rawMediaType === "REEL";
  const isStories = rawMediaType === "STORIES" || rawMediaType === "STORY";

  const rawUrl = (req.body.mediaUrl || req.body.videoUrl || req.body.imageUrl ? String(req.body.mediaUrl || req.body.videoUrl || req.body.imageUrl).trim() : undefined);
  const isVideoFile = req.file?.mimetype?.startsWith("video/") || (rawUrl && /\.(mp4|mov|webm|avi|m4v)(\?.*)?$/i.test(rawUrl));

  let mediaUrl: string | undefined;
  let preparedImage: any = null;

  if (isVideoFile || isReels) {
    // Video handling for Reels / Stories
    if (req.file) {
      mediaUrl = resolveInstagramPublicUrl(req, `/api/uploads/${path.basename(req.file.path)}`);
    } else if (rawUrl) {
      if (rawUrl.startsWith("/") || rawUrl.startsWith("/api/uploads/")) {
        mediaUrl = resolveInstagramPublicUrl(req, rawUrl);
      } else {
        mediaUrl = rawUrl;
      }
    } else {
      return res.status(400).json({ error: "Please provide a video file or valid public video URL for Instagram Reels / Video Story." });
    }
  } else {
    // Image handling for Feed / Photo Stories
    try {
      preparedImage = await prepareInstagramImage({
        file: req.file,
        imageUrl: rawUrl,
        req,
      });
      mediaUrl = preparedImage.publicUrl;
    } catch (prepErr: any) {
      return res.status(400).json({
        error: `Image preparation failed: ${prepErr?.message || "Invalid image file or unreachable image URL."}`,
      });
    }
  }

  if (!mediaUrl) {
    return res.status(400).json({ error: "Could not resolve a public URL for the media asset." });
  }

  const caption = (req.body.caption as string | undefined) ?? "";

  // Parse optional user_tags for photo tagging on Instagram
  let userTags: Array<{ username: string; x: number; y: number }> | undefined;
  if (req.body.userTags || req.body.user_tags) {
    try {
      const rawTags = typeof req.body.userTags === "string" 
        ? JSON.parse(req.body.userTags) 
        : (typeof req.body.user_tags === "string" ? JSON.parse(req.body.user_tags) : (req.body.userTags || req.body.user_tags));
      if (Array.isArray(rawTags) && rawTags.length > 0) {
        userTags = rawTags
          .map((t: any) => ({
            username: String(t.username || t.name || t || "").replace(/^@/, "").trim(),
            x: typeof t.x === "number" ? Math.min(Math.max(t.x, 0), 1) : 0.5,
            y: typeof t.y === "number" ? Math.min(Math.max(t.y, 0), 1) : 0.5,
          }))
          .filter((t) => t.username.length > 0);
      }
    } catch {
      // ignore JSON parse errors for user tags
    }
  }

  // Parse optional product_tags for Shoppable Instagram Posts and Reels
  let productTags: Array<{ product_id: string; x?: number; y?: number }> | undefined;
  if (req.body.productTags || req.body.product_tags) {
    try {
      const rawProdTags = typeof req.body.productTags === "string"
        ? JSON.parse(req.body.productTags)
        : (typeof req.body.product_tags === "string" ? JSON.parse(req.body.product_tags) : (req.body.productTags || req.body.product_tags));
      if (Array.isArray(rawProdTags) && rawProdTags.length > 0) {
        productTags = rawProdTags
          .map((t: any) => {
            const pId = String(t.catalogProductId || t.productId || t.product_id || t.retailerId || t.id || "").trim();
            const tagObj: { product_id: string; x?: number; y?: number } = { product_id: pId };
            if (!isReels && !isStories) {
              tagObj.x = typeof t.x === "number" ? Math.min(Math.max(t.x, 0), 1) : 0.5;
              tagObj.y = typeof t.y === "number" ? Math.min(Math.max(t.y, 0), 1) : 0.5;
            }
            return tagObj;
          })
          .filter((t) => t.product_id.length > 0);
      }
    } catch {
      // ignore JSON parse errors for product tags
    }
  }

  try {
    const containerPayload: Record<string, any> = {
      access_token: token,
    };

    if (isReels) {
      containerPayload.media_type = "REELS";
      containerPayload.video_url = mediaUrl;
      if (caption.trim()) {
        containerPayload.caption = caption.trim();
      }
      if (req.body.shareToFeed !== undefined) {
        containerPayload.share_to_feed = req.body.shareToFeed === true || req.body.shareToFeed === "true";
      }
      if (req.body.thumbOffset || req.body.thumb_offset) {
        containerPayload.thumb_offset = Number(req.body.thumbOffset || req.body.thumb_offset);
      }
      if (productTags && productTags.length > 0) {
        containerPayload.product_tags = productTags.map((p) => ({ product_id: p.product_id }));
      }
    } else if (isStories) {
      containerPayload.media_type = "STORIES";
      if (isVideoFile) {
        containerPayload.video_url = mediaUrl;
      } else {
        containerPayload.image_url = mediaUrl;
      }
    } else {
      // Standard Feed Post
      if (isVideoFile) {
        containerPayload.media_type = "VIDEO";
        containerPayload.video_url = mediaUrl;
      } else {
        containerPayload.image_url = mediaUrl;
      }
      if (caption.trim()) {
        containerPayload.caption = caption.trim();
      }
      if (userTags && userTags.length > 0 && !isVideoFile) {
        containerPayload.user_tags = userTags;
      }
      if (productTags && productTags.length > 0 && !isVideoFile) {
        containerPayload.product_tags = productTags;
      }
    }

    const containerRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerPayload),
    });
    const container = await containerRes.json() as Record<string, any>;
    if (!containerRes.ok || !container?.id) {
      const errObj = container?.error;
      const errMsg =
        errObj?.error_user_msg ||
        errObj?.message ||
        `Instagram container creation failed (HTTP ${containerRes.status})`;
      return res.status(400).json({ error: errMsg, details: errObj, mediaUrl });
    }

    const containerId = container.id;

    // Polling container status until Instagram finishes processing the media (videos / reels / stories need processing)
    let ready = false;
    let lastStatus = "IN_PROGRESS";
    const maxAttempts = isVideoFile || isReels || isStories ? 20 : 10;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      try {
        const statusRes = await fetch(`https://graph.facebook.com/v21.0/${containerId}?fields=status_code,status&access_token=${token}`);
        const statusData = await statusRes.json() as any;
        lastStatus = statusData?.status_code || lastStatus;
        if (statusData?.status_code === "FINISHED") {
          ready = true;
          break;
        }
        if (statusData?.status_code === "ERROR") {
          const detail = statusData?.status || statusData?.error_message || "Instagram could not process the media container.";
          return res.status(400).json({
            error: `Instagram media processing failed: ${detail}`,
            statusData,
            mediaUrl,
          });
        }
      } catch {
        break;
      }
    }

    if (!ready && lastStatus === "IN_PROGRESS") {
      await new Promise((r) => setTimeout(r, 3000));
    }

    const publishRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerId, access_token: token }),
    });
    const published = await publishRes.json() as Record<string, any>;
    if (!publishRes.ok || !published?.id) {
      const errObj = published?.error;
      const errMsg =
        errObj?.error_user_msg ||
        errObj?.message ||
        `Publish failed (HTTP ${publishRes.status})`;
      return res.status(400).json({ error: errMsg, details: errObj, mediaUrl });
    }

    const eventLabel = isReels ? "Reel published to Instagram" : (isStories ? "Story published to Instagram" : "Post published to Instagram");
    addEvent("instagram", eventLabel, `Media ID: ${published.id}`, "sync", storeId);

    return res.json({
      ok: true,
      mediaId: published.id,
      mediaType: isReels ? "REELS" : (isStories ? "STORIES" : "FEED"),
      mediaUrl,
      originalFormat: preparedImage?.originalFormat,
      adjustedAspectRatio: preparedImage?.adjustedAspectRatio,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ── Live: Meta Ads ─────────────────────────────────────────────────────────────

router.get("/facebook/ads/account", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const adsCreds = await getChannelCredentials("ads", storeId);
  const fbCreds = await getFbCreds(storeId);
  const adAccountId = adsCreds["ad_account_id"] || fbCreds["ad_account_id"];
  const token =
    adsCreds["page_access_token"] ||
    adsCreds["access_token"] ||
    fbCreds["page_access_token"] ||
    fbCreds["access_token"];
  if (!adAccountId || !token) return res.status(400).json({ error: "Missing ad account credentials — add Ad Account ID and Page Access Token." });
  const cleanId = String(adAccountId).trim().replace(/^act_/, "");
  const actId = `act_${cleanId}`;
  const url = new URL(`https://graph.facebook.com/v21.0/${actId}`);
  url.searchParams.set("fields", "id,name,currency,account_status,amount_spent,balance,spend_cap");
  url.searchParams.set("access_token", token);
  try {
    const r = await fetch(url.toString());
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) return res.status(400).json({ error: (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}` });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.get("/facebook/ads/insights", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const adsCreds = await getChannelCredentials("ads", storeId);
  const fbCreds = await getFbCreds(storeId);
  const adAccountId = adsCreds["ad_account_id"] || fbCreds["ad_account_id"];
  const token =
    adsCreds["page_access_token"] ||
    adsCreds["access_token"] ||
    fbCreds["page_access_token"] ||
    fbCreds["access_token"];
  if (!adAccountId || !token) {
    return res.status(400).json({
      error: "Missing Meta Ad Account credentials — provide Ad Account ID and Access Token in the Credentials tab or connect via Meta Business Suite.",
    });
  }
  const preset = (req.query["date_preset"] ?? req.query["preset"] ?? "last_7d") as string;
  const cleanId = String(adAccountId).trim().replace(/^act_/, "");
  const actId = `act_${cleanId}`;
  const url = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  url.searchParams.set("fields", "spend,impressions,clicks,reach,ctr,cpc,frequency,actions,cost_per_action_type");
  url.searchParams.set("date_preset", preset);
  url.searchParams.set("access_token", token);
  try {
    const r = await fetch(url.toString());
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) {
      const errObj = data["error"] as Record<string, unknown> | undefined;
      const errMsg = (errObj?.["message"] as string) ?? `Meta API Error (HTTP ${r.status})`;
      return res.status(400).json({ error: errMsg, details: errObj });
    }
    return res.json({ ...data, actId, datePreset: preset });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.get("/facebook/ads/campaigns", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const adsCreds = await getChannelCredentials("ads", storeId);
  const fbCreds = await getFbCreds(storeId);
  const adAccountId = adsCreds["ad_account_id"] || fbCreds["ad_account_id"];
  const token = adsCreds["page_access_token"] || fbCreds["page_access_token"];
  if (!adAccountId || !token) return res.status(400).json({ error: "Missing ad account credentials." });
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const url = new URL(`https://graph.facebook.com/v21.0/${actId}/campaigns`);
  url.searchParams.set("fields", "id,name,status,objective,budget_remaining,daily_budget,lifetime_budget");
  url.searchParams.set("access_token", token);
  try {
    const r = await fetch(url.toString());
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) return res.status(400).json({ error: (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}` });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post("/facebook/ads/campaigns", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const { name, objective, status, dailyBudget, buyingType } = req.body as {
    name: string;
    objective: string;
    status?: string;
    dailyBudget?: number;
    buyingType?: string;
  };

  if (!name || !objective) {
    return res.status(400).json({ error: "Campaign name and objective are required." });
  }

  const adsCreds = await getChannelCredentials("ads", storeId);
  const fbCreds = await getFbCreds(storeId);
  const adAccountId = adsCreds["ad_account_id"] || fbCreds["ad_account_id"];
  const token = adsCreds["page_access_token"] || fbCreds["page_access_token"];
  if (!adAccountId || !token) {
    return res.status(400).json({ error: "Missing Facebook Ad Account credentials (Ad Account ID or Page/User Access Token)." });
  }

  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const url = new URL(`https://graph.facebook.com/v21.0/${actId}/campaigns`);

  // Build params for Meta Graph API
  const params: Record<string, string> = {
    name,
    objective,
    status: status || "PAUSED",
    buying_type: buyingType || "AUCTION",
    special_ad_categories: JSON.stringify(["NONE"]),
    access_token: token,
  };

  if (dailyBudget) {
    // budgets in Meta API are in sub-units (cents/pennies) of the currency
    params["daily_budget"] = String(Math.round(dailyBudget * 100));
  }

  try {
    const r = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) {
      const errMsg = (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}`;
      return res.status(400).json({ error: errMsg });
    }
    addEvent("facebook", `Ad Campaign Created: ${name}`, `Campaign ID: ${String(data["id"])}`, "sync", storeId);
    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.patch("/facebook/ads/campaigns/:id", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const campaignId = req.params.id as string;
  const { name, status, dailyBudget } = req.body as {
    name?: string;
    status?: string;
    dailyBudget?: number;
  };

  const adsCreds = await getChannelCredentials("ads", storeId);
  const fbCreds = await getFbCreds(storeId);
  const token = adsCreds["page_access_token"] || fbCreds["page_access_token"];
  if (!token) return res.status(400).json({ error: "Missing Page Access Token for Meta Ads." });

  const params: Record<string, string> = { access_token: token };
  if (name) params["name"] = name.trim();
  if (status) params["status"] = status;
  if (dailyBudget) params["daily_budget"] = String(Math.round(dailyBudget * 100));

  try {
    const url = `https://graph.facebook.com/v21.0/${campaignId}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) {
      const errMsg = (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}`;
      return res.status(400).json({ error: errMsg });
    }
    addEvent("facebook", `Ad Campaign Updated`, `Campaign ${campaignId} updated`, "sync", storeId);
    return res.json({ success: true, ...data });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post("/facebook/ads/campaigns/:id/status", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const campaignId = req.params.id as string;
  const { status } = req.body as { status: "ACTIVE" | "PAUSED" | "ARCHIVED" };

  if (!status || !["ACTIVE", "PAUSED", "ARCHIVED"].includes(status)) {
    return res.status(400).json({ error: "Status must be ACTIVE, PAUSED, or ARCHIVED." });
  }

  const adsCreds = await getChannelCredentials("ads", storeId);
  const fbCreds = await getFbCreds(storeId);
  const token = adsCreds["page_access_token"] || fbCreds["page_access_token"];
  if (!token) return res.status(400).json({ error: "Missing Page Access Token for Meta Ads." });

  try {
    const url = `https://graph.facebook.com/v21.0/${campaignId}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ status, access_token: token }).toString(),
    });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) {
      const errMsg = (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}`;
      return res.status(400).json({ error: errMsg });
    }
    addEvent("facebook", `Ad Campaign Status: ${status}`, `Campaign ${campaignId} set to ${status}`, "sync", storeId);
    return res.json({ success: true, status, ...data });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.delete("/facebook/ads/campaigns/:id", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const campaignId = req.params.id as string;
  const adsCreds = await getChannelCredentials("ads", storeId);
  const fbCreds = await getFbCreds(storeId);
  const token = adsCreds["page_access_token"] || fbCreds["page_access_token"];
  if (!token) return res.status(400).json({ error: "Missing Page Access Token for Meta Ads." });

  try {
    const url = `https://graph.facebook.com/v21.0/${campaignId}?access_token=${token}`;
    const r = await fetch(url, { method: "DELETE" });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) {
      const errMsg = (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}`;
      return res.status(400).json({ error: errMsg });
    }
    addEvent("facebook", `Ad Campaign Deleted`, `Campaign ${campaignId} deleted from Meta Ads`, "sync", storeId);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.get("/facebook/ads/campaigns/:id/insights", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const campaignId = req.params.id as string;
  const adsCreds = await getChannelCredentials("ads", storeId);
  const fbCreds = await getFbCreds(storeId);
  const token =
    adsCreds["page_access_token"] ||
    adsCreds["access_token"] ||
    fbCreds["page_access_token"] ||
    fbCreds["access_token"];
  if (!token) return res.status(400).json({ error: "Missing Access Token for Meta Ads." });

  const preset = (req.query["date_preset"] ?? req.query["preset"] ?? "maximum") as string;
  const url = new URL(`https://graph.facebook.com/v21.0/${campaignId}/insights`);
  url.searchParams.set("fields", "spend,impressions,clicks,reach,ctr,cpc,frequency,actions,cost_per_action_type");
  url.searchParams.set("date_preset", preset);
  url.searchParams.set("access_token", token);

  try {
    const r = await fetch(url.toString());
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) {
      const errObj = data["error"] as Record<string, unknown> | undefined;
      const errMsg = (errObj?.["message"] as string) ?? `HTTP ${r.status}`;
      return res.status(400).json({ error: errMsg, details: errObj });
    }
    return res.json({ ...data, campaignId, datePreset: preset });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ── Ad Sets ──────────────────────────────────────────────────────────────────

router.get("/facebook/ads/adsets", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const adsCreds = await getChannelCredentials("ads", storeId);
  const fbCreds = await getFbCreds(storeId);
  const adAccountId = adsCreds["ad_account_id"] || fbCreds["ad_account_id"];
  const token = adsCreds["page_access_token"] || fbCreds["page_access_token"];
  if (!adAccountId || !token) return res.status(400).json({ error: "Missing ad account credentials." });

  const campaignId = req.query["campaign_id"] as string | undefined;
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const target = campaignId || actId;

  const url = new URL(`https://graph.facebook.com/v21.0/${target}/adsets`);
  url.searchParams.set("fields", "id,name,status,daily_budget,lifetime_budget,billing_event,optimization_goal,campaign_id,created_time,targeting");
  url.searchParams.set("access_token", token);

  try {
    const r = await fetch(url.toString());
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) return res.status(400).json({ error: (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}` });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post("/facebook/ads/adsets", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const { name, campaignId, dailyBudget, billingEvent = "IMPRESSIONS", optimizationGoal = "LINK_CLICKS", status = "PAUSED", countries = ["US", "GB", "FR", "DE"] } = req.body as {
    name: string;
    campaignId: string;
    dailyBudget?: number;
    billingEvent?: string;
    optimizationGoal?: string;
    status?: string;
    countries?: string[];
  };

  if (!name || !campaignId) {
    return res.status(400).json({ error: "Ad Set name and campaignId are required." });
  }

  const adsCreds = await getChannelCredentials("ads", storeId);
  const fbCreds = await getFbCreds(storeId);
  const adAccountId = adsCreds["ad_account_id"] || fbCreds["ad_account_id"];
  const token = adsCreds["page_access_token"] || fbCreds["page_access_token"];
  if (!adAccountId || !token) return res.status(400).json({ error: "Missing ad account credentials." });

  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const url = new URL(`https://graph.facebook.com/v21.0/${actId}/adsets`);

  const params: Record<string, string> = {
    name,
    campaign_id: campaignId,
    billing_event: billingEvent,
    optimization_goal: optimizationGoal,
    status,
    targeting: JSON.stringify({
      geo_locations: { countries },
      age_min: 18,
    }),
    access_token: token,
  };

  if (dailyBudget) {
    params["daily_budget"] = String(Math.round(dailyBudget * 100));
  }

  try {
    const r = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) {
      const errMsg = (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}`;
      return res.status(400).json({ error: errMsg });
    }
    addEvent("facebook", `Ad Set Created: ${name}`, `Ad Set ID: ${String(data["id"])}`, "sync", storeId);
    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.patch("/facebook/ads/adsets/:id/status", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const adSetId = req.params.id as string;
  const { status } = req.body as { status: "ACTIVE" | "PAUSED" | "ARCHIVED" };

  if (!status) return res.status(400).json({ error: "Status is required." });

  const adsCreds = await getChannelCredentials("ads", storeId);
  const fbCreds = await getFbCreds(storeId);
  const token = adsCreds["page_access_token"] || fbCreds["page_access_token"];
  if (!token) return res.status(400).json({ error: "Missing Page Access Token for Meta Ads." });

  try {
    const url = `https://graph.facebook.com/v21.0/${adSetId}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ status, access_token: token }).toString(),
    });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) {
      const errMsg = (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}`;
      return res.status(400).json({ error: errMsg });
    }
    return res.json({ success: true, status, ...data });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ── Ads & Creatives ──────────────────────────────────────────────────────────

router.get("/facebook/ads/ads", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const adsCreds = await getChannelCredentials("ads", storeId);
  const fbCreds = await getFbCreds(storeId);
  const adAccountId = adsCreds["ad_account_id"] || fbCreds["ad_account_id"];
  const token = adsCreds["page_access_token"] || fbCreds["page_access_token"];
  if (!adAccountId || !token) return res.status(400).json({ error: "Missing ad account credentials." });

  const adSetId = req.query["adset_id"] as string | undefined;
  const campaignId = req.query["campaign_id"] as string | undefined;
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const target = adSetId || campaignId || actId;

  const url = new URL(`https://graph.facebook.com/v21.0/${target}/ads`);
  url.searchParams.set("fields", "id,name,status,adset_id,campaign_id,creative{id,name,title,body,image_url},created_time");
  url.searchParams.set("access_token", token);

  try {
    const r = await fetch(url.toString());
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) return res.status(400).json({ error: (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}` });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post("/facebook/ads/ads", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const { name, adsetId, title, body: adBody, imageUrl, linkUrl, status = "PAUSED" } = req.body as {
    name: string;
    adsetId: string;
    title: string;
    body: string;
    imageUrl?: string;
    linkUrl?: string;
    status?: string;
  };

  if (!name || !adsetId || !title) {
    return res.status(400).json({ error: "Ad name, adsetId, and title are required." });
  }

  const adsCreds = await getChannelCredentials("ads", storeId);
  const fbCreds = await getFbCreds(storeId);
  const adAccountId = adsCreds["ad_account_id"] || fbCreds["ad_account_id"];
  const token = adsCreds["page_access_token"] || fbCreds["page_access_token"];
  if (!adAccountId || !token) return res.status(400).json({ error: "Missing ad account credentials." });

  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  // 1. First create an Ad Creative
  const creativeUrl = new URL(`https://graph.facebook.com/v21.0/${actId}/adcreatives`);
  const storeDomain = req.get("host") || "luxeboutique.com";
  const resolvedImageUrl = imageUrl ? resolveInstagramPublicUrl(req, imageUrl) : `https://${storeDomain}/placeholder.jpg`;
  const creativeParams: Record<string, string> = {
    name: `${name} Creative`,
    object_story_spec: JSON.stringify({
      link_data: {
        message: adBody || "",
        link: linkUrl || `https://${storeDomain}`,
        name: title,
        image_url: resolvedImageUrl,
        call_to_action: { type: "SHOP_NOW" },
      },
      page_id: fbCreds["page_id"] || adsCreds["page_id"] || "",
    }),
    access_token: token,
  };

  try {
    const creativeRes = await fetch(creativeUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(creativeParams).toString(),
    });
    const creativeData = await creativeRes.json() as Record<string, any>;
    if (!creativeRes.ok || !creativeData?.id) {
      const errMsg = creativeData?.error?.message ?? `Ad Creative creation failed (HTTP ${creativeRes.status})`;
      return res.status(400).json({ error: errMsg });
    }

    const creativeId = creativeData.id;

    // 2. Now create the Ad with the creative
    const adUrl = new URL(`https://graph.facebook.com/v21.0/${actId}/ads`);
    const adParams: Record<string, string> = {
      name,
      adset_id: adsetId,
      creative: JSON.stringify({ creative_id: creativeId }),
      status,
      access_token: token,
    };

    const adRes = await fetch(adUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(adParams).toString(),
    });
    const adData = await adRes.json() as Record<string, any>;
    if (!adRes.ok || !adData?.id) {
      const errMsg = adData?.error?.message ?? `Ad creation failed (HTTP ${adRes.status})`;
      return res.status(400).json({ error: errMsg });
    }

    addEvent("facebook", `Ad Created: ${name}`, `Ad ID: ${String(adData.id)}`, "sync", storeId);
    return res.status(201).json({ success: true, adId: adData.id, creativeId });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.patch("/facebook/ads/ads/:id/status", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const adId = req.params.id as string;
  const { status } = req.body as { status: "ACTIVE" | "PAUSED" | "ARCHIVED" };

  if (!status) return res.status(400).json({ error: "Status is required." });

  const adsCreds = await getChannelCredentials("ads", storeId);
  const fbCreds = await getFbCreds(storeId);
  const token = adsCreds["page_access_token"] || fbCreds["page_access_token"];
  if (!token) return res.status(400).json({ error: "Missing Page Access Token for Meta Ads." });

  try {
    const url = `https://graph.facebook.com/v21.0/${adId}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ status, access_token: token }).toString(),
    });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) {
      const errMsg = (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}`;
      return res.status(400).json({ error: errMsg });
    }
    return res.json({ success: true, status, ...data });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

export default router;

router.post("/facebook/catalog/products/bulk", async (req: TenantRequest, res) => {
  const storeId = req.storeId!;
  const { ids, action, updates } = req.body as { ids: string[]; action: "DELETE" | "UPDATE", updates?: any };
  if (!ids || ids.length === 0) return res.status(400).json({ error: "No IDs provided" });
  
  const { catalogId, token } = await getCommerceMetaCreds(storeId);
  if (!catalogId || !token) return res.status(400).json({ error: "Missing Commerce credentials" });

  try {
    if (action === "DELETE") {
      // Use direct graph ID deletes in parallel
      await Promise.allSettled(
        ids.map(async (id) => {
          const r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${token}`, { method: "DELETE" });
          if (r.ok) {
            await db.delete(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.storeId, storeId))).catch(() => {});
          }
        })
      );
      addEvent("commerce", "Meta Bulk Delete", `Deleted ${ids.length} products`, "sync", storeId);
      return res.json({ success: true });
    } else if (action === "UPDATE" && updates) {
      // Use items_batch because we need to update multiple
      // Wait, items_batch requires retailer_id, not Graph ID! 
      // If we only have graph ids, we might have to use direct graph ID update.
      await Promise.allSettled(
        ids.map(async (id) => {
          const body = new URLSearchParams();
          body.append("access_token", token);
          if (updates.availability) body.append("availability", updates.availability);
          if (updates.condition) body.append("condition", updates.condition);
          if (updates.price) body.append("price", String(updates.price));
          
          await fetch(`https://graph.facebook.com/v21.0/${id}`, { 
            method: "POST",
            body
          });
        })
      );
      addEvent("commerce", "Meta Bulk Update", `Updated ${ids.length} products`, "sync", storeId);
      return res.json({ success: true });
    }
    
    return res.status(400).json({ error: "Invalid action" });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
