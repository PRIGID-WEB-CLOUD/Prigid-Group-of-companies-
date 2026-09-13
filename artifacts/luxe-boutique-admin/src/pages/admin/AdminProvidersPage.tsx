import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MdCreditCard, MdLocalShipping, MdHelpOutline, MdContentCopy, MdCheckCircle, MdOpenInNew, MdLock } from "react-icons/md";
import AdminLayout from "./AdminLayout";
import PaymentSettingsManager from "../../components/PaymentSettingsManager";

type Provider = {
  id: string;
  name: string;
  label: string;
  description: string;
  logoUrl: string | null;
  enabled: boolean;
  connected: boolean;
  apiKeyConfigured: boolean;
  apiSecretConfigured: boolean;
  storeId: string | null;
  webhookUrl: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

type EproloProduct = {
  id?: string;
  productid?: string;
  title?: string;
  name?: string;
  cost?: number;
  price?: number;
  body_html?: string;
  description?: string;
  imagelist?: { src: string }[];
  product_type?: string;
  vendor?: string;
};

const PROVIDER_ICONS: Record<string, string> = {
  printful: "🖨️",
  eprolo:   "📦",
  shipbob:  "🚚",
  gooten:   "🏭",
  dhl:      "✈️",
};

const FULFILLMENT_LOGOS: Record<string, string> = {
  eprolo: "https://eprolo.com/wp-content/uploads/2021/04/logo.png",
  printful: "https://files.render.com/static/brand/printful.svg",
  shipbob: "https://www.shipbob.com/wp-content/uploads/2021/03/shipbob-logo.svg",
  gooten: "https://www.gooten.com/wp-content/uploads/2020/09/gooten-logo.svg",
  dhl: "https://upload.wikimedia.org/wikipedia/commons/a/ac/DHL_Logo.svg",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminProvidersPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"payments" | "fulfilment" | "help">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "fulfilment" || tab === "help") return tab;
    }
    return "payments";
  });

  const [activeProvider, setActiveProvider] = useState<Provider | null>(null);
  const [formKey, setFormKey]   = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formStore, setFormStore]   = useState("");
  const [testing, setTesting]   = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});

  // Eprolo catalog browser state
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browsePage, setBrowsePage] = useState(1);
  const [importing, setImporting] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const [copiedText, setCopiedText] = useState<string | null>(null);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "fulfilment" || tab === "help" || tab === "payments") {
        setActiveTab(tab);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const switchTab = (tab: "payments" | "fulfilment" | "help") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const { data: providers = [], isLoading } = useQuery<Provider[]>({
    queryKey: ["admin-providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers");
      if (!res.ok) throw new Error("Failed to load providers");
      return res.json();
    },
  });

  const { data: eproloProducts, isLoading: productsLoading, refetch: refetchProducts } = useQuery<EproloProduct[]>({
    queryKey: ["eprolo-products", browsePage],
    queryFn: async () => {
      const res = await fetch(`/api/eprolo/products?page_num=${browsePage}&page_size=12`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      const d = await res.json();
      return d.products ?? [];
    },
    enabled: browseOpen,
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ name, updates }: { name: string; updates: Record<string, unknown> }) => {
      const res = await fetch(`/api/providers/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-providers"] });
    },
  });

  const toggleEnabled = (p: Provider) => {
    saveMutation.mutate({ name: p.name, updates: { enabled: !p.enabled } });
  };

  const handleConnect = async (p: Provider) => {
    setTesting(p.name);
    try {
      const res = await fetch(`/api/providers/${p.name}/connect`, { method: "POST" });
      const data = await res.json();
      setTestResult(prev => ({
        ...prev,
        [p.name]: { ok: data.connected, msg: data.connected ? (data.message || "Connected successfully!") : (data.error || data.message || "Connection failed") },
      }));
      queryClient.invalidateQueries({ queryKey: ["admin-providers"] });
    } catch {
      setTestResult(prev => ({ ...prev, [p.name]: { ok: false, msg: "Connection test failed" } }));
    } finally {
      setTesting(null);
    }
  };

  const handleDisconnect = async (p: Provider) => {
    await fetch(`/api/providers/${p.name}/disconnect`, { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["admin-providers"] });
    setTestResult(prev => ({ ...prev, [p.name]: { ok: false, msg: "" } }));
  };

  const handleSaveKeys = () => {
    if (!activeProvider) return;
    saveMutation.mutate({
      name: activeProvider.name,
      updates: {
        apiKey:    formKey    || null,
        apiSecret: formSecret || null,
        storeId:   formStore  || null,
      },
    });
    setActiveProvider(null);
  };

  const openConfig = (p: Provider) => {
    setActiveProvider(p);
    setFormKey("");
    setFormSecret("");
    setFormStore(p.storeId ?? "");
  };

  const handleSyncInventory = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/eprolo/sync", { method: "POST" });
      const d = await res.json();
      setSyncResult(d.message ?? (d.ok ? "Synced!" : (d.error ?? "Sync failed")));
    } catch {
      setSyncResult("Sync request failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleImport = async (product: EproloProduct) => {
    const key = product.id ?? product.productid ?? "?";
    setImporting(key);
    try {
      const res = await fetch("/api/eprolo/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
      });
      const d = await res.json();
      setImportResults(prev => ({ ...prev, [key]: { ok: d.ok ?? false, msg: d.message ?? (d.error ?? "Failed") } }));
    } catch {
      setImportResults(prev => ({ ...prev, [key]: { ok: false, msg: "Request failed" } }));
    } finally {
      setImporting(null);
    }
  };

  const connected = providers.filter(p => p.connected).length;
  const enabled   = providers.filter(p => p.enabled).length;
  const eproloProvider = providers.find(p => p.name === "eprolo");

  return (
    <AdminLayout sidebar="main">
      <div className="p-4 sm:p-8 bg-[#f8f9ff] min-h-screen">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-[11px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mb-2">Integrations</p>
            <h1 className="text-3xl sm:text-[48px] font-serif font-bold leading-tight text-black">Providers</h1>
            <p className="text-sm font-[Manrope] text-[#45464d] mt-1">Manage payment gateways, fulfilment partners, and dropshipping integrations.</p>
          </div>
          <div className="flex items-center gap-6 text-center flex-wrap">
            <div>
              <p className="text-2xl sm:text-[32px] font-serif font-bold text-black leading-none">{connected}</p>
              <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mt-1">Fulfilment Live</p>
            </div>
            <div className="hidden sm:block w-px h-10 bg-[#e5eeff]" />
            <div>
              <p className="text-2xl sm:text-[32px] font-serif font-bold text-black leading-none">{enabled}</p>
              <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mt-1">Enabled</p>
            </div>
            <div className="hidden sm:block w-px h-10 bg-[#e5eeff]" />
            <div>
              <p className="text-2xl sm:text-[32px] font-serif font-bold text-black leading-none">{providers.length}</p>
              <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mt-1">Available</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-white border border-[#e5eeff] rounded-2xl shadow-sm mb-8 max-w-2xl flex-wrap">
          <button
            type="button"
            onClick={() => switchTab("payments")}
            className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-[Manrope] font-bold uppercase tracking-wider transition-all ${
              activeTab === "payments"
                ? "bg-black text-white shadow-sm"
                : "text-[#45464d] hover:text-black hover:bg-[#f8f9ff]"
            }`}
          >
            <MdCreditCard className="text-base" />
            <span>Payment Gateways</span>
          </button>
          <button
            type="button"
            onClick={() => switchTab("fulfilment")}
            className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-[Manrope] font-bold uppercase tracking-wider transition-all ${
              activeTab === "fulfilment"
                ? "bg-black text-white shadow-sm"
                : "text-[#45464d] hover:text-black hover:bg-[#f8f9ff]"
            }`}
          >
            <MdLocalShipping className="text-base" />
            <span>Fulfilment &amp; Dropshipping</span>
          </button>
          <button
            type="button"
            onClick={() => switchTab("help")}
            className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-[Manrope] font-bold uppercase tracking-wider transition-all ${
              activeTab === "help"
                ? "bg-black text-white shadow-sm"
                : "text-[#45464d] hover:text-black hover:bg-[#f8f9ff]"
            }`}
          >
            <MdHelpOutline className="text-base text-amber-400" />
            <span>Setup Guide &amp; Docs</span>
          </button>
        </div>

        {/* Tab 1: Payment Gateways */}
        {activeTab === "payments" && (
          <div className="space-y-6">
            <PaymentSettingsManager />
          </div>
        )}

        {/* Tab 3: Setup Guide & Docs */}
        {activeTab === "help" && (
          <div className="space-y-8 max-w-5xl">
            {/* Overview Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-md">
              <div className="flex items-start justify-between gap-4 flex-col md:flex-row md:items-center">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-[Manrope] font-bold uppercase tracking-wider mb-3 border border-amber-400/30">
                    <MdHelpOutline className="text-sm" /> Provider Integration Architecture
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-2">Payment Gateway Documentation</h2>
                  <p className="text-xs sm:text-sm font-[Manrope] text-slate-300 max-w-2xl leading-relaxed">
                    Learn how 1-Click OAuth2 App Install and manual API key connections work. Platform developers configure master app credentials in environment variables, allowing sellers to authorize accounts seamlessly without handling sensitive keys directly.
                  </p>
                </div>
                <button
                  onClick={() => switchTab("payments")}
                  className="shrink-0 px-5 py-3 bg-white text-slate-900 rounded-xl font-[Manrope] font-bold text-xs uppercase tracking-wider hover:bg-amber-400 transition-all flex items-center gap-2 shadow"
                >
                  <MdCreditCard className="text-base" /> Go to Payment Settings
                </button>
              </div>
            </div>

            {/* Platform Developer Env Setup Reference */}
            <div className="bg-white rounded-2xl p-6 border border-[#e5eeff] shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">1</span>
                  <h3 className="font-serif font-bold text-lg text-slate-900">Platform Developer Environment Variables (.env)</h3>
                </div>
                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold">Server Environment Config</span>
              </div>
              <p className="text-xs font-[Manrope] text-slate-600 mb-4 leading-relaxed">
                When these variables are configured by the system administrator, store owners can connect Stripe, Paystack, or Flutterwave via 1-Click OAuth2 authentication without manual key entry:
              </p>
              <div className="relative bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-200 overflow-x-auto border border-slate-800">
                <button
                  onClick={() => copyToClipboard(`STRIPE_CLIENT_ID=ca_...\nSTRIPE_SECRET_KEY=sk_live_...\nSTRIPE_WEBHOOK_SECRET=whsec_...\n\nPAYSTACK_CLIENT_ID=...\nPAYSTACK_SECRET_KEY=sk_live_...\n\nFLUTTERWAVE_CLIENT_ID=...\nFLUTTERWAVE_SECRET_KEY=FLWSECK_PLIF-...\n\nPAYPAL_CLIENT_ID=...\nPAYPAL_CLIENT_SECRET=...`, "env_block")}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-[Manrope] font-bold flex items-center gap-1 transition-all"
                >
                  {copiedText === "env_block" ? <><MdCheckCircle className="text-emerald-400 text-xs" /> Copied!</> : <><MdContentCopy className="text-xs" /> Copy .env snippet</>}
                </button>
                <pre className="text-[11px] leading-relaxed">
{`# Stripe Connect OAuth & Secret
STRIPE_CLIENT_ID=ca_1234567890abcdef
STRIPE_SECRET_KEY=sk_live_51...
STRIPE_WEBHOOK_SECRET=whsec_...

# Paystack OAuth & API Keys
PAYSTACK_CLIENT_ID=paystack_client_id
PAYSTACK_SECRET_KEY=sk_live_...

# Flutterwave OAuth & API Keys
FLUTTERWAVE_CLIENT_ID=flw_client_id
FLUTTERWAVE_SECRET_KEY=FLWSECK_PLIF-...

# PayPal REST API Credentials
PAYPAL_CLIENT_ID=A...
PAYPAL_CLIENT_SECRET=E...`}
                </pre>
              </div>
            </div>

            {/* Provider Detailed Step-by-Step Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* ── 1. STRIPE ── */}
              <div className="bg-white rounded-2xl border border-indigo-100 p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#635BFF]/10 text-[#635BFF] flex items-center justify-center font-serif font-bold text-lg">
                        S
                      </div>
                      <div>
                        <h4 className="font-serif font-bold text-lg text-slate-900">Stripe Configuration</h4>
                        <p className="text-[11px] font-[Manrope] text-slate-500">Global credit/debit cards, Apple Pay &amp; Google Pay</p>
                      </div>
                    </div>
                    <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="text-xs font-[Manrope] text-[#635BFF] font-bold hover:underline flex items-center gap-1">
                      Dashboard <MdOpenInNew className="text-xs" />
                    </a>
                  </div>

                  <ol className="space-y-3 text-xs font-[Manrope] text-slate-600 mb-6">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span><strong>Log in</strong> to your <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className="text-[#635BFF] underline">Stripe Dashboard</a>.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span><strong>1-Click Install:</strong> Click <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">Connect with stripe</code> on the Payment Gateways tab. Authorize access to link your merchant account instantly.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span><strong>Manual Setup (Alternative):</strong> Go to <em>Developers → API keys</em>. Copy your <strong>Publishable key</strong> (<code className="bg-slate-100 px-1 font-mono text-[10px]">pk_live_...</code>) and <strong>Secret key</strong> (<code className="bg-slate-100 px-1 font-mono text-[10px]">sk_live_...</code>).</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">4</span>
                      <span><strong>Webhooks:</strong> Set Webhook URL to:</span>
                    </li>
                  </ol>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-700 break-all select-all">
                    <span>{typeof window !== "undefined" ? window.location.origin : ""}/api/payments/webhooks/stripe</span>
                    <button onClick={() => copyToClipboard(`${window.location.origin}/api/payments/webhooks/stripe`, "wh_stripe")} className="text-slate-500 hover:text-slate-900 p-1 shrink-0">
                      {copiedText === "wh_stripe" ? <MdCheckCircle className="text-emerald-500 text-sm" /> : <MdContentCopy className="text-xs" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── 2. PAYSTACK ── */}
              <div className="bg-white rounded-2xl border border-sky-100 p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#0BA4DB]/10 text-[#0BA4DB] flex items-center justify-center font-serif font-bold text-lg">
                        P
                      </div>
                      <div>
                        <h4 className="font-serif font-bold text-lg text-slate-900">Paystack Configuration</h4>
                        <p className="text-[11px] font-[Manrope] text-slate-500">Cards, Bank Transfer &amp; USSD (NGN, GHS, ZAR, KES, USD)</p>
                      </div>
                    </div>
                    <a href="https://dashboard.paystack.com/#/settings/developer" target="_blank" rel="noreferrer" className="text-xs font-[Manrope] text-[#0BA4DB] font-bold hover:underline flex items-center gap-1">
                      Dashboard <MdOpenInNew className="text-xs" />
                    </a>
                  </div>

                  <ol className="space-y-3 text-xs font-[Manrope] text-slate-600 mb-6">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span><strong>Log in</strong> to your <a href="https://dashboard.paystack.com" target="_blank" rel="noreferrer" className="text-[#0BA4DB] underline">Paystack Dashboard</a>.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>Go to <em>Settings → API Keys &amp; Webhooks</em>.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>Copy your <strong>Public Key</strong> (<code className="bg-slate-100 px-1 font-mono text-[10px]">pk_live_...</code>) and <strong>Secret Key</strong> (<code className="bg-slate-100 px-1 font-mono text-[10px]">sk_live_...</code>).</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">4</span>
                      <span>Paste credentials into <strong>Manual Key Entry</strong> or click 1-Click Connect. Set Webhook URL:</span>
                    </li>
                  </ol>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-700 break-all select-all">
                    <span>{typeof window !== "undefined" ? window.location.origin : ""}/api/payments/webhooks/paystack</span>
                    <button onClick={() => copyToClipboard(`${window.location.origin}/api/payments/webhooks/paystack`, "wh_paystack")} className="text-slate-500 hover:text-slate-900 p-1 shrink-0">
                      {copiedText === "wh_paystack" ? <MdCheckCircle className="text-emerald-500 text-sm" /> : <MdContentCopy className="text-xs" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── 3. FLUTTERWAVE ── */}
              <div className="bg-white rounded-2xl border border-amber-100 p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#FB9129]/10 text-[#FB9129] flex items-center justify-center font-serif font-bold text-lg">
                        F
                      </div>
                      <div>
                        <h4 className="font-serif font-bold text-lg text-slate-900">Flutterwave Configuration</h4>
                        <p className="text-[11px] font-[Manrope] text-slate-500">Pan-African Multi-Currency Cards, MPesa &amp; Mobile Money</p>
                      </div>
                    </div>
                    <a href="https://dashboard.flutterwave.com/settings/apis" target="_blank" rel="noreferrer" className="text-xs font-[Manrope] text-[#FB9129] font-bold hover:underline flex items-center gap-1">
                      Dashboard <MdOpenInNew className="text-xs" />
                    </a>
                  </div>

                  <ol className="space-y-3 text-xs font-[Manrope] text-slate-600 mb-6">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span><strong>Log in</strong> to your <a href="https://dashboard.flutterwave.com" target="_blank" rel="noreferrer" className="text-[#FB9129] underline">Flutterwave Dashboard</a>.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>Navigate to <em>Settings → API Keys</em>.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>Copy your <strong>Public Key</strong> (<code className="bg-slate-100 px-1 font-mono text-[10px]">FLWPUBK_PLIF-...</code>) and <strong>Secret Key</strong> (<code className="bg-slate-100 px-1 font-mono text-[10px]">FLWSECK_PLIF-...</code>).</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">4</span>
                      <span>Enter Secret Hash / Webhook URL in Flutterwave dashboard:</span>
                    </li>
                  </ol>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-700 break-all select-all">
                    <span>{typeof window !== "undefined" ? window.location.origin : ""}/api/payments/webhooks/flutterwave</span>
                    <button onClick={() => copyToClipboard(`${window.location.origin}/api/payments/webhooks/flutterwave`, "wh_flw")} className="text-slate-500 hover:text-slate-900 p-1 shrink-0">
                      {copiedText === "wh_flw" ? <MdCheckCircle className="text-emerald-500 text-sm" /> : <MdContentCopy className="text-xs" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── 4. PAYPAL ── */}
              <div className="bg-white rounded-2xl border border-blue-100 p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-serif font-bold text-lg">
                        P
                      </div>
                      <div>
                        <h4 className="font-serif font-bold text-lg text-slate-900">PayPal Configuration</h4>
                        <p className="text-[11px] font-[Manrope] text-slate-500">PayPal Express Checkout &amp; Pay in 4</p>
                      </div>
                    </div>
                    <a href="https://developer.paypal.com/dashboard/applications" target="_blank" rel="noreferrer" className="text-xs font-[Manrope] text-blue-600 font-bold hover:underline flex items-center gap-1">
                      Developer Portal <MdOpenInNew className="text-xs" />
                    </a>
                  </div>

                  <ol className="space-y-3 text-xs font-[Manrope] text-slate-600 mb-6">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span><strong>Log in</strong> to the <a href="https://developer.paypal.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">PayPal Developer Portal</a>.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>Go to <em>Apps &amp; Credentials</em> and select <strong>Live</strong> mode (or Sandbox for testing).</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>Create an app or select an existing one to view your <strong>Client ID</strong> and <strong>Client Secret</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">4</span>
                      <span>Open <strong>Payment Gateways → PayPal → Manual Entry</strong>, paste your Client ID and Secret, then save.</span>
                    </li>
                  </ol>
                </div>

                <div className="p-3 bg-[#eff4ff] rounded-xl border border-blue-100 flex items-center gap-2 text-xs font-[Manrope] text-blue-900 font-medium">
                  <MdLock className="text-blue-600 text-sm shrink-0" />
                  <span>Credentials are encrypted server-side with AES-256-GCM before DB saving.</span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 2: Fulfilment & Dropshipping */}
        {activeTab === "fulfilment" && (
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {providers.filter(p => !["stripe", "paystack", "flutterwave", "paypal"].includes(p.name)).map(p => {
                  const result = testResult[p.name];
                  const isConnecting = testing === p.name;
                  const isEprolo = p.name === "eprolo";
                  return (
                    <div key={p.name} className={`bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] overflow-hidden ${isEprolo ? "lg:col-span-2" : ""}`}>
                      <div className="p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1.5 shrink-0">
                              {p.logoUrl || FULFILLMENT_LOGOS[p.name] ? (
                                <img
                                  src={p.logoUrl || FULFILLMENT_LOGOS[p.name]}
                                  alt={p.label}
                                  className="w-8 h-8 object-contain"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <span className="text-2xl">{PROVIDER_ICONS[p.name] ?? "🔌"}</span>
                              )}
                            </div>
                            <div>
                              <h3 className="text-[17px] font-serif font-semibold text-black">{p.label}</h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-[Manrope] font-bold uppercase tracking-widest ${
                                  p.connected ? "text-[#006c49] bg-[#e6f7f1]" : "text-[#7c839b] bg-[#f8f9ff]"
                                }`}>
                                  <span className="material-symbols-outlined text-[12px]">{p.connected ? "check_circle" : "radio_button_unchecked"}</span>
                                  {p.connected ? "Connected" : "Disconnected"}
                                </span>
                                {p.enabled && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-blue-600 bg-blue-50">
                                    <span className="material-symbols-outlined text-[12px]">power</span>
                                    Enabled
                                  </span>
                                )}
                                {isEprolo && p.connected && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-purple-600 bg-purple-50">
                                    <span className="material-symbols-outlined text-[12px]">inventory_2</span>
                                    Dropshipping
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Enable toggle */}
                          <button
                            type="button"
                            onClick={() => toggleEnabled(p)}
                            className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${p.enabled ? "bg-[#006c49]" : "bg-[#c6c6cd]"}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${p.enabled ? "right-0.5" : "left-0.5"}`} />
                          </button>
                        </div>

                        <p className="text-[13px] font-[Manrope] text-[#45464d] leading-relaxed mb-4">{p.description}</p>

                        {/* Result banner */}
                        {result?.msg && (
                          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-xs font-[Manrope] font-bold ${
                            result.ok ? "bg-[#e6f7f1] text-[#006c49]" : "bg-[#ffdad6] text-[#ba1a1a]"
                          }`}>
                            <span className="material-symbols-outlined text-sm">{result.ok ? "check_circle" : "error"}</span>
                            {result.msg}
                          </div>
                        )}

                        {/* Sync result */}
                        {isEprolo && syncResult && (
                          <div className="mb-4 p-3 rounded-lg bg-[#eff4ff] text-[#1a3bb3] text-xs font-[Manrope] font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">sync</span>
                            {syncResult}
                          </div>
                        )}

                        {/* Error from last attempt */}
                        {p.lastError && !result && (
                          <div className="mb-4 p-3 rounded-lg bg-[#ffdad6] text-[#ba1a1a] text-xs font-[Manrope]">
                            Last error: {p.lastError}
                          </div>
                        )}

                        {/* Last sync */}
                        {p.lastSyncAt && (
                          <p className="text-[11px] font-[Manrope] text-[#7c839b] mb-4">
                            Last synced: {fmtDate(p.lastSyncAt)}
                          </p>
                        )}

                        {/* Credential indicator */}
                        {isEprolo && (p.apiKeyConfigured || p.apiSecretConfigured) && (
                          <div className="flex items-center gap-3 mb-4 p-3 bg-[#f8f9ff] rounded-lg">
                            <div className="flex items-center gap-1.5 text-[11px] font-[Manrope] text-[#45464d]">
                              <span className="material-symbols-outlined text-[14px] text-[#006c49]">key</span>
                               API Key: <code className="font-mono">{p.apiKeyConfigured ? "Configured" : "—"}</code>
                            </div>
                            <div className="w-px h-4 bg-[#e5eeff]" />
                            <div className="flex items-center gap-1.5 text-[11px] font-[Manrope] text-[#45464d]">
                              <span className="material-symbols-outlined text-[14px] text-[#006c49]">lock</span>
                               Secret: {p.apiSecretConfigured ? "Configured" : "—"}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => openConfig(p)}
                            className="px-4 py-2 border border-[#c6c6cd] font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#eff4ff] transition-all rounded-lg flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">settings</span>
                            Configure
                          </button>
                          {p.connected ? (
                            <>
                              <button onClick={() => handleConnect(p)} disabled={isConnecting}
                                className="px-4 py-2 border border-[#c6c6cd] font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#e6f7f1] hover:text-[#006c49] hover:border-[#006c49] transition-all rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                                <span className={`material-symbols-outlined text-sm ${isConnecting ? "animate-spin" : ""}`}>{isConnecting ? "autorenew" : "sync"}</span>
                                {isConnecting ? "Testing…" : "Re-test"}
                              </button>
                              {isEprolo && (
                                <>
                                  <button onClick={handleSyncInventory} disabled={syncing}
                                    className="px-4 py-2 border border-purple-200 text-purple-700 font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-purple-50 transition-all rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                                    <span className={`material-symbols-outlined text-sm ${syncing ? "animate-spin" : ""}`}>{syncing ? "autorenew" : "inventory_2"}</span>
                                    {syncing ? "Syncing…" : "Sync Stock"}
                                  </button>
                                  <button onClick={() => { setBrowseOpen(true); setBrowsePage(1); refetchProducts(); }}
                                    className="px-4 py-2 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-purple-700 transition-all rounded-lg flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm">shopping_bag</span>
                                    Browse Catalog
                                  </button>
                                </>
                              )}
                              <button onClick={() => handleDisconnect(p)}
                                className="px-4 py-2 border border-[#ba1a1a]/30 text-[#ba1a1a] font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#ffdad6] transition-all rounded-lg flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm">link_off</span>
                                Disconnect
                              </button>
                            </>
                          ) : (
                            <button onClick={() => handleConnect(p)} disabled={isConnecting || !p.apiKeyConfigured}
                              className="px-4 py-2 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-all rounded-lg flex items-center gap-1.5 disabled:opacity-40">
                              <span className={`material-symbols-outlined text-sm ${isConnecting ? "animate-spin" : ""}`}>{isConnecting ? "autorenew" : "link"}</span>
                              {isConnecting ? "Connecting…" : p.apiKeyConfigured ? "Connect" : "Add API Key First"}
                            </button>
                          )}
                        </div>

                        {/* Eprolo webhook hint */}
                        {isEprolo && p.connected && (
                          <div className="mt-4 p-3 bg-[#f8f9ff] rounded-lg border border-[#e5eeff]">
                            <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mb-1">Webhook URL</p>
                            <div className="flex items-center justify-between text-[11px] font-mono text-[#45464d] break-all select-all">
                              <span>{typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/eprolo</span>
                              <button onClick={() => copyToClipboard(`${window.location.origin}/api/webhooks/eprolo`, "wh_eprolo")} className="text-slate-500 hover:text-slate-900 p-1 shrink-0 ml-2">
                                {copiedText === "wh_eprolo" ? <MdCheckCircle className="text-emerald-500 text-sm" /> : <MdContentCopy className="text-xs" />}
                              </button>
                            </div>
                            <p className="text-[10px] font-[Manrope] text-[#7c839b] mt-1">Register this in your Eprolo dashboard to receive tracking updates automatically.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Configure Modal */}
        {activeProvider && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[20px] font-serif font-bold text-black">
                  Configure {activeProvider.label}
                </h3>
                <button onClick={() => setActiveProvider(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#f8f9ff] transition-colors">
                  <span className="material-symbols-outlined text-[#45464d]">close</span>
                </button>
              </div>

              {activeProvider.name === "eprolo" && (
                <div className="mb-5 p-3 bg-[#eff4ff] rounded-lg text-[11px] font-[Manrope] text-[#1a3bb3] leading-relaxed">
                  <strong>Where to find your keys:</strong> Log in to your Eprolo account → Settings → API Management. Copy your <strong>API Key</strong> and <strong>API Secret</strong> and paste them below.
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1.5">
                    API Key <span className="text-[#ba1a1a]">*</span>
                  </label>
                  <input
                    type="password"
                    className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-2.5 font-[Manrope] text-sm outline-none focus:border-black transition-colors"
                     placeholder={activeProvider.apiKeyConfigured ? "Leave blank to keep current" : "Enter API key…"}
                    value={formKey}
                    onChange={e => setFormKey(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1.5">
                    API Secret {activeProvider.name === "eprolo" && <span className="text-[#ba1a1a]">*</span>}
                  </label>
                  <input
                    type="password"
                    className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-2.5 font-[Manrope] text-sm outline-none focus:border-black transition-colors"
                     placeholder={activeProvider.apiSecretConfigured ? "Leave blank to keep current" : "Enter API secret…"}
                    value={formSecret}
                    onChange={e => setFormSecret(e.target.value)}
                  />
                </div>
                {activeProvider.name !== "eprolo" && (
                  <div>
                    <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1.5">
                      Store ID
                    </label>
                    <input
                      className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-2.5 font-[Manrope] text-sm outline-none focus:border-black transition-colors"
                      placeholder="e.g. 12345678"
                      value={formStore}
                      onChange={e => setFormStore(e.target.value)}
                    />
                  </div>
                )}
                <div className="pt-2 flex gap-3">
                  <button onClick={() => setActiveProvider(null)}
                    className="flex-1 px-6 py-3 border border-[#c6c6cd] font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#f8f9ff] transition-all rounded-lg">
                    Cancel
                  </button>
                  <button onClick={handleSaveKeys} disabled={saveMutation.isPending}
                    className="flex-1 px-6 py-3 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-all rounded-lg shadow disabled:opacity-50">
                    {saveMutation.isPending ? "Saving…" : "Save Keys"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Eprolo Catalog Browser */}
        {browseOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#e5eeff]">
                <div>
                  <h3 className="text-[22px] font-serif font-bold text-black">Eprolo Catalog</h3>
                  <p className="text-xs font-[Manrope] text-[#7c839b] mt-0.5">Browse products and import them directly into your store.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-[Manrope] text-[#7c839b]">Page {browsePage}</span>
                  <button onClick={() => setBrowsePage(p => Math.max(1, p - 1))} disabled={browsePage <= 1}
                    className="w-8 h-8 rounded-lg border border-[#c6c6cd] flex items-center justify-center hover:bg-[#f8f9ff] disabled:opacity-40 transition-colors">
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  <button onClick={() => setBrowsePage(p => p + 1)}
                    className="w-8 h-8 rounded-lg border border-[#c6c6cd] flex items-center justify-center hover:bg-[#f8f9ff] transition-colors">
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                  <button onClick={() => setBrowseOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#f8f9ff] transition-colors ml-2">
                    <span className="material-symbols-outlined text-[#45464d]">close</span>
                  </button>
                </div>
              </div>

              {/* Product grid */}
              <div className="flex-1 overflow-y-auto p-6">
                {productsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : !eproloProducts || eproloProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <span className="material-symbols-outlined text-5xl text-[#c6c6cd] mb-3">inventory_2</span>
                    <p className="font-[Manrope] text-[#45464d] font-bold">No products found</p>
                    <p className="font-[Manrope] text-[#7c839b] text-sm mt-1">Make sure your API key and secret are correct and you're connected.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {eproloProducts.map((product) => {
                      const productKey = String(product.id ?? product.productid ?? Math.random());
                      const imgSrc = product.imagelist?.[0]?.src;
                      const importResult = importResults[productKey];
                      const isImporting = importing === productKey;
                      return (
                        <div key={productKey} className="bg-[#f8f9ff] rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                          <div className="aspect-square bg-[#e5eeff] overflow-hidden">
                            {imgSrc ? (
                              <img src={imgSrc} alt={product.title ?? product.name ?? ""} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-xs font-[Manrope] font-bold text-black line-clamp-2 mb-1">
                              {product.title ?? product.name ?? "Unnamed Product"}
                            </p>
                            {(product.cost ?? product.price) && (
                              <p className="text-[11px] font-[Manrope] text-[#006c49] font-bold mb-2">
                                ${Number(product.cost ?? product.price).toFixed(2)}
                              </p>
                            )}
                            {importResult ? (
                              <div className={`text-[10px] font-[Manrope] font-bold px-2 py-1 rounded-md ${importResult.ok ? "bg-[#e6f7f1] text-[#006c49]" : "bg-[#ffdad6] text-[#ba1a1a]"}`}>
                                {importResult.ok ? "✓ Imported" : importResult.msg}
                              </div>
                            ) : (
                              <button onClick={() => handleImport(product)} disabled={isImporting}
                                className="w-full px-3 py-1.5 bg-black text-white text-[10px] font-[Manrope] font-bold uppercase tracking-widest rounded-lg hover:bg-[#006c49] transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                                <span className={`material-symbols-outlined text-[12px] ${isImporting ? "animate-spin" : ""}`}>{isImporting ? "autorenew" : "add"}</span>
                                {isImporting ? "Importing…" : "Import"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
