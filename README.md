# Luxe Boutique

> Premium E-Commerce Storefront, Admin Management Dashboard, and Full-Stack REST API.

Luxe Boutique is a modern, high-end e-commerce platform built as a TypeScript monorepo. It features an elegant customer-facing storefront, a comprehensive admin dashboard for managing inventory, orders, marketing, and customers, and a robust Express backend with real-time cart diagnostics and inventory tracking.

---

## Table of Contents

- [Overview](#overview)
- [Architecture & Monorepo Structure](#architecture--monorepo-structure)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
- [Development & Diagnostic Utilities](#development--diagnostic-utilities)
- [API Reference & Diagnostics](#api-reference--diagnostics)
- [License](#license)

---

## Overview

Luxe Boutique provides an end-to-end luxury shopping experience and store administration suite. Designed for performance, reliability, and ease of management, it combines a React storefront with motion animations, an integrated admin control center, and a resilient Express API server with session-based carts, inventory tracking, and built-in diagnostic logging.

---

## Architecture & Monorepo Structure

This project is organized as an npm workspace monorepo:

```
├── artifacts/
│   ├── luxe-boutique/          # Main customer storefront (React + Vite + Tailwind CSS)
│   ├── luxe-boutique-admin/    # Store admin dashboard & management panel (React + Vite)
│   ├── luxe-boutique-mobile/   # Cross-platform mobile application (React Native + Expo SDK 52)
│   └── api-server/             # Express REST API server, OAuth handlers & reverse proxy
├── lib/
│   ├── db/                     # Drizzle ORM database schemas & PostgreSQL migrations
│   ├── api-spec/               # OpenAPI / API contract specifications
│   ├── api-zod/                # Shared Zod validation schemas
│   └── api-client-react/       # Generated React Query API hooks
├── scripts/                    # Database seeding, validation, and maintenance scripts
└── server.ts                   # Main application entry point & reverse proxy router
```

---

## Key Features

### 🛍️ Customer Storefront (`luxe-boutique`)
- **Curated Collections & Atelier Presence**: Browse luxury garments, view high-res product galleries, and explore international flagship showrooms with dynamic global presence maps.
- **Cart & Diagnostics**: Session-persistent cart management, real-time diagnostic telemetry, instant coupon discounting, and streamlined checkout.
- **User Authentication**: Secure email/password login and optional Firebase / Google OAuth integration.
- **Editorial Journal**: Integrated luxury lifestyle articles and brand storytelling.

### 🛡️ Admin Dashboard (`luxe-boutique-admin`)
- **Product & Inventory Control**: Create, update, and manage products, variants, categories, and stock thresholds.
- **Showrooms & Flagship Salons**: Interactive showroom locator manager with direct local file image upload, drag-and-drop support, and live customer storefront synchronization.
- **Omnichannel Social Commerce**: Direct control centers for Meta Commerce, Facebook & Instagram feeds, Meta Ads Manager, X (Twitter), TikTok, and Pinterest.
- **Provider & Gateway Center**: Multi-gateway payment configuration (Stripe, PayPal, Paystack, Flutterwave) with Stripe Connect OAuth onboarding.
- **Google Workspace & Team Management**: Google Contacts/Workspace directory sync, admin team member invitation, and granular role-based permissions.

### 📱 Mobile App (`luxe-boutique-mobile`)
- **Native Experience**: Powered by React Native and Expo SDK 52 for iOS and Android.
- **Smooth Commerce**: Touch-optimized browsing, native transitions, and responsive product sheets.

### ⚙️ Backend API Server (`api-server`)
- **High-Performance REST Architecture**: Express.js with Zod validation, reverse proxying, and server-sent events (SSE).
- **Multi-Storage Media Engine**: Built-in local persistent disk uploads (`/uploads/`) with optional Cloudinary CDN acceleration.
- **Encrypted Credential Vault**: AES-256 encryption for database-stored integration keys, protecting customer and store provider credentials.
- **Multi-Gateway Payment Orchestration**: Unified payment processing for Stripe, PayPal, Paystack, and Flutterwave.

---

## Tech Stack & Integrations

### 🌐 Frontend & Client Applications
- **Web Storefront**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, TanStack Query, Lucide React, Wouter
- **Admin Dashboard**: React 18, Vite, TypeScript, Tailwind CSS, React Icons, Recharts, TanStack Query
- **Mobile Application**: React Native (Expo SDK 52), Expo Router, Tailwind/Native styling, Lucide React Native

### 🖥️ Backend & Infrastructure
- **Runtime & Server**: Node.js, Express.js, TypeScript, ESBuild
- **Database & ORM**: **Neon PostgreSQL** (Serverless cloud database), **Drizzle ORM** (Type-safe schema definitions and automated migrations)
- **Validation**: Zod (shared schema validation across client and server)
- **File Storage**: Local filesystem disk storage (`multer`) with fallback/optional Cloudinary CDN support
- **Security & Sessions**: HTTP-only secure session cookies, `bcrypt` password hashing, AES-256 credential encryption vault (`credentialVault.ts`)

### ⚡ Meta Platforms (Facebook & Instagram)
- **Meta Business Integration**: Facebook Login for Business, Meta Graph API (v21.0)
- **Meta Commerce & Catalog**: Automatic product feed generation and Facebook/Instagram Shop sync
- **Instagram Graph API**: Instagram Business media publishing, carousel posts, comment management, and profile metrics
- **Meta Ads**: Ad account discovery, campaign monitoring, and webhook verification

### 🔍 Google Cloud & Workspace
- **Google Workspace APIs**: OAuth 2.0 authorization, Google People / Contacts API, and Gmail integration
- **Google Maps Platform**: Interactive maps, geocoding, and showroom locator displays
- **Google Firebase**: Firestore Database integration and Firebase Authentication client services

### 💳 Payment Gateways & FinTech
- **Stripe**: Stripe Checkout Sessions, Elements, Webhooks, and Stripe Connect (marketplace/connected accounts onboarding)
- **PayPal**: REST API Orders v2, Payment Capture, and Instant Payment Notifications
- **Paystack**: Sub-Saharan Africa payment rails, mobile money, and signature-verified webhooks
- **Flutterwave**: Multi-currency checkout, cards, bank transfers, and verified webhook signatures

### 📣 Social Channels & Content
- **X (Twitter)**: OAuth 2.0 authorization, tweet publication, and engagement metrics
- **TikTok**: Creator center and product feed publishing
- **Pinterest**: Pin catalog synchronization and merchant tag integration

---

## Security & Credentials Policy

Security is a primary requirement in this codebase:

- **Zero Hardcoded Secrets**: All sensitive API keys, private tokens, OAuth client secrets, and database credentials must be provided exclusively via environment variables or encrypted via the administrative vault.
- **Automated Credential Audit**: The repository undergoes automated pattern scanning for sensitive secret prefixes (e.g. `sk_live_`, `sk_test_`, `whsec_`, `EAAB`, private keys). Any temporary test keys in utility scripts have been sanitized to load from `process.env`.
- **Credential Encryption at Rest**: Provider credentials (such as channel access tokens) stored in the database are encrypted using AES-256 via `credentialVault.ts` using `SESSION_SECRET` or `CREDENTIAL_ENCRYPTION_KEY`.
- **Public vs. Private Identifiers**: Public client identifiers (e.g., Firebase Web API keys which act as public project identifiers) are governed by origin restrictions and database security rules. Sensitive server-side secrets remain strictly on the backend.

Refer to [`.env.example`](.env.example) for the full list of configurable environment variables.

---

## Getting Started

### Prerequisites

- **Node.js**: >= 18.x
- **npm**: >= 9.x

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/PRIGID-WEB-CLOUD/Pcb.git
   cd Pcb
   ```

2. Install dependencies across all workspace packages:
   ```bash
   npm install
   ```

3. Configure environment variables (optional):
   - Copy `.env.example` to `.env` and fill in any required keys.

---

### Running the Application

- **Full Application (Storefront + Admin + API Server)**:
  ```bash
  npm run dev
  ```
  - Storefront: `http://localhost:3000`
  - Admin Panel: `http://localhost:3005`
  - API Server: `http://localhost:5001`

- **Storefront + API Server Only**:
  ```bash
  npm run dev:store
  ```

- **Admin Panel + API Server Only**:
  ```bash
  npm run dev:admin
  ```

---

## Development & Diagnostic Utilities

### Type Checking & Building

- Run full typecheck across all workspace packages:
  ```bash
  npm run typecheck:all
  ```

- Build production assets for deployment:
  ```bash
  npm run build
  ```

### Cart Service Diagnostics

When testing or troubleshooting cart interactions:
- **Server Debug Traces**: Query `GET http://localhost:3000/api/cart/debug` to review active session diagnostics, recent payload validation steps, and ring buffer logs.
- **Client Logs**: Open browser DevTools console to review structured `🛒 [Cart Diagnostic]` log groups generated during "Add to Cart" actions.

---

## Licensing & Commercial Agreements

This platform and its associated packages are proprietary software owned by **PRIGID HOLDINGS**. Depending on your client purchase agreement or deployment model, the project is governed by one of three commercial licenses:

1. **[Standard Commercial Website License](LICENSE-STANDARD.md)** (`LICENSE-STANDARD.md`):
   - Limited, non-exclusive license to use the customized website for the Client's business operations.
   - PRIGID retains underlying platform ownership; source code is not included unless separately contracted.
2. **[Managed & Hosted Website License](LICENSE-MANAGED-HOSTED.md)** (`LICENSE-MANAGED-HOSTED.md`):
   - Turnkey managed subscription covering hosting, deployment, maintenance, and platform updates.
   - Client manages content and products; PRIGID maintains infrastructure, repository, and platform security.
3. **[Exclusive Source-Code License](LICENSE-EXCLUSIVE-SOURCE-CODE.md)** (`LICENSE-EXCLUSIVE-SOURCE-CODE.md`):
   - Individually negotiated agreement granting identified source-code access and modification rights under strict confidentiality and security protections.

For additional client add-ons, photography, custom integrations, marketing setups, and monthly maintenance packages, refer to the **[Additional Services Catalog](ADDITIONAL_SERVICES.md)**.

See individual license files or the repository [LICENSE](LICENSE) file for complete terms and signature templates.
