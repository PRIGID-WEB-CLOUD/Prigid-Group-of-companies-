export interface PrebuiltTemplateBlueprint {
  id: string;
  name: string;
  title: string;
  category: "Utility" | "Marketing" | "Authentication";
  audience: "Customer" | "Admin";
  tag: string;
  description: string;
  body: string;
  defaultVariables: Record<string, string>;
  tips: string;
}

const getLiveOrigin = (): string => {
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return window.location.origin;
  }
  return "https://luxeboutique.store";
};

export const PREBUILT_WHATSAPP_TEMPLATES: PrebuiltTemplateBlueprint[] = [
  // ── Customer Order & Fulfillment (Utility) ──
  {
    id: "luxe_order_confirmed_v1",
    name: "luxe_order_confirmed_v1",
    title: "Order Confirmation",
    category: "Utility",
    audience: "Customer",
    tag: "Transactional",
    description: "Sent immediately after payment to confirm items, amount, and atelier packaging.",
    body: "*[LUXE BOUTIQUE | ORDER CONFIRMED]*\n\nDear *{{1}}*,\n\nThank you for acquiring with LUXE BOUTIQUE. Your order *#{{2}}* totaling *${{3}}* has been registered.\n\n*Selections:* {{4}}\n*Estimated Delivery:* {{5}}\n\nOur ateliers are preparing your pieces with signature luxury packaging.\n\n_LUXE BOUTIQUE Private Client Services_",
    defaultVariables: {
      "1": "Alexander Vance",
      "2": "LX-90821",
      "3": "2,450.00",
      "4": "Cashmere Overcoat in Charcoal",
      "5": "3-5 Business Days (White Glove)",
    },
    tips: "Classified as Utility by Meta. Always auto-approved within seconds.",
  },
  {
    id: "luxe_order_delivery_ready",
    name: "luxe_order_delivery_ready",
    title: "Ready for Delivery",
    category: "Utility",
    audience: "Customer",
    tag: "Delivery",
    description: "Alerts the customer that their package has arrived in their area and courier is out.",
    body: "*LUXE BOUTIQUE | ORDER UPDATE*\n\nHello *{{1}}*,\n\nGreat news! Your order *#{{2}}* is ready for delivery.\n\n*Order Total:* {{3}}\n*Delivery Address:* {{4}}\n\nOur delivery team will contact you shortly prior to drop-off.\n\nThank you for shopping with LUXE BOUTIQUE.",
    defaultVariables: {
      "1": "Elena Rostova",
      "2": "LX-84920",
      "3": "$1,450.00",
      "4": "450 Park Avenue, Suite 18B, New York, NY",
    },
    tips: "Clear utility context. Excellent for immediate courier coordination.",
  },
  {
    id: "luxe_order_dispatched_track",
    name: "luxe_order_dispatched_track",
    title: "Courier Dispatch & Tracking",
    category: "Utility",
    audience: "Customer",
    tag: "Fulfillment",
    description: "Provides white-glove courier name, airway bill number, and live tracking.",
    body: "*[LUXE BOUTIQUE | DISPATCHED]*\n\nDear *{{1}}*,\n\nYour order *#{{2}}* has departed our central atelier.\n\n*Courier:* {{3}}\n*Tracking Number:* *{{4}}*\n*Track Link:* {{5}}\n\nYour courier requires a signature upon arrival.",
    defaultVariables: {
      "1": "Sophia Loren",
      "2": "LX-77219",
      "3": "DHL Express White-Glove",
      "4": "DHL-9842019482",
      "5": `${getLiveOrigin()}/orders/track`,
    },
    tips: "Meta permits tracking URLs in Utility templates if tied to a confirmed order.",
  },
  {
    id: "luxe_order_delivered_concierge",
    name: "luxe_order_delivered_concierge",
    title: "Delivery Completed & Concierge Care",
    category: "Utility",
    audience: "Customer",
    tag: "Post-Delivery",
    description: "Confirms handover and offers private alteration or personal styling advice.",
    body: "*[LUXE BOUTIQUE | DELIVERED]*\n\nDear *{{1}}*,\n\nYour shipment for order *#{{2}}* has been delivered.\n\nWe trust your new selections exceed expectations. If you desire private alteration assistance or styling recommendations, simply reply to this message to speak with your personal advisor.",
    defaultVariables: {
      "1": "Alexander Vance",
      "2": "LX-90821",
    },
    tips: "Fosters high-touch customer retention while retaining Utility status.",
  },

  // ── Customer Security & Authentication (Authentication) ──
  {
    id: "luxe_client_otp_verification",
    name: "luxe_client_otp_verification",
    title: "One-Time Password (OTP)",
    category: "Authentication",
    audience: "Customer",
    tag: "Security",
    description: "Meta official Authentication template for customer sign-in or checkout 2FA.",
    body: "*[LUXE BOUTIQUE | CLIENT VERIFICATION]*\n\nYour verification code is: *{{1}}*\n\nThis code is valid for 10 minutes. For your security, our salon advisors will never ask for this code.",
    defaultVariables: {
      "1": "849201",
    },
    tips: "Requires Meta Authentication category. Allows one-tap copy button in WhatsApp.",
  },

  // ── Customer Marketing & Engagement (Marketing) ──
  {
    id: "luxe_abandoned_bag_concierge",
    name: "luxe_abandoned_bag_concierge",
    title: "Private Bag Reservation (Abandoned Cart)",
    category: "Marketing",
    audience: "Customer",
    tag: "Retention",
    description: "Tactful, high-end reminder about items reserved in the customer's bag.",
    body: "*[LUXE BOUTIQUE | PRIVATE SELECTION]*\n\nDear *{{1}}*,\n\nWe noticed you left *{{2}}* in your private bag.\n\nAtelier availability is limited to maintain exclusivity. We have reserved your pieces for the next *24 hours*.\n\nComplete your acquisition here: {{3}}",
    defaultVariables: {
      "1": "Isabella Rossi",
      "2": "Silk Trench Coat (Size M)",
      "3": `${getLiveOrigin()}/cart`,
    },
    tips: "Category must be Marketing. Excellent for automated recovery journeys.",
  },
  {
    id: "luxe_vip_welcome_concierge",
    name: "luxe_vip_welcome_concierge",
    title: "VIP Concierge Welcome",
    category: "Marketing",
    audience: "Customer",
    tag: "Onboarding",
    description: "Welcome greeting sent upon client account registration or newsletter opt-in.",
    body: "*[LUXE BOUTIQUE | PRIVATE SALON]*\n\nDear *{{1}}*,\n\nWelcome to LUXE BOUTIQUE. Your private client profile is active.\n\nEnjoy complimentary express shipping on all acquisitions, preview access to seasonal capsule drops, and a direct line to our styling atelier.\n\nExplore current collection: {{2}}",
    defaultVariables: {
      "1": "Julian Sterling",
      "2": `${getLiveOrigin()}/catalog?filter=new`,
    },
    tips: "Warm, luxury tone that introduces concierge messaging to new buyers.",
  },
  {
    id: "luxe_restock_exclusive_alert",
    name: "luxe_restock_exclusive_alert",
    title: "Waitlist Restock Notice",
    category: "Marketing",
    audience: "Customer",
    tag: "Catalog",
    description: "Exclusive notice sent to waitlist customers when an item returns to inventory.",
    body: "*[LUXE BOUTIQUE | EXCLUSIVE ALLOCATION]*\n\nDear *{{1}}*,\n\nThe piece you requested — *{{2}}* — has just arrived from our European ateliers.\n\nAs a waitlisted client, your reservation is held for the next 4 hours prior to public release.\n\nReserve now: {{3}}",
    defaultVariables: {
      "1": "Camilla Dupont",
      "2": "Hand-stitched Calfskin Tote in Cognac",
      "3": `${getLiveOrigin()}/catalog`,
    },
    tips: "Drives urgent conversions through scarcity and VIP early access.",
  },

  // ── Admin & Operations Alerts (Utility) ──
  {
    id: "luxe_admin_vip_order_alert",
    name: "luxe_admin_vip_order_alert",
    title: "VIP Order Operations Alert",
    category: "Utility",
    audience: "Admin",
    tag: "Operations",
    description: "Alerts store managers and fulfillment teams when a high-value order is placed.",
    body: "*[ADMIN ALERT | HIGH-VALUE ORDER]*\n\n*Order:* #*{{1}}*\n*Client:* {{2}}\n*Total:* *${{3}}*\n*Items:* {{4}}\n\n*Action Required:* Assign to white-glove packaging desk.\nDashboard: {{5}}",
    defaultVariables: {
      "1": "LX-90821",
      "2": "Lady Victoria Cavendish",
      "3": "4,890.00",
      "4": "Italian Silk Gown, Diamond Brooch",
      "5": `${getLiveOrigin()}/admin/orders`,
    },
    tips: "Can be dispatched to staff WhatsApp numbers for instant operational responsiveness.",
  },
  {
    id: "luxe_admin_low_stock_alert",
    name: "luxe_admin_low_stock_alert",
    title: "Low Stock / Depletion Warning",
    category: "Utility",
    audience: "Admin",
    tag: "Inventory",
    description: "Notifies inventory supervisors when stock hits the critical minimum threshold.",
    body: "*[ADMIN ALERT | LOW INVENTORY]*\n\nItem: *{{1}}* (SKU: `{{2}}`)\nCurrent Stock: *{{3}} units left*.\nThreshold: {{4}} units.\n\nPlease initiate atelier re-order or adjust online allocation.",
    defaultVariables: {
      "1": "Cashmere Knit Scarf (Oatmeal)",
      "2": "SKU-CK-OAT-01",
      "3": "2",
      "4": "5",
    },
    tips: "Utility notification to keep store managers ahead of stockouts.",
  },
];
