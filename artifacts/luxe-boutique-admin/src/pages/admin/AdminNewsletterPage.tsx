import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "./AdminLayout";
import {
  initAuth,
  googleSignIn,
  googleLogout,
  sendGmailMessage,
} from "../../lib/googleWorkspace";
import type { User as FirebaseUser } from "firebase/auth";

type Subscriber  = { id: string; email: string; createdAt: string };
type GrowthPoint = { month: string; count: number };
type Campaign    = { id: string; subject: string; body: string; recipientCount: number; sentCount: number; status: string; sentAt: string | null; scheduledFor: string | null; createdAt: string; updatedAt: string };
type WhatsAppTemplate = { id: string; name: string; category: string; body: string; status: string; language: string; sentCount: number; createdAt: string };

type NewsletterData = {
  subscribers: Subscriber[];
  total: number;
  thisMonth: number;
  thisWeek: number;
  growth: GrowthPoint[];
};

type Tab = "compose" | "whatsapp" | "subscribers" | "campaigns";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: string }> = {
  DRAFT:     { label: "Draft",     cls: "text-[#45464d] bg-[#e5eeff]",   icon: "draft"        },
  SCHEDULED: { label: "Scheduled", cls: "text-purple-600 bg-purple-50",  icon: "schedule_send"},
  SENDING:   { label: "Sending",   cls: "text-blue-600 bg-blue-50",      icon: "autorenew"    },
  SENT:      { label: "Sent",      cls: "text-[#006c49] bg-[#e6f7f1]",   icon: "check_circle" },
  PARTIAL:   { label: "Partial",   cls: "text-amber-600 bg-amber-50",    icon: "warning"      },
  FAILED:    { label: "Failed",    cls: "text-[#ba1a1a] bg-[#ffdad6]",   icon: "error"        },
};

export default function AdminNewsletterPage() {
  const queryClient = useQueryClient();
  const [tab, setTab]           = useState<Tab>("compose");
  const [search, setSearch]     = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody]       = useState("");
  const [preview, setPreview] = useState(false);
  const [sent, setSent]       = useState<{ count: number; draft?: boolean } | null>(null);

  const [deleteCampaignId, setDeleteCampaignId]   = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign]     = useState<Campaign | null>(null);
  const [editSubject, setEditSubject]             = useState("");
  const [editBody, setEditBody]                   = useState("");

  // WhatsApp Broadcast state
  const [selectedWaTemplateId, setSelectedWaTemplateId] = useState<string>("");
  const [waVariables, setWaVariables]                   = useState<string[]>([]);
  const [waRecipientsScope, setWaRecipientsScope]       = useState<"all_subscribers" | "custom">("all_subscribers");
  const [waCustomPhone, setWaCustomPhone]               = useState<string>("");
  const [waBroadcasting, setWaBroadcasting]             = useState(false);
  const [waSyncingTemplates, setWaSyncingTemplates]     = useState(false);
  const [waBroadcastResult, setWaBroadcastResult]       = useState<{
    success: boolean;
    message: string;
    sentCount?: number;
    failedCount?: number;
    liveMode?: boolean;
    errors?: string[];
  } | null>(null);

  // New Template modal / inline form
  const [showNewWaModal, setShowNewWaModal] = useState(false);
  const [newWaName, setNewWaName]           = useState("");
  const [newWaCategory, setNewWaCategory]   = useState("Marketing");
  const [newWaBody, setNewWaBody]           = useState("");
  const [newWaSubmitting, setNewWaSubmitting] = useState(false);
  const [newWaError, setNewWaError]         = useState<string | null>(null);

  // Google Workspace / Gmail Integration
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [gmailSending, setGmailSending] = useState(false);
  const [gmailProgress, setGmailProgress] = useState<{ current: number; total: number; success: number; failed: number } | null>(null);
  const [testGmailResult, setTestGmailResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sendingTestGmail, setSendingTestGmail] = useState(false);

  useEffect(() => {
    const unsub = initAuth(
      (u, t) => {
        setGoogleUser(u);
        setGoogleToken(t);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsub();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleSigningIn(true);
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
      }
    } catch (e: unknown) {
      console.error("Google sign in error:", e);
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await googleLogout();
    setGoogleUser(null);
    setGoogleToken(null);
  };

  const renderNewsletterHtml = (subj: string, text: string) => {
    const formattedBody = text
      .split("\n\n")
      .map((p) => `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.7; color: #2d3748;">${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 24px 0; background-color: #f8f9ff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5eeff; box-shadow: 0 4px 20px rgba(15,23,42,0.05);">
            <!-- Brand Header -->
            <tr>
              <td style="background-color: #080e0b; padding: 28px 32px; text-align: center;">
                <span style="color: #ffffff; font-size: 15px; font-weight: 700; letter-spacing: 0.28em; text-transform: uppercase;">✦ Luxe Boutique</span>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td style="padding: 40px 32px 32px 32px;">
                <h1 style="font-size: 24px; font-weight: 700; color: #0b1c30; margin: 0 0 24px 0; font-family: Georgia, serif; line-height: 1.3;">${subj}</h1>
                <div style="font-size: 15px; line-height: 1.7; color: #2d3748;">
                  ${formattedBody}
                </div>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background-color: #f8f9ff; padding: 24px 32px; text-align: center; border-top: 1px solid #f1f3f9;">
                <p style="font-size: 12px; font-weight: 600; color: #006c49; margin: 0 0 6px 0; letter-spacing: 0.1em; text-transform: uppercase;">Luxe Boutique Concierge</p>
                <p style="font-size: 11px; color: #7c839b; margin: 0 0 10px 0;">Haute Couture &amp; Fine Accessories</p>
                <p style="font-size: 10px; color: #b0b8cc; margin: 0;">You received this publication because you subscribed to Luxe Boutique updates.</p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  };

  const handleSendViaGmail = async () => {
    if (!googleToken || !googleUser) {
      await handleGoogleSignIn();
      return;
    }
    if (!subject.trim() || !body.trim()) return;

    const recipientList = subscribers.map((s) => s.email);
    if (recipientList.length === 0) return;

    setGmailSending(true);
    setGmailProgress({ current: 0, total: recipientList.length, success: 0, failed: 0 });

    const html = renderNewsletterHtml(subject, body);
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipientList.length; i++) {
      const email = recipientList[i];
      try {
        await sendGmailMessage(googleToken, {
          to: email,
          subject: subject,
          bodyHtml: html,
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to send to ${email}:`, err);
        failedCount++;
      }
      setGmailProgress({
        current: i + 1,
        total: recipientList.length,
        success: successCount,
        failed: failedCount,
      });
      // Small debounce to avoid Google rate limit spikes
      if (i < recipientList.length - 1) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    // Record campaign in DB as SENT
    try {
      await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          saveAsDraft: false,
          sentCount: successCount,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    } catch {
      // ignore
    }

    setSent({ count: successCount, draft: false });
    setSubject("");
    setBody("");
    setPreview(false);
    setGmailSending(false);
    setGmailProgress(null);
  };

  const handleSendTestGmail = async () => {
    if (!googleToken || !googleUser?.email) {
      await handleGoogleSignIn();
      return;
    }
    if (!subject.trim() || !body.trim()) return;

    setSendingTestGmail(true);
    setTestGmailResult(null);
    try {
      const html = renderNewsletterHtml(`[TEST PREVIEW] ${subject}`, body);
      await sendGmailMessage(googleToken, {
        to: googleUser.email,
        subject: `[TEST PREVIEW] ${subject}`,
        bodyHtml: html,
      });
      setTestGmailResult({ ok: true, msg: `Test copy dispatched to ${googleUser.email}` });
    } catch (e: unknown) {
      setTestGmailResult({ ok: false, msg: (e as Error).message || "Failed to send test email" });
    } finally {
      setSendingTestGmail(false);
    }
  };

  const { data, isLoading } = useQuery<NewsletterData>({
    queryKey: ["admin-newsletter"],
    queryFn: async () => {
      const res = await fetch("/api/newsletter");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["admin-campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/newsletter/campaigns");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: waTemplates = [], refetch: refetchWaTemplates, isLoading: loadingWaTemplates } = useQuery<WhatsAppTemplate[]>({
    queryKey: ["admin-whatsapp-templates"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/templates");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Selected WhatsApp template object
  const selectedWaTemplate = useMemo(() => {
    if (!selectedWaTemplateId && waTemplates.length > 0) {
      return waTemplates[0];
    }
    return waTemplates.find((t) => t.id === selectedWaTemplateId) || waTemplates[0] || null;
  }, [selectedWaTemplateId, waTemplates]);

  // Extract placeholders {{1}}, {{2}} from selected template
  const waPlaceholders = useMemo(() => {
    if (!selectedWaTemplate?.body) return [];
    const matches = selectedWaTemplate.body.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    return Array.from(new Set(matches)).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10);
      const numB = parseInt(b.replace(/\D/g, ""), 10);
      return numA - numB;
    });
  }, [selectedWaTemplate]);

  // Auto-sync or select template when waTemplates load
  useEffect(() => {
    if (waTemplates.length > 0 && !selectedWaTemplateId) {
      setSelectedWaTemplateId(waTemplates[0].id);
    }
  }, [waTemplates, selectedWaTemplateId]);

  // Sync WhatsApp Templates directly with Meta Cloud API
  const handleSyncWaTemplates = async () => {
    setWaSyncingTemplates(true);
    try {
      const res = await fetch("/api/whatsapp/templates/sync", { method: "POST" });
      if (res.ok) {
        await refetchWaTemplates();
      }
    } catch (e) {
      console.error("Failed to sync WhatsApp templates:", e);
    } finally {
      setWaSyncingTemplates(false);
    }
  };

  // Broadcast WhatsApp Template Handler
  const handleBroadcastWhatsApp = async () => {
    if (!selectedWaTemplate) return;
    setWaBroadcasting(true);
    setWaBroadcastResult(null);

    try {
      const recipients = waRecipientsScope === "custom" && waCustomPhone.trim()
        ? waCustomPhone.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const res = await fetch("/api/whatsapp/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedWaTemplate.id,
          templateName: selectedWaTemplate.name,
          language: selectedWaTemplate.language || "en_US",
          variables: waVariables,
          recipients,
          broadcastAllSubscribers: waRecipientsScope === "all_subscribers",
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setWaBroadcastResult({
          success: false,
          message: data.error || "Broadcast failed. Please check WhatsApp API credentials.",
        });
      } else {
        setWaBroadcastResult({
          success: true,
          message: data.message || `WhatsApp Broadcast dispatched to ${data.sentCount} subscriber(s).`,
          sentCount: data.sentCount,
          failedCount: data.failedCount,
          liveMode: data.liveMode,
          errors: data.errors,
        });
        refetchWaTemplates();
        queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-templates"] });
      }
    } catch (err) {
      setWaBroadcastResult({
        success: false,
        message: String(err) || "Failed connecting to WhatsApp broadcast server.",
      });
    } finally {
      setWaBroadcasting(false);
    }
  };

  // Create & Publish New WhatsApp Template
  const handleCreateWaTemplate = async () => {
    if (!newWaName.trim() || !newWaBody.trim()) return;
    setNewWaSubmitting(true);
    setNewWaError(null);

    try {
      const res = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWaName.trim(),
          category: newWaCategory,
          body: newWaBody.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setNewWaError(data.error || "Failed creating WhatsApp template");
      } else {
        setShowNewWaModal(false);
        setNewWaName("");
        setNewWaBody("");
        refetchWaTemplates();
        if (data.id) setSelectedWaTemplateId(data.id);
      }
    } catch (e) {
      setNewWaError(String(e) || "Error creating WhatsApp template");
    } finally {
      setNewWaSubmitting(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/newsletter/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-newsletter"] });
      setDeleteId(null);
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (opts?: { draft?: boolean }) => {
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, saveAsDraft: opts?.draft }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: (d, vars) => {
      setSent({ count: d.recipientCount ?? 0, draft: vars?.draft });
      setSubject("");
      setBody("");
      setPreview(false);
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/newsletter/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
      setDeleteCampaignId(null);
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/newsletter/campaigns/${id}/resend`, { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] }),
  });

  const editCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!editingCampaign) return;
      const res = await fetch(`/api/newsletter/campaigns/${editingCampaign.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: editSubject, body: editBody }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
      setEditingCampaign(null);
    },
  });

  const subscribers  = data?.subscribers ?? [];
  const growth       = data?.growth ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? subscribers.filter(s => s.email.toLowerCase().includes(q)) : subscribers;
  }, [subscribers, search]);

  const maxGrowth = Math.max(...growth.map(g => g.count), 1);

  const handleExport = async () => {
    const res = await fetch("/api/newsletter/export");
    if (!res.ok) return;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `newsletter-subscribers-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(subscribers.map(s => s.email).join(", "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
  const charCount = body.length;

  const stats = [
    { label: "Total Subscribers", value: data?.total ?? 0,      icon: "group",          color: "text-[#006c49] bg-[#e6f7f1]" },
    { label: "Joined This Month",  value: data?.thisMonth ?? 0,  icon: "calendar_month", color: "text-blue-600 bg-blue-50"     },
    { label: "Joined This Week",   value: data?.thisWeek ?? 0,   icon: "trending_up",    color: "text-purple-600 bg-purple-50" },
    { label: "Campaigns Sent",     value: campaigns.filter(c => c.status === "SENT").length, icon: "send", color: "text-amber-600 bg-amber-50" },
  ];

  return (
    <AdminLayout sidebar="main">
      <div className="p-4 sm:p-8 bg-[#f8f9ff] min-h-screen">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-[11px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mb-2">Marketing</p>
            <h1 className="text-3xl sm:text-[48px] font-serif font-bold leading-tight text-black">Newsletter</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleCopyAll}
              className="px-5 py-2 border border-[#c6c6cd] font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#eff4ff] transition-all flex items-center gap-2 rounded-lg">
              <span className="material-symbols-outlined text-sm">{copied ? "check" : "content_copy"}</span>
              {copied ? "Copied!" : "Copy Emails"}
            </button>
            <button onClick={handleExport}
              className="px-5 py-2 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-all flex items-center gap-2 rounded-lg shadow">
              <span className="material-symbols-outlined text-sm">download</span>
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-xl p-5 shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${s.color}`}>
                  <span className="material-symbols-outlined text-lg">{s.icon}</span>
                </div>
                <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b]">{s.label}</p>
              </div>
              <p className="text-[32px] font-serif font-bold text-black leading-none">{s.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1.5 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] mb-6 w-fit flex-wrap">
          {(["compose", "whatsapp", "subscribers", "campaigns"] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setSent(null); setWaBroadcastResult(null); }}
              className={`px-5 py-2.5 rounded-lg font-[Manrope] font-bold text-xs tracking-widest uppercase transition-all flex items-center gap-2 ${
                tab === t ? "bg-black text-white shadow" : "text-[#7c839b] hover:text-black"
              }`}>
              {t === "compose" && <span className="material-symbols-outlined text-base">mail</span>}
              {t === "whatsapp" && <span className="material-symbols-outlined text-base text-[#25D366]">chat</span>}
              {t === "subscribers" && <span className="material-symbols-outlined text-base">group</span>}
              {t === "campaigns" && <span className="material-symbols-outlined text-base">campaign</span>}
              {t === "compose" ? "Email Newsletter" : t === "whatsapp" ? `WhatsApp Broadcast (${waTemplates.length})` : t === "subscribers" ? `Subscribers (${data?.total ?? 0})` : `Campaigns (${campaigns.length})`}
            </button>
          ))}
        </div>

        {/* ── WhatsApp Broadcast Tab ── */}
        {tab === "whatsapp" && (
          <div className="space-y-6">
            {/* Top Banner: Broadcast Controls & Sync */}
            <div className="bg-white rounded-2xl p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] border border-[#e5eeff] flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start md:items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">forum</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-serif font-bold text-black">WhatsApp Template Broadcast</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-[Manrope] font-bold uppercase tracking-wider bg-[#25D366]/10 text-[#006c49]">
                      Meta Cloud API
                    </span>
                  </div>
                  <p className="text-xs font-[Manrope] text-[#7c839b] mt-0.5">
                    Broadcast Meta-approved WhatsApp template notifications directly to subscribed clients.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSyncWaTemplates}
                  disabled={waSyncingTemplates}
                  className="px-4 py-2 border border-[#c6c6cd] text-black font-[Manrope] font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[#f8f9ff] transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <span className={`material-symbols-outlined text-sm ${waSyncingTemplates ? "animate-spin" : ""}`}>
                    sync
                  </span>
                  {waSyncingTemplates ? "Syncing Meta…" : "Sync Meta Templates"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewWaModal(true)}
                  className="px-4 py-2 bg-[#25D366] text-white font-[Manrope] font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[#128C7E] transition-all shadow flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  Create Template
                </button>
              </div>
            </div>

            {/* Main Broadcast Workarea */}
            <div className="grid grid-cols-12 gap-6">
              
              {/* Left Column: Template Selection & Settings */}
              <div className="col-span-12 lg:col-span-7 space-y-6">
                
                {/* 1. Template Selector */}
                <div className="bg-white rounded-2xl p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] border border-[#e5eeff] space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#25D366]"></span>
                      Select WhatsApp Template
                    </label>
                    <span className="text-xs font-[Manrope] text-[#7c839b]">
                      {waTemplates.length} Available
                    </span>
                  </div>

                  {loadingWaTemplates ? (
                    <div className="p-8 text-center text-xs text-[#7c839b] font-[Manrope]">
                      Loading WhatsApp Templates from Meta…
                    </div>
                  ) : waTemplates.length === 0 ? (
                    <div className="p-6 bg-[#f8f9ff] rounded-xl border border-dashed border-[#c6c6cd] text-center space-y-3">
                      <p className="text-xs font-[Manrope] text-[#45464d]">
                        No WhatsApp templates synced yet.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowNewWaModal(true)}
                        className="px-4 py-2 bg-black text-white rounded-lg text-xs font-[Manrope] font-bold uppercase tracking-wider"
                      >
                        Create First Template
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {waTemplates.map((tpl) => {
                        const isSelected = selectedWaTemplate?.id === tpl.id;
                        const isApproved = tpl.status === "Approved" || tpl.status === "APPROVED";
                        return (
                          <div
                            key={tpl.id}
                            onClick={() => {
                              setSelectedWaTemplateId(tpl.id);
                              setWaVariables([]);
                            }}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? "border-[#25D366] bg-[#25D366]/5 shadow-sm ring-1 ring-[#25D366]"
                                : "border-[#e5eeff] bg-white hover:border-[#c6c6cd]"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-[Manrope] font-bold text-black truncate max-w-[140px]">
                                {tpl.name}
                              </p>
                              <span
                                className={`text-[9px] font-[Manrope] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  isApproved
                                    ? "bg-[#e6f7f1] text-[#006c49]"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {tpl.status}
                              </span>
                            </div>
                            <p className="text-[11px] font-[Manrope] text-[#7c839b] line-clamp-2">
                              {tpl.body}
                            </p>
                            <div className="flex items-center justify-between mt-3 text-[10px] font-[Manrope] text-[#7c839b]">
                              <span>Cat: {tpl.category}</span>
                              <span>Sent: {tpl.sentCount ?? 0}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Variable Input Fields */}
                {selectedWaTemplate && waPlaceholders.length > 0 && (
                  <div className="bg-white rounded-2xl p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] border border-[#e5eeff] space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-[#006c49]">tune</span>
                        Customize Template Parameters
                      </label>
                      <span className="text-[10px] font-[Manrope] text-[#7c839b]">
                        {waPlaceholders.length} Dynamic Field(s)
                      </span>
                    </div>

                    <div className="space-y-3">
                      {waPlaceholders.map((ph, idx) => (
                        <div key={ph}>
                          <label className="text-[10px] font-[Manrope] font-bold uppercase text-[#7c839b] block mb-1">
                            Variable {ph} Replacement
                          </label>
                          <input
                            type="text"
                            placeholder={`e.g. "Spring Private Sale" or "20% OFF"`}
                            className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-xl px-4 py-2.5 font-[Manrope] text-xs text-black outline-none focus:border-[#25D366]"
                            value={waVariables[idx] || ""}
                            onChange={(e) => {
                              const updated = [...waVariables];
                              updated[idx] = e.target.value;
                              setWaVariables(updated);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Target Audience Selection */}
                <div className="bg-white rounded-2xl p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] border border-[#e5eeff] space-y-4">
                  <label className="text-[11px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-[#006c49]">group</span>
                    Target Audience
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      className={`p-4 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                        waRecipientsScope === "all_subscribers"
                          ? "border-black bg-black/5"
                          : "border-[#e5eeff] bg-white hover:border-[#c6c6cd]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="waScope"
                        checked={waRecipientsScope === "all_subscribers"}
                        onChange={() => setWaRecipientsScope("all_subscribers")}
                        className="mt-1 accent-black"
                      />
                      <div>
                        <p className="text-xs font-[Manrope] font-bold text-black">
                          All Subscribed Users
                        </p>
                        <p className="text-[11px] font-[Manrope] text-[#7c839b] mt-0.5">
                          {data?.total ?? 0} active client subscriber(s)
                        </p>
                      </div>
                    </label>

                    <label
                      className={`p-4 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                        waRecipientsScope === "custom"
                          ? "border-black bg-black/5"
                          : "border-[#e5eeff] bg-white hover:border-[#c6c6cd]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="waScope"
                        checked={waRecipientsScope === "custom"}
                        onChange={() => setWaRecipientsScope("custom")}
                        className="mt-1 accent-black"
                      />
                      <div>
                        <p className="text-xs font-[Manrope] font-bold text-black">
                          Custom Phone / Test Recipient
                        </p>
                        <p className="text-[11px] font-[Manrope] text-[#7c839b] mt-0.5">
                          Dispatch to specific mobile number(s)
                        </p>
                      </div>
                    </label>
                  </div>

                  {waRecipientsScope === "custom" && (
                    <div className="pt-2">
                      <label className="text-[10px] font-[Manrope] font-bold uppercase text-[#7c839b] block mb-1">
                        Recipient Mobile Number(s)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. +1 (555) 019-2831, +44 7700 900077"
                        className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-xl px-4 py-2.5 font-[Manrope] text-xs text-black outline-none focus:border-black"
                        value={waCustomPhone}
                        onChange={(e) => setWaCustomPhone(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Broadcast Action & Result Banner */}
                {waBroadcastResult && (
                  <div
                    className={`p-4 rounded-xl border flex items-start gap-3 ${
                      waBroadcastResult.success
                        ? "bg-[#e6f7f1] border-[#006c49]/30 text-[#006c49]"
                        : "bg-[#ffdad6] border-[#ba1a1a]/30 text-[#ba1a1a]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg mt-0.5">
                      {waBroadcastResult.success ? "check_circle" : "error"}
                    </span>
                    <div className="space-y-1 text-xs font-[Manrope]">
                      <p className="font-bold">{waBroadcastResult.message}</p>
                      {waBroadcastResult.errors && waBroadcastResult.errors.length > 0 && (
                        <div className="mt-2 text-[11px] opacity-90 space-y-0.5">
                          {waBroadcastResult.errors.map((err, i) => (
                            <p key={i}>• {err}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleBroadcastWhatsApp}
                    disabled={!selectedWaTemplate || waBroadcasting}
                    className="flex-1 py-3.5 bg-[#25D366] text-white font-[Manrope] font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-[#128C7E] transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-base ${waBroadcasting ? "animate-spin" : ""}`}>
                      {waBroadcasting ? "autorenew" : "send"}
                    </span>
                    {waBroadcasting ? "Broadcasting WhatsApp Template…" : "Dispatch Broadcast Now"}
                  </button>
                </div>

              </div>

              {/* Right Column: Smartphone Live Preview */}
              <div className="col-span-12 lg:col-span-5 flex flex-col items-center">
                <div className="w-full max-w-[340px] bg-[#111b21] rounded-[36px] p-4 shadow-2xl border-4 border-[#222d34] text-white space-y-3 relative overflow-hidden">
                  
                  {/* Phone Notch / Header */}
                  <div className="flex items-center justify-between text-[11px] text-[#8696a0] px-2 pt-1 pb-2">
                    <span>9:41</span>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-xs">signal_cellular_4_bar</span>
                      <span className="material-symbols-outlined text-xs">wifi</span>
                      <span className="material-symbols-outlined text-xs">battery_full</span>
                    </div>
                  </div>

                  {/* WhatsApp App Header Bar */}
                  <div className="bg-[#202c33] rounded-2xl p-3 flex items-center gap-3 border border-[#2a3942]">
                    <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center font-bold text-white text-xs shrink-0">
                      LB
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#e9edef] truncate flex items-center gap-1">
                        Luxe Boutique
                        <span className="material-symbols-outlined text-[14px] text-[#00a884]">verified</span>
                      </p>
                      <p className="text-[10px] text-[#8696a0]">Verified Official Account</p>
                    </div>
                  </div>

                  {/* Chat Area Wallpaper */}
                  <div className="bg-[#0b141a] rounded-2xl p-4 min-h-[320px] flex flex-col justify-end space-y-3 relative border border-[#222d34]">
                    <div className="text-center">
                      <span className="inline-block px-2.5 py-1 bg-[#182229] text-[9px] text-[#8696a0] font-mono rounded-lg">
                        TODAY
                      </span>
                    </div>

                    {/* WhatsApp Template Message Bubble */}
                    {selectedWaTemplate ? (
                      <div className="bg-[#005c4b] text-[#e9edef] p-3.5 rounded-2xl rounded-tl-xs max-w-[90%] self-start shadow space-y-2 border border-[#007a63]">
                        <div className="flex items-center justify-between text-[10px] text-[#8696a0] pb-1 border-b border-[#007a63]">
                          <span className="font-bold tracking-wider uppercase text-[#00a884]">
                            {selectedWaTemplate.category || "NOTIFICATION"}
                          </span>
                          <span>{selectedWaTemplate.name}</span>
                        </div>
                        <p className="text-xs leading-relaxed font-sans whitespace-pre-wrap">
                          {selectedWaTemplate.body.replace(/\{\{(\d+)\}\}/g, (_, num) => {
                            const idx = parseInt(num, 10) - 1;
                            return waVariables[idx] || `{{${num}}}`;
                          })}
                        </p>
                        <div className="flex items-center justify-end gap-1 text-[9px] text-[#8696a0] pt-1">
                          <span>Just now</span>
                          <span className="material-symbols-outlined text-[12px] text-[#53bdeb]">done_all</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-xs text-[#8696a0] p-6">
                        Select a WhatsApp template to preview.
                      </div>
                    )}
                  </div>

                  {/* Notice */}
                  <p className="text-[10px] text-center text-[#8696a0] px-2 font-[Manrope]">
                    Live rendering of WhatsApp client broadcast bubble.
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── Compose Tab ── */}
        {tab === "compose" && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-7 space-y-6">

              {/* Google Workspace / Gmail Status Banner */}
              <div className="bg-white rounded-xl p-5 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] border border-[#e5eeff] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${googleUser ? "bg-[#006c49] text-white" : "bg-[#f1f3f9] text-[#7c839b]"}`}>
                    <span className="material-symbols-outlined text-xl">mark_email_read</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-[Manrope] font-bold text-black">
                        {googleUser ? "Gmail Broadcast Connected" : "Connect Gmail for Campaign Delivery"}
                      </p>
                      {googleUser && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-[Manrope] font-bold uppercase tracking-wider bg-[#e6f7f1] text-[#006c49]">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-[Manrope] text-[#7c839b] mt-0.5">
                      {googleUser
                        ? `Broadcasting through ${googleUser.email}`
                        : "Connect your Google account to send campaigns directly from your store Gmail inbox."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  {googleUser ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSendTestGmail}
                        disabled={!subject.trim() || !body.trim() || sendingTestGmail || gmailSending}
                        className="px-3.5 py-1.5 border border-[#c6c6cd] text-black font-[Manrope] font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-[#f8f9ff] transition-all disabled:opacity-40 flex items-center gap-1.5"
                        title="Send a preview copy to your connected Gmail"
                      >
                        {sendingTestGmail ? (
                          <span className="material-symbols-outlined text-sm animate-spin">autorenew</span>
                        ) : (
                          <span className="material-symbols-outlined text-sm">send</span>
                        )}
                        <span>Test to Me</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleGoogleSignOut}
                        className="px-3 py-1.5 text-[#ba1a1a] hover:bg-[#ffdad6]/40 font-[Manrope] font-bold text-xs uppercase tracking-wider rounded-lg transition-all"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isGoogleSigningIn}
                      className="px-4 py-2 bg-black text-white hover:bg-[#006c49] font-[Manrope] font-bold text-xs tracking-widest uppercase rounded-lg transition-all flex items-center gap-2 shadow"
                    >
                      {isGoogleSigningIn ? (
                        <span className="material-symbols-outlined text-sm animate-spin">autorenew</span>
                      ) : (
                        <span className="material-symbols-outlined text-sm">login</span>
                      )}
                      <span>Sign in with Google</span>
                    </button>
                  )}
                </div>
              </div>

              {testGmailResult && (
                <div className={`p-4 rounded-xl flex items-center gap-3 border ${
                  testGmailResult.ok ? "bg-[#e6f7f1] border-[#6cf8bb]/40 text-[#006c49]" : "bg-[#ffdad6] border-[#ba1a1a]/20 text-[#ba1a1a]"
                }`}>
                  <span className="material-symbols-outlined text-xl">
                    {testGmailResult.ok ? "check_circle" : "error"}
                  </span>
                  <p className="text-xs font-[Manrope] font-bold">{testGmailResult.msg}</p>
                </div>
              )}

              {gmailProgress && (
                <div className="p-4 bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] border border-blue-100 space-y-2">
                  <div className="flex justify-between items-center text-xs font-[Manrope]">
                    <span className="font-bold text-blue-800 flex items-center gap-2">
                      <span className="material-symbols-outlined text-base animate-spin">autorenew</span>
                      Sending via Gmail…
                    </span>
                    <span className="text-[#7c839b] font-bold">
                      {gmailProgress.current} / {gmailProgress.total} ({Math.round((gmailProgress.current / gmailProgress.total) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#f1f3f9] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#006c49] h-full transition-all duration-300"
                      style={{ width: `${(gmailProgress.current / gmailProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] font-[Manrope] text-[#7c839b]">
                    Delivered: <strong className="text-[#006c49]">{gmailProgress.success}</strong> · Failed: <strong className="text-[#ba1a1a]">{gmailProgress.failed}</strong>
                  </p>
                </div>
              )}

              {sent && (
                <div className="p-4 bg-[#e6f7f1] border border-[#6cf8bb]/40 rounded-xl flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#006c49] text-xl">check_circle</span>
                  <p className="text-sm font-[Manrope] font-bold text-[#006c49]">
                    {sent.draft ? "Draft saved!" : `Campaign sent to ${sent.count} subscriber${sent.count !== 1 ? "s" : ""} via Gmail!`}
                  </p>
                </div>
              )}

              {sendMutation.isError && (
                <div className="p-4 bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-xl flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#ba1a1a] text-xl">error</span>
                  <p className="text-sm font-[Manrope] font-bold text-[#ba1a1a]">{(sendMutation.error as Error).message}</p>
                </div>
              )}

              <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5eeff]">
                  <h3 className="text-[18px] font-serif font-semibold text-black">New Campaign</h3>
                  <button onClick={() => setPreview(p => !p)}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11px] font-[Manrope] font-bold uppercase tracking-widest transition-all ${
                      preview ? "bg-black text-white" : "border border-[#c6c6cd] text-[#45464d] hover:bg-[#eff4ff]"
                    }`}>
                    <span className="material-symbols-outlined text-sm">{preview ? "edit" : "visibility"}</span>
                    {preview ? "Edit" : "Preview"}
                  </button>
                </div>

                {preview ? (
                  /* Email preview */
                  <div className="p-6">
                    <div className="border border-[#e5eeff] rounded-xl overflow-hidden max-w-lg mx-auto shadow-sm">
                      <div className="bg-[#080e0b] px-8 py-5 text-center">
                        <span className="text-white text-[12px] font-bold tracking-[0.2em] uppercase">✦ Luxe Boutique</span>
                      </div>
                      <div className="bg-white p-8">
                        <p className="text-[11px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mb-1">Subject</p>
                        <p className="text-lg font-serif font-semibold text-black mb-6">{subject || "—"}</p>
                        <div className="text-sm font-[Manrope] text-[#2d3748] leading-relaxed whitespace-pre-wrap border-t border-[#f1f3f9] pt-6">
                          {body || <span className="text-[#c6c6cd]">No body written yet.</span>}
                        </div>
                      </div>
                      <div className="bg-[#f8f9ff] px-8 py-4 text-center border-t border-[#f1f3f9]">
                        <p className="text-[10px] font-[Manrope] text-[#b0b8cc]">
                          You're receiving this because you subscribed at Luxe Boutique.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Composer */
                  <div className="p-6 space-y-5">
                    <div>
                      <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">
                        Subject line <span className="text-[#ba1a1a]">*</span>
                      </label>
                      <input
                        className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-3 font-[Manrope] text-sm outline-none focus:border-black transition-colors"
                        placeholder="e.g. New arrivals just dropped — shop the edit"
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d]">
                          Message body <span className="text-[#ba1a1a]">*</span>
                        </label>
                        <span className="text-[10px] font-[Manrope] text-[#7c839b]">{wordCount} words · {charCount} chars</span>
                      </div>
                      <textarea
                        className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-3 font-[Manrope] text-sm outline-none focus:border-black transition-colors resize-none leading-relaxed"
                        rows={14}
                        placeholder={"Dear subscriber,\n\nWe're excited to share what's new at Luxe Boutique…\n\nWith love,\nThe Luxe Boutique Team"}
                        value={body}
                        onChange={e => setBody(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Footer send bar */}
                <div className="px-6 py-4 border-t border-[#e5eeff] bg-[#f8f9ff] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-[11px] font-[Manrope] text-[#7c839b]">
                    <span className="material-symbols-outlined text-base text-[#006c49]">group</span>
                    Sending to <strong className="text-black">{data?.total ?? 0}</strong> subscriber{(data?.total ?? 0) !== 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => sendMutation.mutate({ draft: true })}
                      disabled={!subject.trim() || !body.trim() || sendMutation.isPending || gmailSending}
                      className="px-5 py-2.5 border border-[#c6c6cd] text-[#45464d] font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#eff4ff] transition-all rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">draft</span> Save Draft
                    </button>
                    {googleUser ? (
                      <button
                        type="button"
                        onClick={handleSendViaGmail}
                        disabled={!subject.trim() || !body.trim() || gmailSending || (data?.total ?? 0) === 0}
                        className="px-8 py-2.5 bg-[#006c49] text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-black transition-all rounded-lg shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                        {gmailSending ? (
                          <><span className="material-symbols-outlined text-sm animate-spin">autorenew</span> Dispatching via Gmail…</>
                        ) : (
                          <><span className="material-symbols-outlined text-sm">mark_email_read</span> Send via Gmail</>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isGoogleSigningIn || (data?.total ?? 0) === 0}
                        className="px-8 py-2.5 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-all rounded-lg shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                        {isGoogleSigningIn ? (
                          <><span className="material-symbols-outlined text-sm animate-spin">autorenew</span> Connecting…</>
                        ) : (
                          <><span className="material-symbols-outlined text-sm">login</span> Sign in with Google to Send</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: tips + growth chart */}
            <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
              <div className="bg-white rounded-xl p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
                <h3 className="text-[16px] font-serif font-semibold text-black mb-4">Writing tips</h3>
                <ul className="space-y-3">
                  {[
                    { icon: "subject",       tip: "Keep subject lines under 50 characters for best open rates." },
                    { icon: "waving_hand",   tip: "Open with a warm greeting — it increases engagement." },
                    { icon: "call_to_action",tip: "Always include a clear call-to-action (shop, read, explore)." },
                    { icon: "schedule",      tip: "Send Tuesday–Thursday mornings for highest click-through." },
                    { icon: "preview",       tip: "Use the Preview button to see exactly how subscribers will read it." },
                  ].map(({ icon, tip }) => (
                    <li key={icon} className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-[#006c49] text-base mt-0.5 shrink-0">{icon}</span>
                      <p className="text-xs font-[Manrope] text-[#45464d] leading-relaxed">{tip}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
                <h3 className="text-[16px] font-serif font-semibold text-black mb-5">Growth (last 6 months)</h3>
                {growth.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-[#7c839b]">
                    <span className="material-symbols-outlined text-3xl text-[#c6c6cd] mb-2">bar_chart</span>
                    <p className="text-xs font-[Manrope]">No data yet</p>
                  </div>
                ) : (
                  <div className="flex items-end gap-2 h-28">
                    {growth.map(g => (
                      <div key={g.month} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[9px] font-[Manrope] font-bold text-[#7c839b]">{g.count}</span>
                        <div
                          className="w-full bg-[#006c49] rounded-t-sm hover:bg-[#00a36d] transition-colors"
                          style={{ height: `${Math.max(4, (g.count / maxGrowth) * 90)}px` }}
                          title={`${fmtMonth(g.month)}: ${g.count}`}
                        />
                        <span className="text-[9px] font-[Manrope] text-[#7c839b]">{fmtMonth(g.month)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Subscribers Tab ── */}
        {tab === "subscribers" && (
          <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] overflow-hidden">
            <div className="p-6 border-b border-[#e5eeff] flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <h3 className="text-[18px] font-serif font-semibold text-black">
                All Subscribers
                <span className="ml-2 text-[13px] font-[Manrope] font-normal text-[#7c839b]">({filtered.length})</span>
              </h3>
              <div className="relative w-full sm:w-72">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#7c839b] text-lg">search</span>
                <input
                  className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg pl-9 pr-4 py-2 text-sm font-[Manrope] outline-none focus:border-black transition-colors"
                  placeholder="Search by email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            {isLoading ? (
              <div className="py-24 flex items-center justify-center gap-3 text-[#7c839b]">
                <span className="material-symbols-outlined animate-spin text-2xl">autorenew</span>
                <span className="font-[Manrope] text-sm">Loading…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#7c839b]">
                <span className="material-symbols-outlined text-5xl text-[#c6c6cd]">mail</span>
                <p className="font-[Manrope] font-bold text-sm">{search ? "No results" : "No subscribers yet"}</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-[#f8f9ff] border-b border-[#e5eeff]">
                  <tr>
                    <th className="text-left text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] px-6 py-3">#</th>
                    <th className="text-left text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] px-6 py-3">Email</th>
                    <th className="text-left text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] px-6 py-3">Subscribed</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f2ff]">
                  {filtered.map((s, i) => (
                    <tr key={s.id} className="hover:bg-[#f8f9ff] transition-colors group">
                      <td className="px-6 py-4 text-[11px] font-[Manrope] text-[#7c839b]">{i + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#eff4ff] flex items-center justify-center text-[11px] font-[Manrope] font-bold text-[#006c49] uppercase shrink-0">
                            {s.email[0]}
                          </div>
                          <span className="text-sm font-[Manrope] text-[#0a0f0d]">{s.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[13px] font-[Manrope] text-[#45464d]">{fmtDate(s.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => setDeleteId(s.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-full hover:bg-[#ffdad6] flex items-center justify-center ml-auto">
                          <span className="material-symbols-outlined text-[#ba1a1a] text-base">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Campaigns Tab ── */}
        {tab === "campaigns" && (
          <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] overflow-hidden">
            <div className="p-6 border-b border-[#e5eeff]">
              <h3 className="text-[18px] font-serif font-semibold text-black">Campaign History</h3>
            </div>
            {campaigns.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#7c839b]">
                <span className="material-symbols-outlined text-5xl text-[#c6c6cd]">campaign</span>
                <p className="font-[Manrope] font-bold text-sm">No campaigns sent yet</p>
                <button onClick={() => setTab("compose")}
                  className="mt-2 px-5 py-2 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-all rounded-lg">
                  Compose First Campaign
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#f0f2ff]">
                {campaigns.map(c => {
                  const cfg = STATUS_CFG[c.status] ?? STATUS_CFG.SENT;
                  const canResend = ["FAILED", "PARTIAL", "SENT"].includes(c.status);
                  const canEdit   = ["DRAFT", "FAILED"].includes(c.status);
                  return (
                    <div key={c.id} className="px-6 py-5 hover:bg-[#f8f9ff] transition-colors">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-[Manrope] font-bold text-sm text-[#0a0f0d] truncate">{c.subject}</p>
                          <p className="text-[12px] font-[Manrope] text-[#7c839b] mt-0.5 line-clamp-1">{c.body}</p>
                        </div>
                        <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-[Manrope] font-bold uppercase tracking-widest ${cfg.cls}`}>
                          <span className={`material-symbols-outlined text-[12px] ${c.status === "SENDING" ? "animate-spin" : ""}`}>{cfg.icon}</span>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-5 text-[11px] font-[Manrope] text-[#7c839b]">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">group</span>
                            {c.sentCount} / {c.recipientCount} delivered
                          </span>
                          {c.sentAt && (
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">schedule</span>
                              {fmtDate(c.sentAt)}
                            </span>
                          )}
                          {c.status === "DRAFT" && (
                            <span className="text-[#45464d]">Draft — not yet sent</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <button
                              onClick={() => { setEditingCampaign(c); setEditSubject(c.subject); setEditBody(c.body); }}
                              className="p-1.5 rounded-lg text-[#7c839b] hover:text-black hover:bg-[#eff4ff] transition-all"
                              title="Edit campaign">
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                          )}
                          {canResend && (
                            <button
                              onClick={() => resendMutation.mutate(c.id)}
                              disabled={resendMutation.isPending}
                              className="p-1.5 rounded-lg text-[#7c839b] hover:text-[#006c49] hover:bg-[#e6f7f1] transition-all"
                              title="Resend campaign">
                              <span className={`material-symbols-outlined text-[16px] ${resendMutation.isPending ? "animate-spin" : ""}`}>
                                {resendMutation.isPending ? "autorenew" : "refresh"}
                              </span>
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteCampaignId(c.id)}
                            className="p-1.5 rounded-lg text-[#7c839b] hover:text-[#ba1a1a] hover:bg-[#ffdad6] transition-all"
                            title="Delete campaign">
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
            <div className="w-12 h-12 rounded-full bg-[#ffdad6] flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[#ba1a1a] text-2xl">delete</span>
            </div>
            <h3 className="text-[20px] font-serif font-bold text-black mb-2">Remove subscriber?</h3>
            <p className="text-sm font-[Manrope] text-[#45464d] mb-6">
              <strong>{subscribers.find(s => s.id === deleteId)?.email}</strong> will be unsubscribed. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 border border-[#c6c6cd] font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#eff4ff] transition-all rounded-lg">
                Cancel
              </button>
              <button onClick={() => deleteMutation.mutate(deleteId!)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 bg-[#ba1a1a] text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#93000a] transition-all rounded-lg disabled:opacity-60">
                {deleteMutation.isPending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Campaign modal */}
      {deleteCampaignId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
            <div className="w-12 h-12 rounded-full bg-[#ffdad6] flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[#ba1a1a] text-2xl">campaign</span>
            </div>
            <h3 className="text-[20px] font-serif font-bold text-black mb-2">Delete campaign?</h3>
            <p className="text-sm font-[Manrope] text-[#45464d] mb-6">
              <strong>"{campaigns.find(c => c.id === deleteCampaignId)?.subject}"</strong> will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteCampaignId(null)}
                className="flex-1 py-2.5 border border-[#c6c6cd] font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#eff4ff] transition-all rounded-lg">
                Cancel
              </button>
              <button onClick={() => deleteCampaignMutation.mutate(deleteCampaignId!)}
                disabled={deleteCampaignMutation.isPending}
                className="flex-1 py-2.5 bg-[#ba1a1a] text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#93000a] transition-all rounded-lg disabled:opacity-60">
                {deleteCampaignMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Campaign modal */}
      {editingCampaign && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[20px] font-serif font-bold text-black">Edit Campaign</h3>
              <button onClick={() => setEditingCampaign(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#f8f9ff] transition-colors">
                <span className="material-symbols-outlined text-[#45464d]">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1.5">
                  Subject line
                </label>
                <input
                  className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-2.5 font-[Manrope] text-sm outline-none focus:border-black"
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1.5">
                  Message body
                </label>
                <textarea
                  className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-2.5 font-[Manrope] text-sm outline-none focus:border-black resize-none"
                  rows={8}
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditingCampaign(null)}
                  className="flex-1 py-3 border border-[#c6c6cd] font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#f8f9ff] transition-all rounded-lg">
                  Cancel
                </button>
                <button onClick={() => editCampaignMutation.mutate()}
                  disabled={editCampaignMutation.isPending || !editSubject.trim() || !editBody.trim()}
                  className="flex-1 py-3 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-all rounded-lg shadow disabled:opacity-50">
                  {editCampaignMutation.isPending ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create New WhatsApp Template Modal */}
      {showNewWaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-lg w-full space-y-5">
            <div className="flex items-center justify-between border-b border-[#f1f3f9] pb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#25D366] text-2xl">chat</span>
                <h3 className="text-lg font-serif font-bold text-black">Create WhatsApp Template</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewWaModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#f8f9ff] text-[#7c839b]"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {newWaError && (
              <div className="p-3 bg-[#ffdad6] border border-[#ba1a1a]/30 rounded-xl text-xs text-[#ba1a1a] font-[Manrope]">
                {newWaError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1">
                  Template Name (Alphanumeric &amp; Underscores)
                </label>
                <input
                  type="text"
                  placeholder="e.g. spring_collection_launch"
                  className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-xl px-4 py-2.5 font-[Manrope] text-xs text-black outline-none focus:border-[#25D366]"
                  value={newWaName}
                  onChange={(e) => setNewWaName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1">
                  Category
                </label>
                <select
                  className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-xl px-4 py-2.5 font-[Manrope] text-xs text-black outline-none focus:border-[#25D366]"
                  value={newWaCategory}
                  onChange={(e) => setNewWaCategory(e.target.value)}
                >
                  <option value="Marketing">Marketing</option>
                  <option value="Utility">Utility</option>
                  <option value="Authentication">Authentication</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1">
                  Message Body (Use {"{{1}}"}, {"{{2}}"} for placeholders)
                </label>
                <textarea
                  rows={4}
                  placeholder="Dear valued client, enjoy {{1}} on our new arrivals! Access portal: {{2}}"
                  className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-xl px-4 py-2.5 font-[Manrope] text-xs text-black outline-none focus:border-[#25D366] resize-none"
                  value={newWaBody}
                  onChange={(e) => setNewWaBody(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNewWaModal(false)}
                className="flex-1 py-3 border border-[#c6c6cd] font-[Manrope] font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[#f8f9ff]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateWaTemplate}
                disabled={newWaSubmitting || !newWaName.trim() || !newWaBody.trim()}
                className="flex-1 py-3 bg-[#25D366] text-white font-[Manrope] font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[#128C7E] disabled:opacity-50"
              >
                {newWaSubmitting ? "Submitting to Meta…" : "Submit Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
