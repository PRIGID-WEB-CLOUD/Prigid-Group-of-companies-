import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import { db, appSettingsTable } from "@workspace/db";
import { addEvent } from "./channels";

const router = Router();

// Public config for storefront PayPal checkout rendering (SDK client ID)
router.get("/payments/paypal/public-config", async (_req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return res.json({
      clientId: settings.paypal_client_id || "",
      currency: settings.paypal_currency || "USD",
      environment: settings.paypal_environment || "sandbox",
      payIn4Enabled: settings.paypal_pay_in_4 !== "false",
      enabled: Boolean(settings.paypal_client_id),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin-only PayPal management endpoints
router.use("/payments/paypal", requireAdmin);

router.get("/payments/paypal/config", async (_req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return res.json({
      clientId: settings.paypal_client_id || "",
      clientSecretConfigured: Boolean(settings.paypal_client_secret),
      environment: settings.paypal_environment || "sandbox",
      currency: settings.paypal_currency || "USD",
      payIn4Enabled: settings.paypal_pay_in_4 !== "false",
      autoCapture: settings.paypal_auto_capture !== "false",
      connected: Boolean(settings.paypal_client_id && settings.paypal_client_secret),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/payments/paypal/config", async (req, res) => {
  try {
    const { clientId, clientSecret, environment, currency, payIn4Enabled, autoCapture } = req.body;

    const entries = [
      ["paypal_client_id", clientId],
      ["paypal_environment", environment || "sandbox"],
      ["paypal_currency", currency || "USD"],
      ["paypal_pay_in_4", String(payIn4Enabled ?? true)],
      ["paypal_auto_capture", String(autoCapture ?? true)],
    ];

    if (clientSecret && clientSecret !== "●●●●●●●●") {
      entries.push(["paypal_client_secret", clientSecret]);
    }

    for (const [key, value] of entries) {
      if (value !== undefined) {
        await db
          .insert(appSettingsTable)
          .values({ key, value, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: appSettingsTable.key,
            set: { value, updatedAt: new Date() },
          });
      }
    }

    await addEvent(
      "paypal",
      "Configuration updated",
      "PayPal & Pay in 4 gateway configuration updated",
      "info"
    );

    return res.json({ success: true, message: "PayPal settings saved successfully" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
