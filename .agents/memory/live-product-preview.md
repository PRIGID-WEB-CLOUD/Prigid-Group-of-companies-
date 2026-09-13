---
name: Live product preview
description: How the admin product editor previews storefront products
---

The admin product editor's preview should load the storefront's real `/products/{id}` route in an iframe using the saved product ID. Unsaved products cannot have a live route and should show a save-first state.

**Why:** A simulated search-result card could display placeholder metadata and `/products/product`, which did not represent the actual customer-facing product page.

**How to apply:** Preserve the separate storefront origin resolution for local, Replit preview, and production environments; provide a direct link to open the same live page.