import { useEffect } from "react";

export interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  type?: "website" | "article" | "product";
  url?: string;
  jsonLd?: Record<string, any>;
}

export function SEO({
  title = "LUXE BOUTIQUE | Luxury Fashion & Haute Couture",
  description = "Discover the ultimate curated luxury fashion collection. Shop designer apparel, fine accessories, handcrafted leather goods, and exclusive haute couture.",
  image = "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop",
  type = "website",
  url,
  jsonLd,
}: SEOProps) {
  useEffect(() => {
    // 1. Update Document Title
    const fullTitle = title.includes("LUXE BOUTIQUE") ? title : `${title} | LUXE BOUTIQUE`;
    document.title = fullTitle;

    // 2. Helper to set or create meta tag
    const setMetaTag = (selector: string, attrName: string, attrVal: string, content: string) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    const pageUrl = url || window.location.href;

    // Standard Meta Tags
    setMetaTag('meta[name="description"]', 'name', 'description', description);

    // OpenGraph Meta Tags
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
    setMetaTag('meta[property="og:image"]', 'property', 'og:image', image);
    setMetaTag('meta[property="og:type"]', 'property', 'og:type', type);
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', pageUrl);
    setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', 'LUXE BOUTIQUE');

    // Twitter Card Meta Tags
    setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', image);

    // 3. Dynamic JSON-LD Structured Data
    const scriptId = "seo-json-ld-script";
    let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement("script");
      scriptEl.id = scriptId;
      scriptEl.type = "application/ld+json";
      document.head.appendChild(scriptEl);
    }

    const defaultJsonLd = jsonLd || {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "LUXE BOUTIQUE",
      url: window.location.origin,
      logo: `${window.location.origin}/favicon.svg`,
      description,
      sameAs: [
        "https://instagram.com",
        "https://facebook.com",
        "https://pinterest.com",
      ],
    };

    scriptEl.textContent = JSON.stringify(defaultJsonLd);
  }, [title, description, image, type, url, jsonLd]);

  return null;
}
