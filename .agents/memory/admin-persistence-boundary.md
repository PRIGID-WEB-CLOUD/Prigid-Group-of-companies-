---
name: Admin persistence boundary
description: Durable rule for admin and channel business data storage and empty-state behavior.
---

Admin and channel business collections must be read from and written to PostgreSQL. Route modules may keep static provider metadata or protocol constants, but must not create fake customers, campaigns, social records, reviews, coupons, or connection activity at runtime.

**Why:** In-memory demo records disappear on restart, make admin analytics look real when they are not, and cause different API behavior between development and production.

**How to apply:** Add normalized tables to the shared Drizzle schema, push development schema changes before testing, and return an empty collection or an explicit “not configured” error when no real integration/data exists.