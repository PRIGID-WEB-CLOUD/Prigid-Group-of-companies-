import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MdCreditCard,
  MdCheckCircle,
  MdRadioButtonUnchecked,
  MdRefresh,
  MdDeleteForever,
  MdShield,
  MdLock,
  MdOpenInNew,
  MdContentCopy,
  MdWarning,
  MdCheck,
  MdHistory,
  MdOutlineAccountBalance,
  MdReceiptLong,
  MdSettings,
  MdAdd,
  MdClose,
  MdAutorenew,
} from "react-icons/md";
import { SiStripe } from "react-icons/si";

interface ProviderItem {
  id: string;
  provider: "stripe" | "paystack" | "flutterwave";
  name: string;
  logoUrl?: string | null;
  status: "NOT_CONNECTED" | "CONNECTING" | "CONNECTED" | "FAILED" | "EXPIRED" | "REAUTHORIZATION_REQUIRED" | "DISCONNECTED";
  isConnected: boolean;
  isPlatformConfigured: boolean;
  isActive: boolean;
  capabilities: {
    supportsOAuth: boolean;
    supportsDirectKey: boolean;
    supportsRefunds: boolean;
    supportsWebhooks: boolean;
    supportedCurrencies: string[];
  };
  accountId: string | null;
  accountName: string | null;
  accountEmail: string | null;
  accountCurrency: string | null;
  livemode: boolean;
  hasPublishableKey: boolean;
  tokenExpiresAt: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
}

interface AuditLog {
  id: string;
  action: string;
  provider: string;
  details: Record<string, any>;
  ipAddress: string | null;
  createdAt: string;
}

interface Transaction {
  id: string;
  reference: string;
  orderId: string | null;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  email: string;
  createdAt: string;
  verifiedAt: string | null;
}

const FALLBACK_PAYMENT_PROVIDERS: ProviderItem[] = [
  {
    id: "prov_stripe",
    provider: "stripe",
    name: "Stripe",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg",
    status: "NOT_CONNECTED",
    isConnected: false,
    isPlatformConfigured: true,
    isActive: true,
    capabilities: {
      supportsOAuth: true,
      supportsDirectKey: true,
      supportsRefunds: true,
      supportsWebhooks: true,
      supportedCurrencies: ["USD", "EUR", "GBP", "CAD"],
    },
    accountId: null,
    accountName: null,
    accountEmail: null,
    accountCurrency: "USD",
    livemode: false,
    hasPublishableKey: false,
    tokenExpiresAt: null,
    connectedAt: null,
    lastSyncedAt: null,
  },
  {
    id: "prov_paystack",
    provider: "paystack",
    name: "Paystack",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Paystack_Logo.png",
    status: "NOT_CONNECTED",
    isConnected: false,
    isPlatformConfigured: true,
    isActive: false,
    capabilities: {
      supportsOAuth: true,
      supportsDirectKey: true,
      supportsRefunds: true,
      supportsWebhooks: true,
      supportedCurrencies: ["NGN", "GHS", "ZAR", "KES", "USD"],
    },
    accountId: null,
    accountName: null,
    accountEmail: null,
    accountCurrency: "NGN",
    livemode: false,
    hasPublishableKey: false,
    tokenExpiresAt: null,
    connectedAt: null,
    lastSyncedAt: null,
  },
  {
    id: "prov_flutterwave",
    provider: "flutterwave",
    name: "Flutterwave",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e1/Flutterwave_Logo.png",
    status: "NOT_CONNECTED",
    isConnected: false,
    isPlatformConfigured: true,
    isActive: false,
    capabilities: {
      supportsOAuth: true,
      supportsDirectKey: true,
      supportsRefunds: true,
      supportsWebhooks: true,
      supportedCurrencies: ["USD", "NGN", "GHS", "KES", "ZAR"],
    },
    accountId: null,
    accountName: null,
    accountEmail: null,
    accountCurrency: "USD",
    livemode: false,
    hasPublishableKey: false,
    tokenExpiresAt: null,
    connectedAt: null,
    lastSyncedAt: null,
  },
];

export default function PaymentSettingsManager() {
  const queryClient = useQueryClient();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [refundTx, setRefundTx] = useState<Transaction | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [bannerNotice, setBannerNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check URL params for OAuth status returns
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const provider = params.get("provider");
    const error = params.get("error");

    if (status === "connected" && provider) {
      setBannerNotice({
        type: "success",
        text: `Successfully installed and connected ${provider.toUpperCase()} via OAuth2! Your store can now process customer payments directly to your merchant account.`,
      });
      const targetQuery = window.location.pathname.includes("providers") ? "?tab=payments" : "?section=payments";
      window.history.replaceState({}, document.title, window.location.pathname + targetQuery);
    } else if (error) {
      setBannerNotice({
        type: "error",
        text: `Payment connection error: ${decodeURIComponent(error)}`,
      });
      const targetQuery = window.location.pathname.includes("providers") ? "?tab=payments" : "?section=payments";
      window.history.replaceState({}, document.title, window.location.pathname + targetQuery);
    }
  }, []);

  // ── Queries ──
  const { data: providersData, isLoading: providersLoading, refetch: refetchProviders } = useQuery<{
    activeProvider: string;
    storeCurrency: string;
    providers: ProviderItem[];
  }>({
    queryKey: ["payment-providers"],
    queryFn: async () => {
      const res = await fetch("/api/payments/providers");
      if (!res.ok) throw new Error("Failed to load providers");
      return res.json();
    },
  });

  // Listen for success or error message from the popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith(".run.app") && !origin.includes("localhost")) {
        return;
      }

      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        const providerName = event.data.provider;
        setBannerNotice({
          type: "success",
          text: `Successfully installed and connected ${providerName?.toUpperCase()} via OAuth2! Your store can now process customer payments directly to your merchant account.`,
        });
        refetchProviders();
        setConnectingProvider(null);
      } else if (event.data?.type === "OAUTH_AUTH_ERROR") {
        const errorMsg = event.data.error;
        setBannerNotice({
          type: "error",
          text: `Payment connection error: ${decodeURIComponent(errorMsg)}`,
        });
        setConnectingProvider(null);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [refetchProviders]);

  const { data: auditLogs = [], refetch: refetchLogs } = useQuery<AuditLog[]>({
    queryKey: ["payment-audit-logs"],
    queryFn: async () => {
      const res = await fetch("/api/payments/audit-logs");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: transactions = [], refetch: refetchTransactions } = useQuery<Transaction[]>({
    queryKey: ["payment-transactions"],
    queryFn: async () => {
      const res = await fetch("/api/payments/transactions");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // ── Mutations ──
  const setActiveMutation = useMutation({
    mutationFn: async ({ provider, connectionId }: { provider: string; connectionId?: string }) => {
      const res = await fetch(`/api/payments/providers/${provider}/set-active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to toggle provider status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-providers"] });
      setBannerNotice({ type: "success", text: "Payment provider checkout configuration updated successfully." });
    },
    onError: (err: any) => {
      setBannerNotice({ type: "error", text: err.message });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async ({ provider, connectionId }: { provider: string; connectionId?: string }) => {
      const res = await fetch(`/api/payments/providers/${provider}/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to disconnect provider");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payment-providers"] });
      queryClient.invalidateQueries({ queryKey: ["payment-audit-logs"] });
      setBannerNotice({ type: "success", text: `${variables.provider.toUpperCase()} has been disconnected.` });
    },
    onError: (err: any) => {
      setBannerNotice({ type: "error", text: err.message });
    },
  });

  const refundMutation = useMutation({
    mutationFn: async ({ reference, reason }: { reference: string; reason: string }) => {
      const res = await fetch("/api/payments/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, reason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to issue refund");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["payment-audit-logs"] });
      setRefundTx(null);
      setRefundReason("");
      setBannerNotice({ type: "success", text: "Refund processed successfully with the payment gateway." });
    },
    onError: (err: any) => {
      setBannerNotice({ type: "error", text: err.message });
    },
  });

  const handleOAuthConnect = async (provider: ProviderItem) => {
    // Open popup immediately in response to user action to prevent browser popup blockers
    const authWindow = window.open("", "oauth_popup", "width=600,height=700");
    if (!authWindow) {
      setBannerNotice({
        type: "error",
        text: "Popup blocked! Please allow popups for this site to connect your Stripe account.",
      });
      return;
    }

    setConnectingProvider(provider.provider);
    try {
      const currentPath = window.location.pathname || "/providers";
      const returnUrl = currentPath.startsWith("/seller")
        ? currentPath + (window.location.search || "?tab=payments")
        : `/seller${currentPath.startsWith("/") ? "" : "/"}${currentPath}${window.location.search || "?tab=payments"}`;

      const res = await fetch(`/api/payments/providers/${provider.provider}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirectUri: `${window.location.origin}/api/payments/oauth/callback`,
          returnUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.authorizationUrl) {
        throw new Error(data.error || data.message || "Could not generate authorization URL.");
      }
      
      // Redirect popup directly to the OAuth authorization URL
      authWindow.location.href = data.authorizationUrl;
    } catch (err: any) {
      authWindow.close();
      setBannerNotice({
        type: "error",
        text: err.message || `Failed to initiate ${provider.provider} connection. Please check platform environment variables.`,
      });
      setConnectingProvider(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getProviderIcon = (provider: string, logoUrl?: string | null) => {
    switch (provider.toLowerCase()) {
      case "stripe":
        return (
          <div className="w-10 h-10 rounded-xl bg-[#635BFF] flex items-center justify-center text-white shadow-sm overflow-hidden">
            <svg className="w-6 h-6" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M59.64 14.28c0-4.52-2.18-8.11-6.72-8.11-4.55 0-7.44 3.59-7.44 8.08 0 5.3 3.42 8.04 7.9 8.04 2.29 0 4.19-.51 5.48-1.22v-3.32c-1.29.68-2.92 1.09-4.7 1.09-1.89 0-3.51-.71-3.73-2.98h9.16c.03-.4.05-1.18.05-1.58zm-9.13-1.63c.12-1.82 1.48-2.6 2.76-2.6 1.25 0 2.58.78 2.58 2.60h-5.34zm-8.24-6.48c-1.82 0-3.03.88-3.6 1.45l-.25-1.18h-4.01v15.33h4.48v-5.46c0-2.3 1.16-3.8 2.9-3.8.38 0 .8.06 1.15.17v-4.32c-.22-.1-.47-.19-.67-.19zm-13.88.19l-4.5 15.33h4.63l.79-2.99h5.17l.79 2.99h4.63l-4.5-15.33h-7.01zm.93 3.65l1.64 6.22h-3.28l1.64-6.22zm-12.83-3.84c-2.3 0-3.92 1.09-4.82 2.37l-.28-2.09H7.5v15.33h4.48v-8.27c0-2.38 1.45-3.81 3.32-3.81.5 0 .97.08 1.34.22v-3.56c-.36-.12-.76-.19-1.15-.19zm-11.49 0C2.18 6.17 0 8.03 0 10.45c0 4.3 5.39 4.35 5.39 6.27 0 .82-.71 1.39-1.88 1.39-1.64 0-3.35-.74-4.51-1.53v3.74c1.37.77 3.26 1.2 5.02 1.2 2.9 0 5.88-1.4 5.88-4.5 0-4.64-5.41-4.53-5.41-6.32 0-.69.6-1.18 1.63-1.18 1.32 0 2.76.5 3.82 1.13v-3.5c-1.18-.58-2.71-.97-4.44-.97z" fill="white"/>
            </svg>
          </div>
        );
      case "paystack":
        return (
          <div className="w-10 h-10 rounded-xl bg-[#001D2D] border border-slate-800 flex items-center justify-center p-2 shadow-sm overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="15" y="20" width="70" height="13" rx="4" fill="#00C3F7"/>
              <rect x="15" y="43" width="50" height="13" rx="4" fill="#00C3F7"/>
              <rect x="15" y="66" width="70" height="13" rx="4" fill="#00C3F7"/>
            </svg>
          </div>
        );
      case "flutterwave":
        return (
          <div className="w-10 h-10 rounded-xl bg-[#FFF6EE] border border-[#FDE0C2] flex items-center justify-center p-2 shadow-sm overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 75C30 75 35 25 50 25C65 25 70 75 80 75" stroke="#FB9129" strokeWidth="14" strokeLinecap="round"/>
              <path d="M20 50C30 50 35 25 50 25C65 25 70 50 80 50" stroke="#FF5A00" strokeWidth="10" strokeLinecap="round" opacity="0.8"/>
            </svg>
          </div>
        );
      case "paypal":
        return (
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center p-2 shadow-sm overflow-hidden">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944 3.72a.79.79 0 01.78-.667h6.852c2.81 0 4.887.608 5.762 1.688.828 1.022.923 2.502.26 4.19-.012.032-.027.063-.041.094a6.376 6.376 0 01-2.483 2.766c-.958.577-2.122.888-3.46.888H9.378a.79.79 0 00-.78.667l-1.522 8.001z" fill="#003087"/>
              <path d="M8.86 16.587l.805-5.07h2.952c1.338 0 2.502-.311 3.46-.888a6.376 6.376 0 002.483-2.766c.381-.97.553-1.92.518-2.825a5.352 5.352 0 011.082 1.042c.828 1.022.923 2.502.26 4.19-.012.032-.027.063-.041.094a6.376 6.376 0 01-2.483 2.766c-.958.577-2.122.888-3.46.888H10.42a.79.79 0 00-.78.667l-.78 4.102z" fill="#0079C1"/>
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shadow-sm">
            <MdCreditCard className="text-xl" />
          </div>
        );
    }
  };

  const getWebhookUrl = (provider: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/api/payments/webhooks/${provider}`;
  };

  const rawProviders = providersData?.providers || [];
  const providers = rawProviders.length > 0 ? rawProviders : FALLBACK_PAYMENT_PROVIDERS;
  const activeProvider = providersData?.activeProvider || "stripe";

  if (providersLoading && !providersData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-[Manrope] font-bold text-slate-500 uppercase tracking-widest">Loading Payment Gateways…</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── Banner Notification ── */}
      {bannerNotice && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            bannerNotice.type === "success"
              ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
              : "bg-red-50/80 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-3">
            {bannerNotice.type === "success" ? (
              <MdCheckCircle className="text-emerald-600 text-xl shrink-0" />
            ) : (
              <MdWarning className="text-red-600 text-xl shrink-0" />
            )}
            <p className="text-xs font-[Manrope] font-semibold">{bannerNotice.text}</p>
          </div>
          <button
            onClick={() => setBannerNotice(null)}
            className="text-slate-400 hover:text-slate-700 text-sm p-1"
          >
            <MdClose />
          </button>
        </div>
      )}

      {/* ── Architecture & Security Overview Card ── */}
      <div className="bg-[#fbfcff] border border-[#e4e7ee] rounded-2xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#e4e7ee]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#006c49] animate-pulse" />
              <h2 className="font-serif text-2xl font-bold text-slate-900">Payment Provider Connections</h2>
            </div>
            <p className="text-xs font-[Manrope] text-slate-500 max-w-2xl">
              OAuth2 1-Click App Connections: The developer configures platform application credentials in environment variables, allowing sellers to connect Stripe, Paystack, or Flutterwave with a single click (similar to Facebook Login). All access tokens are encrypted at rest with AES-256-GCM.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                refetchProviders();
                refetchLogs();
                refetchTransactions();
              }}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-[Manrope] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 shadow-sm"
            >
              <MdRefresh className="text-base" /> Refresh Status
            </button>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <MdOutlineAccountBalance className="text-xl" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-[Manrope]">Active Gateway</p>
              <p className="font-serif text-lg font-bold text-slate-900 capitalize">{activeProvider}</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006c49] flex items-center justify-center shrink-0">
              <MdShield className="text-xl" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-[Manrope]">Vault Security</p>
              <p className="text-xs font-bold text-slate-800 font-[Manrope]">AES-256-GCM Encrypted</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <MdLock className="text-xl" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-[Manrope]">Multi-Tenant Isolation</p>
              <p className="text-xs font-bold text-slate-800 font-[Manrope]">Store-Scoped Access</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Supported Providers Grid ── */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="font-serif text-xl font-bold text-slate-900">Configured Payment Processors</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const stripeProv = providers.find(p => p.provider === "stripe");
                if (stripeProv) {
                  handleOAuthConnect(stripeProv);
                } else {
                  handleOAuthConnect({ provider: "stripe" } as any);
                }
              }}
              className="px-3 py-1.5 bg-[#635BFF] text-white hover:bg-[#5249e0] transition-colors rounded-lg text-xs font-[Manrope] font-bold flex items-center gap-1.5 shadow-sm"
            >
              <MdOpenInNew className="text-xs" /> Add Stripe Account (OAuth)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {providers.map((p) => {
            const isCurrentActive = p.isActive;
            const isConnecting = connectingProvider === p.provider;

            return (
              <div
                key={p.id || p.provider}
                className={`bg-white border rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 ${
                  isCurrentActive
                    ? "border-[#006c49] ring-2 ring-[#006c49]/10 shadow-md"
                    : p.isConnected
                    ? "border-slate-300 shadow-sm"
                    : "border-slate-200"
                }`}
              >
                <div>
                  {/* Top row: Icon, Name, Active Badge */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 p-1">
                        {getProviderIcon(p.provider, p.logoUrl)}
                      </div>
                      <div>
                        <h4 className="font-serif text-lg font-bold text-slate-900">{p.name}</h4>
                        <p className="text-[11px] font-[Manrope] text-slate-500">
                          {p.provider === "stripe" && "Global Cards, Apple Pay, Google Pay"}
                          {p.provider === "paystack" && "African Cards, Bank Transfer, USSD"}
                          {p.provider === "flutterwave" && "Cards, Mobile Money, M-Pesa"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-5">
                    {p.isConnected ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-50 text-[#006c49] border border-emerald-200 flex items-center gap-1 font-[Manrope]">
                        <MdCheckCircle className="text-xs" /> Connected
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-slate-100 text-slate-600 border border-slate-200 font-[Manrope]">
                        Not Connected
                      </span>
                    )}

                    {isCurrentActive && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-[#006c49] text-white font-[Manrope]">
                        Active for Checkout
                      </span>
                    )}

                    {p.isConnected && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 font-[Manrope]">
                        {p.livemode ? "Live Mode" : "Test Mode"}
                      </span>
                    )}
                  </div>

                  {/* Connection Details or Fallback info */}
                  {p.isConnected ? (
                    <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 mb-6 text-xs font-[Manrope] border border-slate-100">
                      {p.accountName && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Account:</span>
                          <span className="font-semibold text-slate-800 truncate max-w-[160px]">{p.accountName}</span>
                        </div>
                      )}
                      {p.accountId && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">ID:</span>
                          <span className="font-mono text-[11px] text-slate-700 truncate max-w-[160px]">{p.accountId}</span>
                        </div>
                      )}
                      {p.connectedAt && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Connected:</span>
                          <span className="text-slate-600 text-[11px]">{new Date(p.connectedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs font-[Manrope] text-slate-500 mb-6 leading-relaxed">
                      Connect your store's {p.provider} account using OAuth or configure direct encrypted credentials to start accepting payments.
                    </p>
                  )}
                </div>

                {/* Actions bottom bar */}
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  {p.isConnected ? (
                    <div className="space-y-2">
                      {isCurrentActive ? (
                        <button
                          onClick={() => setActiveMutation.mutate({ provider: p.provider, connectionId: p.id })}
                          disabled={setActiveMutation.isPending}
                          className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-[Manrope] font-bold tracking-wide uppercase hover:bg-red-600 transition-all flex items-center justify-center gap-2 group"
                        >
                          <span className="group-hover:hidden flex items-center gap-1.5"><MdCheck /> Active Checkout Provider</span>
                          <span className="hidden group-hover:flex items-center gap-1.5">Deactivate Checkout Provider</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveMutation.mutate({ provider: p.provider, connectionId: p.id })}
                          disabled={setActiveMutation.isPending}
                          className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-xs font-[Manrope] font-bold tracking-wide uppercase hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                        >
                          <MdCheck /> Set as Active Checkout Provider
                        </button>
                      )}

                      <div className="space-y-2">
                        <button
                          onClick={() => handleOAuthConnect(p)}
                          disabled={isConnecting}
                          className={`w-full py-2.5 px-3 rounded-xl text-xs font-[Manrope] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-sm ${
                            p.provider === "stripe"
                              ? "bg-[#635BFF] hover:bg-[#5249e0] text-white"
                              : p.provider === "paystack"
                              ? "bg-[#0BA4DB] hover:bg-[#0992c4] text-white"
                              : p.provider === "flutterwave"
                              ? "bg-[#FB9129] hover:bg-[#e4801e] text-white"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          }`}
                        >
                          {isConnecting ? (
                            <>
                              <MdAutorenew className="text-sm animate-spin" /> Authorizing…
                            </>
                          ) : (
                            <>
                              <MdOpenInNew className="text-sm" /> Re-authorize via OAuth2
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to disconnect ${p.provider.toUpperCase()} (${p.accountName || p.accountId || 'Account'})? Customer checkouts will no longer route through this account.`)) {
                              disconnectMutation.mutate({ provider: p.provider, connectionId: p.id });
                            }
                          }}
                          disabled={disconnectMutation.isPending}
                          className="w-full py-2 border border-red-200 text-red-600 rounded-lg text-xs font-[Manrope] font-bold hover:bg-red-50 flex items-center justify-center gap-1"
                        >
                          <MdDeleteForever className="text-sm" /> Disconnect
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {p.capabilities?.supportsOAuth ? (
                        <>
                          <button
                            onClick={() => handleOAuthConnect(p)}
                            disabled={isConnecting}
                            className={`w-full py-3 px-4 rounded-xl text-xs font-[Manrope] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-sm ${
                              p.provider === "stripe"
                                ? "bg-[#635BFF] hover:bg-[#5249e0] text-white"
                                : p.provider === "paystack"
                                ? "bg-[#0BA4DB] hover:bg-[#0992c4] text-white"
                                : "bg-[#FB9129] hover:bg-[#e4801e] text-white"
                            }`}
                          >
                            {isConnecting ? (
                              <>
                                <MdAutorenew className="text-base animate-spin" /> Authorizing Account…
                              </>
                            ) : (
                              <>
                                <MdOpenInNew className="text-base" /> Connect with {p.provider}
                              </>
                            )}
                          </button>
                          <p className="text-[10px] text-center text-slate-400 font-[Manrope]">
                            1-Click OAuth2 App Install • Managed via Platform Env Vars
                          </p>
                        </>
                      ) : (
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <p className="text-xs font-[Manrope] text-slate-600 text-center">
                            Credentials for {p.provider} are managed via platform-level environment variables. 
                            Manual configuration is disabled in this environment.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Webhook Endpoint copy helper */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-[Manrope] mb-1">
                      <span>Webhook Endpoint:</span>
                      <button
                        onClick={() => copyToClipboard(getWebhookUrl(p.provider), `webhook_${p.provider}`)}
                        className="text-[#006c49] hover:underline font-bold flex items-center gap-0.5"
                      >
                        {copiedKey === `webhook_${p.provider}` ? (
                          <>
                            <MdCheck className="text-xs" /> Copied
                          </>
                        ) : (
                          <>
                            <MdContentCopy className="text-xs" /> Copy URL
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 bg-slate-100/70 p-1.5 rounded truncate">
                      {getWebhookUrl(p.provider)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Refund Modal ── */}
      {refundTx && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-serif text-lg font-bold text-slate-900">Issue Payment Refund</h3>
              <button onClick={() => setRefundTx(null)} className="text-slate-400 hover:text-slate-700">
                <MdClose className="text-lg" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs font-[Manrope]">
              <div className="flex justify-between">
                <span className="text-slate-500">Reference:</span>
                <span className="font-mono font-bold text-slate-800">{refundTx.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Provider:</span>
                <span className="uppercase font-bold text-slate-800">{refundTx.provider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="text-slate-800">{refundTx.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Charged:</span>
                <span className="font-bold text-slate-900">${(refundTx.amount / 100).toFixed(2)} {refundTx.currency}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-[Manrope] font-bold text-slate-700">Reason for Refund</label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Customer requested cancellation / return"
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-[Manrope] outline-none resize-none focus:border-slate-900"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setRefundTx(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-[Manrope] font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => refundMutation.mutate({ reference: refundTx.reference, reason: refundReason })}
                disabled={refundMutation.isPending}
                className="px-5 py-2 bg-red-600 text-white rounded-lg text-xs font-[Manrope] font-bold hover:bg-red-700 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {refundMutation.isPending ? "Refunding…" : "Confirm Full Refund"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Transactions Table ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MdReceiptLong className="text-slate-700 text-xl" />
            <h3 className="font-serif text-xl font-bold text-slate-900">Recent Payment Transactions</h3>
          </div>
          <span className="text-xs font-[Manrope] text-slate-500 font-semibold">{transactions.length} records</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-xs font-[Manrope] text-slate-400">
              No payment transactions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-[Manrope]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-6 py-3.5">Reference</th>
                    <th className="px-6 py-3.5">Gateway</th>
                    <th className="px-6 py-3.5">Customer Email</th>
                    <th className="px-6 py-3.5">Amount</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono font-semibold text-slate-900">{tx.reference}</td>
                      <td className="px-6 py-4 capitalize font-semibold text-slate-700">{tx.provider}</td>
                      <td className="px-6 py-4 text-slate-600">{tx.email}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        ${(tx.amount / 100).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">{tx.currency}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            tx.status === "paid"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : tx.status === "refunded"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-[11px]">
                        {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {tx.status === "paid" && (
                          <button
                            onClick={() => setRefundTx(tx)}
                            className="text-xs font-bold text-slate-700 hover:text-red-600 transition-colors"
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Security & Audit Trail ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MdHistory className="text-slate-700 text-xl" />
          <h3 className="font-serif text-xl font-bold text-slate-900">Payment Connection Audit Trail</h3>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs font-[Manrope] text-slate-400">
              No audit logs recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs font-[Manrope]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px] sticky top-0">
                  <tr>
                    <th className="px-6 py-3">Timestamp</th>
                    <th className="px-6 py-3">Action</th>
                    <th className="px-6 py-3">Provider</th>
                    <th className="px-6 py-3">IP Address</th>
                    <th className="px-6 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60">
                      <td className="px-6 py-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 font-mono font-bold text-slate-800">{log.action}</td>
                      <td className="px-6 py-3 capitalize font-semibold text-slate-700">{log.provider}</td>
                      <td className="px-6 py-3 font-mono text-[11px] text-slate-500">{log.ipAddress || "—"}</td>
                      <td className="px-6 py-3 text-slate-600 font-mono text-[11px] truncate max-w-xs">
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
