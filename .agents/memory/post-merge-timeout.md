---
name: Post-merge timeout
description: Post-merge setup script timeout configuration for this project.
---

The post-merge script (`scripts/post-merge.sh`) runs `pnpm install --frozen-lockfile` + `pnpm --filter db push`. With the Expo mobile app added, pnpm install takes longer. Default 20 000 ms was too tight and caused timeouts.

**Why:** Expo brings a large dependency tree; drizzle push itself can take 5–10 s.

**How to apply:** Keep `timeoutMs` at 90 000 ms (90 s). If install regresses, check `scripts/post-merge.sh` and call `setPostMergeConfig({ timeoutMs: ... })` to increase further.
