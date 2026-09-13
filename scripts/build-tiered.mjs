import { execSync } from "node:child_process";
import { cp, mkdir, rm, stat, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LICENSE_TIERS, resolveTier, generateTierFingerprint } from "./license-tier-config.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDistDir = path.resolve(rootDir, "dist");

function parseArgs() {
  const args = process.argv.slice(2);
  let tier = process.env.PACKAGE_TIER || process.env.LICENSE_TIER || "basic";
  let licensee = process.env.LICENSE_HOLDER || "PRIGID Authorized Client";
  let outputDir = defaultDistDir;
  let buildAll = false;

  for (const arg of args) {
    if (arg === "--all") {
      buildAll = true;
    } else if (arg.startsWith("--tier=")) {
      tier = arg.split("=")[1];
    } else if (arg.startsWith("--licensee=") || arg.startsWith("--license-holder=")) {
      licensee = arg.split("=")[1];
    } else if (arg.startsWith("--output=")) {
      outputDir = path.resolve(rootDir, arg.split("=")[1]);
    }
  }

  return { tier, licensee, outputDir, buildAll };
}

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function buildTier(tierIdentifier, licensee, outputDir) {
  const tierConfig = resolveTier(tierIdentifier);

  console.log(`\n============================================================`);
  console.log(`🚀 Starting Tiered Production Build: [${tierConfig.id.toUpperCase()}]`);
  console.log(`📜 License: ${tierConfig.name}`);
  console.log(`👤 Licensee: ${licensee}`);
  console.log(`📁 Target Output: ${outputDir}`);
  console.log(`============================================================\n`);

  // 1. Prepare Environment Variables
  const buildEnv = {
    ...process.env,
    NODE_ENV: "production",
    PORT: "3000",
    ...tierConfig.envFlags,
  };

  // 2. Build Backend API Server
  console.log("==> [1/4] Building @workspace/api-server...");
  execSync("npm run build --workspace=@workspace/api-server", {
    cwd: rootDir,
    stdio: "inherit",
    env: buildEnv,
  });

  // 3. Build Storefront Client
  console.log("==> [2/4] Building @workspace/luxe-boutique (Storefront)...");
  execSync("npm run build --workspace=@workspace/luxe-boutique", {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...buildEnv, BASE_PATH: "/" },
  });

  // 4. Build Admin Portal (for managed_hosted and enterprise_exclusive tiers)
  const shouldBuildAdmin = tierConfig.allowedWorkspaces.includes("@workspace/luxe-boutique-admin");
  if (shouldBuildAdmin) {
    console.log("==> [3/4] Building @workspace/luxe-boutique-admin (Admin Portal)...");
    execSync("npm run build --workspace=@workspace/luxe-boutique-admin", {
      cwd: rootDir,
      stdio: "inherit",
      env: { ...buildEnv, BASE_PATH: "/admin/" },
    });
  } else {
    console.log("==> [3/4] Skipping Admin Portal (Restricted in Standard Single-Store Tier)...");
  }

  // 5. Assemble unified output directory
  console.log("==> [4/4] Assembling tiered bundle in target directory...");
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  // Copy Storefront
  const storeDist = path.resolve(rootDir, "artifacts/luxe-boutique/dist/public");
  if (await exists(storeDist)) {
    console.log("  -> Copying Storefront assets...");
    await cp(storeDist, outputDir, { recursive: true });
  }

  // Copy Admin if built
  if (shouldBuildAdmin) {
    const adminDist = path.resolve(rootDir, "artifacts/luxe-boutique-admin/dist/public");
    if (await exists(adminDist)) {
      console.log("  -> Copying Admin Portal assets to admin/...");
      const distAdmin = path.resolve(outputDir, "admin");
      await mkdir(distAdmin, { recursive: true });
      await cp(adminDist, distAdmin, { recursive: true });
    }
  }

  // Copy API Server bundle
  const serverDist = path.resolve(rootDir, "artifacts/api-server/dist");
  if (await exists(serverDist)) {
    console.log("  -> Copying API Server bundle to server/...");
    const distServer = path.resolve(outputDir, "server");
    await mkdir(distServer, { recursive: true });
    await cp(serverDist, distServer, { recursive: true });
  }

  // Copy Mobile App Build (iOS & Android Expo deployment bundles) - Included in all packages
  const mobileStaticBuild = path.resolve(rootDir, "artifacts/luxe-boutique-mobile/static-build");
  const distMobile = path.resolve(outputDir, "mobile");
  if (await exists(mobileStaticBuild)) {
    console.log("  -> Packaging Mobile App Build (iOS & Android bundles) to mobile/...");
    await mkdir(distMobile, { recursive: true });
    await cp(mobileStaticBuild, distMobile, { recursive: true });

    const mobileAppJson = path.resolve(rootDir, "artifacts/luxe-boutique-mobile/app.json");
    if (await exists(mobileAppJson)) {
      await cp(mobileAppJson, path.resolve(distMobile, "app.json"));
    }

    const mobilePkgJson = path.resolve(rootDir, "artifacts/luxe-boutique-mobile/package.json");
    if (await exists(mobilePkgJson)) {
      await cp(mobilePkgJson, path.resolve(distMobile, "package.json"));
    }

    const mobileAssets = path.resolve(rootDir, "artifacts/luxe-boutique-mobile/assets");
    if (await exists(mobileAssets)) {
      await cp(mobileAssets, path.resolve(distMobile, "assets"), { recursive: true });
    }

    const readmeContent = `# Luxe Boutique - Mobile App Build Artifacts\n\nTier: ${tierConfig.name}\nGenerated: ${new Date().toISOString()}\n\n## Included Mobile Assets\n- Android bundle & manifest: \`android/manifest.json\`\n- iOS bundle & manifest: \`ios/manifest.json\`\n- Static JS runtime bundles\n- Expo configurations (\`app.json\`, \`package.json\`)\n- Mobile application assets (\`assets/\`)\n\n## Serving Mobile Build\n\`\`\`bash\nnpx serve -p 8082 mobile/\n\`\`\`\n`;
    await writeFile(path.resolve(distMobile, "README-MOBILE.md"), readmeContent, "utf-8");
  }

  // 6. Embed Verified Commercial License Document
  const sourceLicensePath = path.resolve(rootDir, tierConfig.licenseFile);
  const targetLicensePath = path.resolve(outputDir, "LICENSE");
  const targetLicenseMdPath = path.resolve(outputDir, "LICENSE.md");
  if (await exists(sourceLicensePath)) {
    console.log(`  -> Stamping verified license: ${tierConfig.licenseFile}`);
    await cp(sourceLicensePath, targetLicensePath);
    await cp(sourceLicensePath, targetLicenseMdPath);
  }

  // 7. Generate Signed Tier Manifest
  const manifestData = {
    tierId: tierConfig.id,
    tierName: tierConfig.name,
    badge: tierConfig.badge,
    priceRangeGHS: tierConfig.priceRangeGHS,
    paymentType: tierConfig.paymentType,
    targetAudience: tierConfig.targetAudience,
    supportDuration: tierConfig.supportDuration,
    licenseDocument: tierConfig.licenseFile,
    licensee,
    buildTimestamp: new Date().toISOString(),
    allowedWorkspaces: tierConfig.allowedWorkspaces,
    restrictedWorkspaces: tierConfig.restrictedWorkspaces,
    limits: tierConfig.limits,
    features: tierConfig.features,
    mobileBuildIncluded: true,
    mobilePlatforms: ["android", "ios"],
    clientWatermarkRequired: tierConfig.clientWatermarkRequired,
    tierFingerprint: generateTierFingerprint(tierConfig, { licensee }),
  };

  const manifestPath = path.resolve(outputDir, "tier-manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifestData, null, 2), "utf-8");
  console.log(`  -> Generated signed tier manifest: tier-manifest.json`);

  // 8. Copy .env.example to Root and Server directory for immediate client setup
  const sourceEnvExample = path.resolve(rootDir, ".env.example");
  if (await exists(sourceEnvExample)) {
    await cp(sourceEnvExample, path.resolve(outputDir, ".env.example"));
    await cp(sourceEnvExample, path.resolve(outputDir, "server/.env.example"));
    console.log(`  -> Copied documented .env.example to package root and server/`);
  }

  // 9. Generate Tier-Specific Deployment Guide & Client README
  const deploymentGuideContent = `# Luxe Boutique — Production Deployment & Operations Guide

**Package Tier:** ${tierConfig.name}
**Target Audience:** ${tierConfig.targetAudience}
**Support Period:** ${tierConfig.supportDuration}
**Build Date:** ${new Date().toISOString().split("T")[0]}
**License Contract:** See \`${tierConfig.licenseFile}\` (stamped as \`LICENSE.md\`)

Welcome to your production release of **Luxe Boutique** — a single-storefront retail e-commerce platform crafted by Prigid. This package contains everything required to deploy your web storefront, customer mobile app, backend API${shouldBuildAdmin ? ", and administration portal" : ""}.

---

## 📦 Package Contents Overview

| Directory / File | Description | Recommended Hosting |
|---|---|---|
| \`index.html\` + \`assets/\` | Customer-Facing Web Storefront | Static CDN (Vercel, Netlify, Cloudflare Pages, AWS S3 + CloudFront, Nginx) |
| \`mobile/\` | Customer-Facing Mobile App (iOS & Android) | Static Hosting / Expo CDN / Mobile App Stores |
| \`admin/\` | Management & Orders Dashboard ${shouldBuildAdmin ? "" : "*(Not included in Basic tier)*"} | Static CDN / Protected Admin Subdomain |
| \`server/\` | Backend API Server (Node.js runtime) | Node Container / VPS (Railway, Render, Fly.io, DigitalOcean, Cloud Run) |
| \`.env.example\` | Documented Environment Variable Template | Store privately on your backend server as \`.env\` |
| \`LICENSE.md\` | Commercial License & Compliance Terms | Legal documentation |
| \`tier-manifest.json\` | Digitally signed tier capabilities specification | Read-only configuration reference |

---

## 🚀 Quickstart: Get Live in 4 Simple Steps

### Step 1: Provision a PostgreSQL Database
The backend requires a standard PostgreSQL database (version 14 or higher).
- Recommended managed providers: **Neon.tech** (free tier available), **Supabase**, **Railway**, or **AWS RDS**.
- Copy your PostgreSQL connection URL string (e.g., \`postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require\`).

### Step 2: Configure Environment Variables
Inside your hosting platform or on your server in the \`server/\` directory, create a \`.env\` file by copying \`.env.example\`:

\`\`\`bash
cp .env.example .env
\`\`\`

**Only 6 core variables are strictly required to start the application:**

\`\`\`env
# 1. Listening port
PORT=3000

# 2. Production environment mode
NODE_ENV=production

# 3. PostgreSQL Database URL from Step 1
DATABASE_URL=postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require

# 4. Cryptographic Security Secrets (generate 32+ character random strings)
SESSION_SECRET=create_a_long_random_alphanumeric_session_secret_string_here
CREDENTIAL_ENCRYPTION_KEY=create_a_long_random_alphanumeric_encryption_key_here

# 5. Admin Bootstrap Secret (used once to create your initial admin account)
ADMIN_BOOTSTRAP_SECRET=temporary_admin_creation_passcode_to_rotate_later

# 6. Domain URLs & CORS
APP_URL=https://yourstore.com
PUBLIC_APP_URL=https://yourstore.com
ADMIN_URL=https://admin.yourstore.com
CORS_ALLOWED_ORIGINS=https://yourstore.com,https://admin.yourstore.com
\`\`\`

*(Optional integrations for Paystack, Stripe, Flutterwave, SMTP email, and Cloudinary can be added whenever you choose to enable them. See \`.env.example\` for exact keys.)*

### Step 3: Run the Backend API Server
The backend is bundled into an optimized Node.js ESM executable (\`server/index.mjs\`):

\`\`\`bash
# Start backend server
node server/index.mjs
\`\`\`

*Production Best Practice:* Run behind a process supervisor such as PM2 (\`pm2 start server/index.mjs --name luxe-api\`) or inside a Docker container.

### Step 4: Deploy the Web Storefront, Admin & Mobile

1. **Web Storefront:** Upload the root directory files (\`index.html\`, \`assets/\`, \`favicon.ico\`) to your static web host (e.g., pointing your primary domain \`https://yourstore.com\` to it).
2. **Admin Dashboard:** ${shouldBuildAdmin ? "Upload the contents of `admin/` to a dedicated admin subdomain (e.g., `https://admin.yourstore.com`) or subfolder." : "The Basic tier does not include the Admin Dashboard."}
3. **Customer Mobile App:** The \`mobile/\` directory contains the complete production-built Expo mobile application:
   - Contains \`android/manifest.json\` and \`ios/manifest.json\`.
   - Host \`mobile/\` statically (e.g., \`https://yourstore.com/mobile/\`) to serve OTA updates to your mobile customers.
   - To test locally: \`npx serve -p 8082 mobile/\`.
   - To build standalone native APK or IPA packages, submit via Expo EAS: \`eas build --platform all\`.

---

## 🔒 Security Notice: Production Hardening
- **Development Bypass Disabled:** Development bypass flags (including \`AUTH_DEV_BYPASS\`) have been strictly stripped and disabled in production releases. All authentication endpoints require valid credentials, cryptographic sessions, or verified OTP codes.
- **Admin First-Time Setup:** After launching your store, visit \`/admin\`, enter your \`ADMIN_BOOTSTRAP_SECRET\` to create the first Super Admin account, and then remove or rotate that secret from your production environment.

---

## ⚖️ Payment (PCI-DSS) & Data Protection Compliance

As defined in Section 9 & 10 of your License Agreement (\`LICENSE.md\`):

1. **PCI-DSS Compliance Responsibility:**
   - The platform utilizes client-side hosted tokenization (Paystack Popup, Stripe Elements, Flutterwave Inline).
   - **No card numbers, CVVs, or PINs are stored on your server.**
   - As the merchant/licensee, you are responsible for maintaining merchant compliance (such as PCI-DSS SAQ-A), securing your merchant API secrets, and using valid HTTPS SSL certificates on all domains.
2. **Data Protection & Privacy (Ghana Act 843, GDPR):**
   - Once deployed under your domain, you are the **Data Controller** of your customers' personal data (names, emails, phone numbers, delivery addresses).
   - You are responsible for posting a compliant Privacy Notice and collecting valid customer consents for order notifications and marketing.
   - Prigid provides the software platform on an as-is basis and bears no liability for misconfigured servers, unauthorized access to your merchant accounts, or third-party provider outages.

---

## 🤝 Technical Support

Your ${tierConfig.name} package includes **${tierConfig.supportDuration}** of technical assistance.
For inquiries, deployment assistance, or tier upgrades, please contact **Prigid Holdings**.
`;

  await writeFile(path.resolve(outputDir, "DEPLOYMENT-GUIDE.md"), deploymentGuideContent, "utf-8");
  await writeFile(path.resolve(outputDir, "README.md"), deploymentGuideContent, "utf-8");

  const comprehensiveManual = path.resolve(rootDir, "DEPLOYMENT.md");
  if (await exists(comprehensiveManual)) {
    await cp(comprehensiveManual, path.resolve(outputDir, "DEPLOYMENT.md"));
    console.log(`  -> Included comprehensive operations guide: DEPLOYMENT.md`);
  }
  console.log(`  -> Generated deployment guide: DEPLOYMENT-GUIDE.md and README.md`);

  console.log(`\n============================================================`);
  console.log(`🎉 [SUCCESS] Tier [${tierConfig.id.toUpperCase()}] build finished!`);
  console.log(`📦 Artifacts packaged in: ${outputDir}`);
  console.log(`============================================================\n`);
}

async function run() {
  const { tier, licensee, outputDir, buildAll } = parseArgs();

  if (buildAll) {
    console.log(`Building all available tiers: ${Object.keys(LICENSE_TIERS).join(", ")}`);
    for (const tierKey of Object.keys(LICENSE_TIERS)) {
      const tierDistDir = path.resolve(rootDir, `dist-${tierKey}`);
      await buildTier(tierKey, licensee, tierDistDir);
    }
  } else {
    await buildTier(tier, licensee, outputDir);
  }
}

run().catch((err) => {
  console.error("Tiered build failed:", err);
  process.exit(1);
});
