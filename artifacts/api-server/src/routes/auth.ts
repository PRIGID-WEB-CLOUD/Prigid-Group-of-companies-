import { Router, type Request, type Response } from "express";
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "crypto";
import { db, usersTable, sessionsTable, adminOtpCodesTable, authRateLimitsTable, appSettingsTable } from "@workspace/db";
import { eq, or, and, gt, lt, gte, count, sql } from "drizzle-orm";
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

async function setSession(res: Response, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
  await db.insert(sessionsTable).values({ token: digest(token), userId, expiresAt });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

async function clearSession(req: Request, res: Response) {
  let token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }
  }
  if (token) await db.delete(sessionsTable).where(eq(sessionsTable.token, digest(token)));
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}

const registerSchema = z.object({ name: z.string().trim().min(1).max(120), email: emailSchema, password: PASSWORD_SCHEMA });
router.get("/auth/me", async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  return res.json(user);
});

router.post("/auth/register", validate(registerSchema), async (req, res) => {
  const { name, email, password } = req.body;
  if (await isRateLimited(`register:ip:${req.ip}`, 10, 15 * 60 * 1000) ||
      await isRateLimited(`register:email:${email}`, 5, 60 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many registration attempts. Try again later." });
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length) return res.status(409).json({ error: "Email already registered." });
  const user = { id: randomUUID(), name, email, role: "CUSTOMER", passwordHash: await bcrypt.hash(password, 10) };
  await db.insert(usersTable).values(user);
  const token = await setSession(res, user.id);
  
  // Dispatch welcome email & WhatsApp notification asynchronously
  getStoreUrl().then((storeUrl) => {
    sendEmail({ to: user.email, ...buildWelcomeEmail({ name: user.name, email: user.email, storeUrl }) }).catch(() => {});
    const waText = buildWhatsAppWelcomeMessage({ recipientName: user.name, storeUrl });
    sendWhatsAppNotification(user.email, waText).catch(() => {});
  }).catch(() => {});

  const { passwordHash: _, ...safe } = user;
  return res.status(201).json({ ...safe, token });
});

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
router.post("/auth/login", validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  if (await isRateLimited(`login:ip:${req.ip}`, 15, 15 * 60 * 1000) ||
      await isRateLimited(`login:email:${email}`, 10, 15 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many login attempts. Try again later." });
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: "Invalid email or password." });
  const token = await setSession(res, user.id);
  const { passwordHash: _, ...safe } = user;
  return res.json({ ...safe, token });
});

const firebaseAuthSchema = z.object({
  email: emailSchema,
  name: z.string().optional(),
  uid: z.string().optional(),
});

router.post("/auth/firebase", validate(firebaseAuthSchema), async (req, res) => {
  const { email, name, uid } = req.body;
  
  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    const userId = uid || randomUUID();
    const newUser = {
      id: userId,
      name: name || email.split("@")[0] || "Valued Customer",
      email,
      role: "CUSTOMER",
      passwordHash: await bcrypt.hash(randomUUID(), 10),
    };
    await db.insert(usersTable).values(newUser);
    user = newUser;

    // Dispatch welcome email asynchronously for new user
    getStoreUrl().then((storeUrl) => {
      sendEmail({ to: newUser.email, ...buildWelcomeEmail({ name: newUser.name, email: newUser.email, storeUrl }) }).catch(() => {});
    }).catch(() => {});
  }
  
  const token = await setSession(res, user.id);
  const { passwordHash: _, ...safe } = user;
  return res.json({ ...safe, token });
});

router.post("/auth/logout", async (req, res) => { await clearSession(req, res); return res.json({ ok: true }); });
router.post("/auth/logout-all", requireAdmin, async (req, res) => {
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, req.adminUser!.id));
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res.json({ ok: true });
});

router.get("/auth/admin/exists", async (_req, res) => {
  const rows = await db
    .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, role: usersTable.role })
    .from(usersTable)
    .where(or(eq(usersTable.role, "ADMIN"), eq(usersTable.role, "SUPER_ADMIN")));
  const isProd = process.env.NODE_ENV === "production";
  return res.json({
    exists: rows.length > 0,
    admins: isProd ? [] : rows.map((r) => ({ email: r.email, name: r.name, role: r.role })),
  });
});

router.post("/auth/admin/quick-login", async (req, res) => {
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
      .where(eq(usersTable.email, cleanEmail))
      .limit(1);
  } else {
    [admin] = await db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.role, "SUPER_ADMIN"), eq(usersTable.role, "ADMIN")))
      .limit(1);
  }

  if (!admin || !["ADMIN", "SUPER_ADMIN"].includes(admin.role)) {
    return res.status(403).json({ error: "No admin privileges found for this account." });
  }

  const token = await setSession(res, admin.id);
  const { passwordHash: _, ...safe } = admin;
  return res.json({ ...safe, token });
});

const bootstrapSchema = z.object({ name: z.string().trim().min(1).max(120), email: emailSchema });
router.post("/auth/admin/bootstrap", validate(bootstrapSchema), async (req, res) => {
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
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('luxe_boutique_admin_bootstrap'))`);
    const existing = await tx.select({ id: usersTable.id }).from(usersTable)
      .where(or(eq(usersTable.role, "ADMIN"), eq(usersTable.role, "SUPER_ADMIN"))).limit(1);
    if (existing.length) return null;
    const [created] = await tx.insert(usersTable).values({
      id: randomUUID(), name, email, role: "SUPER_ADMIN", passwordHash: "",
    }).returning();
    return created;
  });
  if (!user) return res.status(410).json({ error: "Admin bootstrap is disabled after initial setup." });
  await setSession(res, user.id);
  const { passwordHash: _, ...safe } = user;
  return res.status(201).json(safe);
});

const otpRequestSchema = z.object({ email: emailSchema });
router.post("/auth/admin/request-otp", validate(otpRequestSchema), async (req, res) => {
  const email = req.body.email as string;
  if (await isRateLimited(`otp:email:${email}`, 5, 15 * 60 * 1000) || await isRateLimited(`otp:ip:${req.ip}`, 20, 15 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many OTP requests. Try again later." });
  }
  const [admin] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!admin || !["ADMIN", "SUPER_ADMIN"].includes(admin.role)) return res.status(404).json({ error: "No admin account found for this email." });
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.update(adminOtpCodesTable).set({ used: true })
    .where(and(eq(adminOtpCodesTable.email, email), eq(adminOtpCodesTable.used, false)));
  await db.delete(adminOtpCodesTable).where(lt(adminOtpCodesTable.expiresAt, new Date()));
  await db.insert(adminOtpCodesTable).values({ id: randomUUID(), email, code: otpDigest(email, code), expiresAt, used: false, attempts: 0 });
  try {
    const emailData = buildOtpEmail({ code });
    await sendEmail({
      to: email,
      ...emailData,
    });
    // Dispatch WhatsApp OTP alert asynchronously
    const waText = buildWhatsAppOtpMessage({ code });
    sendWhatsAppNotification(email, waText).catch(() => {});
    return res.json({ ok: true });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEVELOPMENT ONLY] Admin OTP code for ${email}: ${code}`);
      return res.json({ ok: true, devCode: code });
    }
    await db.update(adminOtpCodesTable).set({ used: true }).where(eq(adminOtpCodesTable.email, email));
    console.error("[Auth] Admin OTP email failed:", error instanceof Error ? error.message : error);
    return res.status(503).json({ error: "Unable to deliver the sign-in code. Please contact an administrator." });
  }
});

const otpVerifySchema = z.object({ email: emailSchema, otp: z.string().regex(/^\d{6}$/).optional(), code: z.string().regex(/^\d{6}$/).optional() })
  .refine((body) => Boolean(body.otp ?? body.code), { message: "otp is required", path: ["otp"] });
router.post("/auth/admin/verify-otp", validate(otpVerifySchema), async (req, res) => {
  const email = req.body.email as string;
  const otp = (req.body.otp ?? req.body.code) as string;
  if (await isRateLimited(`otp-verify:ip:${req.ip}`, 30, 15 * 60 * 1000)) return res.status(429).json({ error: "Too many verification attempts. Try again later." });
  const [stored] = await db.select().from(adminOtpCodesTable)
    .where(and(eq(adminOtpCodesTable.email, email), eq(adminOtpCodesTable.used, false), gt(adminOtpCodesTable.expiresAt, new Date()))).limit(1);
  if (!stored || (stored.lockedUntil && stored.lockedUntil > new Date())) return res.status(401).json({ error: "Invalid or expired code." });
  const valid = safeCompare(stored.code, otpDigest(email, otp));
  if (!valid) {
    const attempts = stored.attempts + 1;
    await db.update(adminOtpCodesTable).set({ attempts, ...(attempts >= 5 ? { used: true, lockedUntil: new Date(Date.now() + 15 * 60 * 1000) } : {}) })
      .where(eq(adminOtpCodesTable.id, stored.id));
    return res.status(401).json({ error: attempts >= 5 ? "Too many failed attempts. Request a new code later." : "Invalid or expired code." });
  }
  await db.update(adminOtpCodesTable).set({ used: true }).where(eq(adminOtpCodesTable.id, stored.id));
  const [admin] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!admin || !["ADMIN", "SUPER_ADMIN"].includes(admin.role)) return res.status(404).json({ error: "Admin not found." });
  const token = await setSession(res, admin.id);
  const { passwordHash: _, ...safe } = admin;
  return res.json({ ...safe, token });
});

const forgotSchema = z.object({ email: emailSchema });
router.post("/auth/forgot-password", validate(forgotSchema), async (req, res) => {
  const email = req.body.email as string;
  const ok = { ok: true, message: "If that email is registered, a reset link will be sent." };
  if (await isRateLimited(`reset:email:${email}`, 5, 60 * 60 * 1000) || await isRateLimited(`reset:ip:${req.ip}`, 20, 60 * 60 * 1000)) return res.status(429).json({ error: "Too many reset requests. Try again later." });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) return res.json(ok);
  const token = randomBytes(32).toString("base64url");
  const expiry = new Date(Date.now() + 60 * 60 * 1000);
  await db.update(usersTable).set({ passwordResetToken: digest(token), passwordResetExpiry: expiry }).where(eq(usersTable.id, user.id));
  const [storeUrlSetting] = await db.select({ value: appSettingsTable.value })
    .from(appSettingsTable).where(eq(appSettingsTable.key, "store_url")).limit(1);
  const appUrl = (process.env.PUBLIC_APP_URL || process.env.APP_URL || storeUrlSetting?.value || "")
    .split(",")[0].trim().replace(/\/$/, "");
  if (!appUrl) {
    await db.update(usersTable).set({ passwordResetToken: null, passwordResetExpiry: null }).where(eq(usersTable.id, user.id));
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
      ...emailData,
    });
    // Dispatch WhatsApp Password Reset notification
    const waText = buildWhatsAppPasswordResetMessage({ recipientName: user.name, resetUrl });
    sendWhatsAppNotification(user.email, waText).catch(() => {});
  } catch (error) {
    await db.update(usersTable).set({ passwordResetToken: null, passwordResetExpiry: null }).where(eq(usersTable.id, user.id));
    console.error("[Auth] Password reset email failed:", error instanceof Error ? error.message : error);
    return res.status(503).json({ error: "Unable to deliver the password reset email. Please try again later." });
  }
  return res.json(ok);
});

const resetSchema = z.object({ token: z.string().min(20).max(200), password: PASSWORD_SCHEMA });
router.post("/auth/reset-password", validate(resetSchema), async (req, res) => {
  const { token, password } = req.body;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.passwordResetToken, digest(token))).limit(1);
  if (!user) return res.status(400).json({ error: "Invalid or expired reset token." });
  if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) return res.status(400).json({ error: "Reset token expired. Request a new one." });
  await db.update(usersTable).set({ passwordHash: await bcrypt.hash(password, 10), passwordResetToken: null, passwordResetExpiry: null }).where(eq(usersTable.id, user.id));
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, user.id));
  return res.json({ ok: true, message: "Password reset successfully." });
});

router.get("/auth/google", (_req, res) => res.redirect("/?auth_error=google_not_configured"));
export { requireAdmin, getSessionUser };
export default router;