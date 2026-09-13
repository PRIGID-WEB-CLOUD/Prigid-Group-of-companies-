import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { 
  SiGoogle, 
  SiFacebook, 
  SiInstagram, 
  SiMeta, 
  SiWhatsapp, 
  SiX,
  SiTiktok,
  SiPinterest,
  SiGoogleanalytics,
  SiPaypal,
  SiDhl,
} from "react-icons/si";
import {
  MdSync,
  MdInfo,
  MdWarning,
  MdError,
  MdRefresh,
  MdArrowBack,
  MdNetworkPing,
  MdDeleteSweep,
  MdCheckCircle,
  MdSave,
  MdHelp,
  MdCampaign,
} from "react-icons/md";
import AdminLayout from "./AdminLayout";

type ChannelStatus = "CONNECTED" | "PAUSED" | "DISCONNECTED";
type TestResult = "idle" | "testing" | "pass" | "fail";
type ActiveTab = "health" | "events" | "webhooks";

interface ChannelConfig {
  id: string;
  channelId: string;
  status: ChannelStatus;
  lastSync: string | null;
  latency: number;
}

interface EventLog {
  id: string;
  channel: string;
  event: string;
  detail: string;
  type: "sync" | "error" | "warning" | "info";
  createdAt: string;
}

interface Webhook {
  id: string;
  webhookId: string;
  label: string;
  url: string;
  active: boolean;
}

const channelMeta: Record<string, { icon: any; title: string; desc: string; href: string }> = {
  workspace:{ icon: <SiGoogle className="text-xl text-[#4285F4]" />, title: "Google Workspace", desc: "Google Contacts client sync and Gmail VIP concierge outreach.", href: "/channels/google-workspace" },
  facebook: { icon: <SiFacebook className="text-xl text-[#1877F2]" />, title: "Facebook Pages", desc: "Page posts, pixel tracking, and audience management.",  href: "/channels/facebook"      },
  instagram:{ icon: <SiInstagram className="text-xl text-[#E4405F]" />, title: "Instagram",      desc: "Publish posts and track media performance.",             href: "/channels/instagram"     },
  commerce: { icon: <SiMeta className="text-xl text-[#0668E1]" />, title: "Meta Commerce",  desc: "Sync product catalog to Facebook Shop and Instagram.",   href: "/channels/meta-commerce" },
  metaBusiness: { icon: <SiMeta className="text-xl text-[#0668E1]" />, title: "Meta Business Suite", desc: "Unified Meta integration for Ads, WhatsApp, Catalog, and more.", href: "/channels/meta-business" },
  ads:      { icon: <SiMeta className="text-xl text-[#0668E1]" />, title: "Meta Ads",       desc: "View ad campaigns, spend, and real-time insights.",      href: "/channels/meta-ads"      },
  whatsapp: { icon: <SiWhatsapp className="text-xl text-[#25D366]" />, title: "WhatsApp API",   desc: "Automated customer journeys and order notifications.",   href: "/channels/whatsapp"      },
  twitter:  { icon: <SiX className="text-xl text-black" />, title: "X / Twitter",   desc: "Automated product drops and hashtag management.",         href: "/channels/twitter"       },
  tiktok:   { icon: <SiTiktok className="text-xl text-black" />, title: "TikTok Shop", desc: "Live commerce, video tagging, and creator drops.", href: "/channels/tiktok" },
  pinterest:{ icon: <SiPinterest className="text-xl text-[#E60023]" />, title: "Pinterest Lookbooks", desc: "Rich Product Pins and Verified Merchant catalog sync.", href: "/channels/pinterest" },
  klaviyo:  { icon: <MdCampaign className="text-xl text-[#006c49]" />, title: "Klaviyo VIP & SMS", desc: "Automated VIP segment sync, SMS alerts, and concierge campaigns.", href: "/settings" },
  ga4:      { icon: <SiGoogleanalytics className="text-xl text-[#E37400]" />, title: "Google Analytics 4", desc: "Server-side luxury commerce telemetry and conversion attribution.", href: "/settings" },
  dhl:      { icon: <SiDhl className="text-xl text-[#D40511]" />, title: "DHL Express Logistics", desc: "International air waybill generation and real-time package tracking.", href: "/settings" },
  paypal:   { icon: <SiPaypal className="text-xl text-[#003087]" />, title: "PayPal & Pay in 4", desc: "VIP digital wallet checkout and interest-free installment splits.", href: "/settings" },
};

const statusConfig: Record<ChannelStatus, { label: string; cls: string }> = {
  CONNECTED:    { label: "CONNECTED",    cls: "bg-[#6cf8bb] text-[#00714d]" },
  PAUSED:       { label: "PAUSED",       cls: "bg-amber-100 text-amber-700" },
  DISCONNECTED: { label: "DISCONNECTED", cls: "bg-red-100 text-red-600"     },
};
const nextStatus: Record<ChannelStatus, ChannelStatus> = {
  CONNECTED: "PAUSED", PAUSED: "CONNECTED", DISCONNECTED: "CONNECTED",
};
const channelTestEndpoints: Record<string, string> = {
  facebook: "/api/facebook/page-info",
  instagram: "/api/facebook/instagram/account",
  commerce: "/api/facebook/catalog/info",
  ads: "/api/facebook/ads/account",
  whatsapp: "/api/whatsapp/phone-info",
  twitter: "/api/twitter/verify",
  tiktok: "/api/channels/tiktok/config",
  pinterest: "/api/channels/pinterest/config",
  klaviyo: "/api/marketing/klaviyo/config",
  ga4: "/api/analytics/ga4/config",
  dhl: "/api/shipping/dhl/config",
  paypal: "/api/payments/paypal/config",
};
const logTypeStyle: Record<string, { icon: any; cls: string }> = {
  sync:    { icon: <MdSync />,    cls: "text-[#006c49] bg-emerald-50" },
  info:    { icon: <MdInfo />,    cls: "text-blue-600 bg-blue-50"     },
  warning: { icon: <MdWarning />, cls: "text-amber-600 bg-amber-50"   },
  error:   { icon: <MdError />,   cls: "text-red-600 bg-red-50"       },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminChannelHubPage() {
  const [configs, setConfigs] = useState<ChannelConfig[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("health");
  const [logFilter, setLogFilter] = useState<"all" | string>("all");
  const [metaStatus, setMetaStatus] = useState<{ connected: boolean; business?: { name: string }; assets?: { pages: any[] } } | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const loadAll = useCallback(async () => {
    try {
      const [cfgRes, evtRes, whRes, metaRes] = await Promise.all([
        fetch("/api/channels/configs"),
        fetch("/api/channels/events"),
        fetch("/api/channels/webhooks"),
        fetch("/api/channels/meta/status").catch(() => null),
      ]);
      if (cfgRes.ok) setConfigs(await cfgRes.json());
      if (evtRes.ok) setEvents(await evtRes.json());
      if (whRes.ok)  setWebhooks(await whRes.json());
      if (metaRes && metaRes.ok) setMetaStatus(await metaRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleStatus = async (channelId: string) => {
    const cfg = configs.find((c) => c.channelId === channelId)!;
    const next = nextStatus[cfg.status];
    setConfigs((p) => p.map((c) => c.channelId === channelId ? { ...c, status: next } : c));
    await fetch(`/api/channels/configs/${channelId}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    showToast(`${channelMeta[channelId]?.title} is now ${next.toLowerCase()}.`);
    loadAll();
  };

  const syncChannel = async (channelId: string) => {
    setSyncing((p) => ({ ...p, [channelId]: true }));
    const res = await fetch(`/api/channels/configs/${channelId}/verify`, { method: "POST" });
    if (res.ok) {
      const updated = await res.json();
      setConfigs((p) => p.map((c) => c.channelId === channelId ? { ...c, ...updated } : c));
      showToast(`${channelMeta[channelId]?.title} synced.`);
      loadAll();
    }
    setSyncing((p) => ({ ...p, [channelId]: false }));
  };

  const syncAll = async () => {
    const keys = configs.map((c) => c.channelId);
    keys.forEach((k) => setSyncing((p) => ({ ...p, [k]: true })));
    await fetch("/api/channels/configs/verify-all", { method: "POST" });
    keys.forEach((k) => setSyncing((p) => ({ ...p, [k]: false })));
    showToast("All channels synced.");
    loadAll();
  };

  const testConnection = async (channelId: string) => {
    setTestResults((p) => ({ ...p, [channelId]: "testing" }));
    try {
      const res = await fetch(`/api/channels/configs/${channelId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json().catch(() => ({})) as { pass?: boolean; ok?: boolean; error?: string; latency?: number };
      const pass = res.ok && (data.pass || data.ok);
      const latency = data.latency ?? 0;
      setTestResults((p) => ({ ...p, [channelId]: pass ? "pass" : "fail" }));
      if (pass) {
        setConfigs((p) => p.map((c) => c.channelId === channelId ? { ...c, status: "CONNECTED", latency } : c));
        showToast(`${channelMeta[channelId]?.title} test passed — ${latency}ms`);
      } else {
        setConfigs((p) => p.map((c) => c.channelId === channelId ? { ...c, status: "DISCONNECTED", latency } : c));
        showToast(`${channelMeta[channelId]?.title} connection failed${data.error ? `: ${data.error}` : "."}`);
      }
      loadAll();
      setTimeout(() => setTestResults((p) => ({ ...p, [channelId]: "idle" })), 4000);
    } catch {
      setTestResults((p) => ({ ...p, [channelId]: "fail" }));
      showToast(`${channelMeta[channelId]?.title} connection request failed.`);
    }
  };

  const clearLogs = async () => {
    await fetch("/api/channels/events", { method: "DELETE" });
    setEvents([]);
    showToast("Event log cleared.");
  };

  const toggleWebhook = async (webhookId: string, active: boolean) => {
    setWebhooks((p) => p.map((w) => w.webhookId === webhookId ? { ...w, active } : w));
    await fetch(`/api/channels/webhooks/${webhookId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) });
  };

  const connectedConfigs = configs.filter((c) => c.status === "CONNECTED");
  const connectedCount = connectedConfigs.length;
  const globalOk = configs.length > 0 && connectedCount === configs.length;
  const activeLatencies = connectedConfigs.filter((c) => (c.latency ?? 0) > 0).map((c) => c.latency);
  const avgLatency = activeLatencies.length ? Math.round(activeLatencies.reduce((a, b) => a + b, 0) / activeLatencies.length) : 0;
  const filteredLogs = logFilter === "all" ? events : events.filter((e) => e.type === logFilter);

  // Real database metrics calculations
  const syncEvents = events.filter((e) => e.type === "sync" || e.type === "error");
  const successfulSyncs = events.filter((e) => e.type === "sync").length;
  const syncRate = syncEvents.length > 0 ? Math.round((successfulSyncs / syncEvents.length) * 100) : null;

  const activeWebhooks = webhooks.filter((w) => w.active).length;
  const webhookRate = webhooks.length > 0 ? Math.round((activeWebhooks / webhooks.length) * 100) : 0;

  const totalErrors = events.filter((e) => e.type === "error").length;
  const errorRate = events.length > 0 ? ((totalErrors / events.length) * 100).toFixed(1) : "0.0";

  if (loading) return (
    <AdminLayout sidebar="channels">
      <div className="flex items-center justify-center min-h-screen">
        <MdRefresh className="animate-spin text-[#006c49] text-3xl" />
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout sidebar="channels">
      <div className="p-4 sm:p-10 max-w-[1280px] mx-auto">
        {toast && (
          <div className="fixed top-6 right-6 z-50 bg-black text-white px-6 py-3 rounded-lg shadow-2xl font-[Manrope] text-sm font-bold flex items-center gap-3">
            <MdCheckCircle className="text-[#6cf8bb] text-base" />{toast}
          </div>
        )}

        <header className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-[#7c839b] hover:text-[#006c49] transition-colors font-[Manrope] font-bold text-xs tracking-widest uppercase mb-4 no-underline">
              <MdArrowBack className="text-base" /> Back to Dashboard
            </Link>
            <h1 className="text-3xl sm:text-[44px] font-serif font-bold text-[#0b1c30] mb-2">Omnichannel Hub</h1>
            <p className="text-[17px] font-[Manrope] text-[#7c839b] max-w-2xl">Manage, test and monitor all retail channel integrations from one control surface.</p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-3">
            <div className="text-left sm:text-right">
              <span className="block font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#818486]">Global Status</span>
              <span className={`font-bold flex items-center gap-1 sm:justify-end font-[Manrope] mt-1 ${globalOk ? "text-[#006c49]" : "text-amber-600"}`}>
                <span className={`w-2 h-2 rounded-full ${globalOk ? "bg-[#006c49]" : "bg-amber-500"}`}></span>
                {globalOk ? "Operational" : `${connectedCount}/${configs.length} Active`}
              </span>
            </div>
            <button onClick={syncAll} className="flex items-center gap-2 px-5 py-2.5 bg-[#006c49] text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-black transition-colors rounded-sm">
              <MdSync className="text-sm" /> Sync All
            </button>
          </div>
        </header>

        {/* Unified Meta Business Suite Banner */}
        <div id="meta-business-suite-banner" className="mb-8 p-6 bg-white rounded-xl border border-slate-200/90 shadow-[0px_4px_20px_rgba(15,23,42,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0668E1] flex items-center justify-center shrink-0">
              <SiMeta className="text-2xl" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-serif font-bold text-[#0b1c30]">
                  Meta Business Suite (Consolidated Authentication)
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-[Manrope] font-bold ${
                  metaStatus?.connected ? "bg-[#6cf8bb] text-[#00714d]" : "bg-slate-100 text-slate-600"
                }`}>
                  {metaStatus?.connected ? "CONNECTED" : "NOT LINKED"}
                </span>
              </div>
              <p className="text-xs font-[Manrope] text-[#7c839b] max-w-2xl leading-relaxed">
                {metaStatus?.connected
                  ? `Authenticated as "${metaStatus.business?.name || "Meta Business"}". Automatically synchronizes Facebook Pages, Instagram, WhatsApp Business, Catalog, and Ads.`
                  : "Connect your Meta Business Suite once with Facebook Login for Business to auto-provision Facebook, Instagram, WhatsApp, Catalog, and Ads in one click."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              id="meta-business-hub-action-btn"
              href="/channels/meta-business"
              className={`px-5 py-2.5 text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-lg transition-colors flex items-center gap-2 no-underline ${
                metaStatus?.connected
                  ? "bg-slate-100 hover:bg-slate-200 text-[#0b1c30]"
                  : "bg-[#0668E1] hover:bg-blue-700 text-white"
              }`}
            >
              <SiMeta className="text-base" />
              <span>{metaStatus?.connected ? "Manage Meta Assets" : "Connect Meta Business"}</span>
            </Link>
          </div>
        </div>

        {/* Channel Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {configs.map((cfg) => {
            const meta = channelMeta[cfg.channelId];
            if (!meta) return null;
            const sc = statusConfig[cfg.status] ?? statusConfig.DISCONNECTED;
            const isSyncing = syncing[cfg.channelId];
            const testResult = testResults[cfg.channelId] ?? "idle";
            return (
              <div key={cfg.channelId} className="bg-white p-5 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] flex flex-col hover:-translate-y-0.5 transition-all duration-300">
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-11 h-11 flex items-center justify-center rounded-xl ${cfg.status === "CONNECTED" ? "bg-[#eff4ff]" : "bg-slate-100"}`}>
                    <div className="text-2xl">{meta.icon}</div>
                  </div>
                  <span className={`px-2 py-0.5 ${sc.cls} text-[10px] font-[Manrope] font-bold rounded-full tracking-widest`}>{sc.label}</span>
                </div>
                <h3 className="text-[18px] font-serif font-semibold mb-1">{meta.title}</h3>
                <p className="text-[#45464d] text-xs mb-4 flex-1 font-[Manrope]">{meta.desc}</p>

                {testResult !== "idle" && (
                  <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-[Manrope] font-bold flex items-center gap-2 ${testResult === "testing" ? "bg-slate-50 text-slate-500" : testResult === "pass" ? "bg-emerald-50 text-[#006c49]" : "bg-red-50 text-red-600"}`}>
                    <div className={`text-sm ${testResult === "testing" ? "animate-spin" : ""}`}>{testResult === "testing" ? <MdRefresh /> : testResult === "pass" ? <MdCheckCircle /> : <MdError />}</div>
                    {testResult === "testing" ? "Testing…" : testResult === "pass" ? `Pass — ${cfg.latency}ms` : "Connection failed"}
                  </div>
                )}

                <div className="border-t border-slate-50 pt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[#818486] italic font-[Manrope]">
                      {isSyncing
                        ? <span className="text-[#006c49] font-bold flex items-center gap-1"><span className="material-symbols-outlined text-xs animate-spin">refresh</span>Syncing…</span>
                        : cfg.lastSync ? `Last sync: ${timeAgo(cfg.lastSync)}` : "Never synced"}
                    </span>
                    <Link href={meta.href} className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-black hover:text-[#006c49] transition-colors underline decoration-slate-200 underline-offset-4">MANAGE</Link>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button onClick={() => syncChannel(cfg.channelId)} disabled={cfg.status !== "CONNECTED" || isSyncing}
                      className="py-1.5 text-[10px] font-[Manrope] font-bold tracking-wider uppercase border border-slate-200 hover:border-[#006c49] hover:text-[#006c49] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-0.5 rounded">
                      <MdSync className={`text-xs ${isSyncing ? "animate-spin" : ""}`} /> Sync
                    </button>
                    <button onClick={() => testConnection(cfg.channelId)} disabled={testResult === "testing"}
                      className="py-1.5 text-[10px] font-[Manrope] font-bold tracking-wider uppercase border border-slate-200 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-0.5 rounded">
                      <MdNetworkPing className="text-xs" /> Test
                    </button>
                    <button onClick={() => cfg.status === "CONNECTED" ? toggleStatus(cfg.channelId) : testConnection(cfg.channelId)}
                      className={`py-1.5 text-[10px] font-[Manrope] font-bold tracking-wider uppercase transition-colors rounded ${cfg.status === "CONNECTED" ? "bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600" : "bg-[#6cf8bb] text-[#006c49] hover:bg-emerald-200"}`}>
                      {cfg.status === "CONNECTED" ? "Pause" : cfg.status === "PAUSED" ? "Resume" : "Connect"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabbed Panel */}
        <div className="bg-white shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
          <div className="flex border-b border-slate-100">
            {(["health", "events", "webhooks"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-8 py-4 font-[Manrope] font-bold text-xs tracking-widest uppercase transition-colors ${activeTab === tab ? "border-b-2 border-[#006c49] text-[#006c49]" : "text-[#7c839b] hover:text-black"}`}>
                {tab === "health" ? "Integration Health" : tab === "events" ? `Event Log (${events.length})` : "Webhooks"}
              </button>
            ))}
          </div>

          <div className="p-8">
            {activeTab === "health" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-[Manrope] text-xs text-[#7c839b]">Live from database</span>
                  <span className="font-[Manrope] font-bold text-xs text-[#006c49]">{connectedCount}/{configs.length} channels active</span>
                </div>
                {[
                  {
                    label: "API Response Time (avg)",
                    value: avgLatency > 0 ? `${avgLatency}ms` : "0ms",
                    bar: avgLatency > 0 ? Math.max(5, Math.min(100, Math.round(100 - avgLatency / 5))) : 0,
                    cls: avgLatency > 0 ? "bg-[#006c49]" : "bg-slate-300",
                  },
                  {
                    label: "Channel Operations Sync Rate",
                    value: syncRate !== null ? `${syncRate}% (${successfulSyncs}/${syncEvents.length})` : "No sync data",
                    bar: syncRate !== null ? syncRate : 0,
                    cls: syncRate !== null && syncRate >= 80 ? "bg-[#006c49]" : syncRate !== null ? "bg-amber-500" : "bg-slate-300",
                  },
                  {
                    label: "Active Webhooks Rate",
                    value: `${activeWebhooks}/${webhooks.length} active`,
                    bar: webhookRate,
                    cls: activeWebhooks > 0 ? "bg-[#006c49]" : "bg-slate-300",
                  },
                  {
                    label: "System Event Error Rate",
                    value: events.length > 0 ? `${errorRate}% (${totalErrors}/${events.length})` : "0.0% (0 errors)",
                    bar: events.length > 0 ? Math.min(100, Math.round((totalErrors / events.length) * 100)) : 0,
                    cls: totalErrors > 0 ? "bg-[#ba1a1a]" : "bg-[#006c49]",
                  },
                ].map((m) => (
                  <div key={m.label} className="flex items-center gap-4">
                    <span className="font-[Manrope] text-sm w-56 text-[#45464d] shrink-0">{m.label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${m.cls} rounded-full transition-all duration-700`} style={{ width: `${m.bar}%` }}></div>
                    </div>
                    <span className="font-[Manrope] font-bold text-sm w-24 text-right">{m.value}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "events" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex gap-2 flex-wrap">
                    {(["all", "sync", "info", "warning", "error"] as const).map((f) => (
                      <button key={f} onClick={() => setLogFilter(f)}
                        className={`px-3 py-1 text-[10px] font-[Manrope] font-bold uppercase tracking-widest rounded-full transition-all ${logFilter === f ? "bg-black text-white" : "bg-slate-100 text-[#7c839b] hover:bg-slate-200"}`}>{f}</button>
                    ))}
                  </div>
                  <button onClick={clearLogs} className="text-xs font-[Manrope] text-[#7c839b] hover:text-red-500 transition-colors flex items-center gap-1">
                    <MdDeleteSweep className="text-sm" /> Clear
                  </button>
                </div>
                {filteredLogs.length === 0
                  ? <div className="text-center py-12 text-[#7c839b] font-[Manrope]">No events to display.</div>
                  : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1 no-scrollbar">
                      {filteredLogs.map((log) => {
                        const s = logTypeStyle[log.type] ?? logTypeStyle.info;
                        return (
                          <div key={log.id} className="flex items-start gap-3 p-3 bg-[#f8f9ff] rounded-lg">
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${s.cls}`}>
                              <div className="text-sm">{s.icon}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-[Manrope] font-bold text-xs text-[#7c839b] uppercase tracking-widest">{log.channel}</span>
                              <p className="font-[Manrope] font-semibold text-sm text-[#0b1c30]">{log.event}</p>
                              <p className="font-[Manrope] text-xs text-[#7c839b]">{log.detail}</p>
                            </div>
                            <span className="font-[Manrope] text-xs text-[#7c839b] shrink-0">{timeAgo(log.createdAt)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>
            )}

            {activeTab === "webhooks" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <p className="font-[Manrope] text-sm text-[#7c839b]">Configure which store events push to your channel endpoints.</p>
                  <button onClick={() => showToast("Webhook settings saved.")}
                    className="px-5 py-2 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors rounded-sm flex items-center gap-2">
                    <MdSave className="text-sm" /> Save Config
                  </button>
                </div>
                <div className="space-y-3">
                  {webhooks.map((wh) => (
                    <div key={wh.webhookId} className="flex items-center justify-between p-4 bg-[#f8f9ff] rounded-lg">
                      <div>
                        <p className="font-[Manrope] font-bold text-sm text-[#0b1c30]">{wh.label}</p>
                        <code className="text-[11px] text-[#006c49] font-mono">{wh.url}</code>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => showToast(`Test ping sent to ${wh.url}`)}
                          className="text-xs font-[Manrope] font-bold text-[#7c839b] hover:text-blue-600 border border-slate-200 px-3 py-1 rounded transition-colors">Ping</button>
                        <button onClick={() => toggleWebhook(wh.webhookId, !wh.active)}
                          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${wh.active ? "bg-[#006c49]" : "bg-slate-300"}`}>
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${wh.active ? "translate-x-5" : "translate-x-0.5"}`}></span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
