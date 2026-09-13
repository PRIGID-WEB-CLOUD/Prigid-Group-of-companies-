---
name: Coupon API contract
description: Shared coupon response and compatibility rules for the admin portal
---

The admin coupon contract uses `discountType`, `discountValue`, `minOrderAmount`, `maxUses`, and `usedCount`. Legacy coupon payloads may use `type`, `value`, and `usageCount`, so the admin client should normalize those fields before rendering.

**Why:** The API and admin page previously evolved with different field names, causing a render-time `toLocaleString` crash when the expected numeric field was undefined.

**How to apply:** Keep the API response and create/update payloads on the newer contract, and retain defensive normalization at the fetch boundary when older in-memory or persisted records may still exist.