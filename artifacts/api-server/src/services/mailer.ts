import { db, appSettingsTable, storesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { buildTenantUrl } from "@workspace/tenant-routing";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { decryptCredential, isEncryptedCredential } from "./credentialVault";

type Email = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  storeId?: string;
};

// Load Firebase Config for Firestore REST API
let firebaseConfig: any = null;

try {
  const possiblePaths = [
    path.resolve(process.cwd(), "../../firebase-applet-config.json"),
    path.resolve(process.cwd(), "firebase-applet-config.json"),
    path.resolve(process.cwd(), "../firebase-applet-config.json"),
    "/firebase-applet-config.json"
  ];
  
  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      break;
    }
  }
  
  if (firebaseConfig) {
    console.log("[Email Service] Loaded Firebase configuration for Firestore REST API on backend.");
  } else {
    console.warn("[Email Service] No firebase-applet-config.json found. Backend will fallback to console logging.");
  }
} catch (e) {
  console.error("[Email Service] Failed to read Firebase config:", e);
}

export async function getSmtpConfig(storeId?: string) {
  try {
    const query = db.select().from(appSettingsTable);
    if (storeId) {
      query.where(eq(appSettingsTable.storeId, storeId));
    }
    const rows = await query;
    const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));

    const host = process.env.SMTP_HOST || settings.smtp_host || "";
    const port = Number(process.env.SMTP_PORT || settings.smtp_port || 587);
    const user = process.env.SMTP_USER || settings.smtp_user || "";
    let pass = process.env.SMTP_PASS || settings.smtp_pass || "";
    const secure = process.env.SMTP_SECURE === "true" || settings.smtp_secure === "true" || port === 465;

    if (pass && isEncryptedCredential(pass)) {
      try { pass = decryptCredential(pass); } catch {}
    }

    const isConfigured = Boolean(host && user && pass);
    return { host, port, user, pass, secure, isConfigured };
  } catch {
    return { host: "", port: 587, user: "", pass: "", secure: false, isConfigured: false };
  }
}

export async function sendEmail(email: Email): Promise<void> {
  const storeId = email.storeId || "store-main";
  const fromAddress = await getConfiguredSender(storeId);
  const smtp = await getSmtpConfig(storeId);
  const brand = await loadBrandingCache(storeId);

  if (smtp.isConfigured) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
      });

      await transporter.sendMail({
        from: `"${brand.store_name}" <${fromAddress}>`,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html || email.text,
      });

      console.log(`[Email Service SMTP] Successfully dispatched email for ${storeId} via SMTP (${smtp.host}) to: ${email.to}`);
      return;
    } catch (smtpErr: any) {
      console.error(`[Email Service SMTP Error] Failed sending for ${storeId} via SMTP:`, smtpErr?.message || smtpErr);
      // Fallback to Firestore / Console
    }
  }

  if (firebaseConfig && firebaseConfig.projectId && firebaseConfig.apiKey) {
    try {
      const projectId = firebaseConfig.projectId;
      const apiKey = firebaseConfig.apiKey;
      const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
      
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/mail?key=${apiKey}`;
      
      const payload = {
        fields: {
          to: { stringValue: email.to },
          storeId: { stringValue: storeId },
          message: {
            mapValue: {
              fields: {
                subject: { stringValue: email.subject },
                text: { stringValue: email.text },
                ...(email.html ? { html: { stringValue: email.html } } : {})
              }
            }
          },
          delivery: {
            mapValue: {
              fields: {
                startTime: { timestampValue: new Date().toISOString() },
                state: { stringValue: "PENDING" }
              }
            }
          }
        }
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6-second timeout

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Firestore REST returned status ${response.status}: ${errText}`);
      }

      const resData = await response.json() as any;
      const docName = resData.name || "unknown";
      console.log(`[Email Service] Triggered email via Firestore REST for ${storeId} document: "${docName}" for recipient: ${email.to}`);
    } catch (error: any) {
      console.error(`[Email Service REST] Failed to write email for ${storeId} document to Firestore collection:`, error.message || error);
      // Fallback to console logging
      console.log(`[Email Service Fallback] Store: ${storeId} | Dispatched to: ${email.to} | Subject: "${email.subject}"`);
      console.log(`[Email Service Fallback Body]: ${email.text}`);
    }
  } else {
    console.log(`[Email Service Dev Log] Store: ${storeId} | Dispatched to: ${email.to} | Subject: "${email.subject}"`);
    console.log(`[Email Service Dev Log Body]: ${email.text}`);
  }
}

export async function getConfiguredSender(storeId: string): Promise<string> {
  const [row] = await db.select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(and(eq(appSettingsTable.key, "store_email"), eq(appSettingsTable.storeId, storeId)))
    .limit(1);
  if (row?.value) return row.value;

  const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
  if (store?.slug) return `noreply@${store.slug}.prigidcommerce.com`;
  return "noreply@prigidcommerce.com";
}

export async function getStoreUrl(storeId: string): Promise<string> {
  try {
    // 1. Check storesTable for custom domain or slug
    const [store] = await db.select()
      .from(storesTable)
      .where(eq(storesTable.id, storeId))
      .limit(1);

    if (store) {
      return buildTenantUrl({
        slug: store.slug,
        customDomain: store.customDomain,
        path: "/",
      });
    }
  } catch (error) {
    console.error(`[Store URL Resolution] Failed to lookup store ${storeId}:`, error);
  }

  // 2. Fallback to settings table
  const [row] = await db.select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(and(eq(appSettingsTable.key, "store_url"), eq(appSettingsTable.storeId, storeId)))
    .limit(1);

  // 3. Fallback to general environment variables
  const raw = row?.value || process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://prigidcommerce.com";
  const appUrl = raw.split(",")[0].trim().replace(/\/$/, "");
  return /^https?:\/\//i.test(appUrl) ? appUrl : `https://${appUrl}`;
}

// ── Unified Luxe Boutique System Template Engine ─────────────────────────────

let cachedBranding: Record<string, any> = {};

export async function loadBrandingCache(storeId?: string): Promise<any> {
  if (!storeId) return null;
  try {
    const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.storeId, storeId));
    const s = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    cachedBranding[storeId] = {
      store_name: s.store_name || "LUXE Boutique",
      brand_primary_color: s.brand_primary_color || "#006c49",
      brand_logo_url: s.brand_logo_url || "",
      brand_typography: s.brand_typography || "Georgia, serif",
      brand_valet_instructions: s.brand_valet_instructions || "Complimentary valet parking is available at the main entrance.",
      brand_hospitality_notes: s.brand_hospitality_notes || "Enjoy our signature champagne service upon your arrival.",
    };
  } catch (error) {
    cachedBranding[storeId] = {
      store_name: "LUXE Boutique",
      brand_primary_color: "#006c49",
      brand_logo_url: "",
      brand_typography: "Georgia, serif",
      brand_valet_instructions: "Complimentary valet parking is available at the main entrance.",
      brand_hospitality_notes: "Enjoy our signature champagne service upon your arrival.",
    };
  }
  return cachedBranding[storeId];
}

export function getBranding(storeId: string = "store-main"): any {
  if (!cachedBranding[storeId]) {
    return {
      store_name: "LUXE Boutique",
      brand_primary_color: "#006c49",
      brand_logo_url: "",
      brand_typography: "Georgia, serif",
      brand_valet_instructions: "Complimentary valet parking is available at the main entrance.",
      brand_hospitality_notes: "Enjoy our signature champagne service upon your arrival.",
    };
  }
  return cachedBranding[storeId];
}

export function renderSystemEmail(options: {
  title: string;
  preheader?: string;
  badge?: string;
  contentHtml: string;
  actionButton?: { text: string; url: string };
  footerNotice?: string;
  storeId?: string;
}): string {
  const brand = getBranding(options.storeId || "store-main");
  const storeName = brand.store_name;
  const primaryColor = brand.brand_primary_color;
  const logoUrl = brand.brand_logo_url;
  const typography = brand.brand_typography;

  const badgeHtml = options.badge
    ? `<div style="display:inline-block; padding:4px 12px; background:#F1F5F9; border:1px solid #CBD5E1; border-radius:100px; font-size:10px; font-weight:700; letter-spacing:1.5px; color:#475569; text-transform:uppercase; margin-bottom:16px;">${options.badge}</div>`
    : "";

  const buttonHtml = options.actionButton
    ? `<div style="margin-top:28px; text-align:center;">
        <a href="${options.actionButton.url}" target="_blank" style="display:inline-block; padding:14px 28px; background:${primaryColor}; color:#FFFFFF; text-decoration:none; font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; border-radius:8px; box-shadow:0 4px 12px rgba(15,23,42,0.15); border:1px solid ${primaryColor};">
          ${options.actionButton.text}
        </a>
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${options.title}</title>
</head>
<body style="margin:0; padding:0; background-color:#F8FAFC; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#334155; -webkit-font-smoothing:antialiased;">
  ${options.preheader ? `<div style="display:none; font-size:1px; color:#F8FAFC; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">${options.preheader}</div>` : ""}
  
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F8FAFC; padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:580px; background-color:#FFFFFF; border-radius:16px; border:1px solid #E2E8F0; box-shadow:0 10px 25px -5px rgba(15,23,42,0.05); overflow:hidden;">
          
          <!-- Header Bar -->
          <tr>
            <td align="center" style="background-color:${primaryColor}; padding:28px 24px; border-bottom:3px solid #C5A880;">
              ${logoUrl 
                ? `<img src="${logoUrl}" alt="${storeName}" style="max-height:48px; object-fit:contain; border:0; display:block;" />`
                : `<span style="font-family:${typography}; font-size:20px; font-weight:700; letter-spacing:4px; color:#FFFFFF; text-transform:uppercase; text-decoration:none; display:block;">
                    ${storeName}
                  </span>`
              }
              <span style="font-size:9px; font-weight:600; letter-spacing:3px; color:#C5A880; text-transform:uppercase; display:block; margin-top:4px;">
                HAUTE COUTURE & PRIVATE CLIENT SERVICES
              </span>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding:36px 32px;">
              ${badgeHtml}
              <h1 style="font-family:${typography}; font-size:22px; font-weight:600; color:#0F172A; margin:0 0 16px 0; line-height:1.3;">
                ${options.title}
              </h1>
              
              <div style="font-size:14px; line-height:1.6; color:#475569;">
                ${options.contentHtml}
              </div>

              ${buttonHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background-color:#F8FAFC; padding:20px 24px; border-top:1px solid #E2E8F0; font-size:11px; color:#94A3B8; line-height:1.5;">
              <p style="margin:0 0 6px 0; font-weight:600; color:#64748B;">${storeName.toUpperCase()} CONCIERGE SERVICES</p>
              <p style="margin:0;">${options.footerNotice || "This is an official system notification regarding your Luxe Boutique account."}</p>
              <p style="margin:8px 0 0 0; font-size:10px; color:#CBD5E1;">© 2026 ${storeName}. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Notification Builders ────────────────────────────────────────────────────

export function buildOtpEmail(options: { code: string; expiresMinutes?: number }): { subject: string; text: string; html: string } {
  const code = options.code;
  const mins = options.expiresMinutes ?? 10;
  const subject = "Your Luxe Boutique seller sign-in code";
  const text = `Your Luxe Boutique seller sign-in code is ${code}. It expires in ${mins} minutes.`;
  const html = renderSystemEmail({
    title: "Executive Sign-In Verification",
    badge: "2FA SECURITY CODE",
    preheader: `Your sign-in verification code is ${code}`,
    contentHtml: `
      <p style="margin-top:0;">Please enter the single-use verification code below to authorize your access to the Luxe Boutique Executive Dashboard:</p>
      <div style="text-align:center; margin:24px 0; background-color:#F8FAFC; border:2px dashed #CBD5E1; border-radius:12px; padding:20px;">
        <span style="font-family:Monaco, Consolas, 'Courier New', monospace; font-size:32px; font-weight:800; letter-spacing:10px; color:#0F172A; display:inline-block;">${code}</span>
      </div>
      <p style="margin-bottom:0; font-size:12px; color:#64748B;">This code is valid for <strong>${mins} minutes</strong>. If you did not request this verification code, please ignore this email or contact security.</p>
    `,
  });
  return { subject, text, html };
}

export function buildPasswordResetEmail(options: { name?: string; resetUrl: string; expiresMinutes?: number }): { subject: string; text: string; html: string } {
  const greeting = options.name ? `Dear ${options.name},` : "Hello,";
  const mins = options.expiresMinutes ?? 60;
  const subject = "Reset your Luxe Boutique password";
  const text = `Reset your Luxe Boutique password using this link: ${options.resetUrl}. This link expires in ${mins} minutes.`;
  const html = renderSystemEmail({
    title: "Password Reset Request",
    badge: "ACCOUNT SECURITY",
    preheader: "Instructions to reset your Luxe Boutique password",
    contentHtml: `
      <p style="margin-top:0;">${greeting}</p>
      <p>We received a request to reset the password associated with your Luxe Boutique account.</p>
      <p>Click the button below to specify your new password. For security, this link will expire in <strong>${mins} minutes</strong>.</p>
    `,
    actionButton: { text: "Reset Password", url: options.resetUrl },
    footerNotice: "If you did not request a password reset, your account is safe and no further action is required.",
  });
  return { subject, text, html };
}

export function buildWelcomeEmail(options: { name?: string; email: string; storeUrl: string }): { subject: string; text: string; html: string } {
  const greeting = options.name ? `Dear ${options.name}` : "Valued Member";
  const subject = "Welcome to Luxe Boutique";
  const text = `Welcome to Luxe Boutique, ${options.name || options.email}! Your private account is active. Explore our collections at ${options.storeUrl}.`;
  const html = renderSystemEmail({
    title: "Welcome to the Private Client Club",
    badge: "MEMBERSHIP CONFIRMED",
    preheader: "Your Luxe Boutique account has been activated",
    contentHtml: `
      <p style="margin-top:0;">${greeting},</p>
      <p>Thank you for joining Luxe Boutique. Your private client account has been created successfully.</p>
      <p>As a member, you will enjoy seamless checkout, order tracking, wishlist synchronization, and exclusive early access to seasonal lookbooks.</p>
    `,
    actionButton: { text: "Explore Collections", url: options.storeUrl },
  });
  return { subject, text, html };
}

export function buildOrderConfirmationEmail(options: {
  orderId: string;
  customerName: string;
  items: Array<{ name: string; qty: number; price: number }>;
  total: number;
  storeUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `Luxe Boutique Order Confirmation #${options.orderId.slice(0, 8).toUpperCase()}`;
  const text = `Dear ${options.customerName}, thank you for your order #${options.orderId} totaling $${options.total.toLocaleString()}. We are processing your items.`;
  
  const itemsHtml = options.items.map(item => `
    <tr>
      <td style="padding:10px 0; border-bottom:1px solid #F1F5F9; font-size:13px; color:#1E293B; font-weight:600;">${item.name}</td>
      <td style="padding:10px 0; border-bottom:1px solid #F1F5F9; font-size:13px; color:#64748B; text-align:center;">x${item.qty}</td>
      <td style="padding:10px 0; border-bottom:1px solid #F1F5F9; font-size:13px; color:#0F172A; font-weight:700; text-align:right;">$${(item.price * item.qty).toLocaleString()}</td>
    </tr>
  `).join("");

  const html = renderSystemEmail({
    title: `Order Confirmation #${options.orderId.slice(0, 8).toUpperCase()}`,
    badge: "ORDER CONFIRMED",
    preheader: `Thank you for your order of $${options.total.toLocaleString()}`,
    contentHtml: `
      <p style="margin-top:0;">Dear ${options.customerName},</p>
      <p>Thank you for your order. We have received your payment and our ateliers are currently preparing your items with meticulous care.</p>
      
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:20px 0; border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:2px solid #E2E8F0;">
            <th align="left" style="padding:8px 0; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#64748B;">Item</th>
            <th align="center" style="padding:8px 0; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#64748B;">Qty</th>
            <th align="right" style="padding:8px 0; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#64748B;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" align="right" style="padding:12px 0; font-size:14px; font-weight:700; color:#0F172A;">Total Paid:</td>
            <td align="right" style="padding:12px 0; font-size:16px; font-weight:800; color:#0F172A;">$${options.total.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
    `,
    actionButton: { text: "View Order History", url: `${options.storeUrl}/account/orders` },
  });

  return { subject, text, html };
}

export function buildOrderStatusUpdateEmail(options: {
  orderId: string;
  customerName: string;
  status: string;
  storeUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `Update on Luxe Boutique Order #${options.orderId.slice(0, 8).toUpperCase()}`;
  const text = `Dear ${options.customerName}, your order #${options.orderId} status has been updated to: ${options.status}.`;
  
  const html = renderSystemEmail({
    title: `Order Status: ${options.status}`,
    badge: "ORDER UPDATE",
    preheader: `Your order #${options.orderId} status is now ${options.status}`,
    contentHtml: `
      <p style="margin-top:0;">Dear ${options.customerName},</p>
      <p>We are writing to update you on the progress of your order <strong>#${options.orderId.slice(0, 8).toUpperCase()}</strong>.</p>
      
      <div style="text-align:center; margin:24px 0; background-color:#F8FAFC; border:1px solid #CBD5E1; border-radius:12px; padding:16px;">
        <span style="font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#64748B; display:block; margin-bottom:4px;">Current Status</span>
        <span style="font-size:20px; font-weight:800; color:#0F172A; text-transform:uppercase;">${options.status}</span>
      </div>

      <p>You can review your complete order details anytime in your private account portal.</p>
    `,
    actionButton: { text: "Track Order Status", url: `${options.storeUrl}/account/orders` },
  });

  return { subject, text, html };
}

export function buildLowStockAlertEmail(options: {
  products: Array<{ name: string; stock: number }>;
  threshold: number;
  adminUrl: string;
}): { subject: string; text: string; html: string } {
  const count = options.products.length;
  const subject = `[INVENTORY ALERT] ${count} item(s) below low stock threshold (${options.threshold})`;
  const text = `Attention: ${count} product(s) have fallen to or below ${options.threshold} units in stock.`;

  const rowsHtml = options.products.map(p => `
    <tr>
      <td style="padding:10px 0; border-bottom:1px solid #F1F5F9; font-size:13px; color:#0F172A; font-weight:600;">${p.name}</td>
      <td style="padding:10px 0; border-bottom:1px solid #F1F5F9; font-size:13px; color:#DC2626; font-weight:800; text-align:right;">${p.stock} left</td>
    </tr>
  `).join("");

  const html = renderSystemEmail({
    title: "Low Inventory Warning",
    badge: "ADMIN INVENTORY ALERT",
    preheader: `Alert: ${count} product(s) below ${options.threshold} units`,
    contentHtml: `
      <p style="margin-top:0;">Attention Inventory Manager,</p>
      <p>The following active product(s) have reached or fallen below your configured threshold of <strong>${options.threshold} units</strong>:</p>

      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:20px 0; border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:2px solid #E2E8F0;">
            <th align="left" style="padding:8px 0; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#64748B;">Product Name</th>
            <th align="right" style="padding:8px 0; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#64748B;">Current Stock</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `,
    actionButton: { text: "Manage Inventory", url: `${options.adminUrl}/seller/products` },
  });

  return { subject, text, html };
}

export function buildNewsletterWelcomeEmail(options: { email: string; storeUrl: string }): { subject: string; text: string; html: string } {
  const subject = "Welcome to Luxe Boutique Insiders";
  const text = `Thank you for subscribing to Luxe Boutique updates! Visit ${options.storeUrl} to explore new arrivals.`;

  const html = renderSystemEmail({
    title: "Welcome to Luxe Boutique Insiders",
    badge: "NEWSLETTER SUBSCRIPTION",
    preheader: "Thank you for subscribing to Luxe Boutique updates",
    contentHtml: `
      <p style="margin-top:0;">Thank you for subscribing,</p>
      <p>You are now on the insider list for Luxe Boutique. You will be the first to receive notifications regarding private collection launches, runway previews, and seasonal sales.</p>
    `,
    actionButton: { text: "Explore New Arrivals", url: options.storeUrl },
  });

  return { subject, text, html };
}
