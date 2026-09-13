# Luxe Boutique — Deployment Guide

**Tier:** Custom / Exclusive (and all package tiers)
**Build date:** 2026-09-13
**License:** See `LICENSE-EXCLUSIVE-SOURCE-CODE.md` (or tier-specific license)

This package contains a production build of your e-commerce platform: web storefront, customer-facing mobile application, admin dashboard, and backend API. This guide covers what's needed to get it live. For a complete deep-dive on hosting architectures, Nginx configs, and provider setups, see `DEPLOYMENT.md`.

---

## What's included

| Folder | What it is | Hosting type |
|---|---|---|
| `index.html` + `assets/` | Customer-facing storefront | Static hosting (Vercel, Netlify, Cloudflare Pages, S3, Nginx) |
| `mobile/` | Customer-facing mobile app (iOS & Android) | Static hosting / Expo CDN / Mobile client |
| `admin/` | Admin dashboard *(Included in Pro, Premium & Custom)* | Static hosting |
| `server/` | Backend API (Node.js) | Node server / container (Railway, Render, VPS, Fly.io, Cloud Run) |
| `status.html` | System status page | Static hosting |
| `DEPLOYMENT.md` | Exhaustive operations, hosting & credentials manual | Documentation |
| `.env.example` | Complete environment variable template | Private server configuration |

> **Mobile App Included:** This package includes the complete customer-facing mobile application build inside `mobile/`. It contains production-ready Expo manifests for Android (`android/manifest.json`) and iOS (`ios/manifest.json`), optimized JavaScript runtime bundles, and configurations.

---

## 1. Backend setup (`server/`)

The backend is a bundled Node.js application (`server/index.mjs`). It requires a Node hosting environment (VPS, Railway, Render, Fly.io, or similar) with a PostgreSQL database — it will **not** run on static hosting.

### Complete Environment Variables Catalog

#### 🟢 1. Core Server & Database (Mandatory to Boot)
```env
PORT=3000                                 # Web server port (default: 3000)
NODE_ENV=production                       # Disables dev bypass, secures cookies
DATABASE_URL=postgresql://...             # PostgreSQL URI (add ?sslmode=require for cloud)
SESSION_SECRET=                           # 32+ character random string (openssl rand -hex 32)
CREDENTIAL_ENCRYPTION_KEY=                # 32+ character random AES key (openssl rand -hex 32)
ADMIN_BOOTSTRAP_SECRET=                   # One-time secret to register first admin at /admin
APP_URL=https://yourstore.com             # Canonical public storefront URL
PUBLIC_APP_URL=https://yourstore.com      # Synonym for APP_URL
ADMIN_URL=https://yourstore.com/admin     # Public admin URL (subfolder or subdomain)
CORS_ALLOWED_ORIGINS=https://yourstore.com,https://admin.yourstore.com
PGSSLMODE=require                         # Optional SSL mode
PGCONNECT_TIMEOUT=15                      # Optional timeout in seconds
LOG_LEVEL=info                            # Pino logger verbosity
```

#### 🟡 2. Customer & Staff Authentication (Google OAuth 2.0)
```env
# Obtain from https://console.cloud.google.com/apis/credentials
# Authorized Redirect URI: https://yourstore.com/api/auth/google/callback
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

#### 🟡 3. Payment Processing Gateways (Configure What You Use)
```env
# Paystack (Ghana/Nigeria Mobile Money & Cards)
# Webhook: https://yourstore.com/api/webhooks/paystack
PAYSTACK_PUBLIC_KEY=
PAYSTACK_SECRET_KEY=
PAYSTACK_CLIENT_ID=

# Flutterwave (Pan-African Mobile Money & Cards)
# Webhook: https://yourstore.com/api/webhooks/flutterwave
FLUTTERWAVE_PUBLIC_KEY=
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_WEBHOOK_SECRET=
FLW_SECRET_HASH=
FLUTTERWAVE_CLIENT_ID=

# Stripe (Global Cards, Apple Pay, Google Pay)
# Webhook: https://yourstore.com/api/webhooks/stripe
STRIPE_PUBLIC_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CLIENT_ID=

# PayPal (Digital Wallets & Split Financing)
# Webhook: https://yourstore.com/api/webhooks/paypal
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
```

#### 🟡 4. Geolocation & Maps (Google Maps Platform)
```env
# Powers checkout shipping address autocomplete and delivery distance
# Enabled APIs: Places API (New), Geocoding API, Maps JavaScript API
GOOGLE_MAPS_API_KEY=
```

#### 🟡 5. Social Commerce & Channels (Meta & Twitter/X)
```env
# Meta Business Suite (Facebook Catalog, Instagram Shop, Messenger)
# OAuth Redirect: https://yourstore.com/api/meta/callback
# Webhook: https://yourstore.com/api/webhooks/meta
META_APP_ID=
META_APP_SECRET=
META_CONFIG_ID=
META_API_VERSION=v21.0
META_WEBHOOK_VERIFY_TOKEN=Luxe

# X (Twitter) Luxury Broadcast & Concierge (X API v2)
# OAuth Redirect: https://yourstore.com/api/twitter/callback
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
```

#### 🟡 6. Transactional Email & Messaging (SMTP)
```env
# Delivers customer receipts, shipping notifications, and admin OTPs
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=false
SMTP_FROM="Luxe Boutique <orders@yourstore.com>"
```

#### ⚪ 7. Media Storage & CDN (Cloudinary vs. Local Disk)
```env
# If omitted, images upload seamlessly to local disk in /uploads/
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_URL=
```

#### ⚪ 8. Dropshipping & 3PL Logistics Providers
```env
# Can also be entered dynamically in /admin -> Settings -> Fulfillment
EPROLO_API_KEY=
EPROLO_API_SECRET=
PRINTFUL_API_KEY=
SHIPBOB_API_KEY=
DHL_API_KEY=
DHL_API_SECRET=
DHL_ACCOUNT_NUMBER=
```

#### 📱 9. Mobile App (Expo)
```env
EXPO_PUBLIC_DOMAIN=yourstore.com
EXPO_PUBLIC_API_URL=https://yourstore.com
```

---

### Security Notice — Production Hardening

- **Development Bypasses Removed**: `AUTH_DEV_BYPASS` and instant test logins are completely disabled in production builds. If `AUTH_DEV_BYPASS` is detected with `NODE_ENV=production`, the server halts immediately on startup.
- **Admin Setup Lock**: After setting up your primary admin at `https://yourstore.com/admin` with `ADMIN_BOOTSTRAP_SECRET`, the endpoint locks permanently against brute force and changes.

### Running the Backend

```bash
node server/index.mjs
```

Run this behind a process manager (PM2, systemd, or your host's built-in process supervisor) so it restarts automatically on crash or redeploy.

---

## 2. Web Storefront & Admin Deployment

Both `index.html` + `assets/` (storefront) and `admin/` (dashboard) are static builds:

- Point your storefront domain to the root folder contents
- Point your admin subdomain (e.g. `admin.yourdomain.com`) to the `admin/` folder contents
- Both need `APP_URL` / `ADMIN_URL` env values (above) to match wherever you actually deploy them, or API calls will fail due to CORS

---

## 3. Mobile App Deployment (`mobile/`)

The `mobile/` directory contains the complete production-built customer-facing mobile application for iOS and Android:
- `android/manifest.json`: Android Expo bundle manifest
- `ios/manifest.json`: iOS Expo bundle manifest
- `app.json`: Mobile application configuration
- `assets/`: Icons, splash screens, and visuals

### Serving / Loading the Mobile App:
Deploy the contents of `mobile/` to any static web host, CDN, or serve via reverse proxy alongside your backend:
```bash
# To test locally or serve via static server:
npx serve -p 8082 mobile/
```
To generate standalone native iOS (.ipa) or Android (.apk/.aab) store binaries, run:
```bash
eas build --platform all
```

---

## 4. Payment (PCI-DSS) & Data Protection Compliance

As defined in Section 9 & 10 of your License Agreement (`LICENSE.md`):

1. **PCI-DSS Compliance Responsibility:**
   - The platform utilizes client-side hosted tokenization (Paystack Popup, Stripe Elements, Flutterwave Inline).
   - **No card numbers, CVVs, or PINs are stored on your server.**
   - As the merchant/licensee, you are responsible for maintaining merchant compliance (such as PCI-DSS SAQ-A), securing your merchant API secrets, and using valid HTTPS SSL certificates on all domains.
2. **Data Protection & Privacy (Ghana Act 843, GDPR):**
   - Once deployed under your domain, you are the **Data Controller** of your customers' personal data (names, emails, phone numbers, delivery addresses).
   - You are responsible for posting a compliant Privacy Notice and collecting valid customer consents for order notifications and marketing.
   - Prigid provides the software platform on an as-is basis and bears no liability for misconfigured servers, unauthorized access to your merchant accounts, or third-party provider outages.

---

## 5. Pre-Flight Checklist

- [ ] Database provisioned and `DATABASE_URL` set
- [ ] 6 core variables configured: `PORT`, `NODE_ENV`, `DATABASE_URL`, `SESSION_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, `ADMIN_BOOTSTRAP_SECRET`
- [ ] Copy `.env.example` to `.env`
- [ ] At least one payment gateway fully configured and tested with a live test transaction
- [ ] Webhook URL registered in payment provider dashboard
- [ ] SMTP tested (order confirmation / password reset emails)
- [ ] Admin account created via `ADMIN_BOOTSTRAP_SECRET`, then that secret rotated/removed
- [ ] Custom domain(s) pointed and SSL active on both storefront and admin
- [ ] `CORS_ALLOWED_ORIGINS` matches your live domains exactly
- [ ] Mobile app build in `mobile/` verified and accessible

---

## Support

This build is covered under your designated package tier's support terms. Contact Prigid for deployment assistance or questions about any of the above.
