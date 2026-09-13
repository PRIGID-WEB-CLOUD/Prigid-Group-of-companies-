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

export class FlutterwavePaymentProvider implements IPaymentProvider {
  getProviderName(): PaymentProviderType {
    return "flutterwave";
  }

  getDisplayName(): string {
    return "Flutterwave (Cards, Mobile Money, M-Pesa, Bank Accounts)";
  }

  getCapabilities(): ProviderCapability {
    const clientId = this.getClientId();
    const supportsOAuth = Boolean(clientId && !clientId.startsWith("pk_") && !clientId.startsWith("FLWPUBK"));
    return {
      supportsOAuth,
      supportsDirectKey: true,
      supportsRefunds: true,
      supportsWebhooks: true,
      supportedCurrencies: ["NGN", "USD", "EUR", "GBP", "GHS", "KES", "ZAR", "UGX", "TZS", "RWF", "XAF", "XOF"],
    };
  }

  private getClientId(): string | undefined {
    return process.env.FLUTTERWAVE_CLIENT_ID;
  }

  private getPlatformSecretKey(): string | undefined {
    return process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY;
  }

  private getWebhookSecret(): string | undefined {
    return process.env.FLUTTERWAVE_WEBHOOK_SECRET || process.env.FLUTTERWAVE_SECRET_HASH || process.env.FLW_SECRET_HASH;
  }

  isPlatformConfigured(): boolean {
    return Boolean(this.getClientId() || this.getPlatformSecretKey());
  }

  async getAuthorizationUrl(storeId: string, state: string, redirectUri: string): Promise<string> {
    const clientId = this.getClientId();
    if (!clientId || clientId.startsWith("pk_") || clientId.startsWith("FLWPUBK")) {
      throw new Error("Flutterwave OAuth requires a valid Client App ID (FLUTTERWAVE_CLIENT_ID). Please use Direct API Key entry for your Secret Key and Public Key.");
    }
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      state,
      redirect_uri: redirectUri,
    });
    return `https://app.flutterwave.com/oauth/authorize?${params.toString()}`;
  }

  async handleOAuthCallback(storeId: string, code: string, state: string, redirectUri: string): Promise<OAuthCallbackResult> {
    const clientSecret = this.getPlatformSecretKey();
    const clientId = this.getClientId();
    if (!clientSecret || !clientId) {
      throw new Error("Flutterwave platform credentials (FLUTTERWAVE_CLIENT_ID, FLUTTERWAVE_SECRET_KEY) are not configured.");
    }

    const response = await fetch("https://api.flutterwave.com/v3/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const body = await response.json().catch(() => ({})) as any;
    if (!response.ok || !body.data?.access_token) {
      throw new Error(body.message || "Flutterwave OAuth code exchange failed.");
    }

    const tokenData = body.data;
    const accountId = String(tokenData.merchant_id || `flw_${Date.now()}`);

    return {
      accountId,
      accountName: tokenData.merchant_name || "Flutterwave Merchant",
      accountEmail: tokenData.merchant_email,
      accountCurrency: "USD",
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
    const clientId = this.getClientId();
    if (!clientSecret || !clientId) return null;

    const response = await fetch("https://api.flutterwave.com/v3/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: connection.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
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
    if (!authKey) throw new Error("Flutterwave credentials not available.");

    return {
      accountId: connection.accountId || "flw_account",
      accountName: connection.accountName || "Flutterwave Merchant",
      accountEmail: connection.accountEmail || undefined,
      accountCurrency: connection.accountCurrency || "USD",
      livemode: connection.livemode,
      raw: connection.metadata,
    };
  }

  async initializePayment(storeId: string, connection: DecryptedConnection, params: InitializePaymentParams): Promise<InitializePaymentResult> {
    const authKey = connection.accessToken || this.getPlatformSecretKey();
    if (!authKey) {
      throw new Error("Flutterwave credentials not configured for this store.");
    }

    // Flutterwave accepts standard amount (e.g. 10.50 instead of 1050 cents)
    const decimalAmount = (params.amount / 100).toFixed(2);

    const payload: Record<string, unknown> = {
      tx_ref: params.reference,
      amount: decimalAmount,
      currency: params.currency.toUpperCase(),
      redirect_url: `${params.callbackUrl}${params.callbackUrl.includes("?") ? "&" : "?"}reference=${params.reference}&provider=flutterwave`,
      customer: {
        email: params.customerEmail,
        name: params.customerName || "Customer",
      },
      customizations: {
        title: "Luxe Boutique Checkout",
        description: `Order ${params.reference}`,
      },
      meta: {
        storeId,
        orderId: params.orderId,
        reference: params.reference,
      },
    };

    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const body = await response.json().catch(() => ({})) as any;
    if (!response.ok || body.status !== "success" || !body.data?.link) {
      throw new Error(body.message || "Flutterwave payment initialization failed.");
    }

    return {
      authorizationUrl: body.data.link,
      publishableKey: connection.publishableKey || undefined,
      reference: params.reference,
      provider: "flutterwave",
      providerTransactionId: params.reference,
      raw: body.data,
    };
  }

  async verifyPayment(storeId: string, connection: DecryptedConnection, params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    const authKey = connection.accessToken || this.getPlatformSecretKey();
    if (!authKey) throw new Error("Flutterwave credentials not available.");

    // Verification by tx_ref
    const response = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(params.reference)}`, {
      headers: { Authorization: `Bearer ${authKey}` },
      signal: AbortSignal.timeout(15_000),
    });

    const body = await response.json().catch(() => ({})) as any;
    if (!response.ok || body.status !== "success" || !body.data) {
      throw new Error(body.message || `Flutterwave payment verification failed for ${params.reference}`);
    }

    const data = body.data;
    const isPaid = data.status === "successful";

    return {
      success: isPaid,
      reference: data.tx_ref || params.reference,
      providerTransactionId: String(data.id || data.tx_ref),
      amount: Math.round(Number(data.amount || 0) * 100), // convert back to minor units
      currency: (data.currency || "USD").toUpperCase(),
      status: isPaid ? "paid" : data.status || "failed",
      customerEmail: data.customer?.email,
      paymentMethod: data.payment_type || "card",
      raw: data,
    };
  }

  async processRefund(storeId: string, connection: DecryptedConnection, params: RefundParams): Promise<RefundResult> {
    const authKey = connection.accessToken || this.getPlatformSecretKey();
    if (!authKey) throw new Error("Flutterwave credentials not available.");

    const transactionId = params.providerTransactionId;
    if (!transactionId) {
      throw new Error("Flutterwave transaction ID is required to issue a refund.");
    }

    const decimalAmount = (params.amount / 100).toFixed(2);

    const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: decimalAmount,
        comments: params.reason || "Customer refund",
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const body = await response.json().catch(() => ({})) as any;
    if (!response.ok || body.status !== "success") {
      throw new Error(body.message || "Flutterwave refund request failed.");
    }

    return {
      success: true,
      refundId: String(body.data?.id || `flw_ref_${Date.now()}`),
      amount: Math.round(Number(body.data?.amount_refunded || decimalAmount) * 100),
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
    const secretHash = secretOverride || this.getWebhookSecret();
    const receivedHash = (headers["verif-hash"] || headers["verif_hash"] || signature) as string | undefined;

    if (secretHash && receivedHash && receivedHash !== secretHash) {
      throw new Error("Invalid Flutterwave webhook signature hash.");
    }

    const event = JSON.parse(rawBody) as {
      event?: string;
      "event.type"?: string;
      data?: Record<string, any>;
    };

    const d = event.data ?? {};
    const reference = d.tx_ref;
    const eventType = event.event || event["event.type"] || "charge.completed";
    let status: "paid" | "failed" | "refunded" | "processing" = "processing";

    if (d.status === "successful") {
      status = "paid";
    } else if (d.status === "failed") {
      status = "failed";
    }

    return {
      handled: true,
      provider: "flutterwave",
      eventId: String(d.id || `flw_evt_${Date.now()}`),
      eventType,
      reference,
      providerTransactionId: String(d.id || reference),
      status,
      amount: Math.round(Number(d.amount || 0) * 100),
      currency: (d.currency || "USD").toUpperCase(),
      storeId: d.meta?.storeId,
      raw: event,
    };
  }

  async disconnect(storeId: string, connection: DecryptedConnection): Promise<void> {
    // Flutterwave disconnect hook
  }
}
