import { pgTable, text, timestamp, integer, boolean, jsonb, numeric, check, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Users ─────────────────────────────────────────────────────────────────────

export const usersTable = pgTable("users", {
  id:                  text("id").primaryKey(),
  name:                text("name").notNull(),
  email:               text("email").notNull().unique(),
  role:                text("role").notNull().default("CUSTOMER"),
  passwordHash:        text("password_hash").notNull().default(""),
  passwordResetToken:  text("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  createdAt:           timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  check("users_role_check", sql`${table.role} in ('CUSTOMER', 'ADMIN', 'SUPER_ADMIN')`),
]);

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const users = usersTable;

// ── Admin OTP codes ────────────────────────────────────────────────────────────

export const adminOtpCodesTable = pgTable("admin_otp_codes", {
  id:        text("id").primaryKey(),
  email:     text("email").notNull(),
  code:      text("code").notNull(), // HMAC digest; never stores the plaintext OTP
  expiresAt: timestamp("expires_at").notNull(),
  used:      boolean("used").default(false).notNull(),
  attempts:  integer("attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminOtpCodes = adminOtpCodesTable;

export const authRateLimitsTable = pgTable("auth_rate_limits", {
  key:         text("key").primaryKey(),
  windowStart: timestamp("window_start").notNull(),
  count:       integer("count").notNull().default(0),
});

// ── Sessions ──────────────────────────────────────────────────────────────────

export const sessionsTable = pgTable("sessions", {
  token:     text("token").primaryKey(),
  userId:    text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("sessions_user_id_idx").on(table.userId),
  index("sessions_expires_at_idx").on(table.expiresAt),
]);

export type Session = typeof sessionsTable.$inferSelect;

// ── Categories ────────────────────────────────────────────────────────────────

export const categoriesTable = pgTable("categories", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull(),
  slug:        text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export type Category = typeof categoriesTable.$inferSelect;

// ── Products ──────────────────────────────────────────────────────────────────

export const productsTable = pgTable("products", {
  id:            text("id").primaryKey(),
  name:          text("name").notNull(),
  price:         integer("price").notNull().default(0),
  categoryId:    text("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  stock:         integer("stock").notNull().default(0),
  trackQuantity: boolean("track_quantity").notNull().default(true),
  status:        text("status").notNull().default("ACTIVE"),
  imageUrl:      text("image_url"),
  description:   text("description").notNull().default(""),
  tags:          text("tags"),
  metaSyncEnabled: boolean("meta_sync_enabled").notNull().default(true),
  eproloProductId: text("eprolo_product_id"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  check("products_status_check", sql`${table.status} in ('ACTIVE', 'DRAFT', 'ARCHIVED')`),
]);

export type Product = typeof productsTable.$inferSelect;

// ── Orders ────────────────────────────────────────────────────────────────────

export type AddressSnapshot = Record<string, string>;
export type OrderItem = {
  productId: string;
  variantId?: string;
  sku?: string;
  name: string;
  qty: number;
  price: number;
  eproloVariantId?: string;
};

export const ordersTable = pgTable("orders", {
  id:            text("id").primaryKey(),
  customerId:    text("customer_id").references(() => usersTable.id, { onDelete: "set null" }),
  customerEmail: text("customer_email").notNull(),
  customerName:  text("customer_name").notNull(),
  status:        text("status").notNull().default("PENDING"),
  paymentStatus: text("payment_status").notNull().default("PENDING"),
  paymentProvider: text("payment_provider"),
  paymentReference: text("payment_reference"),
  paidAt:        timestamp("paid_at"),
  total:         numeric("total", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  items:         jsonb("items").notNull().$type<OrderItem[]>().default([]),
  shippingAddress: jsonb("shipping_address").$type<AddressSnapshot>(),
  billingAddress:  jsonb("billing_address").$type<AddressSnapshot>(),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  check("orders_status_check", sql`${table.status} in ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED')`),
  check("orders_payment_status_check", sql`${table.paymentStatus} in ('PENDING', 'PAID', 'FAILED', 'REFUNDED')`),
  uniqueIndex("orders_payment_reference_idx").on(table.paymentReference),
  index("orders_customer_email_idx").on(table.customerEmail),
  index("orders_status_created_at_idx").on(table.status, table.createdAt),
]);

export type Order = typeof ordersTable.$inferSelect;

// ── Push Tokens ───────────────────────────────────────────────────────────────

export const userPushTokensTable = pgTable("user_push_tokens", {
  userId:    text("user_id").primaryKey(),
  token:     text("token").notNull(),
  platform:  text("platform").notNull().default("unknown"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserPushTokenSchema = createInsertSchema(userPushTokensTable).omit({ updatedAt: true });
export type InsertUserPushToken = z.infer<typeof insertUserPushTokenSchema>;
export type UserPushToken = typeof userPushTokensTable.$inferSelect;

// ── Channel Credentials ───────────────────────────────────────────────────────

export const channelCredentialsTable = pgTable("channel_credentials", {
  channel:   text("channel").primaryKey(),
  data:      jsonb("data").notNull().$type<Record<string, string>>().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ChannelCredential = typeof channelCredentialsTable.$inferSelect;

// ── Persistent storefront/admin content ───────────────────────────────────────

export const productVariantsTable = pgTable("product_variants", {
  id:        text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  size:      text("size").notNull().default(""),
  color:     text("color").notNull().default(""),
  stock:     integer("stock").notNull().default(0),
  price:     integer("price"),
  sku:       text("sku").notNull().default(""),
  eproloProductId: text("eprolo_product_id"),
  eproloVariantId: text("eprolo_variant_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("product_variants_product_id_idx").on(table.productId),
  index("product_variants_sku_idx").on(table.sku),
]);

export const reviewsTable = pgTable("reviews", {
  id:         text("id").primaryKey(),
  productId:  text("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  userId:     text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  rating:     integer("rating").notNull(),
  comment:    text("comment").notNull(),
  authorName: text("author_name").notNull(),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("reviews_product_created_at_idx").on(table.productId, table.createdAt),
]);

export const mediaItemsTable = pgTable("media_items", {
  id:        text("id").primaryKey(),
  filename:  text("filename").notNull(),
  url:       text("url").notNull(),
  mimeType:  text("mime_type").notNull(),
  size:      integer("size").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const blogPostsTable = pgTable("blog_posts", {
  id:         text("id").primaryKey(),
  title:      text("title").notNull(),
  slug:       text("slug").notNull().unique(),
  content:    text("content").notNull().default(""),
  status:     text("status").notNull().default("DRAFT"),
  authorName: text("author_name").notNull().default("Admin"),
  publishedAt: timestamp("published_at"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
  updatedAt:  timestamp("updated_at").notNull().defaultNow(),
});

export const couponsTable = pgTable("coupons", {
  id:             text("id").primaryKey(),
  code:           text("code").notNull().unique(),
  description:    text("description").notNull().default(""),
  discountType:   text("discount_type").notNull().default("PERCENTAGE"),
  discountValue:  numeric("discount_value", { precision: 12, scale: 2, mode: "number" }).notNull(),
  minOrderAmount: numeric("min_order_amount", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  maxUses:        integer("max_uses"),
  usedCount:      integer("used_count").notNull().default(0),
  active:         boolean("active").notNull().default(true),
  expiresAt:      timestamp("expires_at"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  updatedAt:      timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("coupons_active_expires_at_idx").on(table.active, table.expiresAt),
]);

export const teamMembersTable = pgTable("team_members", {
  id:             text("id").primaryKey(),
  name:           text("name").notNull().default(""),
  email:          text("email").notNull(),
  role:           text("role").notNull().default("EDITOR"),
  status:         text("status").notNull().default("Invited"),
  invitedAt:      timestamp("invited_at").notNull().defaultNow(),
  inviteToken:    text("invite_token"),
  inviteExpiresAt: timestamp("invite_expires_at"),
});

// ── Persistent channel hub state ──────────────────────────────────────────────

export const channelConfigsTable = pgTable("channel_configs", {
  id:        text("id").primaryKey(),
  channelId: text("channel_id").notNull().unique(),
  status:    text("status").notNull().default("DISCONNECTED"),
  lastSync:  timestamp("last_sync"),
  latency:   integer("latency").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  check("channel_configs_status_check", sql`${table.status} in ('CONNECTED', 'PAUSED', 'DISCONNECTED')`),
]);

export const channelEventLogsTable = pgTable("channel_event_logs", {
  id:        text("id").primaryKey(),
  channel:   text("channel").notNull(),
  event:     text("event").notNull(),
  detail:    text("detail").notNull(),
  type:      text("type").notNull().default("info"),
  adminUserId: text("admin_user_id"),
  adminEmail:  text("admin_email"),
  ip:          text("ip"),
  userAgent:   text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  check("channel_event_logs_type_check", sql`${table.type} in ('sync', 'error', 'warning', 'info')`),
  index("channel_event_logs_channel_created_at_idx").on(table.channel, table.createdAt),
]);

export const channelWebhooksTable = pgTable("channel_webhooks", {
  id:        text("id").primaryKey(),
  webhookId: text("webhook_id").notNull().unique(),
  label:     text("label").notNull(),
  url:       text("url").notNull(),
  active:    boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Persistent Facebook/Meta state ────────────────────────────────────────────

export const facebookConnectionsTable = pgTable("facebook_connections", {
  id:             text("id").primaryKey(),
  connectionKey:  text("connection_key").notNull().unique(),
  active:         boolean("active").notNull().default(false),
  updatedAt:      timestamp("updated_at").notNull().defaultNow(),
});

export const facebookCatalogSettingsTable = pgTable("facebook_catalog_settings", {
  id:                 text("id").primaryKey(),
  includedCategories: jsonb("included_categories").notNull().$type<string[]>().default([]),
  minPrice:           numeric("min_price", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  maxPrice:           numeric("max_price", { precision: 12, scale: 2, mode: "number" }).notNull().default(10000),
  updatedAt:          timestamp("updated_at").notNull().defaultNow(),
});

export const facebookPixelEventsTable = pgTable("facebook_pixel_events", {
  id:         text("id").primaryKey(),
  storeEvent: text("store_event").notNull().unique(),
  fbEvent:    text("fb_event").notNull(),
  enabled:    boolean("enabled").notNull().default(true),
  updatedAt:  timestamp("updated_at").notNull().defaultNow(),
});

export const facebookAudiencesTable = pgTable("facebook_audiences", {
  id:        text("id").primaryKey(),
  name:      text("name").notNull(),
  size:      text("size").notNull().default("Building…"),
  type:      text("type").notNull().default("Custom"),
  status:    text("status").notNull().default("Building"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const facebookPagePostsTable = pgTable("facebook_page_posts", {
  id:           text("id").primaryKey(),
  caption:      text("caption").notNull(),
  imageUrl:     text("image_url"),
  link:         text("link"),
  postType:     text("post_type").notNull().default("Standard"),
  scheduledFor: timestamp("scheduled_for"),
  status:       text("status").notNull().default("Draft"),
  likes:        integer("likes").notNull().default(0),
  comments:     integer("comments").notNull().default(0),
  shares:       integer("shares").notNull().default(0),
  reach:        integer("reach").notNull().default(0),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export const facebookPostTemplatesTable = pgTable("facebook_post_templates", {
  id:         text("id").primaryKey(),
  name:       text("name").notNull().unique(),
  body:       text("body").notNull(),
  postType:   text("post_type").notNull().default("Standard"),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

// ── Persistent newsletter state ──────────────────────────────────────────────

export const newsletterSubscribersTable = pgTable("newsletter_subscribers", {
  id:           text("id").primaryKey(),
  email:        text("email").notNull().unique(),
  name:         text("name"),
  subscribedAt: timestamp("subscribed_at").notNull().defaultNow(),
  active:       boolean("active").notNull().default(true),
});

export const newsletterCampaignsTable = pgTable("newsletter_campaigns", {
  id:              text("id").primaryKey(),
  subject:         text("subject").notNull(),
  body:            text("body").notNull(),
  recipientCount:  integer("recipient_count").notNull().default(0),
  sentCount:       integer("sent_count").notNull().default(0),
  status:          text("status").notNull().default("DRAFT"),
  sentAt:          timestamp("sent_at"),
  scheduledFor:    timestamp("scheduled_for"),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
});

// ── Persistent social content state ──────────────────────────────────────────

export const twitterHashtagsTable = pgTable("twitter_hashtags", {
  id:        text("id").primaryKey(),
  tag:       text("tag").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const twitterAutoRulesTable = pgTable("twitter_auto_rules", {
  id:        text("id").primaryKey(),
  trigger:   text("trigger").notNull(),
  action:    text("action").notNull(),
  template:  text("template").notNull().default("new_arrival"),
  active:    boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const twitterTweetQueueTable = pgTable("twitter_tweet_queue", {
  id:            text("id").primaryKey(),
  text:          text("text").notNull(),
  scheduledFor:  text("scheduled_for").notNull(),
  status:        text("status").notNull().default("Queued"),
  imageStyle:    text("image_style").notNull().default("None"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
});

export const twitterContentTemplatesTable = pgTable("twitter_content_templates", {
  id:         text("id").primaryKey(),
  name:       text("name").notNull().unique(),
  body:       text("body").notNull(),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export const twitterSchedulerSettingsTable = pgTable("twitter_scheduler_settings", {
  id:           text("id").primaryKey(),
  schedulerOn:  boolean("scheduler_on").notNull().default(false),
  dropFrequency: text("drop_frequency").notNull().default("Daily Digest (6 PM)"),
  imageStyle:   text("image_style").notNull().default("Product Photo"),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
});

export const whatsappTemplatesTable = pgTable("whatsapp_templates", {
  id:         text("id").primaryKey(),
  name:       text("name").notNull().unique(),
  category:   text("category").notNull().default("Marketing"),
  body:       text("body").notNull(),
  status:     text("status").notNull().default("Pending"),
  language:   text("language").notNull().default("en"),
  sentCount:  integer("sent_count").notNull().default(0),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export const whatsappJourneysTable = pgTable("whatsapp_journeys", {
  id:          text("id").primaryKey(),
  journeyId:   text("journey_id").notNull().unique(),
  icon:        text("icon").notNull().default("route"),
  title:       text("title").notNull(),
  description: text("description").notNull(),
  active:      boolean("active").notNull().default(false),
  sentCount:   text("sent_count").notNull().default("0"),
  steps:       integer("steps").notNull().default(1),
  convRate:    text("conv_rate").notNull().default("—"),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

export const whatsappOptinSettingsTable = pgTable("whatsapp_optin_settings", {
  id:            text("id").primaryKey(),
  optinKeyword:  text("optin_keyword").notNull().default("JOIN"),
  optoutKeyword: text("optout_keyword").notNull().default("STOP"),
  doubleOptin:   boolean("double_optin").notNull().default(true),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});

// ── Persistent settings, providers, and API keys ──────────────────────────────

export const appSettingsTable = pgTable("app_settings", {
  key:       text("key").primaryKey(),
  value:     text("value").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const apiKeysTable = pgTable("api_keys", {
  id:         text("id").primaryKey(),
  name:       text("name").notNull(),
  keyPrefix:  text("key_prefix").notNull(),
  keyHash:    text("key_hash").notNull(),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
  lastUsed:   timestamp("last_used"),
  revokedAt:  timestamp("revoked_at"),
  usageCount: integer("usage_count").notNull().default(0),
});

export const providerPluginsTable = pgTable("provider_plugins", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull().unique(),
  label:       text("label").notNull(),
  description:  text("description").notNull().default(""),
  mode:         text("mode").notNull().default("live"),
  enabled:      boolean("enabled").notNull().default(false),
  connected:    boolean("connected").notNull().default(false),
  apiKey:       text("api_key"),
  apiSecret:    text("api_secret"),
  webhookUrl:   text("webhook_url"),
  lastSyncAt:   timestamp("last_sync_at"),
  lastError:    text("last_error"),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
  logoUrl:      text("logo_url"),
  storeId:      text("store_id"),
});

export const storeCartItemsTable = pgTable("store_cart_items", {
  id:        text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  productId: text("product_id").notNull(),
  quantity:  integer("quantity").notNull().default(1),
  product:   jsonb("product").notNull().$type<Record<string, unknown>>(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("store_cart_items_session_product_idx").on(table.sessionId, table.productId),
]);

export const storeWishlistItemsTable = pgTable("store_wishlist_items", {
  id:        text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  productId: text("product_id").notNull(),
  product:   jsonb("product").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const storesTable = pgTable("stores", {
  id:                    text("id").primaryKey(),
  name:                  text("name").notNull().default("Luxe Boutique Ateliers"),
  ownerId:               text("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  currency:              text("currency").notNull().default("USD"),
  activePaymentProvider: text("active_payment_provider").notNull().default("stripe"),
  createdAt:             timestamp("created_at").notNull().defaultNow(),
  updatedAt:             timestamp("updated_at").notNull().defaultNow(),
});

export const stores = storesTable;
export type Store = typeof storesTable.$inferSelect;

export const paymentProviderConnectionsTable = pgTable("payment_provider_connections", {
  id:                     text("id").primaryKey(),
  storeId:                text("store_id").notNull().default("store-main"),
  provider:               text("provider").notNull(), // "stripe" | "paystack" | "flutterwave"
  status:                 text("status").notNull().default("NOT_CONNECTED"), // NOT_CONNECTED | CONNECTING | CONNECTED | FAILED | EXPIRED | REAUTHORIZATION_REQUIRED | DISCONNECTED
  accountId:              text("account_id"),
  accountName:            text("account_name"),
  accountEmail:           text("account_email"),
  accountCurrency:        text("account_currency").default("USD"),
  livemode:               boolean("livemode").notNull().default(false),
  encryptedAccessToken:   text("encrypted_access_token"),
  encryptedRefreshToken:  text("encrypted_refresh_token"),
  encryptedPublishableKey: text("encrypted_publishable_key"),
  encryptedWebhookSecret: text("encrypted_webhook_secret"),
  tokenExpiresAt:         timestamp("token_expires_at"),
  scope:                  text("scope"),
  metadata:               jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  isActive:               boolean("is_active").notNull().default(false),
  lastSyncedAt:           timestamp("last_synced_at"),
  connectedAt:            timestamp("connected_at"),
  createdAt:              timestamp("created_at").notNull().defaultNow(),
  updatedAt:              timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("payment_conn_store_id_idx").on(table.storeId),
  index("payment_conn_store_provider_idx").on(table.storeId, table.provider),
  uniqueIndex("payment_conn_store_provider_account_idx").on(table.storeId, table.provider, table.accountId),
]);

export const paymentProviderConnections = paymentProviderConnectionsTable;
export type PaymentProviderConnection = typeof paymentProviderConnectionsTable.$inferSelect;

export const paymentOAuthStatesTable = pgTable("payment_oauth_states", {
  id:           text("id").primaryKey(),
  storeId:      text("store_id").notNull().default("store-main"),
  provider:     text("provider").notNull(),
  state:        text("state").notNull().unique(),
  codeVerifier: text("code_verifier"),
  returnUrl:    text("return_url"),
  expiresAt:    timestamp("expires_at").notNull(),
  usedAt:       timestamp("used_at"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("payment_oauth_state_idx").on(table.state),
  index("payment_oauth_store_provider_idx").on(table.storeId, table.provider),
]);

export const paymentOAuthStates = paymentOAuthStatesTable;
export type PaymentOAuthState = typeof paymentOAuthStatesTable.$inferSelect;

export const paymentTransactionsTable = pgTable("payment_transactions", {
  id:                    text("id").primaryKey(),
  storeId:               text("store_id").notNull().default("store-main"),
  orderId:               text("order_id").references(() => ordersTable.id, { onDelete: "set null" }),
  sessionId:             text("session_id").notNull(),
  reference:             text("reference").notNull().unique(),
  provider:              text("provider").notNull(),
  providerTransactionId: text("provider_transaction_id"),
  providerReference:     text("provider_reference"),
  status:                text("status").notNull().default("pending"), // pending | processing | paid | failed | refunded | partially_refunded
  amount:                integer("amount").notNull(),
  currency:              text("currency").notNull().default("USD"),
  email:                 text("email").notNull(),
  callbackUrl:           text("callback_url"),
  metadata:              jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  rawResponse:           jsonb("raw_response").$type<Record<string, unknown>>(),
  errorMessage:          text("error_message"),
  createdAt:             timestamp("created_at").notNull().defaultNow(),
  verifiedAt:            timestamp("verified_at"),
  updatedAt:             timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("payment_tx_store_id_idx").on(table.storeId),
  index("payment_tx_reference_idx").on(table.reference),
  index("payment_tx_order_id_idx").on(table.orderId),
]);

export const paymentRefundsTable = pgTable("payment_refunds", {
  id:               text("id").primaryKey(),
  storeId:          text("store_id").notNull().default("store-main"),
  transactionId:    text("transaction_id").notNull(),
  orderId:          text("order_id").references(() => ordersTable.id, { onDelete: "set null" }),
  providerRefundId: text("provider_refund_id"),
  amount:           integer("amount").notNull(),
  currency:         text("currency").notNull().default("USD"),
  reason:           text("reason"),
  status:           text("status").notNull().default("PENDING"), // PENDING | SUCCEEDED | FAILED
  rawResponse:      jsonb("raw_response").$type<Record<string, unknown>>(),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("payment_refunds_store_id_idx").on(table.storeId),
  index("payment_refunds_tx_id_idx").on(table.transactionId),
]);

export const paymentRefunds = paymentRefundsTable;
export type PaymentRefund = typeof paymentRefundsTable.$inferSelect;

export const paymentWebhookEventsTable = pgTable("payment_webhook_events", {
  id:        text("id").primaryKey(),
  storeId:   text("store_id"),
  provider:  text("provider").notNull(),
  eventId:   text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  signature: text("signature"),
  payload:   jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status:    text("status").notNull().default("PROCESSED"), // RECEIVED | PROCESSED | IGNORED | FAILED
  error:     text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("payment_webhook_provider_event_idx").on(table.provider, table.eventId),
]);

export const paymentWebhookEvents = paymentWebhookEventsTable;
export type PaymentWebhookEvent = typeof paymentWebhookEventsTable.$inferSelect;

export const paymentAuditLogsTable = pgTable("payment_audit_logs", {
  id:        text("id").primaryKey(),
  storeId:   text("store_id").notNull().default("store-main"),
  userId:    text("user_id"),
  action:    text("action").notNull(), // CONNECT_INITIATED | CONNECTED | DISCONNECTED | RECONNECTED | SET_ACTIVE | TOKEN_REFRESHED | PAYMENT_INITIATED | PAYMENT_VERIFIED | REFUND_CREATED | WEBHOOK_PROCESSED
  provider:  text("provider").notNull(),
  details:   jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("payment_audit_store_idx").on(table.storeId),
  index("payment_audit_action_idx").on(table.action),
]);

export const paymentAuditLogs = paymentAuditLogsTable;
export type PaymentAuditLog = typeof paymentAuditLogsTable.$inferSelect;

export const orderItemsTable = pgTable("order_items", {
  id:              text("id").primaryKey(),
  orderId:         text("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  productId:       text("product_id").notNull().references(() => productsTable.id, { onDelete: "restrict" }),
  variantId:       text("variant_id"),
  sku:             text("sku").notNull().default(""),
  productName:     text("product_name").notNull(),
  unitPrice:       integer("unit_price").notNull(),
  quantity:        integer("quantity").notNull(),
  total:           integer("total").notNull(),
  eproloVariantId: text("eprolo_variant_id"),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("order_items_order_id_idx").on(table.orderId),
  index("order_items_product_id_idx").on(table.productId),
]);

// ── Omnichannel CRM Messages ──────────────────────────────────────────────────

export const messagesTable = pgTable("messages", {
  id:           text("id").primaryKey(),
  threadId:     text("thread_id").notNull(),
  sender:       text("sender").notNull(), // "customer" | "admin" | "system"
  text:         text("text").notNull(),
  timestamp:    timestamp("timestamp").notNull().defaultNow(),
  status:       text("status").notNull().default("sent"), // "sent" | "delivered" | "read"
  type:         text("type").notNull().default("message"), // "message" | "comment" | "note"
  customerName: text("customer_name").notNull(),
  email:        text("email").notNull().default(""),
  phone:        text("phone").notNull().default(""),
  channel:      text("channel").notNull(), // "whatsapp" | "facebook" | "instagram"
  channelType:  text("channel_type").notNull().default("chat"), // "chat" | "comment"
  recipientId:  text("recipient_id"),
  postImage:    text("post_image"),
  postCaption:  text("post_caption"),
}, (table) => [
  index("messages_thread_id_idx").on(table.threadId),
  index("messages_channel_idx").on(table.channel),
  index("messages_timestamp_idx").on(table.timestamp),
]);

export type Message = typeof messagesTable.$inferSelect;
export const messages = messagesTable;


// ── Showroom Locations ────────────────────────────────────────────────────────

export const showroomLocationsTable = pgTable("showroom_locations", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull(),
  address:     text("address").notNull(),
  city:        text("city").notNull(),
  country:     text("country").notNull(),
  phone:       text("phone").notNull().default(""),
  email:       text("email").notNull().default(""),
  hours:       text("hours").notNull().default(""),
  imageUrl:    text("image_url").notNull().default(""),
  active:      boolean("active").notNull().default(true),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

export const insertShowroomLocationSchema = createInsertSchema(showroomLocationsTable).omit({ createdAt: true, updatedAt: true });
export type InsertShowroomLocation = z.infer<typeof insertShowroomLocationSchema>;
export type ShowroomLocation = typeof showroomLocationsTable.$inferSelect;
export const showroomLocations = showroomLocationsTable;


