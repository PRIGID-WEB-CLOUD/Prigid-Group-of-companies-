---
name: Expo port mapping
description: Replit port routing constraint for the Luxe Boutique Expo and API workflows
---

Replit maps the Expo workflow's local port 3002 to external port 3001. The API must not listen on local port 3001 in this workspace; use a separate supported port and point the storefront proxy at it.

**Why:** Running the API on 3001 makes the API and Expo compete for the same externally routed port, producing confusing unauthorized or port errors even when the local processes use different ports.

**How to apply:** When configuring the Expo and API workflows together, preserve Expo's 3002-to-3001 mapping and assign the API a different port, such as 8000.