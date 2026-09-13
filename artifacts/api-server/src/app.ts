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
    if (
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:") ||
      origin.endsWith(".run.app") ||
      origin.endsWith(".replit.dev") ||
      origin.endsWith(".aistudio.app") ||
      allowedOrigins.includes(origin) ||
      allowedOrigins.length === 0
    ) {
      return callback(null, true);
    }
    return callback(null, true);
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

app.use(seoRouter);
app.use("/api", router);

// Serve static frontend assets in production / full-stack deployment
const storeCandidates = [
  path.resolve(process.cwd(), "dist"),
  path.resolve(process.cwd(), "dist/public"),
  path.resolve(process.cwd(), "artifacts/luxe-boutique/dist/public"),
];
const adminCandidates = [
  path.resolve(process.cwd(), "dist/admin"),
  path.resolve(process.cwd(), "dist/public/admin"),
  path.resolve(process.cwd(), "artifacts/luxe-boutique-admin/dist/public"),
];

const resolvedAdminDir = adminCandidates.find((d) => fs.existsSync(path.join(d, "index.html")));
if (resolvedAdminDir) {
  app.use("/admin", express.static(resolvedAdminDir));
  app.get(/^\/admin(\/.*)?$/, (_req, res) => {
    res.sendFile(path.join(resolvedAdminDir, "index.html"));
  });
}

const mobileCandidates = [
  path.resolve(process.cwd(), "dist/mobile"),
  path.resolve(process.cwd(), "dist/public/mobile"),
  path.resolve(process.cwd(), "artifacts/luxe-boutique-mobile/dist"),
];
const resolvedMobileDir = mobileCandidates.find((d) => fs.existsSync(d));
if (resolvedMobileDir) {
  app.use("/mobile", express.static(resolvedMobileDir));
}

const resolvedStoreDir = storeCandidates.find((d) => fs.existsSync(path.join(d, "index.html")));
if (resolvedStoreDir) {
  app.use(express.static(resolvedStoreDir));
  app.get("*any", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/admin") || req.path.startsWith("/mobile")) return next();
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
