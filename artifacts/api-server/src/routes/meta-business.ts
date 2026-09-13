import { Router, type Request, type Response } from "express";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { db, channelConfigsTable, channelEventLogsTable, facebookConnectionsTable, channelCredentialsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  getChannelCredentials,
  persistCredentials,
  encryptionKey,
  addEvent,
  auditActor,
} from "./channels";

const router = Router();
const META_API_VERSION = process.env.META_API_VERSION ?? "v21.0";

export interface DiscoveredPage {
  id: string;
  name: string;
  category?: string;
  accessToken: string;
  instagramAccount?: {
    id: string;
    username: string;
    name?: string;
    profilePictureUrl?: string;
  };
}

export interface DiscoveredCatalog {
  id: string;
  name: string;
  vertical?: string;
  productCount?: number;
}

export interface DiscoveredWhatsAppAccount {
  id: string;
  name: string;
  currency?: string;
  phones: Array<{
    id: string;
    displayPhoneNumber: string;
    verifiedName?: string;
    qualityRating?: string;
  }>;
}

export interface DiscoveredAdAccount {
  id: string;
  accountId: string;
  name: string;
  currency?: string;
  status?: number;
}

export interface DiscoveredPixel {
  id: string;
  name: string;
  adAccountId?: string;
}

export interface DiscoveredAssets {
  pages: DiscoveredPage[];
  catalogs: DiscoveredCatalog[];
  whatsappAccounts: DiscoveredWhatsAppAccount[];
  adAccounts: DiscoveredAdAccount[];
  pixels: DiscoveredPixel[];
  business?: {
    id: string;
    name: string;
  };
}

// ── State Sign / Verify Helpers ──────────────────────────────────────────────

function resolvePublicBaseUrl(req: Request, clientOrigin?: string): string {
  // 1. Explicit client origin from frontend window.location.origin
  if (clientOrigin && typeof clientOrigin === "string") {
    try {
      const u = new URL(clientOrigin);
      const isLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1";
      const scheme = isLocal ? u.protocol : "https:";
      return `${scheme}//${u.host}`;
    } catch {}
  }

  // 2. Explicit APP_URL env variable
  if (process.env.APP_URL) {
    const appUrl = process.env.APP_URL.trim().replace(/\/$/, "");
    if (appUrl) return appUrl;
  }

  // 3. Browser referer or origin header
  const originHeader = req.get("origin") || req.get("referer");
  if (originHeader) {
    try {
      const u = new URL(originHeader);
      const isLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1";
      const scheme = isLocal ? u.protocol : "https:";
      return `${scheme}//${u.host}`;
    } catch {}
  }

  // 4. Host header / X-Forwarded-Host
  const rawHost = (req.get("x-forwarded-host") || req.get("host") || "localhost:3000").split(",")[0].trim();
  const isLocal = rawHost.includes("localhost") || rawHost.includes("127.0.0.1");
  const proto = isLocal ? (req.get("x-forwarded-proto") || req.protocol || "http") : "https";
  return `${proto}://${rawHost}`;
}

function signOAuthState(adminId: string, redirectUri: string): string {
  const payload = {
    adminId,
    redirectUri,
    timestamp: Date.now(),
    nonce: randomBytes(12).toString("hex"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", encryptionKey()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyOAuthState(state: string): { valid: boolean; adminId?: string; redirectUri?: string; error?: string } {
  try {
    const [encoded, signature] = state.split(".");
    if (!encoded || !signature) return { valid: false, error: "Malformed OAuth state parameter." };

    const expectedSignature = createHmac("sha256", encryptionKey()).update(encoded).digest("base64url");
    if (signature !== expectedSignature) {
      return { valid: false, error: "Invalid state signature." };
    }

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      adminId: string;
      redirectUri?: string;
      timestamp: number;
    };
    const maxAgeMs = 15 * 60 * 1000; // 15 minutes
    if (Date.now() - payload.timestamp > maxAgeMs) {
      return { valid: false, error: "OAuth state has expired. Please try connecting again." };
    }

    return { valid: true, adminId: payload.adminId, redirectUri: payload.redirectUri };
  } catch {
    return { valid: false, error: "Failed to parse state token." };
  }
}

// ── Meta Graph API Helpers ───────────────────────────────────────────────────

async function metaGet(path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  const data = (await res.json()) as Record<string, unknown>;
  
  if (!res.ok || data.error) {
    const err = data.error as Record<string, unknown> | undefined;
    const msg = String(err?.message || `Meta API error (HTTP ${res.status})`);
    const error: any = new Error(msg);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  
  return { ok: true, status: res.status, data };
}

async function discoverMetaAssets(masterToken: string): Promise<DiscoveredAssets> {
  const assets: DiscoveredAssets = {
    pages: [],
    catalogs: [],
    whatsappAccounts: [],
    adAccounts: [],
    pixels: [],
  };

  try {
    // 1. Fetch User / Business Profile
    const meRes = await metaGet("/me", masterToken, { fields: "id,name,email" });
    const allBusinesses: Array<{ id: string; name: string }> = [];
    const seenBizIds = new Set<string>();
    const addBiz = (id: string, name?: string) => {
      const cleanId = String(id).trim();
      if (!cleanId || seenBizIds.has(cleanId)) return;
      seenBizIds.add(cleanId);
      allBusinesses.push({ id: cleanId, name: name ? String(name) : `Business ${cleanId}` });
    };

    try {
      const businessesRes = await metaGet("/me/businesses", masterToken, { fields: "id,name,verification_status" });
      const rawBiz = (businessesRes.data?.data as Array<{ id: string; name: string }>) || [];
      for (const b of rawBiz) addBiz(b.id, b.name);
    } catch (bizErr) {
      console.warn("Failed fetching /me/businesses:", bizErr);
    }

    try {
      const clientBizRes = await metaGet("/me/client_businesses", masterToken, { fields: "id,name" });
      const rawClientBiz = (clientBizRes.data?.data as Array<{ id: string; name: string }>) || [];
      for (const cb of rawClientBiz) addBiz(cb.id, cb.name);
    } catch {}

    const primaryBusiness = allBusinesses[0];
    if (primaryBusiness) {
      assets.business = { id: primaryBusiness.id, name: primaryBusiness.name };
    } else if (meRes.data?.name) {
      assets.business = { id: String(meRes.data.id), name: `${meRes.data.name}'s Business` };
    }

    // 2. Fetch Facebook Pages and linked Instagram accounts
    const pagesRes = await metaGet("/me/accounts", masterToken, {
      fields: "id,name,access_token,category,instagram_business_account{id,username,name,profile_picture_url}",
    });
    const rawPages = (pagesRes.data?.data as Array<Record<string, unknown>>) || [];
    for (const p of rawPages) {
      const ig = p.instagram_business_account as Record<string, unknown> | undefined;
      assets.pages.push({
        id: String(p.id),
        name: String(p.name),
        category: p.category ? String(p.category) : undefined,
        accessToken: String(p.access_token),
        instagramAccount: ig ? {
          id: String(ig.id),
          username: String(ig.username),
          name: ig.name ? String(ig.name) : undefined,
          profilePictureUrl: ig.profile_picture_url ? String(ig.profile_picture_url) : undefined,
        } : undefined,
      });
    }

    // 3. Comprehensive Catalog Discovery
    const seenCatalogIds = new Set<string>();
    const recordCatalog = (item: Record<string, unknown>) => {
      const id = item?.id ? String(item.id).trim() : "";
      if (!id || seenCatalogIds.has(id)) return;
      seenCatalogIds.add(id);
      assets.catalogs.push({
        id,
        name: item.name ? String(item.name) : `Catalog ${id}`,
        vertical: item.vertical ? String(item.vertical) : undefined,
        productCount: typeof item.product_count === "number" ? item.product_count : undefined,
      });
    };

    const extractCatalogs = (obj: unknown) => {
      if (!obj || typeof obj !== "object") return;
      const rec = obj as Record<string, unknown>;

      if (Array.isArray(rec.data)) {
        for (const item of rec.data) {
          if (item && typeof item === "object") {
            const i = item as Record<string, unknown>;
            if (i.id) recordCatalog(i);
            if (i.product_catalogs && typeof i.product_catalogs === "object") {
              extractCatalogs(i.product_catalogs);
            }
            if (i.catalogs && typeof i.catalogs === "object") {
              extractCatalogs(i.catalogs);
            }
          }
        }
      }

      const keys = [
        "owned_product_catalogs",
        "client_product_catalogs",
        "assigned_product_catalogs",
        "product_catalogs",
        "catalogs",
      ];
      for (const k of keys) {
        if (rec[k] && typeof rec[k] === "object") {
          extractCatalogs(rec[k]);
        }
      }

      if (rec.commerce_merchant_settings && typeof rec.commerce_merchant_settings === "object") {
        extractCatalogs(rec.commerce_merchant_settings);
      }
    };

    // 3a. Check all discovered businesses
    for (const biz of allBusinesses) {
      const bizEndpoints = [
        `/${biz.id}/owned_product_catalogs`,
        `/${biz.id}/product_catalogs`,
        `/${biz.id}/assigned_product_catalogs`,
        `/${biz.id}/client_product_catalogs`,
        `/${biz.id}/commerce_merchant_settings`,
        `/${biz.id}`,
      ];
      for (const ep of bizEndpoints) {
        try {
          const catRes = await metaGet(ep, masterToken, {
            fields: ep === `/${biz.id}`
              ? "owned_product_catalogs{id,name,vertical,product_count},client_product_catalogs{id,name,vertical,product_count},assigned_product_catalogs{id,name,vertical,product_count},product_catalogs{id,name,vertical,product_count},commerce_merchant_settings{id,product_catalogs{id,name,vertical,product_count}}"
              : "id,name,vertical,product_count,display_name,product_catalogs{id,name,vertical,product_count}",
          });
          extractCatalogs(catRes.data);
        } catch {
          // non-blocking for specific endpoint failures
        }
      }
    }

    // 3b. Check User node /me
    const userEndpoints = [
      "/me/owned_product_catalogs",
      "/me/product_catalogs",
      "/me/assigned_product_catalogs",
      "/me/commerce_merchant_settings",
      "/me",
    ];
    for (const ep of userEndpoints) {
      try {
        const catRes = await metaGet(ep, masterToken, {
          fields: ep === "/me"
            ? "owned_product_catalogs{id,name,vertical,product_count},product_catalogs{id,name,vertical,product_count},assigned_product_catalogs{id,name,vertical,product_count},commerce_merchant_settings{id,product_catalogs{id,name,vertical,product_count}}"
            : "id,name,vertical,product_count,display_name,product_catalogs{id,name,vertical,product_count}",
        });
        extractCatalogs(catRes.data);
      } catch {
        // non-blocking
      }
    }

    // 3c. Check Facebook Pages for linked catalogs
    for (const page of assets.pages) {
      const tokensToTry = [masterToken];
      if (page.accessToken && page.accessToken !== masterToken) {
        tokensToTry.push(page.accessToken);
      }
      for (const tok of tokensToTry) {
        try {
          const pCatRes = await metaGet(`/${page.id}/product_catalogs`, tok, { fields: "id,name,vertical,product_count" });
          extractCatalogs(pCatRes.data);
        } catch {}

        try {
          const pCommRes = await metaGet(`/${page.id}/commerce_merchant_settings`, tok, { fields: "id,display_name,product_catalogs{id,name,vertical,product_count}" });
          extractCatalogs(pCommRes.data);
        } catch {}

        try {
          const pDirectRes = await metaGet(`/${page.id}`, tok, {
            fields: "product_catalogs{id,name,vertical,product_count},commerce_merchant_settings{id,product_catalogs{id,name,vertical,product_count}}",
          });
          extractCatalogs(pDirectRes.data);
        } catch {}
      }
    }

    // 3d. Check existing catalog ID from database to prevent losing existing connection
    try {
      const [commCreds, fbCreds] = await Promise.all([
        getChannelCredentials("commerce"),
        getChannelCredentials("facebook"),
      ]);
      const existingId = commCreds["catalog_id"] || fbCreds["catalog_id"];
      if (existingId && !seenCatalogIds.has(existingId)) {
        try {
          const directRes = await metaGet(`/${existingId}`, masterToken, { fields: "id,name,vertical,product_count" });
          if (directRes.data?.id) {
            recordCatalog(directRes.data as Record<string, unknown>);
          }
        } catch {}
      }
    } catch {}

    // 4. Fetch WhatsApp Business Accounts & Phone Numbers
    const wabaTargets = primaryBusiness ? [`/${primaryBusiness.id}/owned_whatsapp_business_accounts`] : ["/me/whatsapp_business_accounts"];
    for (const target of wabaTargets) {
      try {
        const wabaRes = await metaGet(target, masterToken, { fields: "id,name,currency" });
        const rawWabas = (wabaRes.data?.data as Array<Record<string, unknown>>) || [];
        for (const w of rawWabas) {
          const wabaId = String(w.id);
          const phonesRes = await metaGet(`/${wabaId}/phone_numbers`, masterToken, {
            fields: "id,display_phone_number,verified_name,quality_rating",
          });
          const rawPhones = (phonesRes.data?.data as Array<Record<string, unknown>>) || [];
          const phones = rawPhones.map((ph) => ({
            id: String(ph.id),
            displayPhoneNumber: String(ph.display_phone_number),
            verifiedName: ph.verified_name ? String(ph.verified_name) : undefined,
            qualityRating: ph.quality_rating ? String(ph.quality_rating) : undefined,
          }));

          assets.whatsappAccounts.push({
            id: wabaId,
            name: String(w.name),
            currency: w.currency ? String(w.currency) : undefined,
            phones,
          });
        }
      } catch (wabaErr) {
        console.warn(`WhatsApp discovery failed for target ${target}:`, wabaErr);
      }
    }

    // 5. Fetch Ad Accounts and associated Pixels/Datasets
    const seenPixelIds = new Set<string>();
    const recordPixel = (id: string, name?: string, adAccountId?: string) => {
      const cleanId = String(id).trim();
      if (!cleanId || seenPixelIds.has(cleanId)) return;
      seenPixelIds.add(cleanId);
      assets.pixels.push({
        id: cleanId,
        name: String(name || `Meta Pixel ${cleanId}`),
        adAccountId,
      });
    };

    try {
      const adsRes = await metaGet("/me/adaccounts", masterToken, {
        fields: "id,account_id,name,currency,account_status",
      });
      const rawAds = (adsRes.data?.data as Array<Record<string, unknown>>) || [];
      for (const a of rawAds) {
        const adId = String(a.id);
        const accountId = String(a.account_id || a.id);
        assets.adAccounts.push({
          id: adId,
          accountId,
          name: String(a.name),
          currency: a.currency ? String(a.currency) : undefined,
          status: typeof a.account_status === "number" ? a.account_status : undefined,
        });

        // 5a. Query Pixels and Datasets on this Ad Account
        const adTargets = [
          adId.startsWith("act_") ? `/${adId}` : `/act_${accountId}`,
          `/${adId}`,
        ];

        for (const target of adTargets) {
          try {
            const pxRes = await metaGet(`${target}/adspixels`, masterToken, {
              fields: "id,name,creation_time,last_fired_time",
            });
            const pxList = (pxRes.data?.data as Array<Record<string, unknown>>) || [];
            for (const p of pxList) {
              if (p.id) recordPixel(String(p.id), p.name ? String(p.name) : undefined, accountId);
            }
          } catch {
            // non-fatal
          }

          try {
            const dsRes = await metaGet(`${target}/datasets`, masterToken, {
              fields: "id,name",
            });
            const dsList = (dsRes.data?.data as Array<Record<string, unknown>>) || [];
            for (const d of dsList) {
              if (d.id) recordPixel(String(d.id), d.name ? String(d.name) : undefined, accountId);
            }
          } catch {
            // non-fatal
          }
        }
      }
    } catch (adsErr) {
      console.warn("Ads discovery failed:", adsErr);
    }

    // 6. Fetch Pixels/Datasets directly from Business Portfolio or /me
    const businessTargets = primaryBusiness
      ? [
          `/${primaryBusiness.id}/adspixels`,
          `/${primaryBusiness.id}/owned_pixels`,
          `/${primaryBusiness.id}/datasets`,
          "/me/adspixels",
        ]
      : ["/me/adspixels"];

    for (const bTarget of businessTargets) {
      try {
        const bPxRes = await metaGet(bTarget, masterToken, { fields: "id,name" });
        const bList = (bPxRes.data?.data as Array<Record<string, unknown>>) || [];
        for (const bp of bList) {
          if (bp.id) recordPixel(String(bp.id), bp.name ? String(bp.name) : undefined);
        }
      } catch {
        // non-fatal
      }
    }
  } catch (err: any) {
    // If core profile/pages fail, we re-throw to block discovery
    if (err.status === 401 || err.data?.error?.type === "OAuthException") {
      throw err;
    }
    console.error("Discovery encounter non-fatal core error:", err);
  }

  return assets;
}

// ── Provision Discovered Assets into Database ─────────────────────────────────

async function provisionDiscoveredAssets(
  assets: DiscoveredAssets,
  masterToken: string,
  expiresAt: string,
  user?: { id?: string; name?: string; email?: string }
) {
  // Store Master Meta Business credentials
  await persistCredentials("meta_business", {
    master_access_token: masterToken,
    user_id: user?.id || "",
    user_name: user?.name || "",
    business_id: assets.business?.id || "",
    business_name: assets.business?.name || "",
    expires_at: expiresAt,
    connected_at: new Date().toISOString(),
    discovered_assets: JSON.stringify(assets),
  });

  const now = new Date();

  // 1. Provision Primary Page -> Facebook
  const primaryPage = assets.pages[0];
  const primaryPixel = assets.pixels?.[0];
  if (primaryPage) {
    const existingFb = await getChannelCredentials("facebook");
    await persistCredentials("facebook", {
      page_id: primaryPage.id,
      page_name: primaryPage.name,
      page_access_token: primaryPage.accessToken,
      pixel_id: primaryPixel?.id || existingFb["pixel_id"] || "",
      source: "meta_business",
    });

    await db.insert(channelConfigsTable)
      .values({
        id: randomUUID(),
        channelId: "facebook",
        status: "CONNECTED",
        latency: 120,
        lastSync: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: channelConfigsTable.channelId,
        set: { status: "CONNECTED", lastSync: now, updatedAt: now },
      });

    await addEvent("facebook", "Auto-provisioned via Meta Business Suite", `Linked Facebook Page "${primaryPage.name}" (ID: ${primaryPage.id})`, "sync");

    // 2. Provision Instagram if linked to primary page or any discovered page
    const igPage = primaryPage.instagramAccount ? primaryPage : assets.pages.find((p) => p.instagramAccount);
    if (igPage?.instagramAccount) {
      await persistCredentials("instagram", {
        ig_user_id: igPage.instagramAccount.id,
        ig_username: igPage.instagramAccount.username,
        page_access_token: igPage.accessToken,
        source: "meta_business",
      });

      await db.insert(channelConfigsTable)
        .values({
          id: randomUUID(),
          channelId: "instagram",
          status: "CONNECTED",
          latency: 140,
          lastSync: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: channelConfigsTable.channelId,
          set: { status: "CONNECTED", lastSync: now, updatedAt: now },
        });

      await addEvent("instagram", "Auto-provisioned via Meta Business Suite", `Linked Instagram Account "@${igPage.instagramAccount.username}" (via Page "${igPage.name}")`, "sync");
    }
  }

  // 3. Provision Catalog -> Commerce
  const primaryCatalog = assets.catalogs[0];
  if (primaryCatalog) {
    const token = primaryPage?.accessToken || masterToken;
    await persistCredentials("commerce", {
      catalog_id: primaryCatalog.id,
      catalog_name: primaryCatalog.name,
      page_access_token: token,
      source: "meta_business",
    });

    await db.insert(channelConfigsTable)
      .values({
        id: randomUUID(),
        channelId: "commerce",
        status: "CONNECTED",
        latency: 110,
        lastSync: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: channelConfigsTable.channelId,
        set: { status: "CONNECTED", lastSync: now, updatedAt: now },
      });

    await db.insert(facebookConnectionsTable)
      .values({ id: randomUUID(), connectionKey: "commerce", active: true, updatedAt: now })
      .onConflictDoUpdate({
        target: facebookConnectionsTable.connectionKey,
        set: { active: true, updatedAt: now },
      });

    const existingFb = await getChannelCredentials("facebook");
    if (existingFb["page_id"]) {
      await persistCredentials("facebook", {
        ...existingFb,
        catalog_id: primaryCatalog.id,
        catalog_name: primaryCatalog.name,
      });
    }

    await addEvent("commerce", "Auto-provisioned via Meta Business Suite", `Linked Product Catalog "${primaryCatalog.name}" (ID: ${primaryCatalog.id})`, "sync");
  }

  // 4. Provision WhatsApp Business
  const primaryWaba = assets.whatsappAccounts[0];
  const primaryPhone = primaryWaba?.phones[0];
  if (primaryWaba && primaryPhone) {
    const existingWa = await getChannelCredentials("whatsapp");
    const verifyToken = existingWa["webhook_verify_token"] || `verify_${randomUUID().slice(0, 8)}`;
    
    await persistCredentials("whatsapp", {
      waba_id: primaryWaba.id,
      phone_number_id: primaryPhone.id,
      phone_number: primaryPhone.displayPhoneNumber,
      verified_name: primaryPhone.verifiedName || "",
      system_access_token: masterToken,
      webhook_verify_token: verifyToken,
      source: "meta_business",
    });

    await db.insert(channelConfigsTable)
      .values({
        id: randomUUID(),
        channelId: "whatsapp",
        status: "CONNECTED",
        latency: 130,
        lastSync: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: channelConfigsTable.channelId,
        set: { status: "CONNECTED", lastSync: now, updatedAt: now },
      });

    await addEvent("whatsapp", "Auto-provisioned via Meta Business Suite", `Linked WhatsApp Phone ${primaryPhone.displayPhoneNumber} (${primaryPhone.verifiedName || primaryWaba.name})`, "sync");
  }

  // 5. Provision Ad Account
  const primaryAd = assets.adAccounts[0];
  if (primaryAd) {
    await persistCredentials("ads", {
      ad_account_id: primaryAd.accountId,
      ad_account_name: primaryAd.name,
      page_access_token: masterToken,
      source: "meta_business",
    });

    await db.insert(channelConfigsTable)
      .values({
        id: randomUUID(),
        channelId: "ads",
        status: "CONNECTED",
        latency: 115,
        lastSync: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: channelConfigsTable.channelId,
        set: { status: "CONNECTED", lastSync: now, updatedAt: now },
      });

    await addEvent("ads", "Auto-provisioned via Meta Business Suite", `Linked Ad Account "${primaryAd.name}" (${primaryAd.accountId})`, "sync");
  }

  // 6. Provision Meta Pixel -> Facebook and Ads credentials & active connection
  if (primaryPixel) {
    const existingFb = await getChannelCredentials("facebook");
    await persistCredentials("facebook", {
      ...existingFb,
      pixel_id: primaryPixel.id,
      source: existingFb["source"] || "meta_business",
    });

    const existingAds = await getChannelCredentials("ads");
    await persistCredentials("ads", {
      ...existingAds,
      pixel_id: primaryPixel.id,
      source: existingAds["source"] || "meta_business",
    });

    await db.insert(facebookConnectionsTable)
      .values({ id: randomUUID(), connectionKey: "pixel", active: true, updatedAt: now })
      .onConflictDoUpdate({
        target: facebookConnectionsTable.connectionKey,
        set: { active: true, updatedAt: now },
      });

    await addEvent("facebook", "Auto-provisioned via Meta Business Suite", `Linked Meta Pixel "${primaryPixel.name}" (ID: ${primaryPixel.id})`, "sync");
  }

  await addEvent(
    "system",
    "Meta Business Suite Login Connected",
    `Consolidated auth established. Synchronized Facebook Page, Instagram, WhatsApp, Catalog, Ads, and Pixel.`,
    "sync"
  );
}

// ── HTML Response Builders for OAuth Popup ───────────────────────────────────

function renderOAuthSuccessHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meta Business Suite Connected</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f8fafc;
      color: #0b1c30;
      text-align: center;
      padding: 1.5rem;
    }
    .card {
      background: white;
      padding: 2.5rem;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
      max-width: 420px;
      width: 100%;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      background: #ecfdf5;
      color: #006c49;
      border-radius: 50%;
      margin-bottom: 1.25rem;
    }
    h2 { font-size: 1.35rem; margin: 0 0 0.5rem; font-weight: 700; }
    p { color: #64748b; font-size: 0.95rem; margin: 0 0 1.5rem; line-height: 1.5; }
    .status { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #006c49; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    </div>
    <h2>Authentication Successful</h2>
    <p>Your Meta Business Suite assets have been discovered and linked. This popup will close automatically.</p>
    <div class="status">Syncing channels...</div>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'meta' }, '*');
      setTimeout(function() { window.close(); }, 1200);
    } else {
      setTimeout(function() { window.location.href = '/admin/channels/meta-business?status=connected'; }, 1500);
    }
  </script>
</body>
</html>`;
}

function renderOAuthErrorHtml(errorMsg: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connection Failed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f8fafc;
      color: #0b1c30;
      text-align: center;
      padding: 1.5rem;
    }
    .card {
      background: white;
      padding: 2.5rem;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
      border: 1px solid #fee2e2;
      max-width: 420px;
      width: 100%;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      background: #fef2f2;
      color: #dc2626;
      border-radius: 50%;
      margin-bottom: 1.25rem;
    }
    h2 { font-size: 1.35rem; margin: 0 0 0.5rem; font-weight: 700; }
    p { color: #64748b; font-size: 0.95rem; margin: 0 0 1.5rem; line-height: 1.5; }
    .err-box { background: #fef2f2; color: #b91c1c; padding: 0.75rem; border-radius: 8px; font-size: 0.85rem; word-break: break-word; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </div>
    <h2>Connection Failed</h2>
    <p>We could not complete your Meta Business authentication.</p>
    <div class="err-box">${errorMsg}</div>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', provider: 'meta', error: ${JSON.stringify(errorMsg)} }, '*');
      setTimeout(function() { window.close(); }, 3500);
    }
  </script>
</body>
</html>`;
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /channels/meta/auth-url
 * Generates the Facebook Login for Business authorization dialog URL
 */
router.get("/channels/meta/auth-url", requireAdmin, (req: Request, res: Response) => {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  
  let configId = req.query.configId as string | undefined;
  if (configId === undefined) {
    configId = process.env.META_CONFIG_ID;
  } else if (configId === "") {
    configId = undefined; // Explicitly bypassed by client
  }
  
  const preset = (req.query.preset as string) || "all";
  const customScopes = req.query.scopes as string | undefined;

  const clientOrigin = typeof req.query.origin === "string" ? req.query.origin : undefined;
  const baseUrl = resolvePublicBaseUrl(req, clientOrigin);
  const redirectUri = `${baseUrl}/api/channels/meta/callback`;

  const configured = Boolean(appId && appSecret);
  const state = signOAuthState(req.adminUser?.id || "admin", redirectUri);

  if (!configured) {
    return res.json({
      configured: false,
      appId: null,
      redirectUri,
      url: null,
      message: "META_APP_ID and META_APP_SECRET are not configured in environment variables.",
    });
  }

  const oauthUrl = new URL(`https://www.facebook.com/${META_API_VERSION}/dialog/oauth`);
  oauthUrl.searchParams.set("client_id", appId!);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("state", state);
  oauthUrl.searchParams.set("response_type", "code");

  if (configId) {
    // Facebook Login for Business Configuration ID
    oauthUrl.searchParams.set("config_id", configId);
  } else {
    let scopes: string[] = [];
    if (customScopes) {
      scopes = customScopes.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (preset === "social") {
      scopes = [
        "email",
        "public_profile",
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_metadata",
        "pages_manage_posts",
        "instagram_basic",
        "instagram_content_publish",
        "business_management",
      ];
    } else if (preset === "commerce") {
      scopes = [
        "email",
        "public_profile",
        "pages_show_list",
        "catalog_management",
        "business_management",
      ];
    } else if (preset === "whatsapp") {
      scopes = [
        "email",
        "public_profile",
        "whatsapp_business_management",
        "whatsapp_business_messaging",
        "business_management",
      ];
    } else if (preset === "ads") {
      scopes = [
        "email",
        "public_profile",
        "ads_read",
        "ads_management",
        "business_management",
      ];
    } else {
      // Default: All granular permissions including catalog management
      scopes = [
        "email",
        "public_profile",
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_metadata",
        "pages_manage_posts",
        "instagram_basic",
        "instagram_content_publish",
        "catalog_management",
        "business_management",
        "whatsapp_business_management",
        "whatsapp_business_messaging",
        "ads_read",
        "ads_management",
        "commerce_account_read_settings",
        "commerce_account_manage_orders"
      ];
    }
    oauthUrl.searchParams.set("scope", scopes.join(","));
  }

  return res.json({
    configured: true,
    appId,
    redirectUri,
    url: oauthUrl.toString(),
  });
});

/**
 * GET /channels/meta/callback
 * Handles OAuth redirection from Facebook Login dialog in popup
 */
router.get("/channels/meta/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const error = (req.query.error_description || req.query.error) as string | undefined;

  if (error) {
    return res.status(400).send(renderOAuthErrorHtml(error));
  }

  if (!code || !state) {
    return res.status(400).send(renderOAuthErrorHtml("Missing authorization code or state token."));
  }

  const stateResult = verifyOAuthState(state);
  if (!stateResult.valid) {
    return res.status(403).send(renderOAuthErrorHtml(stateResult.error || "Security verification failed."));
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    return res.status(500).send(renderOAuthErrorHtml("Meta credentials missing on server."));
  }

  // Use the verified signed redirectUri from state, or compute with resolvePublicBaseUrl
  const redirectUri = stateResult.redirectUri || `${resolvePublicBaseUrl(req)}/api/channels/meta/callback`;

  try {
    // 1. Exchange code for short-lived access token
    const tokenUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = (await tokenRes.json()) as Record<string, unknown>;

    if (!tokenRes.ok || tokenData.error) {
      const errDetail = (tokenData.error as Record<string, string>)?.message || `HTTP ${tokenRes.status}`;
      return res.status(502).send(renderOAuthErrorHtml(`Token exchange failed: ${errDetail}`));
    }

    const shortLivedToken = String(tokenData.access_token);

    // 2. Exchange short-lived token for long-lived (~60-day) token
    const exchangeUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`);
    exchangeUrl.searchParams.set("grant_type", "fb_exchange_token");
    exchangeUrl.searchParams.set("client_id", appId);
    exchangeUrl.searchParams.set("client_secret", appSecret);
    exchangeUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const exchangeRes = await fetch(exchangeUrl.toString());
    const exchangeData = (await exchangeRes.json()) as Record<string, unknown>;

    const masterToken = exchangeData.access_token ? String(exchangeData.access_token) : shortLivedToken;
    const expiresInSec = typeof exchangeData.expires_in === "number" ? exchangeData.expires_in : 60 * 24 * 3600;
    const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

    // 3. Query user profile and business assets
    const meRes = await metaGet("/me", masterToken, { fields: "id,name,email" });
    const user = {
      id: meRes.data?.id ? String(meRes.data.id) : undefined,
      name: meRes.data?.name ? String(meRes.data.name) : undefined,
      email: meRes.data?.email ? String(meRes.data.email) : undefined,
    };

    const discoveredAssets = await discoverMetaAssets(masterToken);

    // 4. Provision assets into database
    await provisionDiscoveredAssets(discoveredAssets, masterToken, expiresAt, user);

    return res.send(renderOAuthSuccessHtml());
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return res.status(500).send(renderOAuthErrorHtml(`Integration error: ${detail}`));
  }
});

/**
 * GET /channels/meta/status
 * Returns current Meta Business Suite connection status, linked assets, and sub-channel states
 */
router.get("/channels/meta/status", requireAdmin, async (_req: Request, res: Response) => {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const configured = Boolean(appId && appSecret);

  const creds = await getChannelCredentials("meta_business");
  const isConnected = Boolean(creds.master_access_token && creds.master_access_token.length > 5);

  let discoveredAssets: DiscoveredAssets = {
    pages: [],
    catalogs: [],
    whatsappAccounts: [],
    adAccounts: [],
    pixels: [],
  };

  if (creds.discovered_assets) {
    try {
      discoveredAssets = JSON.parse(creds.discovered_assets);
      if (!discoveredAssets.pixels) discoveredAssets.pixels = [];
    } catch {
      // ignore
    }
  }

  // Check sub-channel status
  const subChannels = ["facebook", "instagram", "commerce", "ads", "whatsapp"];
  const configs = await db.select().from(channelConfigsTable);
  const configMap = new Map<string, { status: string }>(configs.map((c) => [c.channelId, c]));

  const [fbCreds, igCreds, commCreds, adsCreds, waCreds] = await Promise.all([
    getChannelCredentials("facebook"),
    getChannelCredentials("instagram"),
    getChannelCredentials("commerce"),
    getChannelCredentials("ads"),
    getChannelCredentials("whatsapp"),
  ]);

  const channelsStatus = {
    facebook: {
      connected: configMap.get("facebook")?.status === "CONNECTED",
      name: fbCreds.page_name,
      id: fbCreds.page_id,
      pixelId: fbCreds.pixel_id || undefined,
      source: fbCreds.source,
    },
    instagram: {
      connected: configMap.get("instagram")?.status === "CONNECTED",
      username: igCreds.ig_username,
      id: igCreds.ig_user_id,
      source: igCreds.source,
    },
    commerce: {
      connected: configMap.get("commerce")?.status === "CONNECTED",
      name: commCreds.catalog_name,
      id: commCreds.catalog_id,
      source: commCreds.source,
    },
    ads: {
      connected: configMap.get("ads")?.status === "CONNECTED",
      name: adsCreds.ad_account_name,
      id: adsCreds.ad_account_id,
      pixelId: fbCreds.pixel_id || adsCreds.pixel_id || undefined,
      source: adsCreds.source,
    },
    whatsapp: {
      connected: configMap.get("whatsapp")?.status === "CONNECTED",
      phone: waCreds.phone_number,
      verifiedName: waCreds.verified_name,
      source: waCreds.source,
    },
  };

  return res.json({
    configured,
    connected: isConnected,
    business: creds.business_id ? { id: creds.business_id, name: creds.business_name } : undefined,
    user: creds.user_id ? { id: creds.user_id, name: creds.user_name } : undefined,
    connectedAt: creds.connected_at,
    expiresAt: creds.expires_at,
    channelsStatus,
    assets: discoveredAssets,
  });
});

/**
 * POST /channels/meta/sync-assets
 * Re-queries Meta Graph API with master token to refresh all assets
 */
router.post("/channels/meta/sync-assets", requireAdmin, async (req: Request, res: Response) => {
  const creds = await getChannelCredentials("meta_business");
  if (!creds.master_access_token) {
    return res.status(400).json({ error: "Meta Business Suite is not connected." });
  }

  // If connected via dev sandbox
  if (creds.master_access_token === "dev_mock_master_token") {
    await addEvent("meta_business", "Assets Re-synchronized", "Sandbox assets verified.", "sync", await auditActor(req));
    return res.json({ ok: true, message: "Sandbox assets refreshed." });
  }

  try {
    const discoveredAssets = await discoverMetaAssets(creds.master_access_token);
    await provisionDiscoveredAssets(
      discoveredAssets,
      creds.master_access_token,
      creds.expires_at || new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
      { id: creds.user_id, name: creds.user_name }
    );

    await addEvent("meta_business", "Assets Re-synchronized", `Discovered ${discoveredAssets.pages.length} Pages, ${discoveredAssets.catalogs.length} Catalogs, ${discoveredAssets.whatsappAccounts.length} WhatsApp accounts, ${discoveredAssets.adAccounts.length} Ad accounts, ${discoveredAssets.pixels.length} Pixels.`, "sync", await auditActor(req));

    return res.json({ ok: true, assets: discoveredAssets });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: `Asset sync failed: ${detail}` });
  }
});

/**
 * POST /channels/meta/fetch-catalog
 * Directly queries Meta Graph API for a specific Catalog ID, validates permissions,
 * adds it to discovered assets, and immediately provisions/links it to Commerce & Facebook.
 */
router.post("/channels/meta/fetch-catalog", requireAdmin, async (req: Request, res: Response) => {
  const { catalogId } = req.body as { catalogId?: string };
  const cleanId = (catalogId || "").trim();

  if (!cleanId) {
    return res.status(400).json({ error: "Catalog ID is required." });
  }

  const metaCreds = await getChannelCredentials("meta_business");
  const masterToken = metaCreds["master_access_token"];

  if (!masterToken) {
    return res.status(400).json({ error: "Meta Business Suite is not connected. Connect via Meta OAuth first." });
  }

  try {
    const catRes = await metaGet(`/${cleanId}`, masterToken, {
      fields: "id,name,vertical,product_count",
    });

    const catalogData = catRes.data;
    if (!catalogData?.id) {
      return res.status(404).json({ error: `Catalog ${cleanId} was not found on Meta Graph API.` });
    }

    const catalog: DiscoveredCatalog = {
      id: String(catalogData.id),
      name: String(catalogData.name || `Catalog ${cleanId}`),
      vertical: catalogData.vertical ? String(catalogData.vertical) : undefined,
      productCount: typeof catalogData.product_count === "number" ? catalogData.product_count : undefined,
    };

    let assets: DiscoveredAssets = { pages: [], catalogs: [], whatsappAccounts: [], adAccounts: [], pixels: [] };
    if (metaCreds.discovered_assets) {
      try {
        assets = JSON.parse(metaCreds.discovered_assets);
      } catch {}
    }
    if (!Array.isArray(assets.catalogs)) assets.catalogs = [];
    const exists = assets.catalogs.some((c) => c.id === catalog.id);
    if (!exists) {
      assets.catalogs.push(catalog);
    } else {
      assets.catalogs = assets.catalogs.map((c) => (c.id === catalog.id ? catalog : c));
    }

    await persistCredentials("meta_business", {
      ...metaCreds,
      discovered_assets: JSON.stringify(assets),
    });

    const commCreds = await getChannelCredentials("commerce");
    const fbCreds = await getChannelCredentials("facebook");
    const token = fbCreds["page_access_token"] || masterToken;

    await persistCredentials("commerce", {
      ...commCreds,
      catalog_id: catalog.id,
      catalog_name: catalog.name,
      page_access_token: token,
      source: "meta_business",
    });

    if (fbCreds["page_id"]) {
      await persistCredentials("facebook", {
        ...fbCreds,
        catalog_id: catalog.id,
        catalog_name: catalog.name,
      });
    }

    const now = new Date();
    await db.insert(channelConfigsTable)
      .values({
        id: randomUUID(),
        channelId: "commerce",
        status: "CONNECTED",
        latency: 110,
        lastSync: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: channelConfigsTable.channelId,
        set: { status: "CONNECTED", lastSync: now, updatedAt: now },
      });

    await db.insert(facebookConnectionsTable)
      .values({ id: randomUUID(), connectionKey: "commerce", active: true, updatedAt: now })
      .onConflictDoUpdate({
        target: facebookConnectionsTable.connectionKey,
        set: { active: true, updatedAt: now },
      });

    await addEvent("commerce", "Meta Catalog Linked via Direct Fetch", `Catalog "${catalog.name}" (ID: ${catalog.id}) fetched and activated.`, "sync", await auditActor(req));

    return res.json({ ok: true, catalog, message: `Catalog "${catalog.name}" (${catalog.id}) successfully fetched and linked.` });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return res.status(502).json({
      error: `Meta Graph API error fetching catalog ${cleanId}: ${detail}. Verify that your Meta user has access permissions to this Catalog ID.`,
    });
  }
});

/**
 * POST /channels/meta/select-asset
 * Selects an active asset (e.g. switch active Page, Catalog, WhatsApp phone, Ad Account, or Pixel)
 */
router.post("/channels/meta/select-asset", requireAdmin, async (req: Request, res: Response) => {
  const { assetType, assetId, subId } = req.body as {
    assetType: "page" | "catalog" | "whatsapp" | "adAccount" | "pixel";
    assetId: string;
    subId?: string;
  };

  const creds = await getChannelCredentials("meta_business");
  if (!creds.discovered_assets) {
    return res.status(400).json({ error: "No discovered assets available." });
  }

  const assets: DiscoveredAssets = JSON.parse(creds.discovered_assets);
  const now = new Date();

  if (assetType === "page") {
    const page = assets.pages.find((p) => p.id === assetId);
    if (!page) return res.status(404).json({ error: "Page not found in discovered assets." });

    await persistCredentials("facebook", {
      page_id: page.id,
      page_name: page.name,
      page_access_token: page.accessToken,
      source: "meta_business",
    });

    await db.insert(channelConfigsTable)
      .values({
        id: randomUUID(),
        channelId: "facebook",
        status: "CONNECTED",
        latency: 120,
        lastSync: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: channelConfigsTable.channelId,
        set: { status: "CONNECTED", lastSync: now, updatedAt: now },
      });

    // Ensure connection is marked as active in facebook_connections table
    await db.insert(facebookConnectionsTable)
      .values({ id: randomUUID(), connectionKey: "facebook", active: true, updatedAt: now })
      .onConflictDoUpdate({
        target: facebookConnectionsTable.connectionKey,
        set: { active: true, updatedAt: now },
      });

    if (page.instagramAccount) {
      await persistCredentials("instagram", {
        ig_user_id: page.instagramAccount.id,
        ig_username: page.instagramAccount.username,
        page_access_token: page.accessToken,
        source: "meta_business",
      });

      await db.insert(channelConfigsTable)
        .values({
          id: randomUUID(),
          channelId: "instagram",
          status: "CONNECTED",
          latency: 140,
          lastSync: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: channelConfigsTable.channelId,
          set: { status: "CONNECTED", lastSync: now, updatedAt: now },
        });

      // Ensure instagram connection is marked as active
      await db.insert(facebookConnectionsTable)
        .values({ id: randomUUID(), connectionKey: "instagram", active: true, updatedAt: now })
        .onConflictDoUpdate({
          target: facebookConnectionsTable.connectionKey,
          set: { active: true, updatedAt: now },
        });

      await addEvent("instagram", "Active Instagram Account Linked", `Linked Instagram Account "@${page.instagramAccount.username}" via page "${page.name}"`, "sync", await auditActor(req));
    }

    await addEvent("facebook", "Active Page Selected", `Switched active page to "${page.name}" (ID: ${page.id})`, "info", await auditActor(req));
  } else if (assetType === "catalog") {
    let catalog = assets.catalogs.find((c) => c.id === assetId);

    // If not in cache, probe Meta Graph API directly with master token
    if (!catalog && creds.master_access_token) {
      try {
        const catRes = await metaGet(`/${assetId}`, creds.master_access_token, {
          fields: "id,name,vertical,product_count",
        });
        if (catRes.data?.id) {
          catalog = {
            id: String(catRes.data.id),
            name: String(catRes.data.name || `Catalog ${assetId}`),
            vertical: catRes.data.vertical ? String(catRes.data.vertical) : undefined,
            productCount: typeof catRes.data.product_count === "number" ? catRes.data.product_count : undefined,
          };
          assets.catalogs.push(catalog);
          await persistCredentials("meta_business", {
            ...creds,
            discovered_assets: JSON.stringify(assets),
          });
        }
      } catch {}
    }

    if (!catalog) return res.status(404).json({ error: "Catalog not found in discovered assets or Meta Graph API." });

    const existingComm = await getChannelCredentials("commerce");
    await persistCredentials("commerce", {
      ...existingComm,
      catalog_id: catalog.id,
      catalog_name: catalog.name,
      source: "meta_business",
    });

    await db.insert(channelConfigsTable)
      .values({
        id: randomUUID(),
        channelId: "commerce",
        status: "CONNECTED",
        latency: 110,
        lastSync: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: channelConfigsTable.channelId,
        set: { status: "CONNECTED", lastSync: now, updatedAt: now },
      });

    await db.insert(facebookConnectionsTable)
      .values({ id: randomUUID(), connectionKey: "commerce", active: true, updatedAt: now })
      .onConflictDoUpdate({
        target: facebookConnectionsTable.connectionKey,
        set: { active: true, updatedAt: now },
      });

    const existingFb = await getChannelCredentials("facebook");
    if (existingFb["page_id"]) {
      await persistCredentials("facebook", {
        ...existingFb,
        catalog_id: catalog.id,
        catalog_name: catalog.name,
      });
    }

    await addEvent("commerce", "Active Catalog Selected", `Switched active catalog to "${catalog.name}" (ID: ${catalog.id})`, "info", await auditActor(req));
  } else if (assetType === "whatsapp") {
    const waba = assets.whatsappAccounts.find((w) => w.id === assetId);
    if (!waba) return res.status(404).json({ error: "WhatsApp account not found." });

    const phone = subId ? waba.phones.find((p) => p.id === subId) : waba.phones[0];
    if (!phone) return res.status(404).json({ error: "WhatsApp phone number not found." });

    const existingWa = await getChannelCredentials("whatsapp");
    const verifyToken = existingWa["webhook_verify_token"] || `verify_${randomUUID().slice(0, 8)}`;

    await persistCredentials("whatsapp", {
      waba_id: waba.id,
      phone_number_id: phone.id,
      phone_number: phone.displayPhoneNumber,
      verified_name: phone.verifiedName || "",
      system_access_token: creds.master_access_token || "",
      webhook_verify_token: verifyToken,
      source: "meta_business",
    });

    await db.insert(channelConfigsTable)
      .values({
        id: randomUUID(),
        channelId: "whatsapp",
        status: "CONNECTED",
        latency: 130,
        lastSync: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: channelConfigsTable.channelId,
        set: { status: "CONNECTED", lastSync: now, updatedAt: now },
      });

    await addEvent("whatsapp", "Active Phone Selected", `Switched WhatsApp number to ${phone.displayPhoneNumber}`, "info", await auditActor(req));
  } else if (assetType === "adAccount") {
    const ad = assets.adAccounts.find((a) => a.id === assetId || a.accountId === assetId);
    if (!ad) return res.status(404).json({ error: "Ad account not found." });

    await persistCredentials("ads", {
      ad_account_id: ad.accountId,
      ad_account_name: ad.name,
      page_access_token: creds.master_access_token || "",
      source: "meta_business",
    });

    await db.insert(channelConfigsTable)
      .values({
        id: randomUUID(),
        channelId: "ads",
        status: "CONNECTED",
        latency: 115,
        lastSync: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: channelConfigsTable.channelId,
        set: { status: "CONNECTED", lastSync: now, updatedAt: now },
      });

    await addEvent("ads", "Active Ad Account Selected", `Switched active ad account to "${ad.name}"`, "info", await auditActor(req));
  } else if (assetType === "pixel") {
    const pixel = assets.pixels?.find((p) => p.id === assetId);
    if (!pixel) return res.status(404).json({ error: "Pixel not found in discovered assets." });

    const existingFb = await getChannelCredentials("facebook");
    await persistCredentials("facebook", {
      ...existingFb,
      pixel_id: pixel.id,
      source: existingFb["source"] || "meta_business",
    });

    const existingAds = await getChannelCredentials("ads");
    await persistCredentials("ads", {
      ...existingAds,
      pixel_id: pixel.id,
      source: existingAds["source"] || "meta_business",
    });

    await db.insert(facebookConnectionsTable)
      .values({ id: randomUUID(), connectionKey: "pixel", active: true, updatedAt: now })
      .onConflictDoUpdate({
        target: facebookConnectionsTable.connectionKey,
        set: { active: true, updatedAt: now },
      });

    await addEvent("facebook", "Active Pixel Selected", `Switched active Meta Pixel to "${pixel.name}" (ID: ${pixel.id})`, "info", await auditActor(req));
  }

  // Update meta_business channel config to reflect latest activity
  await db.update(channelConfigsTable)
    .set({ lastSync: now, updatedAt: now })
    .where(eq(channelConfigsTable.channelId, "meta_business"));

  return res.json({ ok: true });
});

/**
 * POST /channels/meta/disconnect
 * Disconnects Meta Business Suite and resets auto-provisioned channels
 */
router.post("/channels/meta/disconnect", requireAdmin, async (req: Request, res: Response) => {
  // Completely remove the meta_business credentials row
  await db.delete(channelCredentialsTable)
    .where(eq(channelCredentialsTable.channel, "meta_business"));

  // Reset any channels whose credentials came from meta_business
  const subChannels = ["facebook", "instagram", "commerce", "ads", "whatsapp"];
  for (const ch of subChannels) {
    const chCreds = await getChannelCredentials(ch);
    if (chCreds.source === "meta_business") {
      // Remove sub-channel credentials if they were linked
      await db.delete(channelCredentialsTable)
        .where(eq(channelCredentialsTable.channel, ch));
      
      await db.update(channelConfigsTable)
        .set({ status: "DISCONNECTED", latency: 0, updatedAt: new Date() })
        .where(eq(channelConfigsTable.channelId, ch));
      
      await addEvent(ch, "Disconnected via Meta Business Suite", "Channel credentials removed and unlinked as master account was disconnected.", "warning", await auditActor(req));
    }
  }

  // Deactivate all facebook connections to ensure a clean slate
  await db.update(facebookConnectionsTable)
    .set({ active: false, updatedAt: new Date() });

  await addEvent(
    "system",
    "Meta Suite Disconnected",
    "Meta Business Suite disconnected and credentials removed from database.",
    "warning",
    await auditActor(req)
  );

  return res.json({ ok: true, message: "Meta Business Suite disconnected and all credentials purged." });
});

export default router;
