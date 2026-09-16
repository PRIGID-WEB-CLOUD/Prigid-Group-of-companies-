import React, { createContext, useContext, useState, useEffect } from "react";
import { extractTenantFromHost, validateTenantSlug } from "@workspace/tenant-routing";

export interface StoreBranding {
  store_id: string;
  store_slug: string;
  store_name: string;
  brand_logo_text: string;
  brand_tagline: string;
  store_currency: string;
  brand_primary_color: string;
  brand_bg_color: string;
  brand_typography: string;
  brand_hero_headline: string;
  brand_hero_subheadline: string;
  brand_hero_image: string;
  brand_valet_instructions?: string;
  brand_hospitality_notes?: string;
  isPublished: boolean;
  isAdmin: boolean;
}

const DEFAULT_BRANDING: StoreBranding = {
  store_id: "store-001",
  store_slug: "luxe-boutique",
  store_name: "Luxe Boutique Ateliers",
  brand_logo_text: "LUXE",
  brand_tagline: "Flagship Luxury Fashion, Objects & Decor",
  store_currency: "USD",
  brand_primary_color: "#006c49",
  brand_bg_color: "#0f172a",
  brand_typography: "'Playfair Display', Georgia, serif",
  brand_hero_headline: "Architectural <br /><span class=\"italic font-light\">Elegance</span>",
  brand_hero_subheadline: "Discover our latest release: A study in precision tailoring, fine leathercraft, and sculptural decor.",
  brand_hero_image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop",
  brand_valet_instructions: "Complimentary valet parking is available at the main entrance.",
  brand_hospitality_notes: "Enjoy our signature champagne service upon your arrival.",
  isPublished: true,
  isAdmin: false,
};

interface BrandingContextType {
  branding: StoreBranding;
  activeSlug: string | null;
  isLoading: boolean;
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType>({
  branding: DEFAULT_BRANDING,
  activeSlug: null,
  isLoading: false,
  refreshBranding: async () => {},
});

export function getActiveStoreSlug(): string | null {
  if (typeof window === "undefined") return null;
  const hostInfo = extractTenantFromHost(window.location.host);
  if (hostInfo.type === "subdomain" && hostInfo.slug && validateTenantSlug(hostInfo.slug)) {
    return hostInfo.slug;
  }
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("store") && validateTenantSlug(urlParams.get("store")!)) {
    return urlParams.get("store");
  }
  const match = window.location.pathname.match(/^\/(?:boutique|store)\/([a-zA-Z0-9_-]+)/);
  if (match && match[1] && validateTenantSlug(match[1])) return match[1];
  return null;
}

function hexToHslSpace(hex: string): string {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map(c => c + c).join("");
  }
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<StoreBranding>(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const fetchBranding = async () => {
    try {
      const slug = getActiveStoreSlug();
      setActiveSlug(slug);
      if (slug) {
        document.cookie = `prigid_store_slug=${slug}; path=/; max-age=86400; SameSite=Lax`;
      }
      const query = slug ? `?store=${encodeURIComponent(slug)}` : "";
      const res = await fetch(`/api/store/branding${query}`);
      if (res.ok) {
        const data = await res.json();
        const merged: StoreBranding = {
          ...DEFAULT_BRANDING,
          ...data,
        };
        setBranding(merged);

        if (merged.store_name) {
          document.title = merged.store_name;
        }
        if (merged.brand_primary_color) {
          document.documentElement.style.setProperty("--color-primary", merged.brand_primary_color);
          try {
            const hsl = hexToHslSpace(merged.brand_primary_color);
            document.documentElement.style.setProperty("--primary", hsl);
          } catch (e) {
            console.error("Failed to parse branding HSL:", e);
          }
        }
        if (merged.brand_typography) {
          document.documentElement.style.setProperty("--app-font-serif", merged.brand_typography);
        }
      }
    } catch (err) {
      console.error("[BrandingProvider] Error fetching branding:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, activeSlug, isLoading, refreshBranding: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
