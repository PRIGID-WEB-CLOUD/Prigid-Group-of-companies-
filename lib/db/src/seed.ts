import { db, pool } from "./index";
import {
  categoriesTable, productsTable, productVariantsTable, reviewsTable, ordersTable, usersTable,
  facebookPostTemplatesTable, twitterContentTemplatesTable, whatsappTemplatesTable,
  whatsappJourneysTable, whatsappOptinSettingsTable,
  facebookConnectionsTable, facebookPixelEventsTable, facebookAudiencesTable,
  storesTable,
} from "./schema";

function simpleHash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return String(h >>> 0);
}

export async function seed() {
  // ── Stores (Luxury Independent Maisons) ────────────────────────────────────
  await db.insert(storesTable).values([
    {
      id: "store-001",
      slug: "luxe-boutique",
      name: "Luxe Boutique Ateliers",
      planTier: "enterprise",
      status: "active",
      isPublished: true,
      publishStatus: "PUBLISHED",
      publishableKey: "pk_live_luxeboutique_001",
      secretKeyHash: simpleHash("sk_live_luxeboutique_001"),
      currency: "USD",
      customDomain: "maison.luxeboutique.com",
    },
    {
      id: "store-002",
      slug: "maison-moretti",
      name: "Maison Moretti Milano",
      planTier: "growth",
      status: "active",
      isPublished: true,
      publishStatus: "PUBLISHED",
      publishableKey: "pk_live_moretti_002",
      secretKeyHash: simpleHash("sk_live_moretti_002"),
      currency: "EUR",
      customDomain: "moretti.it",
    },
    {
      id: "store-003",
      slug: "aurelia-jewels",
      name: "Aurelia Haute Joaillerie",
      planTier: "enterprise",
      status: "active",
      isPublished: true,
      publishStatus: "PUBLISHED",
      publishableKey: "pk_live_aurelia_003",
      secretKeyHash: simpleHash("sk_live_aurelia_003"),
      currency: "USD",
      customDomain: "aurelia-paris.com",
    },
    {
      id: "store-004",
      slug: "kurogane",
      name: "Kurogane Horology",
      planTier: "growth",
      status: "active",
      isPublished: true,
      publishStatus: "PUBLISHED",
      publishableKey: "pk_live_kurogane_004",
      secretKeyHash: simpleHash("sk_live_kurogane_004"),
      currency: "USD",
      customDomain: "kurogane-watches.ch",
    },
    {
      id: "store-005",
      slug: "atelier-celeste",
      name: "Atelier Céleste",
      planTier: "starter",
      status: "active",
      isPublished: true,
      publishStatus: "PUBLISHED",
      publishableKey: "pk_live_celeste_005",
      secretKeyHash: simpleHash("sk_live_celeste_005"),
      currency: "GBP",
      customDomain: "atelierceleste.co.uk",
    },
  ]).onConflictDoNothing();
  console.log("✓ stores");
  // ── Categories ──────────────────────────────────────────────────────────────
  await db.insert(categoriesTable).values([
    { id: "cat-rtw",  name: "Ready-to-Wear", slug: "ready-to-wear", description: "Seasonal clothing collections." },
    { id: "cat-acc",  name: "Accessories",   slug: "accessories",   description: "Bags, belts, scarves and more." },
    { id: "cat-foot", name: "Footwear",      slug: "footwear",      description: "Handcrafted shoes and boots." },
    { id: "cat-fine", name: "Fine Jewellery",slug: "fine-jewellery",description: "Precious stones and metals." },
    { id: "cat-home", name: "Maison",        slug: "maison",        description: "Luxury homeware and objects." },
  ]).onConflictDoNothing();
  console.log("✓ categories");

  // ── Products ─────────────────────────────────────────────────────────────────
  // Fixed IDs so re-running is idempotent (onConflictDoNothing)
  const now = Date.now();
  await db.insert(productsTable).values([
    // ── New Arrivals (shown first on homepage) ──
    {
      id: "prod-001", name: "Cashmere Overcoat", price: 1850, categoryId: "cat-rtw", stock: 12,
      imageUrl: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?q=80&w=987&auto=format&fit=crop",
      description: "Crafted from Grade-A Mongolian cashmere.", tags: "cashmere,coat,winter",
      createdAt: new Date(now - 86400000 * 10),
    },
    {
      id: "prod-002", name: "Silk Charmeuse Blouse", price: 620, categoryId: "cat-rtw", stock: 28,
      imageUrl: "https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?q=80&w=987&auto=format&fit=crop",
      description: "Hand-finished silk charmeuse, ivory.", tags: "silk,blouse",
      createdAt: new Date(now - 86400000 * 8),
    },
    {
      id: "prod-003", name: "Alligator Derby Shoes", price: 3400, categoryId: "cat-foot", stock: 3,
      imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=2070&auto=format&fit=crop",
      description: "Full-grain alligator leather, hand-lasted.", tags: "shoes,leather",
      createdAt: new Date(now - 86400000 * 5),
    },
    {
      id: "prod-004", name: "Gold-Clasp Evening Bag", price: 980, categoryId: "cat-acc", stock: 15,
      imageUrl: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?q=80&w=2069&auto=format&fit=crop",
      description: "18k gold-plated clasp, satin lining.", tags: "bag,evening",
      createdAt: new Date(now - 86400000 * 3),
    },
    {
      id: "prod-005", name: "Merino Turtleneck", price: 290, categoryId: "cat-rtw", stock: 40,
      imageUrl: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?q=80&w=1964&auto=format&fit=crop",
      description: "Extra-fine 18.5-micron merino.", tags: "merino,knitwear",
      createdAt: new Date(now - 86400000 * 1),
    },
    {
      id: "prod-006", name: "Wide-Brim Felt Hat", price: 420, categoryId: "cat-acc", stock: 22,
      imageUrl: "https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?q=80&w=987&auto=format&fit=crop",
      description: "Italian felt, hand-shaped brim and grosgrain ribbon.", tags: "hat,accessories",
      createdAt: new Date(now - 86400000 * 0.5),
    },
    // ── Trending Now (shown in second product row) ──
    {
      id: "prod-007", name: "Leather Trench Coat", price: 2200, categoryId: "cat-rtw", stock: 8,
      imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=1036&auto=format&fit=crop",
      description: "Butter-soft lambskin, fully lined in silk.", tags: "leather,coat",
      createdAt: new Date(now - 86400000 * 14),
    },
    {
      id: "prod-008", name: "Diamond Tennis Bracelet", price: 5800, categoryId: "cat-fine", stock: 5,
      imageUrl: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=2070&auto=format&fit=crop",
      description: "2.4ct total weight, VS1 clarity, 18k white gold.", tags: "jewellery,diamond",
      createdAt: new Date(now - 86400000 * 12),
    },
    {
      id: "prod-009", name: "Suede Chelsea Boots", price: 890, categoryId: "cat-foot", stock: 18,
      imageUrl: "https://images.unsplash.com/photo-1638247025967-b4e38f787b76?q=80&w=987&auto=format&fit=crop",
      description: "Premium Spanish suede, leather-lined, Goodyear welt.", tags: "boots,suede",
      createdAt: new Date(now - 86400000 * 9),
    },
    {
      id: "prod-010", name: "Linen Blazer", price: 740, categoryId: "cat-rtw", stock: 20,
      imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4b4e27?q=80&w=2080&auto=format&fit=crop",
      description: "Unstructured Belgian linen in oatmeal.", tags: "blazer,linen,summer",
      createdAt: new Date(now - 86400000 * 6),
    },
    {
      id: "prod-011", name: "Silk Scarf — Botanical", price: 310, categoryId: "cat-acc", stock: 35,
      imageUrl: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?q=80&w=2070&auto=format&fit=crop",
      description: "Hand-rolled edges, 100% Mulberry silk, original print.", tags: "scarf,silk",
      createdAt: new Date(now - 86400000 * 4),
    },
    // ── Maison (Luxury Homeware & Living) ──
    {
      id: "prod-012", name: "Marble & Brass Candelabra", price: 490, categoryId: "cat-home", stock: 14,
      imageUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=2070&auto=format&fit=crop",
      description: "Hand-carved Carrara marble with solid brushed brass candle sockets. An architectural accent for bespoke dining tables.",
      tags: "maison,decor,marble,lighting",
      createdAt: new Date(now - 86400000 * 11),
    },
    {
      id: "prod-013", name: "Cashmere Throw Blanket — Slate", price: 780, categoryId: "cat-home", stock: 20,
      imageUrl: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?q=80&w=1974&auto=format&fit=crop",
      description: "Sumptuously soft 100% Mongolian cashmere woven in a refined herringbone pattern with subtle fringed edges.",
      tags: "maison,blanket,cashmere,home",
      createdAt: new Date(now - 86400000 * 9),
    },
    {
      id: "prod-014", name: "Hand-Blown Crystal Decanter", price: 380, categoryId: "cat-home", stock: 16,
      imageUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?q=80&w=2070&auto=format&fit=crop",
      description: "Artisanal hand-blown lead-free crystal decanter with ground glass geometric stopper. Designed for aerating vintage Bordeaux.",
      tags: "maison,crystal,tableware,bar",
      createdAt: new Date(now - 86400000 * 7),
    },
    {
      id: "prod-015", name: "Santal & Amber Scented Vessel Candle", price: 165, categoryId: "cat-home", stock: 45,
      imageUrl: "https://images.unsplash.com/photo-1603006905003-be475563bc59?q=80&w=1974&auto=format&fit=crop",
      description: "Custom soy wax blend housed in a hand-polished fluted ceramic vessel. Notes of Australian sandalwood, black amber, and cardamom.",
      tags: "maison,candle,fragrance",
      createdAt: new Date(now - 86400000 * 3),
    },
    // ── Fine Jewellery ──
    {
      id: "prod-016", name: "18k Gold Pavé Signet Ring", price: 2450, categoryId: "cat-fine", stock: 8,
      imageUrl: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=2070&auto=format&fit=crop",
      description: "Solid 18k yellow gold signet ring encrusted with brilliant-cut micro-pavé lab-certified diamonds (0.65ct total weight).",
      tags: "jewellery,gold,ring,diamonds",
      createdAt: new Date(now - 86400000 * 13),
    },
    {
      id: "prod-017", name: "Akoya Pearl Drop Earrings", price: 1650, categoryId: "cat-fine", stock: 10,
      imageUrl: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=1974&auto=format&fit=crop",
      description: "Select 8.5mm Japanese Akoya saltwater pearls with exceptional luster, suspended from handcrafted 18k white gold studs.",
      tags: "jewellery,pearls,earrings,gold",
      createdAt: new Date(now - 86400000 * 8),
    },
    {
      id: "prod-018", name: "Emerald Cut Sapphire Pendant", price: 4200, categoryId: "cat-fine", stock: 4,
      imageUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=1974&auto=format&fit=crop",
      description: "Untreated 2.1ct Ceylon blue sapphire in a four-prong platinum basket setting, hanging from a delicate 18-inch platinum chain.",
      tags: "jewellery,sapphire,necklace,platinum",
      createdAt: new Date(now - 86400000 * 5),
    },
    // ── Footwear ──
    {
      id: "prod-019", name: "Calfskin Monks Strap Shoes", price: 1150, categoryId: "cat-foot", stock: 12,
      imageUrl: "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?q=80&w=2060&auto=format&fit=crop",
      description: "Burnished French calf leather double monk strap shoes, Blake-stitched with bevelled leather waists and hand-painted soles.",
      tags: "footwear,shoes,leather,formal",
      createdAt: new Date(now - 86400000 * 10),
    },
    {
      id: "prod-020", name: "Strappy Satin Evening Stilettos", price: 960, categoryId: "cat-foot", stock: 15,
      imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?q=80&w=1980&auto=format&fit=crop",
      description: "Silk satin delicate crossover straps with an 85mm stiletto heel, cushioned Italian kidskin lining, and jewel buckle ornament.",
      tags: "footwear,heels,evening,shoes",
      createdAt: new Date(now - 86400000 * 6),
    },
    {
      id: "prod-021", name: "Minimalist Leather Court Sneaker", price: 590, categoryId: "cat-foot", stock: 25,
      imageUrl: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=1974&auto=format&fit=crop",
      description: "Full-grain nappa leather luxury low-top sneaker with Margom Italian rubber cupsole and calfskin lining.",
      tags: "footwear,sneakers,casual,leather",
      createdAt: new Date(now - 86400000 * 2),
    },
    // ── Accessories ──
    {
      id: "prod-022", name: "Grained Calf Leather Weekend Duffle", price: 2600, categoryId: "cat-acc", stock: 9,
      imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=1974&auto=format&fit=crop",
      description: "Spacious luxury travel duffle cut from supple pebbled full-grain calfskin with brushed palladium hardware and luggage tag.",
      tags: "accessories,bags,luggage,leather",
      createdAt: new Date(now - 86400000 * 12),
    },
    {
      id: "prod-023", name: "Hand-Stitched Alligator Cardholder", price: 520, categoryId: "cat-acc", stock: 22,
      imageUrl: "https://images.unsplash.com/photo-1627123424574-724758594e93?q=80&w=1974&auto=format&fit=crop",
      description: "Four card slots and central notes compartment crafted in authentic Louisiana alligator with hand-waxed saddler stitching.",
      tags: "accessories,leather,wallet,alligator",
      createdAt: new Date(now - 86400000 * 4),
    },
    {
      id: "prod-024", name: "Titanium Polarized Sunglasses", price: 680, categoryId: "cat-acc", stock: 18,
      imageUrl: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=1980&auto=format&fit=crop",
      description: "Ultralight Japanese beta-titanium aviator frames paired with Zeiss polarized mineral glass lenses in charcoal grey.",
      tags: "accessories,eyewear,sunglasses,titanium",
      createdAt: new Date(now - 86400000 * 1.5),
    },
    // ── Ready-to-Wear ──
    {
      id: "prod-025", name: "Double-Breasted Tuxedo Jacket", price: 2100, categoryId: "cat-rtw", stock: 11,
      imageUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=2071&auto=format&fit=crop",
      description: "Tailored in Biella from Super 150s wool with contrasting black silk grosgrain peak lapels and covered buttons.",
      tags: "ready-to-wear,tuxedo,suiting,formal",
      createdAt: new Date(now - 86400000 * 15),
    },
    {
      id: "prod-026", name: "Pleated Silk Chiffon Maxi Gown", price: 2850, categoryId: "cat-rtw", stock: 7,
      imageUrl: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?q=80&w=1908&auto=format&fit=crop",
      description: "Floor-length evening gown cut from lightweight accordion-pleated silk chiffon in emerald with deep V-neckline and open back.",
      tags: "ready-to-wear,evening,gown,silk",
      createdAt: new Date(now - 86400000 * 7.5),
    },
    {
      id: "prod-027", name: "Tailored Wool Flannel Trousers", price: 580, categoryId: "cat-rtw", stock: 24,
      imageUrl: "https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?q=80&w=1974&auto=format&fit=crop",
      description: "High-waisted double-pleated dress trousers in charcoal melange wool flannel with side adjusters and a relaxed drape.",
      tags: "ready-to-wear,trousers,wool,tailoring",
      createdAt: new Date(now - 86400000 * 2.5),
    },
  ]).onConflictDoNothing();
  console.log("✓ products");

  // ── Product Variants ───────────────────────────────────────────────────────
  await db.insert(productVariantsTable).values([
    // prod-001 Cashmere Overcoat
    { id: "var-001-s", productId: "prod-001", size: "38R", color: "Camel", stock: 3, price: 1850, sku: "COAT-CAMEL-38" },
    { id: "var-001-m", productId: "prod-001", size: "40R", color: "Camel", stock: 5, price: 1850, sku: "COAT-CAMEL-40" },
    { id: "var-001-l", productId: "prod-001", size: "42R", color: "Camel", stock: 4, price: 1850, sku: "COAT-CAMEL-42" },
    { id: "var-001-blk-m", productId: "prod-001", size: "40R", color: "Black", stock: 4, price: 1850, sku: "COAT-BLK-40" },

    // prod-002 Silk Charmeuse Blouse
    { id: "var-002-s", productId: "prod-002", size: "IT 38", color: "Ivory", stock: 8, price: 620, sku: "BLOUSE-IVR-38" },
    { id: "var-002-m", productId: "prod-002", size: "IT 40", color: "Ivory", stock: 12, price: 620, sku: "BLOUSE-IVR-40" },
    { id: "var-002-l", productId: "prod-002", size: "IT 42", color: "Ivory", stock: 8, price: 620, sku: "BLOUSE-IVR-42" },
    { id: "var-002-blk-m", productId: "prod-002", size: "IT 40", color: "Midnight Black", stock: 6, price: 620, sku: "BLOUSE-BLK-40" },

    // prod-003 Alligator Derby Shoes
    { id: "var-003-41", productId: "prod-003", size: "EU 41", color: "Mahogany Brown", stock: 1, price: 3400, sku: "DERBY-MAH-41" },
    { id: "var-003-42", productId: "prod-003", size: "EU 42", color: "Mahogany Brown", stock: 1, price: 3400, sku: "DERBY-MAH-42" },
    { id: "var-003-43", productId: "prod-003", size: "EU 43", color: "Nero Black", stock: 1, price: 3400, sku: "DERBY-NERO-43" },

    // prod-004 Gold-Clasp Evening Bag
    { id: "var-004-gold", productId: "prod-004", size: "Standard", color: "Gold & Black Satin", stock: 8, price: 980, sku: "BAG-GLD-STD" },
    { id: "var-004-emerald", productId: "prod-004", size: "Standard", color: "Emerald Satin", stock: 7, price: 980, sku: "BAG-EMR-STD" },

    // prod-005 Merino Turtleneck
    { id: "var-005-s", productId: "prod-005", size: "S", color: "Oatmeal", stock: 10, price: 290, sku: "TURTLE-OAT-S" },
    { id: "var-005-m", productId: "prod-005", size: "M", color: "Oatmeal", stock: 18, price: 290, sku: "TURTLE-OAT-M" },
    { id: "var-005-l", productId: "prod-005", size: "L", color: "Oatmeal", stock: 12, price: 290, sku: "TURTLE-OAT-L" },
    { id: "var-005-char-m", productId: "prod-005", size: "M", color: "Charcoal Grey", stock: 15, price: 290, sku: "TURTLE-CHR-M" },

    // prod-006 Wide-Brim Felt Hat
    { id: "var-006-s", productId: "prod-006", size: "56 cm", color: "Black Felt", stock: 8, price: 420, sku: "HAT-BLK-56" },
    { id: "var-006-m", productId: "prod-006", size: "58 cm", color: "Black Felt", stock: 10, price: 420, sku: "HAT-BLK-58" },
    { id: "var-006-camel", productId: "prod-006", size: "58 cm", color: "Camel Felt", stock: 4, price: 420, sku: "HAT-CAMEL-58" },

    // prod-007 Leather Trench Coat
    { id: "var-007-s", productId: "prod-007", size: "38R", color: "Nappa Black", stock: 3, price: 2200, sku: "TRNCH-BLK-38" },
    { id: "var-007-m", productId: "prod-007", size: "40R", color: "Nappa Black", stock: 3, price: 2200, sku: "TRNCH-BLK-40" },
    { id: "var-007-l", productId: "prod-007", size: "42R", color: "Espresso Leather", stock: 2, price: 2200, sku: "TRNCH-ESP-42" },

    // prod-008 Diamond Tennis Bracelet
    { id: "var-008-wg", productId: "prod-008", size: "7 inch", color: "18k White Gold", stock: 3, price: 5800, sku: "BRC-WG-7" },
    { id: "var-008-yg", productId: "prod-008", size: "7 inch", color: "18k Yellow Gold", stock: 2, price: 5800, sku: "BRC-YG-7" },

    // prod-009 Suede Chelsea Boots
    { id: "var-009-41", productId: "prod-009", size: "EU 41", color: "Espresso", stock: 4, price: 890, sku: "BOOT-ESP-41" },
    { id: "var-009-42", productId: "prod-009", size: "EU 42", color: "Espresso", stock: 8, price: 890, sku: "BOOT-ESP-42" },
    { id: "var-009-43", productId: "prod-009", size: "EU 43", color: "Espresso", stock: 6, price: 890, sku: "BOOT-ESP-43" },

    // prod-010 Linen Blazer
    { id: "var-010-38", productId: "prod-010", size: "38R", color: "Oatmeal Linen", stock: 6, price: 740, sku: "BLZ-OAT-38" },
    { id: "var-010-40", productId: "prod-010", size: "40R", color: "Oatmeal Linen", stock: 8, price: 740, sku: "BLZ-OAT-40" },
    { id: "var-010-navy", productId: "prod-010", size: "40R", color: "Navy Linen", stock: 6, price: 740, sku: "BLZ-NVY-40" },

    // prod-011 Silk Scarf Botanical
    { id: "var-011-std", productId: "prod-011", size: "90x90 cm", color: "Botanical Green", stock: 20, price: 310, sku: "SCRF-BOT-90" },
    { id: "var-011-ivory", productId: "prod-011", size: "90x90 cm", color: "Ivory Flora", stock: 15, price: 310, sku: "SCRF-IVR-90" },

    // prod-012 Marble Candelabra
    { id: "var-012-white", productId: "prod-012", size: "3-Branch", color: "Carrara White", stock: 8, price: 490, sku: "CAN-WHT-3" },
    { id: "var-012-black", productId: "prod-012", size: "3-Branch", color: "Nero Marquina", stock: 6, price: 490, sku: "CAN-BLK-3" },

    // prod-013 Cashmere Throw Blanket
    { id: "var-013-slate", productId: "prod-013", size: "150x200 cm", color: "Slate Grey", stock: 10, price: 780, sku: "THRW-SLT-150" },
    { id: "var-013-ivory", productId: "prod-013", size: "150x200 cm", color: "Ivory Cream", stock: 10, price: 780, sku: "THRW-IVR-150" },

    // prod-014 Crystal Decanter
    { id: "var-014-std", productId: "prod-014", size: "1.5 Liter", color: "Clear Crystal", stock: 16, price: 380, sku: "DEC-CLR-15" },

    // prod-015 Santal Candle
    { id: "var-015-med", productId: "prod-015", size: "300g", color: "Black Ceramic", stock: 25, price: 165, sku: "CNDL-BLK-300" },
    { id: "var-015-lrg", productId: "prod-015", size: "600g", color: "Fluted Ivory", stock: 20, price: 240, sku: "CNDL-IVR-600" },

    // prod-016 Gold Pave Signet Ring
    { id: "var-016-us7", productId: "prod-016", size: "US 7", color: "18k Yellow Gold", stock: 3, price: 2450, sku: "RNG-YG-7" },
    { id: "var-016-us9", productId: "prod-016", size: "US 9", color: "18k Yellow Gold", stock: 3, price: 2450, sku: "RNG-YG-9" },
    { id: "var-016-us11", productId: "prod-016", size: "US 11", color: "18k White Gold", stock: 2, price: 2450, sku: "RNG-WG-11" },

    // prod-017 Akoya Pearl Earrings
    { id: "var-017-wg", productId: "prod-017", size: "8.5 mm", color: "18k White Gold", stock: 6, price: 1650, sku: "EAR-WG-85" },
    { id: "var-017-yg", productId: "prod-017", size: "8.5 mm", color: "18k Yellow Gold", stock: 4, price: 1650, sku: "EAR-YG-85" },

    // prod-018 Sapphire Pendant
    { id: "var-018-plat", productId: "prod-018", size: "18 inch", color: "Platinum & Blue Sapphire", stock: 4, price: 4200, sku: "PND-PLAT-18" },

    // prod-019 Calfskin Monk Strap Shoes
    { id: "var-019-41", productId: "prod-019", size: "EU 41", color: "Burnished Tan", stock: 4, price: 1150, sku: "MNK-TAN-41" },
    { id: "var-019-42", productId: "prod-019", size: "EU 42", color: "Burnished Tan", stock: 5, price: 1150, sku: "MNK-TAN-42" },
    { id: "var-019-43", productId: "prod-019", size: "EU 43", color: "Nero Black", stock: 3, price: 1150, sku: "MNK-BLK-43" },

    // prod-020 Satin Evening Stilettos
    { id: "var-020-37", productId: "prod-020", size: "EU 37", color: "Midnight Black", stock: 5, price: 960, sku: "STL-BLK-37" },
    { id: "var-020-38", productId: "prod-020", size: "EU 38", color: "Midnight Black", stock: 6, price: 960, sku: "STL-BLK-38" },
    { id: "var-020-39", productId: "prod-020", size: "EU 39", color: "Emerald Silk", stock: 4, price: 960, sku: "STL-EMR-39" },

    // prod-021 Minimalist Court Sneaker
    { id: "var-021-41", productId: "prod-021", size: "EU 41", color: "Pure White", stock: 6, price: 590, sku: "SNK-WHT-41" },
    { id: "var-021-42", productId: "prod-021", size: "EU 42", color: "Pure White", stock: 10, price: 590, sku: "SNK-WHT-42" },
    { id: "var-021-43", productId: "prod-021", size: "EU 43", color: "Pure White", stock: 9, price: 590, sku: "SNK-WHT-43" },

    // prod-022 Weekend Duffle
    { id: "var-022-black", productId: "prod-022", size: "55 cm", color: "Pebbled Black", stock: 5, price: 2600, sku: "DFL-BLK-55" },
    { id: "var-022-cognac", productId: "prod-022", size: "55 cm", color: "Cognac Tan", stock: 4, price: 2600, sku: "DFL-COG-55" },

    // prod-023 Alligator Cardholder
    { id: "var-023-black", productId: "prod-023", size: "Compact", color: "Onyx Black", stock: 12, price: 520, sku: "CRD-BLK-CMP" },
    { id: "var-023-brown", productId: "prod-023", size: "Compact", color: "Havana Brown", stock: 10, price: 520, sku: "CRD-BRN-CMP" },

    // prod-024 Titanium Sunglasses
    { id: "var-024-char", productId: "prod-024", size: "54-18", color: "Charcoal Grey", stock: 10, price: 680, sku: "SUN-CHR-54" },
    { id: "var-024-gold", productId: "prod-024", size: "54-18", color: "Brushed Gold", stock: 8, price: 680, sku: "SUN-GLD-54" },

    // prod-025 Tuxedo Jacket
    { id: "var-025-38", productId: "prod-025", size: "38R", color: "Midnight Black", stock: 3, price: 2100, sku: "TUX-BLK-38" },
    { id: "var-025-40", productId: "prod-025", size: "40R", color: "Midnight Black", stock: 5, price: 2100, sku: "TUX-BLK-40" },
    { id: "var-025-42", productId: "prod-025", size: "42R", color: "Midnight Black", stock: 3, price: 2100, sku: "TUX-BLK-42" },

    // prod-026 Silk Chiffon Maxi Gown
    { id: "var-026-38", productId: "prod-026", size: "IT 38", color: "Emerald Green", stock: 3, price: 2850, sku: "GWN-EMR-38" },
    { id: "var-026-40", productId: "prod-026", size: "IT 40", color: "Emerald Green", stock: 4, price: 2850, sku: "GWN-EMR-40" },

    // prod-027 Wool Flannel Trousers
    { id: "var-027-48", productId: "prod-027", size: "IT 48", color: "Charcoal Melange", stock: 10, price: 580, sku: "TRS-CHR-48" },
    { id: "var-027-50", productId: "prod-027", size: "IT 50", color: "Charcoal Melange", stock: 14, price: 580, sku: "TRS-CHR-50" },
  ]).onConflictDoNothing();
  console.log("✓ product variants");

  // ── Product Reviews ────────────────────────────────────────────────────────
  await db.insert(reviewsTable).values([
    { id: "rev-001", productId: "prod-001", rating: 5, authorName: "Lord Henry C.", comment: "The cashmere drape and weight are truly peerless. The hand-finished lining demonstrates world-class tailoring." },
    { id: "rev-002", productId: "prod-002", rating: 5, authorName: "Camille D.", comment: "Exquisite silk charmeuse. Feels weightless on the skin and the ivory sheen is understated and elegant." },
    { id: "rev-003", productId: "prod-003", rating: 5, authorName: "Alessandro M.", comment: "A genuine masterpiece of Italian cordwaining. The alligator scales are perfectly symmetrical." },
    { id: "rev-004", productId: "prod-008", rating: 5, authorName: "Elena V.", comment: "Stunning brilliance and fire. The white gold setting is crisp and secure. Truly an heirloom item." },
    { id: "rev-005", productId: "prod-012", rating: 5, authorName: "Julian S.", comment: "Magnificent Carrara marble. It commands the center of our dining room table with quiet authority." },
    { id: "rev-006", productId: "prod-013", rating: 5, authorName: "Margot R.", comment: "The softest cashmere blanket I have ever owned. Exceptional craftsmanship." },
    { id: "rev-007", productId: "prod-016", rating: 5, authorName: "Harrison T.", comment: "The micro-pavé diamonds catch the light subtly. Solid, weighty feel without being gaudy." },
    { id: "rev-008", productId: "prod-022", rating: 5, authorName: "Seraphina K.", comment: "Flawless travel companion. The leather aroma and grain finish are sublime." },
  ]).onConflictDoNothing();
  console.log("✓ reviews");

  // ── Orders ──────────────────────────────────────────────────────────────────
  await db.insert(ordersTable).values([
    { id: "ord-001", customerEmail: "audrey@example.com",   customerName: "Audrey Chen",    status: "DELIVERED",  total: 1600, items: [{ name: "Silk Charmeuse Blouse", qty: 1, price: 620 }, { name: "Gold-Clasp Evening Bag", qty: 1, price: 980 }], createdAt: new Date(now - 86400000 * 7)   },
    { id: "ord-002", customerEmail: "marcus@example.com",   customerName: "Marcus Webb",    status: "PROCESSING", total: 1850, items: [{ name: "Cashmere Overcoat",       qty: 1, price: 1850 }],                                                        createdAt: new Date(now - 86400000 * 2)   },
    { id: "ord-003", customerEmail: "isabelle@example.com", customerName: "Isabelle Morel", status: "PENDING",    total: 3400, items: [{ name: "Alligator Derby Shoes",   qty: 1, price: 3400 }],                                                        createdAt: new Date(now - 86400000 * 1)   },
    { id: "ord-004", customerEmail: "james@example.com",    customerName: "James Harlow",   status: "SHIPPED",    total: 580,  items: [{ name: "Merino Turtleneck",       qty: 2, price: 290  }],                                                        createdAt: new Date(now - 86400000 * 0.5) },
    { id: "ord-005", customerEmail: "sophia@example.com",   customerName: "Sophia Laurent", status: "DELIVERED",  total: 5800, items: [{ name: "Diamond Tennis Bracelet", qty: 1, price: 5800 }],                                                        createdAt: new Date(now - 86400000 * 15)  },
    { id: "ord-006", customerEmail: "theo@example.com",     customerName: "Theo Hartmann",  status: "PROCESSING", total: 2200, items: [{ name: "Leather Trench Coat",     qty: 1, price: 2200 }],                                                        createdAt: new Date(now - 86400000 * 3)   },
  ]).onConflictDoNothing();
  console.log("✓ orders");

  // ── Facebook Post Templates ───────────────────────────────────────────────
  await db.insert(facebookPostTemplatesTable).values([
    { id: "fb-tpl-001", name: "New Season Launch", body: "✨ Introducing our Autumn/Winter Collection. Hand-crafted cashmere, bespoke leather outerwear, and timeless fine jewellery. Discover the lookbook now: {link}", postType: "Standard" },
    { id: "fb-tpl-002", name: "Private VIP Event", body: "💎 Private Client Event: Members enjoy complimentary express shipping and 20% off selected luxury footwear this weekend with code LUXEVIP20.", postType: "Promotion" },
    { id: "fb-tpl-003", name: "Atelier Showcase", body: "🧵 Behind the Craft: Each pair of our Alligator Derby shoes requires over 40 hours of hand-lasting by master artisans in Italy. Explore true luxury.", postType: "Story" },
  ]).onConflictDoNothing();
  console.log("✓ facebook post templates");

  // ── Twitter / X Content Templates ─────────────────────────────────────────
  await db.insert(twitterContentTemplatesTable).values([
    { id: "tw-tpl-001", name: "New Arrival Release", body: "New Arrival: The Cashmere Overcoat in Charcoal. Grade-A Mongolian cashmere with hand-rolled silk lining. Shop online now: {link}" },
    { id: "tw-tpl-002", name: "Editorial Spotlight", body: "Minimalism redefined. Discover our latest silk charmeuse blouses and tailored linen blazers. Explore the boutique." },
    { id: "tw-tpl-003", name: "Rare Piece Reserve", body: "Only 3 pieces remaining: 18k Diamond Tennis Bracelet. Hand-set VS1 diamonds. Reserve yours before sold out: {link}" },
  ]).onConflictDoNothing();
  console.log("✓ twitter content templates");

  // ── WhatsApp Message Templates ─────────────────────────────────────────────
  await db.insert(whatsappTemplatesTable).values([
    {
      id: "wa-tpl-001",
      name: "order_confirmation_v1",
      category: "Utility",
      body: "*[LUXE BOUTIQUE | ORDER CONFIRMED]*\n_Haute Couture & Private Client Services_\n\nDear *{{1}}*,\n\nThank you for your order *#{{2}}* totaling *${{3}}*.\nOur ateliers are preparing your items with meticulous care.\n\n*Order Details:*\n• Order ID: #{{2}}\n• Items: {{4}}\n• Total Paid: ${{3}}\n\nTrack your order details: {{5}}\n\n_Luxe Boutique Concierge Services_",
      status: "Approved",
    },
    {
      id: "wa-tpl-002",
      name: "shipping_update_v1",
      category: "Utility",
      body: "*[LUXE BOUTIQUE | SHIPPING UPDATE]*\n_Haute Couture & Private Client Services_\n\nDear *{{1}}*,\n\nYour order *#{{2}}* has shipped!\nCarrier: *{{3}}* | Tracking ID: *{{4}}*\n\nTrack real-time delivery: {{5}}\n\n_Luxe Boutique Concierge Services_",
      status: "Approved",
    },
    {
      id: "wa-tpl-003",
      name: "account_security_otp_v1",
      category: "Authentication",
      body: "*[LUXE BOUTIQUE | SECURITY VERIFICATION]*\n_Executive Security Desk_\n\nYour single-use sign-in verification code is:\n\n*{{1}}*\n\nThis code expires in *10 minutes*. Never share this code with anyone.\n\n_Luxe Boutique Security Desk_",
      status: "Approved",
    },
    {
      id: "wa-tpl-004",
      name: "password_reset_v1",
      category: "Authentication",
      body: "*[LUXE BOUTIQUE | PASSWORD RESET]*\n_Account Security Notification_\n\nDear *{{1}}*,\n\nWe received a request to reset your Luxe Boutique password.\n\nSet your new password here (expires in *60 minutes*):\n{{2}}\n\n_Luxe Boutique Security Desk_",
      status: "Approved",
    },
    {
      id: "wa-tpl-005",
      name: "welcome_member_v1",
      category: "Utility",
      body: "*[LUXE BOUTIQUE | PRIVATE CLIENT CLUB]*\n_Membership Confirmed_\n\nWelcome *{{1}}*,\n\nYour Luxe Boutique private client account is now active.\nEnjoy complimentary express delivery and dedicated concierge support.\n\nExplore Collections: {{2}}\n\n_Luxe Boutique Concierge Services_",
      status: "Approved",
    },
    {
      id: "wa-tpl-006",
      name: "order_status_update_v1",
      category: "Utility",
      body: "*[LUXE BOUTIQUE | ORDER STATUS UPDATE]*\n_Haute Couture & Private Client Services_\n\nDear *{{1}}*,\n\nYour order *#{{2}}* status has been updated to:\n\n*{{3}}*\n\nView details in your account: {{4}}\n\n_Luxe Boutique Concierge Services_",
      status: "Approved",
    },
    {
      id: "wa-tpl-007",
      name: "low_stock_alert_v1",
      category: "Utility",
      body: "*[LUXE BOUTIQUE | INVENTORY ALERT]*\n_Admin System Warning_\n\nAttention Admin,\n\n*{{1}} item(s)* have fallen below your stock threshold of *{{2}} units*:\n\n{{3}}\n\nManage inventory: {{4}}\n\n_Luxe Boutique Automated System_",
      status: "Approved",
    },
    {
      id: "wa-tpl-008",
      name: "vip_invitation_v1",
      category: "Marketing",
      body: "*[LUXE BOUTIQUE | PRIVATE VIP PREVIEW]*\n_Exclusive Invitation_\n\nExclusive for *{{1}}*,\n\nYou are cordially invited to our Private Client Autumn/Winter Preview.\nEnjoy early access to bespoke collections before public release.\n\nAccess Private Portal: {{2}}\n\n_Luxe Boutique Concierge Services_",
      status: "Approved",
    },
  ]).onConflictDoNothing();
  console.log("✓ whatsapp templates");

  // ── WhatsApp Journeys ───────────────────────────────────────────────────────
  await db.insert(whatsappJourneysTable).values([
    {
      id: "wa-jrn-001",
      journeyId: "order_placed",
      icon: "receipt_long",
      title: "Order Confirmation & Live Tracking",
      description: "Instantly sends a confirmed receipt, order summary, and live courier tracking link upon completed checkout.",
      active: true,
      sentCount: "142",
      steps: 2,
      convRate: "94%",
    },
    {
      id: "wa-jrn-002",
      journeyId: "abandoned_cart_1h",
      icon: "shopping_bag",
      title: "Abandoned Bag White-Glove Recovery",
      description: "Sends gentle cart reminder with direct bag restore link 1 hour after checkout abandonment.",
      active: true,
      sentCount: "45",
      steps: 2,
      convRate: "22.8%",
    },
    {
      id: "wa-jrn-003",
      journeyId: "shipping_dispatch",
      icon: "local_shipping",
      title: "Live Shipping & Dispatch Tracking",
      description: "Sends tracking number and carrier ETA as soon as the fulfillment status changes to Shipped.",
      active: true,
      sentCount: "98",
      steps: 1,
      convRate: "98%",
    },
    {
      id: "wa-jrn-004",
      journeyId: "vip_welcome",
      icon: "diamond",
      title: "VIP Club Welcome & Concierge",
      description: "Sends instant concierge greeting and exclusive VIP member benefit code upon opt-in.",
      active: true,
      sentCount: "187",
      steps: 1,
      convRate: "89%",
    },
  ]).onConflictDoNothing();
  console.log("✓ whatsapp journeys");

  // ── WhatsApp Opt-in Settings ───────────────────────────────────────────────
  await db.insert(whatsappOptinSettingsTable).values({
    id: "default",
    optinKeyword: "JOIN",
    optoutKeyword: "STOP",
    doubleOptin: true,
  }).onConflictDoNothing();
  console.log("✓ whatsapp opt-in settings");

  // ── Facebook & Social Connections ──────────────────────────────────────────
  await db.insert(facebookConnectionsTable).values([
    { id: "conn-facebook",  connectionKey: "facebook",  active: true },
    { id: "conn-instagram", connectionKey: "instagram", active: true },
    { id: "conn-pixel",     connectionKey: "pixel",     active: true },
    { id: "conn-messenger", connectionKey: "messenger", active: true },
  ]).onConflictDoNothing();
  console.log("✓ facebook connections");

  // ── Facebook Pixel Events ──────────────────────────────────────────────────
  await db.insert(facebookPixelEventsTable).values([
    { id: "px-001", storeEvent: "PageView",         fbEvent: "PageView",         enabled: true },
    { id: "px-002", storeEvent: "ViewProduct",      fbEvent: "ViewContent",      enabled: true },
    { id: "px-003", storeEvent: "AddToCart",        fbEvent: "AddToCart",        enabled: true },
    { id: "px-004", storeEvent: "InitiateCheckout", fbEvent: "InitiateCheckout", enabled: true },
    { id: "px-005", storeEvent: "CompletePurchase", fbEvent: "Purchase",         enabled: true },
    { id: "px-006", storeEvent: "AddToWishlist",    fbEvent: "AddToWishlist",    enabled: true },
    { id: "px-007", storeEvent: "SearchProducts",   fbEvent: "Search",           enabled: true },
    { id: "px-008", storeEvent: "ContactConcierge", fbEvent: "Contact",          enabled: true },
  ]).onConflictDoNothing();
  console.log("✓ facebook pixel events");

  // ── Facebook Audiences ─────────────────────────────────────────────────────
  await db.insert(facebookAudiencesTable).values([
    { id: "aud-001", name: "High-Value Luxury Shoppers",        type: "Custom",     size: "1.2K",  status: "Active" },
    { id: "aud-002", name: "Cart Abandoners (Last 30 Days)",   type: "Retargeting",size: "450",   status: "Active" },
    { id: "aud-003", name: "Instagram & Facebook Engagers",     type: "Custom",     size: "3.8K",  status: "Active" },
    { id: "aud-004", name: "VIP Client Lookalike 1%",           type: "Lookalike",  size: "24.5K", status: "Active" },
  ]).onConflictDoNothing();
  console.log("✓ facebook audiences");

  // ── Super-admin user (only if no admin exists yet) ──────────────────────────
  const { eq, or } = await import("drizzle-orm");
  const existing = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(or(eq(usersTable.role, "ADMIN"), eq(usersTable.role, "SUPER_ADMIN")))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(usersTable).values({
      id:           "user-super-admin",
      name:         "LUXE Admin",
      email:        "admin@luxeboutique.com",
      role:         "SUPER_ADMIN",
      passwordHash: "",
    }).onConflictDoNothing();
    console.log("✓ super admin user seeded (admin@luxeboutique.com)");
  } else {
    console.log("✓ admin already exists, skipping");
  }

  if (pool && typeof pool.end === "function" && process.env.DATABASE_URL) {
    await pool.end();
  }
  console.log("✓ seed complete");
}

if (process.argv[1] && (process.argv[1].endsWith("seed.ts") || process.argv[1].endsWith("seed.js") || process.argv[1].endsWith("seed.mjs"))) {
  seed().catch((err) => { console.error(err); process.exit(1); });
}
