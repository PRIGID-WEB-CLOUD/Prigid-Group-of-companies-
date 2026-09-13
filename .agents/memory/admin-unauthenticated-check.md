---
name: Admin unauthenticated check
description: Expected admin login behavior before an administrator signs in
---

The admin portal checks the current session on page load. Before an administrator signs in, `/api/auth/me` returns `401 Unauthorized`; this is an expected login-state response, not a port or server failure.

**Why:** The portal must distinguish an unauthenticated visitor from a logged-in admin before rendering protected routes.

**How to apply:** Treat the admin login page as healthy when the app loads and the only initial auth error is `/api/auth/me` returning 401. Investigate only unexpected 5xx responses or failed asset loading.