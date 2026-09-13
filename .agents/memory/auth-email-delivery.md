---
name: Auth email delivery
description: Constraints for password-reset links and admin OTP delivery.
---

Password-reset links must use an explicit production URL from `PUBLIC_APP_URL`, `APP_URL`, or the persisted store URL. Replit development-domain variables are not safe production canonical URLs. SMTP delivery must require implicit TLS on port 465 or STARTTLS on other ports.

**Why:** A reset message can be successfully sent while still linking customers to an inaccessible or non-canonical development host, and plaintext SMTP fallback would expose credentials and reset codes in transit.

**How to apply:** Keep the auth mailer fail-closed when no explicit app URL or TLS-capable SMTP transport is configured. Never return reset tokens or OTP codes from production endpoints.