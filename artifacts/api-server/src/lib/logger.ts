import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
    "req.headers['stripe-signature']",
    "req.headers['x-paystack-signature']",
    "req.headers['verif-hash']",
    "password",
    "*.password",
    "passwordHash",
    "*.passwordHash",
    "secret",
    "*.secret",
    "apiSecret",
    "*.apiSecret",
    "clientSecret",
    "*.clientSecret",
    "token",
    "*.token",
    "accessToken",
    "*.accessToken",
    "refreshToken",
    "*.refreshToken",
    "encryptedAccessToken",
    "encryptedRefreshToken",
    "encryptedPublishableKey",
    "encryptedWebhookSecret",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
