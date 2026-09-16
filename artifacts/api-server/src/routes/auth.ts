import { Router, type Response } from "express";
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "crypto";
import { db, usersTable, sessionsTable, adminOtpCodesTable, authRateLimitsTable, appSettingsTable, storesTable } from "@workspace/db";
import { eq, or, and, gt, lt, gte, count, sql, inArray } from "drizzle-orm";
import { SESSION_COOKIE, getSessionUser, requireAdmin } from "../middleware/requireAdmin";
import { validate } from "../middleware/validate";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { sendEmail, buildOtpEmail, buildPasswordResetEmail, buildWelcomeEmail, getStoreUrl } from "../services/mailer";
import {
  sendWhatsAppNotification,
  buildWhatsAppOtpMessage,
  buildWhatsAppPasswordResetMessage,
  buildWhatsAppWelcomeMessage,
} from "../services/whatsappService";
import { type TenantRequest } from "../middleware/tenantContext";
import { verifyFirebaseIdToken } from "../services/firebaseAuth";

const router = Router();
const PASSWORD_SCHEMA = z.string().min(8).max(128);
const emailSchema = z.string().trim().toLowerCase().email();
const passwordSchema = z.object({ password: PASSWORD_SCHEMA });
function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function authSecret() {
  const secret = process.env.SESSION_SECRET || "luxe_boutique_default_development_secret_key_123456";
  return secret;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function otpDigest(email: string, otp: string) {
  return createHmac("sha256", authSecret()).update(`${email}:${otp}`).digest("hex");
}

function safeCompare(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function isRateLimited(key: string, limit: number, windowMs: number) {
  const now = new Date();
  const [entry] = await db.select().from(authRateLimitsTable)
    .where(eq(authRateLimitsTable.key, key)).limit(1);
  if (!entry || now.getTime() - entry.windowStart.getTime() >= windowMs) {
    await db.insert(authRateLimitsTable).values({ key, windowStart: now, count: 1 })
      .onConflictDoUpdate({ target: authRateLimitsTable.key, set: { windowStart: now, count: 1 } });
    return false;
  }
  if (entry.count >= limit) {
    return true;
  }
  await db.update(authRateLimitsTable).set({ count: entry.count + 1 })
    .where(eq(authRateLimitsTable.key, key));
  return false;
}

async function setSession(res: Response, userId: string, storeId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.delete(sessionsTable).where(and(eq(sessionsTable.userId, userId), eq(sessionsTable.storeId, storeId)));
  await db.insert(sessionsTable).values({ token: digest(token), userId, expiresAt, storeId });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

async function clearSession(req: TenantRequest, res: Response) {
  let token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }
  }
  if (token) {
    const storeId = req.storeId!;
    let filters = eq(sessionsTable.token, digest(token));
    filters = and(filters, eq(sessionsTable.storeId, storeId));
    await db.delete(sessionsTable).where(filters);
  }
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}

const registerSchema = z.object({ name: z.string().trim().min(1).max(120), email: emailSchema, password: PASSWORD_SCHEMA });
router.get("/auth/me", async (req: TenantRequest, res: Response) => {
  const user = await getSessionUser(req, req.storeId);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  return res.json(user);
});

const sellerRegisterSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: PASSWORD_SCHEMA,
  storeName: z.string().trim().min(1).max(120),
});

router.post("/auth/seller/register", validate(sellerRegisterSchema), async (req: any, res: Response) => {
  const { name, email, password, storeName } = req.body;
  if (await isRateLimited(`register:ip:${req.ip || "127.0.0.1"}`, 10, 15 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many registration attempts. Try again later." });
  }

  try {
    let baseSlug = storeName.trim().toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!baseSlug) baseSlug = "store";

    let slug = baseSlug;
    let attempts = 0;
    while (attempts < 10) {
      const [existingStore] = await db.select().from(storesTable).where(eq(storesTable.slug, slug)).limit(1);
      if (!existingStore) break;
      attempts++;
      slug = `${baseSlug}-${attempts}`;
    }

    const storeId = `store-${randomBytes(6).toString("hex")}`;
    const pubKey = `pk_live_${randomBytes(24).toString("hex")}`;
    const secretKey = `sk_live_${randomBytes(24).toString("hex")}`;

    await db.insert(storesTable).values({
      id: storeId,
      name: storeName,
      slug: slug,
      planTier: "starter",
      status: "active",
      isPublished: false,
      publishStatus: "DRAFT",
      publishableKey: pubKey,
      secretKeyHash: secretKey,
      currency: "USD",
    });

    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: userId,
      storeId,
      name,
      email,
      role: "SUPER_ADMIN" as const,
      passwordHash,
    };
    await db.insert(usersTable).values(user);

    const token = await setSession(res, userId, storeId);

    await db.insert(appSettingsTable).values([
      { id: randomUUID(), storeId, key: "store_name", value: storeName, updatedAt: new Date() },
      { id: randomUUID(), storeId, key: "store_email", value: email, updatedAt: new Date() },
      { id: randomUUID(), storeId, key: "store_currency", value: "USD", updatedAt: new Date() },
      { id: randomUUID(), storeId, key: "brand_primary_color", value: "#006c49", updatedAt: new Date() },
      { id: randomUUID(), storeId, key: "brand_bg_color", value: "#0f172a", updatedAt: new Date() },
    ]);

    const { passwordHash: _, ...safe } = user;
    return res.status(201).json({ ...safe, storeId, slug, token });
  } catch (err: any) {
    console.error("[Seller Register Error]", err);
    return res.status(500).json({ error: err.message || "Failed to register seller account." });
  }
});

const sellerLoginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
router.post("/auth/seller/login", validate(sellerLoginSchema), async (req: any, res: Response) => {
  const { email, password } = req.body;
  if (await isRateLimited(`login:ip:${req.ip || "127.0.0.1"}`, 15, 15 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many login attempts. Try again later." });
  }

  try {
    const [user] = await db.select().from(usersTable).where(and(
      eq(usersTable.email, email),
      or(eq(usersTable.role, "ADMIN"), eq(usersTable.role, "SUPER_ADMIN"))
    )).limit(1);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = await setSession(res, user.id, user.storeId);
    const { passwordHash: _, ...safe } = user;
    return res.json({ ...safe, token, storeId: user.storeId });
  } catch (err: any) {
    console.error("[Seller Login Error]", err);
    return res.status(500).json({ error: err.message || "Failed to log in." });
  }
});

router.post("/auth/register", validate(registerSchema), async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const { name, email, password } = req.body;
  if (await isRateLimited(`register:ip:${req.ip}`, 10, 15 * 60 * 1000) ||
      await isRateLimited(`register:email:${storeId}:${email}`, 5, 60 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many registration attempts. Try again later." });
  }
  const existing = await db.select().from(usersTable).where(and(eq(usersTable.email, email), eq(usersTable.storeId, storeId))).limit(1);
  if (existing.length) return res.status(409).json({ error: "Email already registered in this store." });
  const user = { id: randomUUID(), storeId, name, email, role: "customer" as const, passwordHash: await bcrypt.hash(password, 10) };
  await db.insert(usersTable).values(user);
  const token = await setSession(res, user.id, storeId);
  
  // Dispatch welcome email & WhatsApp notification asynchronously
  getStoreUrl(storeId).then((storeUrl) => {
    sendEmail({ to: user.email, ...buildWelcomeEmail({ name: user.name, email: user.email, storeUrl }), storeId }).catch(() => {});
    const waText = buildWhatsAppWelcomeMessage({ recipientName: user.name, storeUrl });
    sendWhatsAppNotification(user.email, waText, storeId).catch(() => {});
  }).catch(() => {});

  const { passwordHash: _, ...safe } = user;
  return res.status(201).json({ ...safe, token });
});

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
router.post("/auth/login", validate(loginSchema), async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const { email, password } = req.body;
  if (await isRateLimited(`login:ip:${req.ip}`, 15, 15 * 60 * 1000) ||
      await isRateLimited(`login:email:${storeId}:${email}`, 10, 15 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many login attempts. Try again later." });
  }
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.email, email), eq(usersTable.storeId, storeId))).limit(1);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: "Invalid email or password." });
  const token = await setSession(res, user.id, storeId);
  const { passwordHash: _, ...safe } = user;
  return res.json({ ...safe, token });
});

const firebaseAuthSchema = z.object({
  idToken: z.string().min(10),
});

router.post("/auth/firebase", validate(firebaseAuthSchema), async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const { idToken } = req.body;
  
  let verified;
  try {
    verified = await verifyFirebaseIdToken(idToken);
  } catch (err: any) {
    return res.status(401).json({ error: err.message || "Invalid or unverified Firebase ID token." });
  }

  const { email, name, uid } = verified;
  
  let [user] = await db.select().from(usersTable).where(and(eq(usersTable.email, email), eq(usersTable.storeId, storeId))).limit(1);
  if (!user) {
    const userId = uid || randomUUID();
    const newUser = {
      id: userId,
      storeId,
      name: name || email.split("@")[0] || "Valued Customer",
      email,
      role: "customer" as const,
      passwordHash: await bcrypt.hash(randomUUID(), 10),
    };
    await db.insert(usersTable).values(newUser);
    user = newUser;

    // Dispatch welcome email asynchronously for new user
    getStoreUrl(storeId).then((storeUrl) => {
      sendEmail({ to: newUser.email, ...buildWelcomeEmail({ name: newUser.name, email: newUser.email, storeUrl }), storeId }).catch(() => {});
    }).catch(() => {});
  }
  
  const token = await setSession(res, user.id, storeId);
  const { passwordHash: _, ...safe } = user;
  return res.json({ ...safe, token });
});

router.post("/auth/logout", async (req: TenantRequest, res: Response) => { await clearSession(req, res); return res.json({ ok: true }); });
router.post("/auth/logout-all", requireAdmin, async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  await db.delete(sessionsTable).where(and(eq(sessionsTable.userId, req.adminUser!.id), eq(sessionsTable.storeId, storeId)));
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res.json({ ok: true });
});

router.get("/auth/admin/exists", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const rows = await db
    .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, role: usersTable.role })
    .from(usersTable)
    .where(and(
      eq(usersTable.storeId, storeId),
      or(eq(usersTable.role, "admin"), eq(usersTable.role, "superadmin"))
    ));
  const isProd = process.env.NODE_ENV === "production";
  return res.json({
    exists: rows.length > 0,
    admins: isProd ? [] : rows.map((r) => ({ email: r.email, name: r.name, role: r.role })),
  });
});

router.post("/auth/admin/quick-login", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  // SECURITY: Quick login is strictly disabled in production builds
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Endpoint not available in production." });
  }

  const { email } = req.body || {};
  let admin;
  if (email && typeof email === "string") {
    const cleanEmail = email.toLowerCase().trim();
    [admin] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.email, cleanEmail), eq(usersTable.storeId, storeId)))
      .limit(1);
  } else {
    [admin] = await db
      .select()
      .from(usersTable)
      .where(and(
        eq(usersTable.storeId, storeId),
        or(eq(usersTable.role, "superadmin"), eq(usersTable.role, "admin"))
      ))
      .limit(1);
  }

  if (!admin || !["admin", "superadmin"].includes(admin.role)) {
    return res.status(403).json({ error: "No admin privileges found for this account in this store." });
  }

  const token = await setSession(res, admin.id, storeId);
  const { passwordHash: _, ...safe } = admin;
  return res.json({ ...safe, token });
});

const bootstrapSchema = z.object({ name: z.string().trim().min(1).max(120), email: emailSchema });
router.post("/auth/admin/bootstrap", validate(bootstrapSchema), async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  if (await isRateLimited(`bootstrap:ip:${req.ip}`, 5, 15 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many bootstrap attempts. Try again later." });
  }
  const isProd = process.env.NODE_ENV === "production";
  const configuredSecret = process.env.ADMIN_BOOTSTRAP_SECRET || (isProd ? undefined : "admin123");
  const providedSecret = req.get("x-admin-bootstrap-secret");
  if (!configuredSecret || !providedSecret || !safeCompare(digest(providedSecret), digest(configuredSecret))) {
    return res.status(403).json({ error: "A valid admin bootstrap secret is required." });
  }
  const { name, email } = req.body;
  const user = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('luxe_boutique_admin_bootstrap_' || ${storeId}))`);
    const existing = await tx.select({ id: usersTable.id }).from(usersTable)
      .where(and(
        eq(usersTable.storeId, storeId),
        or(eq(usersTable.role, "admin"), eq(usersTable.role, "superadmin"))
      )).limit(1);
    if (existing.length) return null;
    const [created] = await tx.insert(usersTable).values({
      id: randomUUID(), storeId, name, email, role: "superadmin" as const, passwordHash: "",
    }).returning();
    return created;
  });
  if (!user) return res.status(410).json({ error: "Admin bootstrap is disabled after initial setup." });
  await setSession(res, user.id, storeId);
  const { passwordHash: _, ...safe } = user;
  return res.status(201).json(safe);
});

const otpRequestSchema = z.object({ email: emailSchema });
router.post("/auth/admin/request-otp", validate(otpRequestSchema), async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const email = req.body.email as string;
  if (await isRateLimited(`otp:email:${storeId}:${email}`, 5, 15 * 60 * 1000) || await isRateLimited(`otp:ip:${req.ip}`, 20, 15 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many OTP requests. Try again later." });
  }
  const [admin] = await db.select().from(usersTable).where(and(eq(usersTable.email, email), eq(usersTable.storeId, storeId))).limit(1);
  if (!admin || !["admin", "superadmin"].includes(admin.role)) return res.status(404).json({ error: "No admin account found for this email in this store." });
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.update(adminOtpCodesTable).set({ used: true })
    .where(and(eq(adminOtpCodesTable.email, email), eq(adminOtpCodesTable.storeId, storeId), eq(adminOtpCodesTable.used, false)));
  await db.delete(adminOtpCodesTable).where(and(eq(adminOtpCodesTable.storeId, storeId), lt(adminOtpCodesTable.expiresAt, new Date())));
  await db.insert(adminOtpCodesTable).values({ id: randomUUID(), storeId, email, code: otpDigest(email, code), expiresAt, used: false, attempts: 0 });
  try {
    const emailData = buildOtpEmail({ code });
    await sendEmail({
      to: email,
      storeId,
      ...emailData,
    });
    // Dispatch WhatsApp OTP alert asynchronously
    const waText = buildWhatsAppOtpMessage({ code });
    sendWhatsAppNotification(email, waText, storeId).catch(() => {});
    return res.json({ ok: true });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEVELOPMENT ONLY] Admin OTP code for ${email} (Store: ${storeId}): ${code}`);
      return res.json({ ok: true, devCode: code });
    }
    await db.update(adminOtpCodesTable).set({ used: true }).where(and(eq(adminOtpCodesTable.email, email), eq(adminOtpCodesTable.storeId, storeId)));
    console.error("[Auth] Admin OTP email failed:", error instanceof Error ? error.message : error);
    return res.status(503).json({ error: "Unable to deliver the sign-in code. Please contact an administrator." });
  }
});

const otpVerifySchema = z.object({ email: emailSchema, otp: z.string().regex(/^\d{6}$/).optional(), code: z.string().regex(/^\d{6}$/).optional() })
  .refine((body) => Boolean(body.otp ?? body.code), { message: "otp is required", path: ["otp"] });
router.post("/auth/admin/verify-otp", validate(otpVerifySchema), async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const email = req.body.email as string;
  const otp = (req.body.otp ?? req.body.code) as string;
  if (await isRateLimited(`otp-verify:ip:${req.ip}`, 30, 15 * 60 * 1000)) return res.status(429).json({ error: "Too many verification attempts. Try again later." });
  const [stored] = await db.select().from(adminOtpCodesTable)
    .where(and(eq(adminOtpCodesTable.email, email), eq(adminOtpCodesTable.storeId, storeId), eq(adminOtpCodesTable.used, false), gt(adminOtpCodesTable.expiresAt, new Date()))).limit(1);
  if (!stored || (stored.lockedUntil && stored.lockedUntil > new Date())) return res.status(401).json({ error: "Invalid or expired code." });
  const valid = safeCompare(stored.code, otpDigest(email, otp));
  if (!valid) {
    const attempts = stored.attempts + 1;
    await db.update(adminOtpCodesTable).set({ attempts, ...(attempts >= 5 ? { used: true, lockedUntil: new Date(Date.now() + 15 * 60 * 1000) } : {}) })
      .where(eq(adminOtpCodesTable.id, stored.id));
    return res.status(401).json({ error: attempts >= 5 ? "Too many failed attempts. Request a new code later." : "Invalid or expired code." });
  }
  await db.update(adminOtpCodesTable).set({ used: true }).where(eq(adminOtpCodesTable.id, stored.id));
  const [admin] = await db.select().from(usersTable).where(and(eq(usersTable.email, email), eq(usersTable.storeId, storeId))).limit(1);
  if (!admin || !["admin", "superadmin"].includes(admin.role)) return res.status(404).json({ error: "Admin not found." });
  const token = await setSession(res, admin.id, storeId);
  const { passwordHash: _, ...safe } = admin;
  return res.json({ ...safe, token });
});

const forgotSchema = z.object({ email: emailSchema });
router.post("/auth/forgot-password", validate(forgotSchema), async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const email = req.body.email as string;
  const ok = { ok: true, message: "If that email is registered, a reset link will be sent." };
  if (await isRateLimited(`reset:email:${storeId}:${email}`, 5, 60 * 60 * 1000) || await isRateLimited(`reset:ip:${req.ip}`, 20, 60 * 60 * 1000)) return res.status(429).json({ error: "Too many reset requests. Try again later." });
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.email, email), eq(usersTable.storeId, storeId))).limit(1);
  if (!user) return res.json(ok);
  const token = randomBytes(32).toString("base64url");
  const expiry = new Date(Date.now() + 60 * 60 * 1000);
  await db.update(usersTable).set({ passwordResetToken: digest(token), passwordResetExpiry: expiry }).where(and(eq(usersTable.id, user.id), eq(usersTable.storeId, storeId)));
  const [storeUrlSetting] = await db.select({ value: appSettingsTable.value })
    .from(appSettingsTable).where(and(eq(appSettingsTable.key, "store_url"), eq(appSettingsTable.storeId, storeId))).limit(1);
  const appUrl = (process.env.PUBLIC_APP_URL || process.env.APP_URL || storeUrlSetting?.value || "")
    .split(",")[0].trim().replace(/\/$/, "");
  if (!appUrl) {
    await db.update(usersTable).set({ passwordResetToken: null, passwordResetExpiry: null }).where(and(eq(usersTable.id, user.id), eq(usersTable.storeId, storeId)));
    return res.status(503).json({ error: "Password reset email is not configured." });
  }
  const baseUrl = /^https?:\/\//i.test(appUrl) ? appUrl : `https://${appUrl}`;
  try {
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const emailData = buildPasswordResetEmail({
      name: user.name,
      resetUrl,
    });
    await sendEmail({
      to: email,
      storeId,
      ...emailData,
    });
    // Dispatch WhatsApp Password Reset notification
    const waText = buildWhatsAppPasswordResetMessage({ recipientName: user.name, resetUrl });
    sendWhatsAppNotification(user.email, waText, storeId).catch(() => {});
  } catch (error) {
    await db.update(usersTable).set({ passwordResetToken: null, passwordResetExpiry: null }).where(and(eq(usersTable.id, user.id), eq(usersTable.storeId, storeId)));
    console.error("[Auth] Password reset email failed:", error instanceof Error ? error.message : error);
    return res.status(503).json({ error: "Unable to deliver the password reset email. Please try again later." });
  }
  return res.json(ok);
});

const resetSchema = z.object({ token: z.string().min(20).max(200), password: PASSWORD_SCHEMA });
router.post("/auth/reset-password", validate(resetSchema), async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const { token, password } = req.body;
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.passwordResetToken, digest(token)), eq(usersTable.storeId, storeId))).limit(1);
  if (!user) return res.status(400).json({ error: "Invalid or expired reset token." });
  if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) return res.status(400).json({ error: "Reset token expired. Request a new one." });
  await db.update(usersTable).set({ passwordHash: await bcrypt.hash(password, 10), passwordResetToken: null, passwordResetExpiry: null }).where(and(eq(usersTable.id, user.id), eq(usersTable.storeId, storeId)));
  await db.delete(sessionsTable).where(and(eq(sessionsTable.userId, user.id), eq(sessionsTable.storeId, storeId)));
  return res.json({ ok: true, message: "Password reset successfully." });
});

router.get("/auth/google", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  const returnUrl = (req.query.returnUrl as string) || "";
  
  // 1. Fetch Google Client Credentials (Env or Database)
  let clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    // Check database settings
    const [dbClientId] = await db.select()
      .from(appSettingsTable)
      .where(and(eq(appSettingsTable.storeId, storeId), eq(appSettingsTable.key, "google_client_id")))
      .limit(1);
    clientId = dbClientId?.value;
  }

  if (!clientId) {
    return res.redirect("/?auth_error=google_not_configured");
  }

  // 2. Build redirect details
  const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
  
  // Bundle storeId and returnUrl in the state so we can restore context in callback
  const statePayload = Buffer.from(JSON.stringify({ storeId, returnUrl })).toString("base64url");
  
  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", statePayload);
  googleAuthUrl.searchParams.set("prompt", "select_account");

  return res.redirect(googleAuthUrl.toString());
});

router.get("/auth/google/callback", async (req: TenantRequest, res: Response) => {
  const { code, state } = req.query as { code?: string; state?: string };
  if (!code || !state) {
    return res.redirect("/?auth_error=invalid_callback_params");
  }

  try {
    // 1. Decode the state parameter
    const stateJson = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    const { storeId, returnUrl } = stateJson as { storeId: string; returnUrl: string };
    if (!storeId) {
      return res.redirect("/?auth_error=invalid_store_context");
    }

    // 2. Get Google Client Credentials
    let clientId = process.env.GOOGLE_CLIENT_ID;
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      const rows = await db.select()
        .from(appSettingsTable)
        .where(and(eq(appSettingsTable.storeId, storeId), inArray(appSettingsTable.key, ["google_client_id", "google_client_secret"])));
      
      const config = Object.fromEntries(rows.map(r => [r.key, r.value]));
      if (!clientId) clientId = config.google_client_id;
      if (!clientSecret) {
        const encryptedSecret = config.google_client_secret;
        if (encryptedSecret) {
          const { decryptCredential } = await import("../services/credentialVault");
          clientSecret = decryptCredential(encryptedSecret);
        }
      }
    }

    if (!clientId || !clientSecret) {
      return res.redirect("/?auth_error=google_credentials_missing");
    }

    // 3. Exchange code for access_token
    const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("[Google OAuth Callback] Token exchange failed:", errText);
      return res.redirect("/?auth_error=token_exchange_failed");
    }

    const tokenData = await tokenResponse.json() as { access_token: string };

    // 4. Fetch userinfo using access_token
    const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userinfoResponse.ok) {
      return res.redirect("/?auth_error=userinfo_fetch_failed");
    }

    const profile = await userinfoResponse.json() as { id: string; email: string; name: string; picture?: string };
    const email = profile.email.trim().toLowerCase();

    // 5. Look up or create user in usersTable
    let [user] = await db.select()
      .from(usersTable)
      .where(and(eq(usersTable.email, email), eq(usersTable.storeId, storeId)))
      .limit(1);

    if (!user) {
      const generatedPassword = randomBytes(24).toString("hex");
      const passwordHash = await bcrypt.hash(generatedPassword, 10);
      const [newUser] = await db.insert(usersTable).values({
        id: randomUUID(),
        storeId,
        email,
        name: profile.name || email.split("@")[0],
        passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      user = newUser;

      // Send Welcome Email asynchronously
      getStoreUrl(storeId).then((storeUrl) => {
        sendEmail({
          to: user.email,
          ...buildWelcomeEmail({ name: user.name, email: user.email, storeUrl }),
          storeId
        }).catch(() => {});
      }).catch(err => console.error("Failed to send welcome email for oauth user:", err));
    }

    // 6. Establish Session and Redirect Back
    await setSession(res, user.id, storeId);
    
    // Construct safe return URL
    const destination = returnUrl || "/account";
    return res.redirect(destination);
  } catch (err: any) {
    console.error("[Google OAuth Callback] Error:", err?.message || err);
    return res.redirect("/?auth_error=callback_processing_failed");
  }
});
export { requireAdmin, getSessionUser };
export default router;
