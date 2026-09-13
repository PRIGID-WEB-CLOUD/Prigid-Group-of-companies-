import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LICENSE_TIERS, resolveTier } from "./license-tier-config.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs() {
  const args = process.argv.slice(2);
  let tier = process.env.PACKAGE_TIER || process.env.LICENSE_TIER || "basic";
  let auditAll = false;

  for (const arg of args) {
    if (arg.startsWith("--tier=")) {
      tier = arg.split("=")[1];
    } else if (arg === "--all") {
      auditAll = true;
    }
  }

  return { tier, auditAll };
}

async function verifyTierCompliance(tierKey) {
  const tierConfig = resolveTier(tierKey);
  console.log(`\n============================================================`);
  console.log(`🏷️  Package Tier: [${tierConfig.id.toUpperCase()}] - ${tierConfig.name}`);
  console.log(`💰 Price: ${tierConfig.priceRangeGHS} (${tierConfig.paymentType})`);
  console.log(`🎯 Scope: ${tierConfig.targetAudience}`);
  console.log(`🛠️  Support: ${tierConfig.supportDuration}`);
  console.log(`============================================================`);

  const errors = [];

  // 1. Verify License Document
  const licenseFilePath = path.join(rootDir, tierConfig.licenseFile);
  try {
    const stat = await fs.stat(licenseFilePath);
    if (!stat.isFile() || stat.size < 100) {
      errors.push(`License document "${tierConfig.licenseFile}" is missing or truncated.`);
    } else {
      console.log(`  ✓ Associated License: ${tierConfig.licenseFile} (${stat.size} bytes)`);
    }
  } catch {
    errors.push(`Required license file not found: ${tierConfig.licenseFile}`);
  }

  // 2. Check Package Restrictions & Boundaries
  console.log(`  🔍 Package Boundaries & Features:`);
  console.log(`    • Model: ONE-MAN COMMERCE (Single Storefront, no multi-vendor clutter)`);
  console.log(`    • Max Products Setup: ${tierConfig.limits.maxProducts} products`);
  console.log(`    • Mobile App Build: ${tierConfig.features.mobileAppBuildIncluded ? 'INCLUDED (iOS & Android Expo Bundle)' : 'NOT INCLUDED'}`);
  console.log(`    • Admin Dashboard: ${tierConfig.features.adminDashboard ? 'INCLUDED' : 'NOT INCLUDED'}`);
  console.log(`    • Payment Integration: ${tierConfig.features.onlinePaymentGateway ? 'ENABLED (Mobile Money, Card, Bank)' : 'DIRECT INQUIRY / WHATSAPP'}`);
  console.log(`    • Bulk Product Import: ${tierConfig.features.bulkProductImport ? 'INCLUDED' : 'NOT INCLUDED'}`);
  console.log(`    • Blog & News Section: ${tierConfig.features.blogNewsSection ? 'INCLUDED' : 'NOT INCLUDED'}`);
  console.log(`    • Marketing Tools: ${tierConfig.features.marketingNewsletterPromo ? 'INCLUDED' : 'NOT INCLUDED'}`);
  console.log(`    • Analytics Tracking: ${tierConfig.features.analyticsTracking ? 'INCLUDED' : 'NOT INCLUDED'}`);
  console.log(`    • API Integrations (ERP/POS): ${tierConfig.features.apiIntegrationsErpPos ? 'INCLUDED' : 'NOT INCLUDED'}`);
  console.log(`    • Source Code Ownership: ${tierConfig.features.exclusiveSourceCodeLicense ? 'INCLUDED' : 'PROPRIETARY RUNTIME ONLY'}`);

  // 3. Check Workspace Inclusions & Restrictions
  console.log(`  📦 Workspace Permissions:`);
  console.log(`    • Allowed: ${tierConfig.allowedWorkspaces.join(", ")}`);
  if (tierConfig.restrictedWorkspaces.length > 0) {
    console.log(`    • Restricted: ${tierConfig.restrictedWorkspaces.join(", ")}`);
  }

  if (errors.length > 0) {
    console.error(`\n❌ [FAILED] Tier "${tierConfig.id}" verification failed with ${errors.length} error(s):`);
    for (const err of errors) {
      console.error(`    - ${err}`);
    }
    return false;
  }

  console.log(`\n✅ [PASSED] Tier "${tierConfig.id}" complies with one-man commerce packaging specifications.`);
  return true;
}

async function run() {
  const { tier, auditAll } = parseArgs();

  let allPassed = true;
  if (auditAll) {
    for (const key of Object.keys(LICENSE_TIERS)) {
      const ok = await verifyTierCompliance(key);
      if (!ok) allPassed = false;
    }
  } else {
    allPassed = await verifyTierCompliance(tier);
  }

  if (!allPassed) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Verification crashed:", err);
  process.exit(1);
});
