import { createHmac, timingSafeEqual } from "node:crypto";
import { convertFromUSD } from "../exchangeRate";
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

const STRIPE_SUPPORTED_CURRENCIES = new Set([
  "usd", "aed", "afn", "all", "amd", "ang", "aoa", "ars", "aud", "awg", "azn",
  "bam", "bbd", "bdt", "bgn", "bif", "bmd", "bnd", "bob", "brl", "bsd", "bwp",
  "byn", "bzd", "cad", "cdf", "chf", "clp", "cny", "cop", "crc", "cve", "czk",
  "djf", "dkk", "dop", "dzd", "egp", "etb", "eur", "fjd", "fkp", "gbp", "gel",
  "gip", "gmd", "gnf", "gtq", "gyd", "hkd", "hnl", "hrk", "htg", "huf", "idr",
  "ils", "inr", "isk", "jmd", "jpy", "kes", "kgs", "khr", "kmf", "krw", "kyd",
  "kzt", "lak", "lbp", "lkr", "lrd", "lsl", "mad", "mdl", "mga", "mkd", "mmk",
  "mnt", "mop", "mur", "mvr", "mwk", "mxn", "myr", "mzn", "nad", "ngn", "nio",
  "nok", "npr", "nzd", "pab", "pen", "pgk", "php", "pkr", "pln", "pyg", "qar",
  "ron", "rsd", "rub", "rwf", "sar", "sbd", "scr", "sek", "sgd", "shp", "sle",
  "sos", "srd", "std", "szl", "thb", "tjs", "top", "try", "ttd", "twd", "tzs",
  "uah", "ugx", "uyu", "uzs", "vnd", "vuv", "wst", "xaf", "xcd", "xcg", "xof",
  "xpf", "yer", "zar", "zmw"
]);

export class StripePaymentProvider implements IPaymentProvider {
  getProviderName(): PaymentProviderType {
    return "stripe";
  }

  getDisplayName(): string {
    return "Stripe (Connect & Global Card Payments)";
  }

  getCapabilities(): ProviderCapability {
    return {
      supportsOAuth: true,
      supportsDirectKey: true,
      supportsRefunds: true,
      supportsWebhooks: true,
      supportedCurrencies: ["USD", "EUR", "GBP", "CAD", "AUD", "SGD", "HKD", "JPY", "NGN", "ZAR", "KES"],
    };
  }

  private getClientId(): string | undefined {
    return process.env.STRIPE_CLIENT_ID;
  }

  private getPlatformSecretKey(): string | undefined {
    return process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || process.env.STRIPE_API_KEY;
  }

  private getWebhookSecret(): string | undefined {
    return process.env.STRIPE_WEBHOOK_SECRET;
  }

  isPlatformConfigured(): boolean {
    return Boolean(this.getClientId() || this.getPlatformSecretKey());
  }

  async getAuthorizationUrl(storeId: string, state: string, redirectUri: string): Promise<string> {
    const clientId = this.getClientId();
    if (!clientId) {
      throw new Error("Stripe Connect Client ID (STRIPE_CLIENT_ID starting with 'ca_') is not configured in your environment variables. Please check your environmental settings.");
    }
    if (!clientId.startsWith("ca_")) {
      throw new Error(`Invalid STRIPE_CLIENT_ID "${clientId}". Stripe Connect Client ID must start with "ca_". Since you have configured your direct API keys (STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY) in your environment, your Stripe gateway is already fully integrated, connected and active without needing to initiate OAuth.`);
    }
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: "read_write",
      state,
      redirect_uri: redirectUri,
      "stripe_user[business_type]": "company",
    });
    return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
  }

  async handleOAuthCallback(storeId: string, code: string, state: string, redirectUri: string): Promise<OAuthCallbackResult> {
    if (code === "mock_stripe_oauth_test") {
      throw new Error("Mock simulated OAuth callback is disabled as requested. Please configure a valid STRIPE_CLIENT_ID starting with 'ca_' in your environment files to use Stripe Connect OAuth.");
    }

    const clientSecret = this.getPlatformSecretKey();
    if (!clientSecret) {
      throw new Error("Stripe platform Secret Key (STRIPE_SECRET_KEY) is not configured in server environment.");
    }

    const response = await fetch("https://connect.stripe.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${clientSecret}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_secret: clientSecret,
      }).toString(),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await response.json().catch(() => ({})) as {
      error?: string;
      error_description?: string;
      stripe_user_id?: string;
      access_token?: string;
      refresh_token?: string;
      stripe_publishable_key?: string;
      scope?: string;
      livemode?: boolean;
    };

    if (!response.ok || !data.access_token || !data.stripe_user_id) {
      throw new Error(data.error_description || data.error || `Stripe token exchange failed with status ${response.status}`);
    }

    let accountName = "Stripe Merchant";
    let accountEmail: string | undefined;
    let accountCurrency = "USD";

    try {
      const acctRes = await fetch(`https://api.stripe.com/v1/accounts/${data.stripe_user_id}`, {
        headers: { Authorization: `Bearer ${clientSecret}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (acctRes.ok) {
        const acct = await acctRes.json() as any;
        accountName = acct.settings?.dashboard?.display_name || acct.business_profile?.name || acct.id;
        accountEmail = acct.email || acct.business_profile?.support_email;
        accountCurrency = (acct.default_currency || "usd").toUpperCase();
      }
    } catch {
      // Non-blocking metadata enrichment
    }

    return {
      accountId: data.stripe_user_id,
      accountName,
      accountEmail,
      accountCurrency,
      livemode: Boolean(data.livemode),
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      publishableKey: data.stripe_publishable_key,
      scope: data.scope,
      raw: data,
    };
  }

  async refreshCredentials(storeId: string, connection: DecryptedConnection): Promise<OAuthTokens | null> {
    if (!connection.refreshToken) return null;
    const clientSecret = this.getPlatformSecretKey();
    if (!clientSecret) return null;

    const response = await fetch("https://connect.stripe.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${clientSecret}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: connection.refreshToken,
        client_secret: clientSecret,
      }).toString(),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await response.json().catch(() => ({})) as any;
    if (!response.ok || !data.access_token) {
      return null;
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || connection.refreshToken,
      publishableKey: data.stripe_publishable_key || connection.publishableKey || undefined,
      scope: data.scope || connection.scope || undefined,
    };
  }

  async getAccountDetails(storeId: string, connection: DecryptedConnection): Promise<ProviderAccountInfo> {
    const authHeader = connection.accessToken
      ? `Bearer ${connection.accessToken}`
      : `Bearer ${this.getPlatformSecretKey()}`;

    const accountId = connection.accountId;
    const headers: Record<string, string> = { Authorization: authHeader };
    if (accountId && !connection.accessToken) {
      headers["Stripe-Account"] = accountId;
    }

    const response = await fetch(`https://api.stripe.com/v1/accounts/${accountId || "current"}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    const data = await response.json().catch(() => ({})) as any;
    if (!response.ok) {
      throw new Error(data.error?.message || "Failed to retrieve Stripe account details.");
    }

    return {
      accountId: data.id,
      accountName: data.settings?.dashboard?.display_name || data.business_profile?.name || data.id,
      accountEmail: data.email || data.business_profile?.support_email,
      accountCurrency: (data.default_currency || "usd").toUpperCase(),
      livemode: Boolean(data.charges_enabled),
      raw: data,
    };
  }

  async initializePayment(storeId: string, connection: DecryptedConnection, params: InitializePaymentParams): Promise<InitializePaymentResult> {
    const authKey = connection.accessToken || this.getPlatformSecretKey();
    if (!authKey) {
      throw new Error("Stripe credentials not found for this store. Please connect your Stripe account.");
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${authKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (connection.accountId && !connection.accessToken) {
      headers["Stripe-Account"] = connection.accountId;
    }

    const requestedCurrency = (params.currency || "usd").toLowerCase();
    const accountCurrency = (connection.accountCurrency || "usd").toLowerCase();

    // Determine target currency: prefer requested if supported by Stripe, otherwise fall back to account currency / USD
    const isSupported = STRIPE_SUPPORTED_CURRENCIES.has(requestedCurrency);
    const targetCurrency = isSupported
      ? requestedCurrency
      : (STRIPE_SUPPORTED_CURRENCIES.has(accountCurrency) ? accountCurrency : "usd");

    // Convert base USD cents to target currency
    let targetAmount = params.amount;
    let rate = 1.0;
    if (targetCurrency !== "usd") {
      const conversion = await convertFromUSD(params.amount, targetCurrency.toUpperCase());
      targetAmount = conversion.convertedAmount;
      rate = conversion.rate;
    }

    const buildLineItems = (curr: string, amt: number, convRate: number) => {
      const itemsSum = (params.items || []).reduce((sum, item) => sum + Math.round((item.price || 0) * 100 * convRate) * (item.quantity || 1), 0);
      const useIndividualItems = Boolean(params.items && params.items.length > 0 && Math.abs(itemsSum - amt) <= 5);

      return useIndividualItems
        ? (params.items || []).map((item, idx) => ({
            [`line_items[${idx}][price_data][currency]`]: curr,
            [`line_items[${idx}][price_data][unit_amount]`]: String(Math.round((item.price || 0) * 100 * convRate)),
            [`line_items[${idx}][price_data][product_data][name]`]: item.name || "Luxury Item",
            [`line_items[${idx}][quantity]`]: String(item.quantity || 1),
          })).reduce((acc, currMap) => ({ ...acc, ...currMap }), {})
        : {
            "line_items[0][price_data][currency]": curr,
            "line_items[0][price_data][unit_amount]": String(amt),
            "line_items[0][price_data][product_data][name]": params.items && params.items.length > 0
              ? `Luxe Boutique Order (${params.items.map(i => `${i.quantity}x ${i.name}`).join(", ")})`
              : `Order ${params.reference}`,
            "line_items[0][quantity]": "1",
          };
    };

    const buildCheckoutBody = (curr: string, amt: number, convRate: number) => {
      return new URLSearchParams({
        mode: "payment",
        success_url: `${params.callbackUrl}${params.callbackUrl.includes("?") ? "&" : "?"}reference=${params.reference}&session_id={CHECKOUT_SESSION_ID}&provider=stripe`,
        cancel_url: params.cancelUrl || params.callbackUrl,
        customer_email: params.customerEmail,
        client_reference_id: params.reference,
        "metadata[storeId]": storeId,
        "metadata[reference]": params.reference,
        "metadata[orderId]": params.orderId || "",
        "metadata[chargedCurrency]": curr.toUpperCase(),
        "metadata[exchangeRate]": String(convRate),
        ...buildLineItems(curr, amt, convRate),
      });
    };

    let response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers,
      body: buildCheckoutBody(targetCurrency, targetAmount, rate).toString(),
      signal: AbortSignal.timeout(15_000),
    });

    let session = await response.json().catch(() => ({})) as any;

    // Resilient fallback: If Stripe rejects currency as invalid for this account, retry in USD base
    if (!response.ok && targetCurrency !== "usd" && (
      session.error?.message?.toLowerCase().includes("invalid currency") ||
      session.error?.message?.toLowerCase().includes("currency") ||
      session.error?.code === "parameter_invalid_empty"
    )) {
      console.warn(`[StripePaymentProvider] Currency '${targetCurrency}' unsupported by Stripe account, falling back to USD`);
      response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers,
        body: buildCheckoutBody("usd", params.amount, 1.0).toString(),
        signal: AbortSignal.timeout(15_000),
      });
      session = await response.json().catch(() => ({})) as any;
    }

    if (!response.ok || !session.url) {
      throw new Error(session.error?.message || "Stripe Checkout session creation failed.");
    }

    return {
      authorizationUrl: session.url,
      clientSecret: session.client_secret || undefined,
      publishableKey: connection.publishableKey || undefined,
      reference: params.reference,
      provider: "stripe",
      providerTransactionId: session.id,
      raw: session,
    };
  }

  async verifyPayment(storeId: string, connection: DecryptedConnection, params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    const authKey = connection.accessToken || this.getPlatformSecretKey();
    if (!authKey) {
      throw new Error("Stripe credentials not found.");
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${authKey}`,
    };
    if (connection.accountId && !connection.accessToken) {
      headers["Stripe-Account"] = connection.accountId;
    }

    // Try finding by Checkout Session ID first, or Search by client_reference_id
    const sessionId = params.providerTransactionId || params.queryParams?.session_id;

    if (sessionId && sessionId.startsWith("cs_")) {
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });
      const session = await response.json().catch(() => ({})) as any;
      if (!response.ok) {
        throw new Error(session.error?.message || "Failed to retrieve Stripe session.");
      }

      const isPaid = session.payment_status === "paid" || session.status === "complete";
      return {
        success: isPaid,
        reference: session.client_reference_id || params.reference,
        providerTransactionId: session.id,
        amount: Number(session.amount_total || 0),
        currency: (session.currency || "usd").toUpperCase(),
        status: isPaid ? "paid" : session.payment_status || session.status,
        customerEmail: session.customer_details?.email || session.customer_email,
        paymentMethod: session.payment_method_types?.[0] || "card",
        raw: session,
      };
    }

    // Fallback: search sessions with client_reference_id
    const searchParams = new URLSearchParams({
      limit: "5",
    });
    const listRes = await fetch(`https://api.stripe.com/v1/checkout/sessions?${searchParams.toString()}`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    const list = await listRes.json().catch(() => ({})) as any;
    if (listRes.ok && Array.isArray(list.data)) {
      const matched = list.data.find((s: any) => s.client_reference_id === params.reference);
      if (matched) {
        const isPaid = matched.payment_status === "paid" || matched.status === "complete";
        return {
          success: isPaid,
          reference: matched.client_reference_id || params.reference,
          providerTransactionId: matched.id,
          amount: Number(matched.amount_total || 0),
          currency: (matched.currency || "usd").toUpperCase(),
          status: isPaid ? "paid" : matched.payment_status || matched.status,
          customerEmail: matched.customer_details?.email || matched.customer_email,
          paymentMethod: matched.payment_method_types?.[0] || "card",
          raw: matched,
        };
      }
    }

    throw new Error(`Could not find Stripe transaction with reference ${params.reference}`);
  }

  async processRefund(storeId: string, connection: DecryptedConnection, params: RefundParams): Promise<RefundResult> {
    const authKey = connection.accessToken || this.getPlatformSecretKey();
    if (!authKey) throw new Error("Stripe credentials missing.");

    const headers: Record<string, string> = {
      Authorization: `Bearer ${authKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (connection.accountId && !connection.accessToken) {
      headers["Stripe-Account"] = connection.accountId;
    }

    const bodyParams = new URLSearchParams({
      amount: String(params.amount),
      reason: params.reason === "duplicate" || params.reason === "fraudulent" ? params.reason : "requested_by_customer",
    });

    if (params.providerTransactionId?.startsWith("pi_")) {
      bodyParams.set("payment_intent", params.providerTransactionId);
    } else if (params.providerTransactionId?.startsWith("ch_")) {
      bodyParams.set("charge", params.providerTransactionId);
    } else if (params.providerTransactionId?.startsWith("cs_")) {
      // Retrieve session to get payment intent
      const sessRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${params.providerTransactionId}`, { headers });
      const sess = await sessRes.json() as any;
      if (sess.payment_intent) {
        bodyParams.set("payment_intent", sess.payment_intent);
      }
    }

    const response = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers,
      body: bodyParams.toString(),
      signal: AbortSignal.timeout(15_000),
    });

    const refund = await response.json().catch(() => ({})) as any;
    if (!response.ok || !refund.id) {
      throw new Error(refund.error?.message || "Stripe refund failed.");
    }

    return {
      success: refund.status === "succeeded" || refund.status === "pending",
      refundId: refund.id,
      amount: Number(refund.amount || params.amount),
      currency: (refund.currency || params.currency).toUpperCase(),
      status: refund.status === "succeeded" ? "SUCCEEDED" : refund.status === "pending" ? "PENDING" : "FAILED",
      raw: refund,
    };
  }

  async handleWebhook(
    rawBody: string,
    signature: string | undefined,
    headers: Record<string, string | string[] | undefined>,
    secretOverride?: string
  ): Promise<WebhookEventResult> {
    const webhookSecret = secretOverride || this.getWebhookSecret();
    if (!signature) {
      throw new Error("Missing Stripe-Signature header.");
    }
    if (!webhookSecret) {
      throw new Error("Stripe webhook secret is not configured.");
    }

    // Validate signature
    const sigElements = signature.split(",").reduce((acc, pair) => {
      const [k, v] = pair.split("=");
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {} as Record<string, string>);

    const timestamp = sigElements["t"];
    const v1 = sigElements["v1"];

    if (!timestamp || !v1) {
      throw new Error("Malformed Stripe signature header.");
    }

    const signedPayload = `${timestamp}.${rawBody}`;
    const expected = createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");

    const left = Buffer.from(expected, "hex");
    const right = Buffer.from(v1, "hex");
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new Error("Invalid Stripe webhook signature.");
    }

    const event = JSON.parse(rawBody) as {
      id: string;
      type: string;
      data?: { object?: Record<string, any> };
      account?: string;
    };

    const obj = event.data?.object ?? {};
    let reference = obj.client_reference_id || obj.metadata?.reference;
    let providerTransactionId = obj.id;
    let status: "paid" | "failed" | "refunded" | "processing" = "processing";
    let amount = Number(obj.amount_total || obj.amount || 0);
    let currency = (obj.currency || "USD").toUpperCase();

    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      status = "paid";
    } else if (event.type === "payment_intent.payment_failed" || event.type === "charge.failed") {
      status = "failed";
    } else if (event.type === "charge.refunded") {
      status = "refunded";
    }

    return {
      handled: true,
      provider: "stripe",
      eventId: event.id,
      eventType: event.type,
      reference,
      providerTransactionId,
      status,
      amount,
      currency,
      storeId: obj.metadata?.storeId,
      raw: event,
    };
  }

  async disconnect(storeId: string, connection: DecryptedConnection): Promise<void> {
    const clientSecret = this.getPlatformSecretKey();
    const clientId = this.getClientId();
    if (connection.accessToken && clientSecret && clientId && connection.accountId) {
      try {
        await fetch("https://connect.stripe.com/oauth/deauthorize", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${clientSecret}`,
          },
          body: new URLSearchParams({
            client_id: clientId,
            stripe_user_id: connection.accountId,
          }).toString(),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        // Non-blocking deauth
      }
    }
  }
}
