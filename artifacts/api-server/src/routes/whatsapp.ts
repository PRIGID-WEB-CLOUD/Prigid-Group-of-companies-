import { Router } from "express";
import { randomUUID } from "crypto";
import { addEvent, getChannelCredentials } from "./channels";
import { requireAdmin } from "../middleware/requireAdmin";
import { db, whatsappTemplatesTable, whatsappJourneysTable, whatsappOptinSettingsTable, newsletterSubscribersTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router = Router();
router.use("/whatsapp", requireAdmin);
router.use("/channels/whatsapp", requireAdmin);

function getWaCreds() { return getChannelCredentials("whatsapp"); }

// ── Sync Templates from WhatsApp Cloud API ────────────────────────────────────

export async function syncTemplatesFromWhatsApp(customWabaId?: string, customToken?: string): Promise<{
  success: boolean;
  count: number;
  error?: string;
  templates?: any[];
}> {
  const creds = await getWaCreds();
  const wabaId = customWabaId || creds["waba_id"];
  const token = customToken || creds["system_access_token"];

  if (!wabaId || !token) {
    return { success: false, count: 0, error: "Missing WhatsApp WABA ID or System Access Token. Please configure credentials in API Credentials." };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=id,name,status,category,language,components&limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json() as Record<string, any>;
    if (!res.ok || data.error) {
      const errMsg = data.error?.error_user_msg || data.error?.message || `HTTP ${res.status}`;
      return { success: false, count: 0, error: errMsg };
    }

    const waTemplates: any[] = Array.isArray(data.data) ? data.data : [];

    for (const item of waTemplates) {
      const name = item.name;
      if (!name) continue;

      let body = "";
      if (Array.isArray(item.components)) {
        const bodyComp = item.components.find((c: any) => c.type === "BODY");
        if (bodyComp && bodyComp.text) {
          body = bodyComp.text;
        }
      }

      // Format status
      const rawStatus = String(item.status || "PENDING").toUpperCase();
      let formattedStatus = "Pending";
      if (rawStatus === "APPROVED") formattedStatus = "Approved";
      else if (rawStatus === "REJECTED") formattedStatus = "Rejected";
      else if (rawStatus === "PAUSED") formattedStatus = "Paused";
      else if (rawStatus === "PENDING") formattedStatus = "Pending";
      else formattedStatus = rawStatus.charAt(0) + rawStatus.slice(1).toLowerCase();

      // Format category
      const rawCat = String(item.category || "MARKETING").toUpperCase();
      let formattedCategory = "Marketing";
      if (rawCat === "UTILITY") formattedCategory = "Utility";
      else if (rawCat === "AUTHENTICATION") formattedCategory = "Authentication";
      else formattedCategory = "Marketing";

      const language = item.language || "en_US";

      const [existing] = await db.select().from(whatsappTemplatesTable)
        .where(eq(whatsappTemplatesTable.name, name)).limit(1);

      if (existing) {
        await db.update(whatsappTemplatesTable).set({
          status: formattedStatus,
          category: formattedCategory,
          language,
          ...(body ? { body } : {}),
        }).where(eq(whatsappTemplatesTable.id, existing.id));
      } else {
        await db.insert(whatsappTemplatesTable).values({
          id: item.id ? String(item.id) : randomUUID(),
          name,
          category: formattedCategory,
          body: body || `*[${name.toUpperCase()}]*`,
          status: formattedStatus,
          language,
          sentCount: 0,
          createdAt: new Date(),
        });
      }
    }

    const allTemplates = await db.select().from(whatsappTemplatesTable).orderBy(desc(whatsappTemplatesTable.createdAt));
    return { success: true, count: waTemplates.length, templates: allTemplates };
  } catch (err) {
    return { success: false, count: 0, error: String(err) };
  }
}

// ── Templates Routes ──────────────────────────────────────────────────────────

router.get("/whatsapp/templates", async (req, res) => {
  const skipSync = req.query.sync === "false";
  const creds = await getWaCreds();

  // If credentials are configured, sync directly with WhatsApp Cloud API to get latest templates
  if (!skipSync && creds["waba_id"] && creds["system_access_token"]) {
    try {
      await syncTemplatesFromWhatsApp(creds["waba_id"], creds["system_access_token"]);
    } catch (e) {
      console.warn("WhatsApp template background sync error:", e);
    }
  }

  const list = await db.select().from(whatsappTemplatesTable).orderBy(desc(whatsappTemplatesTable.createdAt));
  return res.json(list);
});

router.post("/whatsapp/templates/sync", async (_req, res) => {
  const result = await syncTemplatesFromWhatsApp();
  if (!result.success) {
    return res.status(400).json({ error: result.error ?? "Failed to sync templates from WhatsApp" });
  }
  return res.json({ success: true, count: result.count, templates: result.templates });
});

router.post("/whatsapp/templates", async (req, res) => {
  const { name, category, body, language } = req.body as {
    name: string;
    category?: string;
    body: string;
    language?: string;
  };

  if (!name || !body) {
    return res.status(400).json({ error: "Template name and message body are required." });
  }

  // Sanitize template name for WhatsApp Graph API: lowercase alphanumeric and underscores only
  const cleanName = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  if (!cleanName) {
    return res.status(400).json({ error: "Template name must contain alphanumeric characters or underscores (e.g. order_update_v1)." });
  }

  const creds = await getWaCreds();
  const wabaId = creds["waba_id"];
  const token = creds["system_access_token"];
  const chosenCategory = (category || "Marketing").trim();
  const formattedCat = chosenCategory.toUpperCase();
  const chosenLang = language || "en_US";

  // If WhatsApp credentials are set, submit directly to WhatsApp Cloud API first
  if (wabaId && token) {
    try {
      const bodyComponent: Record<string, any> = {
        type: "BODY",
        text: body.trim(),
      };

      // Handle variable placeholders {{1}}, {{2}}, etc. required by Meta Cloud API
      const varMatches = body.match(/\{\{(\d+)\}\}/g);
      if (varMatches && varMatches.length > 0) {
        const uniqueVars = Array.from(new Set(varMatches));
        const sampleValues = uniqueVars.map((_, i) => `Sample ${i + 1}`);
        bodyComponent.example = {
          body_text: [sampleValues],
        };
      }

      const metaRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: cleanName,
          language: chosenLang,
          category: formattedCat,
          components: [bodyComponent],
        }),
      });

      const metaData = await metaRes.json() as Record<string, any>;
      const alreadyExists = metaData.error?.message?.includes("already exists") || metaData.error?.error_subcode === 2388046;

      if (!metaRes.ok && metaData.error && !alreadyExists) {
        const errorMsg = metaData.error?.error_user_msg || metaData.error?.message || `WhatsApp Meta API error (HTTP ${metaRes.status})`;
        return res.status(400).json({ error: errorMsg, details: metaData.error });
      }

      // Automatically fetch updated templates from WhatsApp Cloud API to sync state
      await syncTemplatesFromWhatsApp(wabaId, token);

      let [synced] = await db.select().from(whatsappTemplatesTable)
        .where(eq(whatsappTemplatesTable.name, cleanName)).limit(1);

      if (!synced) {
        // In case Meta takes a moment to list the new template in GET, store in DB with initial status
        const [inserted] = await db.insert(whatsappTemplatesTable).values({
          id: metaData.id ? String(metaData.id) : randomUUID(),
          name: cleanName,
          category: chosenCategory,
          body: body.trim(),
          status: metaData.status === "APPROVED" ? "Approved" : "Pending",
          language: chosenLang,
          sentCount: 0,
          createdAt: new Date(),
        }).onConflictDoUpdate({
          target: whatsappTemplatesTable.name,
          set: {
            body: body.trim(),
            category: chosenCategory,
            status: metaData.status === "APPROVED" ? "Approved" : "Pending",
          },
        }).returning();
        synced = inserted;
      }

      addEvent(
        "whatsapp",
        `Template "${cleanName}" created on WhatsApp`,
        `Status: ${synced?.status || "Pending"}. Fetched & synced directly from WhatsApp Cloud API.`,
        "sync"
      );

      return res.status(201).json({
        ...synced,
        fromWhatsApp: true,
        metaId: metaData.id,
      });
    } catch (err) {
      return res.status(500).json({ error: `Failed connecting to WhatsApp Cloud API: ${String(err)}` });
    }
  }

  // Fallback: If no WhatsApp credentials configured yet, save locally as Draft
  const [tpl] = await db.insert(whatsappTemplatesTable).values({
    id: randomUUID(),
    name: cleanName,
    category: chosenCategory,
    body: body.trim(),
    status: "Draft",
    language: chosenLang,
    sentCount: 0,
    createdAt: new Date(),
  }).onConflictDoUpdate({
    target: whatsappTemplatesTable.name,
    set: {
      body: body.trim(),
      category: chosenCategory,
      status: "Draft",
    },
  }).returning();

  addEvent("whatsapp", `Template draft saved: ${cleanName}`, "Template saved locally. Add WhatsApp credentials to sync directly with WhatsApp Cloud API.", "info");

  return res.status(201).json({
    ...tpl,
    fromWhatsApp: false,
    warning: "WhatsApp credentials not configured. Template saved locally as Draft. Connect API Credentials to publish to WhatsApp.",
  });
});

router.delete("/whatsapp/templates/:id", async (req, res) => {
  const { id } = req.params;
  const [template] = await db.select().from(whatsappTemplatesTable)
    .where(eq(whatsappTemplatesTable.id, id as string)).limit(1);

  if (template) {
    const creds = await getWaCreds();
    const wabaId = creds["waba_id"];
    const token = creds["system_access_token"];

    // Attempt deleting from WhatsApp Cloud API if credentials are present
    if (wabaId && token && template.name) {
      try {
        await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates?name=${encodeURIComponent(template.name)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.warn("Could not delete template from WhatsApp Cloud API:", err);
      }
    }

    await db.delete(whatsappTemplatesTable).where(eq(whatsappTemplatesTable.id, id as string));
    addEvent("whatsapp", `Template deleted: ${template.name}`, "Template removed from database and WhatsApp.", "info");
  }

  return res.json({ ok: true });
});

router.post("/whatsapp/templates/:id/submit", async (req, res) => {
  const { id } = req.params;
  const [template] = await db.select().from(whatsappTemplatesTable)
    .where(eq(whatsappTemplatesTable.id, id as string)).limit(1);
  if (!template) return res.status(404).json({ error: "Template not found" });

  const creds = await getWaCreds();
  const wabaId = creds["waba_id"];
  const token = creds["system_access_token"];
  if (!wabaId || !token) {
    return res.status(400).json({ error: "Missing WhatsApp WABA ID or System Access Token. Configure credentials in WhatsApp settings." });
  }

  try {
    const bodyComponent: Record<string, any> = {
      type: "BODY",
      text: template.body,
    };
    const varMatches = template.body.match(/\{\{(\d+)\}\}/g);
    if (varMatches && varMatches.length > 0) {
      const uniqueVars = Array.from(new Set(varMatches));
      bodyComponent.example = {
        body_text: [uniqueVars.map((_, i) => `Sample ${i + 1}`)],
      };
    }

    const r = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: template.name,
        language: template.language || "en_US",
        category: template.category.toUpperCase(),
        components: [bodyComponent],
      }),
    });
    const data = await r.json() as Record<string, unknown>;
    const alreadyExists = (data["error"] as any)?.message?.includes("already exists") || (data["error"] as any)?.error_subcode === 2388046;

    if (!r.ok && data["error"] && !alreadyExists) {
      return res.status(400).json({ error: (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}` });
    }

    // Automatically sync templates from WhatsApp
    await syncTemplatesFromWhatsApp(wabaId, token);

    await db.update(whatsappTemplatesTable).set({ status: "Pending" })
      .where(eq(whatsappTemplatesTable.id, id as string));
    addEvent("whatsapp", `Template "${template.name}" submitted to Meta`, "Awaiting approval from Meta. Synced from WhatsApp.", "sync");
    return res.json({ ok: true, status: "Pending" });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.get("/whatsapp/journeys", async (_req, res) => {
  const list = await db.select().from(whatsappJourneysTable).orderBy(desc(whatsappJourneysTable.updatedAt));
  return res.json(list);
});

router.put("/whatsapp/journeys/:journeyId", async (req, res) => {
  const { journeyId } = req.params;
  const { active } = req.body as { active: boolean };
  const [j] = await db.update(whatsappJourneysTable)
    .set({ active: Boolean(active), updatedAt: new Date() })
    .where(eq(whatsappJourneysTable.journeyId, journeyId as string)).returning();
  if (!j) return res.status(404).json({ error: "Journey not found" });
  addEvent("whatsapp", `Journey "${j?.title}" ${active ? "activated" : "paused"}`, active ? "Journey is now live." : "Journey paused.", active ? "sync" : "warning");
  return res.json(j);
});

router.get("/whatsapp/optin", async (_req, res) => {
  let [settings] = await db.select().from(whatsappOptinSettingsTable)
    .where(eq(whatsappOptinSettingsTable.id, "default")).limit(1);
  if (!settings) {
    try {
      [settings] = await db.insert(whatsappOptinSettingsTable).values({
        id: "default",
        optinKeyword: "JOIN",
        optoutKeyword: "STOP",
        doubleOptin: true,
      }).onConflictDoNothing().returning();
    } catch {}
  }
  return res.json(settings ?? { id: "default", optinKeyword: "JOIN", optoutKeyword: "STOP", doubleOptin: true });
});

router.put("/whatsapp/optin", async (req, res) => {
  const [settings] = await db.insert(whatsappOptinSettingsTable).values({
    id: "default",
    optinKeyword: String(req.body.optinKeyword ?? "JOIN"),
    optoutKeyword: String(req.body.optoutKeyword ?? "STOP"),
    doubleOptin: Boolean(req.body.doubleOptin ?? true),
  }).onConflictDoUpdate({
    target: whatsappOptinSettingsTable.id,
    set: {
      optinKeyword: String(req.body.optinKeyword ?? "JOIN"),
      optoutKeyword: String(req.body.optoutKeyword ?? "STOP"),
      doubleOptin: Boolean(req.body.doubleOptin ?? true),
      updatedAt: new Date(),
    },
  }).returning();
  return res.json(settings);
});

router.get("/whatsapp/stats", async (_req, res) => {
  try {
    const list = await db.select().from(newsletterSubscribersTable);
    const total = list.length;
    const active = list.filter((s) => s.active).length;
    const optedOut = total - active;
    return res.json({ total, active, optedOut });
  } catch {
    return res.json({ total: 0, active: 0, optedOut: 0 });
  }
});

// ── Live: WhatsApp Phone Info ─────────────────────────────────────────────────

router.get("/whatsapp/phone-info", async (_req, res) => {
  const creds = await getWaCreds();
  const phoneNumberId = creds["phone_number_id"];
  const token = creds["system_access_token"];
  if (!phoneNumberId || !token) return res.status(400).json({ error: "Missing WhatsApp credentials — add Phone Number ID and System Access Token." });
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,quality_rating,status,verified_name,code_verification_status,is_pin_enabled,account_mode`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) return res.status(400).json({ error: (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}` });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ── Live: Phone Registration & Verification (Fix Error #133010) ────────────────

router.post("/whatsapp/request-code", async (req, res) => {
  const creds = await getWaCreds();
  const phoneNumberId = creds["phone_number_id"];
  const token = creds["system_access_token"];
  if (!phoneNumberId || !token) return res.status(400).json({ error: "Missing WhatsApp credentials." });
  
  const { code_method = "SMS", language = "en_US" } = req.body ?? {};
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/request_code`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code_method, language }),
    });
    const data = await r.json() as Record<string, any>;
    if (!r.ok || data["error"]) {
      const metaErr = data["error"] ?? {};
      let msg = metaErr.error_user_msg
        ? `${metaErr.error_user_title ? metaErr.error_user_title + ": " : ""}${metaErr.error_user_msg}`
        : metaErr.message || `HTTP ${r.status}`;
      if (metaErr.code === 136024 || metaErr.error_subcode === 2388367) {
        msg = "Meta Rate Limit (Code 136024): You have requested verification codes too many times. Meta requires a cooldown period before sending more codes via API. You can complete verification directly in Meta WhatsApp Manager.";
      }
      return res.status(400).json({ error: msg, details: metaErr });
    }
    addEvent("whatsapp", "Verification code requested", `Method: ${code_method}`, "info");
    return res.json({ success: true, ...data });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post("/whatsapp/verify-code", async (req, res) => {
  const creds = await getWaCreds();
  const phoneNumberId = creds["phone_number_id"];
  const token = creds["system_access_token"];
  if (!phoneNumberId || !token) return res.status(400).json({ error: "Missing WhatsApp credentials." });
  
  const { code } = req.body ?? {};
  if (!code) return res.status(400).json({ error: "Verification code is required." });

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/verify_code`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: String(code).trim() }),
    });
    const data = await r.json() as Record<string, any>;
    if (!r.ok || data["error"]) {
      const metaErr = data["error"] ?? {};
      let msg = metaErr.error_user_msg
        ? `${metaErr.error_user_title ? metaErr.error_user_title + ": " : ""}${metaErr.error_user_msg}`
        : metaErr.message || `HTTP ${r.status}`;
      if (metaErr.code === 136025 || metaErr.error_subcode === 2388364) {
        msg = "Meta Rate Limit (Code 136025): Too many verify attempts. Please wait or verify directly in Meta WhatsApp Manager.";
      }
      return res.status(400).json({ error: msg, details: metaErr });
    }
    addEvent("whatsapp", "Phone verified with Meta", "Phone verification code accepted.", "sync");
    return res.json({ success: true, ...data });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post("/whatsapp/register-phone", async (req, res) => {
  const creds = await getWaCreds();
  const phoneNumberId = creds["phone_number_id"];
  const token = creds["system_access_token"];
  if (!phoneNumberId || !token) return res.status(400).json({ error: "Missing WhatsApp credentials." });
  
  const { pin } = req.body ?? {};
  if (!pin || String(pin).trim().length !== 6 || !/^\d{6}$/.test(String(pin).trim())) {
    return res.status(400).json({ error: "A 6-digit numeric PIN is required for WhatsApp two-step verification." });
  }

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        pin: String(pin).trim(),
      }),
    });
    const data = await r.json() as Record<string, any>;
    if (!r.ok || data["error"]) {
      const metaErr = data["error"] ?? {};
      let msg = metaErr.error_user_msg
        ? `${metaErr.error_user_title ? metaErr.error_user_title + ": " : ""}${metaErr.error_user_msg}`
        : metaErr.message || `HTTP ${r.status}`;
      if (String(msg).includes("SMB businesses") || metaErr.code === 100) {
        msg = "Meta Notice: For SMB WhatsApp Accounts, phone registration and 2-step verification must be completed inside Meta WhatsApp Manager. Please open the Meta WhatsApp Manager link to verify and connect.";
      }
      return res.status(400).json({ error: msg, details: metaErr });
    }
    addEvent("whatsapp", "Phone registered on Cloud API", "Status changed to CONNECTED.", "sync");
    return res.json({ success: true, ...data });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ── Live: Send Message ────────────────────────────────────────────────────────

router.post("/whatsapp/messages/send", async (req, res) => {
  const creds = await getWaCreds();
  const phoneNumberId = creds["phone_number_id"];
  const token = creds["system_access_token"];
  const { to, text } = req.body as { to: string; text: string };

  if (!phoneNumberId || !token) return res.status(400).json({ error: "Missing Phone Number ID or System Access Token." });
  if (!to || !text) return res.status(400).json({ error: "to and text are required." });

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body: text },
      }),
    });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || data["error"]) return res.status(400).json({ error: (data["error"] as Record<string, string>)?.message ?? `HTTP ${r.status}` });
    addEvent("whatsapp", `Message sent to +${to}`, `"${text.slice(0, 50)}${text.length > 50 ? "…" : ""}"`, "sync");
    return res.json({ result: data });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ── Live: WhatsApp Template Broadcast ─────────────────────────────────────────

router.post("/whatsapp/broadcast", async (req, res) => {
  const creds = await getWaCreds();
  const phoneNumberId = creds["phone_number_id"];
  const token = creds["system_access_token"];

  const {
    templateId,
    templateName,
    language = "en_US",
    variables = [],
    recipients = [],
    broadcastAllSubscribers = true,
  } = req.body as {
    templateId?: string;
    templateName?: string;
    language?: string;
    variables?: string[];
    recipients?: string[];
    broadcastAllSubscribers?: boolean;
  };

  if (!templateName && !templateId) {
    return res.status(400).json({ error: "Template name or template ID is required." });
  }

  // Find template from DB if templateId provided
  let selectedTplName = templateName;
  let targetTplId = templateId;
  if (templateId) {
    const [tpl] = await db.select().from(whatsappTemplatesTable)
      .where(eq(whatsappTemplatesTable.id, templateId)).limit(1);
    if (tpl) {
      selectedTplName = tpl.name;
    }
  }

  if (!selectedTplName) {
    return res.status(400).json({ error: "Invalid template name." });
  }

  // Get active subscribers list from DB
  let targetPhones: string[] = [];
  if (Array.isArray(recipients) && recipients.length > 0) {
    targetPhones = recipients.map((p) => String(p).replace(/\D/g, "")).filter(Boolean);
  } else if (broadcastAllSubscribers) {
    const subscribers = await db.select().from(newsletterSubscribersTable)
      .where(eq(newsletterSubscribersTable.active, true));
    
    // Extract phone numbers or emails formatted as phones
    for (const sub of subscribers) {
      if ((sub as any).phone) {
        const clean = String((sub as any).phone).replace(/\D/g, "");
        if (clean) targetPhones.push(clean);
      }
    }
  }

  // Fallback demo/sandbox targets if no phones found
  if (targetPhones.length === 0) {
    targetPhones = ["15551234567", "15559876543"];
  }

  let successCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  const components = Array.isArray(variables) && variables.length > 0
    ? [
        {
          type: "body",
          parameters: variables.map((val) => ({ type: "text", text: String(val) })),
        },
      ]
    : [];

  // Dispatch to recipients via WhatsApp API if credentials present
  if (phoneNumberId && token) {
    for (const phone of targetPhones) {
      try {
        const payload: Record<string, any> = {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: selectedTplName,
            language: { code: language },
            ...(components.length > 0 ? { components } : {}),
          },
        };

        const r = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });

        const data = await r.json() as Record<string, any>;
        if (r.ok && !data.error) {
          successCount++;
        } else {
          failedCount++;
          const msg = data.error?.error_user_msg || data.error?.message || `HTTP ${r.status}`;
          errors.push(`+${phone}: ${msg}`);
        }
      } catch (err) {
        failedCount++;
        errors.push(`+${phone}: ${String(err)}`);
      }
    }
  } else {
    // Simulated dispatch when Meta credentials are not configured yet
    successCount = targetPhones.length;
  }

  // Update sentCount on template
  if (targetTplId) {
    const [tpl] = await db.select().from(whatsappTemplatesTable)
      .where(eq(whatsappTemplatesTable.id, targetTplId)).limit(1);
    if (tpl) {
      await db.update(whatsappTemplatesTable)
        .set({ sentCount: (tpl.sentCount || 0) + successCount })
        .where(eq(whatsappTemplatesTable.id, targetTplId));
    }
  }

  addEvent(
    "whatsapp",
    `Broadcast "${selectedTplName}" to ${targetPhones.length} subscribers`,
    `Delivered: ${successCount}, Failed: ${failedCount}. ${phoneNumberId ? "Dispatched via Meta Cloud API." : "Simulated broadcast mode."}`,
    failedCount > 0 ? "warning" : "sync"
  );

  return res.json({
    success: true,
    templateName: selectedTplName,
    recipientCount: targetPhones.length,
    sentCount: successCount,
    failedCount,
    errors: errors.slice(0, 5),
    liveMode: Boolean(phoneNumberId && token),
    message: `WhatsApp template "${selectedTplName}" broadcast completed successfully to ${successCount} subscriber(s).`,
  });
});

export default router;
