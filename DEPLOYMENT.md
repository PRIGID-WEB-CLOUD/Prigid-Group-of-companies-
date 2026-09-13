# Luxe Boutique — Client Production Deployment & Operations Guide

Welcome to the definitive deployment, credentials, and operational manual for **Luxe Boutique** — a modern, single-storefront luxury retail e-commerce platform engineered by Prigid.

This guide provides an exhaustive inventory of all environment variables, developer credentials, OAuth callback URLs, webhook endpoints, and hosting guides (Railway, Render, Linux VPS + PM2 + Nginx, Google Cloud Run, and Docker).

---

## 📑 Table of Contents

1. [Architecture & Package Artifacts](#1-architecture--package-artifacts)
2. [Prerequisites & System Requirements](#2-prerequisites--system-requirements)
3. [Master Credentials & Environment Variables Catalog](#3-master-credentials--environment-variables-catalog)
   - [A. Core Server & Database Infrastructure](#a-core-server--database-infrastructure)
   - [B. Security & Cryptographic Master Secrets](#b-security--cryptographic-master-secrets)
   - [C. Customer & Staff Authentication (Google OAuth)](#c-customer--staff-authentication-google-oauth)
   - [D. Payment Processing Gateways (Paystack, Flutterwave, Stripe, PayPal)](#d-payment-processing-gateways)
   - [E. Geolocation & Address Autocomplete (Google Maps Platform)](#e-geolocation--address-autocomplete-google-maps)
   - [F. Social Commerce & Channels (Meta Suite & Twitter / X)](#f-social-commerce--channels)
   - [G. Transactional Email & Messaging (SMTP)](#g-transactional-email--messaging-smtp)
   - [H. Media Storage & CDN (Cloudinary vs. Local Disk)](#h-media-storage--cdn-cloudinary)
   - [I. Logistics, Dropshipping & Fulfillment Providers](#i-logistics-dropshipping--fulfillment-providers)
   - [J. Customer Mobile Application (Expo / React Native)](#j-customer-mobile-application-expo)
4. [Master Credentials Reference Matrix](#4-master-credentials-reference-matrix)
5. [First-Time Super Admin Setup](#5-first-time-super-admin-setup)
6. [Hosting Platform Guides](#6-hosting-platform-guides)
   - [Option A: Railway (Zero-Config DB + Web)](#option-a-railway)
   - [Option B: Render (Web Service + Managed Postgres)](#option-b-render)
   - [Option C: Self-Hosted Linux VPS (Ubuntu + PM2 + Nginx + Let's Encrypt SSL)](#option-c-self-hosted-linux-vps)
   - [Option D: Google Cloud Run (Serverless Container)](#option-d-google-cloud-run)
   - [Option E: Docker & Docker Compose](#option-e-docker--docker-compose)
7. [Customer Mobile Application (Expo / Native Stores)](#7-customer-mobile-application)
8. [PCI-DSS & Data Protection Compliance](#8-pci-dss--data-protection-compliance)
9. [Pre-Flight Checklist & Troubleshooting FAQ](#9-pre-flight-checklist--troubleshooting-faq)

---

## 1. Architecture & Package Artifacts

Luxe Boutique is engineered as a unified full-stack architecture. A single bundled Node.js service serves the REST API, media upload storage, the administrative dashboard, the customer storefront SPA, and the customer mobile app bundle under a single domain and port (default `3000`).

### Production Distribution Layout (`dist/`)

Running `npm run build` or `npm run build:tiered` produces a self-contained release in `dist/`:

| Directory / File | Description | Serving Path |
|---|---|---|
| `index.html` + `assets/` | Customer Web Storefront (React 18 SPA) | Root path `/` |
| `admin/` | Management & Orders Dashboard (React 18 SPA) | `/admin` and `/admin/*` |
| `mobile/` | Customer Mobile App (iOS & Android Expo manifests & bundles) | `/mobile` and `/mobile/*` |
| `server/index.mjs` | Bundled Node.js API Server (ESM) | `/api/*` and static router |
| `.env.example` | Comprehensive documented environment variable template | Private server configuration |
| `LICENSE.md` | Commercial license agreement with PCI/GDPR terms | Legal terms & conditions |
| `DEPLOYMENT.md` | Exhaustive deployment, credentials & operations manual | Operations documentation |
| `DEPLOYMENT-GUIDE.md` | Quickstart deployment summary | Quick reference guide |

---

## 2. Prerequisites & System Requirements

Before deploying, ensure you have:

* **Node.js**: Version `20.x` or `22.x LTS`.
* **PostgreSQL Database**: Version `14.0` or higher.
  - Recommended cloud database providers: **Neon.tech** (free tier available), **Supabase**, **Railway**, **Render Postgres**, or **AWS RDS**.
  - PostgreSQL connection string format: `postgresql://user:password@host:5432/dbname?sslmode=require`
* **Custom Domain with HTTPS SSL**: Required for production payment gateways (Paystack, Stripe, Flutterwave) and secure session cookies.

---

## 3. Master Credentials & Environment Variables Catalog

Luxe Boutique uses modular configuration:
- **Strictly Required to Boot**: Only **6 core variables** (`PORT`, `NODE_ENV`, `DATABASE_URL`, `SESSION_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, `ADMIN_BOOTSTRAP_SECRET`).
- **Feature Connectors**: Added only when you wish to activate that specific gateway, channel, or service.

---

### A. Core Server & Database Infrastructure

These variables define the network runtime, database connection, and CORS security.

| Variable Name | Required? | Default | Description & Setup |
|---|---|---|---|
| `PORT` | **YES** | `3000` | Port number the backend HTTP server binds to. |
| `NODE_ENV` | **YES** | `production` | Environment mode. When set to `production`, all dev bypasses (`AUTH_DEV_BYPASS`) are disabled, admin quick-login is removed, admin emails are redacted from exists check, and secure cookies are enforced. |
| `DATABASE_URL` | **YES** | *(None)* | PostgreSQL connection URI. Format: `postgresql://user:password@host:5432/dbname?sslmode=require`. Cloud databases (Neon, Supabase, Railway) require `?sslmode=require`. |
| `PGSSLMODE` | Optional | `require` | PostgreSQL client SSL connection mode (`require`, `prefer`, `verify-full`). |
| `PGCONNECT_TIMEOUT`| Optional | `15` | Database connection timeout in seconds. |
| `APP_URL` | **YES** | `https://yourstore.com` | Canonical public HTTPS URL of your storefront. Used in email notifications, reset links, and CORS headers. |
| `PUBLIC_APP_URL` | Optional | `(APP_URL)` | Synonym for `APP_URL`. |
| `ADMIN_URL` | **YES** | `https://yourstore.com/admin` | Public URL of the administrator portal (either subfolder or subdomain e.g. `https://admin.yourstore.com`). |
| `CORS_ALLOWED_ORIGINS` | Optional | `(Derived from APP_URL)` | Comma-separated list of allowed origins (e.g. `https://yourstore.com,https://admin.yourstore.com`). |
| `LOG_LEVEL` | Optional | `info` | Logging verbosity for the Pino logger: `trace`, `debug`, `info`, `warn`, `error`, `fatal`. |

---

### B. Security & Cryptographic Master Secrets

These high-entropy cryptographic keys protect sessions, cookies, and database credential encryption.

| Variable Name | Required? | Description & Setup |
|---|---|---|
| `SESSION_SECRET` | **YES** | 32+ character high-entropy string used to sign session cookies and generate CSRF tokens. Generate using: `openssl rand -hex 32`. |
| `CREDENTIAL_ENCRYPTION_KEY` | **YES** | 32+ character master encryption key. The internal `credentialVault` uses AES-256-GCM with this key to encrypt all third-party API tokens, SMTP passwords, and payment secrets stored in the database. Generate using: `openssl rand -hex 32`. |
| `ADMIN_BOOTSTRAP_SECRET` | **YES (Initially)** | One-time setup password used to create the very first Super Admin account at `https://yourstore.com/admin`. After the first admin is initialized, this endpoint is permanently locked by a database advisory lock, and this variable can be rotated or removed. |

---

### C. Customer & Staff Authentication (Google OAuth)

Enables "Sign in with Google" for storefront customers and one-click Google login for boutique staff.

| Variable Name | Required? | Description & Setup |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth 2.0 Web Client ID from the Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth 2.0 Client Secret. |

#### 🛠️ How to Obtain & Configure Google OAuth:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select your Google Cloud project.
3. Navigate to **APIs & Services** -> **OAuth consent screen**.
   - User Type: **External**.
   - App name: `Luxe Boutique` (or your brand name).
   - Scopes: `email`, `profile`, `openid`.
4. Go to **APIs & Services** -> **Credentials** -> **Create Credentials** -> **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Luxe Boutique Web Client`.
   - **Authorized JavaScript origins**:
     - `https://yourstore.com`
     - `https://admin.yourstore.com` (if using an admin subdomain)
   - **Authorized redirect URIs**:
     - `https://yourstore.com/api/auth/google/callback`
5. Copy the generated **Client ID** and **Client Secret** into your `.env` file (or save them encrypted directly in `/admin` -> Settings -> Google Login).

---

### D. Payment Processing Gateways

Configure only the gateways you wish to accept. All gateways support webhooks for real-time payment settlement.

#### 1. Paystack (Recommended for Ghana, Nigeria, Kenya, South Africa)
Supports Mobile Money (MTN, Telecel, AT), Visa, Mastercard, and Bank Transfers.

| Variable Name | Codebase Aliases | Description |
|---|---|---|
| `PAYSTACK_PUBLIC_KEY` | `PAYSTACK_PUBLISHABLE_KEY` | Public key starting with `pk_live_...` (or `pk_test_...`). |
| `PAYSTACK_SECRET_KEY` | `PAYSTACK_SECRET` | Secret key starting with `sk_live_...` (or `sk_test_...`). |
| `PAYSTACK_CLIENT_ID` | *(None)* | Optional Paystack Integration ID. |

- **Where to obtain:** [Paystack Dashboard](https://dashboard.paystack.com/#/settings/developer) -> **Settings** -> **API Keys & Webhooks**.
- **Webhook URL to register in Paystack:**
  `https://yourstore.com/api/webhooks/paystack`

---

#### 2. Flutterwave (Pan-African Mobile Money & Card Processing)
Supports 150+ currencies across Africa (M-Pesa, MTN MoMo, AirtelTigo, Cards, Bank Transfer).

| Variable Name | Codebase Aliases | Description |
|---|---|---|
| `FLUTTERWAVE_PUBLIC_KEY` | *(None)* | Public key starting with `FLWPUBK_...` (or `FLWPUBK_TEST-...`). |
| `FLUTTERWAVE_SECRET_KEY` | `FLW_SECRET_KEY` | Secret key starting with `FLWSECK_...` (or `FLWSECK_TEST-...`). |
| `FLUTTERWAVE_WEBHOOK_SECRET` | `FLUTTERWAVE_SECRET_HASH`, `FLW_SECRET_HASH` | Secret hash you configure in Flutterwave to verify incoming webhook authenticity. |
| `FLUTTERWAVE_CLIENT_ID` | *(None)* | Optional Merchant Account ID. |

- **Where to obtain:** [Flutterwave Dashboard](https://dashboard.flutterwave.com/) -> **Settings** -> **Developers** -> **API Keys**.
- **Webhook URL to register in Flutterwave:**
  `https://yourstore.com/api/webhooks/flutterwave`
- **Secret Hash configuration:** In Flutterwave Dashboard under Webhooks, set your **Secret hash** to match `FLUTTERWAVE_WEBHOOK_SECRET`.

---

#### 3. Stripe (Global Credit / Debit Cards, Apple Pay, Google Pay, Klarna)
PCI Level-1 compliant international payment processing.

| Variable Name | Codebase Aliases | Description |
|---|---|---|
| `STRIPE_PUBLIC_KEY` | `STRIPE_PUBLISHABLE_KEY` | Publishable key starting with `pk_live_...` (or `pk_test_...`). |
| `STRIPE_SECRET_KEY` | `STRIPE_SECRET`, `STRIPE_API_KEY` | Secret key starting with `sk_live_...` (or `sk_test_...`). |
| `STRIPE_WEBHOOK_SECRET` | *(None)* | Webhook signing secret starting with `whsec_...`. |
| `STRIPE_CLIENT_ID` | *(None)* | Optional Stripe Connect Client ID (`ca_...`). |

- **Where to obtain:** [Stripe Dashboard](https://dashboard.stripe.com/apikeys) -> **Developers** -> **API keys**.
- **Webhook Setup:** Go to **Developers** -> **Webhooks** -> **Add endpoint**:
  - **Endpoint URL:** `https://yourstore.com/api/webhooks/stripe`
  - **Events to send:** `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `checkout.session.completed`.
  - Reveal and copy the **Signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.

---

#### 4. PayPal (International Digital Wallet & Pay in 4)
Digital wallet checkout and installment financing.

| Variable Name | Codebase Aliases | Description |
|---|---|---|
| `PAYPAL_CLIENT_ID` | *(None)* | PayPal REST API App Client ID. |
| `PAYPAL_CLIENT_SECRET` | *(None)* | PayPal REST API App Secret. |

- **Where to obtain:** [PayPal Developer Portal](https://developer.paypal.com/dashboard/applications/) -> **My Apps & Credentials** -> Create or select your Live App.
- **Webhook URL to register in PayPal:**
  `https://yourstore.com/api/webhooks/paypal`

---

### E. Geolocation & Address Autocomplete (Google Maps)

Powers customer shipping address auto-complete during checkout, delivery distance calculation, and store locator map pins.

| Variable Name | Codebase Aliases | Description |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | `GOOGLE_MAPS_KEY`, `VITE_GOOGLE_MAPS_API_KEY` | Google Maps Platform API key. |

#### 🛠️ How to Obtain & Configure Google Maps:
1. Go to [Google Cloud Console - Google Maps Platform](https://console.cloud.google.com/google/maps-apis).
2. Enable the following APIs:
   - **Places API (New)**: Address auto-complete in checkout address inputs.
   - **Geocoding API**: Lat/long delivery coordinate calculation.
   - **Maps JavaScript API**: Visual interactive map rendering.
3. Create an API Key in **Credentials**.
4. **Security Best Practice (HTTP Referrer Restriction)**:
   - Restrict the key to your domain: `https://yourstore.com/*` and `https://admin.yourstore.com/*`.

---

### F. Social Commerce & Channels

Connect your boutique inventory to Instagram Shop, Facebook Catalog, Meta Messenger, and X (Twitter).

#### 1. Meta Business Suite (Facebook Catalog, Instagram Shopping, Messenger)

| Variable Name | Codebase Aliases | Description |
|---|---|---|
| `META_APP_ID` | *(None)* | Facebook App ID from developers.facebook.com. |
| `META_APP_SECRET` | *(None)* | Facebook App Secret. |
| `META_CONFIG_ID` | *(None)* | Facebook Login for Business Configuration ID. |
| `META_API_VERSION` | *(None)* | Graph API version (default: `v21.0`). |
| `META_WEBHOOK_VERIFY_TOKEN` | *(None)* | Custom verification token you define for Webhook verification (default: `Luxe`). |

- **Where to obtain:** [Meta for Developers](https://developers.facebook.com/) -> Create App -> Business Type.
- **OAuth Redirect URI to register in Facebook Login:**
  `https://yourstore.com/api/meta/callback`
- **Webhook Ingestion URL to register in Meta App Webhooks:**
  - **Callback URL:** `https://yourstore.com/api/webhooks/meta`
  - **Verify Token:** Enter the value configured in `META_WEBHOOK_VERIFY_TOKEN`.
  - **Fields:** `messages`, `messaging_postbacks`, `catalog_feed_status`.

---

#### 2. X (Twitter) Luxury Broadcast & Concierge
Automated new collection announcements, product card broadcasts, and direct message customer service.

| Variable Name | Codebase Aliases | Description |
|---|---|---|
| `TWITTER_CLIENT_ID` | *(None)* | X API 2.0 OAuth 2.0 Client ID (from developer.x.com). |
| `TWITTER_CLIENT_SECRET` | *(None)* | X API 2.0 OAuth 2.0 Client Secret (Confidential Client with PKCE). |

- **Where to obtain:** [X Developer Portal](https://developer.x.com/) -> Projects & Apps -> Your App -> **User authentication settings**.
- **OAuth 2.0 Callback URL to register:**
  `https://yourstore.com/api/twitter/callback`
- **Required Scopes:** `tweet.read`, `tweet.write`, `users.read`, `offline.access`, `media.write`.

---

### G. Transactional Email & Messaging (SMTP)

Delivers customer order confirmations, shipping updates, password resets, and administrator 2FA/OTP login codes.

| Variable Name | Codebase Aliases | Default | Description |
|---|---|---|---|
| `SMTP_HOST` | *(None)* | *(None)* | Hostname of SMTP mail relay (e.g. `smtp.sendgrid.net`, `smtp.mailgun.org`, `email-smtp.us-east-1.amazonaws.com`, `smtp.zoho.com`, `smtp.gmail.com`). |
| `SMTP_PORT` | *(None)* | `587` | SMTP port (`587` for STARTTLS, `465` for SSL, `25`). |
| `SMTP_USER` | *(None)* | *(None)* | SMTP account username or API key user (e.g. `apikey` for SendGrid). |
| `SMTP_PASS` | *(None)* | *(None)* | SMTP account password or API secret key. |
| `SMTP_SECURE` | *(None)* | `false` | Set to `true` if connecting to SSL port `465`; set to `false` for port `587`. |
| `SMTP_FROM` | *(None)* | `"Luxe Boutique <orders@yourstore.com>"` | Formatted RFC-822 sender email address. |

> **In-App Configuration:** SMTP settings can also be set or changed at any time without restarting the server via `/admin` -> **Settings** -> **Email & Notifications**. Secrets are encrypted in the database using `CREDENTIAL_ENCRYPTION_KEY`.

---

### H. Media Storage & CDN (Cloudinary)

Stores product photography, banner images, and customer receipt uploads.

| Variable Name | Codebase Aliases | Description |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | *(None)* | Cloudinary account cloud name (from cloudinary.com/console). |
| `CLOUDINARY_API_KEY` | *(None)* | 15-digit Cloudinary API Key. |
| `CLOUDINARY_API_SECRET` | *(None)* | Cloudinary API Secret. |
| `CLOUDINARY_URL` | *(None)* | Full URI: `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`. |

> **Zero-Config Local Storage Fallback:** If Cloudinary credentials are omitted, the application automatically stores all uploaded imagery on the local server filesystem in `uploads/` and serves them via `/api/uploads/`. No external account is required.

---

### I. Logistics, Dropshipping & Fulfillment Providers

Luxe Boutique features native adapters for third-party logistics (3PL) and on-demand manufacturing. These can be configured in `.env` or in the `/admin` portal under **Settings** -> **Fulfillment & Providers**:

| Provider | Credential Keys | Description |
|---|---|---|
| **Eprolo** | `eprolo_api_key`, `eprolo_api_secret` | Eprolo Luxury Dropshipping automation API credentials. |
| **Printful** | `printful_api_key` | Printful personal access token for on-demand luxury apparel printing. |
| **ShipBob** | `shipbob_api_key` | ShipBob 3PL warehousing and automated order dispatch API token. |
| **DHL Express** | `dhl_api_key`, `dhl_api_secret`, `dhl_account_number` | DHL XML-PI / MyDHL API credentials for automated international AWB shipping label generation. |

---

### J. Customer Mobile Application (Expo)

Variables required when running or compiling the customer-facing mobile application (`artifacts/luxe-boutique-mobile`):

| Variable Name | Default | Description |
|---|---|---|
| `EXPO_PUBLIC_DOMAIN` | `(Host domain)` | Domain and port of the backend API without protocol (e.g. `yourstore.com` or `api.yourstore.com`). |
| `EXPO_PUBLIC_API_URL` | `https://yourstore.com` | Full HTTPS base URL of the backend API server. |
| `EXPO_PUBLIC_REPL_ID` | Optional | Client development identifier for Expo proxying. |

---

## 4. Master Credentials Reference Matrix

Use this quick-lookup table to audit all variables across the entire platform:

| Variable | Category | Required? | Default / Fallback | Sensitivity | Where to Configure |
|---|---|---|---|---|---|
| `PORT` | Server | **YES** | `3000` | Low | Server `.env` |
| `NODE_ENV` | Server | **YES** | `production` | Low | Server `.env` |
| `DATABASE_URL` | Database | **YES** | *(None)* | **Critical** | Server `.env` |
| `SESSION_SECRET` | Security | **YES** | *(None)* | **Critical** | Server `.env` |
| `CREDENTIAL_ENCRYPTION_KEY` | Security | **YES** | *(None)* | **Critical** | Server `.env` |
| `ADMIN_BOOTSTRAP_SECRET` | Security | **YES (Init)** | *(None)* | **High** | Server `.env` |
| `APP_URL` | Domain | **YES** | `https://yourstore.com` | Low | Server `.env` |
| `PUBLIC_APP_URL` | Domain | Optional | `(APP_URL)` | Low | Server `.env` |
| `ADMIN_URL` | Domain | **YES** | `(APP_URL)/admin` | Low | Server `.env` |
| `CORS_ALLOWED_ORIGINS` | Security | Optional | `(Derived)` | Medium | Server `.env` |
| `LOG_LEVEL` | Diagnostics | Optional | `info` | Low | Server `.env` |
| `GOOGLE_CLIENT_ID` | Auth | Optional | `""` | Low | `.env` or `/admin` Settings |
| `GOOGLE_CLIENT_SECRET` | Auth | Optional | `""` | **High** | `.env` or `/admin` Settings |
| `GOOGLE_MAPS_API_KEY` | Maps | Optional | `""` | Medium | `.env` |
| `PAYSTACK_PUBLIC_KEY` | Payments | Optional | `""` | Low | `.env` or `/admin` Settings |
| `PAYSTACK_SECRET_KEY` | Payments | Optional | `""` | **Critical** | `.env` or `/admin` Settings |
| `FLUTTERWAVE_PUBLIC_KEY` | Payments | Optional | `""` | Low | `.env` or `/admin` Settings |
| `FLUTTERWAVE_SECRET_KEY` | Payments | Optional | `""` | **Critical** | `.env` or `/admin` Settings |
| `FLUTTERWAVE_WEBHOOK_SECRET`| Payments | Optional | `""` | **High** | `.env` or `/admin` Settings |
| `STRIPE_PUBLIC_KEY` | Payments | Optional | `""` | Low | `.env` or `/admin` Settings |
| `STRIPE_SECRET_KEY` | Payments | Optional | `""` | **Critical** | `.env` or `/admin` Settings |
| `STRIPE_WEBHOOK_SECRET` | Payments | Optional | `""` | **High** | `.env` or `/admin` Settings |
| `PAYPAL_CLIENT_ID` | Payments | Optional | `""` | Low | `.env` or `/admin` Settings |
| `PAYPAL_CLIENT_SECRET` | Payments | Optional | `""` | **Critical** | `.env` or `/admin` Settings |
| `META_APP_ID` | Channels | Optional | `""` | Low | `.env` or `/admin` Settings |
| `META_APP_SECRET` | Channels | Optional | `""` | **High** | `.env` or `/admin` Settings |
| `META_CONFIG_ID` | Channels | Optional | `""` | Medium | `.env` or `/admin` Settings |
| `META_WEBHOOK_VERIFY_TOKEN` | Channels | Optional | `"Luxe"` | Medium | `.env` or `/admin` Settings |
| `TWITTER_CLIENT_ID` | Channels | Optional | `""` | Low | `.env` or `/admin` Settings |
| `TWITTER_CLIENT_SECRET` | Channels | Optional | `""` | **High** | `.env` or `/admin` Settings |
| `SMTP_HOST` | Email | Optional | `""` | Low | `.env` or `/admin` Settings |
| `SMTP_PORT` | Email | Optional | `587` | Low | `.env` or `/admin` Settings |
| `SMTP_USER` | Email | Optional | `""` | Medium | `.env` or `/admin` Settings |
| `SMTP_PASS` | Email | Optional | `""` | **High** | `.env` or `/admin` Settings |
| `SMTP_FROM` | Email | Optional | `"Luxe Boutique <...>"`| Low | `.env` or `/admin` Settings |
| `CLOUDINARY_CLOUD_NAME` | Media | Optional | `""` (local disk) | Low | `.env` or `/admin` Settings |
| `CLOUDINARY_API_KEY` | Media | Optional | `""` (local disk) | Medium | `.env` or `/admin` Settings |
| `CLOUDINARY_API_SECRET` | Media | Optional | `""` (local disk) | **High** | `.env` or `/admin` Settings |
| `EXPO_PUBLIC_DOMAIN` | Mobile | Optional | `(Host)` | Low | Mobile `.env` / EAS |

---

## 5. First-Time Super Admin Setup

When you first launch your store on a fresh database, no administrator accounts exist yet. Follow these steps to initialize your primary Super Admin account:

1. Open your browser and navigate to `https://yourstore.com/admin`.
2. The login page automatically detects that no administrator accounts exist and displays the **First-Time Administrator Setup** portal.
3. Enter your details:
   - **Full Name**: e.g., `Store Owner`
   - **Email Address**: e.g., `owner@yourstore.com`
   - **Bootstrap Secret**: Enter the exact string configured in your `ADMIN_BOOTSTRAP_SECRET` environment variable.
4. Click **Create Super Admin Account**.
5. Once submitted, the system establishes your cryptographic session and logs you into the admin dashboard immediately.
6. **Security Hardening**: The bootstrap endpoint uses an advisory transaction lock. Once the first administrator is created, this endpoint is permanently locked and returns `410 Gone`. You can now safely rotate or remove `ADMIN_BOOTSTRAP_SECRET` from your server environment variables.

---

## 6. Hosting Platform Guides

### Option A: Railway

1. Log into [Railway.app](https://railway.app).
2. Click **New Project** -> **Provision PostgreSQL**.
3. Once the database is created, click **+ New** -> **GitHub Repo** and select your Luxe Boutique repository.
4. Go to the web service **Variables** tab and set the 6 core variables.
5. Go to **Settings** -> **Deploy**:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
6. Click **Deploy**.

---

### Option B: Render

1. Log into [Render.com](https://dashboard.render.com).
2. Click **New +** -> **PostgreSQL**. Note down the **Internal Database URL**.
3. Click **New +** -> **Web Service** and connect your repository.
4. Configure service settings:
   - **Runtime**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
5. In **Environment Variables**, add the core variables.
6. Click **Create Web Service**.

---

### Option C: Self-Hosted Linux VPS (Ubuntu + PM2 + Nginx + Let's Encrypt SSL)

#### 1. Server Prerequisites
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx git
sudo npm install -g pm2
```

#### 2. Clone & Build
```bash
cd /var/www
sudo git clone https://github.com/your-org/your-repo.git luxeboutique
cd luxeboutique

npm install
npm run build
cp .env.example .env
nano .env   # Configure the 6 core variables
```

#### 3. Start Application with PM2
```bash
pm2 start server.ts --name "luxe-boutique"
pm2 save
pm2 startup
```

#### 4. Configure Nginx Reverse Proxy
Create `/etc/nginx/sites-available/luxeboutique`:

```nginx
server {
    server_name yourstore.com www.yourstore.com;
    client_max_body_size 64M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and issue SSL:
```bash
sudo ln -s /etc/nginx/sites-available/luxeboutique /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d yourstore.com -d www.yourstore.com
```

---

### Option D: Google Cloud Run

```bash
gcloud run deploy luxe-boutique \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,SESSION_SECRET=SESSION_SECRET:latest
```

---

### Option E: Docker & Docker Compose

Deploy the entire stack (Node.js application + PostgreSQL 16) with a single command:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: luxe
      POSTGRES_PASSWORD: secure_db_password
      POSTGRES_DB: luxeboutique
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: always

  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      NODE_ENV: production
      DATABASE_URL: postgresql://luxe:secure_db_password@postgres:5432/luxeboutique
      SESSION_SECRET: generate_a_random_32_character_string_here
      CREDENTIAL_ENCRYPTION_KEY: generate_another_random_32_character_string
      ADMIN_BOOTSTRAP_SECRET: initial_admin_password_123
      APP_URL: http://localhost:3000
      PUBLIC_APP_URL: http://localhost:3000
      ADMIN_URL: http://localhost:3000/admin
    depends_on:
      - postgres
    restart: always

volumes:
  pgdata:
```

```bash
docker-compose up -d
```

---

## 7. Customer Mobile Application (Expo)

The production build includes the complete customer mobile app inside `dist/mobile`:
- **Android Manifest**: `dist/mobile/android/manifest.json`
- **iOS Manifest**: `dist/mobile/ios/manifest.json`
- **Expo Configuration**: `dist/mobile/app.json`

### Direct Web Serving
The backend automatically hosts the mobile bundle at `https://yourstore.com/mobile/`. Testers can test locally using:
```bash
npx serve -p 8082 dist/mobile/
```

### Compiling Standalone Native Binaries (APK, AAB, IPA)
```bash
cd artifacts/luxe-boutique-mobile

npm install -g eas-cli
eas login

# Build Android APK (for direct device installation)
eas build --platform android --profile preview

# Build Android App Bundle (for Google Play Store)
eas build --platform android --profile production

# Build iOS Archive (for Apple App Store / TestFlight)
eas build --platform ios --profile production
```

---

## 8. PCI-DSS & Data Protection Compliance

As detailed in your Commercial License Agreement (`LICENSE.md`):

1. **PCI-DSS Compliance Responsibility**:
   - The platform is architected with **client-side tokenization and hosted modal checkout** (Paystack Popup, Stripe Elements, Flutterwave Inline).
   - **Raw primary card account numbers (PAN), CVV/CVC codes, and banking PINs never touch or store on your application server.**
   - As the merchant and software operator, you are responsible for maintaining merchant compliance (such as the PCI-DSS SAQ-A questionnaire), keeping your server SSL active, and securing your merchant API secrets.
2. **Data Protection & Privacy (Ghana Act 843, GDPR)**:
   - Once deployed under your domain, you are the legal **Data Controller** of all customer records, order histories, phone numbers, and delivery addresses.
   - You must publish a legally valid Privacy Policy and Terms of Service on your storefront.
   - Prigid Holdings disclaims liability for data leaks or regulatory fines resulting from compromised hosting servers or improper merchant credential handling after delivery.

---

## 9. Pre-Flight Checklist & Troubleshooting FAQ

### Pre-Flight Launch Checklist

- [ ] Node.js 20+ installed on host
- [ ] PostgreSQL database running and accessible
- [ ] Only 6 core variables configured in `.env` (`PORT`, `NODE_ENV`, `DATABASE_URL`, `SESSION_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, `ADMIN_BOOTSTRAP_SECRET`)
- [ ] Production build verified: `npm run build` executed without errors
- [ ] Primary Super Admin account initialized at `https://yourstore.com/admin`
- [ ] `ADMIN_BOOTSTRAP_SECRET` rotated or removed from server environment after initial admin setup
- [ ] Active SSL/TLS certificate installed (HTTPS enabled)
- [ ] At least one payment gateway configured and verified with a live test order
- [ ] Webhook URL registered in your payment gateway dashboard
- [ ] SMTP email delivery verified (order receipt and password reset)
- [ ] PM2 process supervisor active with auto-restart enabled on server reboot

---

### Troubleshooting FAQ

#### Q: "Database connection failed or SSL connection error"
**Fix:** Cloud databases (Neon, Supabase, AWS) require SSL. Ensure your `DATABASE_URL` ends with `?sslmode=require`. For self-hosted Postgres on localhost, omit `?sslmode=require`.

#### Q: "CORS error when making API requests from storefront"
**Fix:** In unified all-in-one deployment, the API and storefront run under the exact same domain, eliminating CORS. If using separate domains, ensure `CORS_ALLOWED_ORIGINS` includes both URLs separated by a comma.

#### Q: "Admin login OTP code not arriving"
**Fix:** Verify your SMTP settings in `.env` or in `/admin` Settings. Ensure your mail provider allows sending from the `SMTP_FROM` address. Check your server logs with `pm2 logs luxe-boutique` to view any SMTP transmission errors.

#### Q: "Where are product image uploads stored?"
**Fix:** If `CLOUDINARY_CLOUD_NAME` is not configured, images are safely stored on the server's local filesystem in the `uploads/` folder and served via `/api/uploads/`. Ensure the directory has write permissions (`chmod -R 755 uploads/`).

---

## 📞 Support & Contacts

For deployment assistance, maintenance contracts, or custom feature requests, please contact **Prigid Holdings**:
- **Email**: `prigidholdings@gmail.com`
- **Documentation**: Refer to `DEPLOYMENT-GUIDE.md` and `LICENSE.md` in your distribution bundle.
