import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  storesTable,
  paymentProviderConnectionsTable,
  paymentOAuthStatesTable,
  paymentTransactionsTable,
  paymentRefundsTable,
  paymentWebhookEventsTable,
  paymentAuditLogsTable,
  appSettingsTable,
  providerPluginsTable,
  ordersTable,
} from "@workspace/db";
import { encryptCredential, decryptCredential } from "../credentialVault";
import { StripePaymentProvider } from "./StripePaymentProvider";
import { PaystackPaymentProvider } from "./PaystackPaymentProvider";
import { FlutterwavePaymentProvider } from "./FlutterwavePaymentProvider";
import type {
  IPaymentProvider,
  PaymentProviderType,
  PaymentConnectionStatus,
  DecryptedConnection,
  InitializePaymentParams,
  InitializePaymentResult,
  VerifyPaymentParams,
  VerifyPaymentResult,
  RefundParams,
  RefundResult,
  WebhookEventResult,
} from "./types";

const PROVIDER_LOGOS: Record<string, string> = {
  stripe: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg",
  paystack: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Paystack_Logo.png",
  flutterwave: "https://upload.wikimedia.org/wikipedia/commons/e/e1/Flutterwave_Logo.png",
  paypal: "https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg",
};

export class PaymentService {
  private providers = new Map<PaymentProviderType, IPaymentProvider>();
  private fallbackOAuthStates = new Map<string, {
    id: string;
    storeId: string;
    provider: string;
    state: string;
    codeVerifier?: string | null;
    returnUrl?: string | null;
    expiresAt: Date;
    usedAt?: Date | null;
  }>();

  constructor() {
    this.registerProvider(new StripePaymentProvider());
    this.registerProvider(new PaystackPaymentProvider());
    this.registerProvider(new FlutterwavePaymentProvider());
  }

  registerProvider(provider: IPaymentProvider) {
    this.providers.set(provider.getProviderName(), provider);
  }

  getProvider(providerName: PaymentProviderType): IPaymentProvider {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Unsupported payment provider: ${providerName}`);
    }
    return provider;
  }

  async ensureStore(storeId = "store-main", name = "Luxe Boutique Ateliers"): Promise<string> {
    try {
      if (pool) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS "stores" (
            "id" text PRIMARY KEY,
            "name" text NOT NULL,
            "owner_id" text,
            "currency" text NOT NULL DEFAULT 'USD',
            "active_payment_provider" text DEFAULT 'stripe',
            "created_at" timestamp NOT NULL DEFAULT NOW(),
            "updated_at" timestamp NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS "payment_oauth_states" (
            "id" text PRIMARY KEY,
            "store_id" text NOT NULL DEFAULT 'store-main',
            "provider" text NOT NULL,
            "state" text NOT NULL UNIQUE,
            "code_verifier" text,
            "return_url" text,
            "expires_at" timestamp NOT NULL,
            "used_at" timestamp,
            "created_at" timestamp NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS "payment_provider_connections" (
            "id" text PRIMARY KEY,
            "store_id" text NOT NULL DEFAULT 'store-main',
            "provider" text NOT NULL,
            "status" text NOT NULL DEFAULT 'NOT_CONNECTED',
            "account_id" text,
            "account_name" text,
            "account_email" text,
            "account_currency" text DEFAULT 'USD',
            "livemode" boolean NOT NULL DEFAULT false,
            "encrypted_access_token" text,
            "encrypted_refresh_token" text,
            "encrypted_publishable_key" text,
            "encrypted_webhook_secret" text,
            "token_expires_at" timestamp,
            "scope" text,
            "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "is_active" boolean NOT NULL DEFAULT false,
            "last_synced_at" timestamp,
            "connected_at" timestamp,
            "created_at" timestamp NOT NULL DEFAULT NOW(),
            "updated_at" timestamp NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS "payment_audit_logs" (
            "id" text PRIMARY KEY,
            "store_id" text NOT NULL DEFAULT 'store-main',
            "user_id" text,
            "action" text NOT NULL,
            "provider" text NOT NULL,
            "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "ip_address" text,
            "user_agent" text,
            "created_at" timestamp NOT NULL DEFAULT NOW()
          );
        `);
      }
      const [existing] = await db.select().from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
      if (!existing) {
        await db.insert(storesTable).values({
          id: storeId,
          name,
          currency: "USD",
          activePaymentProvider: "stripe",
        }).onConflictDoNothing();
      }
    } catch (err) {
      console.warn("[PaymentService] Table or store check notice:", err);
    }
    return storeId;
  }

  async logAudit(params: {
    storeId?: string;
    userId?: string;
    action: string;
    provider: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      await db.insert(paymentAuditLogsTable).values({
        id: randomUUID(),
        storeId: params.storeId || "store-main",
        userId: params.userId,
        action: params.action,
        provider: params.provider,
        details: params.details || {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
    } catch (err) {
      console.warn("[Payment Audit] Failed to write log:", err);
    }
  }

  async getProvidersStatus(storeId = "store-main") {
    await this.ensureStore(storeId);
    const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
    const connections = await db.select().from(paymentProviderConnectionsTable)
      .where(eq(paymentProviderConnectionsTable.storeId, storeId));

    const result = [];
    for (const [key, provider] of this.providers.entries()) {
      const providerConns = connections.filter(c => c.provider === key);
      const isPlatformConfigured = provider.isPlatformConfigured();
      const capabilities = provider.getCapabilities();

      if (providerConns.length > 0) {
        for (const conn of providerConns) {
          result.push({
            id: conn.id,
            provider: key,
            name: conn.accountName ? `${provider.getDisplayName()} (${conn.accountName})` : provider.getDisplayName(),
            logoUrl: PROVIDER_LOGOS[key] || null,
            status: conn.status as PaymentConnectionStatus,
            isConnected: Boolean(conn.status === "CONNECTED" || conn.encryptedAccessToken),
            isPlatformConfigured,
            isActive: conn.isActive,
            capabilities,
            accountId: conn.accountId,
            accountName: conn.accountName,
            accountEmail: conn.accountEmail,
            accountCurrency: conn.accountCurrency || "USD",
            livemode: conn.livemode,
            hasPublishableKey: Boolean(conn.encryptedPublishableKey),
            tokenExpiresAt: conn.tokenExpiresAt || null,
            connectedAt: conn.connectedAt || null,
            lastSyncedAt: conn.lastSyncedAt || null,
          });
        }
      } else {
        const legacyConn = await this.getDecryptedConnection(storeId, key as PaymentProviderType);
        if (legacyConn && legacyConn.status === "CONNECTED") {
          result.push({
            id: legacyConn.id || `prov_${key}`,
            provider: key,
            name: legacyConn.accountName ? `${provider.getDisplayName()} (${legacyConn.accountName})` : provider.getDisplayName(),
            logoUrl: PROVIDER_LOGOS[key] || null,
            status: "CONNECTED" as PaymentConnectionStatus,
            isConnected: true,
            isPlatformConfigured,
            isActive: legacyConn.isActive ?? (store?.activePaymentProvider || "stripe").split(",").map(s => s.trim()).includes(key),
            capabilities,
            accountId: legacyConn.accountId,
            accountName: legacyConn.accountName,
            accountEmail: legacyConn.accountEmail,
            accountCurrency: legacyConn.accountCurrency || "USD",
            livemode: legacyConn.livemode,
            hasPublishableKey: Boolean(legacyConn.publishableKey),
            tokenExpiresAt: null,
            connectedAt: legacyConn.connectedAt || null,
            lastSyncedAt: null,
          });
        } else {
          result.push({
            id: `prov_${key}`,
            provider: key,
            name: provider.getDisplayName(),
            logoUrl: PROVIDER_LOGOS[key] || null,
            status: "NOT_CONNECTED" as PaymentConnectionStatus,
            isConnected: false,
            isPlatformConfigured,
            isActive: false,
            capabilities,
            accountId: null,
            accountName: null,
            accountEmail: null,
            accountCurrency: "USD",
            livemode: false,
            hasPublishableKey: false,
            tokenExpiresAt: null,
            connectedAt: null,
            lastSyncedAt: null,
          });
        }
      }
    }

    return {
      activeProvider: store?.activePaymentProvider || "stripe",
      storeCurrency: store?.currency || "USD",
      providers: result,
    };
  }

  async initiateOAuthConnect(params: {
    storeId?: string;
    providerName: PaymentProviderType;
    redirectUri: string;
    returnUrl?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ authorizationUrl: string; state: string }> {
    const storeId = params.storeId || "store-main";
    await this.ensureStore(storeId);
    const provider = this.getProvider(params.providerName);

    const state = randomBytes(24).toString("base64url");
    const codeVerifier = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    const stateObj = {
      id: randomUUID(),
      storeId,
      provider: params.providerName,
      state,
      codeVerifier,
      returnUrl: params.returnUrl || null,
      expiresAt,
      usedAt: null as Date | null,
    };

    this.fallbackOAuthStates.set(state, stateObj);

    try {
      await db.insert(paymentOAuthStatesTable).values(stateObj);
    } catch (err) {
      console.warn("[PaymentService] OAuth state DB insert warning (fallback store active):", err);
    }

    const authorizationUrl = await provider.getAuthorizationUrl(storeId, state, params.redirectUri);

    await this.logAudit({
      storeId,
      userId: params.userId,
      action: "CONNECT_INITIATED",
      provider: params.providerName,
      details: { redirectUri: params.redirectUri },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return { authorizationUrl, state };
  }

  async handleOAuthCallback(params: {
    code: string;
    state: string;
    redirectUri: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ success: boolean; provider: string; storeId: string; returnUrl?: string }> {
    let oauthState: any = null;

    try {
      const [dbState] = await db.select().from(paymentOAuthStatesTable)
        .where(and(
          eq(paymentOAuthStatesTable.state, params.state),
          isNull(paymentOAuthStatesTable.usedAt),
          gt(paymentOAuthStatesTable.expiresAt, new Date())
        )).limit(1);
      oauthState = dbState;
    } catch (err) {
      console.warn("[PaymentService] DB state query failed, attempting in-memory lookup:", err);
    }

    if (!oauthState) {
      const memState = this.fallbackOAuthStates.get(params.state);
      if (memState && !memState.usedAt && memState.expiresAt > new Date()) {
        oauthState = memState;
      }
    }

    if (!oauthState) {
      throw Object.assign(new Error("Invalid or expired OAuth state token. Please restart the connection flow."), { statusCode: 400 });
    }

    // Mark state as consumed
    oauthState.usedAt = new Date();
    this.fallbackOAuthStates.set(params.state, oauthState);

    try {
      await db.update(paymentOAuthStatesTable)
        .set({ usedAt: new Date() })
        .where(eq(paymentOAuthStatesTable.id, oauthState.id));
    } catch (err) {
      console.warn("[PaymentService] DB state update notice:", err);
    }

    const providerName = oauthState.provider as PaymentProviderType;
    const provider = this.getProvider(providerName);
    const storeId = oauthState.storeId;

    const tokenResult = await provider.handleOAuthCallback(storeId, params.code, params.state, params.redirectUri);

    const encryptedAccessToken = encryptCredential(tokenResult.accessToken);
    const encryptedRefreshToken = tokenResult.refreshToken ? encryptCredential(tokenResult.refreshToken) : null;
    const encryptedPublishableKey = tokenResult.publishableKey ? encryptCredential(tokenResult.publishableKey) : null;
    const encryptedWebhookSecret = tokenResult.webhookSecret ? encryptCredential(tokenResult.webhookSecret) : null;

    const [existing] = await db.select().from(paymentProviderConnectionsTable)
      .where(and(
        eq(paymentProviderConnectionsTable.storeId, storeId),
        eq(paymentProviderConnectionsTable.provider, providerName),
        eq(paymentProviderConnectionsTable.accountId, tokenResult.accountId)
      )).limit(1);

    const connId = existing?.id || randomUUID();

    if (existing) {
      await db.update(paymentProviderConnectionsTable).set({
        status: "CONNECTED",
        accountId: tokenResult.accountId,
        accountName: tokenResult.accountName,
        accountEmail: tokenResult.accountEmail,
        accountCurrency: tokenResult.accountCurrency || "USD",
        livemode: tokenResult.livemode,
        encryptedAccessToken,
        encryptedRefreshToken,
        encryptedPublishableKey,
        encryptedWebhookSecret,
        tokenExpiresAt: tokenResult.tokenExpiresAt,
        scope: tokenResult.scope,
        metadata: (tokenResult.raw as any) || {},
        lastSyncedAt: new Date(),
        connectedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(paymentProviderConnectionsTable.id, existing.id));
    } else {
      await db.insert(paymentProviderConnectionsTable).values({
        id: connId,
        storeId,
        provider: providerName,
        status: "CONNECTED",
        accountId: tokenResult.accountId,
        accountName: tokenResult.accountName,
        accountEmail: tokenResult.accountEmail,
        accountCurrency: tokenResult.accountCurrency || "USD",
        livemode: tokenResult.livemode,
        encryptedAccessToken,
        encryptedRefreshToken,
        encryptedPublishableKey,
        encryptedWebhookSecret,
        tokenExpiresAt: tokenResult.tokenExpiresAt,
        scope: tokenResult.scope,
        metadata: (tokenResult.raw as any) || {},
        isActive: false,
        lastSyncedAt: new Date(),
        connectedAt: new Date(),
      });
    }

    // If store currently has no active provider, automatically make this connected one active
    const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
    if (!store?.activePaymentProvider || store.activePaymentProvider === "none") {
      await db.update(storesTable).set({ activePaymentProvider: providerName, updatedAt: new Date() })
        .where(eq(storesTable.id, storeId));
    }

    await this.logAudit({
      storeId,
      userId: params.userId,
      action: "CONNECTED",
      provider: providerName,
      details: { accountId: tokenResult.accountId, accountName: tokenResult.accountName },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return {
      success: true,
      provider: providerName,
      storeId,
      returnUrl: oauthState.returnUrl || undefined,
    };
  }

  async setActiveProvider(params: {
    storeId?: string;
    providerName: PaymentProviderType;
    connectionId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const storeId = params.storeId || "store-main";
    await this.ensureStore(storeId);

    if (params.connectionId) {
      const [targetConn] = await db.select().from(paymentProviderConnectionsTable)
        .where(and(
          eq(paymentProviderConnectionsTable.storeId, storeId),
          eq(paymentProviderConnectionsTable.id, params.connectionId)
        )).limit(1);

      const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
      const activeList = (store?.activePaymentProvider || "stripe").split(",").map(s => s.trim()).filter(Boolean);

      let nextActiveState = true;
      if (targetConn?.isActive && activeList.includes(params.providerName)) {
        if (activeList.length > 1) {
          nextActiveState = false;
        }
      }

      // Deactivate other connections of this provider
      await db.update(paymentProviderConnectionsTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(
          eq(paymentProviderConnectionsTable.storeId, storeId),
          eq(paymentProviderConnectionsTable.provider, params.providerName)
        ));

      // Set target connection active state
      await db.update(paymentProviderConnectionsTable)
        .set({ isActive: nextActiveState, updatedAt: new Date() })
        .where(and(
          eq(paymentProviderConnectionsTable.storeId, storeId),
          eq(paymentProviderConnectionsTable.id, params.connectionId)
        ));

      // Update store active list
      let nextActiveList = [...activeList];
      if (nextActiveState) {
        if (!nextActiveList.includes(params.providerName)) {
          nextActiveList.push(params.providerName);
        }
      } else {
        nextActiveList = nextActiveList.filter(p => p !== params.providerName);
      }

      if (nextActiveList.length === 0) {
        nextActiveList = [params.providerName];
      }

      await db.update(storesTable).set({
        activePaymentProvider: nextActiveList.join(","),
        updatedAt: new Date(),
      }).where(eq(storesTable.id, storeId));

      await this.logAudit({
        storeId,
        userId: params.userId,
        action: "SET_ACTIVE_ACCOUNT",
        provider: params.providerName,
        details: { connectionId: params.connectionId, action: nextActiveState ? "ACTIVATED" : "DEACTIVATED" },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });

      return { success: true, activeProvider: params.providerName, isActive: nextActiveState };
    }

    // Retrieve current store settings
    const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
    const activeList = (store?.activePaymentProvider || "stripe").split(",").map(s => s.trim()).filter(Boolean);

    let nextActiveList: string[];
    let action: "ACTIVATED" | "DEACTIVATED";

    if (activeList.includes(params.providerName)) {
      // If it's already active, clicking it DEACTIVATES it!
      nextActiveList = activeList.filter(p => p !== params.providerName);
      action = "DEACTIVATED";
    } else {
      // If it's not active, clicking it ACTIVATES it alongside others!
      nextActiveList = [...activeList, params.providerName];
      action = "ACTIVATED";
    }

    // Ensure we have at least one active provider
    if (nextActiveList.length === 0) {
      nextActiveList = [params.providerName];
      action = "ACTIVATED";
    }

    const activeStr = nextActiveList.join(",");

    await db.update(storesTable).set({
      activePaymentProvider: activeStr,
      updatedAt: new Date(),
    }).where(eq(storesTable.id, storeId));

    // Update connection status in database for the active toggle
    await db.update(paymentProviderConnectionsTable)
      .set({ isActive: nextActiveList.includes(params.providerName), updatedAt: new Date() })
      .where(and(
        eq(paymentProviderConnectionsTable.storeId, storeId),
        eq(paymentProviderConnectionsTable.provider, params.providerName)
      ));

    // Synchronize isActive flag on other connection rows
    for (const key of this.providers.keys()) {
      if (key !== params.providerName) {
        await db.update(paymentProviderConnectionsTable)
          .set({ isActive: nextActiveList.includes(key), updatedAt: new Date() })
          .where(and(
            eq(paymentProviderConnectionsTable.storeId, storeId),
            eq(paymentProviderConnectionsTable.provider, key)
          ));
      }
    }

    await this.logAudit({
      storeId,
      userId: params.userId,
      action: "SET_ACTIVE",
      provider: params.providerName,
      details: { action, activeProviders: nextActiveList },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return { success: true, activeProvider: activeStr };
  }

  async disconnectProvider(params: {
    storeId?: string;
    providerName: PaymentProviderType;
    connectionId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const storeId = params.storeId || "store-main";
    const provider = this.getProvider(params.providerName);
    
    let existing;
    if (params.connectionId) {
      [existing] = await db.select().from(paymentProviderConnectionsTable)
        .where(and(
          eq(paymentProviderConnectionsTable.storeId, storeId),
          eq(paymentProviderConnectionsTable.id, params.connectionId)
        )).limit(1);
    } else {
      [existing] = await db.select().from(paymentProviderConnectionsTable)
        .where(and(
          eq(paymentProviderConnectionsTable.storeId, storeId),
          eq(paymentProviderConnectionsTable.provider, params.providerName)
        )).limit(1);
    }

    if (existing) {
      try {
        const decrypted = await this.getDecryptedConnection(storeId, params.providerName);
        if (decrypted) {
          await provider.disconnect(storeId, decrypted);
        }
      } catch (err) {
        console.warn(`[Payment] Disconnect hook error for ${params.providerName}:`, err);
      }

      if (params.connectionId) {
        await db.delete(paymentProviderConnectionsTable)
          .where(and(
            eq(paymentProviderConnectionsTable.storeId, storeId),
            eq(paymentProviderConnectionsTable.id, params.connectionId)
          ));
      } else {
        await db.update(paymentProviderConnectionsTable).set({
          status: "DISCONNECTED",
          encryptedAccessToken: null,
          encryptedRefreshToken: null,
          encryptedPublishableKey: null,
          encryptedWebhookSecret: null,
          isActive: false,
          updatedAt: new Date(),
        }).where(and(
          eq(paymentProviderConnectionsTable.storeId, storeId),
          eq(paymentProviderConnectionsTable.provider, params.providerName)
        ));
      }
    } else {
      await db.insert(paymentProviderConnectionsTable).values({
        id: randomUUID(),
        storeId,
        provider: params.providerName,
        status: "DISCONNECTED",
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        encryptedPublishableKey: null,
        encryptedWebhookSecret: null,
        isActive: false,
        livemode: false,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const remainingConnections = await db.select().from(paymentProviderConnectionsTable)
      .where(and(
        eq(paymentProviderConnectionsTable.storeId, storeId),
        eq(paymentProviderConnectionsTable.provider, params.providerName),
        eq(paymentProviderConnectionsTable.status, "CONNECTED")
      ));

    if (remainingConnections.length === 0) {
      const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
      const activeList = (store?.activePaymentProvider || "stripe").split(",").map(s => s.trim()).filter(Boolean);
      
      if (activeList.includes(params.providerName)) {
        const nextActiveList = activeList.filter(p => p !== params.providerName);
        const nextActive = nextActiveList.length > 0 ? nextActiveList.join(",") : "stripe";
        await db.update(storesTable).set({ activePaymentProvider: nextActive, updatedAt: new Date() })
          .where(eq(storesTable.id, storeId));
      }
    }

    await this.logAudit({
      storeId,
      userId: params.userId,
      action: "DISCONNECTED",
      provider: params.providerName,
      details: { connectionId: params.connectionId },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return { success: true };
  }

  async getDecryptedConnection(storeId: string, providerName: PaymentProviderType): Promise<DecryptedConnection | null> {
    // 1. Prioritize active AND connected connection
    let [row] = await db.select().from(paymentProviderConnectionsTable)
      .where(and(
        eq(paymentProviderConnectionsTable.storeId, storeId),
        eq(paymentProviderConnectionsTable.provider, providerName),
        eq(paymentProviderConnectionsTable.isActive, true),
        eq(paymentProviderConnectionsTable.status, "CONNECTED")
      )).limit(1);

    // 2. If not marked active specifically, find any CONNECTED connection
    if (!row) {
      [row] = await db.select().from(paymentProviderConnectionsTable)
        .where(and(
          eq(paymentProviderConnectionsTable.storeId, storeId),
          eq(paymentProviderConnectionsTable.provider, providerName),
          eq(paymentProviderConnectionsTable.status, "CONNECTED")
        )).limit(1);
    }

    // 3. Look for active connection without status check
    if (!row) {
      [row] = await db.select().from(paymentProviderConnectionsTable)
        .where(and(
          eq(paymentProviderConnectionsTable.storeId, storeId),
          eq(paymentProviderConnectionsTable.provider, providerName),
          eq(paymentProviderConnectionsTable.isActive, true)
        )).limit(1);
    }

    // 4. Fallback to any connection record
    if (!row) {
      [row] = await db.select().from(paymentProviderConnectionsTable)
        .where(and(
          eq(paymentProviderConnectionsTable.storeId, storeId),
          eq(paymentProviderConnectionsTable.provider, providerName)
        )).limit(1);
    }

    if (!row) {
      // Fallback: check if legacy settings, plugins, or env variables exist for this provider
      let legacyKey: string | null = null;
      let legacyPub: string | null = null;

      try {
        const [appSetting] = await db.select({ value: appSettingsTable.value })
          .from(appSettingsTable).where(eq(appSettingsTable.key, `${providerName}_secret_key`)).limit(1);
        if (appSetting?.value) {
          legacyKey = decryptCredential(appSetting.value);
        }
      } catch {}

      if (!legacyKey) {
        try {
          const [appPub] = await db.select({ value: appSettingsTable.value })
            .from(appSettingsTable).where(eq(appSettingsTable.key, `${providerName}_public_key`)).limit(1);
          if (appPub?.value) {
            legacyPub = decryptCredential(appPub.value);
          }
        } catch {}
      }

      if (!legacyKey) {
        try {
          const [plugin] = await db.select().from(providerPluginsTable)
            .where(eq(providerPluginsTable.name, providerName)).limit(1);
          if (plugin?.apiKey) {
            legacyKey = decryptCredential(plugin.apiKey);
          }
        } catch {}
      }

      if (!legacyKey) {
        if (providerName === "paystack") {
          legacyKey = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || null;
          legacyPub = legacyPub || process.env.PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_PUBLISHABLE_KEY || null;
        } else if (providerName === "stripe") {
          legacyKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || process.env.STRIPE_API_KEY || null;
          legacyPub = legacyPub || process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLIC_KEY || null;
        } else if (providerName === "flutterwave") {
          legacyKey = process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLUTTERWAVE_SECRET || null;
          legacyPub = legacyPub || process.env.FLUTTERWAVE_PUBLIC_KEY || null;
        }
      }

      const legacyWebhook = providerName === "stripe"
        ? (process.env.STRIPE_WEBHOOK_SECRET || null)
        : providerName === "paystack"
        ? (process.env.PAYSTACK_SECRET_KEY || null)
        : null;

      if (legacyKey) {
        return {
          id: `virtual_${providerName}`,
          storeId,
          provider: providerName,
          status: "CONNECTED",
          accountId: `${providerName}_key`,
          accountName: `${providerName.toUpperCase()} Connected Account`,
          accountEmail: null,
          accountCurrency: providerName === "paystack" ? "NGN" : "USD",
          livemode: !legacyKey.includes("_test_"),
          accessToken: legacyKey,
          refreshToken: null,
          publishableKey: legacyPub,
          webhookSecret: legacyWebhook,
          tokenExpiresAt: null,
          scope: null,
          metadata: {},
          isActive: true,
          connectedAt: new Date(),
        };
      }

      return {
        id: `virtual_${providerName}`,
        storeId,
        provider: providerName,
        status: "NOT_CONNECTED",
        accountId: null,
        accountName: null,
        accountEmail: null,
        accountCurrency: "USD",
        livemode: false,
        accessToken: null,
        refreshToken: null,
        publishableKey: null,
        webhookSecret: null,
        tokenExpiresAt: null,
        scope: null,
        metadata: {},
        isActive: false,
        connectedAt: null,
      };
    }

    return {
      id: row.id,
      storeId: row.storeId,
      provider: row.provider as PaymentProviderType,
      status: row.status as PaymentConnectionStatus,
      accountId: row.accountId,
      accountName: row.accountName,
      accountEmail: row.accountEmail,
      accountCurrency: row.accountCurrency,
      livemode: row.livemode,
      accessToken: row.encryptedAccessToken ? decryptCredential(row.encryptedAccessToken) : null,
      refreshToken: row.encryptedRefreshToken ? decryptCredential(row.encryptedRefreshToken) : null,
      publishableKey: row.encryptedPublishableKey ? decryptCredential(row.encryptedPublishableKey) : null,
      webhookSecret: row.encryptedWebhookSecret ? decryptCredential(row.encryptedWebhookSecret) : null,
      tokenExpiresAt: row.tokenExpiresAt,
      scope: row.scope,
      metadata: row.metadata,
      isActive: row.isActive,
      connectedAt: row.connectedAt,
    };
  }

  async getActiveCheckoutConfig(storeId = "store-main") {
    await this.ensureStore(storeId);
    const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
    
    // Find all connected connections in database
    const connectedDbRows = await db.select().from(paymentProviderConnectionsTable)
      .where(and(
        eq(paymentProviderConnectionsTable.storeId, storeId),
        eq(paymentProviderConnectionsTable.status, "CONNECTED")
      ));

    const configuredKeys = (store?.activePaymentProvider || "").split(",").map(s => s.trim()).filter(Boolean);
    const candidateKeys = new Set<string>();

    // 1. Add configured active providers from store
    for (const key of configuredKeys) {
      candidateKeys.add(key);
    }

    // 2. Add all connected provider connections in database
    for (const row of connectedDbRows) {
      candidateKeys.add(row.provider);
    }

    // 3. Fallback default if none found
    if (candidateKeys.size === 0) {
      candidateKeys.add("stripe");
    }

    const activeProviders = [];

    for (const key of candidateKeys) {
      const conn = await this.getDecryptedConnection(storeId, key as PaymentProviderType);
      if (conn && conn.status === "CONNECTED" && conn.accessToken) {
        activeProviders.push({
          provider: key,
          name: this.getProvider(key as PaymentProviderType).getDisplayName(),
          publishableKey: conn.publishableKey || null,
          livemode: conn.livemode,
        });
      }
    }

    // Keep activeProvider for legacy compatibility with single-provider checkouts
    const legacyActiveProvider = (activeProviders[0]?.provider as PaymentProviderType) || (configuredKeys[0] as PaymentProviderType) || "stripe";
    const legacyConn = await this.getDecryptedConnection(storeId, legacyActiveProvider);

    return {
      activeProvider: legacyActiveProvider,
      publishableKey: legacyConn?.publishableKey || activeProviders[0]?.publishableKey || null,
      livemode: legacyConn?.livemode || activeProviders[0]?.livemode || false,
      activeProviders,
      currency: store?.currency || "USD",
    };
  }

  async initializeCheckout(params: InitializePaymentParams & { provider?: PaymentProviderType }): Promise<InitializePaymentResult> {
    const storeId = params.storeId || "store-main";
    await this.ensureStore(storeId);
    const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
    
    // Support explicitly passed provider, or fallback to first active from the list
    const activeProviderName = params.provider || (store?.activePaymentProvider || "stripe").split(",").map(s => s.trim())[0] as PaymentProviderType;
    const provider = this.getProvider(activeProviderName);

    const connection = await this.getDecryptedConnection(storeId, activeProviderName);
    if (!connection) {
      throw Object.assign(new Error(`Payment provider ${activeProviderName} is not connected or active.`), { statusCode: 503 });
    }

    // Persist pending payment transaction record
    await db.insert(paymentTransactionsTable).values({
      id: randomUUID(),
      storeId,
      sessionId: params.metadata?.sessionId as string || "session-default",
      reference: params.reference,
      provider: activeProviderName,
      status: "pending",
      amount: params.amount,
      currency: params.currency || "USD",
      email: params.customerEmail,
      callbackUrl: params.callbackUrl,
      metadata: params.metadata || {},
    });

    const result = await provider.initializePayment(storeId, connection, params);

    // Update with provider transaction ID
    if (result.providerTransactionId) {
      await db.update(paymentTransactionsTable).set({
        providerTransactionId: result.providerTransactionId,
        rawResponse: result.raw,
        updatedAt: new Date(),
      }).where(eq(paymentTransactionsTable.reference, params.reference));
    }

    await this.logAudit({
      storeId,
      action: "PAYMENT_INITIATED",
      provider: activeProviderName,
      details: { reference: params.reference, amount: params.amount, currency: params.currency },
    });

    return result;
  }

  async verifyCheckout(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    const [transaction] = await db.select().from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.reference, params.reference)).limit(1);

    if (!transaction) {
      throw Object.assign(new Error("Transaction reference not found."), { statusCode: 404 });
    }

    const storeId = transaction.storeId || params.storeId;
    if (!storeId) {
      throw Object.assign(new Error("Store ID missing for transaction verification."), { statusCode: 400 });
    }

    const providerName = transaction.provider as PaymentProviderType;
    const provider = this.getProvider(providerName);
    const connection = await this.getDecryptedConnection(storeId, providerName);

    if (!connection) {
      throw Object.assign(new Error("Provider connection missing."), { statusCode: 500 });
    }

    const verification = await provider.verifyPayment(storeId, connection, {
      ...params,
      providerTransactionId: transaction.providerTransactionId || undefined,
    });

    await db.update(paymentTransactionsTable).set({
      status: verification.success ? "paid" : "failed",
      verifiedAt: new Date(),
      rawResponse: verification.raw,
      updatedAt: new Date(),
    }).where(eq(paymentTransactionsTable.reference, params.reference));

    if (verification.success && transaction.orderId) {
      await db.update(ordersTable).set({
        paymentStatus: "PAID",
        paidAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(ordersTable.id, transaction.orderId), eq(ordersTable.storeId, storeId)));
    }

    await this.logAudit({
      storeId,
      action: "PAYMENT_VERIFIED",
      provider: providerName,
      details: { reference: params.reference, success: verification.success, amount: verification.amount },
    });

    return verification;
  }

  async processRefund(params: RefundParams): Promise<RefundResult> {
    const [transaction] = await db.select().from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.reference, params.reference)).limit(1);

    if (!transaction) {
      throw Object.assign(new Error("Transaction reference not found for refund."), { statusCode: 404 });
    }

    const storeId = transaction.storeId || params.storeId;
    if (!storeId) {
      throw Object.assign(new Error("Store ID missing for refund transaction."), { statusCode: 400 });
    }

    const providerName = transaction.provider as PaymentProviderType;
    const provider = this.getProvider(providerName);
    const connection = await this.getDecryptedConnection(storeId, providerName);

    if (!connection) throw Object.assign(new Error("Provider credentials missing."), { statusCode: 500 });

    const refund = await provider.processRefund(storeId, connection, {
      ...params,
      providerTransactionId: transaction.providerTransactionId || undefined,
    });

    await db.insert(paymentRefundsTable).values({
      id: randomUUID(),
      storeId,
      transactionId: transaction.id,
      orderId: transaction.orderId,
      providerRefundId: refund.refundId,
      amount: refund.amount,
      currency: refund.currency,
      reason: params.reason,
      status: refund.status,
      rawResponse: refund.raw,
    });

    await db.update(paymentTransactionsTable).set({
      status: "refunded",
      updatedAt: new Date(),
    }).where(eq(paymentTransactionsTable.id, transaction.id));

    if (transaction.orderId) {
      await db.update(ordersTable).set({
        paymentStatus: "REFUNDED",
        status: "REFUNDED",
        updatedAt: new Date(),
      }).where(and(eq(ordersTable.id, transaction.orderId), eq(ordersTable.storeId, storeId)));
    }

    await this.logAudit({
      storeId,
      action: "REFUND_CREATED",
      provider: providerName,
      details: { refundId: refund.refundId, amount: refund.amount, reason: params.reason },
    });

    return refund;
  }

  async handleIncomingWebhook(
    providerName: PaymentProviderType,
    rawBody: string,
    signature: string | undefined,
    headers: Record<string, string | string[] | undefined>
  ): Promise<WebhookEventResult> {
    const provider = this.getProvider(providerName);
    const eventResult = await provider.handleWebhook(rawBody, signature, headers);

    let resolvedStoreId = eventResult.storeId;
    let existingTx: any = null;

    if (eventResult.reference) {
      const [tx] = await db.select().from(paymentTransactionsTable)
        .where(eq(paymentTransactionsTable.reference, eventResult.reference))
        .limit(1);
      if (tx) {
        existingTx = tx;
        if (!resolvedStoreId) {
          resolvedStoreId = tx.storeId;
        }
      }
    }

    if (!resolvedStoreId) {
      console.warn(`[Payment] Webhook event received for provider ${providerName} without identifiable storeId or reference.`);
      return eventResult;
    }

    // Record webhook idempotently
    try {
      await db.insert(paymentWebhookEventsTable).values({
        id: randomUUID(),
        storeId: resolvedStoreId,
        provider: providerName,
        eventId: eventResult.eventId,
        eventType: eventResult.eventType,
        signature: signature || null,
        payload: eventResult.raw,
        status: "PROCESSED",
      }).onConflictDoNothing();
    } catch {
      // Non-blocking duplicate suppression
    }

    // Update transaction and order states if matching transaction exists
    if (existingTx) {
      try {
        await db.update(paymentTransactionsTable).set({
          status: eventResult.status,
          providerTransactionId: eventResult.providerTransactionId || existingTx.providerTransactionId,
          verifiedAt: eventResult.status === "paid" ? new Date() : existingTx.verifiedAt,
          updatedAt: new Date(),
        }).where(eq(paymentTransactionsTable.id, existingTx.id));

        if (existingTx.orderId) {
          if (eventResult.status === "paid") {
            await db.update(ordersTable).set({
              paymentStatus: "PAID",
              paidAt: new Date(),
              updatedAt: new Date(),
            }).where(and(eq(ordersTable.id, existingTx.orderId), eq(ordersTable.storeId, resolvedStoreId)));
          } else if (eventResult.status === "failed") {
            await db.update(ordersTable).set({
              paymentStatus: "FAILED",
              updatedAt: new Date(),
            }).where(and(eq(ordersTable.id, existingTx.orderId), eq(ordersTable.storeId, resolvedStoreId)));
          } else if (eventResult.status === "refunded") {
            await db.update(ordersTable).set({
              paymentStatus: "REFUNDED",
              status: "REFUNDED",
              updatedAt: new Date(),
            }).where(and(eq(ordersTable.id, existingTx.orderId), eq(ordersTable.storeId, resolvedStoreId)));
          }
        }
      } catch (dbErr) {
        console.error(`[Payment] Failed to update order/transaction from webhook:`, dbErr);
      }
    }

    await this.logAudit({
      storeId: resolvedStoreId,
      action: "WEBHOOK_PROCESSED",
      provider: providerName,
      details: { eventId: eventResult.eventId, eventType: eventResult.eventType, status: eventResult.status },
    });

    return eventResult;
  }
}

export const paymentService = new PaymentService();
