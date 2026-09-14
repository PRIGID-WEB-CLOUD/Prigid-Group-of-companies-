import { Router, type Request, type Response } from "express";
import { db, storesTable } from "@workspace/db";

const router = Router();

const BOUTIQUE_PROFILES: Record<string, {
  tagline: string;
  category: string;
  categoryKey: string;
  location: string;
  heroImage: string;
  badge: string;
  highlights: string[];
  rating: number;
  established: string;
}> = {
  "luxe-boutique": {
    tagline: "Haute Couture & Handcrafted Grade-A Mongolian Cashmere",
    category: "Haute Couture & RTW",
    categoryKey: "couture",
    location: "New York • 5th Avenue Flagship",
    heroImage: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?q=80&w=987&auto=format&fit=crop",
    badge: "Flagship Maison",
    highlights: ["Grade-A Cashmere", "Bespoke Tailoring", "White-Glove Valet"],
    rating: 4.99,
    established: "Est. 2018",
  },
  "maison-moretti": {
    tagline: "Artisanal Tuscan Leather Goods & Goodyear Welted Footwear",
    category: "Leather Goods & Footwear",
    categoryKey: "leather",
    location: "Milano, Italy • Via Montenapoleone",
    heroImage: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=2070&auto=format&fit=crop",
    badge: "Heritage Leather",
    highlights: ["Full-Grain Alligator", "Hand-Lasted", "Tuscan Vegetable Tanned"],
    rating: 4.97,
    established: "Est. 1974",
  },
  "aurelia-jewels": {
    tagline: "High Jewellery, Rare Coloured Gemstones & Bespoke Platinum",
    category: "Fine Jewellery & Gems",
    categoryKey: "jewels",
    location: "Paris, France • Place Vendôme",
    heroImage: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=1200&auto=format&fit=crop",
    badge: "High Joaillerie",
    highlights: ["Ethical Diamonds", "Custom Settings", "GIA Certified"],
    rating: 5.0,
    established: "Est. 1928",
  },
  "kurogane": {
    tagline: "Master Chronometry & Hand-Finished Titanium Horology",
    category: "Horology & Timepieces",
    categoryKey: "horology",
    location: "Kyoto & Geneva • Independent Master",
    heroImage: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=1200&auto=format&fit=crop",
    badge: "Independent Horology",
    highlights: ["In-House Calibre", "Urushi Dial", "COSC Certified"],
    rating: 4.98,
    established: "Est. 1992",
  },
  "atelier-celeste": {
    tagline: "Mulberry Silk Charmeuse, Eveningwear & Delicate Knits",
    category: "Silk & Eveningwear",
    categoryKey: "silk",
    location: "London, UK • Mayfair Atelier",
    heroImage: "https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?q=80&w=987&auto=format&fit=crop",
    badge: "Couture Atelier",
    highlights: ["100% Mulberry Silk", "Hand-Draped", "Limited Edition Drops"],
    rating: 4.95,
    established: "Est. 2015",
  },
};

const DEFAULT_PROFILE = {
  tagline: "Curated Independent Luxury Collection",
  category: "Luxury Atelier",
  categoryKey: "all",
  location: "Global Atelier",
  heroImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop",
  badge: "Verified Merchant",
  highlights: ["Curated Collection", "Insured Shipping", "Concierge Support"],
  rating: 4.95,
  established: "Est. 2024",
};

router.get("/marketplace/stores", async (_req: Request, res: Response) => {
  try {
    const stores = await db.select().from(storesTable);
    const publishedStores = stores.filter((s: any) =>
      (s.publishStatus === "PUBLISHED" || s.isPublished === true) &&
      s.status !== "suspended" &&
      s.publishStatus !== "SUSPENDED"
    );

    const enriched = publishedStores.map((store: any) => {
      const profile = BOUTIQUE_PROFILES[store.slug] || {
        ...DEFAULT_PROFILE,
        tagline: `${store.name} — Curated Luxury Collection`,
      };

      return {
        id: store.id,
        name: store.name,
        slug: store.slug,
        planTier: store.planTier,
        currency: store.currency || "USD",
        customDomain: store.customDomain || null,
        isPublished: true,
        tagline: profile.tagline,
        category: profile.category,
        categoryKey: profile.categoryKey,
        location: profile.location,
        heroImage: profile.heroImage,
        badge: profile.badge,
        highlights: profile.highlights,
        rating: profile.rating,
        established: profile.established,
        storeUrl: `/boutique/${store.slug}`,
      };
    });

    return res.json({
      success: true,
      count: enriched.length,
      stores: enriched,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to load marketplace stores" });
  }
});

router.get("/marketplace/stats", async (_req: Request, res: Response) => {
  try {
    const stores = await db.select().from(storesTable);
    const published = stores.filter((s: any) =>
      (s.publishStatus === "PUBLISHED" || s.isPublished === true) &&
      s.status !== "suspended"
    );

    return res.json({
      success: true,
      stats: {
        totalMaisons: Math.max(published.length, 5),
        handcraftedPieces: 148,
        deliveryCountries: 74,
        clientSatisfaction: "99.4%",
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to load stats" });
  }
});

export default router;
