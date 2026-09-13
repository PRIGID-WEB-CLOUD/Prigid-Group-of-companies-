import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * One-Man Commerce Ready-to-Launch E-Commerce Platform Package Tiers
 * Licensor & Platform Owner: PRIGID HOLDINGS / PRIGID GROUP OF COMPANIES
 */
export const LICENSE_TIERS = {
  basic: {
    id: "basic",
    name: "BASIC - Get Started Online",
    badge: "Basic",
    priceRangeGHS: "GH₵ 2,000 – 3,500",
    paymentType: "One-time payment",
    targetAudience: "Perfect for small businesses that want a simple and professional online store.",
    licenseFile: "LICENSE-STANDARD.md",
    supportDuration: "1 month support",
    allowedWorkspaces: [
      "@workspace/api-server",
      "@workspace/luxe-boutique",
      "@workspace/luxe-boutique-mobile",
      "@workspace/db",
      "@workspace/api-zod",
      "@workspace/api-client-react",
      "@workspace/api-spec",
    ],
    restrictedWorkspaces: [
      "@workspace/luxe-boutique-admin",
    ],
    limits: {
      maxProducts: 20,
      maxTenants: 1, // Single-store one-man commerce
    },
    features: {
      oneManCommerce: true,
      multiVendor: false,
      modernStorefront: true,
      mobileAppBuildIncluded: true, // Mobile app build included for all tiers
      customBranding: true, // logo, colors
      productCatalogSetup: true,
      contactAndAboutPages: true,
      mobileFriendlyFastLoading: true,
      basicSeo: true,
      adminDashboard: false,
      onlinePaymentGateway: false, // Order via WhatsApp / direct checkout inquiry
      bulkProductImport: false,
      blogNewsSection: false,
      marketingNewsletterPromo: false,
      analyticsTracking: false,
      customDomainSetup: false,
      socialMediaIntegration: false,
      apiIntegrationsErpPos: false,
      exclusiveSourceCodeLicense: false,
      allowedPaymentGateways: ["direct_inquiry", "whatsapp_checkout", "cash_on_delivery"],
    },
    envFlags: {
      VITE_PACKAGE_TIER: "basic",
      VITE_MAX_PRODUCTS: "20",
      VITE_FEATURE_PAYMENTS: "false",
      VITE_FEATURE_ADMIN_DASHBOARD: "false",
      VITE_FEATURE_MOBILE_BUILD: "true",
      VITE_FEATURE_BULK_IMPORT: "false",
      VITE_FEATURE_BLOG: "false",
      VITE_FEATURE_MARKETING_TOOLS: "false",
      VITE_FEATURE_ANALYTICS: "false",
      PACKAGE_TIER: "basic",
    },
    clientWatermarkRequired: true,
  },

  professional: {
    id: "professional",
    name: "PROFESSIONAL - More Features. More Sales.",
    badge: "Professional",
    priceRangeGHS: "GH₵ 4,000 – 7,000",
    paymentType: "One-time payment",
    targetAudience: "Ideal for growing businesses that want a complete online store with payment integration and an admin dashboard.",
    licenseFile: "LICENSE-STANDARD.md",
    supportDuration: "3 months support",
    allowedWorkspaces: [
      "@workspace/api-server",
      "@workspace/luxe-boutique",
      "@workspace/luxe-boutique-admin",
      "@workspace/luxe-boutique-mobile",
      "@workspace/db",
      "@workspace/api-zod",
      "@workspace/api-client-react",
      "@workspace/api-spec",
    ],
    restrictedWorkspaces: [],
    limits: {
      maxProducts: 100,
      maxTenants: 1, // Single-store one-man commerce
    },
    features: {
      oneManCommerce: true,
      multiVendor: false,
      modernStorefront: true,
      mobileAppBuildIncluded: true,
      customBranding: true,
      productCatalogSetup: true,
      contactAndAboutPages: true,
      mobileFriendlyFastLoading: true,
      basicSeo: true,
      adminDashboard: true, // manage products, orders, customers
      onlinePaymentGateway: true, // Mobile Money, Card, Bank
      bulkProductImport: false,
      blogNewsSection: false,
      marketingNewsletterPromo: false,
      analyticsTracking: false,
      customDomainSetup: true,
      socialMediaIntegration: true,
      apiIntegrationsErpPos: false,
      exclusiveSourceCodeLicense: false,
      allowedPaymentGateways: ["mobile_money", "card", "bank", "paystack", "flutterwave", "stripe"],
    },
    envFlags: {
      VITE_PACKAGE_TIER: "professional",
      VITE_MAX_PRODUCTS: "100",
      VITE_FEATURE_PAYMENTS: "true",
      VITE_FEATURE_ADMIN_DASHBOARD: "true",
      VITE_FEATURE_MOBILE_BUILD: "true",
      VITE_FEATURE_BULK_IMPORT: "false",
      VITE_FEATURE_BLOG: "false",
      VITE_FEATURE_MARKETING_TOOLS: "false",
      VITE_FEATURE_ANALYTICS: "false",
      PACKAGE_TIER: "professional",
    },
    clientWatermarkRequired: false,
  },

  premium: {
    id: "premium",
    name: "PREMIUM - Your Brand. Fully Customized.",
    badge: "Premium",
    priceRangeGHS: "GH₵ 7,000 – 12,000+",
    paymentType: "One-time payment",
    targetAudience: "Best for businesses that want a unique look, advanced features, and full setup including deployment and training.",
    licenseFile: "LICENSE-MANAGED-HOSTED.md",
    supportDuration: "6 months support",
    allowedWorkspaces: [
      "@workspace/api-server",
      "@workspace/luxe-boutique",
      "@workspace/luxe-boutique-admin",
      "@workspace/luxe-boutique-mobile",
      "@workspace/db",
      "@workspace/api-zod",
      "@workspace/api-client-react",
      "@workspace/api-spec",
    ],
    restrictedWorkspaces: [],
    limits: {
      maxProducts: 1000,
      maxTenants: 1, // Single-store one-man commerce
    },
    features: {
      oneManCommerce: true,
      multiVendor: false,
      modernStorefront: true,
      mobileAppBuildIncluded: true,
      customBranding: true,
      productCatalogSetup: true,
      contactAndAboutPages: true,
      mobileFriendlyFastLoading: true,
      basicSeo: true,
      adminDashboard: true,
      onlinePaymentGateway: true,
      advancedPaymentsPaypal: true, // Mobile Money, Card, Bank, PayPal*
      bulkProductImport: true, // Product import (bulk upload)
      blogNewsSection: true, // Blog / news section
      marketingNewsletterPromo: true, // Marketing tools (newsletter, promo banners)
      analyticsTracking: true, // Analytics & performance tracking
      customDomainSetup: true,
      socialMediaIntegration: true,
      deploymentAndTraining: true, // Deployment on your domain & hosting, training
      apiIntegrationsErpPos: false,
      exclusiveSourceCodeLicense: false,
      allowedPaymentGateways: ["mobile_money", "card", "bank", "paypal", "paystack", "flutterwave", "stripe"],
    },
    envFlags: {
      VITE_PACKAGE_TIER: "premium",
      VITE_MAX_PRODUCTS: "1000",
      VITE_FEATURE_PAYMENTS: "true",
      VITE_FEATURE_ADMIN_DASHBOARD: "true",
      VITE_FEATURE_MOBILE_BUILD: "true",
      VITE_FEATURE_BULK_IMPORT: "true",
      VITE_FEATURE_BLOG: "true",
      VITE_FEATURE_MARKETING_TOOLS: "true",
      VITE_FEATURE_ANALYTICS: "true",
      PACKAGE_TIER: "premium",
    },
    clientWatermarkRequired: false,
  },

  custom_exclusive: {
    id: "custom_exclusive",
    name: "CUSTOM / EXCLUSIVE - Built Around Your Needs",
    badge: "Custom / Exclusive",
    priceRangeGHS: "GH₵ 15,000+",
    paymentType: "One-time payment (Negotiable based on your needs)",
    targetAudience: "For businesses that need special features, advanced integrations, or full ownership of the source code.",
    licenseFile: "LICENSE-EXCLUSIVE-SOURCE-CODE.md",
    supportDuration: "Priority support & maintenance",
    allowedWorkspaces: [
      "@workspace/api-server",
      "@workspace/luxe-boutique",
      "@workspace/luxe-boutique-admin",
      "@workspace/luxe-boutique-mobile",
      "@workspace/db",
      "@workspace/api-zod",
      "@workspace/api-client-react",
      "@workspace/api-spec",
    ],
    restrictedWorkspaces: [],
    limits: {
      maxProducts: 999999,
      maxTenants: 1, // Single-store one-man commerce with optional bespoke expansions
    },
    features: {
      oneManCommerce: true,
      multiVendor: false, // Default is single-store one-man commerce; custom extensions on demand
      modernStorefront: true,
      mobileAppBuildIncluded: true,
      customBranding: true,
      productCatalogSetup: true,
      contactAndAboutPages: true,
      mobileFriendlyFastLoading: true,
      basicSeo: true,
      adminDashboard: true,
      onlinePaymentGateway: true,
      advancedPaymentsPaypal: true,
      bulkProductImport: true,
      blogNewsSection: true,
      marketingNewsletterPromo: true,
      analyticsTracking: true,
      customDomainSetup: true,
      socialMediaIntegration: true,
      deploymentAndTraining: true,
      apiIntegrationsErpPos: true, // API integrations (e.g. ERP, POS, etc.)
      exclusiveSourceCodeLicense: true, // Exclusive source code license (optional / included)
      personalizedTrainingAndDocs: true,
      allowedPaymentGateways: ["*"],
    },
    envFlags: {
      VITE_PACKAGE_TIER: "custom_exclusive",
      VITE_MAX_PRODUCTS: "unlimited",
      VITE_FEATURE_PAYMENTS: "true",
      VITE_FEATURE_ADMIN_DASHBOARD: "true",
      VITE_FEATURE_MOBILE_BUILD: "true",
      VITE_FEATURE_BULK_IMPORT: "true",
      VITE_FEATURE_BLOG: "true",
      VITE_FEATURE_MARKETING_TOOLS: "true",
      VITE_FEATURE_ANALYTICS: "true",
      VITE_FEATURE_API_INTEGRATIONS: "true",
      PACKAGE_TIER: "custom_exclusive",
    },
    clientWatermarkRequired: false,
  },
};

/**
 * Validates a tier name and returns its normalized configuration
 */
export function resolveTier(tierInput = "basic") {
  const normalized = String(tierInput).trim().toLowerCase().replace(/[-\s]/g, "_");
  // Backward compatibility aliases
  const aliasMap = {
    standard: "basic",
    managed_hosted: "premium",
    enterprise_exclusive: "custom_exclusive",
    custom: "custom_exclusive",
    pro: "professional",
  };
  const resolvedKey = aliasMap[normalized] || normalized;

  const match = LICENSE_TIERS[resolvedKey];
  if (!match) {
    const validTiers = Object.keys(LICENSE_TIERS).join(", ");
    throw new Error(`Invalid package tier "${tierInput}". Valid tiers: ${validTiers}`);
  }
  return match;
}

/**
 * Generates an integrity verification fingerprint for a build
 */
export function generateTierFingerprint(tierConfig, metadata = {}) {
  const payload = JSON.stringify({
    tierId: tierConfig.id,
    tierName: tierConfig.name,
    priceRangeGHS: tierConfig.priceRangeGHS,
    limits: tierConfig.limits,
    features: tierConfig.features,
    metadata,
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}
