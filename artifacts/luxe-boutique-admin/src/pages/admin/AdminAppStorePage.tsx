import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  MdSearch,
  MdStorefront,
  MdCheckCircle,
  MdArrowForward,
  MdStar,
  MdClose,
  MdSecurity,
  MdOutlineWorkspacePremium,
  MdHub,
  MdLocalShipping,
  MdMail,
  MdPayment,
  MdAnalytics,
  MdChat,
  MdAdd,
  MdDownload,
  MdCheck,
  MdShoppingBag,
  MdTune,
  MdAutorenew,
  MdCampaign,
  MdSystemUpdateAlt,
  MdLink,
  MdLinkOff,
  MdVpnKey,
  MdLock,
  MdPerson,
  MdNotificationsActive,
  MdUpgrade,
  MdHistory,
  MdInfoOutline,
  MdExpandMore,
  MdExpandLess,
  MdRefresh,
} from "react-icons/md";
import {
  SiMeta,
  SiFacebook,
  SiInstagram,
  SiWhatsapp,
  SiGoogle,
  SiX,
  SiStripe,
  SiTiktok,
  SiPinterest,
  SiGoogleanalytics,
  SiDhl,
  SiPaypal,
} from "react-icons/si";
import AdminLayout from "./AdminLayout";

export interface AppItem {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: "sales" | "marketing" | "analytics" | "fulfillment" | "payments";
  categoryLabel: string;
  icon: React.ReactNode;
  iconBg: string;
  rating: number;
  reviewsCount: number;
  isInstalled: boolean;
  developer: string;
  actionUrl: string;
  actionLabel: string;
  featured?: boolean;
  tags: string[];
  features: string[];
  permissions: string[];
  // Update System fields
  hasUpdate?: boolean;
  currentVersion?: string;
  latestVersion?: string;
  releaseDate?: string;
  updateNotes?: string;
}

const DEFAULT_APPS: AppItem[] = [
  // ── SALES & CHANNELS ──
  {
    id: "meta-business",
    name: "Meta Business Suite",
    tagline: "Unified Facebook, Instagram, WhatsApp, Catalog & Ads management",
    description:
      "Connect your business once to unlock real-time Facebook Page publishing, Instagram Direct messaging, WhatsApp Business API order updates, and synchronized product catalogs.",
    category: "sales",
    categoryLabel: "Sales & Channels",
    icon: <SiMeta className="text-2xl text-white" />,
    iconBg: "bg-[#0668E1]",
    rating: 4.9,
    reviewsCount: 312,
    isInstalled: true,
    developer: "Official Meta Integration",
    actionUrl: "/channels/meta-business",
    actionLabel: "Open App",
    featured: true,
    tags: ["Facebook", "Instagram", "WhatsApp", "Catalog", "Sales"],
    currentVersion: "v2.3.1",
    latestVersion: "v2.4.0",
    hasUpdate: true,
    releaseDate: "Yesterday",
    updateNotes: "Adds support for Meta Catalog Enhanced Batch Sync, multi-account Instagram Shop tags, and interactive WhatsApp order confirmation templates.",
    features: [
      "Single-click OAuth 2.0 Business Login",
      "Live product catalog sync with Meta Commerce Manager",
      "Instagram Shoppable Feed & Facebook Shop integration",
      "Direct API access to WhatsApp Business for automated confirmations",
    ],
    permissions: [
      "Read & write product catalog and variant inventory",
      "Manage connected Facebook Pages and Instagram Business accounts",
      "Receive WhatsApp message webhooks & delivery receipts",
    ],
  },
  {
    id: "google-workspace",
    name: "Google Workspace & Calendar",
    tagline: "Sync customer appointments, consultations, and staff calendars",
    description:
      "Connect your Google account with official OAuth 2.0 to sync VIP boutique consultations, staff schedules, and calendar reservations directly into your admin terminal.",
    category: "sales",
    categoryLabel: "Sales & Channels",
    icon: <SiGoogle className="text-2xl text-[#4285F4]" />,
    iconBg: "bg-white border border-slate-200",
    rating: 4.9,
    reviewsCount: 248,
    isInstalled: true,
    developer: "Official Google Partner",
    actionUrl: "/channels/google-workspace",
    actionLabel: "Open App",
    featured: true,
    tags: ["Google Calendar", "Meet", "VIP Booking", "Sales"],
    currentVersion: "v1.8.0",
    latestVersion: "v1.9.2",
    hasUpdate: true,
    releaseDate: "3 days ago",
    updateNotes: "Improves automatic Google Meet conference link generation, multi-timezone VIP appointment notifications, and OAuth token auto-renewal.",
    features: [
      "Real-time Google Calendar two-way synchronization",
      "Automated Google Meet links for virtual styling consultations",
      "Client reminder notifications with timezone conversion",
      "Unified Google Workspace OAuth token management",
    ],
    permissions: [
      "Read & update Google Calendar event reservations",
      "Generate Google Meet video consultation links",
      "Send attendee calendar invites and reminder notifications",
    ],
  },
  {
    id: "whatsapp-concierge",
    name: "WhatsApp Business Concierge",
    tagline: "Automated order updates, VIP dispatch alerts, and live messaging",
    description:
      "Engage customers via high-deliverability WhatsApp Cloud API. Send instant order confirmations, tracking numbers, and exclusive bespoke offers with high open rates.",
    category: "sales",
    categoryLabel: "Sales & Channels",
    icon: <SiWhatsapp className="text-2xl text-white" />,
    iconBg: "bg-[#25D366]",
    rating: 4.8,
    reviewsCount: 189,
    isInstalled: true,
    developer: "Meta Cloud API",
    actionUrl: "/channels/whatsapp",
    actionLabel: "Configure",
    tags: ["WhatsApp", "Order Notifications", "Chat", "Sales"],
    currentVersion: "v2.1.0",
    latestVersion: "v2.1.0",
    hasUpdate: false,
    releaseDate: "2 weeks ago",
    features: [
      "Pre-approved HSM template messages for order lifecycle updates",
      "Meta WhatsApp Cloud API Direct integration",
      "Customer phone validation & regional dial codes",
      "Opt-in compliant concierge chat",
    ],
    permissions: [
      "Send pre-approved transactional WhatsApp template messages",
      "Access incoming customer support message webhooks",
      "Lookup customer phone numbers with country dial codes",
    ],
  },
  {
    id: "instagram-shopping",
    name: "Instagram Shop & Feed",
    tagline: "Turn your Instagram grid and stories into shoppable storefronts",
    description:
      "Tag luxury products directly in Instagram posts, reels, and stories. Drive mobile shoppers straight to checkout with seamless catalog tagging.",
    category: "sales",
    categoryLabel: "Sales & Channels",
    icon: <SiInstagram className="text-2xl text-white" />,
    iconBg: "bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888]",
    rating: 4.9,
    reviewsCount: 420,
    isInstalled: true,
    developer: "Official Meta Integration",
    actionUrl: "/channels/instagram",
    actionLabel: "Manage",
    tags: ["Instagram", "Shoppable Posts", "Reels", "Sales"],
    currentVersion: "v2.2.0",
    latestVersion: "v2.2.0",
    hasUpdate: false,
    releaseDate: "1 month ago",
    features: [
      "Direct feed image to catalog product linking",
      "Instagram insights: impressions, reach, and product clicks",
      "Media asset library synchronization",
      "Scheduled product drop announcements",
    ],
    permissions: [
      "Publish shoppable product tags on Instagram posts and reels",
      "Access Instagram media and story performance analytics",
      "Sync approved catalog items with Meta Commerce catalog",
    ],
  },
  {
    id: "tiktok-shop",
    name: "TikTok Shop for Luxury",
    tagline: "Short-form video commerce, live shopping, and creator affiliate drops",
    description:
      "Integrate TikTok Shop to display luxury collections to millions of high-intent shoppers, enable in-app checkout, and manage creator affiliate product gifting.",
    category: "sales",
    categoryLabel: "Sales & Channels",
    icon: <SiTiktok className="text-2xl text-white" />,
    iconBg: "bg-black",
    rating: 4.7,
    reviewsCount: 165,
    isInstalled: false,
    developer: "TikTok Open Platform",
    actionUrl: "/channels",
    actionLabel: "Configure",
    tags: ["TikTok", "Live Commerce", "Creator Drops", "Sales"],
    latestVersion: "v1.5.0",
    features: [
      "Real-time product sync to TikTok Shop Seller Center",
      "Creator collaboration & affiliate commission tracking",
      "Live shopping event countdown timers & showcase pins",
      "Automated order routing and inventory reservation",
    ],
    permissions: [
      "Sync product titles, luxury imagery, and SKU inventory",
      "Import orders placed within TikTok Shop directly into Boutique Seller",
      "Update order dispatch fulfillment status and tracking numbers",
    ],
  },
  {
    id: "pinterest-shopping",
    name: "Pinterest Luxury Lookbook",
    tagline: "Visual discovery, Rich Product Pins, and seasonal fashion boards",
    description:
      "Automatically convert your boutique photography into Pinterest Product Pins with real-time pricing and stock indicators for high-income fashion shoppers.",
    category: "sales",
    categoryLabel: "Sales & Channels",
    icon: <SiPinterest className="text-2xl text-white" />,
    iconBg: "bg-[#E60023]",
    rating: 4.8,
    reviewsCount: 88,
    isInstalled: false,
    developer: "Pinterest Partners",
    actionUrl: "/channels",
    actionLabel: "Configure",
    tags: ["Pinterest", "Rich Pins", "Lookbook", "Sales"],
    latestVersion: "v1.2.4",
    features: [
      "Automatic generation of Rich Product Pins from catalog images",
      "Pinterest Verified Merchant Program compatibility",
      "Seasonal lookbook board management",
      "Conversion tracking tag injection",
    ],
    permissions: [
      "Create and organize pins on official Pinterest business boards",
      "Access merchant storefront analytics and save rates",
      "Receive Pinterest conversion API event webhooks",
    ],
  },
  {
    id: "x-twitter",
    name: "X / Twitter Luxury Broadcast",
    tagline: "Real-time flash sales, lookbook drops, and designer commentary",
    description:
      "Broadcast exclusive lookbook previews, press features, and limited drops to your fashion following on X with embedded product cards.",
    category: "sales",
    categoryLabel: "Sales & Channels",
    icon: <SiX className="text-2xl text-black" />,
    iconBg: "bg-slate-100 border border-slate-300",
    rating: 4.5,
    reviewsCount: 76,
    isInstalled: true,
    developer: "X API v2",
    actionUrl: "/channels/twitter",
    actionLabel: "Manage",
    tags: ["X / Twitter", "Flash Drops", "Social", "Sales"],
    currentVersion: "v2.0.1",
    latestVersion: "v2.0.1",
    hasUpdate: false,
    releaseDate: "2 weeks ago",
    features: [
      "Automated new product drop announcements",
      "Rich media Twitter Cards with live inventory badges",
      "Engagement metrics & follower growth tracking",
      "Direct customer support conversation routing",
    ],
    permissions: [
      "Post tweets and media cards to connected X brand handle",
      "Retrieve engagement statistics and mention notifications",
    ],
  },

  // ── MARKETING & GROWTH ──
  {
    id: "meta-ads",
    name: "Meta Ads Manager",
    tagline: "High-ROI retargeting and dynamic product ads on Facebook & Instagram",
    description:
      "Deploy dynamic catalog ads, carousel creatives, and high-value customer lookalike campaigns across Facebook, Instagram, and Messenger.",
    category: "marketing",
    categoryLabel: "Marketing & Growth",
    icon: <SiFacebook className="text-2xl text-[#1877F2]" />,
    iconBg: "bg-blue-50 border border-blue-200",
    rating: 4.7,
    reviewsCount: 165,
    isInstalled: true,
    developer: "Meta Business",
    actionUrl: "/channels/meta-ads",
    actionLabel: "Open Campaigns",
    tags: ["Meta Ads", "Retargeting", "ROAS", "Marketing"],
    currentVersion: "v3.0.0",
    latestVersion: "v3.0.0",
    hasUpdate: false,
    releaseDate: "3 weeks ago",
    features: [
      "Dynamic catalog retargeting for abandoned cart shoppers",
      "Conversion API integration for 100% signal accuracy",
      "Real-time ROAS tracking and spend analytics",
      "Custom boutique luxury audience targeting",
    ],
    permissions: [
      "Access Meta Ad Accounts, Pixel IDs, and Conversions API",
      "Create and sync product catalog product sets",
      "Fetch ad spend, impressions, CPC, and ROAS performance",
    ],
  },
  {
    id: "newsletter-broadcast",
    name: "VIP Newsletter & Broadcasts",
    tagline: "Curated email campaigns for seasonal drops and private invitations",
    description:
      "Send bespoke HTML editorial newsletters to your subscriber list with product recommendations, discount codes, and private invitation previews.",
    category: "marketing",
    categoryLabel: "Marketing & Growth",
    icon: <MdMail className="text-2xl text-indigo-600" />,
    iconBg: "bg-indigo-50 border border-indigo-200",
    rating: 4.8,
    reviewsCount: 94,
    isInstalled: true,
    developer: "Boutique Core",
    actionUrl: "/newsletter",
    actionLabel: "Send Broadcast",
    tags: ["Email", "VIP Lists", "Editorial", "Marketing"],
    currentVersion: "v1.4.2",
    latestVersion: "v1.4.2",
    hasUpdate: false,
    releaseDate: "1 month ago",
    features: [
      "Bespoke luxury email newsletter templates",
      "Segmentation by VIP tier and order history",
      "Click-through tracking with UTM parameters",
      "Automated welcome series and coupon delivery",
    ],
    permissions: [
      "Read customer email subscriber list and VIP tags",
      "Dispatch editorial HTML email broadcasts",
      "Track open rates, link clicks, and campaign revenue",
    ],
  },
  {
    id: "klaviyo-vip",
    name: "Klaviyo VIP Customer Journeys & SMS",
    tagline: "Predictive LTV segmentation, automated SMS drops, and bespoke flows",
    description:
      "Automate high-touch clienteling with predictive customer churn detection, back-in-stock SMS alerts, and personalized luxury email sequences.",
    category: "marketing",
    categoryLabel: "Marketing & Growth",
    icon: <MdCampaign className="text-2xl text-amber-900" />,
    iconBg: "bg-amber-100 border border-amber-300",
    rating: 4.9,
    reviewsCount: 230,
    isInstalled: false,
    developer: "Klaviyo Inc.",
    actionUrl: "/settings",
    actionLabel: "Configure",
    tags: ["SMS", "Email Automation", "VIP Flows", "Marketing"],
    latestVersion: "v2.5.1",
    features: [
      "Predictive Lifetime Value (pLTV) calculation per client",
      "Triggered back-in-stock and private trunk show invitations",
      "Dedicated two-way concierge SMS messaging",
      "Bespoke VIP tier loyalty automations",
    ],
    permissions: [
      "Sync customer profiles, total spend, and purchase history",
      "Send transactional and promotional SMS notifications",
      "Trigger event flows upon order placement and dispatch",
    ],
  },

  // ── ANALYTICS & DATA ──
  {
    id: "social-analytics",
    name: "Omnichannel Attribution & Analytics",
    tagline: "Cross-platform performance dashboards for all connected channels",
    description:
      "Monitor traffic sources, conversion rates, social post engagement, and campaign revenue attribution in a centralized analytics dashboard.",
    category: "analytics",
    categoryLabel: "Analytics & Intelligence",
    icon: <MdAnalytics className="text-2xl text-emerald-700" />,
    iconBg: "bg-emerald-50 border border-emerald-200",
    rating: 4.9,
    reviewsCount: 112,
    isInstalled: true,
    developer: "Boutique Core",
    actionUrl: "/channels/analytics",
    actionLabel: "View Analytics",
    tags: ["Attribution", "Traffic", "Conversion", "Analytics"],
    currentVersion: "v2.0.0",
    latestVersion: "v2.0.0",
    hasUpdate: false,
    releaseDate: "2 weeks ago",
    features: [
      "Multi-touch revenue attribution modeling",
      "Unified followers and reach tracker across all channels",
      "Best-performing products by sales channel",
      "Automated weekly executive performance summary",
    ],
    permissions: [
      "Read store order sales figures and channel referrers",
      "Aggregate social impressions and click-through rates",
      "Generate exportable PDF and CSV executive reports",
    ],
  },
  {
    id: "google-analytics-4",
    name: "Google Analytics 4 & Tag Manager",
    tagline: "Advanced e-commerce tracking, conversion events, and audience funnels",
    description:
      "Connect your official GA4 Measurement ID to monitor real-time shoppers, cart abandonment funnels, product view rates, and regional traffic trends.",
    category: "analytics",
    categoryLabel: "Analytics & Intelligence",
    icon: <SiGoogleanalytics className="text-2xl text-[#E37400]" />,
    iconBg: "bg-amber-50 border border-amber-200",
    rating: 4.8,
    reviewsCount: 174,
    isInstalled: false,
    developer: "Google Partner",
    actionUrl: "/settings",
    actionLabel: "Configure",
    tags: ["GA4", "Tracking", "Funnels", "Analytics"],
    latestVersion: "v4.1.0",
    features: [
      "Standard Enhanced E-commerce schema event logging",
      "Real-time active visitors map and device breakdown",
      "Checkout funnel drop-off analytics",
      "Google Tag Manager server-side container readiness",
    ],
    permissions: [
      "Stream store e-commerce event signals to Google Analytics",
      "Access aggregated audience demographics and search terms",
    ],
  },

  // ── FULFILLMENT & DROPSHIPPING ──
  {
    id: "printful-fulfillment",
    name: "Printful Print-on-Demand",
    tagline: "Automated fulfillment for luxury apparel, leather accessories & prints",
    description:
      "Seamlessly routes custom boutique merchandise and luxury printed editions to Printful's worldwide fulfillment centers upon order placement.",
    category: "fulfillment",
    categoryLabel: "Fulfillment & Dropshipping",
    icon: <span className="text-2xl">🖨️</span>,
    iconBg: "bg-amber-50 border border-amber-200",
    rating: 4.7,
    reviewsCount: 154,
    isInstalled: true,
    developer: "Printful Global",
    actionUrl: "/providers",
    actionLabel: "Manage Provider",
    tags: ["POD", "Apparel", "Auto-Fulfillment", "Fulfillment"],
    currentVersion: "v2.0.4",
    latestVersion: "v2.0.4",
    hasUpdate: false,
    releaseDate: "3 weeks ago",
    features: [
      "Automatic order routing and live tracking numbers",
      "Custom luxury packing slips with boutique branding",
      "Global fulfillment centers in Europe, US, and Asia",
      "Mockup generator & variant mapping",
    ],
    permissions: [
      "Read incoming orders containing Printful line items",
      "Transmit recipient shipping addresses for label creation",
      "Receive live tracking numbers and carrier updates",
    ],
  },
  {
    id: "eprolo-dropshipping",
    name: "Eprolo Luxury Dropshipping",
    tagline: "One-click luxury catalog import with express air courier shipping",
    description:
      "Browse thousands of vetted premium products, import them into your boutique catalog with customized pricing margins, and automate order fulfillment.",
    category: "fulfillment",
    categoryLabel: "Fulfillment & Dropshipping",
    icon: <span className="text-2xl">📦</span>,
    iconBg: "bg-blue-50 border border-blue-200",
    rating: 4.6,
    reviewsCount: 98,
    isInstalled: true,
    developer: "Eprolo Express",
    actionUrl: "/providers",
    actionLabel: "Browse Catalog",
    tags: ["Dropshipping", "Catalog Import", "Air Shipping", "Fulfillment"],
    currentVersion: "v1.3.0",
    latestVersion: "v1.3.0",
    hasUpdate: false,
    releaseDate: "1 month ago",
    features: [
      "In-admin catalog browser with one-click product import",
      "Automatic inventory and price sync",
      "Custom branded packaging & warranty cards",
      "5-8 day express delivery tracking",
    ],
    permissions: [
      "Create and sync imported supplier items in catalog",
      "Forward order line items to Eprolo fulfillment API",
      "Synchronize inventory levels automatically",
    ],
  },
  {
    id: "shipbob-logistics",
    name: "ShipBob 3PL Logistics",
    tagline: "Distributed inventory warehousing and 2-day domestic delivery",
    description:
      "Store inventory in regional luxury fulfillment centers to offer 2-day ground shipping to your premium customers with automated stock replenishment.",
    category: "fulfillment",
    categoryLabel: "Fulfillment & Dropshipping",
    icon: <span className="text-2xl">🚚</span>,
    iconBg: "bg-emerald-50 border border-emerald-200",
    rating: 4.8,
    reviewsCount: 87,
    isInstalled: true,
    developer: "ShipBob Inc.",
    actionUrl: "/providers",
    actionLabel: "Configure",
    tags: ["3PL", "Warehousing", "2-Day Shipping", "Fulfillment"],
    currentVersion: "v1.6.2",
    latestVersion: "v1.6.2",
    hasUpdate: false,
    releaseDate: "3 weeks ago",
    features: [
      "Real-time warehouse inventory synchronization",
      "Batch order fulfillment with automated label printing",
      "Custom packaging & gift wrapping options",
      "Split-shipment tracking for multi-item orders",
    ],
    permissions: [
      "Synchronize multi-location warehouse stock levels",
      "Send order fulfillment requests to assigned 3PL facility",
      "Update tracking IDs and parcel dispatch timestamps",
    ],
  },
  {
    id: "dhl-express",
    name: "DHL Express Worldwide Logistics",
    tagline: "High-security international courier shipping with signature on delivery",
    description:
      "Direct international priority shipping for high-value luxury orders. Automates customs documentation, air waybills, and VIP signature-required handoff.",
    category: "fulfillment",
    categoryLabel: "Fulfillment & Dropshipping",
    icon: <SiDhl className="text-2xl text-[#D40511]" />,
    iconBg: "bg-yellow-100 border border-yellow-300",
    rating: 4.9,
    reviewsCount: 142,
    isInstalled: false,
    developer: "DHL Express",
    actionUrl: "/settings",
    actionLabel: "Configure",
    tags: ["DHL", "Express", "International", "Fulfillment"],
    latestVersion: "v2.2.0",
    features: [
      "Automated paperless customs invoices & harmonized codes",
      "Signature required on delivery for high-value orders",
      "Real-time air waybill generation with commercial invoice PDF",
      "Global 24-48 hour delivery to 220+ countries",
    ],
    permissions: [
      "Generate commercial invoices and international customs documents",
      "Generate courier air waybill shipping labels",
      "Subscribe to real-time flight transit & delivery scan webhooks",
    ],
  },

  // ── PAYMENTS & CHECKOUT ──
  {
    id: "stripe-payments",
    name: "Stripe Premium Payments",
    tagline: "Accept Apple Pay, Google Pay, credit cards, and Klarna financing",
    description:
      "Global multi-currency payment gateway supporting 135+ currencies, biometric Apple Pay / Google Pay, 3D Secure fraud prevention, and flexible installments.",
    category: "payments",
    categoryLabel: "Payments & Checkout",
    icon: <SiStripe className="text-2xl text-[#635BFF]" />,
    iconBg: "bg-indigo-50 border border-indigo-200",
    rating: 5.0,
    reviewsCount: 512,
    isInstalled: true,
    developer: "Stripe Inc.",
    actionUrl: "/settings",
    actionLabel: "Configure",
    tags: ["Payments", "Apple Pay", "Multi-Currency"],
    currentVersion: "v3.1.2",
    latestVersion: "v3.3.0",
    hasUpdate: true,
    releaseDate: "1 week ago",
    updateNotes: "Adds 3D Secure 2.3 protocol compliance, instant Apple Pay multi-item express checkout, and enhanced dispute telemetry.",
    features: [
      "One-click checkout with Apple Pay & Google Pay",
      "Klarna & Afterpay buy-now-pay-later for luxury orders",
      "PCI Level 1 compliant tokenized card vaulting",
      "Automated tax calculation and multi-currency conversion",
    ],
    permissions: [
      "Process customer card charges and create PaymentIntents",
      "Manage customer payment methods in Stripe Vault",
      "Receive charge, refund, and dispute webhook signals",
    ],
  },
  {
    id: "paypal-checkout",
    name: "PayPal & Pay in 4",
    tagline: "Trusted digital wallet, buyer protection, and interest-free installments",
    description:
      "Provide VIP shoppers with the peace of mind of PayPal Buyer Protection, PayPal Credit, and zero-interest 4-installment split payments.",
    category: "payments",
    categoryLabel: "Payments & Checkout",
    icon: <SiPaypal className="text-2xl text-[#003087]" />,
    iconBg: "bg-blue-50 border border-blue-200",
    rating: 4.8,
    reviewsCount: 310,
    isInstalled: false,
    developer: "PayPal Inc.",
    actionUrl: "/settings",
    actionLabel: "Configure",
    tags: ["PayPal", "BNPL", "Wallet", "Payments"],
    latestVersion: "v2.0.0",
    features: [
      "One-touch instant digital wallet checkout",
      "Pay in 4 interest-free installment options",
      "Global multi-currency conversion at checkout",
      "Automated seller protection verification",
    ],
    permissions: [
      "Authorize and capture PayPal payment orders",
      "Process partial or full customer refunds",
      "Receive PayPal transaction IPN and webhook updates",
    ],
  },
];

export const APP_OAUTH_SCOPES: Record<string, string[]> = {
  "meta-business": ["business_management", "catalog_management", "ads_management"],
  "google-workspace": ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/meet"],
  "whatsapp-concierge": ["whatsapp_business_messaging", "whatsapp_business_management"],
  "instagram-shopping": ["instagram_basic", "instagram_shopping_tag_publications"],
  "tiktok-shop": ["product.write", "order.read", "fulfillment.write"],
  "pinterest-shopping": ["boards:write", "pins:write", "ads:write"],
  "x-twitter": ["tweet.write", "tweet.read", "offline.access"],
  "meta-ads": ["ads_management", "ads_read"],
  "newsletter-broadcast": ["contacts.write", "campaigns.send"],
  "klaviyo-vip": ["profiles:write", "events:write", "sms:send"],
  "social-analytics": ["analytics.readonly", "attribution.read"],
  "google-analytics-4": ["https://www.googleapis.com/auth/analytics.readonly"],
  "printful-fulfillment": ["orders.write", "products.read"],
  "eprolo-dropshipping": ["dropship.inventory", "dropship.orders"],
  "shipbob-logistics": ["inventory.read", "orders.write", "shipments.write"],
  "dhl-express": ["shipments.write", "rates.read"],
  "stripe-payments": ["payments.write", "webhooks.manage"],
  "paypal-checkout": ["payments.write", "checkout.orders"]
};

export interface ConfigSchemaField {
  key: string;
  label: string;
  type: "text" | "password" | "boolean" | "select" | "number";
  placeholder?: string;
  hint?: string;
  options?: { label: string; value: string }[];
}

export const APP_CONFIG_SCHEMA: Record<string, {
  title: string;
  fields: ConfigSchemaField[];
}> = {
  "meta-business": {
    title: "Meta Business Suite Configuration",
    fields: [
      { key: "accessToken", label: "System User Access Token", type: "password", placeholder: "EAAB...", hint: "Generate a permanent System User Access Token in your Meta Business Manager Settings." },
      { key: "businessId", label: "Meta Business ID", type: "text", placeholder: "123456789012345", hint: "Your 15-digit Meta Business Manager Account ID." },
      { key: "catalogId", label: "Meta Commerce Catalog ID", type: "text", placeholder: "987654321098765", hint: "The product catalog ID synchronized with your commerce feed." }
    ]
  },
  "google-workspace": {
    title: "Google Workspace & Calendar Configuration",
    fields: [
      { key: "calendarId", label: "Google Calendar ID", type: "text", placeholder: "primary", hint: "Enter 'primary' or a specific shared calendar address (e.g., yourname@gmail.com)." },
      { key: "meetEnabled", label: "Auto-Generate Google Meet Links", type: "boolean", hint: "Automatically attach a unique Google Meet video link to new VIP bookings." },
      { key: "reminderBuffer", label: "Reminder Lead Time (Hours)", type: "number", placeholder: "24", hint: "Send email reminders to styling consultation attendees this many hours in advance." }
    ]
  },
  "whatsapp-concierge": {
    title: "WhatsApp Business API Configuration",
    fields: [
      { key: "phoneNumberId", label: "Phone Number ID", type: "text", placeholder: "109876543210987", hint: "Obtained from the Facebook Developer Portal under WhatsApp Setup." },
      { key: "wabaId", label: "WhatsApp Business Account ID", type: "text", placeholder: "209876543210987", hint: "Your verified WhatsApp Business Account ID." },
      { key: "cloudToken", label: "Permanent Access Token", type: "password", placeholder: "EAAB...", hint: "Your permanent Meta Developer access token with whatsapp_business_messaging scopes." },
      { key: "sandboxEnabled", label: "Sandbox / Test Environment Mode", type: "boolean", hint: "Use the free developer test number instead of your production business number." }
    ]
  },
  "instagram-shopping": {
    title: "Instagram Shoppable Feed Configuration",
    fields: [
      { key: "instagramAccountId", label: "Instagram Professional Account ID", type: "text", placeholder: "178414...", hint: "Your business Instagram ID linked to your Facebook page." },
      { key: "taggingEnabled", label: "Enable Live Product Tagging", type: "boolean", hint: "Allow tagging your luxury items directly within posts, reels, and stories." },
      { key: "syncFrequency", label: "Catalog Sync Frequency", type: "select", options: [
        { label: "Real-time on product update", value: "realtime" },
        { label: "Every 6 Hours", value: "6h" },
        { label: "Daily Batch Sync", value: "24h" }
      ], hint: "How often catalog inventory edits are pushed to Meta Commerce." }
    ]
  },
  "tiktok-shop": {
    title: "TikTok Shop Integration Configuration",
    fields: [
      { key: "sellerId", label: "TikTok Seller ID", type: "text", placeholder: "US_LC_...", hint: "Your Seller Center identifier." },
      { key: "shopId", label: "TikTok Shop ID", type: "text", placeholder: "TS_...", hint: "Your designated TikTok Shop ID." },
      { key: "warehouseCode", label: "Default Warehouse Code", type: "text", placeholder: "WH_US_01", hint: "Code of the inventory warehouse mapped for TikTok shipments." },
      { key: "autoSyncOrders", label: "Auto-Fetch Live Orders", type: "boolean", hint: "Automatically import all completed TikTok Shop checkout events as pending boutique orders." }
    ]
  },
  "pinterest-shopping": {
    title: "Pinterest Shopping Lookbook Configuration",
    fields: [
      { key: "advertiserId", label: "Pinterest Advertiser ID", type: "text", placeholder: "549...", hint: "Used for conversion tag tracking and catalog campaigns." },
      { key: "merchantVerifiedCode", label: "Pinterest Tag Verification Code", type: "text", placeholder: "p_tag_...", hint: "Add this verification meta-tag to prove site ownership." },
      { key: "targetBoardName", label: "Target Board for Catalog Pins", type: "text", placeholder: "Seasonal Autumn/Winter 2026", hint: "All newly synced lookbook images will be automatically pinned here." }
    ]
  },
  "x-twitter": {
    title: "X (Twitter) Broadcast Configuration",
    fields: [
      { key: "clientId", label: "OAuth 2.0 Client ID", type: "text", placeholder: "Enter client ID...", hint: "Get from developer.x.com -> App -> User authentication settings." },
      { key: "clientSecret", label: "OAuth 2.0 Client Secret", type: "password", placeholder: "Enter client secret...", hint: "Keep confidential." },
      { key: "autoTweetDrops", label: "Auto-Post Product Drops", type: "boolean", hint: "Post a rich-media card automatically when a new product is published." }
    ]
  },
  "meta-ads": {
    title: "Meta Ads Manager Configuration",
    fields: [
      { key: "pixelId", label: "Facebook Pixel ID", type: "text", placeholder: "1023456789...", hint: "Enter your 15-digit Facebook Pixel ID for tracking." },
      { key: "conversionsToken", label: "Conversions API Access Token", type: "password", placeholder: "EAAG...", hint: "Enables secure server-side event streaming to bypass ad-blockers." },
      { key: "targetRoas", label: "Target ROAS (Multiplier)", type: "number", placeholder: "4.5", hint: "Desired Return on Ad Spend threshold for automatic optimization (e.g., 4.5x)." }
    ]
  },
  "newsletter-broadcast": {
    title: "VIP Newsletter Settings",
    fields: [
      { key: "senderName", label: "Sender Friendly Name", type: "text", placeholder: "Luxe Boutique VIP Concierge", hint: "The name that appears in your customer's inbox." },
      { key: "senderEmail", label: "Sender Email Address", type: "text", placeholder: "concierge@luxeboutique.com", hint: "Must be a verified sender domain." },
      { key: "newsletterAccentColor", label: "HTML Accent Color (Hex)", type: "text", placeholder: "#006c49", hint: "Primary brand accent color used in editorial newsletter templates." }
    ]
  },
  "klaviyo-vip": {
    title: "Klaviyo CRM & VIP Journeys",
    fields: [
      { key: "publicKey", label: "Klaviyo Public API Key / Site ID", type: "text", placeholder: "pk_...", hint: "Used for client-side event tracking scripts." },
      { key: "privateKey", label: "Klaviyo Private API Key", type: "password", placeholder: "Klaviyo-Private-Key...", hint: "Used for server-side profile and segmentation synchronization." },
      { key: "smsShortcode", label: "SMS Shortcode / Sender ID", type: "text", placeholder: "+1855...", hint: "Custom sender ID or shortcode registered for VIP SMS alerts." },
      { key: "vipThreshold", label: "VIP Tier Threshold ($ USD)", type: "number", placeholder: "5000", hint: "Customer lifetime spend required to auto-trigger the VIP Welcome flow." }
    ]
  },
  "social-analytics": {
    title: "Central Analytics Engine Configuration",
    fields: [
      { key: "attributionModel", label: "Revenue Attribution Model", type: "select", options: [
        { label: "First Click (Launch Focus)", value: "first_click" },
        { label: "Last Click (Conversion Focus)", value: "last_click" },
        { label: "Linear (Equal Weight)", value: "linear" },
        { label: "Time Decay (Recent Priority)", value: "time_decay" }
      ], hint: "Determines how purchase value is split across social touchpoints." },
      { key: "reportingWeekStart", label: "Weekly Report Start Day", type: "select", options: [
        { label: "Monday", value: "monday" },
        { label: "Sunday", value: "sunday" }
      ], hint: "The starting day used for scheduling and trend reports." }
    ]
  },
  "google-analytics-4": {
    title: "Google Analytics 4 & Tag Manager",
    fields: [
      { key: "measurementId", label: "GA4 Measurement ID", type: "text", placeholder: "G-XXXXXXXXXX", hint: "Your Google Analytics 4 stream identifier." },
      { key: "gtmContainerId", label: "GTM Container ID", type: "text", placeholder: "GTM-XXXXXX", hint: "Google Tag Manager container ID." },
      { key: "enhancedEcommerce", label: "Enhanced E-commerce Event Logging", type: "boolean", hint: "Enable detailed tracking of product views, cart additions, and checkout steps." }
    ]
  },
  "printful-fulfillment": {
    title: "Printful Integration Configuration",
    fields: [
      { key: "apiKey", label: "Printful Store API Token", type: "password", placeholder: "Enter Printful Token...", hint: "Your store-specific API token from Printful Developer Center." },
      { key: "shippingService", label: "Preferred Shipping Method", type: "select", options: [
        { label: "Standard Flat Rate", value: "standard" },
        { label: "Express Couriers Only", value: "express" },
        { label: "Cheapest Available Method", value: "cheapest" }
      ], hint: "Fulfillment center shipping class used for labels." },
      { key: "syncDelay", label: "Order Transmission Delay (Mins)", type: "number", placeholder: "30", hint: "Waits this many minutes before sending orders to Printful, letting clients edit/cancel." }
    ]
  },
  "eprolo-dropshipping": {
    title: "Eprolo Luxury Dropshipping Configuration",
    fields: [
      { key: "apiToken", label: "Eprolo Express API Token", type: "password", placeholder: "Enter Eprolo Token...", hint: "Copy from your Eprolo Account -> Integration Settings." },
      { key: "defaultMarkup", label: "Default Price Markup (%)", type: "number", placeholder: "40", hint: "Default markup added to Eprolo supplier cost for imported items." },
      { key: "customPackingSlip", label: "Include Custom Packing Slip", type: "boolean", hint: "Add a custom branded paper guarantee and invoice inside parcel boxes." }
    ]
  },
  "shipbob-logistics": {
    title: "ShipBob 3PL Logistics Configuration",
    fields: [
      { key: "accessToken", label: "ShipBob API Access Token", type: "password", placeholder: "Enter Token...", hint: "Generate in your ShipBob Developer Dashboard." },
      { key: "primaryFacility", label: "Primary Warehouse Facility", type: "select", options: [
        { label: "US East (New Jersey)", value: "us_east" },
        { label: "US West (California)", value: "us_west" },
        { label: "Europe Central (Frankfurt)", value: "eu_central" }
      ], hint: "Primary distribution center mapped to your product inventory." },
      { key: "alertThreshold", label: "Low Inventory Alert Level", type: "number", placeholder: "10", hint: "Triggers a warning notification when stock drops below this level." }
    ]
  },
  "dhl-express": {
    title: "DHL Express Courier Configuration",
    fields: [
      { key: "accountNumber", label: "DHL Express Account Number", type: "text", placeholder: "123456789", hint: "Your corporate or retail DHL billing account number." },
      { key: "apiUsername", label: "API XML Gateway Username", type: "text", placeholder: "Enter username...", hint: "Supplied by your DHL account manager." },
      { key: "apiPassword", label: "API XML Gateway Password", type: "password", placeholder: "••••••••", hint: "Supplied by your DHL account manager." },
      { key: "dutyPayer", label: "Customs Duties Payer (Incoterms)", type: "select", options: [
        { label: "DDU - Delivery Duty Unpaid (Recipient Pays)", value: "ddu" },
        { label: "DDP - Delivery Duty Paid (Merchant Pays)", value: "ddp" }
      ], hint: "Who covers import duties and taxes on cross-border shipments." }
    ]
  },
  "stripe-payments": {
    title: "Stripe Premium Gateway Configuration",
    fields: [
      { key: "publishableKey", label: "Stripe Publishable Key", type: "text", placeholder: "pk_live_...", hint: "Your live or test Stripe API publishable credential." },
      { key: "secretKey", label: "Stripe Secret Key", type: "password", placeholder: "sk_live_...", hint: "Your live or test Stripe API secret credential. Keep highly secure." },
      { key: "webhookSecret", label: "Stripe Webhook Signing Secret", type: "password", placeholder: "whsec_...", hint: "Used to verify authentic webhooks dispatched by Stripe." },
      { key: "sandboxMode", label: "Enable Test Mode / Sandbox", type: "boolean", hint: "Toggles processing with test cards instead of real customer cards." }
    ]
  },
  "paypal-checkout": {
    title: "PayPal Smart Gateway Configuration",
    fields: [
      { key: "clientId", label: "PayPal Client ID", type: "text", placeholder: "Enter client ID...", hint: "Obtained from your developer.paypal.com credentials page." },
      { key: "secretKey", label: "PayPal Client Secret", type: "password", placeholder: "Enter secret...", hint: "Keep highly secure." },
      { key: "sandboxMode", label: "Enable Sandbox (Test Mode)", type: "boolean", hint: "Process checkout requests using sandbox buyer credentials." },
      { key: "payIn4Enabled", label: "Show Pay in 4 Banners", type: "boolean", hint: "Render Buy Now Pay Later banners on luxury product details pages." }
    ]
  }
};

export default function AdminAppStorePage() {
  const [apps, setApps] = useState<AppItem[]>(() => {
    try {
      const savedInstalled = localStorage.getItem("luxe_boutique_installed_apps");
      const savedVersions = localStorage.getItem("luxe_boutique_app_versions");
      const installedIds: string[] | null = savedInstalled ? JSON.parse(savedInstalled) : null;
      const versionsMap: Record<string, string> | null = savedVersions ? JSON.parse(savedVersions) : null;

      return DEFAULT_APPS.map((app) => {
        // Fix incorrect channel action URLs
        let actionUrl = app.actionUrl;
        if (app.id === "tiktok-shop") {
          actionUrl = "/channels/tiktok";
        } else if (app.id === "pinterest-shopping") {
          actionUrl = "/channels/pinterest";
        }

        const isInstalled = installedIds ? installedIds.includes(app.id) : app.isInstalled;
        const currentVersion = versionsMap && versionsMap[app.id] ? versionsMap[app.id] : app.currentVersion;
        const hasUpdate = Boolean(
          isInstalled &&
          app.latestVersion &&
          currentVersion &&
          currentVersion !== app.latestVersion &&
          app.hasUpdate
        );
        return {
          ...app,
          actionUrl,
          isInstalled,
          currentVersion,
          hasUpdate,
        };
      });
    } catch {
      return DEFAULT_APPS.map((app) => {
        let actionUrl = app.actionUrl;
        if (app.id === "tiktok-shop") actionUrl = "/channels/tiktok";
        if (app.id === "pinterest-shopping") actionUrl = "/channels/pinterest";
        return { ...app, actionUrl };
      });
    }
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  // Modals & Async States
  const [detailsModalApp, setDetailsModalApp] = useState<AppItem | null>(null);
  const [installModalApp, setInstallModalApp] = useState<AppItem | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dedicated App Config States
  const [configModalApp, setConfigModalApp] = useState<AppItem | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configValues, setConfigValues] = useState<Record<string, any>>({});
  const [configSuccess, setConfigSuccess] = useState(false);
  const [showConfigSecret, setShowConfigSecret] = useState<Record<string, boolean>>({});

  // OAuth Interactive Simulation States
  const [oauthAuthenticatingStep, setOauthAuthenticatingStep] = useState<"" | "initiating" | "authorizing" | "exchanging" | "completed">("");
  const [isManualConfigExpanded, setIsManualConfigExpanded] = useState<Record<string, boolean>>({});
  const [oauthConnectedApps, setOauthConnectedApps] = useState<Record<string, boolean>>({});

  // Populate OAuth connected states on load and updates
  useEffect(() => {
    try {
      const state: Record<string, boolean> = {};
      apps.forEach((app) => {
        state[app.id] = localStorage.getItem(`luxe_boutique_oauth_connected_${app.id}`) === "true";
      });
      setOauthConnectedApps(state);
    } catch {
      // ignore
    }
  }, [apps, configModalApp]);

  const handleInitiateOauth = async (targetApp: AppItem) => {
    setOauthAuthenticatingStep("initiating");
    await new Promise((resolve) => setTimeout(resolve, 800));
    setOauthAuthenticatingStep("authorizing");
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setOauthAuthenticatingStep("exchanging");
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    // Complete connection!
    try {
      localStorage.setItem(`luxe_boutique_oauth_connected_${targetApp.id}`, "true");
      setOauthConnectedApps((prev) => ({ ...prev, [targetApp.id]: true }));
      
      // Auto-populate relevant fields in config values
      const schema = APP_CONFIG_SCHEMA[targetApp.id];
      const autoValues: Record<string, any> = {};
      const saved = localStorage.getItem(`luxe_boutique_app_config_${targetApp.id}`);
      if (saved) {
        Object.assign(autoValues, JSON.parse(saved));
      }
      if (schema) {
        schema.fields.forEach(f => {
          if (f.type === "password") {
            autoValues[f.key] = `oauth_tok_${targetApp.id}_${Math.random().toString(36).substring(2, 12)}`;
          } else if (f.type === "text") {
            if (f.key.toLowerCase().includes("id")) {
              autoValues[f.key] = `oauth_id_${Math.random().toString(36).substring(2, 8)}`;
            } else {
              autoValues[f.key] = `Autoconfigured via OAuth 2.0 Login`;
            }
          } else if (f.type === "boolean") {
            autoValues[f.key] = true;
          }
        });
        setConfigValues(autoValues);
        localStorage.setItem(`luxe_boutique_app_config_${targetApp.id}`, JSON.stringify(autoValues));
      }
      setOauthAuthenticatingStep("completed");
      setTimeout(() => setOauthAuthenticatingStep(""), 1000);
      setToastMessage(`✓ Authorized & Connected ${targetApp.name} via OAuth 2.0.`);
      setTimeout(() => setToastMessage(null), 4500);
    } catch {
      setOauthAuthenticatingStep("");
    }
  };

  const handleDisconnectOauth = async (appId: string) => {
    try {
      localStorage.removeItem(`luxe_boutique_oauth_connected_${appId}`);
      localStorage.removeItem(`luxe_boutique_app_config_${appId}`);
      setOauthConnectedApps((prev) => ({ ...prev, [appId]: false }));
      
      // Reset values
      const defaults: Record<string, any> = {};
      const schema = APP_CONFIG_SCHEMA[appId];
      if (schema) {
        schema.fields.forEach(f => {
          defaults[f.key] = f.type === "boolean" ? false : "";
        });
      }
      setConfigValues(defaults);
      setToastMessage(`Revoked OAuth connection for ${configModalApp?.name}.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch {
      // ignore
    }
  };

  const handleOpenConfigModal = (app: AppItem) => {
    setConfigModalApp(app);
    setConfigSuccess(false);
    setShowConfigSecret({});
    
    let loadedValues: Record<string, any> = {};
    try {
      const saved = localStorage.getItem(`luxe_boutique_app_config_${app.id}`);
      if (saved) {
        loadedValues = JSON.parse(saved);
      } else {
        const schema = APP_CONFIG_SCHEMA[app.id];
        if (schema) {
          schema.fields.forEach(f => {
            if (f.type === "boolean") {
              loadedValues[f.key] = false;
            } else if (f.type === "number") {
              loadedValues[f.key] = "";
            } else if (f.type === "select") {
              loadedValues[f.key] = f.options?.[0]?.value || "";
            } else {
              loadedValues[f.key] = "";
            }
          });
        }
      }
      setConfigValues(loadedValues);
    } catch {
      loadedValues = {};
      setConfigValues({});
    }

    // Auto-initiate OAuth flow if not already connected
    const isConnected = localStorage.getItem(`luxe_boutique_oauth_connected_${app.id}`) === "true";
    if (!isConnected) {
      handleInitiateOauth(app);
    }
  };

  const handleSaveConfig = async () => {
    if (!configModalApp) return;
    setConfigSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    try {
      localStorage.setItem(`luxe_boutique_app_config_${configModalApp.id}`, JSON.stringify(configValues));
      setToastMessage(`✓ Saved dedicated configuration for ${configModalApp.name}.`);
      setConfigSuccess(true);
      setTimeout(() => setToastMessage(null), 4000);
    } catch {
      // ignore
    }
    setConfigSaving(false);
  };

  // Update Management States
  const [updatingAppIds, setUpdatingAppIds] = useState<string[]>([]);
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [isUpdatesSectionOpen, setIsUpdatesSectionOpen] = useState(true);

  // Computed pending updates list
  const pendingUpdates = apps.filter((app) => app.isInstalled && app.hasUpdate);

  // Sync installed state changes to localStorage
  const persistInstalledApps = (updatedApps: AppItem[]) => {
    try {
      const installedIds = updatedApps
        .filter((a) => a.isInstalled)
        .map((a) => a.id);
      localStorage.setItem("luxe_boutique_installed_apps", JSON.stringify(installedIds));
    } catch {
      // ignore
    }
  };

  // Sync version state changes to localStorage
  const persistAppVersions = (updatedApps: AppItem[]) => {
    try {
      const versionsMap = updatedApps.reduce((acc, a) => {
        if (a.currentVersion) acc[a.id] = a.currentVersion;
        return acc;
      }, {} as Record<string, string>);
      localStorage.setItem("luxe_boutique_app_versions", JSON.stringify(versionsMap));
    } catch {
      // ignore
    }
  };

  // Handle single app update
  const handleUpdateApp = (appId: string) => {
    if (updatingAppIds.includes(appId)) return;
    setUpdatingAppIds((prev) => [...prev, appId]);
    const targetApp = apps.find((a) => a.id === appId);

    setTimeout(() => {
      const updated = apps.map((a) => {
        if (a.id === appId) {
          return {
            ...a,
            hasUpdate: false,
            currentVersion: a.latestVersion || a.currentVersion,
          };
        }
        return a;
      });
      setApps(updated);
      persistAppVersions(updated);
      setUpdatingAppIds((prev) => prev.filter((id) => id !== appId));

      if (detailsModalApp?.id === appId) {
        setDetailsModalApp({
          ...detailsModalApp,
          hasUpdate: false,
          currentVersion: targetApp?.latestVersion || detailsModalApp.currentVersion,
        });
      }

      setToastMessage(`✓ ${targetApp?.name || "Application"} updated to ${targetApp?.latestVersion || "latest version"}.`);
      setTimeout(() => setToastMessage(null), 4500);
    }, 850);
  };

  // Handle batch update of all installed apps
  const handleUpdateAll = () => {
    if (pendingUpdates.length === 0 || isUpdatingAll) return;
    setIsUpdatingAll(true);
    const idsToUpdate = pendingUpdates.map((a) => a.id);
    setUpdatingAppIds((prev) => Array.from(new Set([...prev, ...idsToUpdate])));

    setTimeout(() => {
      const updated = apps.map((a) => {
        if (idsToUpdate.includes(a.id)) {
          return {
            ...a,
            hasUpdate: false,
            currentVersion: a.latestVersion || a.currentVersion,
          };
        }
        return a;
      });
      setApps(updated);
      persistAppVersions(updated);
      setUpdatingAppIds([]);
      setIsUpdatingAll(false);

      if (detailsModalApp && idsToUpdate.includes(detailsModalApp.id)) {
        setDetailsModalApp({
          ...detailsModalApp,
          hasUpdate: false,
          currentVersion: detailsModalApp.latestVersion || detailsModalApp.currentVersion,
        });
      }

      setToastMessage(`✓ Successfully updated all ${idsToUpdate.length} applications to their latest certified versions.`);
      setTimeout(() => setToastMessage(null), 5000);
    }, 1300);
  };

  // Handle check for updates
  const handleCheckForUpdates = () => {
    setCheckingUpdates(true);
    setTimeout(() => {
      setCheckingUpdates(false);
      setToastMessage("✓ Version check complete. Installed integrations are synchronized with latest releases.");
      setTimeout(() => setToastMessage(null), 3500);
    }, 700);
  };

  // Category Tab Definitions
  const categories = [
    {
      id: "all",
      label: "All Applications",
      icon: <MdStorefront className="text-base" />,
      count: apps.length,
    },
    ...(pendingUpdates.length > 0
      ? [
          {
            id: "updates",
            label: "Updates Available",
            icon: <MdSystemUpdateAlt className="text-base text-amber-500" />,
            count: pendingUpdates.length,
            isUpdateTab: true,
          },
        ]
      : []),
    {
      id: "marketing",
      label: "Marketing",
      icon: <MdChat className="text-base" />,
      count: apps.filter((a) => a.category === "marketing").length,
    },
    {
      id: "sales",
      label: "Sales & Channels",
      icon: <MdHub className="text-base" />,
      count: apps.filter((a) => a.category === "sales").length,
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: <MdAnalytics className="text-base" />,
      count: apps.filter((a) => a.category === "analytics").length,
    },
    {
      id: "fulfillment",
      label: "Fulfillment",
      icon: <MdLocalShipping className="text-base" />,
      count: apps.filter((a) => a.category === "fulfillment").length,
    },
    {
      id: "payments",
      label: "Payments",
      icon: <MdPayment className="text-base" />,
      count: apps.filter((a) => a.category === "payments").length,
    },
  ];

  // Filtering logic: by Category and by Search query (matching name, category, tagline, description, tags)
  const filteredApps = apps.filter((app) => {
    const matchesCategory =
      selectedCategory === "all"
        ? true
        : selectedCategory === "updates"
        ? app.isInstalled && app.hasUpdate
        : app.category === selectedCategory;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return matchesCategory;

    const matchesName = app.name.toLowerCase().includes(q);
    const matchesCategoryLabel =
      app.category.toLowerCase().includes(q) ||
      app.categoryLabel.toLowerCase().includes(q);
    const matchesTagline = app.tagline.toLowerCase().includes(q);
    const matchesDescription = app.description.toLowerCase().includes(q);
    const matchesTags = app.tags.some((tag) => tag.toLowerCase().includes(q));
    const matchesDeveloper = app.developer.toLowerCase().includes(q);

    return (
      matchesCategory &&
      (matchesName ||
        matchesCategoryLabel ||
        matchesTagline ||
        matchesDescription ||
        matchesTags ||
        matchesDeveloper)
    );
  });

  // Open the Install Confirmation Modal
  const handleOpenInstallModal = (app: AppItem) => {
    setInstallModalApp(app);
    setIsInstalling(false);
    setInstallSuccess(false);
  };

  // Confirm Install Action
  const handleConfirmInstall = () => {
    if (!installModalApp) return;
    setIsInstalling(true);

    setTimeout(() => {
      const updated = apps.map((a) =>
        a.id === installModalApp.id ? { ...a, isInstalled: true } : a
      );
      setApps(updated);
      persistInstalledApps(updated);
      setIsInstalling(false);
      setInstallSuccess(true);
      setToastMessage(`✓ ${installModalApp.name} successfully installed to workspace.`);
      setTimeout(() => setToastMessage(null), 4500);
    }, 900);
  };

  // Uninstall / Disconnect Action
  const handleUninstall = (appId: string) => {
    const updated = apps.map((a) =>
      a.id === appId ? { ...a, isInstalled: false } : a
    );
    setApps(updated);
    persistInstalledApps(updated);
    if (detailsModalApp?.id === appId) {
      setDetailsModalApp({ ...detailsModalApp, isInstalled: false });
    }
    setToastMessage(`Integration uninstalled from workspace.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 sm:space-y-8 pb-20 max-w-7xl mx-auto px-0 sm:px-2">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-4 sm:top-20 right-4 sm:right-6 left-4 sm:left-auto z-50 bg-[#0b1c30] text-white px-4 sm:px-5 py-3.5 rounded-xl shadow-2xl border border-emerald-500/30 flex items-center justify-between sm:justify-start gap-3 animate-in fade-in slide-in-from-top-4 duration-200 max-w-md">
            <div className="flex items-center gap-2.5">
              <MdCheckCircle className="text-emerald-400 text-lg sm:text-xl shrink-0" />
              <span className="text-xs sm:text-sm font-[Manrope] font-semibold">{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white p-1 rounded-md sm:hidden"
            >
              <MdClose className="text-base" />
            </button>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5 sm:pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] sm:text-xs font-[Manrope] font-bold uppercase tracking-widest text-[#006c49] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 inline-flex items-center gap-1">
                <MdStorefront className="text-xs" />
                Ecosystem &amp; App Marketplace
              </span>
              {pendingUpdates.length > 0 && (
                <button
                  type="button"
                  id="updates-notification-badge"
                  onClick={() => setSelectedCategory("updates")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-800 text-[11px] sm:text-xs font-[Manrope] font-bold hover:bg-amber-500/20 transition-all cursor-pointer shadow-2xs group animate-in fade-in"
                  title="Filter to applications with pending updates"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <MdSystemUpdateAlt className="text-xs sm:text-sm text-amber-600 group-hover:scale-110 transition-transform" />
                  <span>{pendingUpdates.length} {pendingUpdates.length === 1 ? "Update" : "Updates"} Available</span>
                </button>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-[#0b1c30] tracking-tight">
              App Store &amp; Integrations
            </h1>
            <p className="text-xs sm:text-sm font-[Manrope] text-[#7c839b] max-w-2xl leading-relaxed">
              Discover, install, and configure certified extensions across Marketing, Sales, Analytics, Fulfillment, and Payments.
            </p>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCheckForUpdates}
              disabled={checkingUpdates}
              className="flex-1 sm:flex-initial justify-center px-3.5 sm:px-4 py-2.5 min-h-[44px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-60"
              title="Check for application updates"
            >
              <MdRefresh className={`text-base text-slate-600 ${checkingUpdates ? "animate-spin text-[#006c49]" : ""}`} />
              <span>{checkingUpdates ? "Checking..." : "Check Updates"}</span>
            </button>
            <Link
              href="/channels"
              className="flex-1 sm:flex-initial justify-center px-3.5 sm:px-4 py-2.5 min-h-[44px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-colors flex items-center gap-2 no-underline shadow-2xs"
            >
              <MdHub className="text-base text-[#006c49]" />
              <span>Channels</span>
            </Link>
            <Link
              href="/providers"
              className="flex-1 sm:flex-initial justify-center px-3.5 sm:px-4 py-2.5 min-h-[44px] bg-black hover:bg-slate-800 text-white text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-colors flex items-center gap-2 no-underline shadow-2xs"
            >
              <MdLocalShipping className="text-base" />
              <span>Providers</span>
            </Link>
          </div>
        </div>

        {/* ── DEDICATED UPDATES MANAGER SECTION ── */}
        {pendingUpdates.length > 0 ? (
          <div
            id="appstore-updates-section"
            className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-emerald-500/10 rounded-2xl border border-amber-300/80 p-4 sm:p-6 shadow-xs relative overflow-hidden animate-in fade-in duration-200"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-200/60 pb-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <MdNotificationsActive className="text-xl animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-serif font-bold text-[#0b1c30]">
                      Application Updates Ready to Install
                    </h3>
                    <span className="text-[10px] font-[Manrope] font-bold px-2 py-0.5 rounded-full bg-amber-200/90 text-amber-900 border border-amber-300">
                      {pendingUpdates.length} {pendingUpdates.length === 1 ? "app has an update" : "apps have updates"}
                    </span>
                  </div>
                  <p className="text-xs font-[Manrope] text-slate-600 mt-0.5">
                    Security patches, official platform features, and certified API enhancements are available for your active boutique integrations.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsUpdatesSectionOpen(!isUpdatesSectionOpen)}
                  className="px-3 py-2 min-h-[38px] bg-white border border-amber-200/80 hover:bg-amber-50 text-slate-700 text-xs font-[Manrope] font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  {isUpdatesSectionOpen ? (
                    <>
                      <MdExpandLess className="text-base" />
                      <span>Collapse</span>
                    </>
                  ) : (
                    <>
                      <MdExpandMore className="text-base" />
                      <span>Expand ({pendingUpdates.length})</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="update-all-apps-btn"
                  onClick={handleUpdateAll}
                  disabled={isUpdatingAll || updatingAppIds.length > 0}
                  className="px-4 py-2 min-h-[38px] bg-[#0b1c30] hover:bg-[#006c49] text-white text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-60"
                >
                  {isUpdatingAll ? (
                    <>
                      <MdAutorenew className="text-base animate-spin" />
                      <span>Updating All...</span>
                    </>
                  ) : (
                    <>
                      <MdUpgrade className="text-base text-amber-400" />
                      <span>Update All ({pendingUpdates.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Collapsible Updates Grid */}
            {isUpdatesSectionOpen && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4">
                {pendingUpdates.map((app) => {
                  const isUpdatingThis = updatingAppIds.includes(app.id);
                  return (
                    <div
                      key={`update-card-${app.id}`}
                      className="bg-white/95 backdrop-blur-xs rounded-xl border border-amber-200/90 p-3.5 sm:p-4 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base ${app.iconBg}`}>
                              {app.icon}
                            </div>
                            <h4 className="text-xs sm:text-sm font-serif font-bold text-[#0b1c30] truncate">
                              {app.name}
                            </h4>
                          </div>
                          <span className="text-[10px] font-[Manrope] font-bold text-amber-800 bg-amber-100/90 border border-amber-200 px-1.5 py-0.5 rounded-md shrink-0">
                            {app.releaseDate || "Latest"}
                          </span>
                        </div>

                        {/* Version Difference */}
                        <div className="flex items-center gap-1.5 text-xs font-[Manrope] mb-2">
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[11px] font-mono">
                            {app.currentVersion || "v1.0.0"}
                          </span>
                          <span className="text-slate-400">➔</span>
                          <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[11px] font-mono border border-emerald-200">
                            {app.latestVersion}
                          </span>
                        </div>

                        {/* Update Notes */}
                        <p className="text-[11px] font-[Manrope] text-slate-600 line-clamp-2 leading-relaxed mb-3">
                          {app.updateNotes || "Security enhancements, official API compatibility updates, and performance optimizations."}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setDetailsModalApp(app)}
                          className="text-[11px] font-[Manrope] text-slate-500 hover:text-slate-900 font-semibold cursor-pointer underline-offset-2 hover:underline"
                        >
                          View Changelog
                        </button>

                        <button
                          type="button"
                          disabled={isUpdatingThis || isUpdatingAll}
                          onClick={() => handleUpdateApp(app.id)}
                          className="px-3 py-1.5 min-h-[34px] bg-[#006c49] hover:bg-[#005538] text-white text-[11px] font-[Manrope] font-bold tracking-wider uppercase rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                        >
                          {isUpdatingThis ? (
                            <>
                              <MdAutorenew className="text-xs animate-spin" />
                              <span>Updating...</span>
                            </>
                          ) : (
                            <>
                              <MdSystemUpdateAlt className="text-xs" />
                              <span>Update to {app.latestVersion}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200/70 px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-[Manrope]">
            <div className="flex items-center gap-2 text-emerald-900">
              <MdCheckCircle className="text-emerald-600 text-base shrink-0" />
              <span>
                All <strong>{apps.filter((a) => a.isInstalled).length}</strong> installed applications are running the latest verified release versions.
              </span>
            </div>
            <button
              type="button"
              onClick={handleCheckForUpdates}
              disabled={checkingUpdates}
              className="inline-flex items-center gap-1.5 text-[#006c49] hover:text-[#005538] font-bold cursor-pointer shrink-0 disabled:opacity-50 self-start sm:self-auto"
            >
              <MdRefresh className={`text-sm ${checkingUpdates ? "animate-spin" : ""}`} />
              <span>{checkingUpdates ? "Checking..." : "Check for Updates"}</span>
            </button>
          </div>
        )}

        {/* Featured Hero Banner */}
        <div className="bg-gradient-to-r from-[#0b1c30] via-[#122844] to-[#1e3a63] rounded-2xl p-5 sm:p-7 md:p-8 text-white relative overflow-hidden shadow-md">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-[11px] sm:text-xs font-[Manrope] font-semibold mb-3 sm:mb-4 backdrop-blur-xs border border-white/10">
              <MdOutlineWorkspacePremium className="text-amber-400 text-sm sm:text-base" />
              <span>Recommended Flagship Integration</span>
            </div>
            <h2 className="text-lg sm:text-2xl md:text-3xl font-serif font-bold mb-2 sm:mb-3 leading-tight">
              Meta Business Suite &amp; WhatsApp Concierge
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 font-[Manrope] leading-relaxed mb-5 sm:mb-6">
              Connect your boutique once to activate Facebook Page sync, Instagram Shoppable
              posts, WhatsApp VIP order notifications, and dynamic product catalogs in your workspace.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
              <Link
                href="/channels/meta-business"
                className="justify-center px-5 sm:px-6 py-2.5 min-h-[44px] bg-[#0668E1] hover:bg-blue-600 text-white text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-colors flex items-center gap-2 no-underline shadow-sm"
              >
                <SiMeta className="text-base" />
                <span>Launch Meta Suite</span>
              </Link>
              <Link
                href="/channels/whatsapp"
                className="justify-center px-5 sm:px-6 py-2.5 min-h-[44px] bg-white/10 hover:bg-white/20 text-white text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-colors flex items-center gap-2 backdrop-blur-xs no-underline"
              >
                <SiWhatsapp className="text-base text-[#25D366]" />
                <span>WhatsApp Settings</span>
              </Link>
            </div>
          </div>

          <div className="hidden lg:flex absolute right-8 xl:right-10 top-1/2 -translate-y-1/2 items-center gap-3 opacity-90 pointer-events-none">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
              <SiMeta className="text-3xl text-white" />
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
              <SiWhatsapp className="text-3xl text-[#25D366]" />
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
              <SiInstagram className="text-3xl text-[#E4405F]" />
            </div>
          </div>
        </div>

        {/* ── SEARCH BAR SECTION ── */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <MdSearch className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
              <input
                id="appstore-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search apps by name, category (e.g. Marketing, Sales), tag, or keyword..."
                className="w-full pl-10 sm:pl-11 pr-10 py-2.5 sm:py-3 min-h-[44px] text-xs sm:text-sm font-[Manrope] bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006c49]/20 focus:border-[#006c49] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-200 cursor-pointer transition-colors"
                  title="Clear search"
                >
                  <MdClose className="text-base" />
                </button>
              )}
            </div>

            {/* Quick search stats */}
            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs font-[Manrope] text-slate-500 shrink-0 px-1 sm:px-0">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <MdCheckCircle className="text-emerald-600 text-sm" />
                {filteredApps.length} {filteredApps.length === 1 ? "app" : "apps"} found
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-[#006c49] hover:underline font-bold cursor-pointer py-1 px-1.5"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Search suggestions tags */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 sm:gap-2 overflow-x-auto text-[11px] font-[Manrope] text-slate-500 pb-1 scrollbar-none">
            <span className="text-slate-400 uppercase font-bold tracking-wider text-[10px] shrink-0">
              Popular:
            </span>
            {["Marketing", "Sales", "Analytics", "Meta", "Dropshipping", "Klaviyo", "TikTok", "Stripe"].map(
              (term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setSearchQuery(term)}
                  className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 font-medium min-h-[32px] flex items-center ${
                    searchQuery.toLowerCase() === term.toLowerCase()
                      ? "bg-[#006c49] text-white font-bold"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 active:bg-slate-300"
                  }`}
                >
                  {term}
                </button>
              )
            )}
          </div>
        </div>

        {/* ── CATEGORY TABS ── */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2.5 px-0.5">
            <h2 className="text-xs font-[Manrope] font-bold text-slate-700 uppercase tracking-widest">
              Browse Categories
            </h2>
            <span className="text-xs font-[Manrope] text-slate-500 hidden sm:inline">
              Category: <strong className="text-slate-900 capitalize font-bold">{selectedCategory}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-0.5 scrollbar-none border-b border-slate-200/80 -mx-4 px-4 sm:mx-0 sm:px-0">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  id={`category-tab-${cat.id}`}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 sm:px-4 py-2 sm:py-2.5 min-h-[40px] rounded-xl text-xs font-[Manrope] font-bold tracking-wide transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                    isSelected
                      ? "bg-[#0b1c30] text-white shadow-md"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100"
                  }`}
                >
                  <span className={isSelected ? "text-emerald-400" : "text-slate-400"}>
                    {cat.icon}
                  </span>
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── APPS GRID ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all p-4 sm:p-5 flex flex-col justify-between group"
            >
              <div>
                {/* App Card Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-11 sm:w-12 h-11 sm:h-12 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${app.iconBg}`}
                    >
                      {app.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm sm:text-base font-serif font-bold text-[#0b1c30] leading-tight group-hover:text-[#006c49] transition-colors truncate">
                        {app.name}
                      </h3>
                      <p className="text-[11px] font-[Manrope] text-[#7c839b] mt-0.5 truncate">
                        {app.developer}
                      </p>
                    </div>
                  </div>

                  {app.isInstalled ? (
                    app.hasUpdate ? (
                      <span className="text-[10px] font-[Manrope] font-bold bg-amber-50 border border-amber-300 text-amber-800 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 animate-pulse">
                        <MdSystemUpdateAlt className="text-xs text-amber-600" />
                        Update {app.latestVersion}
                      </span>
                    ) : (
                      <span className="text-[10px] font-[Manrope] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                        <MdCheckCircle className="text-xs" />
                        Installed {app.currentVersion ? `· ${app.currentVersion}` : ""}
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] font-[Manrope] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full shrink-0">
                      Available
                    </span>
                  )}
                </div>

                {/* Rating & Category */}
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2.5 flex-wrap">
                  <div className="flex items-center text-amber-500 font-bold gap-0.5">
                    <MdStar className="text-sm" />
                    <span>{app.rating}</span>
                  </div>
                  <span>·</span>
                  <span className="text-[11px] font-[Manrope] text-slate-400">
                    ({app.reviewsCount} reviews)
                  </span>
                  <span>·</span>
                  <span className="text-[11px] font-[Manrope] text-[#006c49] font-bold">
                    {app.categoryLabel}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs font-[Manrope] text-slate-600 leading-relaxed line-clamp-3 mb-3.5">
                  {app.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {app.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-[Manrope] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setDetailsModalApp(app)}
                  className="text-xs font-[Manrope] font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer py-2 px-1 min-h-[40px] flex items-center"
                >
                  View Details
                </button>

                <div className="flex items-center gap-2">
                  {app.isInstalled ? (
                    <>
                      {app.hasUpdate && (
                        <button
                          type="button"
                          disabled={updatingAppIds.includes(app.id) || isUpdatingAll}
                          onClick={() => handleUpdateApp(app.id)}
                          className="px-3 py-2 min-h-[40px] bg-amber-500 hover:bg-amber-600 text-white text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                          title={`Update from ${app.currentVersion || "current"} to ${app.latestVersion}`}
                        >
                          {updatingAppIds.includes(app.id) ? (
                            <>
                              <MdAutorenew className="text-sm animate-spin" />
                              <span>Updating...</span>
                            </>
                          ) : (
                            <>
                              <MdSystemUpdateAlt className="text-sm" />
                              <span>Update</span>
                            </>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenConfigModal(app)}
                        className="px-3.5 sm:px-4 py-2 min-h-[40px] bg-slate-900 hover:bg-[#006c49] text-white text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <span>{app.actionLabel}</span>
                        <MdArrowForward className="text-xs" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenInstallModal(app)}
                      className="px-3.5 sm:px-4 py-2 min-h-[40px] bg-[#006c49] hover:bg-[#005538] text-white text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <MdAdd className="text-base" />
                      <span>Install</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty Search / Category Results */}
        {filteredApps.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center max-w-lg mx-auto shadow-2xs">
            <div className="w-12 sm:w-14 h-12 sm:h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MdSearch className="text-2xl sm:text-3xl" />
            </div>
            <h3 className="text-base sm:text-lg font-serif font-bold text-[#0b1c30]">No applications found</h3>
            <p className="text-xs font-[Manrope] text-[#7c839b] mt-1.5 leading-relaxed">
              We couldn&apos;t find any applications matching &ldquo;{searchQuery}&rdquo; in the &ldquo;{selectedCategory}&rdquo; category.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              <button
                onClick={() => setSearchQuery("")}
                className="px-4 py-2 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-[Manrope] font-bold rounded-xl cursor-pointer"
              >
                Clear Search
              </button>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="px-4 py-2 min-h-[40px] bg-[#006c49] text-white text-xs font-[Manrope] font-bold rounded-xl cursor-pointer"
              >
                Show All Apps
              </button>
            </div>
          </div>
        )}

        {/* ── INSTALL CONFIRMATION MODAL ── */}
        {installModalApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden">
              {/* Modal Header */}
              <div className="p-4 sm:p-6 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#006c49] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                    Install to Workspace
                  </span>
                </div>
                {!isInstalling && (
                  <button
                    onClick={() => {
                      setInstallModalApp(null);
                      setInstallSuccess(false);
                    }}
                    className="text-slate-400 hover:text-slate-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 cursor-pointer"
                  >
                    <MdClose className="text-xl" />
                  </button>
                )}
              </div>

              {/* Modal Scrollable Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                {!installSuccess ? (
                  <>
                    <h3 className="text-lg sm:text-xl font-serif font-bold text-[#0b1c30]">
                      Confirm App Installation
                    </h3>

                    {/* App Summary Card */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 sm:p-4 flex items-center gap-3.5">
                      <div
                        className={`w-12 sm:w-14 h-12 sm:h-14 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${installModalApp.iconBg}`}
                      >
                        {installModalApp.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm sm:text-base font-serif font-bold text-[#0b1c30] truncate">
                          {installModalApp.name}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                          <span className="font-semibold text-slate-700 truncate">
                            {installModalApp.developer}
                          </span>
                          <span>·</span>
                          <span className="text-[#006c49] font-bold">
                            {installModalApp.categoryLabel}
                          </span>
                          <span>·</span>
                          <span className="flex items-center text-amber-500 font-bold">
                            <MdStar className="text-sm" /> {installModalApp.rating}
                          </span>
                        </div>
                        <p className="text-[11px] font-[Manrope] text-slate-600 mt-1 line-clamp-2">
                          {installModalApp.tagline}
                        </p>
                      </div>
                    </div>

                    {/* Requested Permissions Box */}
                    <div>
                      <div className="flex items-center gap-2 text-xs font-[Manrope] font-bold text-[#0b1c30] uppercase tracking-wider mb-2">
                        <MdSecurity className="text-[#006c49] text-base" />
                        <span>Workspace Permissions &amp; Data Access</span>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2">
                        {installModalApp.permissions.map((perm, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2.5 text-xs font-[Manrope] text-slate-700"
                          >
                            <MdCheck className="text-emerald-600 text-base shrink-0 mt-0.5" />
                            <span>{perm}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Agreement notice */}
                    <p className="text-[11px] font-[Manrope] text-slate-500 leading-relaxed">
                      By confirming, you authorize <strong>{installModalApp.name}</strong> to connect to your Luxe Boutique workspace. You can disconnect or manage permissions anytime from Settings.
                    </p>
                  </>
                ) : (
                  /* Success View inside modal */
                  <div className="text-center py-4 sm:py-6">
                    <div className="w-14 sm:w-16 h-14 sm:h-16 bg-emerald-100 text-[#006c49] rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in-75 duration-200">
                      <MdCheckCircle className="text-3xl sm:text-4xl" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-serif font-bold text-[#0b1c30] mb-2">
                      Application Installed!
                    </h3>
                    <p className="text-xs sm:text-sm font-[Manrope] text-slate-600 max-w-sm mx-auto mb-6">
                      <strong>{installModalApp.name}</strong> has been successfully installed and authorized for your boutique workspace.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setInstallModalApp(null);
                          setInstallSuccess(false);
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] text-xs font-[Manrope] font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                      >
                        Back to Store
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const target = installModalApp;
                          setInstallModalApp(null);
                          setInstallSuccess(false);
                          handleOpenConfigModal(target);
                        }}
                        className="w-full sm:w-auto justify-center px-6 py-2.5 min-h-[44px] bg-[#006c49] hover:bg-[#005538] text-white text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
                      >
                        <span>Configure App</span>
                        <MdArrowForward className="text-xs" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer with Actions (Only when not success) */}
              {!installSuccess && (
                <div className="p-4 sm:p-6 pt-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-end gap-2.5 sm:gap-3 shrink-0">
                  <button
                    type="button"
                    disabled={isInstalling}
                    onClick={() => setInstallModalApp(null)}
                    className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] text-xs font-[Manrope] font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isInstalling}
                    onClick={handleConfirmInstall}
                    className="w-full sm:w-auto justify-center px-6 py-2.5 min-h-[44px] bg-[#006c49] hover:bg-[#005538] text-white text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isInstalling ? (
                      <>
                        <MdAutorenew className="text-base animate-spin" />
                        <span>Adding to Workspace...</span>
                      </>
                    ) : (
                      <>
                        <MdCheckCircle className="text-base" />
                        <span>Confirm &amp; Install</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DETAILS MODAL ── */}
        {detailsModalApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden">
              {/* Header */}
              <div className="p-4 sm:p-6 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 sm:w-12 h-11 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${detailsModalApp.iconBg}`}
                  >
                    {detailsModalApp.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-serif font-bold text-[#0b1c30] truncate">
                      {detailsModalApp.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-[Manrope] mt-0.5 flex-wrap">
                      <span className="text-[#006c49] font-bold truncate">
                        {detailsModalApp.developer} · {detailsModalApp.categoryLabel}
                      </span>
                      {detailsModalApp.currentVersion && (
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          Installed: {detailsModalApp.currentVersion}
                        </span>
                      )}
                      {detailsModalApp.latestVersion && (
                        <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                          Latest: {detailsModalApp.latestVersion}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setDetailsModalApp(null)}
                  className="text-slate-400 hover:text-slate-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 cursor-pointer shrink-0 ml-2"
                >
                  <MdClose className="text-xl" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                {/* Available Update Notification in Modal */}
                {detailsModalApp.hasUpdate && (
                  <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3.5 sm:p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-[Manrope] font-bold text-amber-900">
                        <MdSystemUpdateAlt className="text-base text-amber-600 animate-bounce" />
                        <span>Version {detailsModalApp.latestVersion} is Available</span>
                      </div>
                      <span className="text-[10px] font-[Manrope] font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                        {detailsModalApp.releaseDate || "Latest Release"}
                      </span>
                    </div>

                    <p className="text-xs font-[Manrope] text-slate-700 leading-relaxed">
                      {detailsModalApp.updateNotes ||
                        "Includes latest stability improvements, official third-party API synchronization, and security upgrades."}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-amber-200/60">
                      <span className="text-[11px] font-[Manrope] text-amber-800">
                        Upgrades {detailsModalApp.currentVersion || "current"} ➔ {detailsModalApp.latestVersion}
                      </span>
                      <button
                        type="button"
                        disabled={updatingAppIds.includes(detailsModalApp.id) || isUpdatingAll}
                        onClick={() => handleUpdateApp(detailsModalApp.id)}
                        className="px-3.5 py-1.5 min-h-[34px] bg-amber-600 hover:bg-amber-700 text-white text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                      >
                        {updatingAppIds.includes(detailsModalApp.id) ? (
                          <>
                            <MdAutorenew className="text-xs animate-spin" />
                            <span>Updating...</span>
                          </>
                        ) : (
                          <>
                            <MdSystemUpdateAlt className="text-xs" />
                            <span>Update Now</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-[Manrope] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    About this App
                  </h4>
                  <p className="text-xs sm:text-sm font-[Manrope] text-slate-600 leading-relaxed">
                    {detailsModalApp.description}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-[Manrope] font-bold text-[#0b1c30] uppercase tracking-wider mb-2">
                    Key Capabilities &amp; Features
                  </h4>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2">
                    {detailsModalApp.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-[Manrope] text-slate-700">
                        <MdCheckCircle className="text-[#006c49] text-base shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-[Manrope] font-bold text-[#0b1c30] uppercase tracking-wider mb-2">
                    Permissions &amp; Data Access
                  </h4>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2">
                    {detailsModalApp.permissions.map((perm, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-[Manrope] text-slate-700">
                        <MdSecurity className="text-slate-500 text-base shrink-0 mt-0.5" />
                        <span>{perm}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-6 pt-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div>
                  {detailsModalApp.isInstalled ? (
                    <button
                      type="button"
                      onClick={() => handleUninstall(detailsModalApp.id)}
                      className="text-xs font-[Manrope] font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer py-1"
                    >
                      Uninstall App from Workspace
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 font-[Manrope]">Not installed yet</span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setDetailsModalApp(null)}
                    className="flex-1 sm:flex-initial px-4 py-2 min-h-[40px] text-xs font-[Manrope] font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Close
                  </button>

                  {detailsModalApp.isInstalled ? (
                    <div className="flex items-center gap-2">
                      {detailsModalApp.hasUpdate && (
                        <button
                          type="button"
                          disabled={updatingAppIds.includes(detailsModalApp.id) || isUpdatingAll}
                          onClick={() => handleUpdateApp(detailsModalApp.id)}
                          className="px-4 py-2 min-h-[40px] bg-amber-500 hover:bg-amber-600 text-white text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                        >
                          {updatingAppIds.includes(detailsModalApp.id) ? (
                            <>
                              <MdAutorenew className="text-sm animate-spin" />
                              <span>Updating...</span>
                            </>
                          ) : (
                            <>
                              <MdSystemUpdateAlt className="text-sm" />
                              <span>Update</span>
                            </>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const target = detailsModalApp;
                          setDetailsModalApp(null);
                          handleOpenConfigModal(target);
                        }}
                        className="flex-1 sm:flex-initial justify-center px-5 py-2 min-h-[40px] bg-slate-900 hover:bg-[#006c49] text-white text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <span>{detailsModalApp.actionLabel}</span>
                        <MdArrowForward className="text-xs" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const target = detailsModalApp;
                        setDetailsModalApp(null);
                        handleOpenInstallModal(target);
                      }}
                      className="flex-1 sm:flex-initial justify-center px-5 py-2 min-h-[40px] bg-[#006c49] hover:bg-[#005538] text-white text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <MdAdd className="text-base" />
                      <span>Install</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DEDICATED APP CONFIGURATION MODAL ── */}
        {configModalApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden animate-in zoom-in-95 duration-150">
              
              {/* Modal Header */}
              <div className="p-4 sm:p-6 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 sm:w-12 h-10 sm:h-12 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${configModalApp.iconBg}`}>
                    {configModalApp.icon}
                  </div>
                  <div className="min-w-0">
                    {oauthAuthenticatingStep !== "" ? (
                      <>
                        <span className="text-[9px] font-[Manrope] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60 animate-pulse">
                          🔐 INITIATING SECURE OAUTH 2.0 HANDSHAKE
                        </span>
                        <h3 className="text-sm sm:text-base font-serif font-bold text-[#0b1c30] truncate mt-0.5">
                          Authenticating {configModalApp.name}...
                        </h3>
                      </>
                    ) : oauthConnectedApps[configModalApp.id] ? (
                      <>
                        <span className="text-[9px] font-[Manrope] font-bold uppercase tracking-wider text-[#006c49] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                          <span>⚡ ACTIVE ENTERPRISE MANAGEMENT PORTAL</span>
                        </span>
                        <h3 className="text-sm sm:text-base font-serif font-bold text-[#0b1c30] truncate mt-0.5">
                          {configModalApp.name} Management Console
                        </h3>
                      </>
                    ) : (
                      <>
                        <span className="text-[9px] font-[Manrope] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          🔌 OAUTH 2.0 CONNECTION PENDING
                        </span>
                        <h3 className="text-sm sm:text-base font-serif font-bold text-[#0b1c30] truncate mt-0.5">
                          {configModalApp.name} Connection Setup
                        </h3>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={configSaving}
                  onClick={() => setConfigModalApp(null)}
                  className="text-slate-400 hover:text-slate-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 cursor-pointer shrink-0 ml-2"
                >
                  <MdClose className="text-xl" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
                
                {/* Integration Status Indicator */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-[Manrope] font-semibold text-slate-400 uppercase tracking-wide">
                      Connection Status
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${configSuccess || localStorage.getItem(`luxe_boutique_app_config_${configModalApp.id}`) ? "bg-emerald-500" : "bg-amber-500"}`} />
                      <span className="text-xs font-[Manrope] font-bold text-[#0b1c30]">
                        {configSuccess || localStorage.getItem(`luxe_boutique_app_config_${configModalApp.id}`) ? "CONNECTED & ACTIVE" : "PENDING SETUP"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-[Manrope] font-semibold text-slate-400 uppercase tracking-wide block">
                      Developer
                    </span>
                    <span className="text-xs font-[Manrope] font-bold text-slate-700">
                      {configModalApp.developer}
                    </span>
                  </div>
                </div>

                {/* Dynamic Configuration Form & Interactive OAuth Core */}
                {APP_CONFIG_SCHEMA[configModalApp.id] ? (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    
                    {/* UNIVERSAL OAUTH 2.0 AUTHENTICATION WIDGET */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-[Manrope] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <MdSecurity className="text-emerald-600 text-sm" />
                            <span>OAuth 2.0 Integration</span>
                          </h4>
                          <p className="text-[10px] text-slate-400 font-[Manrope]">
                            Authorized Single Sign-On connection protocol.
                          </p>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-md uppercase tracking-wider border border-slate-300/30">
                          Secure Protocol
                        </span>
                      </div>

                      {/* Case 1: OAuth Authentication in Progress */}
                      {oauthAuthenticatingStep !== "" && (
                        <div className="py-6 flex flex-col items-center justify-center text-center space-y-3 animate-pulse">
                          <MdAutorenew className="text-2xl text-[#006c49] animate-spin" />
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-[#006c49] uppercase tracking-widest font-[Manrope]">
                              {oauthAuthenticatingStep === "initiating" && "Redirecting to Auth Server..."}
                              {oauthAuthenticatingStep === "authorizing" && "Authorizing Scopes..."}
                              {oauthAuthenticatingStep === "exchanging" && "Exchanging Code for Tokens..."}
                              {oauthAuthenticatingStep === "completed" && "Connection Verified!"}
                            </span>
                            <p className="text-[11px] text-slate-500 font-[Manrope] max-w-xs mx-auto">
                              {oauthAuthenticatingStep === "initiating" && "Redirecting you to the official OAuth 2.0 provider page..."}
                              {oauthAuthenticatingStep === "authorizing" && "Awaiting secure credential consent and scope approvals..."}
                              {oauthAuthenticatingStep === "exchanging" && "Securing public-private keypairs and syncing data feeds..."}
                              {oauthAuthenticatingStep === "completed" && "Storing encrypted credentials and establishing live webhooks."}
                            </p>
                          </div>
                          <div className="w-40 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full bg-[#006c49] transition-all duration-1000 ${
                                oauthAuthenticatingStep === "initiating" ? "w-1/4" :
                                oauthAuthenticatingStep === "authorizing" ? "w-2/3" :
                                oauthAuthenticatingStep === "exchanging" ? "w-11/12" : "w-full"
                              }`} 
                            />
                          </div>
                        </div>
                      )}

                      {/* Case 2: OAuth Connected & Turned Into Management Portal */}
                      {oauthAuthenticatingStep === "" && oauthConnectedApps[configModalApp.id] && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                          
                          {/* Live Heartbeat Status Header */}
                          <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-xl flex items-start gap-3">
                            <MdCheckCircle className="text-emerald-600 text-lg shrink-0 mt-0.5 animate-pulse" />
                            <div className="min-w-0 space-y-1">
                              <span className="text-xs font-[Manrope] font-bold text-emerald-800 flex items-center gap-1.5">
                                <span>Real-time Connection Online</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                              </span>
                              <p className="text-[11px] text-emerald-700 font-[Manrope] leading-relaxed">
                                Authorized connection established via secure single sign-on. Dispatched webhooks are active.
                              </p>
                            </div>
                          </div>

                          {/* Profile details */}
                          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-[Manrope]">
                              Connection Identity
                            </span>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-0.5">
                                <span className="text-[9px] text-slate-400 uppercase block font-[Manrope]">Authorized User</span>
                                <div className="flex items-center gap-1 text-slate-700">
                                  <MdPerson className="text-xs text-slate-500" />
                                  <span className="text-xs font-semibold font-[Manrope] truncate">administrator@luxeboutique.com</span>
                                </div>
                              </div>
                              <div className="space-y-0.5">
                                <span className="text-[9px] text-slate-400 uppercase block font-[Manrope]">Access Standard</span>
                                <div className="flex items-center gap-1 text-slate-700">
                                  <MdSecurity className="text-xs text-slate-500" />
                                  <span className="text-xs font-semibold font-[Manrope]">OAuth 2.0 PKCE</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Live Activity Telemetry Terminal Logs */}
                          <div className="bg-slate-900 text-slate-300 rounded-xl p-4 font-mono text-[10px] space-y-2 border border-slate-950 shadow-sm relative overflow-hidden">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                                <span>Live Telemetry &amp; Handshake Logs</span>
                              </span>
                              <span className="text-[8px] text-emerald-400 bg-emerald-950/60 border border-emerald-900/60 px-1.5 py-0.5 rounded uppercase tracking-widest font-bold">
                                Status: Active
                              </span>
                            </div>
                            <div className="space-y-1.5 min-h-[70px] leading-relaxed select-none">
                              {(() => {
                                const id = configModalApp.id;
                                const defaultLogs = [
                                  `[18:07:01] [OAUTH] Handshake parameters authorized successfully.`,
                                  `[18:07:03] [SECURE] Received encrypted refresh token credentials.`,
                                  `[18:08:12] [WEBHOOK] Live webhook listener configured at /api/webhooks/${id}.`,
                                  `[18:08:15] [HEARTBEAT] Connection signature handshake verified: PASS.`
                                ];
                                const logsMap: Record<string, string[]> = {
                                  "meta-business": [
                                    `[18:01:22] [SYNC] Synchronized 412 luxury catalog items with Meta Business Suite.`,
                                    `[18:04:15] [API] Rotated Instagram access token successfully. Scopes preserved.`,
                                    `[18:06:50] [WEBHOOK] Received page engagement event from active customer session.`
                                  ],
                                  "google-workspace": [
                                    `[18:02:11] [CALENDAR] Created Google Calendar slot for VIP Client Styling session.`,
                                    `[18:03:40] [MEET] Provisioned secure Google Meet video link for client styling conference.`,
                                    `[18:06:12] [API] Successfully synchronized calendar directory logs.`
                                  ],
                                  "stripe-payments": [
                                    `[18:01:05] [PAYMENT] Registered live webhook listener for transaction updates.`,
                                    `[18:03:59] [SECURE] Confirmed SHA-256 integrity signature check for payment intents.`,
                                    `[18:06:44] [API] Dispatched daily transaction logs back to parent financial ledger.`
                                  ],
                                  "klaviyo-vip": [
                                    `[18:02:44] [SEGMENT] Synced 1,240 luxury loyalty segment members to Klaviyo.`,
                                    `[18:04:12] [CAMPAIGN] Automated luxury trigger-flow triggered for VIP abandoned carts.`,
                                    `[18:06:33] [WEBHOOK] Received event tag registration from checkout funnel.`
                                  ]
                                };
                                const logs = logsMap[id] || defaultLogs;
                                return logs.map((log, index) => (
                                  <div key={index} className="flex gap-2">
                                    <span className="text-slate-500 shrink-0">&gt;</span>
                                    <span className={index === logs.length - 1 ? "text-emerald-400" : ""}>{log}</span>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>

                          {/* Scopes Display */}
                          {APP_OAUTH_SCOPES[configModalApp.id] && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-[Manrope]">
                                Authorized Access Permissions (Scopes)
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {APP_OAUTH_SCOPES[configModalApp.id].map((scope) => (
                                  <code key={scope} className="text-[9px] font-mono text-slate-600 bg-slate-200/50 px-2 py-0.5 rounded border border-slate-300/30">
                                    {scope}
                                  </code>
                                ))}
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDisconnectOauth(configModalApp.id)}
                            className="w-full min-h-[40px] border border-red-200 hover:bg-red-50 text-red-700 text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <MdLinkOff className="text-base" />
                            <span>Revoke Connection &amp; Disconnect</span>
                          </button>
                        </div>
                      )}

                      {/* Case 3: OAuth Not Connected */}
                      {oauthAuthenticatingStep === "" && !oauthConnectedApps[configModalApp.id] && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-[Manrope]">
                              Requested Access Permissions
                            </span>
                            <div className="space-y-1.5 bg-white border border-slate-200/60 p-3 rounded-xl">
                              {APP_OAUTH_SCOPES[configModalApp.id] ? (
                                APP_OAUTH_SCOPES[configModalApp.id].map((scope) => (
                                  <div key={scope} className="flex items-center gap-2 text-xs font-[Manrope] text-slate-600">
                                    <MdCheck className="text-emerald-600 text-sm shrink-0" />
                                    <span className="font-mono text-[10px] text-slate-500">{scope}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="flex items-center gap-2 text-xs font-[Manrope] text-slate-600">
                                  <MdCheck className="text-emerald-600 text-sm shrink-0" />
                                  <span>Full administrative read and write tokens</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleInitiateOauth(configModalApp)}
                            className="w-full min-h-[44px] bg-slate-900 hover:bg-[#006c49] text-white text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99]"
                          >
                            <MdPerson className="text-base" />
                            <span>Sign In &amp; Connect via secure OAuth 2.0</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* COLLAPSIBLE ACCORDION FOR MANUAL OVERRIDES */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={() => setIsManualConfigExpanded(prev => ({ ...prev, [configModalApp.id]: !prev[configModalApp.id] }))}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 cursor-pointer transition-colors outline-none"
                      >
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-[Manrope] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <MdTune className="text-slate-500 text-sm" />
                            <span>Advanced Manual Parameters</span>
                          </h4>
                          <p className="text-[10px] text-slate-400 font-[Manrope]">
                            Review or manually override autoconfigured API secrets and tokens.
                          </p>
                        </div>
                        <span className="text-xs font-bold text-slate-400 px-2 py-1 rounded bg-slate-100 border border-slate-200/50">
                          {isManualConfigExpanded[configModalApp.id] ? "Collapse" : "Expand"}
                        </span>
                      </button>

                      {isManualConfigExpanded[configModalApp.id] && (
                        <div className="p-4 border-t border-slate-200 bg-slate-50/30 space-y-4 animate-in slide-in-from-top-2 duration-150">
                          {APP_CONFIG_SCHEMA[configModalApp.id].fields.map((field) => (
                            <div key={field.key} className="space-y-1.5">
                              <label className="text-xs font-[Manrope] font-semibold text-[#0b1c30] flex items-center justify-between">
                                <span>{field.label}</span>
                                {field.type === "password" && (
                                  <button
                                    type="button"
                                    onClick={() => setShowConfigSecret(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase cursor-pointer"
                                  >
                                    {showConfigSecret[field.key] ? "Hide" : "Show"}
                                  </button>
                                )}
                              </label>

                              {field.type === "boolean" ? (
                                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
                                  <input
                                    type="checkbox"
                                    id={field.key}
                                    checked={Boolean(configValues[field.key])}
                                    onChange={(e) => setConfigValues(prev => ({ ...prev, [field.key]: e.target.checked }))}
                                    className="w-4 h-4 text-[#006c49] border-slate-300 rounded focus:ring-[#006c49]"
                                  />
                                  <label htmlFor={field.key} className="text-xs font-[Manrope] text-slate-600 select-none cursor-pointer">
                                    Enabled (Active status override)
                                  </label>
                                </div>
                              ) : field.type === "select" ? (
                                <select
                                  value={configValues[field.key] || ""}
                                  onChange={(e) => setConfigValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                                  className="w-full min-h-[40px] bg-slate-50 border border-slate-200 focus:border-[#006c49] focus:bg-white text-xs font-[Manrope] rounded-xl px-3 outline-none transition-all"
                                >
                                  {field.options?.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              ) : field.type === "number" ? (
                                <input
                                  type="number"
                                  placeholder={field.placeholder || "Enter numeric threshold..."}
                                  value={configValues[field.key] || ""}
                                  onChange={(e) => setConfigValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                                  className="w-full min-h-[40px] bg-slate-50 border border-slate-200 focus:border-[#006c49] focus:bg-white text-xs font-[Manrope] rounded-xl px-3 outline-none transition-all"
                                />
                              ) : (
                                <input
                                  type={field.type === "password" && !showConfigSecret[field.key] ? "password" : "text"}
                                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                                  value={configValues[field.key] || ""}
                                  onChange={(e) => setConfigValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                                  className="w-full min-h-[40px] bg-slate-50 border border-slate-200 focus:border-[#006c49] focus:bg-white text-xs font-[Manrope] rounded-xl px-3 outline-none transition-all"
                                />
                              )}

                              {field.hint && (
                                <p className="text-[10px] font-[Manrope] text-slate-400 leading-relaxed">
                                  {field.hint}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 text-center">
                    <span className="text-xl">⚙️</span>
                    <h5 className="text-xs font-serif font-bold text-amber-900 mt-1">Automatic Cloud Deployment</h5>
                    <p className="text-[11px] font-[Manrope] text-amber-800 leading-relaxed mt-1">
                      This integration is dynamically managed by the Luxe Boutique Core orchestrator. No manual configurations are required to utilize this service.
                    </p>
                  </div>
                )}

                {/* Launcher to Custom Layout (if available) */}
                {configModalApp.actionUrl && configModalApp.actionUrl !== "/settings" && configModalApp.actionUrl !== "/providers" && (
                  <div className="pt-2 border-t border-slate-100">
                    <Link
                      href={configModalApp.actionUrl}
                      onClick={() => setConfigModalApp(null)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-[#0b1c30] text-xs font-[Manrope] font-bold tracking-wide uppercase rounded-xl transition-colors no-underline cursor-pointer border border-slate-200"
                    >
                      <span>Launch Interactive App Dashboard</span>
                      <MdArrowForward className="text-sm" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-6 pt-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-end gap-2.5 sm:gap-3 shrink-0">
                <button
                  type="button"
                  disabled={configSaving}
                  onClick={() => setConfigModalApp(null)}
                  className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] text-xs font-[Manrope] font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                >
                  Close
                </button>
                {APP_CONFIG_SCHEMA[configModalApp.id] && (
                  <button
                    type="button"
                    disabled={configSaving}
                    onClick={handleSaveConfig}
                    className="w-full sm:w-auto justify-center px-6 py-2.5 min-h-[44px] bg-[#006c49] hover:bg-[#005538] text-white text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {configSaving ? (
                      <>
                        <MdAutorenew className="text-base animate-spin" />
                        <span>Saving Config...</span>
                      </>
                    ) : (
                      <>
                        <MdCheckCircle className="text-base" />
                        <span>Save Configuration</span>
                      </>
                    )}
                  </button>
                )}
              </div>

            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
