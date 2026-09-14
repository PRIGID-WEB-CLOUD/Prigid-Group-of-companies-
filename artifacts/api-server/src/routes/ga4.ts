import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import { db, appSettingsTable } from "@workspace/db";
import { addEvent } from "./channels";
import { and, eq } from "drizzle-orm";
import { type TenantRequest } from "../middleware/tenantContext";

const router = Router();

// Public GA4 config endpoint for storefront tracking injection
router.get("/analytics/ga4/public-config", async (req: TenantRequest, res) => {
  try {
    const storeId = req.storeId!;
    const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.storeId, storeId));
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return res.json({
      measurementId: settings.ga4_measurement_id || "",
      enabled: Boolean(settings.ga4_measurement_id && settings.ga4_enabled !== "false"),
      enhancedEcommerce: settings.ga4_enhanced_ecommerce !== "false",
      gtmContainerId: settings.gtm_container_id || "",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin-only management endpoints
router.use("/analytics/ga4", requireAdmin);

router.get("/analytics/ga4/config", async (req: TenantRequest, res) => {
  try {
    const storeId = req.storeId!;
    const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.storeId, storeId));
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return res.json({
      measurementId: settings.ga4_measurement_id || "",
      apiSecret: settings.ga4_api_secret ? "●●●●●●●●" : "",
      gtmContainerId: settings.gtm_container_id || "",
      enhancedEcommerce: settings.ga4_enhanced_ecommerce !== "false",
      debugMode: settings.ga4_debug_mode === "true",
      enabled: settings.ga4_enabled !== "false",
      connected: Boolean(settings.ga4_measurement_id),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/analytics/ga4/config", async (req: TenantRequest, res) => {
  try {
    const storeId = req.storeId!;
    const { measurementId, apiSecret, gtmContainerId, enhancedEcommerce, debugMode, enabled } = req.body;

    const entries = [
      ["ga4_measurement_id", measurementId],
      ["gtm_container_id", gtmContainerId],
      ["ga4_enhanced_ecommerce", String(enhancedEcommerce ?? true)],
      ["ga4_debug_mode", String(debugMode ?? false)],
      ["ga4_enabled", String(enabled ?? true)],
    ];

    if (apiSecret && apiSecret !== "●●●●●●●●") {
      entries.push(["ga4_api_secret", apiSecret]);
    }

    const { randomUUID } = await import("crypto");

    for (const [key, value] of entries) {
      if (value !== undefined) {
        await db
          .insert(appSettingsTable)
          .values({ id: randomUUID(), storeId, key, value, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: [appSettingsTable.storeId, appSettingsTable.key],
            set: { value, updatedAt: new Date() },
          });
      }
    }

    await addEvent(
      "ga4",
      "Settings updated",
      "Google Analytics 4 & Tag Manager connector configuration updated",
      "info",
      storeId
    );

    return res.json({ success: true, message: "Google Analytics 4 settings saved" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
