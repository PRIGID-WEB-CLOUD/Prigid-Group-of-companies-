# EXCLUSIVE SOURCE-CODE COMMERCIAL LICENSE AGREEMENT
## Enterprise E-Commerce & Retail Management Platform

**Copyright © 2026 PRIGID HOLDINGS / PRIGID GROUP OF COMPANIES. All Rights Reserved.**

---

### PARTIES TO THIS AGREEMENT

* **Licensor:** PRIGID HOLDINGS / PRIGID GROUP OF COMPANIES ("PRIGID", "Licensor", "Company")
* **Licensee:** The enterprise purchasing client or designated entity ("Client", "Licensee")
* **Governing Platform:** Enterprise Full-Stack Monorepo Codebase

---

### PREAMBLE & SOURCE-CODE COVENANT
This Exclusive Source-Code Commercial License Agreement ("Agreement", "Source License") governs the negotiated provision, review, modification, compilation, and proprietary deployment of PRIGID's TypeScript monorepo codebase, frontend applications, backend services, and database structures to Client.

---

### SECTION 1. SOURCE CODE DELIVERY & SCOPE OF GRANT
1.1. **Source-Code Grant.** Subject to full payment of the enterprise source-code purchase price and execution of all confidentiality covenants herein, PRIGID grants to Client a perpetual, commercial, internal-use license to access, inspect, modify, enhance, compile, and execute the identified source code repository ("Licensed Codebase").

1.2. **Delivered Repositories & Packages.** Delivery encompasses the complete TypeScript workspace monorepo:
* `@workspace/storefront`: React 19 / Vite customer storefront;
* `@workspace/admin-portal`: Administrative management and order control dashboard;
* `@workspace/mobile-app`: React Native / Expo SDK 52 mobile application;
* `@workspace/api-server`: Express backend REST API, SSE event bus, and reverse proxy;
* `@workspace/db`: Drizzle ORM PostgreSQL schema definitions, relations, and migration tools;
* Shared TypeScript contract packages (`@workspace/api-spec`, `@workspace/api-zod`, `@workspace/api-client-react`).

1.3. **One-Man Commerce Foundation.** While Client receives full code customization authority, the underlying architecture is delivered optimized for single-storefront retail ("One-Man Commerce"). Client may implement custom ERP, POS, and third-party accounting bridges under its internal developer authority.

---

### SECTION 2. INTELLECTUAL PROPERTY & TITLE CLARIFICATION
2.1. **Retention of Core Copyright.** Except where an explicit Assignment of Copyright is executed as a separate negotiated addendum, PRIGID retains fundamental copyright and moral rights in the base framework, foundational libraries, and reusable architecture.

2.2. **Ownership of Client Modifications.** Client shall own all right, title, and interest in and to original derivative features, bespoke custom modules, proprietary integrations, and unique styling written exclusively by Client’s internal engineers.

2.3. **Third-Party & Open-Source Libraries.** Open-source dependencies declared in `package.json` (such as React, Express, Drizzle, Vite, and Tailwind CSS) remain subject to their respective open-source licenses (MIT, Apache 2.0, BSD) and are not transferred as PRIGID proprietary intellectual property.

---

### SECTION 3. EXCLUSIVITY COVENANTS & MARKET PROTECTION
3.1. **Negotiated Exclusivity.** Where the Client's Statement of Work specifies geographical or vertical exclusivity, PRIGID covenants not to license the identical turnkey brand identity or localized codebase to a direct market competitor within the defined jurisdiction for the agreed exclusivity window.

3.2. **General Reusable Frameworks.** Exclusivity attaches solely to Client's bespoke deliverables and brand implementations. PRIGID retains the unrestricted prerogative to continue developing, maintaining, and licensing general e-commerce engines, modular building blocks, and software frameworks to other commercial sectors.

---

### SECTION 4. COMMERCIAL REDISTRIBUTION RESTRICTIONS
4.1. **No Resale or Public Distribution.** Client is strictly prohibited from:
* Publishing, open-sourcing, or publicly releasing the Licensed Codebase on public git repositories (e.g., public GitHub, GitLab, Bitbucket);
* Packaging, redistributing, or selling the software as a competing software-as-a-service (SaaS) builder, template, or theme;
* Sublicensing or leasing source code access to external third parties for independent commercial exploitation.

4.2. **Internal Enterprise Deployment.** Client may deploy unlimited internal instances, development environments, staging clusters, and production websites strictly on behalf of Client's own direct subsidiaries and commercial affiliates.

---

### SECTION 5. SOURCE CODE CONFIDENTIALITY & TRADE SECRETS
5.1. **Confidential Information.** The Licensed Codebase, database structures, internal cryptographic utilities, and technical documentation constitute valuable proprietary trade secrets of PRIGID.

5.2. **Duty of Care.** Client shall exercise no less than a high degree of administrative and technical care to safeguard the codebase against unauthorized disclosure, external leaks, or insider exfiltration. Source-code access shall be restricted strictly to employees and vetted technical contractors bound by written non-disclosure agreements.

---

### SECTION 6. CRYPTOGRAPHIC SECURITY & CREDENTIAL HYGIENE
6.1. **Credential Sanitization.** Client shall enforce strict repository hygiene and shall never commit sensitive secrets, including:
* Live database connection credentials (`DATABASE_URL`);
* Cryptographic session secrets (`SESSION_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`);
* Payment gateway live keys and webhook signing secrets;
* OAuth client credentials or third-party API keys.

6.2. **Environment Isolation.** All sensitive parameters must be maintained strictly in private runtime `.env` files or secure cloud secret management vaults (such as Google Cloud Secret Manager or AWS Secrets Manager).

---

### SECTION 7. PAYMENT PROCESSING, PCI-DSS & COMPLIANCE
7.1. **Client Operational Autonomy.** Upon delivery of the source code, Client assumes direct and exclusive responsibility for its payment gateway integrations, cryptographic tokenization pipelines, and merchant accounts.

7.2. **PCI-DSS Adherence.** Client covenants that any modifications to checkout controllers, payment client packages, or database schemas shall strictly adhere to PCI-DSS standards, ensuring that raw Primary Account Numbers (PAN), CVVs, or cardholder credentials are never stored or logged on application servers.

7.3. **Indemnity.** Client shall defend, indemnify, and hold PRIGID harmless from any claims, fines, chargeback disputes, or regulatory actions arising from Client’s payment workflows, merchant account administration, or security vulnerabilities introduced post-delivery.

---

### SECTION 8. DATA PRIVACY & STATUTORY REGULATION
8.1. **Data Controller Responsibility.** Client operates as the sole Data Controller for all customer, employee, and supplier data processed by the software post-deployment.

8.2. **Statutory Adherence.** Client is solely responsible for ensuring its operational platforms comply with the Data Protection Act, 2012 (Act 843 of Ghana), GDPR, CCPA, and all applicable privacy mandates.

8.3. **Incident Response.** Client maintains sole responsibility for user notifications, regulatory filings, and forensic remediation in the event of any data breach or infrastructure compromise affecting Client's deployment.

---

### SECTION 9. TECHNICAL SUPPORT, MAINTENANCE & WARRANTY
9.1. **Support Window.** PRIGID provides onboarding assistance, technical handover, and bug-fix support for the duration designated in Client's purchase invoice.

9.2. **Post-Support Maintenance.** Following expiration of the agreed support window, Client assumes full responsibility for continuous maintenance, package updates, node runtime migrations, and infrastructure operations.

9.3. **Warranty Disclaimer.** EXCEPT AS EXPRESSLY PROVIDED IN WRITING, THE CODEBASE IS DELIVERED "AS IS". PRIGID DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.

---

### SECTION 10. GOVERNING LAW & ARBITRATION
This Agreement shall be governed by and construed in accordance with the laws of the Republic of Ghana. Any disputes arising out of or in connection with this Agreement shall be resolved through confidential commercial arbitration conducted in Accra, Ghana.

---

#### LICENSOR: PRIGID HOLDINGS / PRIGID GROUP OF COMPANIES

| Field | Representation |
|---|---|
| **Authorized Signatory:** | PRIGID Enterprise Engineering & Legal Directorate |
| **Corporate Seal:** | PRIGID HOLDINGS / PRIGID GROUP OF COMPANIES |
| **Signature:** | `[DIGITALLY EXECUTED VIA LICENSING ENGINE]` |
| **Date:** | March 2026 |

---

#### LICENSEE / ENTERPRISE CLIENT ACKNOWLEDGMENT

| Field | Representation |
|---|---|
| **Business / Entity Name:** | __________________________________________________ |
| **Authorized Representative:** | __________________________________________________ |
| **Title / Designation:** | __________________________________________________ |
| **Signature:** | __________________________________________________ |
| **Date:** | __________________________________________________ |
