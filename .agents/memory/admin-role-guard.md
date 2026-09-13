---
name: Admin role guard
description: Role values shared by the Luxe Boutique admin frontend and API
---

The admin frontend must treat both `ADMIN` and `SUPER_ADMIN` as authorized roles. The backend already allows both roles for admin middleware and creates the first bootstrap account as `SUPER_ADMIN`.

**Why:** An initial super-admin login can succeed at the API but be immediately redirected to the login page if frontend guards only accept the `ADMIN` role.

**How to apply:** Keep login redirects, route guards, and protected admin UI checks aligned with the backend's `ADMIN`/`SUPER_ADMIN` authorization rule.