import { Router, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, gt, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import {
  db,
  storesTable,
  paymentProviderConnectionsTable,
  paymentTransactionsTable,
  paymentRefundsTable,
  paymentAuditLogsTable,
  ordersTable,
  orderItemsTable,
  productsTable,
  couponsTable,
  storeCartItemsTable,
} from "@workspace/db";
import { requireAdmin, getSessionUser } from "../middleware/requireAdmin";
import { paymentService, type PaymentProviderType } from "../services/payments";
import { encryptCredential } from "../services/credentialVault";
import { sendEmail, buildOrderConfirmationEmail, getStoreUrl } from "../services/mailer";
import { sendWhatsAppNotification, buildWhatsAppOrderConfirmationMessage } from "../services/whatsappService";
import { eventBus } from "../lib/eventBus";
import { type TenantRequest } from "../middleware/tenantContext";

const router = Router();

const providerParamSchema = z.enum(["stripe", "paystack", "flutterwave"]);

const manualConnectSchema = z.object({
  accountId: z.string().trim().optional(),
  accountName: z.string().trim().optional(),
  accountEmail: z.string().trim().email().optional(),
  accessToken: z.string().trim().min(1, "Secret key / Access token is required"),
  refreshToken: z.string().trim().optional(),
  publishableKey: z.string().trim().optional(),
  webhookSecret: z.string().trim().optional(),
  livemode: z.boolean().default(false),
});

const checkoutAddressSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  line1: z.string().trim().max(500).optional(),
  line2: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  province: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(40).optional(),
  postCode: z.string().trim().max(40).optional(),
  country: z.string().trim().max(120).optional(),
  countryCode: z.string().trim().max(10).optional(),
});

const initializePaymentSchema = z.object({
  customerName: z.string().trim().min(1).max(120).default("Guest"),
  customerEmail: z.string().trim().toLowerCase().email(),
  provider: providerParamSchema.optional(),
  currency: z.string().trim().max(10).optional(),
  exchangeRate: z.number().positive().optional(),
  couponCode: z.string().trim().max(64).optional(),
  shippingAddress: z.union([z.string().trim().min(5).max(1000), checkoutAddressSchema]),
  billingAddress: checkoutAddressSchema.optional(),
  callbackUrl: z.string().url().max(1000),
  cancelUrl: z.string().url().max(1000).optional(),
});

const refundSchema = z.object({
  reference: z.string().trim().min(1),
  amount: z.number().int().positive().optional(),
  reason: z.string().trim().max(255).optional(),
});

function getClientIp(req: TenantRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "127.0.0.1";
}

function addressSnapshot(value: string | Record<string, any>) {
  return typeof value === "string" ? { address: value.trim() } : Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]).filter(([, v]) => v != null)
  );
}

// ── Admin: List Providers & Connections ──────────────────────────────────────

router.get("/providers", requireAdmin, async (req: TenantRequest, res: Response) => {
  try {
    const storeId = req.storeId!;
    const data = await paymentService.getProvidersStatus(storeId);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load payment providers." });
  }
});

// ── Admin: Initiate OAuth Connect ───────────────────────────────────────────

router.post("/providers/:provider/connect", requireAdmin, async (req: TenantRequest, res: Response) => {
  const parsed = providerParamSchema.safeParse(req.params.provider);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payment provider." });

  try {
    const storeId = req.storeId!;
    const host = req.get("host") || "localhost:3000";
    const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
    const redirectUri = req.body.redirectUri || `${protocol}://${host}/api/payments/oauth/callback`;
    const returnUrl = req.body.returnUrl || "/settings?section=payments";

    const result = await paymentService.initiateOAuthConnect({
      storeId,
      providerName: parsed.data,
      redirectUri,
      returnUrl,
      userId: req.adminUser?.id,
      ipAddress: getClientIp(req),
      userAgent: req.get("user-agent"),
    });

    return res.json({
      success: true,
      provider: parsed.data,
      authorizationUrl: result.authorizationUrl,
      state: result.state,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Could not initiate provider authorization." });
  }
});

// ── Admin: Manual Direct Credentials Connection ─────────────────────────────

router.post("/providers/:provider/manual-connect", requireAdmin, async (req: TenantRequest, res: Response) => {
  const providerParsed = providerParamSchema.safeParse(req.params.provider);
  if (!providerParsed.success) return res.status(400).json({ error: "Invalid payment provider." });

  const bodyParsed = manualConnectSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({ error: "Validation failed.", details: bodyParsed.error.flatten() });
  }

  const storeId = req.storeId!;
  await paymentService.ensureStore(storeId);
  const data = bodyParsed.data;

  try {
    const accountId = data.accountId || `acct_manual_${randomUUID().split("-")[0]}`;

    const [existing] = await db.select().from(paymentProviderConnectionsTable)
      .where(and(
        eq(paymentProviderConnectionsTable.storeId, storeId),
        eq(paymentProviderConnectionsTable.provider, providerParsed.data),
        eq(paymentProviderConnectionsTable.accountId, accountId)
      )).limit(1);

    const encryptedAccessToken = encryptCredential(data.accessToken);
    const encryptedRefreshToken = data.refreshToken ? encryptCredential(data.refreshToken) : null;
    const encryptedPublishableKey = data.publishableKey ? encryptCredential(data.publishableKey) : null;
    const encryptedWebhookSecret = data.webhookSecret ? encryptCredential(data.webhookSecret) : null;

    if (existing) {
      await db.update(paymentProviderConnectionsTable).set({
        status: "CONNECTED",
        accountId,
        accountName: data.accountName || existing.accountName || `${providerParsed.data.toUpperCase()} Account`,
        accountEmail: data.accountEmail || existing.accountEmail,
        livemode: data.livemode,
        encryptedAccessToken,
        encryptedRefreshToken,
        encryptedPublishableKey,
        encryptedWebhookSecret,
        lastSyncedAt: new Date(),
        connectedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(paymentProviderConnectionsTable.id, existing.id), eq(paymentProviderConnectionsTable.storeId, storeId)));
    } else {
      await db.insert(paymentProviderConnectionsTable).values({
        id: randomUUID(),
        storeId,
        provider: providerParsed.data,
        status: "CONNECTED",
        accountId,
        accountName: data.accountName || `${providerParsed.data.toUpperCase()} Account`,
        accountEmail: data.accountEmail,
        livemode: data.livemode,
        encryptedAccessToken,
        encryptedRefreshToken,
        encryptedPublishableKey,
        encryptedWebhookSecret,
        lastSyncedAt: new Date(),
        connectedAt: new Date(),
      });
    }

    await paymentService.logAudit({
      storeId,
      userId: req.adminUser?.id,
      action: "CONNECTED",
      provider: providerParsed.data,
      details: { manual: true, accountName: data.accountName, livemode: data.livemode },
      ipAddress: getClientIp(req),
      userAgent: req.get("user-agent"),
    });

    return res.json({ success: true, message: `Successfully connected ${providerParsed.data}.` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to save payment connection." });
  }
});

// ── Admin: Set Active Provider ──────────────────────────────────────────────

router.post("/providers/:provider/set-active", requireAdmin, async (req: TenantRequest, res: Response) => {
  const parsed = providerParamSchema.safeParse(req.params.provider);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payment provider." });

  try {
    const storeId = req.storeId!;
    const result = await paymentService.setActiveProvider({
      storeId,
      providerName: parsed.data,
      connectionId: req.body.connectionId as string || undefined,
      userId: req.adminUser?.id,
      ipAddress: getClientIp(req),
      userAgent: req.get("user-agent"),
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to set active payment provider." });
  }
});

// ── Admin: Disconnect Provider ──────────────────────────────────────────────

router.post("/providers/:provider/disconnect", requireAdmin, async (req: TenantRequest, res: Response) => {
  const parsed = providerParamSchema.safeParse(req.params.provider);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payment provider." });

  try {
    const storeId = req.storeId!;
    const result = await paymentService.disconnectProvider({
      storeId,
      providerName: parsed.data,
      connectionId: req.body.connectionId as string || undefined,
      userId: req.adminUser?.id,
      ipAddress: getClientIp(req),
      userAgent: req.get("user-agent"),
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to disconnect payment provider." });
  }
});

// ── Admin: Audit Logs & Transactions ────────────────────────────────────────

router.get("/audit-logs", requireAdmin, async (req: TenantRequest, res: Response) => {
  try {
    const storeId = req.storeId!;
    const logs = await db.select().from(paymentAuditLogsTable)
      .where(eq(paymentAuditLogsTable.storeId, storeId))
      .orderBy(desc(paymentAuditLogsTable.createdAt))
      .limit(100);
    return res.json(logs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load audit logs." });
  }
});

router.get("/transactions", requireAdmin, async (req: TenantRequest, res: Response) => {
  try {
    const storeId = req.storeId!;
    const transactions = await db.select().from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.storeId, storeId))
      .orderBy(desc(paymentTransactionsTable.createdAt))
      .limit(50);
    return res.json(transactions);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load transactions." });
  }
});

// ── Admin: Process Refund ───────────────────────────────────────────────────

router.post("/refund", requireAdmin, async (req: TenantRequest, res: Response) => {
  const parsed = refundSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid refund payload.", details: parsed.error.flatten() });

  try {
    const storeId = req.storeId!;
    const [tx] = await db.select().from(paymentTransactionsTable)
      .where(and(eq(paymentTransactionsTable.reference, parsed.data.reference), eq(paymentTransactionsTable.storeId, storeId))).limit(1);
    if (!tx) return res.status(404).json({ error: "Transaction not found." });

    const refundAmount = parsed.data.amount || tx.amount;
    const result = await paymentService.processRefund({
      storeId,
      transactionId: tx.id,
      reference: tx.reference,
      providerTransactionId: tx.providerTransactionId || undefined,
      amount: refundAmount,
      currency: tx.currency,
      reason: parsed.data.reason,
    });

    if (tx.orderId) {
      await db.update(ordersTable).set({
        paymentStatus: "REFUNDED",
        status: "CANCELLED",
        updatedAt: new Date(),
      }).where(and(eq(ordersTable.id, tx.orderId), eq(ordersTable.storeId, storeId)));
    }

    return res.json({ success: true, refund: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to process refund." });
  }
});

// ── Public / OAuth Callback Handler ─────────────────────────────────────────

router.all(["/oauth/callback", "/oauth/callback/", "/oauth/callback/:provider"], async (req, res) => {
  const code = (req.query.code as string) || (req.body?.code as string) || "";
  const state = (req.query.state as string) || (req.body?.state as string) || "";
  const error = (req.query.error as string) || (req.query.error_description as string) || (req.body?.error as string);

  const host = req.get("host") || "localhost:3000";
  const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
  const adminOrigin = process.env.ADMIN_URL || `${protocol}://${host}`;

  const buildRedirect = (basePath: string, queryParams: Record<string, string>) => {
    let cleanPath = basePath || "/seller/providers?tab=payments";
    if (!cleanPath.startsWith("http") && !cleanPath.startsWith("/seller")) {
      cleanPath = `/seller${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;
    }
    const targetUrl = cleanPath.startsWith("http") ? new URL(cleanPath) : new URL(cleanPath, adminOrigin);
    Object.entries(queryParams).forEach(([k, v]) => targetUrl.searchParams.set(k, v));
    return targetUrl.toString();
  };

  if (error) {
    const redirectUrl = buildRedirect("/seller/providers", { tab: "payments", error: String(error) });
    return res.send(`
      <html>
        <head><title>Authentication Error</title></head>
        <body style="font-family: sans-serif; padding: 20px; text-align: center;">
          <p style="color: red; font-weight: bold;">Authentication Error: ${error}</p>
          <p>Redirecting back to dashboard...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: ${JSON.stringify(error)} }, '*');
              window.close();
            } else {
              window.location.href = ${JSON.stringify(redirectUrl)};
            }
          </script>
        </body>
      </html>
    `);
  }

  if (!code || !state) {
    const missingErr = "Missing authorization code or state token.";
    const redirectUrl = buildRedirect("/seller/providers", { tab: "payments", error: missingErr });
    return res.send(`
      <html>
        <head><title>Authentication Error</title></head>
        <body style="font-family: sans-serif; padding: 20px; text-align: center;">
          <p style="color: red; font-weight: bold;">Error: ${missingErr}</p>
          <p>Redirecting back to dashboard...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: ${JSON.stringify(missingErr)} }, '*');
              window.close();
            } else {
              window.location.href = ${JSON.stringify(redirectUrl)};
            }
          </script>
        </body>
      </html>
    `);
  }

  try {
    const redirectUri = `${protocol}://${host}/api/payments/oauth/callback`;

    const result = await paymentService.handleOAuthCallback({
      code,
      state,
      redirectUri,
      ipAddress: getClientIp(req),
      userAgent: req.get("user-agent"),
    });

    const destination = result.returnUrl || "/seller/providers?tab=payments";
    const redirectUrl = buildRedirect(destination, { status: "connected", provider: result.provider });

    return res.send(`
      <html>
        <head><title>Authentication Successful</title></head>
        <body style="font-family: sans-serif; padding: 20px; text-align: center;">
          <p style="color: green; font-weight: bold;">Authentication successful. Connecting your account...</p>
          <p>Please wait...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: ${JSON.stringify(result.provider)} }, '*');
              window.close();
            } else {
              window.location.href = ${JSON.stringify(redirectUrl)};
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("[OAuth Callback Error]", err);
    const callbackErr = err.message || "Authorization failed.";
    const redirectUrl = buildRedirect("/seller/providers", { tab: "payments", error: callbackErr });
    return res.send(`
      <html>
        <head><title>Authentication Error</title></head>
        <body style="font-family: sans-serif; padding: 20px; text-align: center;">
          <p style="color: red; font-weight: bold;">Error: ${callbackErr}</p>
          <p>Redirecting back to dashboard...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: ${JSON.stringify(callbackErr)} }, '*');
              window.close();
            } else {
              window.location.href = ${JSON.stringify(redirectUrl)};
            }
          </script>
        </body>
      </html>
    `);
  }
});

// ── Public: Checkout Active Config ──────────────────────────────────────────

router.get(["/checkout-config", "/config"], async (req: TenantRequest, res: Response) => {
  try {
    const storeId = req.storeId!;
    const config = await paymentService.getActiveCheckoutConfig(storeId);
    return res.json(config);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load checkout payment configuration." });
  }
});

// ── Public: Initialize Customer Checkout ────────────────────────────────────

router.post("/initialize", async (req: TenantRequest, res: Response) => {
  const parsed = initializePaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "A valid email, shipping address, and callback URL are required.", details: parsed.error.flatten() });
  }

  const storeId = req.storeId!;
  const sessionUser = await getSessionUser(req);
  const rawCookie = req.cookies?.["luxe_cart"] as string | undefined;
  
  const candidateSessionIds: string[] = [];
  if (sessionUser?.id) {
    candidateSessionIds.push(`user:${sessionUser.id}`);
  }
  if (rawCookie) {
    candidateSessionIds.push(`anon:${rawCookie}`);
    candidateSessionIds.push(rawCookie);
  }
  if (req.body.sessionId && typeof req.body.sessionId === "string") {
    candidateSessionIds.push(req.body.sessionId);
    if (!req.body.sessionId.startsWith("anon:") && !req.body.sessionId.startsWith("user:")) {
      candidateSessionIds.push(`anon:${req.body.sessionId}`);
    }
  }

  let cartItems: (typeof storeCartItemsTable.$inferSelect)[] = [];
  if (candidateSessionIds.length > 0) {
    cartItems = await db.select().from(storeCartItemsTable)
      .where(and(inArray(storeCartItemsTable.sessionId, candidateSessionIds), eq(storeCartItemsTable.storeId, storeId)));
  }

  let subtotal = 0;
  const items: Array<{ name: string; quantity: number; price: number; productId: string }> = [];

  for (const item of cartItems) {
    const [p] = await db.select().from(productsTable).where(and(eq(productsTable.id, item.productId), eq(productsTable.storeId, storeId))).limit(1);
    if (p && p.status === "ACTIVE") {
      subtotal += p.price * item.quantity;
      items.push({ name: p.name, quantity: item.quantity, price: p.price, productId: p.id });
    }
  }

  // Fallback to items passed directly in request body if cart table is empty
  if (items.length === 0 && Array.isArray(req.body.items) && req.body.items.length > 0) {
    for (const rawItem of req.body.items) {
      const prodId = rawItem.productId || rawItem.id;
      const qty = Math.max(1, Number(rawItem.quantity || rawItem.qty || 1));
      const [p] = await db.select().from(productsTable).where(and(eq(productsTable.id, prodId), eq(productsTable.storeId, storeId))).limit(1);
      if (p && p.status === "ACTIVE") {
        subtotal += p.price * qty;
        items.push({ name: p.name, quantity: qty, price: p.price, productId: p.id });
      }
    }
  }

  if (items.length === 0) {
    return res.status(400).json({ error: "Your shopping bag is empty or items are no longer available." });
  }

  let discount = 0;
  if (parsed.data.couponCode) {
    const [c] = await db.select().from(couponsTable)
      .where(and(eq(couponsTable.code, parsed.data.couponCode.toUpperCase()), eq(couponsTable.storeId, storeId))).limit(1);
    if (c && c.active && (!c.expiresAt || c.expiresAt > new Date()) && (c.maxUses == null || c.usedCount < c.maxUses) && subtotal >= Number(c.minOrderAmount)) {
      discount = c.discountType === "PERCENTAGE"
        ? Math.min(subtotal, Math.floor((subtotal * Number(c.discountValue)) / 100))
        : Math.min(subtotal, Number(c.discountValue));
    }
  }

  const amount = Math.max(0, subtotal - discount) * 100;
  const reference = `LUXE_${Date.now()}_${randomBytes(6).toString("hex").toUpperCase()}`;
  const primarySessionId = candidateSessionIds[0] || (rawCookie ? `anon:${rawCookie}` : "session-guest");

  const metadata = {
    sessionId: primarySessionId,
    storeId,
    customerId: sessionUser?.id,
    customerName: parsed.data.customerName,
    customerEmail: parsed.data.customerEmail,
    items,
    couponCode: parsed.data.couponCode,
    shippingAddress: addressSnapshot(parsed.data.shippingAddress),
    billingAddress: parsed.data.billingAddress ? addressSnapshot(parsed.data.billingAddress) : undefined,
  };

  try {
    const initResult = await paymentService.initializeCheckout({
      storeId,
      provider: parsed.data.provider,
      reference,
      amount,
      currency: (parsed.data.currency || "USD").toUpperCase(),
      customerEmail: parsed.data.customerEmail,
      customerName: parsed.data.customerName,
      items,
      shippingAddress: metadata.shippingAddress,
      billingAddress: metadata.billingAddress,
      callbackUrl: parsed.data.callbackUrl,
      cancelUrl: parsed.data.cancelUrl,
      metadata,
    });

    return res.status(201).json({
      status: true,
      data: {
        authorization_url: initResult.authorizationUrl,
        reference,
        provider: initResult.provider,
        providerTransactionId: initResult.providerTransactionId,
        publishableKey: initResult.publishableKey,
        amount,
      },
    });
  } catch (err: any) {
    console.error("[PAYMENTS_INITIALIZE_ERROR]", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Failed to initialize payment gateway.", details: err.stack });
  }
});

// ── Public: Verify Payment & Finalize Order Atomically ──────────────────────

router.get("/verify/:reference", async (req: TenantRequest, res: Response) => {
  const reference = z.string().trim().min(1).max(200).safeParse(req.params.reference);
  if (!reference.success) return res.status(400).json({ error: "Invalid payment reference." });

  try {
    const storeId = req.storeId!;
    const verification = await paymentService.verifyCheckout({
      storeId,
      reference: reference.data,
      queryParams: req.query as Record<string, string>,
    });

    if (!verification.success) {
      return res.status(402).json({ status: false, error: "Payment verification was unsuccessful.", verification });
    }

    // Atomic order finalization with idempotency
    const order = await db.transaction(async (tx) => {
      const [transaction] = await tx.select().from(paymentTransactionsTable)
        .where(and(eq(paymentTransactionsTable.reference, reference.data), eq(paymentTransactionsTable.storeId, storeId))).limit(1);
      if (!transaction) throw Object.assign(new Error("Transaction record missing."), { statusCode: 404 });

      if (transaction.orderId) {
        const [existingOrder] = await tx.select().from(ordersTable).where(and(eq(ordersTable.id, transaction.orderId), eq(ordersTable.storeId, storeId))).limit(1);
        if (existingOrder) return existingOrder;
      }

      const meta = (transaction.metadata || {}) as any;
      const metaItems = Array.isArray(meta.items) ? meta.items : [];

      const authoritativeItems: any[] = [];
      let subtotal = 0;
      for (const item of metaItems) {
        const [product] = await tx.select().from(productsTable)
          .where(and(eq(productsTable.id, item.productId), eq(productsTable.status, "ACTIVE"), eq(productsTable.storeId, storeId))).limit(1);
        if (!product) throw new Error(`Product ${item.productId} is no longer available.`);

        const stockCondition = or(eq(productsTable.trackQuantity, false), gte(productsTable.stock, item.quantity));
        const [reserved] = await tx.update(productsTable)
          .set({ stock: product.trackQuantity ? sql`${productsTable.stock} - ${item.quantity}` : sql`${productsTable.stock}` })
          .where(and(eq(productsTable.id, product.id), eq(productsTable.storeId, storeId), stockCondition)).returning();

        if (!reserved) throw new Error(`${product.name} has insufficient stock.`);
        subtotal += item.price * item.quantity;
        authoritativeItems.push({ productId: product.id, name: product.name, qty: item.quantity, price: item.price });
      }

      let discount = 0;
      if (meta.couponCode) {
        const [coupon] = await tx.select().from(couponsTable)
          .where(and(eq(couponsTable.code, meta.couponCode.toUpperCase()), eq(couponsTable.storeId, storeId))).limit(1);
        if (coupon && coupon.active && (!coupon.expiresAt || coupon.expiresAt > new Date()) && (coupon.maxUses == null || coupon.usedCount < coupon.maxUses) && subtotal >= Number(coupon.minOrderAmount)) {
          discount = coupon.discountType === "PERCENTAGE"
            ? Math.min(subtotal, Math.floor((subtotal * Number(coupon.discountValue)) / 100))
            : Math.min(subtotal, Number(coupon.discountValue));

          await tx.update(couponsTable).set({ usedCount: sql`${couponsTable.usedCount} + 1`, updatedAt: new Date() })
            .where(and(eq(couponsTable.id, coupon.id), eq(couponsTable.storeId, storeId)));
        }
      }

      const [created] = await tx.insert(ordersTable).values({
        id: randomUUID(),
        storeId,
        customerName: meta.customerName || "Customer",
        customerId: meta.customerId,
        customerEmail: meta.customerEmail || transaction.email,
        total: Math.max(0, subtotal - discount),
        status: "PROCESSING",
        paymentStatus: "PAID",
        paymentProvider: transaction.provider,
        paymentReference: transaction.reference,
        paidAt: new Date(),
        items: authoritativeItems,
        shippingAddress: meta.shippingAddress,
        billingAddress: meta.billingAddress,
      }).returning();

      await tx.insert(orderItemsTable).values(authoritativeItems.map((item) => ({
        id: randomUUID(),
        storeId,
        orderId: created.id,
        productId: item.productId,
        variantId: item.variantId || null,
        sku: item.sku || "",
        productName: item.name,
        unitPrice: item.price,
        quantity: item.qty,
        total: item.price * item.qty,
      })));

      await tx.update(paymentTransactionsTable).set({
        status: "paid",
        orderId: created.id,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(paymentTransactionsTable.id, transaction.id), eq(paymentTransactionsTable.storeId, storeId)));

      if (transaction.sessionId) {
        await tx.delete(storeCartItemsTable).where(and(eq(storeCartItemsTable.sessionId, transaction.sessionId), eq(storeCartItemsTable.storeId, storeId)));
      }

      return created;
    });

    eventBus.publish({
      type: "new_order",
      storeId,
      payload: {
        id: order.id,
        storeId,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
      },
    });

    // Auto-fulfillment & notifications
    getStoreUrl(storeId).then((storeUrl) => {
      const items = Array.isArray(order.items) ? order.items.map((i: any) => ({ name: i.name, qty: i.qty ?? i.quantity ?? 1, price: i.price ?? 0 })) : [];
      const emailData = buildOrderConfirmationEmail({
        orderId: order.id,
        customerName: order.customerName,
        items,
        total: order.total,
        storeUrl,
      });
      sendEmail({ to: order.customerEmail, ...emailData, storeId }).catch(() => {});

      const itemSummary = items.map((i: any) => `${i.name} (x${i.qty})`).join(", ");
      const waText = buildWhatsAppOrderConfirmationMessage({
        orderId: order.id,
        recipientName: order.customerName,
        total: order.total,
        itemSummary,
        orderUrl: `${storeUrl}/account/orders`,
      });
      sendWhatsAppNotification(order.customerEmail, waText, storeId).catch(() => {});
    }).catch(() => {});

    return res.json({ status: true, order, verification });
  } catch (err: any) {
    console.error("[Payment Verification Error]", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Failed to verify transaction." });
  }
});

// ── Webhooks: Stripe, Paystack, Flutterwave ──────────────────────────────────

router.post("/webhooks/stripe", async (req, res) => {
  const signature = req.get("stripe-signature");
  const rawBody = (req as any).rawBody ?? JSON.stringify(req.body);
  try {
    const event = await paymentService.handleIncomingWebhook("stripe", rawBody, signature, req.headers);
    return res.json({ received: true, eventId: event.eventId, status: event.status });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Stripe webhook handling failed." });
  }
});

router.post("/webhooks/paystack", async (req, res) => {
  const signature = req.get("x-paystack-signature");
  const rawBody = (req as any).rawBody ?? JSON.stringify(req.body);
  try {
    const event = await paymentService.handleIncomingWebhook("paystack", rawBody, signature, req.headers);
    return res.json({ received: true, eventId: event.eventId, status: event.status });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Paystack webhook handling failed." });
  }
});

router.post("/webhooks/flutterwave", async (req, res) => {
  const signature = (req.get("verif-hash") || req.get("verif_hash")) as string | undefined;
  const rawBody = (req as any).rawBody ?? JSON.stringify(req.body);
  try {
    const event = await paymentService.handleIncomingWebhook("flutterwave", rawBody, signature, req.headers);
    return res.json({ received: true, eventId: event.eventId, status: event.status });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Flutterwave webhook handling failed." });
  }
});

export default router;
