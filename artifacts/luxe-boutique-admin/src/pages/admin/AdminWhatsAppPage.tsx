import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { SiMeta } from "react-icons/si";
import AdminLayout from "./AdminLayout";
import WhatsAppTemplatePreviewModal, { WhatsAppPhoneFrame } from "../../components/WhatsAppTemplatePreview";
import { PREBUILT_WHATSAPP_TEMPLATES, PrebuiltTemplateBlueprint } from "../../data/prebuiltTemplates";

type ActiveTab = "credentials" | "templates" | "journeys" | "optins";

interface Template { id: string; name: string; category: string; body: string; status: string; language: string; sentCount: number; }
interface Journey  { id: string; journeyId: string; icon: string; title: string; description: string; active: boolean; sentCount: string; steps: number; convRate: string; }
interface OptinSettings { id: string; optinKeyword: string; optoutKeyword: string; doubleOptin: boolean; }
interface PhoneInfo {
  id?: string;
  display_phone_number?: string;
  quality_rating?: string;
  status?: string;
  verified_name?: string;
  code_verification_status?: string;
  is_pin_enabled?: boolean;
  account_mode?: string;
  error?: string;
}

const statusStyle: Record<string, string> = {
  Approved: "bg-[#6cf8bb] text-[#00714d]",
  Pending:  "bg-amber-100 text-amber-700",
  Rejected: "bg-red-100 text-red-600",
};
const categoryStyle: Record<string, string> = {
  Marketing:      "bg-blue-50 text-blue-700",
  Utility:        "bg-slate-100 text-slate-600",
  Authentication: "bg-purple-50 text-purple-700",
};

type CopyState = Record<string, boolean>;

export default function AdminWhatsAppPage() {
  const [activeTab, setActiveTab]           = useState<ActiveTab>("credentials");
  const [templates, setTemplates]           = useState<Template[]>([]);
  const [journeys, setJourneys]             = useState<Journey[]>([]);
  const [optinSettings, setOptinSettings]   = useState<OptinSettings | null>(null);
  const [whatsappStats, setWhatsappStats]   = useState({ total: 0, active: 0, optedOut: 0 });
  const [loading, setLoading]               = useState(true);

  const [copyState, setCopyState]           = useState<CopyState>({});
  const [syncing, setSyncing]               = useState(false);
  const [syncDone, setSyncDone]             = useState(false);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [toast, setToast]                   = useState<string | null>(null);

  // Credentials
  const [waCreds,     setWaCreds]     = useState<Record<string, string>>({});
  const [credsDirty,  setCredsDirty]  = useState<Record<string, string>>({});
  const [credsSaving, setCredsSaving] = useState(false);
  const [showSecret,  setShowSecret]  = useState<Record<string, boolean>>({});
  const [testingConn, setTestingConn] = useState(false);
  const [testResult,  setTestResult]  = useState<{pass: boolean; latency: number} | null>(null);
  const [metaStatus,  setMetaStatus]  = useState<{ connected: boolean; business?: { id: string; name: string } } | null>(null);

  const WA_CRED_FIELDS = [
    { key: "phone_number_id",      label: "Cloud API Phone Number ID",      isSecret: false, hint: "WhatsApp Business Platform → Phone Numbers → Phone Number ID" },
    { key: "waba_id",              label: "WhatsApp Business Account ID",   isSecret: false, hint: "Meta Business Manager → WhatsApp Accounts → Account ID" },
    { key: "system_access_token",  label: "System Access Token",            isSecret: true,  hint: "Meta Business Manager → System Users → Generate Token (never expiring recommended)" },
    { key: "webhook_verify_token", label: "Webhook Verify Token",           isSecret: true,  hint: "A secret string you choose. Enter the same value when configuring your webhook in Meta." },
  ];

  const [testPhone, setTestPhone]           = useState("");
  const [testTemplate, setTestTemplate]     = useState("");
  const [sendingTest, setSendingTest]       = useState(false);

  // Live Phone Registration & Error 133010 Prevention
  const [phoneInfo, setPhoneInfo]                   = useState<PhoneInfo | null>(null);
  const [loadingPhoneInfo, setLoadingPhoneInfo]     = useState(false);
  const [reqCodeMethod, setReqCodeMethod]           = useState<"SMS" | "VOICE">("SMS");
  const [requestingCode, setRequestingCode]         = useState(false);
  const [requestCodeResult, setRequestCodeResult]   = useState<{ok: boolean; msg: string} | null>(null);
  const [verifyCodeVal, setVerifyCodeVal]           = useState("");
  const [verifyingCode, setVerifyingCode]           = useState(false);
  const [verifyCodeResult, setVerifyCodeResult]     = useState<{ok: boolean; msg: string} | null>(null);
  const [regPinVal, setRegPinVal]                   = useState("");
  const [registeringPhone, setRegisteringPhone]     = useState(false);
  const [registerResult, setRegisterResult]         = useState<{ok: boolean; msg: string} | null>(null);

  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [showPrebuiltGallery, setShowPrebuiltGallery] = useState(false);
  const [prebuiltFilter, setPrebuiltFilter]   = useState<"ALL" | "Customer" | "Admin">("ALL");
  const [selectedPrebuilt, setSelectedPrebuilt] = useState<PrebuiltTemplateBlueprint | null>(null);
  const [newTplName, setNewTplName]         = useState("");
  const [newTplBody, setNewTplBody]         = useState("");
  const [newTplCategory, setNewTplCategory] = useState("Marketing");
  const [previewModalTemplate, setPreviewModalTemplate] = useState<Template | null>(null);
  const [syncingTemplates, setSyncingTemplates] = useState(false);
  const [submittingTpl, setSubmittingTpl]       = useState(false);

  const [savingOptin, setSavingOptin]       = useState(false);
  const [localOptin, setLocalOptin]         = useState<OptinSettings | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const fetchPhoneInfo = useCallback(async () => {
    setLoadingPhoneInfo(true);
    try {
      const res = await fetch("/api/whatsapp/phone-info");
      if (res.ok) {
        const data = await res.json();
        setPhoneInfo(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setPhoneInfo({ error: err.error ?? "Failed to fetch phone info" });
      }
    } catch (e) {
      setPhoneInfo({ error: String(e) });
    } finally {
      setLoadingPhoneInfo(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    const [tRes, jRes, oRes, credRes, statsRes, metaRes] = await Promise.all([
      fetch("/api/whatsapp/templates"),
      fetch("/api/whatsapp/journeys"),
      fetch("/api/whatsapp/optin"),
      fetch("/api/channels/credentials/whatsapp"),
      fetch("/api/whatsapp/stats"),
      fetch("/api/channels/meta/status").catch(() => null),
    ]);
    if (tRes.ok) { const data = await tRes.json(); setTemplates(data); if (data.length) setTestTemplate(data.find((t: Template) => t.status === "Approved")?.id ?? data[0].id); }
    if (jRes.ok) setJourneys(await jRes.json());
    if (oRes.ok) { const s = await oRes.json(); setOptinSettings(s); setLocalOptin(s); }
    if (credRes.ok) { const d = await credRes.json(); setWaCreds(d); setCredsDirty(d); }
    if (statsRes.ok) setWhatsappStats(await statsRes.json());
    if (metaRes && metaRes.ok) {
      const m = await metaRes.json();
      setMetaStatus(m);
    }
    await fetchPhoneInfo();
    setLoading(false);
  }, [fetchPhoneInfo]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const copyToClipboard = (label: string, value: string) => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopyState((p) => ({ ...p, [label]: true }));
    setTimeout(() => setCopyState((p) => ({ ...p, [label]: false })), 2000);
    showToast(`${label} copied to clipboard.`);
  };

  const toggleJourney = async (j: Journey) => {
    setJourneys((p) => p.map((x) => x.journeyId === j.journeyId ? { ...x, active: !x.active } : x));
    await fetch(`/api/whatsapp/journeys/${j.journeyId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !j.active }) });
    showToast(`${j.title} journey ${j.active ? "paused" : "activated"}.`);
  };

  const forceResync = () => {
    if (syncing) return;
    const hasToken = !!(waCreds.system_access_token?.trim());
    setSyncing(true); setSyncDone(false);
    setTimeout(() => {
      setSyncing(false); setSyncDone(true);
      showToast(hasToken ? "Credentials present — connect WhatsApp Cloud API to run live catalog sync." : "No System Access Token saved. Add credentials first.");
      setTimeout(() => setSyncDone(false), 4000);
    }, 1500);
  };

  const syncTemplatesFromWhatsApp = async (quiet = false) => {
    setSyncingTemplates(true);
    try {
      const res = await fetch("/api/whatsapp/templates/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.templates) {
        setTemplates(data.templates);
        if (!quiet) showToast(`Synced ${data.count} templates directly from WhatsApp Cloud API.`);
      } else {
        if (!quiet) showToast(data.error || "Failed to sync templates from WhatsApp.");
      }
    } catch {
      if (!quiet) showToast("Network error syncing templates.");
    } finally {
      setSyncingTemplates(false);
    }
  };

  const handleApplyPrebuilt = (blueprint: PrebuiltTemplateBlueprint) => {
    setSelectedPrebuilt(blueprint);
    setNewTplName(blueprint.name);
    setNewTplCategory(blueprint.category);
    setNewTplBody(blueprint.body);
    setShowNewTemplate(true);
    showToast(`Loaded "${blueprint.title}". Customize and submit directly to WhatsApp.`);
  };

  const submitNewTemplate = async () => {
    if (!newTplName.trim() || !newTplBody.trim()) { showToast("Name and body are required."); return; }
    setSubmittingTpl(true);
    try {
      const res = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTplName, category: newTplCategory, body: newTplBody, language: "en_US" }),
      });
      const data = await res.json();
      if (res.ok) {
        // Fetch refreshed template list from WhatsApp Cloud API
        const tRes = await fetch("/api/whatsapp/templates");
        if (tRes.ok) {
          const freshList = await tRes.json();
          setTemplates(freshList);
        } else if (data.id) {
          setTemplates((p) => {
            const exists = p.some((x) => x.name === data.name || x.id === data.id);
            return exists ? p.map((x) => (x.name === data.name || x.id === data.id ? data : x)) : [data, ...p];
          });
        }
        setNewTplName("");
        setNewTplBody("");
        setShowNewTemplate(false);
        showToast(data.fromWhatsApp ? `Template "${data.name}" submitted & synced directly from WhatsApp!` : "Template created.");
      } else {
        showToast(data.error ?? "Failed to create template on WhatsApp.");
      }
    } catch {
      showToast("Network error creating template.");
    } finally {
      setSubmittingTpl(false);
    }
  };

  const deleteTemplate = async (t: Template) => {
    setTemplates((p) => p.filter((x) => x.id !== t.id));
    await fetch(`/api/whatsapp/templates/${t.id}`, { method: "DELETE" });
    showToast(`Template "${t.name}" deleted.`);
  };

  const [testMessageText, setTestMessageText] = useState("Hello from LUXE BOUTIQUE! 👋");
  const [sendResult, setSendResult] = useState<{ok: boolean; msg: string} | null>(null);

  const sendTestMessage = async () => {
    if (!testPhone.trim()) { showToast("Enter a phone number first."); return; }
    const requiredCreds = ["phone_number_id", "system_access_token"];
    const missing = requiredCreds.filter((k) => !waCreds[k] || !waCreds[k].trim());
    if (missing.length > 0) {
      showToast(`Missing credentials: ${missing.join(", ")}. Add them in API Credentials first.`);
      setActiveTab("credentials");
      return;
    }
    setSendingTest(true); setSendResult(null);
    try {
      const res = await fetch("/api/whatsapp/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to: testPhone.replace(/\D/g, ""), text: testMessageText }),
      });
      const d = await res.json();
      if (!res.ok) setSendResult({ ok: false, msg: d.error ?? "Send failed" });
      else setSendResult({ ok: true, msg: `Message sent! ID: ${(d.result as any)?.messages?.[0]?.id ?? "ok"}` });
    } catch {
      setSendResult({ ok: false, msg: "Network error" });
    }
    setSendingTest(false);
  };

  const submitTemplateMeta = async (t: Template) => {
    try {
      const r = await fetch(`/api/whatsapp/templates/${t.id}/submit`, {
        method: "POST", credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) showToast(d.error ?? "Submission failed");
      else {
        const tRes = await fetch("/api/whatsapp/templates");
        if (tRes.ok) {
          setTemplates(await tRes.json());
        } else {
          setTemplates((p) => p.map((x) => x.id === t.id ? { ...x, status: "Pending" } : x));
        }
        showToast(`"${t.name}" submitted to Meta & synced from WhatsApp.`);
      }
    } catch { showToast("Network error"); }
  };

  const saveOptinSettings = async () => {
    if (!localOptin) return;
    setSavingOptin(true);
    const res = await fetch("/api/whatsapp/optin", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(localOptin) });
    if (res.ok) { setOptinSettings(await res.json()); }
    setSavingOptin(false);
    showToast("Opt-in/out settings saved.");
  };

  const saveWaCreds = async () => {
    setCredsSaving(true);
    await fetch("/api/channels/credentials/whatsapp", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credsDirty) });
    setWaCreds(credsDirty);
    setCredsSaving(false);
    showToast("API credentials saved securely.");
  };
  const testWaConn = async () => {
    setTestingConn(true); setTestResult(null);
    const res = await fetch("/api/channels/configs/whatsapp/test", { method: "POST" });
    if (res.ok) {
      setTestResult(await res.json());
      fetchPhoneInfo();
    }
    setTestingConn(false);
  };

  const handleRequestCode = async () => {
    setRequestingCode(true);
    setRequestCodeResult(null);
    try {
      const res = await fetch("/api/whatsapp/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code_method: reqCodeMethod, language: "en_US" }),
      });
      const data = await res.json();
      if (res.ok) {
        setRequestCodeResult({
          ok: true,
          msg: `Verification code sent via ${reqCodeMethod} to ${phoneInfo?.display_phone_number || "your phone"}! Please check your messages.`,
        });
        showToast("Verification code requested from Meta.");
      } else {
        setRequestCodeResult({ ok: false, msg: data.error ?? "Failed to request code" });
      }
    } catch (err) {
      setRequestCodeResult({ ok: false, msg: String(err) });
    } finally {
      setRequestingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verifyCodeVal.trim()) { showToast("Enter the 6-digit verification code"); return; }
    setVerifyingCode(true);
    setVerifyCodeResult(null);
    try {
      const res = await fetch("/api/whatsapp/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCodeVal.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setVerifyCodeResult({
          ok: true,
          msg: "Code verified successfully with Meta! Now proceed to Step 3 to set your 6-digit PIN and complete registration.",
        });
        showToast("Phone code verified with Meta.");
        fetchPhoneInfo();
      } else {
        setVerifyCodeResult({ ok: false, msg: data.error ?? "Code verification failed" });
      }
    } catch (err) {
      setVerifyCodeResult({ ok: false, msg: String(err) });
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleRegisterPhone = async () => {
    if (!regPinVal.trim() || regPinVal.trim().length !== 6 || !/^\d{6}$/.test(regPinVal.trim())) {
      showToast("Enter a 6-digit numeric PIN");
      return;
    }
    setRegisteringPhone(true);
    setRegisterResult(null);
    try {
      const res = await fetch("/api/whatsapp/register-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: regPinVal.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setRegisterResult({
          ok: true,
          msg: "Phone registered successfully! Status is now CONNECTED on WhatsApp Cloud API. You can now send live messages!",
        });
        showToast("Phone number registered & connected!");
        fetchPhoneInfo();
      } else {
        setRegisterResult({ ok: false, msg: data.error ?? "Phone registration failed" });
      }
    } catch (err) {
      setRegisterResult({ ok: false, msg: String(err) });
    } finally {
      setRegisteringPhone(false);
    }
  };

  const configuredCredsCount = WA_CRED_FIELDS.filter((f) => !!waCreds[f.key]).length;

  const tabs: { key: ActiveTab; label: string; icon: string }[] = [
    { key: "credentials", label: "API Credentials", icon: "key"             },
    { key: "templates",   label: "Templates",       icon: "description"     },
    { key: "journeys",    label: "Journeys",        icon: "route"           },
    { key: "optins",      label: "Opt-in / Out",    icon: "manage_accounts" },
  ];

  if (loading) return (
    <AdminLayout sidebar="channels">
      <div className="flex items-center justify-center min-h-screen">
        <span className="material-symbols-outlined animate-spin text-[#006c49] text-3xl">refresh</span>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout sidebar="channels">
      <div className="p-4 sm:p-10 max-w-[1280px] mx-auto min-h-screen">
        {toast && (
          <div className="fixed top-6 right-6 z-50 bg-black text-white px-6 py-3 rounded-lg shadow-2xl font-[Manrope] text-sm font-bold flex items-center gap-3">
            <span className="material-symbols-outlined text-[#6cf8bb] text-base">check_circle</span>{toast}
          </div>
        )}

        <header className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <Link href="/channels" className="inline-flex items-center gap-1.5 text-[#7c839b] hover:text-[#006c49] transition-colors font-[Manrope] font-bold text-xs tracking-widest uppercase no-underline">
              <span className="material-symbols-outlined text-base">arrow_back</span> Channel Hub
            </Link>
            <a
              href="https://developers.facebook.com/docs/whatsapp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[#006c49] hover:text-[#005538] transition-colors font-[Manrope] font-bold text-xs tracking-widest uppercase no-underline"
            >
              <span className="material-symbols-outlined text-base">help</span> Documentation
            </a>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-[40px] font-serif font-bold text-[#0b1c30] mb-2">WhatsApp API Console</h1>
              <p className="font-[Manrope] text-[16px] text-[#7c839b] max-w-2xl">Configure your Cloud API credentials, manage message templates, automated journeys, and subscriber opt-in settings.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 self-start sm:self-auto">
              <Link href="/chat" className="no-underline">
                <button className="flex items-center gap-1.5 text-xs font-[Manrope] font-bold text-white bg-[#006c49] hover:bg-[#005a3c] px-4 py-2.5 rounded-lg transition-all shadow-sm">
                  <span className="material-symbols-outlined text-sm">chat</span>
                  <span>Open CRM Inbox</span>
                </button>
              </Link>
              {configuredCredsCount > 0 ? (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-50 border border-[#6cf8bb] rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-[#006c49] animate-pulse"></span>
                  <span className="text-[#006c49] font-[Manrope] font-bold text-[11px] tracking-widest uppercase">Configured</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <span className="text-amber-700 font-[Manrope] font-bold text-[11px] tracking-widest uppercase">Not Configured</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Templates", value: templates.length, sub: `${templates.filter((t) => t.status === "Approved").length} approved`, icon: "description" },
            { label: "Journeys", value: journeys.length, sub: `${journeys.filter((j) => j.active).length} active`, icon: "route" },
            { label: "Opt-in", value: localOptin?.doubleOptin ? "On" : "Off", sub: localOptin?.optinKeyword ?? "not set", icon: "manage_accounts" },
            { label: "Credentials", value: configuredCredsCount, sub: `${WA_CRED_FIELDS.length} total`, icon: "key" },
          ].map((s) => (
            <div key={s.label} className="bg-white p-4 rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
              <div className="flex justify-between items-start mb-2">
                <span className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#7c839b]">{s.label}</span>
                <span className="material-symbols-outlined text-[#006c49] text-base">{s.icon}</span>
              </div>
              <p className="text-[22px] font-serif font-semibold">{s.value}</p>
              <p className="text-xs text-[#7c839b] font-[Manrope] mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-6 py-4 font-[Manrope] font-bold text-xs tracking-widest uppercase transition-colors whitespace-nowrap ${activeTab === t.key ? "border-b-2 border-[#006c49] text-[#006c49]" : "text-[#7c839b] hover:text-black"}`}>
                <span className="material-symbols-outlined text-sm">{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          <div className="p-8">
            {/* API Credentials */}
            {activeTab === "credentials" && (
              <div className="space-y-8">
                <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12 lg:col-span-7 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-[20px] font-semibold mb-1">WhatsApp Cloud API Credentials</h3>
                      <p className="text-sm text-[#7c839b] font-[Manrope]">Enter your credentials from Meta for Developers, or connect in 1 click via Meta Business Suite.</p>
                    </div>
                    <span className={`text-[10px] font-[Manrope] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${configuredCredsCount === WA_CRED_FIELDS.length ? "bg-[#6cf8bb] text-[#00714d] border-[#6cf8bb]" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                      {configuredCredsCount}/{WA_CRED_FIELDS.length} Configured
                    </span>
                  </div>

                  {metaStatus?.connected || waCreds.source === "meta_business" ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <SiMeta className="text-2xl text-[#0668E1] shrink-0" />
                        <div>
                          <p className="text-xs font-serif font-bold text-emerald-900 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                            Auto-Configured via Meta Business Suite
                          </p>
                          <p className="text-[11px] font-[Manrope] text-emerald-700 mt-0.5">
                            This WhatsApp account was auto-discovered from your Meta Business Suite login. Manual token entry is not required.
                          </p>
                        </div>
                      </div>
                      <Link href="/channels/meta-business" className="px-3 py-1 bg-white border border-emerald-300 text-emerald-800 text-xs font-bold rounded-lg no-underline hover:bg-emerald-100 whitespace-nowrap">
                        Manage Suite
                      </Link>
                    </div>
                  ) : (
                    <div className="p-4 bg-[#eff4ff] border border-blue-200 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <SiMeta className="text-2xl text-[#0668E1] shrink-0" />
                        <div>
                          <p className="text-xs font-serif font-bold text-[#0b1c30]">Don't want to copy and paste API tokens manually?</p>
                          <p className="text-[11px] font-[Manrope] text-[#7c839b] mt-0.5">Use Meta Business Suite Login to auto-link your WhatsApp Business Account in 1 click.</p>
                        </div>
                      </div>
                      <Link
                        href="/channels/meta-business"
                        className="px-3.5 py-1.5 bg-[#0668E1] hover:bg-blue-700 text-white font-[Manrope] font-bold text-xs rounded-lg transition-colors whitespace-nowrap no-underline"
                      >
                        Connect Meta Business
                      </Link>
                    </div>
                  )}
                  <div className="space-y-4">
                    {WA_CRED_FIELDS.map((field) => {
                      const val = credsDirty[field.key] ?? "";
                      const saved = waCreds[field.key] ?? "";
                      const isDirty = val !== saved;
                      const visible = showSecret[field.key];
                      return (
                        <div key={field.key} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="font-[Manrope] font-bold text-[11px] tracking-widest uppercase text-[#45464d]">{field.label}</label>
                            <div className="flex items-center gap-2">
                              {isDirty && val !== "" && <span className="text-[9px] font-[Manrope] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Unsaved</span>}
                              {!isDirty && saved && <span className="text-[9px] font-[Manrope] font-bold uppercase tracking-widest text-[#006c49] bg-[#f0faf6] px-2 py-0.5 rounded-full flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">check_circle</span>Saved</span>}
                            </div>
                          </div>
                          <div className="relative flex items-center">
                            <input
                              type={field.isSecret && !visible ? "password" : "text"}
                              value={val}
                              onChange={(e) => setCredsDirty((p) => ({ ...p, [field.key]: e.target.value }))}
                              placeholder={field.isSecret ? "••••••••••••••••" : `Enter ${field.label}…`}
                              className={`w-full bg-slate-50 border rounded-lg px-4 py-2.5 font-mono text-sm outline-none transition-colors pr-20 ${isDirty && val !== "" ? "border-amber-300 focus:border-amber-500" : "border-slate-100 focus:border-[#006c49]"}`}
                            />
                            <div className="absolute right-2 flex items-center gap-1">
                              {field.isSecret && (
                                <button onClick={() => setShowSecret((p) => ({ ...p, [field.key]: !p[field.key] }))} className="p-1 text-slate-400 hover:text-black transition-colors">
                                  <span className="material-symbols-outlined text-sm">{visible ? "visibility_off" : "visibility"}</span>
                                </button>
                              )}
                              {val && (
                                <button onClick={() => { navigator.clipboard.writeText(val).catch(() => {}); showToast(`${field.label} copied.`); }} className="p-1 text-slate-400 hover:text-[#006c49] transition-colors">
                                  <span className="material-symbols-outlined text-sm">content_copy</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-[11px] text-[#7c839b] font-[Manrope] italic">{field.hint}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button onClick={saveWaCreds} disabled={credsSaving}
                      className="flex-1 py-3 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] disabled:opacity-60 transition-colors rounded-lg flex items-center justify-center gap-2">
                      <span className={`material-symbols-outlined text-sm ${credsSaving ? "animate-spin" : ""}`}>{credsSaving ? "refresh" : "save"}</span>
                      {credsSaving ? "Saving…" : "Save Credentials"}
                    </button>
                    <button onClick={testWaConn} disabled={testingConn}
                      className="px-6 py-3 border border-slate-200 font-[Manrope] font-bold text-xs tracking-widest uppercase hover:border-[#006c49] hover:text-[#006c49] disabled:opacity-60 transition-colors rounded-lg flex items-center gap-2">
                      <span className={`material-symbols-outlined text-sm ${testingConn ? "animate-spin" : ""}`}>{testingConn ? "refresh" : "wifi_tethering"}</span>
                      {testingConn ? "Testing…" : "Test Connection"}
                    </button>
                  </div>
                  {testResult && (
                    <div className={`p-4 rounded-xl border flex items-center gap-3 font-[Manrope] text-sm font-bold ${testResult.pass ? "bg-[#f0faf6] border-[#c3eed8] text-[#006c49]" : "bg-red-50 border-red-200 text-red-600"}`}>
                      <span className="material-symbols-outlined text-base">{testResult.pass ? "check_circle" : "error"}</span>
                      {testResult.pass ? `Connection successful — ${testResult.latency}ms latency` : "Connection failed — check your credentials and try again."}
                    </div>
                  )}

                  <div className="p-5 bg-[#f8f9ff] rounded-xl border border-slate-100">
                    <h4 className="font-serif font-semibold mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-[#006c49] text-base">send</span>Template Coverage</h4>
                    <p className="text-sm text-[#7c839b] font-[Manrope]">{templates.length} templates loaded</p>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-5 space-y-4">
                  {/* Live Send Message */}
                  <div className="p-5 bg-[#f8f9ff] rounded-xl border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-serif font-semibold flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#006c49] text-base">send</span>Send Live Message
                      </h4>
                      {phoneInfo?.status && (
                        <span className={`text-[9px] font-[Manrope] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          phoneInfo.status === "CONNECTED" ? "bg-[#6cf8bb] text-[#00714d] border-[#6cf8bb]" : "bg-amber-100 text-amber-800 border-amber-300"
                        }`}>
                          Sender: {phoneInfo.status}
                        </span>
                      )}
                    </div>

                    {phoneInfo?.status === "DISCONNECTED" && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs font-[Manrope] text-amber-800">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-0.5">
                          <span className="material-symbols-outlined text-sm text-amber-700">warning</span>
                          Sender is DISCONNECTED
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Meta blocks live dispatch with error <code>#133010</code> until sender ({phoneInfo?.display_phone_number || "+233 53 767 5948"}) completes 2-step verification above.
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d] block mb-1">Recipient Phone Number (with country code)</label>
                        <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="+233550354548"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-[Manrope] outline-none focus:border-[#006c49] font-mono" />
                      </div>
                      <div>
                        <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d] block mb-1">Message</label>
                        <textarea value={testMessageText} onChange={(e) => setTestMessageText(e.target.value)} rows={3}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-[Manrope] outline-none focus:border-[#006c49] resize-none" />
                      </div>
                      <button onClick={sendTestMessage} disabled={sendingTest}
                        className="w-full py-2.5 bg-[#006c49] text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-black disabled:opacity-60 transition-colors rounded-lg flex items-center justify-center gap-2">
                        <span className={`material-symbols-outlined text-sm ${sendingTest ? "animate-spin" : ""}`}>{sendingTest ? "refresh" : "send"}</span>
                        {sendingTest ? "Sending…" : "Send Message Now"}
                      </button>
                      {sendResult && (
                        sendResult.msg.includes("133010") || sendResult.msg.includes("not registered") ? (
                          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-1.5">
                            <p className="text-xs font-bold text-red-700 font-[Manrope] flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm">error</span>
                              Meta Error #133010: Account Not Registered
                            </p>
                            <p className="text-[11px] text-red-700 font-[Manrope] leading-relaxed">
                              Meta Cloud API rejected this message because the sender number ({phoneInfo?.display_phone_number || "+233 53 767 5948"}) is not yet verified or registered with a two-step PIN.
                            </p>
                            <p className="text-[11px] text-red-800 font-[Manrope] font-semibold mt-1">
                              👉 Use the 3-step <strong>Phone Activation</strong> card above to request the OTP code and register your 6-digit PIN.
                            </p>
                          </div>
                        ) : (
                          <div className={`p-3 rounded-xl text-xs font-[Manrope] font-semibold border ${sendResult.ok ? "bg-[#f0faf6] text-[#006c49] border-[#c3eed8]" : "bg-red-50 text-red-600 border-red-200"}`}>
                            {sendResult.msg}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                  <div className="p-5 bg-[#f8f9ff] rounded-xl border border-slate-100 space-y-3">
                    <h4 className="font-serif font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#006c49] text-base">webhook</span>
                      WhatsApp Cloud Webhook URL
                    </h4>
                    <p className="text-xs text-[#7c839b] font-[Manrope]">
                      Register this Webhook URL in your Meta App Dashboard &gt; WhatsApp &gt; Configuration to receive real-time incoming customer chats.
                    </p>
                    <div className="flex items-center justify-between gap-2 p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800">
                      <span className="truncate select-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/whatsapp</span>
                      <button
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/whatsapp`);
                            setToast("WhatsApp Webhook URL copied!");
                            setTimeout(() => setToast(null), 3000);
                          }
                        }}
                        className="px-2.5 py-1 bg-[#006c49] text-white rounded font-[Manrope] text-[10px] font-bold uppercase tracking-wider shrink-0 hover:bg-[#005a3c]"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="bg-black text-white p-5 rounded-xl">
                    <h4 className="font-serif font-semibold mb-2">Template Status</h4>
                    <p className="text-white/60 text-sm font-[Manrope]">{templates.filter((t) => t.status === "Approved").length} approved · {templates.length} total</p>
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-xs font-[Manrope] text-amber-800 flex items-start gap-2">
                      <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">lock</span>
                      Credentials are stored in the database and never exposed in client-side code.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Templates */}
            {activeTab === "templates" && (
              <div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-serif text-[20px] font-semibold">Message Templates</h3>
                      <span className="text-[10px] font-[Manrope] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-[#006c49] border border-emerald-200/80 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#006c49] animate-pulse"></span>
                        Live WhatsApp Sync
                      </span>
                    </div>
                    <p className="text-sm text-[#7c839b] font-[Manrope]">{templates.length} templates · {templates.filter(t => t.status === "Approved").length} approved · Synced with WhatsApp Cloud API</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowPrebuiltGallery((v) => !v)}
                      className={`px-4 py-2 border font-[Manrope] font-bold text-xs tracking-wider uppercase transition-all rounded-lg flex items-center gap-2 shadow-2xs ${
                        showPrebuiltGallery
                          ? "bg-[#006c49] text-white border-[#006c49]"
                          : "bg-white hover:bg-emerald-50 text-[#006c49] border-emerald-300"
                      }`}
                      title="Browse ready-to-publish customer and admin WhatsApp templates"
                    >
                      <span className="material-symbols-outlined text-sm">
                        auto_awesome
                      </span>
                      {showPrebuiltGallery ? "Hide Pre-built Library" : "Browse Pre-built Library"}
                    </button>
                    <button
                      onClick={() => syncTemplatesFromWhatsApp(false)}
                      disabled={syncingTemplates}
                      className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-[Manrope] font-bold text-xs tracking-wider uppercase transition-colors rounded-lg flex items-center gap-2 disabled:opacity-60 shadow-2xs"
                      title="Fetch live templates and approval status directly from WhatsApp Cloud API"
                    >
                      <span className={`material-symbols-outlined text-sm ${syncingTemplates ? "animate-spin text-[#006c49]" : "text-slate-500"}`}>
                        sync
                      </span>
                      {syncingTemplates ? "Syncing…" : "Sync from WhatsApp"}
                    </button>
                    <button onClick={() => { setShowNewTemplate((v) => !v); if (!showNewTemplate) setSelectedPrebuilt(null); }}
                      className="px-5 py-2 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors rounded-lg flex items-center gap-2 shadow-2xs">
                      <span className="material-symbols-outlined text-sm">{showNewTemplate ? "close" : "add"}</span> {showNewTemplate ? "Close Creator" : "New Custom Template"}
                    </button>
                  </div>
                </div>

                {/* Pre-built Templates Library Drawer */}
                {showPrebuiltGallery && (
                  <div className="mb-8 p-6 bg-gradient-to-br from-white to-emerald-50/40 rounded-2xl border border-emerald-200 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-100">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined text-[#006c49] text-xl">library_books</span>
                          <h4 className="font-serif font-bold text-lg text-slate-900">Pre-Built Luxury & Operational Templates</h4>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-[#006c49]">
                            {PREBUILT_WHATSAPP_TEMPLATES.length} Ready-to-Publish
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-[Manrope]">
                          Select any pre-built template to inspect, customize wording or variables, and publish directly to Meta WhatsApp Cloud API with standard approval compliance.
                        </p>
                      </div>

                      {/* Filter Tabs */}
                      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shrink-0">
                        {(["ALL", "Customer", "Admin"] as const).map((filter) => (
                          <button
                            key={filter}
                            onClick={() => setPrebuiltFilter(filter)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-[Manrope] font-bold tracking-wider transition-colors ${
                              prebuiltFilter === filter
                                ? "bg-[#006c49] text-white shadow-2xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            {filter === "ALL" ? "All Blueprints" : `${filter} Desk`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Pre-built Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {PREBUILT_WHATSAPP_TEMPLATES.filter(
                        (bp) => prebuiltFilter === "ALL" || bp.audience === prebuiltFilter
                      ).map((bp) => (
                        <div
                          key={bp.id}
                          className="bg-white border border-slate-200/80 hover:border-[#006c49] rounded-xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className={`text-[9px] font-[Manrope] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                  bp.audience === "Customer" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                                }`}>
                                  {bp.audience}
                                </span>
                                <h5 className="font-serif font-bold text-slate-900 text-sm mt-1 group-hover:text-[#006c49] transition-colors">
                                  {bp.title}
                                </h5>
                              </div>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                categoryStyle[bp.category] ?? "bg-slate-100 text-slate-600"
                              }`}>
                                {bp.category}
                              </span>
                            </div>

                            <p className="text-xs text-slate-500 font-[Manrope] line-clamp-2">
                              {bp.description}
                            </p>

                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs font-mono text-slate-700 line-clamp-3 whitespace-pre-wrap leading-relaxed">
                              {bp.body}
                            </div>
                          </div>

                          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button
                              onClick={() => setPreviewModalTemplate({
                                id: bp.id,
                                name: bp.name,
                                category: bp.category,
                                body: bp.body,
                                status: "Draft Blueprint",
                                language: "en_US",
                                sentCount: 0,
                              })}
                              className="text-xs font-[Manrope] font-bold text-slate-600 hover:text-black flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">visibility</span>
                              Preview
                            </button>

                            <button
                              onClick={() => {
                                handleApplyPrebuilt(bp);
                                setShowPrebuiltGallery(false);
                              }}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-[#006c49] text-[#006c49] hover:text-white border border-emerald-300 hover:border-[#006c49] font-[Manrope] font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-xs">edit_square</span>
                              Customize & Submit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showNewTemplate && (
                  <div className="mb-8 p-6 bg-[#f8f9ff] rounded-2xl border border-emerald-200/60 shadow-sm space-y-6">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-serif font-bold text-lg text-slate-900">
                            {selectedPrebuilt ? `Customize: ${selectedPrebuilt.title}` : "Create New Template"}
                          </h4>
                          {selectedPrebuilt && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                              Pre-Built Blueprint ({selectedPrebuilt.audience})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-[Manrope]">
                          {selectedPrebuilt
                            ? selectedPrebuilt.description
                            : "Create your WhatsApp Business template. When submitted, it registers directly with WhatsApp Cloud API and immediately fetches the live approved/pending template."}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowPrebuiltGallery(true)}
                          className="text-xs font-[Manrope] font-bold text-[#006c49] hover:text-black flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-xs">auto_awesome</span>
                          Change Blueprint
                        </button>
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-100 text-[#006c49] flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">sync</span> Live WhatsApp API Creation
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      {/* Left: Input Form */}
                      <div className="lg:col-span-7 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d]">Template Name</label>
                            <input
                              value={newTplName}
                              onChange={(e) => setNewTplName(e.target.value)}
                              placeholder="e.g. order_confirmation_v2"
                              className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-[Manrope] outline-none focus:border-[#006c49]"
                            />
                            <p className="text-[10px] text-slate-400 font-mono">
                              WhatsApp ID: <span className="text-[#006c49] font-bold">{newTplName ? newTplName.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "order_template" : "order_confirmation_v2"}</span>
                            </p>
                          </div>
                          <div className="space-y-1">
                            <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d]">Category</label>
                            <select value={newTplCategory} onChange={(e) => setNewTplCategory(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-[Manrope] outline-none focus:border-[#006c49]">
                              {["Marketing", "Utility", "Authentication"].map((c) => <option key={c}>{c}</option>)}
                            </select>
                            <p className="text-[10px] text-slate-400 font-[Manrope]">
                              Meta Language: <span className="font-semibold text-slate-600">English (en_US)</span>
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d]">Message Body</label>
                            <span className="text-[10px] text-slate-400 font-[Manrope]">Use *bold*, _italic_, ```code```, or {"{{1}}"}</span>
                          </div>
                          <textarea value={newTplBody} onChange={(e) => setNewTplBody(e.target.value)} rows={6}
                            placeholder="*[LUXE BOUTIQUE | ORDER CONFIRMED]*&#10;Dear *{{1}}*,&#10;Thank you for your order *#{{2}}* totaling *${{3}}*…"
                            className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm font-[Manrope] outline-none focus:border-[#006c49] resize-none" />
                        </div>

                        <div className="p-3 bg-white rounded-lg border border-slate-200/80 text-xs text-slate-600 space-y-1">
                          <p className="font-bold text-slate-800 flex items-center gap-1"><span className="material-symbols-outlined text-xs text-[#006c49]">verified</span> WhatsApp Cloud API Direct Sync:</p>
                          <p className="text-[11px] font-[Manrope]">• Submitting automatically creates the template in your connected Meta WhatsApp Business Account (WABA).</p>
                          <p className="text-[11px] font-[Manrope]">• The app immediately pulls and synchronizes the live template and approval status directly from WhatsApp.</p>
                          <p className="text-[11px] font-[Manrope]">• Format shortcuts: <code className="bg-slate-100 text-slate-800 px-1 rounded">*bold*</code>, <code className="bg-slate-100 text-slate-800 px-1 rounded">_italic_</code>, <code className="bg-slate-100 text-slate-800 px-1 rounded">{"{{1}}"}</code> for dynamic customer parameters.</p>
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button
                            onClick={submitNewTemplate}
                            disabled={submittingTpl}
                            className="px-6 py-3 bg-[#006c49] text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-black transition-colors rounded-xl flex items-center gap-2 shadow-sm disabled:opacity-60 cursor-pointer"
                          >
                            <span className={`material-symbols-outlined text-sm ${submittingTpl ? "animate-spin" : ""}`}>
                              {submittingTpl ? "sync" : "send"}
                            </span>
                            {submittingTpl ? "Creating & Fetching from WhatsApp…" : "Create & Submit to WhatsApp"}
                          </button>
                          <button onClick={() => setPreviewModalTemplate({ id: "new-draft", name: newTplName || "new_template_draft", category: newTplCategory, body: newTplBody, status: "Draft", language: "en", sentCount: 0 })} className="px-5 py-3 border border-slate-200 font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-slate-50 transition-colors rounded-xl flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">fullscreen</span> Fullscreen Preview
                          </button>
                          <button onClick={() => setShowNewTemplate(false)} className="px-5 py-3 border border-slate-200 text-slate-500 font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-slate-100 transition-colors rounded-xl">Cancel</button>
                        </div>
                      </div>

                      {/* Right: Live Interactive Smartphone Preview */}
                      <div className="lg:col-span-5 flex flex-col items-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">smartphone</span> Live WhatsApp Screen
                        </span>
                        <WhatsAppPhoneFrame
                          template={{
                            name: newTplName || "new_template_draft",
                            category: newTplCategory,
                            body: newTplBody || "*[LUXE BOUTIQUE | DRAFT PREVIEW]*\n_Haute Couture & Private Client Services_\n\nDear *{{1}}*,\n\nYour order *#{{2}}* is confirmed.\n\n_Luxe Boutique Concierge Services_",
                          }}
                          customParams={selectedPrebuilt?.defaultVariables ?? {}}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {templates.map((t) => (
                    <div key={t.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-xs hover:border-slate-200 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <code className="font-mono text-sm font-bold text-[#0b1c30] bg-slate-50 px-2 py-1 rounded border border-slate-100">{t.name}</code>
                          <span className={`text-[10px] font-[Manrope] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${categoryStyle[t.category] ?? "bg-slate-100 text-slate-600"}`}>{t.category}</span>
                          <span className={`text-[10px] font-[Manrope] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${statusStyle[t.status] ?? "bg-slate-100 text-slate-500"}`}>{t.status}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setPreviewModalTemplate(t)}
                            className="flex items-center gap-1.5 text-[11px] font-[Manrope] font-bold uppercase tracking-wider px-3 py-1.5 bg-slate-50 hover:bg-[#006c49] text-slate-700 hover:text-white border border-slate-200 hover:border-[#006c49] rounded-lg transition-all"
                          >
                            <span className="material-symbols-outlined text-xs">visibility</span> Preview
                          </button>
                          <span className="text-xs font-[Manrope] text-[#7c839b] px-2">{t.sentCount.toLocaleString()} sent</span>
                          {t.status === "Pending" && (
                            <button onClick={() => submitTemplateMeta(t)} className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest px-3 py-1.5 bg-[#006c49] text-white rounded-lg hover:bg-black transition-colors flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">send</span> Submit to Meta
                            </button>
                          )}
                          {t.status !== "Approved" && (
                            <button onClick={() => deleteTemplate(t)} className="text-[#7c839b] hover:text-red-500 transition-colors ml-1 p-1">
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-sm font-[Manrope] text-[#45464d] bg-[#f8f9ff] rounded-xl px-4 py-3 border-l-3 border-[#006c49] whitespace-pre-wrap font-sans leading-relaxed">
                        {t.body}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Journeys */}
            {activeTab === "journeys" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-serif text-[20px] font-semibold mb-1">Automated Customer Journeys</h3>
                    <p className="text-sm text-[#7c839b] font-[Manrope]">{journeys.filter((j) => j.active).length}/{journeys.length} journeys active — persisted to database</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {journeys.map((j) => (
                    <div key={j.journeyId} className={`p-6 rounded-xl border transition-all ${j.active ? "bg-[#f8f9ff] border-slate-100" : "bg-white border-slate-200 opacity-70"}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className={`p-2 rounded-lg shadow-sm ${j.active ? "bg-white" : "bg-slate-100"}`}>
                          <span className={`material-symbols-outlined ${j.active ? "text-[#006c49]" : "text-[#7c839b]"}`}>{j.icon}</span>
                        </div>
                        <button onClick={() => toggleJourney(j)}
                          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${j.active ? "bg-[#006c49]" : "bg-slate-300"}`}>
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${j.active ? "translate-x-5" : "translate-x-0.5"}`}></span>
                        </button>
                      </div>
                      <h4 className="font-serif font-semibold mb-1">{j.title}</h4>
                      <p className="text-sm text-[#7c839b] font-[Manrope] mb-4">{j.description}</p>
                      <div className="flex items-center gap-4 text-[11px] font-[Manrope] font-bold text-[#45464d]">
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">route</span> {j.steps} steps</span>
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">send</span> {j.sentCount} sent/mo</span>
                        {j.convRate !== "—" && <span className="text-[#006c49] flex items-center gap-1"><span className="material-symbols-outlined text-xs">shopping_bag</span> {j.convRate} conv.</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opt-in / Out */}
            {activeTab === "optins" && localOptin && (
              <div className="max-w-2xl space-y-8">
                <div>
                  <h3 className="font-serif text-[20px] font-semibold mb-1">Opt-in / Opt-out Settings</h3>
                  <p className="text-sm text-[#7c839b] font-[Manrope]">Keyword-based subscriber management — changes saved directly to database.</p>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  {[{ label: "Opt-in Keyword", key: "optinKeyword" as const, hint: "Customers text this to subscribe." },
                    { label: "Opt-out Keyword", key: "optoutKeyword" as const, hint: "Customers text this to unsubscribe." }].map((f) => (
                    <div key={f.key} className="space-y-2">
                      <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d]">{f.label}</label>
                      <input value={localOptin[f.key]} onChange={(e) => setLocalOptin((p) => p ? { ...p, [f.key]: e.target.value.toUpperCase() } : p)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-lg px-4 py-3 font-mono text-sm outline-none focus:border-[#006c49]" />
                      <p className="text-xs text-[#7c839b] font-[Manrope]">{f.hint}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between p-4 bg-[#f8f9ff] rounded-xl">
                  <div>
                    <p className="font-[Manrope] font-bold text-sm">Double Opt-in</p>
                    <p className="text-xs text-[#7c839b] font-[Manrope] mt-0.5">Send a confirmation before adding subscribers.</p>
                  </div>
                  <button onClick={() => setLocalOptin((p) => p ? { ...p, doubleOptin: !p.doubleOptin } : p)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${localOptin.doubleOptin ? "bg-[#006c49]" : "bg-slate-300"}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${localOptin.doubleOptin ? "translate-x-5" : "translate-x-0.5"}`}></span>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4 p-5 bg-white border border-slate-100 rounded-xl">
                  {[
                    { label: "Total Subscribers", value: whatsappStats.total.toLocaleString() },
                    { label: "Active", value: whatsappStats.active.toLocaleString() },
                    { label: "Opted Out (30d)", value: whatsappStats.optedOut.toLocaleString() }
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#7c839b] mb-1">{s.label}</p>
                      <p className="text-[22px] font-serif font-semibold">{s.value}</p>
                    </div>
                  ))}
                </div>
                <button onClick={saveOptinSettings} disabled={savingOptin}
                  className="w-full py-3 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] disabled:opacity-60 transition-colors rounded-lg flex items-center justify-center gap-2">
                  <span className={`material-symbols-outlined text-sm ${savingOptin ? "animate-spin" : ""}`}>{savingOptin ? "refresh" : "save"}</span>
                  {savingOptin ? "Saving…" : "Save Settings"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp Template Preview Modal */}
      {previewModalTemplate && (
        <WhatsAppTemplatePreviewModal
          template={previewModalTemplate}
          onClose={() => setPreviewModalTemplate(null)}
          onSubmitToMeta={(t) => {
            const match = templates.find((x) => x.id === t.id || x.name === t.name);
            if (match) submitTemplateMeta(match);
          }}
        />
      )}
    </AdminLayout>
  );
}
