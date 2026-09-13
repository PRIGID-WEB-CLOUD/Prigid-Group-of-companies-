# PRIGID COMMERCE GROUP — MULTI-TENANT HEADLESS COMMERCE SAAS ARCHITECTURE

**Document Version:** 1.0.0  
**Status:** Architecture Design Document (ADD) & Implementation Blueprint  
**Target Platform:** Node.js (TypeScript) / Express / Drizzle ORM / PostgreSQL / React / React Native (Expo)

---

## 1. Executive Summary & Business Model

The objective of this architecture is to decouple the **Prigid Commerce Core Backend** into a high-performance, managed **Commerce-as-a-Service (CaaS) Multi-Tenant API**, allowing Prigid Commerce Group to:

1. **Host a Single Managed Server Engine**: You maintain one scalable, centralized backend cluster (`api.prigidcommerce.com`).
2. **Offer Decoupled Client Frontends**: Sell branded web storefronts (Vite/React/Next.js), merchant administration portals, and native iOS/Android apps (React Native/Expo) to clients.
3. **Provision Tenant Endpoints & API Keys**: Merchants configure their frontend by providing their unique `Store ID` / `Publishable Key` and pointing to your API endpoint.
4. **Monetize via Tiered Subscriptions & Take Rates**: Charge recurring monthly/yearly platform access fees plus micro-percentages on processed transactions.

---

## 2. High-Level System Architecture

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │                  CLIENT APPLICATIONS                   │
                                  ├───────────────────────┬────────────────────────────────┤
                                  │   Merchant A Web      │  Merchant B Mobile             │
                                  │   (React / Tailwind)  │  (Expo / React Native)         │
                                  │   Header: X-Store-Id  │  Header: X-Store-Id            │
                                  └───────────┬───────────┴────────────────┬───────────────┘
                                              │                            │
                                              ▼                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                             EDGE / REVERSE PROXY & API GATEWAY                            │
│                             (api.prigidcommerce.com / Cloud Run)                         │
└─────────────────────────────────────────────┬────────────────────────────────────────────┘
                                              │
                                              ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                CENTRAL EXPRESS API SERVER                                │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Tenant Scoping Middleware (tenantContext.ts)                                     │  │
│  │    • Resolves store by Header (`X-Store-Id`), Publishable Key, or Subdomain        │  │
│  │    • Validates store status (active, suspended, trialing)                          │  │
│  │    • Attaches `req.store` & `req.storeId` to execution context                     │  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
│                                              │                                           │
│  ┌───────────────────────────────────────────┴────────────────────────────────────────┐  │
│  │ 2. Security, Rate Limiting & Admin Authentication                                   │  │
│  │    • Super-Admin Guard: System-wide control (Prigid master staff)                   │  │
│  │    • Merchant-Admin Guard: Store-scoped RBAC (Owner, Manager, Staff)               │  │
│  │    • Customer JWT: Scoped to specific store (`store_id` + `customer_id`)           │  │
│  └───────────────────────────────────────────┬────────────────────────────────────────┘  │
│                                              │                                           │
│  ┌───────────────────────────────────────────┴────────────────────────────────────────┐  │
│  │ 3. Multi-Tenant Service Engine & Dynamic Vault                                     │  │
│  │    • Dynamic AES-256-GCM Credential Vault (Per-store Stripe, Paystack, WhatsApp)   │  │
│  │    • Tenant-scoped event bus, webhooks, analytics, and stock monitors              │  │
│  └───────────────────────────────────────────┬────────────────────────────────────────┘  │
└──────────────────────────────────────────────┼───────────────────────────────────────────┘
                                               │
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                               SHARED POSTGRESQL DATABASE                                 │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Multi-Tenant Shared Schema with Row-Level Isolation (`store_id` on every table)   │  │
│  │  • stores / tenants (Master Registry)                                              │  │
│  │  • products (where store_id = req.storeId)                                         │  │
│  │  • orders (where store_id = req.storeId)                                           │  │
│  │  • users / customers (where store_id = req.storeId)                                │  │
│  │  • store_credentials (AES-256 encrypted keys per store_id)                         │  │
│  │  • categories, coupons, media, channels, blogs (all scoped to store_id)            │  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema & Multi-Tenancy Strategy

### 3.1 Tenant Isolation Model: Shared Database, Shared Schema with Discriminator Column (`store_id`)
* **Why this model?**
  * Extreme resource efficiency: Hundreds of merchants share connection pooling and cache.
  * Instant schema updates: Migrations run once across all stores without complex multi-database orchestration.
  * Lower hosting overhead: Run high-availability PostgreSQL (Neon, Supabase, Cloud SQL) with automatic scaling.

### 3.2 Core Table Specifications

#### A. Master Stores Registry (`stores`)
```sql
CREATE TABLE stores (
    id VARCHAR(64) PRIMARY KEY,                   -- e.g. "store_luxe_01", "store_urban_threads"
    slug VARCHAR(64) UNIQUE NOT NULL,             -- e.g. "luxe-boutique"
    name VARCHAR(255) NOT NULL,
    custom_domain VARCHAR(255) UNIQUE,            -- e.g. "shop.clientdomain.com"
    plan_tier VARCHAR(32) NOT NULL DEFAULT 'starter', -- starter | growth | enterprise
    status VARCHAR(32) NOT NULL DEFAULT 'active', -- active | suspended | past_due
    
    -- API Access Keys
    publishable_key VARCHAR(128) UNIQUE NOT NULL, -- pk_live_... (Used by public storefronts)
    secret_key_hash VARCHAR(255) NOT NULL,        -- sk_live_... (For private backend server calls)
    
    -- Branding & Config defaults
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    support_email VARCHAR(255),
    timezone VARCHAR(64) DEFAULT 'UTC',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stores_slug ON stores(slug);
CREATE INDEX idx_stores_publishable_key ON stores(publishable_key);
CREATE INDEX idx_stores_custom_domain ON stores(custom_domain);
```

#### B. Store-Scoped Entity Tables (Example: Products, Orders, Users)
All child tables include `store_id` foreign key referencing `stores(id)`:

```sql
-- Products Table
ALTER TABLE products ADD COLUMN store_id VARCHAR(64) NOT NULL REFERENCES stores(id) ON DELETE CASCADE;
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_store_category ON products(store_id, category);

-- Orders Table
ALTER TABLE orders ADD COLUMN store_id VARCHAR(64) NOT NULL REFERENCES stores(id) ON DELETE CASCADE;
CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_orders_store_status ON orders(store_id, status);

-- Customers / Users Table
ALTER TABLE users ADD COLUMN store_id VARCHAR(64) REFERENCES stores(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX idx_users_store_email ON users(store_id, email);

-- Tenant-Specific Credentials (Encrypted via Master AES-256 Key)
CREATE TABLE store_credentials (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    channel_key VARCHAR(64) NOT NULL,            -- 'stripe', 'paystack', 'whatsapp', 'eprolo', 'smtp'
    encrypted_payload TEXT NOT NULL,             -- AES-256-GCM encrypted JSON
    iv VARCHAR(64) NOT NULL,
    auth_tag VARCHAR(64) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_store_channel UNIQUE (store_id, channel_key)
);
```

---

## 4. Tenant Context Resolution Middleware

Every incoming request to the API is identified and scoped before reaching any route handler.

### Resolution Precedence:
1. **Header `X-Store-Id`** (e.g., `X-Store-Id: store_abc123`)
2. **Header `X-Publishable-Key`** or `Authorization: Bearer pk_live_...`
3. **Subdomain / Host Header** (e.g., `brand-name.prigidcommerce.com` or custom domain `shop.brand.com`)

### Implementation Flow:
```typescript
// artifacts/api-server/src/middleware/tenantContext.ts
export interface TenantRequest extends express.Request {
  storeId?: string;
  store?: StoreRecord;
  isSuperAdmin?: boolean;
}

export async function tenantResolver(req: TenantRequest, res: express.Response, next: express.NextFunction) {
  // 1. Check if this is a platform super-admin route
  if (req.path.startsWith("/api/platform-admin")) {
    return next();
  }

  // 2. Extract tenant identifier
  const storeIdHeader = req.headers["x-store-id"] as string;
  const pubKeyHeader = req.headers["x-publishable-key"] as string;
  const host = req.hostname;

  let store: StoreRecord | null = null;

  if (storeIdHeader) {
    store = await getCachedStoreById(storeIdHeader);
  } else if (pubKeyHeader) {
    store = await getCachedStoreByPubKey(pubKeyHeader);
  } else if (host) {
    store = await getCachedStoreByDomain(host);
  }

  if (!store) {
    return res.status(400).json({
      error: "Missing or invalid tenant identifier. Please supply 'X-Store-Id' or 'X-Publishable-Key'.",
    });
  }

  if (store.status === "suspended") {
    return res.status(403).json({ error: "This store has been suspended. Please contact support." });
  }

  req.storeId = store.id;
  req.store = store;
  next();
}
```

---

## 5. Per-Tenant Credential Vault & Isolated Integrations

Each merchant uses their own payment accounts (Stripe, Paystack, Flutterwave, PayPal), WhatsApp Business accounts, shipping carriers (DHL), and SMTP mailers.

```typescript
// artifacts/api-server/src/services/tenantVault.ts
export async function getTenantCredentials(storeId: string, channel: string): Promise<Record<string, string>> {
  const [record] = await db.select()
    .from(storeCredentialsTable)
    .where(and(
      eq(storeCredentialsTable.storeId, storeId),
      eq(storeCredentialsTable.channelKey, channel)
    ))
    .limit(1);

  if (!record) return {};
  return decryptPayload(record.encryptedPayload, record.iv, record.authTag);
}
```

* When Customer A checks out on **Store 1**, payment funds flow straight into **Store 1's Stripe/Paystack Account**.
* When Customer B checks out on **Store 2**, payment funds flow into **Store 2's Account**.
* Prigid API Server can optionally calculate and deduct a platform application fee (e.g. Stripe Application Fee or Paystack Subaccount Split).

---

## 6. Frontend Packaging & Client Distribution

You can package and deliver frontends to clients in two clean formats:

### Model 1: Fully Managed Frontend (Hosted by You on Custom Subdomains/Domains)
* You deploy the Storefront & Admin to Vercel/Cloudflare/AWS.
* Merchant configures their DNS: `shop.merchant.com` -> CNAME -> `prigidcommerce.com`.
* Edge router automatically resolves the tenant based on the incoming domain name.

### Model 2: Sold / Distributed Frontend (Delivered to Client / Merchant Developer)
* You provide the merchant with the pre-built React/Next.js or React Native bundle.
* The merchant only configures a `.env` file in their frontend:
  ```env
  VITE_API_URL=https://api.prigidcommerce.com/api
  VITE_STORE_ID=store_emerald_fashion_8921
  VITE_STORE_PUBLIC_KEY=pk_live_891238912389123
  ```
* The storefront automatically injects `X-Store-Id: store_emerald_fashion_8921` on all API requests.

---

## 7. Super-Admin Master Platform Dashboard

You will have a private master portal (`/platform-admin`) accessible only by your organization:

1. **Merchant Directory & Provisioning**:
   * Create new stores, generate API keys, set billing plans.
   * View live health, total API request volume, and GMV (Gross Merchandise Value).
2. **Subscription & Billing Engine**:
   * Integrate Stripe Billing / Paystack Subscriptions for automatic monthly merchant invoicing.
   * Automatic account freeze/suspension for delinquent accounts.
3. **Global Analytics**:
   * Aggregate revenue across all client stores, order volumes, active mobile users.
4. **Maintenance & Feature Flags**:
   * Toggle new beta gateways, dropshipping suppliers, or AI features across all stores or per-tier.

---

## 8. Tiered Monetization Matrix

| Feature / Limit | Starter Tier ($29/mo) | Growth Tier ($79/mo) | Scale / Enterprise ($199/mo) |
| :--- | :--- | :--- | :--- |
| **Product Limit** | 150 Products | 2,500 Products | Unlimited |
| **Monthly Orders** | Up to 500 orders | 5,000 orders | Unlimited |
| **Staff Accounts** | 2 Staff | 10 Staff | Unlimited (Role-based) |
| **Gateways** | Stripe, Paystack, Flutterwave | All + PayPal + COD | All + Custom Webhooks |
| **Social Commerce** | Manual link-outs | WhatsApp Cloud API + Meta Catalog | WhatsApp + Meta + TikTok + Pinterest + X |
| **Fulfillment** | Manual + Local Pickup | Eprolo + Printful + DHL | All 3PLs + Custom Carrier API |
| **Mobile App** | Web App (PWA) | PWA + Android APK | Full iOS App Store + Google Play Store Build |
| **Platform Fee** | 1.0% per transaction | 0.5% per transaction | 0.0% (Zero platform fee) |

---

## 9. Security, Compliance & Rate Limiting

1. **Strict Data Scoping**: All database queries must enforce `where(eq(table.storeId, req.storeId))`. No query can omit the tenant identifier.
2. **Per-Tenant Rate Limiting**:
   * Prevent noisy neighbor problems: Limit API calls per `store_id` (e.g., Starter: 120 req/min, Scale: 1,200 req/min) using Redis or in-memory token bucket.
3. **Customer Isolation**: Customer authentication tokens encode `{ sub: customerId, storeId: "store_123" }`. A token issued for Store A is rejected when queried against Store B.
4. **Isolated Media Storage**: Cloudinary / S3 uploads are partitioned into `/tenants/{store_id}/products/...`.

---

## 10. Phased Implementation Roadmap

* **Phase 1 (Database & Middleware)**:
  * Add `stores` table to Drizzle schema.
  * Add `store_id` column to all existing entity tables.
  * Create `tenantContext.ts` middleware and apply to `/api/*` router.
* **Phase 2 (Tenant Credential Vault)**:
  * Update `credentialVault.ts` to query and save credentials per `store_id`.
* **Phase 3 (Storefront & Admin Adaptation)**:
  * Update frontend API client to read `VITE_STORE_ID` or hostname and pass `X-Store-Id` in headers.
* **Phase 4 (Super-Admin Control Plane)**:
  * Implement `/api/platform-admin/stores` CRUD and master dashboard view.
* **Phase 5 (Billing & Automated Onboarding)**:
  * Add self-serve merchant signup, automatic API key generation, and Stripe/Paystack billing subscription webhooks.
