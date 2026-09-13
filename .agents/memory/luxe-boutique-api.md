---
name: Luxe Boutique API Setup
description: How the frontend and API server are wired together, and what routes exist.
---

## Architecture

- Frontend: Vite+React at port 22805 (workflow: `artifacts/luxe-boutique: web`)
- API server: Express at port 3001 (workflow: `artifacts/api-server: api`)
- Vite proxies `/api/*` → `http://localhost:3001` via `server.proxy` in `vite.config.ts`
- Express mounts router at `/api` prefix in `app.ts`
- Cookie-parser is included; CORS has `credentials: true`

## Route files (all in `artifacts/api-server/src/routes/`)

- `health.ts` — GET /healthz
- `auth.ts` — /auth/me, /auth/login, /auth/logout, /auth/register, /auth/admin/* (OTP flow, dev mode returns code in response)
- `store.ts` — /products, /orders, /categories, /posts, /media, /users, /coupons, /team
- `channels.ts` — /channels/configs, /channels/events, /channels/webhooks, /channels/credentials/:channel (exports `addEvent` and `credentials` for use in other route files)
- `facebook.ts` — /facebook/* (connections, catalog, pixel-events, audiences, posts, post-templates, page-info, instagram/*, ads/*, catalog/info, catalog/products)
- `twitter.ts` — /twitter/* (hashtags, rules, queue, templates, scheduler, me, posts/publish with OAuth 1.0a signing inline)
- `whatsapp.ts` — /whatsapp/* (templates, journeys, optin, phone-info, messages/send)

## Storage

All data is in-memory (module-level arrays/Maps). No database.
Live external API calls (Meta Graph, Twitter API v2) use stored credentials from `channels.ts`.
When credentials are missing, routes return 400 with a clear "Missing credentials: …" error.

**Why:** No DB was set up at the time. In-memory is sufficient for demo/dev; swap for real DB later.
