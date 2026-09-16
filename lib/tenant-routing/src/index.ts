/**
 * @workspace/tenant-routing
 * Centralized tenant URL generation, subdomain extraction, and routing utilities
 * for multi-tenant e-commerce SaaS platforms.
 */

declare const process: any;
declare const window: any;

export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "platform",
  "app",
  "admin",
  "seller",
  "api",
  "mail",
  "email",
  "cdn",
  "assets",
  "static",
  "status",
  "auth",
  "login",
  "billing",
  "staging",
  "dev",
  "test",
  "demo",
]);

export interface TenantHostInfo {
  type: "subdomain" | "custom_domain" | "master" | "invalid";
  slug?: string;
  domain?: string;
  isMaster: boolean;
  isSubdomain: boolean;
  isCustomDomain: boolean;
}

export interface BuildTenantUrlOptions {
  slug?: string | null;
  customDomain?: string | null;
  path?: string;
  protocol?: string;
}

/**
 * Validates whether a given string is a secure and valid DNS subdomain label / tenant slug.
 */
export function validateTenantSlug(slug: string | null | undefined): boolean {
  if (!slug || typeof slug !== "string") return false;
  const trimmed = slug.trim().toLowerCase();
  if (trimmed.length < 1 || trimmed.length > 63) return false;
  if (RESERVED_SUBDOMAINS.has(trimmed)) return false;
  // RFC 1035 / RFC 1123 label: lowercase alphanumeric and hyphens, no start/end hyphen
  const regex = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  return regex.test(trimmed);
}

/**
 * Sanitizes a raw input into a safe tenant slug format.
 */
export function sanitizeTenantSlug(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

/**
 * Normalizes host strings by stripping protocol and port.
 */
export function normalizeHostname(host: string): string {
  if (!host) return "";
  let clean = host.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, "");
  clean = clean.split("/")[0];
  clean = clean.split(":")[0];
  return clean;
}

/**
 * Extracts port from host string if present.
 */
export function extractPort(host: string): string | null {
  if (!host) return null;
  const parts = host.trim().replace(/^https?:\/\//, "").split("/")[0].split(":");
  return parts.length > 1 ? parts[1] : null;
}

/**
 * Detects the master base domain for a given host or environment.
 */
export function detectMasterDomain(currentHost?: string | null): string {
  if (currentHost) {
    const clean = normalizeHostname(currentHost);
    
    // Check if running on Google Cloud Run preview domain
    if (clean.endsWith(".run.app")) {
      const match = clean.match(/(?:^|\.)([a-z0-9-]+(?:\.[a-z0-9-]+)?\.run\.app)$/);
      if (match && match[1]) {
        // e.g. ais-dev-xxx.europe-west3.run.app
        const parts = clean.split(".");
        // If host is <slug>.ais-dev-xxx.europe-west3.run.app (5 parts)
        // Base is ais-dev-xxx.europe-west3.run.app (4 parts)
        if (parts.length >= 4 && parts[parts.length - 2] === "europe-west3") {
          return parts.slice(-4).join(".");
        }
        if (parts.length >= 3) {
          return parts.slice(-3).join(".");
        }
      }
    }

    if (clean.endsWith(".aistudio.app")) {
      const parts = clean.split(".");
      return parts.slice(-3).join(".");
    }

    if (clean.endsWith(".localhost") || clean === "localhost" || clean.startsWith("127.0.0.1")) {
      return "localhost";
    }

    if (clean.endsWith("prigidcommerce.com")) {
      return "prigidcommerce.com";
    }
  }

  if (typeof process !== "undefined" && process.env) {
    if (process.env.MASTER_DOMAIN) return process.env.MASTER_DOMAIN.trim().toLowerCase();
    const appUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL;
    if (appUrl) {
      try {
        const parsed = new URL(appUrl.startsWith("http") ? appUrl : `https://${appUrl}`);
        return detectMasterDomain(parsed.hostname);
      } catch {
        // fallback
      }
    }
  }

  return "prigidcommerce.com";
}

/**
 * Extracts tenant identification information from an incoming hostname.
 */
export function extractTenantFromHost(host: string | null | undefined, masterDomainOverride?: string): TenantHostInfo {
  if (!host) {
    return {
      type: "master",
      isMaster: true,
      isSubdomain: false,
      isCustomDomain: false,
    };
  }

  const cleanHost = normalizeHostname(host);
  const masterDomain = masterDomainOverride ? normalizeHostname(masterDomainOverride) : detectMasterDomain(cleanHost);

  // 1. Check exact match with master domain or localhost
  if (cleanHost === masterDomain || cleanHost === "localhost" || cleanHost === "127.0.0.1") {
    return {
      type: "master",
      isMaster: true,
      isSubdomain: false,
      isCustomDomain: false,
    };
  }

  // 2. Check if cleanHost is a subdomain of masterDomain
  // e.g. "atelier-celeste.prigidcommerce.com", "atelier-celeste.ais-dev-xxx.run.app", "atelier-celeste.localhost"
  const isMasterSubdomain = cleanHost.endsWith(`.${masterDomain}`);
  if (isMasterSubdomain) {
    const prefix = cleanHost.slice(0, cleanHost.length - masterDomain.length - 1);
    // prefix might be "atelier-celeste" or nested like "sub.atelier-celeste"
    const subParts = prefix.split(".");
    const candidateSlug = subParts[subParts.length - 1]; // Closest prefix label to master domain

    if (RESERVED_SUBDOMAINS.has(candidateSlug)) {
      return {
        type: "master",
        isMaster: true,
        isSubdomain: false,
        isCustomDomain: false,
      };
    }

    if (!validateTenantSlug(candidateSlug)) {
      return {
        type: "invalid",
        slug: candidateSlug,
        isMaster: false,
        isSubdomain: false,
        isCustomDomain: false,
      };
    }

    return {
      type: "subdomain",
      slug: candidateSlug,
      isMaster: false,
      isSubdomain: true,
      isCustomDomain: false,
    };
  }

  // 3. If it does not match masterDomain, treat as potential custom domain (e.g. "www.atelierceleste.com", "moretti.it")
  return {
    type: "custom_domain",
    domain: cleanHost,
    isMaster: false,
    isSubdomain: false,
    isCustomDomain: true,
  };
}

/**
 * Builds the canonical public URL for a tenant storefront.
 */
export function buildTenantUrl(
  options: BuildTenantUrlOptions,
  currentHostContext?: string | null
): string {
  const { slug, customDomain, path = "/" } = options;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // If custom domain is specified and non-empty, use it directly
  if (customDomain && customDomain.trim()) {
    const rawDomain = customDomain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    const proto = options.protocol || "https";
    return `${proto}://${rawDomain}${cleanPath === "/" ? "" : cleanPath}`;
  }

  if (!slug || !validateTenantSlug(slug)) {
    // If no valid slug, return master platform path
    return cleanPath;
  }

  const cleanSlug = slug.trim().toLowerCase();

  // In browser environment, check window.location
  let contextHost = currentHostContext;
  if (!contextHost && typeof window !== "undefined" && window.location) {
    contextHost = window.location.host;
  }

  const masterDomain = detectMasterDomain(contextHost);
  const port = contextHost ? extractPort(contextHost) : null;
  const portSuffix = port && (masterDomain === "localhost" || contextHost?.includes("localhost")) ? `:${port}` : "";

  // Determine protocol
  let protocol = options.protocol;
  if (!protocol) {
    if (typeof window !== "undefined" && window.location && window.location.protocol) {
      protocol = window.location.protocol.replace(":", "");
    } else if (masterDomain === "localhost") {
      protocol = "http";
    } else {
      protocol = "https";
    }
  }

  return `${protocol}://${cleanSlug}.${masterDomain}${portSuffix}${cleanPath === "/" ? "" : cleanPath}`;
}

/**
 * Builds a URL pointing to the SaaS master platform (landing, seller portal, auth, etc.).
 */
export function buildMasterPlatformUrl(
  path: string = "/",
  currentHostContext?: string | null,
  protocolOverride?: string
): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  let contextHost = currentHostContext;
  if (!contextHost && typeof window !== "undefined" && window.location) {
    contextHost = window.location.host;
  }

  const masterDomain = detectMasterDomain(contextHost);
  const port = contextHost ? extractPort(contextHost) : null;
  const portSuffix = port && (masterDomain === "localhost" || contextHost?.includes("localhost")) ? `:${port}` : "";

  let protocol = protocolOverride;
  if (!protocol) {
    if (typeof window !== "undefined" && window.location && window.location.protocol) {
      protocol = window.location.protocol.replace(":", "");
    } else if (masterDomain === "localhost") {
      protocol = "http";
    } else {
      protocol = "https";
    }
  }

  return `${protocol}://${masterDomain}${portSuffix}${cleanPath === "/" ? "" : cleanPath}`;
}
