---
name: Admin preview port
description: Replit preview routing for the separate Luxe Boutique admin web app
---

The separate admin Vite app runs on local port 5000 and requires an explicit `localPort = 5000` / `externalPort = 5000` entry in `.replit` for its public preview URL to respond.

**Why:** The primary storefront and the admin portal are separate web artifacts; a running local workflow alone does not guarantee that a raw `:5000` preview URL is externally routed.

**How to apply:** Preserve the admin workflow on port 5000 and keep the explicit port mapping when editing `.replit` or regenerating workflow configuration.