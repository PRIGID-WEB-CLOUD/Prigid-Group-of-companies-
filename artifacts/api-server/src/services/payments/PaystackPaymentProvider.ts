import { createHmac, timingSafeEqual } from "node:crypto";
import { db, paymentProviderConnectionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { convertFromUSD, getExchangeRate } from "../exchangeRate";
import type {
  IPaymentProvider,
  PaymentProviderType,
  ProviderCapability,
  OAuthCallbackResult,
  OAuthTokens,
  ProviderAccountInfo,
  DecryptedConnection,
  InitializePaymentParams,
  InitializePaymentResult,
  VerifyPaymentParams,
  VerifyPaymentResult,
  RefundParams,
  RefundResult,
  WebhookEventResult,
} from "./types";

export class PaystackPaymentProvider implements IPaymentProvider {
  getProviderName(): PaymentProviderType {
    return "paystack";
  }

  getDisplayName(): string {
    return "Paystack (African & International Cards, Bank Transfer, Mobile Money)";
  }

  getCapabilities(): ProviderCapability {
    return {
      supportsOAuth: false,
      supportsDirectKey: true,
      supportsRefunds: true,
      supportsWebhooks: true,
      supportedCurrencies: ["NGN", "GHS", "USD", "ZAR", "KES"],
    };
  }

  private getClientId(): string | undefined {
    return process.env.PAYSTACK_CLIENT_ID;
  }

  private getPlatformSecretKey(): string | undefined {
    return process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET;
  }

  isPlatformConfigured(): boolean {
    return Boolean(this.getClientId() || this.getPlatformSecretKey());
  }

  async getAuthorizationUrl(storeId: string, state: string, redirectUri: string): Promise<string> {
    throw new Error(
      "Paystack uses Direct Secret Key and Public Key authentication for merchant integration. Please enter your Paystack API keys directly in the API Key configuration dialog."
    );
  }

  async handleOAuthCallback(storeId: string, code: string, state: string, redirectUri: string): Promise<OAuthCallbackResult> {
    const clientSecret = this.getPlatformSecretKey();
    if (!clientSecret) {
      throw new Error("Paystack platform Secret Key (PAYSTACK_SECRET_KEY) is not configured.");
    }

    const response = await fetch("https://api.paystack.co/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clientSecret}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const body = await response.json().catch(() => ({})) as any;
    if (!response.ok || !body.data?.access_token) {
      throw new Error(body.message || "Paystack authorization code exchange failed.");
    }

    const tokenData = body.data;
    let accountName = "Paystack Merchant";
    let accountEmail: string | undefined;
    let accountCurrency = "NGN";
    const accountId = tokenData.merchant_id || tokenData.integration_id || `pstk_${Date.now()}`;

    try {
      const detailsRes = await fetch("https://api.paystack.co/integration/payment_methods", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (detailsRes.ok) {
        const d = await detailsRes.json() as any;
        accountName = d.data?.business_name || accountName;
      }
    } catch {}

    return {
      accountId,
      accountName,
      accountEmail,
      accountCurrency,
      livemode: Boolean(tokenData.livemode ?? true),
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      publishableKey: tokenData.public_key,
      scope: tokenData.scope,
      tokenExpiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : undefined,
      raw: tokenData,
    };
  }

  async refreshCredentials(storeId: string, connection: DecryptedConnection): Promise<OAuthTokens | null> {
    if (!connection.refreshToken) return null;
    const clientSecret = this.getPlatformSecretKey();
    if (!clientSecret) return null;

    const response = await fetch("https://api.paystack.co/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${clientSecret}` },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: connection.refreshToken,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const body = await response.json().catch(() => ({})) as any;
    if (!response.ok || !body.data?.access_token) return null;

    return {
      accessToken: body.data.access_token,
      refreshToken: body.data.refresh_token || connection.refreshToken,
      publishableKey: body.data.public_key || connection.publishableKey || undefined,
      tokenExpiresAt: body.data.expires_in ? new Date(Date.now() + body.data.expires_in * 1000) : undefined,
    };
  }

  async getAccountDetails(storeId: string, connection: DecryptedConnection): Promise<ProviderAccountInfo> {
    const authKey = connection.accessToken || this.getPlatformSecretKey();
    if (!authKey) throw new Error("Paystack credentials not available.");

    const response = await fetch("https://api.paystack.co/integration/keys", {
      headers: { Authorization: `Bearer ${authKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    const body = await response.json().catch(() => ({})) as any;
    if (!response.ok) {
      return {
        accountId: connection.accountId || "paystack_account",
        accountName: connection.accountName || "Connected Paystack Merchant",
        accountEmail: connection.accountEmail || undefined,
        accountCurrency: connection.accountCurrency || "NGN",
        livemode: connection.livemode,
      };
    }

    return {
      accountId: connection.accountId || body.data?.integration || "paystack_account",
      accountName: connection.accountName || "Paystack Merchant",
      accountEmail: connection.accountEmail || undefined,
      accountCurrency: connection.accountCurrency || "NGN",
      livemode: connection.livemode,
      raw: body.data,
    };
  }

  async initializePayment(storeId: string, connection: DecryptedConnection, params: InitializePaymentParams): Promise<InitializePaymentResult> {
    const authKey = connection.accessToken || this.getPlatformSecretKey();
    if (!authKey) {
      throw new Error(
        "Paystack credentials not configured for this store. Please add your Paystack Secret Key (sk_test_... or sk_live_...) in Admin Panel > Payment Gateway Settings."
      );
    }

    const supportedCurrencies = ["GHS", "NGN", "USD", "ZAR", "KES"];
    const requestedCurrency = (params.currency || "").toUpperCase();
    const accountCurrency = (connection.accountCurrency || "GHS").toUpperCase();

    // Determine target currency: prefer requested if supported by Paystack, otherwise use merchant account currency
    const initialCurrency = supportedCurrencies.includes(requestedCurrency)
      ? requestedCurrency
      : (supportedCurrencies.includes(accountCurrency) ? accountCurrency : "GHS");

    // Convert base USD amount (params.amount in cents) to target currency minor units via live exchange rates
    const conversion = await convertFromUSD(params.amount, initialCurrency);
    const payloadAmount = conversion.convertedAmount;

    const payload: Record<string, unknown> = {
      email: params.customerEmail,
      amount: payloadAmount,
      currency: initialCurrency,
      reference: params.reference,
      callback_url: `${params.callbackUrl}${params.callbackUrl.includes("?") ? "&" : "?"}reference=${params.reference}&provider=paystack`,
      metadata: {
        storeId,
        orderId: params.orderId,
        customerName: params.customerName,
        baseAmountUSD: params.amount / 100,
        exchangeRate: conversion.rate,
        chargedCurrency: initialCurrency,
        chargedAmount: payloadAmount / 100,
        custom_fields: [
          { display_name: "Store ID", variable_name: "store_id", value: storeId },
          { display_name: "Order Reference", variable_name: "order_reference", value: params.reference },
          { display_name: "Base USD Price", variable_name: "base_usd_price", value: `$${(params.amount / 100).toFixed(2)}` },
          { display_name: "Exchange Rate", variable_name: "exchange_rate", value: `1 USD = ${conversion.rate.toFixed(4)} ${initialCurrency}` },
        ],
      },
    };

    let response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    let body = await response.json().catch(() => ({})) as any;

    // Resilient fallback: If currency specified isn't enabled on merchant's Paystack account,
    // convert to merchant's account currency using live exchange rate and retry
    if (!response.ok && (body.code === "unsupported_currency" || String(body.message).toLowerCase().includes("currency not supported"))) {
      const fallbackCurrency = supportedCurrencies.includes(accountCurrency) ? accountCurrency : "GHS";
      const fallbackConversion = await convertFromUSD(params.amount, fallbackCurrency);

      const fallbackPayload = {
        ...payload,
        currency: fallbackCurrency,
        amount: fallbackConversion.convertedAmount,
      };

      response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fallbackPayload),
        signal: AbortSignal.timeout(15_000),
      });

      body = await response.json().catch(() => ({})) as any;

      // If still rejected, retry without explicit currency field so Paystack uses its primary account currency
      if (!response.ok && (body.code === "unsupported_currency" || String(body.message).toLowerCase().includes("currency not supported"))) {
        const noCurrencyPayload = { ...fallbackPayload };
        delete noCurrencyPayload.currency;

        response = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(noCurrencyPayload),
          signal: AbortSignal.timeout(15_000),
        });

        body = await response.json().catch(() => ({})) as any;
      }
    }

    if (!response.ok || !body.status || !body.data?.authorization_url) {
      const msg = body.message || "Paystack transaction initialization failed.";
      if (msg.toLowerCase().includes("invalid key") || msg.toLowerCase().includes("unauthorized") || response.status === 401) {
        throw new Error("Paystack authentication failed: Invalid Secret Key. Please enter a valid Paystack Secret Key (sk_test_... or sk_live_...) in Admin Panel > Payment Gateway Settings.");
      }
      throw new Error(`Paystack Initialization Error: ${msg}`);
    }

    return {
      authorizationUrl: body.data.authorization_url,
      publishableKey: connection.publishableKey || undefined,
      reference: params.reference,
      provider: "paystack",
      providerTransactionId: body.data.reference || params.reference,
      raw: body.data,
    };
  }

  async verifyPayment(storeId: string, connection: DecryptedConnection, params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    const authKey = connection.accessToken || this.getPlatformSecretKey();
    if (!authKey) throw new Error("Paystack credentials not available.");

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(params.reference)}`, {
      headers: { Authorization: `Bearer ${authKey}` },
      signal: AbortSignal.timeout(15_000),
    });

    const body = await response.json().catch(() => ({})) as any;
    if (!response.ok || !body.status || !body.data) {
      throw new Error(body.message || `Paystack verification failed for ${params.reference}`);
    }

    const data = body.data;
    const isPaid = data.status === "success";

    return {
      success: isPaid,
      reference: data.reference || params.reference,
      providerTransactionId: String(data.id || data.reference),
      amount: Number(data.amount || 0),
      currency: (data.currency || "NGN").toUpperCase(),
      status: isPaid ? "paid" : data.status || "failed",
      customerEmail: data.customer?.email,
      paymentMethod: data.channel || "card",
      raw: data,
    };
  }

  async processRefund(storeId: string, connection: DecryptedConnection, params: RefundParams): Promise<RefundResult> {
    const authKey = connection.accessToken || this.getPlatformSecretKey();
    if (!authKey) throw new Error("Paystack credentials not available.");

    const response = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction: params.providerTransactionId || params.reference,
        amount: params.amount,
        merchant_note: params.reason || "Customer requested refund",
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const body = await response.json().catch(() => ({})) as any;
    if (!response.ok || !body.status) {
      throw new Error(body.message || "Paystack refund failed.");
    }

    return {
      success: true,
      refundId: String(body.data?.id || `pstk_ref_${Date.now()}`),
      amount: Number(body.data?.amount || params.amount),
      currency: (body.data?.currency || params.currency).toUpperCase(),
      status: "SUCCEEDED",
      raw: body.data,
    };
  }

  async handleWebhook(
    rawBody: string,
    signature: string | undefined,
    headers: Record<string, string | string[] | undefined>,
    secretOverride?: string
  ): Promise<WebhookEventResult> {
    const secret = secretOverride || this.getPlatformSecretKey();
    if (!signature) {
      throw new Error("Missing x-paystack-signature header.");
    }

    if (secret) {
      const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
      const left = Buffer.from(expected, "hex");
      const right = Buffer.from(signature, "hex");
      if (left.length !== right.length || !timingSafeEqual(left, right)) {
        throw new Error("Invalid Paystack webhook signature.");
      }
    }

    const event = JSON.parse(rawBody) as {
      event: string;
      data?: Record<string, any>;
    };

    const d = event.data ?? {};
    const reference = d.reference;
    let status: "paid" | "failed" | "refunded" | "processing" = "processing";

    if (event.event === "charge.success") {
      status = "paid";
    } else if (event.event === "charge.failed") {
      status = "failed";
    } else if (event.event === "refund.processed") {
      status = "refunded";
    }

    return {
      handled: true,
      provider: "paystack",
      eventId: String(d.id || `pstk_evt_${Date.now()}`),
      eventType: event.event,
      reference,
      providerTransactionId: String(d.id || reference),
      status,
      amount: Number(d.amount || 0),
      currency: (d.currency || "NGN").toUpperCase(),
      storeId: d.metadata?.storeId,
      raw: event,
    };
  }

  async disconnect(storeId: string, connection: DecryptedConnection): Promise<void> {
    // Paystack OAuth token revocation if needed
  }
}
