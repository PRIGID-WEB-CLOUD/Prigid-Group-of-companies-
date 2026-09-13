CREATE TABLE "admin_otp_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"raw_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used" timestamp,
	"revoked_at" timestamp,
	"usage_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"author_name" text DEFAULT 'Admin' NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "channel_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"status" text DEFAULT 'DISCONNECTED' NOT NULL,
	"last_sync" timestamp,
	"latency" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "channel_configs_channel_id_unique" UNIQUE("channel_id"),
	CONSTRAINT "channel_configs_status_check" CHECK ("channel_configs"."status" in ('CONNECTED', 'PAUSED', 'DISCONNECTED'))
);
--> statement-breakpoint
CREATE TABLE "channel_credentials" (
	"channel" text PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_event_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"event" text NOT NULL,
	"detail" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"admin_user_id" text,
	"admin_email" text,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "channel_event_logs_type_check" CHECK ("channel_event_logs"."type" in ('sync', 'error', 'warning', 'info'))
);
--> statement-breakpoint
CREATE TABLE "channel_webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "channel_webhooks_webhook_id_unique" UNIQUE("webhook_id")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"discount_type" text DEFAULT 'PERCENTAGE' NOT NULL,
	"discount_value" real NOT NULL,
	"min_order_amount" real DEFAULT 0 NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "facebook_audiences" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"size" text DEFAULT 'Building…' NOT NULL,
	"type" text DEFAULT 'Custom' NOT NULL,
	"status" text DEFAULT 'Building' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facebook_catalog_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"included_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"min_price" real DEFAULT 0 NOT NULL,
	"max_price" real DEFAULT 10000 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facebook_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_key" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "facebook_connections_connection_key_unique" UNIQUE("connection_key")
);
--> statement-breakpoint
CREATE TABLE "facebook_page_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"caption" text NOT NULL,
	"image_url" text,
	"link" text,
	"post_type" text DEFAULT 'Standard' NOT NULL,
	"scheduled_for" timestamp,
	"status" text DEFAULT 'Draft' NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facebook_pixel_events" (
	"id" text PRIMARY KEY NOT NULL,
	"store_event" text NOT NULL,
	"fb_event" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "facebook_pixel_events_store_event_unique" UNIQUE("store_event")
);
--> statement-breakpoint
CREATE TABLE "facebook_post_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"post_type" text DEFAULT 'Standard' NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "facebook_post_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"url" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"sent_at" timestamp,
	"scheduled_for" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"subscribed_at" timestamp DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text,
	"customer_email" text NOT NULL,
	"customer_name" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"total" real DEFAULT 0 NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_status_check" CHECK ("orders"."status" in ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'))
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"reference" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount" integer NOT NULL,
	"provider" text NOT NULL,
	"email" text NOT NULL,
	"callback_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"verified_at" timestamp,
	CONSTRAINT "payment_transactions_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"size" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '' NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"price" integer,
	"sku" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"category_id" text,
	"stock" integer DEFAULT 0 NOT NULL,
	"track_quantity" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"image_url" text,
	"description" text DEFAULT '' NOT NULL,
	"tags" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_status_check" CHECK ("products"."status" in ('ACTIVE', 'DRAFT', 'ARCHIVED'))
);
--> statement-breakpoint
CREATE TABLE "provider_plugins" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"mode" text DEFAULT 'live' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"connected" boolean DEFAULT false NOT NULL,
	"api_key" text,
	"api_secret" text,
	"webhook_url" text,
	"last_sync_at" timestamp,
	"last_error" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"logo_url" text,
	"store_id" text,
	CONSTRAINT "provider_plugins_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text NOT NULL,
	"author_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_cart_items" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"product" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_wishlist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'EDITOR' NOT NULL,
	"status" text DEFAULT 'Invited' NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"invite_token" text,
	"invite_expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "twitter_auto_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"trigger" text NOT NULL,
	"action" text NOT NULL,
	"template" text DEFAULT 'new_arrival' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "twitter_content_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "twitter_content_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "twitter_hashtags" (
	"id" text PRIMARY KEY NOT NULL,
	"tag" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "twitter_hashtags_tag_unique" UNIQUE("tag")
);
--> statement-breakpoint
CREATE TABLE "twitter_scheduler_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"scheduler_on" boolean DEFAULT false NOT NULL,
	"drop_frequency" text DEFAULT 'Daily Digest (6 PM)' NOT NULL,
	"image_style" text DEFAULT 'Product Photo' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "twitter_tweet_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"scheduled_for" text NOT NULL,
	"status" text DEFAULT 'Queued' NOT NULL,
	"image_style" text DEFAULT 'None' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_push_tokens" (
	"user_id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"platform" text DEFAULT 'unknown' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'CUSTOMER' NOT NULL,
	"password_hash" text DEFAULT '' NOT NULL,
	"password_reset_token" text,
	"password_reset_expiry" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('CUSTOMER', 'ADMIN', 'SUPER_ADMIN'))
);
--> statement-breakpoint
CREATE TABLE "whatsapp_journeys" (
	"id" text PRIMARY KEY NOT NULL,
	"journey_id" text NOT NULL,
	"icon" text DEFAULT 'route' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"sent_count" text DEFAULT '0' NOT NULL,
	"steps" integer DEFAULT 1 NOT NULL,
	"conv_rate" text DEFAULT '—' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_journeys_journey_id_unique" UNIQUE("journey_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_optin_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"optin_keyword" text DEFAULT 'JOIN' NOT NULL,
	"optout_keyword" text DEFAULT 'STOP' NOT NULL,
	"double_optin" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'Marketing' NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;