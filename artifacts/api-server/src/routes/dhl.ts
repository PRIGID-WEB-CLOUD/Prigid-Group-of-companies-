import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import { db, appSettingsTable } from "@workspace/db";
import { addEvent } from "./channels";

const router = Router();

// Public webhook for DHL express flight scans and parcel updates
router.post("/shipping/dhl/webhook", async (req, res) => {
  try {
    const payload = req.body;
    await addEvent(
      "dhl",
      "Scan Update",
      `DHL Express event: ${payload?.eventCode || "transit_scan"}`,
      "sync"
    );
    return res.json({ status: "ACKNOWLEDGED" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin-only DHL logistics endpoints
router.use("/shipping/dhl", requireAdmin);

router.get("/shipping/dhl/config", async (_req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return res.json({
      apiKey: settings.dhl_api_key || "",
      apiSecretConfigured: Boolean(settings.dhl_api_secret),
      accountNumber: settings.dhl_account_number || "",
      pickupLocation: settings.dhl_pickup_location || "PARIS-CDG-CENTRAL",
      paperlessTrade: settings.dhl_paperless_trade !== "false",
      signatureRequired: settings.dhl_signature_required !== "false",
      connected: Boolean(settings.dhl_api_key && settings.dhl_account_number),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/shipping/dhl/config", async (req, res) => {
  try {
    const { apiKey, apiSecret, accountNumber, pickupLocation, paperlessTrade, signatureRequired } = req.body;

    const entries = [
      ["dhl_api_key", apiKey],
      ["dhl_account_number", accountNumber],
      ["dhl_pickup_location", pickupLocation || "PARIS-CDG-CENTRAL"],
      ["dhl_paperless_trade", String(paperlessTrade ?? true)],
      ["dhl_signature_required", String(signatureRequired ?? true)],
    ];

    if (apiSecret && apiSecret !== "●●●●●●●●") {
      entries.push(["dhl_api_secret", apiSecret]);
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
      "dhl",
      "Settings updated",
      "DHL Express Worldwide Logistics connector settings updated",
      "info"
    );

    return res.json({ success: true, message: "DHL Express settings saved successfully" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/shipping/dhl/generate-waybill", async (req, res) => {
  try {
    const { orderId } = req.body;
    const trackingNumber = `DHL-${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    await addEvent(
      "dhl",
      "Air Waybill Generated",
      `Generated DHL Air Waybill #${trackingNumber} for Order #${orderId || "TEST"}`,
      "sync"
    );

    return res.json({
      success: true,
      trackingNumber,
      carrier: "DHL Express Worldwide",
      estimatedDelivery: "24-48 Hours Priority Air",
      commercialInvoiceUrl: `/api/shipping/dhl/invoices/${trackingNumber}.pdf`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
