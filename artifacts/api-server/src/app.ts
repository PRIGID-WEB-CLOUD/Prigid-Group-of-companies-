import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import seoRouter from "./routes/seo";
import { logger } from "./lib/logger";
import { uploadsDir } from "./routes/upload";
import { tenantResolver } from "./middleware/tenantContext";
import { db, storesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const app: Express = express();
app.set("trust proxy", true);
app.disable("x-powered-by");

const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const developmentOrigins = [
  "http://localhost:3000",
  "http://localhost:3005",
  "http://localhost:5000",
  "http://localhost:5173",
  process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "",
].filter(Boolean);
const allowedOrigins = [...new Set([...configuredOrigins, ...developmentOrigins])];

app.use(
  pinoHttp({
    logger,
    customLogLevel(req, res, err) {
      if (res.statusCode >= 500 || err) return "error";
      if (res.statusCode >= 400) return "info";
      return "info";
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    // 1. Allow Dev and Hardcoded Origins
    const isAllowedStatic = 
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:") ||
      origin.endsWith(".run.app") ||
      origin.endsWith(".replit.dev") ||
      origin.endsWith(".aistudio.app") ||
      allowedOrigins.includes(origin) ||
      allowedOrigins.length === 0;

    if (isAllowedStatic) {
      return callback(null, true);
    }

    // 2. Asynchronously check DB for customDomain/subdomain matching
    (async () => {
      try {
        const parsed = new URL(origin);
        const host = parsed.hostname;

        // Check customDomain matches host
        const [customDomainMatch] = await db.select()
          .from(storesTable)
          .where(eq(storesTable.customDomain, host))
          .limit(1);

        if (customDomainMatch) {
          return callback(null, true);
        }

        // Check if host ends with our base platform domain and is a valid tenant slug
        const baseAppUrl = (process.env.PUBLIC_APP_URL || process.env.APP_URL || "").trim();
        if (baseAppUrl) {
          const platformUrl = new URL(baseAppUrl);
          const hostParts = platformUrl.hostname.split(".");
          const baseDomain = hostParts.slice(-2).join(".");

          if (host.endsWith(`.${baseDomain}`)) {
            const slug = host.replace(`.${baseDomain}`, "");
            const [slugMatch] = await db.select()
              .from(storesTable)
              .where(eq(storesTable.slug, slug))
              .limit(1);

            if (slugMatch) {
              return callback(null, true);
            }
          }
        }
      } catch (err) {
        logger.error({ err, origin }, "Error during dynamic CORS verification");
      }

      // Default: Deny if not a verified tenant custom domain or platform domain
      return callback(new Error("Not allowed by CORS (SaaS Domain Protection)"));
    })();
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({
  limit: "256kb",
  strict: true,
  verify: (req, _res, buffer) => {
    (req as express.Request & { rawBody?: string }).rawBody = buffer.toString("utf8");
  },
}));
app.use(express.urlencoded({ extended: false, limit: "64kb", parameterLimit: 100 }));

// Static serving for local media and product image uploads
app.use("/api/uploads", express.static(uploadsDir));

app.post("/api/waitlist", (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  try {
    const dirPath = path.join(process.cwd(), "artifacts/db-fallback");
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const filePath = path.join(dirPath, "waitlist.json");
    let current: string[] = [];
    if (fs.existsSync(filePath)) {
      try {
        current = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      } catch (e) {
        current = [];
      }
    }
    if (!current.includes(email)) {
      current.push(email);
      fs.writeFileSync(filePath, JSON.stringify(current, null, 2));
    }
    return res.status(201).json({ success: true, message: "Thank you for your interest! You have been added to the waitlist." });
  } catch (err: any) {
    logger.error(err, "Failed to save waitlist email");
    return res.status(500).json({ error: "Failed to join waitlist. Please try again." });
  }
});

app.use(seoRouter);
app.use("/api", tenantResolver, router);

// Serve static frontend assets in production / full-stack deployment
const storeCandidates = [
  path.resolve(process.cwd(), "dist"),
  path.resolve(process.cwd(), "dist/public"),
  path.resolve(process.cwd(), "artifacts/luxe-boutique/dist/public"),
];
const adminCandidates = [
  path.resolve(process.cwd(), "dist/seller"),
  path.resolve(process.cwd(), "dist/public/seller"),
  path.resolve(process.cwd(), "artifacts/luxe-boutique-admin/dist/public"),
];
const landingCandidates = [
  path.resolve(process.cwd(), "dist/landing"),
  path.resolve(process.cwd(), "artifacts/prigid-landing"),
];

const resolvedAdminDir = adminCandidates.find((d) => fs.existsSync(path.join(d, "index.html")));
if (resolvedAdminDir) {
  app.use("/seller", express.static(resolvedAdminDir));
  app.get(/^\/seller(\/.*)?$/, (_req, res) => {
    res.sendFile(path.join(resolvedAdminDir, "index.html"));
  });
}

app.get("/landing", (_req, res) => {
  res.redirect("/");
});

const mobileCandidates = [
  path.resolve(process.cwd(), "dist/mobile"),
  path.resolve(process.cwd(), "dist/public/mobile"),
  path.resolve(process.cwd(), "artifacts/luxe-boutique-mobile/dist"),
];
const resolvedMobileDir = mobileCandidates.find((d) => fs.existsSync(d));
if (resolvedMobileDir) {
  app.use("/mobile", express.static(resolvedMobileDir));
}

const resolvedLandingDir = landingCandidates.find((d) => fs.existsSync(path.join(d, "index.html")));
const resolvedStoreDir = storeCandidates.find((d) => fs.existsSync(path.join(d, "index.html")));

if (resolvedLandingDir && resolvedStoreDir) {
  // If the visitor goes to '/' or '/platform'
  app.get(["/", "/platform"], async (req, res, next) => {
    const host = req.hostname;
    const isStorePreview = req.query.preview === "store" || req.query.store === "true";

    let isTenant = false;
    let storeRecord = null;
    try {
      if (host && !host.includes("localhost") && !host.endsWith(".run.app") && !host.endsWith(".aistudio.app")) {
        // Resolve by custom domain
        [storeRecord] = await db.select().from(storesTable).where(eq(storesTable.customDomain, host)).limit(1);
        if (storeRecord) isTenant = true;
      } else if (host && host.endsWith(".prigidcommerce.com")) {
        // Resolve by slug subdomain
        const slug = host.split(".")[0];
        if (slug !== "www" && slug !== "platform") {
          [storeRecord] = await db.select().from(storesTable).where(eq(storesTable.slug, slug)).limit(1);
          if (storeRecord) isTenant = true;
        }
      }
    } catch (err) {
      logger.error(err, "Tenant lookup failed in landing router");
    }

    if (isTenant) {
      if (storeRecord && (storeRecord.status === "suspended" || storeRecord.publishStatus === "SUSPENDED")) {
        return res.status(403).send(`
          <html>
            <head>
              <title>Store Suspended</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #1e293b; }
                .card { text-align: center; padding: 2rem; border-radius: 8px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 400px; }
                h1 { font-size: 24px; margin-bottom: 1rem; color: #ef4444; }
                p { font-size: 16px; color: #64748b; line-height: 1.5; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>Store Suspended</h1>
                <p>This store has been suspended. Please contact Prigid Commerce Group support.</p>
              </div>
            </body>
          </html>
        `);
      }
      return next(); // Passes to serve storefront React app!
    }

    if (isStorePreview) {
      const isMasterHost = !host || host.includes("localhost") || host.endsWith(".run.app") || host.endsWith(".aistudio.app");
      if (isMasterHost) {
        return res.redirect("/landing");
      }
      return next();
    }

    // Serve the standalone SaaS marketing page
    res.sendFile(path.join(resolvedLandingDir, "index.html"));
  });
}

if (resolvedStoreDir) {
  app.get(["/boutique/:slug", "/store/:slug"], (req, res) => {
    const { slug } = req.params;
    res.cookie("prigid_store_slug", slug, { path: "/", maxAge: 86400000, sameSite: "lax" });
    return res.sendFile(path.join(resolvedStoreDir, "index.html"));
  });

  app.use(express.static(resolvedStoreDir));
  app.get("*any", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/seller") || req.path.startsWith("/mobile")) return next();
    res.sendFile(path.join(resolvedStoreDir, "index.html"));
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err: error }, "Unhandled request error");
  if (res.headersSent) return;
  const message = error instanceof Error ? error.message : "Internal server error.";
  res.status(500).json({ error: message, details: error instanceof Error ? error.stack : String(error) });
});

export default app;
