import app from "./app";
import { logger } from "./lib/logger";
import { ensureDefaults } from "./routes/channels";
import { loadBrandingCache } from "./services/mailer";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (process.env.NODE_ENV === "production") {
  if (process.env.AUTH_DEV_BYPASS === "true") {
    throw new Error("SECURITY FAULT: AUTH_DEV_BYPASS is prohibited in production builds and has been stripped.");
  }
} else if (process.env.AUTH_DEV_BYPASS === "true") {
  logger.warn("AUTH_DEV_BYPASS ENABLED — DEVELOPMENT ONLY. NEVER DEPLOY WITH THIS FLAG.");
}

async function start() {
  await loadBrandingCache().catch((err) => {
    logger.error({ err }, "Failed to load branding cache during startup");
  });

  const server = app.listen(port, () => {
    logger.info({ port }, "Server listening");
    ensureDefaults().catch((err) => {
      logger.error({ err }, "Failed to ensure default channel configurations");
    });
  });

  server.on("error", (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
}

start().catch((error) => {
  logger.fatal({ err: error }, "Startup initialization failed");
  process.exit(1);
});
