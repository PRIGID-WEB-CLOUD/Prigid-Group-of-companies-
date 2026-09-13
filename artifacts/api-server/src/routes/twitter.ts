import { Router } from "express";
import { randomUUID, createHmac, createHash } from "crypto";
import { addEvent, getChannelCredentials, persistCredentials, encryptSecret, decryptSecret } from "./channels";
import { requireAdmin } from "../middleware/requireAdmin";
import { db, twitterHashtagsTable, twitterAutoRulesTable, twitterTweetQueueTable, twitterContentTemplatesTable, twitterSchedulerSettingsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router = Router();
router.use("/twitter", requireAdmin);
router.use("/channels/twitter", requireAdmin);

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTwCreds() { return getChannelCredentials("twitter"); }

function oauthSign(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string,
): string {
  const enc = encodeURIComponent;
  const sorted = Object.entries(params).sort(([a], [b]) => (a < b ? -1 : 1));
  const paramStr = sorted.map(([k, v]) => `${enc(k)}=${enc(v)}`).join("&");
  const base = `${method.toUpperCase()}&${enc(url)}&${enc(paramStr)}`;
  const sigKey = `${enc(consumerSecret)}&${enc(tokenSecret)}`;
  return createHmac("sha1", sigKey).update(base).digest("base64");
}

// ── Hashtag Routes ────────────────────────────────────────────────────────────

router.get("/twitter/hashtags", async (_req, res) => {
  return res.json(await db.select().from(twitterHashtagsTable).orderBy(desc(twitterHashtagsTable.createdAt)));
});

router.post("/twitter/hashtags", async (req, res) => {
  const { tag } = req.body as { tag: string };
  const [ht] = await db.insert(twitterHashtagsTable).values({ id: randomUUID(), tag }).returning();
  return res.status(201).json(ht);
});

router.delete("/twitter/hashtags/:id", async (req, res) => {
  await db.delete(twitterHashtagsTable).where(eq(twitterHashtagsTable.id, req.params.id as string));
  return res.json({ ok: true });
});

// ── Auto-rule Routes ──────────────────────────────────────────────────────────

router.get("/twitter/rules", async (_req, res) => {
  return res.json(await db.select().from(twitterAutoRulesTable).orderBy(desc(twitterAutoRulesTable.createdAt)));
});

router.post("/twitter/rules", async (req, res) => {
  const { trigger, action, template, active } = req.body as { trigger: string; action: string; template?: string; active?: boolean };
  const [rule] = await db.insert(twitterAutoRulesTable).values({
    id: randomUUID(), trigger, action, template: template ?? "default", active: active ?? true,
  }).returning();
  return res.status(201).json(rule);
});

router.put("/twitter/rules/:id", async (req, res) => {
  const [rule] = await db.update(twitterAutoRulesTable)
    .set({ active: Boolean(req.body.active) })
    .where(eq(twitterAutoRulesTable.id, req.params.id as string)).returning();
  if (!rule) return res.status(404).json({ error: "Rule not found" });
  return res.json(rule);
});

// ── Queue Routes ──────────────────────────────────────────────────────────────

router.get("/twitter/queue", async (_req, res) => {
  return res.json(await db.select().from(twitterTweetQueueTable).orderBy(desc(twitterTweetQueueTable.createdAt)));
});

router.post("/twitter/queue", async (req, res) => {
  const { text, scheduledFor, status, imageStyle } = req.body as { text: string; scheduledFor?: string; status?: string; imageStyle?: string };
  const [tweet] = await db.insert(twitterTweetQueueTable).values({
    id: randomUUID(), text, scheduledFor: scheduledFor ?? "", status: status ?? "Queued", imageStyle: imageStyle ?? "None",
  }).returning();
  return res.status(201).json(tweet);
});

router.put("/twitter/queue/:id", async (req, res) => {
  const [tweet] = await db.update(twitterTweetQueueTable)
    .set({ status: String(req.body.status) })
    .where(eq(twitterTweetQueueTable.id, req.params.id as string)).returning();
  if (!tweet) return res.status(404).json({ error: "Tweet not found" });
  return res.json(tweet);
});

router.delete("/twitter/queue/:id", async (req, res) => {
  await db.delete(twitterTweetQueueTable).where(eq(twitterTweetQueueTable.id, req.params.id as string));
  return res.json({ ok: true });
});

// ── Template Routes ───────────────────────────────────────────────────────────

router.get("/twitter/templates", async (_req, res) => {
  return res.json(await db.select().from(twitterContentTemplatesTable).orderBy(desc(twitterContentTemplatesTable.createdAt)));
});

router.post("/twitter/templates", async (req, res) => {
  const { name, body } = req.body as { name: string; body: string };
  const [tpl] = await db.insert(twitterContentTemplatesTable).values({ id: randomUUID(), name, body }).returning();
  return res.status(201).json(tpl);
});

router.put("/twitter/templates/:id/use", async (req, res) => {
  const [tpl] = await db.select().from(twitterContentTemplatesTable)
    .where(eq(twitterContentTemplatesTable.id, req.params.id as string)).limit(1);
  if (!tpl) return res.status(404).json({ error: "Template not found" });
  const [updated] = await db.update(twitterContentTemplatesTable)
    .set({ usageCount: tpl.usageCount + 1 })
    .where(eq(twitterContentTemplatesTable.id, tpl.id)).returning();
  return res.json(updated);
});

// ── Scheduler Routes ──────────────────────────────────────────────────────────

router.get("/twitter/scheduler", async (_req, res) => {
  const [scheduler] = await db.select().from(twitterSchedulerSettingsTable)
    .where(eq(twitterSchedulerSettingsTable.id, "default")).limit(1);
  return res.json(scheduler ?? { id: "default", schedulerOn: false, dropFrequency: "Daily Digest (6 PM)", imageStyle: "Product Photo" });
});

router.put("/twitter/scheduler", async (req, res) => {
  const [scheduler] = await db.insert(twitterSchedulerSettingsTable).values({
    id: "default",
    schedulerOn: Boolean(req.body.schedulerOn ?? false),
    dropFrequency: String(req.body.dropFrequency ?? "Daily Digest (6 PM)"),
    imageStyle: String(req.body.imageStyle ?? "Product Photo"),
  }).onConflictDoUpdate({
    target: twitterSchedulerSettingsTable.id,
    set: {
      schedulerOn: Boolean(req.body.schedulerOn ?? false),
      dropFrequency: String(req.body.dropFrequency ?? "Daily Digest (6 PM)"),
      imageStyle: String(req.body.imageStyle ?? "Product Photo"),
      updatedAt: new Date(),
    },
  }).returning();
  return res.json(scheduler);
});

import { logger } from "../lib/logger";

// Standard OAuth 2.0 Scopes required for X (Twitter) API v2 user context & posting
const TWITTER_OAUTH_SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"];

// ── Live: Twitter/X Me ────────────────────────────────────────────────────────

router.get("/twitter/me", async (req, res) => {
  const creds = await getTwCreds();
  
  let origin = "";
  if (req.headers.referer) {
    try {
      const u = new URL(req.headers.referer);
      if (u.origin && !u.origin.includes("127.0.0.1") && !u.origin.includes("localhost")) {
        origin = u.origin;
      }
    } catch {}
  }
  if (!origin) {
    const host = req.get("host") || "localhost:3000";
    const protocol = req.protocol || "https";
    origin = `${protocol}://${host}`;
  }
  const callbackUrl = `${origin}/api/twitter/callback`;

  const hasOauth1 = 
    creds["api_key"]?.trim() && 
    creds["api_secret"]?.trim() && 
    creds["access_token"]?.trim() && 
    creds["access_token_secret"]?.trim();

  const bearerToken = creds["bearer_token"]?.trim();

  if (!hasOauth1 && !bearerToken) {
    return res.json({ connected: false, error: "Not configured" });
  }

  const endpointUrl = "https://api.twitter.com/2/users/me";
  const queryParams: Record<string, string> = {
    "user.fields": "name,username,profile_image_url,public_metrics,description",
  };

  try {
    let r: Response;
    let authMethodUsed = "OAuth 1.0a User Context";

    if (hasOauth1) {
      const oauthParams: Record<string, string> = {
        oauth_consumer_key:     creds["api_key"]!,
        oauth_token:            creds["access_token"]!,
        oauth_signature_method: "HMAC-SHA1",
        oauth_version:          "1.0",
        oauth_timestamp:        String(Math.floor(Date.now() / 1000)),
        oauth_nonce:            randomUUID().replace(/-/g, ""),
      };

      const signatureParams = { ...oauthParams, ...queryParams };
      oauthParams["oauth_signature"] = oauthSign(
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

      r = await fetch(fullUrl, {
        headers: { Authorization: authHeader },
      });

      if (!r.ok && (r.status === 401 || r.status === 403) && bearerToken) {
        authMethodUsed = "Bearer Token Fallback";
        const queryStringFallback = new URLSearchParams(queryParams).toString();
        const fallbackUrl = `${endpointUrl}?${queryStringFallback}`;
        r = await fetch(fallbackUrl, {
          headers: { Authorization: `Bearer ${bearerToken}` },
        });
      }
    } else {
      authMethodUsed = "OAuth 2.0 App Bearer Token";
      const queryString = new URLSearchParams(queryParams).toString();
      const fullUrl = `${endpointUrl}?${queryString}`;

      r = await fetch(fullUrl, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
    }

    const text = await r.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawText: text };
    }

    if (!r.ok) {
      if (r.status === 401 || r.status === 403) {
        console.warn(`[Twitter/X API Warning ${r.status}] /2/users/me returned ${r.status} (Authentication not configured or token expired).`);
        return res.json({ connected: false, error: `X API authentication error (${r.status})`, callbackUrl, requestedScopes: TWITTER_OAUTH_SCOPES });
      }

      const errDetail = (data["detail"] as string) ?? (data["title"] as string) ?? (data["error"] as string) ?? `HTTP ${r.status}`;
      return res.status(r.status).json({
        error: `X API Error (${r.status}): ${errDetail}`,
        status: r.status,
        details: data,
        callbackUrl,
        requestedScopes: TWITTER_OAUTH_SCOPES,
      });
    }

    return res.json(data);
  } catch (err) {
    console.error("[Twitter/X Connection Error]", err);
    logger.error({ err }, "Exception while requesting Twitter /2/users/me");
    return res.status(500).json({
      error: `Unable to connect to X API: ${err instanceof Error ? err.message : String(err)}`,
      callbackUrl,
      requestedScopes: TWITTER_OAUTH_SCOPES,
    });
  }
});

// ── Live: Publish Tweet ───────────────────────────────────────────────────────

router.post("/twitter/posts/publish", async (req, res) => {
  const creds = await getTwCreds();
  let { text, taggedProducts } = req.body as { text: string; taggedProducts?: Array<{ id: string; name: string; price: number; slug?: string }> };
  if (!text?.trim()) return res.status(400).json({ error: "Tweet text is required." });

  const bearerToken = creds["bearer_token"]?.trim();

  // If we have an OAuth 2.0 User Access Token (bearer_token), we can post directly using it!
  if (bearerToken) {
    try {
      console.log(`[Twitter/X Publish] POST /2/tweets via OAuth 2.0 User Access Token: "${text.slice(0, 50)}…"`);
      const r = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${bearerToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      });

      const responseText = await r.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(responseText); } catch { data = { rawText: responseText }; }

      if (!r.ok) {
        console.error(`[Twitter/X Publish Error ${r.status}]`, JSON.stringify(data, null, 2));
        logger.error({ status: r.status, response: data }, "Failed to publish tweet via OAuth 2.0");
        return res.status(r.status).json({
          error: (data["detail"] as string) ?? (data["title"] as string) ?? `HTTP ${r.status}`,
          details: data,
          status: r.status,
        });
      }

      const tagCount = taggedProducts?.length || 0;
      const tagSuffix = tagCount > 0 ? ` [${tagCount} product${tagCount > 1 ? "s" : ""} tagged]` : "";
      addEvent("twitter", "Tweet published", `"${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"${tagSuffix}`, "sync");
      const [queued] = await db.insert(twitterTweetQueueTable).values({
        id: randomUUID(), text,
        scheduledFor: new Date().toISOString(),
        status: "Published", imageStyle: tagCount > 0 ? "Product Card" : "None",
      }).returning();

      console.log("[Twitter/X Publish Success] Tweet posted successfully via OAuth 2.0:", data);
      return res.json({ tweet: (data["data"] as Record<string, unknown>), queued, taggedProducts });
    } catch (err) {
      console.error("[Twitter/X Publish Exception via OAuth 2.0]", err);
      logger.error({ err }, "Exception during tweet publish via OAuth 2.0");
      return res.status(500).json({ error: String(err) });
    }
  }

  // Otherwise, fallback to OAuth 1.0a signatures!
  const requiredKeys = ["api_key", "api_secret", "access_token", "access_token_secret"];
  const missing = requiredKeys.filter((k) => !creds[k]?.trim());
  if (missing.length > 0) {
    console.warn(`[Twitter/X Publish] Missing required OAuth 1.0a or OAuth 2.0 credentials.`);
    return res.status(400).json({ error: "Missing Twitter credentials. Please use 'Connect with X' or enter API Key & Access Tokens." });
  }

  try {
    const tweetUrl = "https://api.twitter.com/2/tweets";
    const oauthParams: Record<string, string> = {
      oauth_consumer_key:     creds["api_key"]!,
      oauth_token:            creds["access_token"]!,
      oauth_signature_method: "HMAC-SHA1",
      oauth_version:          "1.0",
      oauth_timestamp:        String(Math.floor(Date.now() / 1000)),
      oauth_nonce:            randomUUID().replace(/-/g, ""),
    };
    oauthParams["oauth_signature"] = oauthSign(
      "POST", tweetUrl, oauthParams,
      creds["api_secret"]!,
      creds["access_token_secret"]!,
    );
    const authHeader =
      "OAuth " +
      Object.entries(oauthParams)
        .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
        .join(", ");

    console.log(`[Twitter/X Publish] POST /2/tweets payload: "${text.slice(0, 50)}…"`);

    const r = await fetch(tweetUrl, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const responseText = await r.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { rawText: responseText };
    }

    if (!r.ok) {
      console.error(`[Twitter/X Publish Error ${r.status}]`, JSON.stringify(data, null, 2));
      logger.error({ status: r.status, response: data }, "Failed to publish tweet to Twitter API");
      return res.status(r.status).json({
        error: (data["detail"] as string) ?? (data["title"] as string) ?? `HTTP ${r.status}`,
        details: data,
        status: r.status,
      });
    }

    addEvent("twitter", "Tweet published", `"${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`, "sync");
    const [queued] = await db.insert(twitterTweetQueueTable).values({
      id: randomUUID(), text,
      scheduledFor: new Date().toISOString(),
      status: "Published", imageStyle: "None",
    }).returning();

    console.log("[Twitter/X Publish Success] Tweet posted successfully:", data);
    return res.json({ tweet: (data["data"] as Record<string, unknown>), queued });
  } catch (err) {
    console.error("[Twitter/X Publish Exception]", err);
    logger.error({ err }, "Exception during tweet publish");
    return res.status(500).json({ error: String(err) });
  }
});

// ── Verify credentials ────────────────────────────────────────────────────────

router.get("/twitter/verify", async (_req, res) => {
  const creds = await getTwCreds();
  const bearerToken = creds["bearer_token"] || creds["access_token"];
  if (!bearerToken) {
    return res.status(400).json({ ok: false, error: "Missing Twitter Bearer Token — add credentials in channel settings." });
  }
  try {
    const r = await fetch(
      "https://api.twitter.com/2/users/me?user.fields=name,username,profile_image_url",
      { headers: { Authorization: `Bearer ${bearerToken}` } },
    );
    const text = await r.text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(text); } catch { data = { rawText: text }; }

    if (r.ok) {
      return res.json({ ok: true, user: (data["data"] as Record<string, unknown>) });
    }
    console.error(`[Twitter/X Verify Error ${r.status}]`, data);
    logger.error({ status: r.status, response: data }, "Twitter verify failed");
    return res.json({ ok: false, error: `Twitter API returned HTTP ${r.status}`, details: data });
  } catch (err) {
    console.error("[Twitter/X Verify Exception]", err);
    logger.error({ err }, "Exception during Twitter verify");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── OAuth 2.0 PKCE Authorization ──────────────────────────────────────────────

router.get("/twitter/auth-url", async (req, res) => {
  const creds = await getTwCreds();
  
  let origin = "";
  if (req.headers.referer) {
    try {
      const u = new URL(req.headers.referer);
      if (u.origin && !u.origin.includes("127.0.0.1") && !u.origin.includes("localhost")) {
        origin = u.origin;
      }
    } catch {}
  }
  if (!origin) {
    const host = req.get("host") || "localhost:3000";
    const protocol = req.protocol || "https";
    origin = `${protocol}://${host}`;
  }
  const callbackUrl = `${origin}/api/twitter/callback`;

  const client_id = creds["client_id"] || process.env.TWITTER_CLIENT_ID;
  const client_secret = creds["client_secret"] || process.env.TWITTER_CLIENT_SECRET;

  if (!client_id?.trim()) {
    return res.status(400).json({
      error: "Missing OAuth 2.0 Client ID. Please configure your OAuth 2.0 Client ID and Secret in X API Credentials first.",
    });
  }

  try {
    // Generate high-entropy code verifier
    const code_verifier = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    
    // Compute SHA256 challenge (base64url format)
    const code_challenge = createHash("sha256")
      .update(code_verifier)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Encrypt code_verifier and callbackUrl stateless inside state so callback is immune to cookie iframe session issues or dynamic proxy mismatches
    const statePayload = JSON.stringify({ code_verifier, callbackUrl, ts: Date.now() });
    const state = encryptSecret(statePayload);

    const scopes = TWITTER_OAUTH_SCOPES.join(" ");
    const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(client_id.trim())}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(code_challenge)}&code_challenge_method=S256`;

    console.log(`[Twitter/X OAuth PKCE] Generated Auth URL successfully for Client ID: ${client_id}`);
    return res.json({ authUrl, callbackUrl });
  } catch (err) {
    console.error("[Twitter/X Auth URL Exception]", err);
    return res.status(500).json({ error: String(err) });
  }
});

// OAuth 2.0 Callback
router.get("/twitter/callback", async (req, res) => {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    console.error("[Twitter/X OAuth Callback Error]", oauthError);
    return res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; color: #ba1a1a;">
          <h2>Authentication Failed</h2>
          <p>${oauthError}</p>
          <button onclick="window.close()" style="padding: 10px 20px; background: #000; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Close Window</button>
        </body>
      </html>
    `);
  }

  if (!code || !state) {
    return res.status(400).send("Authorization code and state are required.");
  }

  try {
    // Decrypt the code_verifier and callbackUrl from state
    const decryptedState = JSON.parse(decryptSecret(state as string));
    const { code_verifier, callbackUrl, ts } = decryptedState;

    if (!code_verifier || !callbackUrl || Date.now() - ts > 600000) {
      throw new Error("State has expired or is invalid. Please try initiating authorization again.");
    }

    const creds = await getTwCreds();
    const client_id = creds["client_id"] || process.env.TWITTER_CLIENT_ID;
    const client_secret = creds["client_secret"] || process.env.TWITTER_CLIENT_SECRET;

    if (!client_id) {
      throw new Error("OAuth 2.0 Client ID is missing.");
    }

    const tokenParams = new URLSearchParams({
      code: code as string,
      grant_type: "authorization_code",
      client_id: client_id.trim(),
      redirect_uri: callbackUrl,
      code_verifier,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (client_secret?.trim()) {
      headers["Authorization"] = "Basic " + Buffer.from(`${client_id.trim()}:${client_secret.trim()}`).toString("base64");
    }

    console.log("[Twitter/X OAuth Code Exchange] Requesting token exchange...");
    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers,
      body: tokenParams.toString(),
    });

    const text = await tokenRes.text();
    let tokenData: Record<string, unknown> = {};
    try { tokenData = JSON.parse(text); } catch { tokenData = { rawText: text }; }

    if (!tokenRes.ok) {
      console.error("[Twitter/X OAuth Code Exchange Error]", tokenData);
      throw new Error(`Token exchange failed: ${tokenData.error_description || tokenData.error || text}`);
    }

    const access_token = tokenData.access_token as string;
    const refresh_token = tokenData.refresh_token as string;

    // Save newly acquired tokens to credentials table
    const updatedCreds = {
      ...creds,
      bearer_token: access_token, // OAuth 2.0 Access Token
      access_token: access_token, // Paired for backward compatibility
    };
    if (refresh_token) {
      updatedCreds["refresh_token"] = refresh_token;
    }

    await persistCredentials("twitter", updatedCreds);
    addEvent("twitter", "OAuth Account connected", "Successfully logged in via 'Connect with X' OAuth.", "sync");

    console.log("[Twitter/X OAuth Code Exchange Success] Credentials saved securely.");

    return res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #fafafa; color: #0b1c30;">
          <h2 style="font-family: serif; font-size: 24px; margin-bottom: 10px;">Connection Successful!</h2>
          <p style="color: #7c839b; font-size: 14px; margin-bottom: 24px;">Your X (Twitter) account was successfully linked to Luxe Boutique.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: "TWITTER_OAUTH_SUCCESS" }, "*");
            }
            window.close();
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("[Twitter/X OAuth Exchange Exception]", err);
    return res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; color: #ba1a1a;">
          <h2>Connection Failed</h2>
          <p>${err instanceof Error ? err.message : String(err)}</p>
          <button onclick="window.close()" style="padding: 10px 20px; background: #000; color: #fff; border: none; border-radius: 6px; cursor: pointer; margin-top: 20px;">Close Window</button>
        </body>
      </html>
    `);
  }
});

// ── Config status for frontend UI ──────────────────────────────────────────────
router.get("/twitter/config", async (_req, res) => {
  const creds = await getTwCreds();
  const hasEnvClientId = Boolean(process.env.TWITTER_CLIENT_ID?.trim());
  const hasEnvClientSecret = Boolean(process.env.TWITTER_CLIENT_SECRET?.trim());
  const hasDbClientId = Boolean(creds["client_id"]?.trim());
  const hasDbClientSecret = Boolean(creds["client_secret"]?.trim());

  return res.json({
    hasEnvClientId,
    hasEnvClientSecret,
    hasDbClientId,
    hasDbClientSecret,
    isConfigured: hasEnvClientId || hasDbClientId,
  });
});

export default router;
