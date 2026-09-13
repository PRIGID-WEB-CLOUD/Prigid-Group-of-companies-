export type PaymentProviderType = "stripe" | "paystack" | "flutterwave";

export type PaymentConnectionStatus =
  | "NOT_CONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "FAILED"
  | "EXPIRED"
  | "REAUTHORIZATION_REQUIRED"
  | "DISCONNECTED";

export interface ProviderAccountInfo {
  accountId: string;
  accountName?: string;
  accountEmail?: string;
  accountCurrency?: string;
  livemode: boolean;
  raw?: Record<string, unknown>;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  publishableKey?: string;
  webhookSecret?: string;
  tokenExpiresAt?: Date;
  scope?: string;
}

export interface OAuthCallbackResult extends ProviderAccountInfo, OAuthTokens {}

export interface DecryptedConnection {
  id: string;
  storeId: string;
  provider: PaymentProviderType;
  status: PaymentConnectionStatus;
  accountId: string | null;
  accountName: string | null;
  accountEmail: string | null;
  accountCurrency: string | null;
  livemode: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  publishableKey: string | null;
  webhookSecret: string | null;
  tokenExpiresAt: Date | null;
  scope: string | null;
  metadata: Record<string, unknown>;
  isActive: boolean;
  connectedAt: Date | null;
}

export interface InitializePaymentParams {
  storeId: string;
  orderId?: string;
  reference: string;
  amount: number; // in minor units (cents / kobo)
  currency: string; // e.g. "USD", "NGN", "GHS", "EUR"
  customerEmail: string;
  customerName?: string;
  items?: Array<{ name: string; quantity: number; price: number; productId?: string }>;
  shippingAddress?: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  callbackUrl: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface InitializePaymentResult {
  authorizationUrl?: string;
  clientSecret?: string;
  publishableKey?: string;
  reference: string;
  provider: PaymentProviderType;
  providerTransactionId?: string;
  raw: Record<string, unknown>;
}

export interface VerifyPaymentParams {
  storeId: string;
  reference: string;
  providerTransactionId?: string;
  queryParams?: Record<string, string>;
}

export interface VerifyPaymentResult {
  success: boolean;
  reference: string;
  providerTransactionId?: string;
  amount: number; // in minor units
  currency: string;
  status: string; // e.g. "paid", "failed", "processing"
  customerEmail?: string;
  paymentMethod?: string;
  raw: Record<string, unknown>;
}

export interface RefundParams {
  storeId: string;
  transactionId: string;
  reference: string;
  providerTransactionId?: string;
  amount: number; // in minor units
  currency: string;
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount: number;
  currency: string;
  status: "SUCCEEDED" | "PENDING" | "FAILED";
  raw: Record<string, unknown>;
}

export interface WebhookEventResult {
  handled: boolean;
  provider: PaymentProviderType;
  eventId: string;
  eventType: string;
  reference?: string;
  providerTransactionId?: string;
  status?: "paid" | "failed" | "refunded" | "processing";
  amount?: number;
  currency?: string;
  storeId?: string;
  raw: Record<string, unknown>;
}

export interface ProviderCapability {
  supportsOAuth: boolean;
  supportsDirectKey: boolean;
  supportsRefunds: boolean;
  supportsWebhooks: boolean;
  supportedCurrencies: string[];
}

export interface IPaymentProvider {
  getProviderName(): PaymentProviderType;
  getDisplayName(): string;
  getCapabilities(): ProviderCapability;
  isPlatformConfigured(): boolean;
  getAuthorizationUrl(storeId: string, state: string, redirectUri: string): Promise<string>;
  handleOAuthCallback(storeId: string, code: string, state: string, redirectUri: string): Promise<OAuthCallbackResult>;
  refreshCredentials(storeId: string, connection: DecryptedConnection): Promise<OAuthTokens | null>;
  getAccountDetails(storeId: string, connection: DecryptedConnection): Promise<ProviderAccountInfo>;
  initializePayment(storeId: string, connection: DecryptedConnection, params: InitializePaymentParams): Promise<InitializePaymentResult>;
  verifyPayment(storeId: string, connection: DecryptedConnection, params: VerifyPaymentParams): Promise<VerifyPaymentResult>;
  processRefund(storeId: string, connection: DecryptedConnection, params: RefundParams): Promise<RefundResult>;
  handleWebhook(rawBody: string, signature: string | undefined, headers: Record<string, string | string[] | undefined>, secretOverride?: string): Promise<WebhookEventResult>;
  disconnect(storeId: string, connection: DecryptedConnection): Promise<void>;
}
