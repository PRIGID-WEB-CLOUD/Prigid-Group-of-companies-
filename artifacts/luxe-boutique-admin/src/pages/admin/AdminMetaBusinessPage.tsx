import { useState, useEffect, useCallback } from "react";
import {
  MdArrowBack,
  MdCheckCircle,
  MdSync,
  MdRefresh,
  MdLinkOff,
  MdStore,
  MdCampaign,
  MdChat,
  MdPhotoCamera,
  MdTune,
  MdInfo,
  MdCheck,
  MdContentCopy,
  MdSecurity,
  MdLock,
  MdOpenInNew,
  MdWarning,
  MdExpandMore,
  MdExpandLess,
  MdTrackChanges,
} from "react-icons/md";
import { SiMeta, SiFacebook, SiInstagram, SiWhatsapp } from "react-icons/si";
import { Link } from "wouter";
import AdminLayout from "./AdminLayout";

interface DiscoveredPage {
  id: string;
  name: string;
  category?: string;
  accessToken: string;
  instagramAccount?: {
    id: string;
    username: string;
    name?: string;
    profilePictureUrl?: string;
  };
}

interface DiscoveredCatalog {
  id: string;
  name: string;
  vertical?: string;
  productCount?: number;
}

interface DiscoveredWhatsAppAccount {
  id: string;
  name: string;
  currency?: string;
  phones: Array<{
    id: string;
    displayPhoneNumber: string;
    verifiedName?: string;
    qualityRating?: string;
  }>;
}

interface DiscoveredAdAccount {
  id: string;
  accountId: string;
  name: string;
  currency?: string;
  status?: number;
}

interface DiscoveredPixel {
  id: string;
  name: string;
  adAccountId?: string;
}

interface MetaStatusResponse {
  configured: boolean;
  connected: boolean;
  business?: { id: string; name: string };
  user?: { id: string; name: string; email?: string };
  connectedAt?: string;
  expiresAt?: string;
  channelsStatus: {
    facebook: { connected: boolean; name?: string; id?: string; pixelId?: string; source?: string };
    instagram: { connected: boolean; username?: string; id?: string; source?: string };
    commerce: { connected: boolean; name?: string; id?: string; source?: string };
    ads: { connected: boolean; name?: string; id?: string; pixelId?: string; source?: string };
    whatsapp: { connected: boolean; phone?: string; verifiedName?: string; source?: string };
  };
  assets: {
    pages: DiscoveredPage[];
    catalogs: DiscoveredCatalog[];
    whatsappAccounts: DiscoveredWhatsAppAccount[];
    adAccounts: DiscoveredAdAccount[];
    pixels: DiscoveredPixel[];
  };
}

export default function AdminMetaBusinessPage() {
  const [status, setStatus] = useState<MetaStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: "info" | "success" | "error" } | null>(null);
  const [activeAssetTab, setActiveAssetTab] = useState<"pages" | "catalogs" | "whatsapp" | "ads" | "pixels">("pages");
  const [selectingAsset, setSelectingAsset] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [scopePreset, setScopePreset] = useState<"all" | "social" | "commerce" | "whatsapp" | "ads">("all");
  const [customConfigId, setCustomConfigId] = useState("");
  const [showConfigIdInput, setShowConfigIdInput] = useState(false);
  const [showProductionConfig, setShowProductionConfig] = useState(false);
  const [customCatalogId, setCustomCatalogId] = useState("");
  const [fetchingCatalog, setFetchingCatalog] = useState(false);

  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const currentHostname = typeof window !== "undefined" ? window.location.hostname : "";
  const oauthRedirectUri = `${currentOrigin}/api/channels/meta/callback`;
  const privacyPolicyUrl = `${currentOrigin}/privacy`;
  const termsUrl = `${currentOrigin}/terms`;
  const siteUrl = `${currentOrigin}/`;

  const showToast = (message: string, type: "info" | "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/channels/meta/status");
      if (res.ok) {
        const data = (await res.json()) as MetaStatusResponse;
        setStatus(data);
      }
    } catch {
      showToast("Unable to load Meta Business status.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Listen for OAuth completion from popup
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === "OAUTH_AUTH_SUCCESS" && event.data?.provider === "meta") {
        setConnecting(false);
        showToast("Meta Business Suite connected successfully!", "success");
        loadStatus();
      } else if (event.data?.type === "OAUTH_AUTH_ERROR" && event.data?.provider === "meta") {
        setConnecting(false);
        showToast(`Authentication failed: ${event.data.error}`, "error");
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [loadStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const originParam = encodeURIComponent(window.location.origin);
      let queryUrl = `/api/channels/meta/auth-url?origin=${originParam}&preset=${scopePreset}`;
      if (customConfigId.trim()) {
        queryUrl += `&configId=${encodeURIComponent(customConfigId.trim())}`;
      } else {
        queryUrl += `&configId=`;
      }
      const res = await fetch(queryUrl);
      const data = await res.json();

      if (!data.configured || !data.url) {
        setConnecting(false);
        showToast(data.message || "Meta App credentials not configured in environment.", "info");
        return;
      }

      // Open OAuth popup window
      const width = 600;
      const height = 750;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.url,
        "meta_oauth_popup",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,status=no`
      );

      if (!popup || popup.closed) {
        setConnecting(false);
        showToast("Popup was blocked by your browser. Please allow popups.", "error");
      }
    } catch {
      setConnecting(false);
      showToast("Failed to initiate Meta authorization flow.", "error");
    }
  };

  const handleSyncAssets = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/channels/meta/sync-assets", { method: "POST" });
      if (res.ok) {
        showToast("All Meta assets re-synchronized.", "success");
        await loadStatus();
      } else {
        const err = await res.json();
        showToast(err.error || "Sync failed.", "error");
      }
    } catch {
      showToast("Failed to sync assets.", "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect Meta Business Suite? This will unlink all auto-provisioned channels.")) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch("/api/channels/meta/disconnect", { method: "POST" });
      if (res.ok) {
        showToast("Meta Business Suite disconnected.", "info");
        await loadStatus();
      } else {
        showToast("Failed to disconnect.", "error");
      }
    } catch {
      showToast("Error during disconnect.", "error");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSelectAsset = async (
    assetType: "page" | "catalog" | "whatsapp" | "adAccount" | "pixel",
    assetId: string,
    subId?: string
  ) => {
    setSelectingAsset(assetId);
    try {
      const res = await fetch("/api/channels/meta/select-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType, assetId, subId }),
      });
      if (res.ok) {
        showToast(`Active ${assetType} updated successfully.`, "success");
        await loadStatus();
      } else {
        showToast(`Failed to switch ${assetType}.`, "error");
      }
    } catch {
      showToast("Network error updating asset.", "error");
    } finally {
      setSelectingAsset(null);
    }
  };

  const handleFetchCatalog = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = customCatalogId.trim();
    if (!cleanId) {
      showToast("Please enter a Meta Catalog ID.", "error");
      return;
    }
    setFetchingCatalog(true);
    try {
      const res = await fetch("/api/channels/meta/fetch-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalogId: cleanId }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Catalog ${cleanId} linked successfully!`, "success");
        setCustomCatalogId("");
        await loadStatus();
      } else {
        showToast(data.error || "Failed to fetch catalog.", "error");
      }
    } catch {
      showToast("Network error fetching catalog.", "error");
    } finally {
      setFetchingCatalog(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <AdminLayout sidebar="channels">
      <div className="p-4 sm:p-10 max-w-[1060px] mx-auto">
        {/* Toast Notification */}
        {toast && (
          <div
            id="meta-toast"
            className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-[Manrope] font-semibold text-white transition-all flex items-center gap-2 ${
              toast.type === "error" ? "bg-red-600" : toast.type === "info" ? "bg-blue-600" : "bg-[#006c49]"
            }`}
          >
            <MdCheckCircle className="text-lg" />
            <span>{toast.message}</span>
          </div>
        )}

        {/* Breadcrumb Header */}
        <header className="mb-8">
          <Link
            id="back-to-channel-hub"
            href="/admin/channels"
            className="inline-flex items-center gap-1.5 text-[#7c839b] hover:text-[#006c49] transition-colors font-[Manrope] font-bold text-xs tracking-widest uppercase mb-3 no-underline"
          >
            <MdArrowBack className="text-base" /> Back to Channel Hub
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <SiMeta className="text-2xl text-[#0668E1]" />
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#0b1c30]">
                  Meta Business Suite Login
                </h1>
              </div>
              <p className="text-[15px] font-[Manrope] text-[#7c839b]">
                Consolidated one-click authentication across Facebook, Instagram, WhatsApp, Catalog, and Ads.
              </p>
            </div>

            {status?.connected && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  id="sync-meta-assets-btn"
                  onClick={handleSyncAssets}
                  disabled={syncing}
                  className="px-4 py-2 bg-white border border-[#c6c6cd] hover:bg-slate-50 text-[#0b1c30] text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <MdSync className={`text-base ${syncing ? "animate-spin text-[#006c49]" : ""}`} />
                  <span>{syncing ? "Syncing..." : "Re-sync Assets"}</span>
                </button>
                <button
                  id="disconnect-meta-btn"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-4 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <MdLinkOff className="text-base" />
                  <span>{disconnecting ? "Disconnecting..." : "Disconnect"}</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {loading ? (
          <div className="bg-white rounded-xl p-12 text-center border border-slate-200/80 shadow-xs">
            <MdSync className="text-3xl text-[#006c49] animate-spin mx-auto mb-3" />
            <p className="text-sm font-[Manrope] text-[#7c839b]">Verifying Meta Business connection...</p>
          </div>
        ) : status?.connected ? (
          /* ── CONNECTED STATE ────────────────────────────────────────── */
          <div className="space-y-8">
            {/* Master Account Card */}
            <div id="meta-master-card" className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0668E1] flex items-center justify-center shrink-0">
                    <SiMeta className="text-2xl" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-serif font-bold text-[#0b1c30]">
                        {status.business?.name || "Meta Business Account"}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-[Manrope] font-bold bg-[#6cf8bb] text-[#00714d]">
                        CONNECTED
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-[Manrope] text-[#7c839b]">
                      {status.business?.id && (
                        <span>Business ID: <code className="text-slate-800 font-mono">{status.business.id}</code></span>
                      )}
                      {status.user?.name && (
                        <span>Admin: <strong className="text-slate-800">{status.user.name}</strong></span>
                      )}
                      {status.connectedAt && (
                        <span>Linked: {new Date(status.connectedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-3 py-2 bg-emerald-50 text-[#006c49] rounded-lg text-xs font-[Manrope] font-semibold flex items-center gap-2">
                    <MdCheckCircle className="text-base" />
                    <span>Auto-syncing {Object.values(status.channelsStatus).filter(c => c.connected).length} channels</span>
                  </div>
                </div>
              </div>

              {/* Sub-channel Status Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-6">
                {/* Facebook Page */}
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/60">
                  <div className="flex items-center justify-between mb-2">
                    <SiFacebook className="text-[#1877F2] text-lg" />
                    <span className={`w-2 h-2 rounded-full ${status.channelsStatus.facebook.connected ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </div>
                  <div className="text-[11px] font-[Manrope] font-bold text-[#7c839b] uppercase tracking-wider">Page</div>
                  <div className="text-xs font-semibold text-[#0b1c30] truncate mt-0.5">
                    {status.channelsStatus.facebook.name || (status.channelsStatus.facebook.connected ? "Connected" : "Disconnected")}
                  </div>
                </div>

                {/* Instagram */}
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/60">
                  <div className="flex items-center justify-between mb-2">
                    <SiInstagram className="text-[#E4405F] text-lg" />
                    <span className={`w-2 h-2 rounded-full ${status.channelsStatus.instagram.connected ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </div>
                  <div className="text-[11px] font-[Manrope] font-bold text-[#7c839b] uppercase tracking-wider">Instagram</div>
                  <div className="text-xs font-semibold text-[#0b1c30] truncate mt-0.5">
                    {status.channelsStatus.instagram.username ? `@${status.channelsStatus.instagram.username}` : (status.channelsStatus.instagram.connected ? "Connected" : "Disconnected")}
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/60">
                  <div className="flex items-center justify-between mb-2">
                    <SiWhatsapp className="text-[#25D366] text-lg" />
                    <span className={`w-2 h-2 rounded-full ${status.channelsStatus.whatsapp.connected ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </div>
                  <div className="text-[11px] font-[Manrope] font-bold text-[#7c839b] uppercase tracking-wider">WhatsApp</div>
                  <div className="text-xs font-semibold text-[#0b1c30] truncate mt-0.5">
                    {status.channelsStatus.whatsapp.phone || (status.channelsStatus.whatsapp.connected ? "Connected" : "Disconnected")}
                  </div>
                </div>

                {/* Commerce Catalog */}
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/60">
                  <div className="flex items-center justify-between mb-2">
                    <MdStore className="text-[#0668E1] text-lg" />
                    <span className={`w-2 h-2 rounded-full ${status.channelsStatus.commerce.connected ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </div>
                  <div className="text-[11px] font-[Manrope] font-bold text-[#7c839b] uppercase tracking-wider">Catalog</div>
                  <div className="text-xs font-semibold text-[#0b1c30] truncate mt-0.5">
                    {status.channelsStatus.commerce.name || (status.channelsStatus.commerce.connected ? "Connected" : "Disconnected")}
                  </div>
                </div>

                {/* Ads */}
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/60">
                  <div className="flex items-center justify-between mb-2">
                    <MdCampaign className="text-[#0668E1] text-lg" />
                    <span className={`w-2 h-2 rounded-full ${status.channelsStatus.ads.connected ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </div>
                  <div className="text-[11px] font-[Manrope] font-bold text-[#7c839b] uppercase tracking-wider">Ads</div>
                  <div className="text-xs font-semibold text-[#0b1c30] truncate mt-0.5">
                    {status.channelsStatus.ads.name || status.channelsStatus.ads.id || (status.channelsStatus.ads.connected ? "Connected" : "Disconnected")}
                  </div>
                </div>

                {/* Meta Pixel */}
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/60">
                  <div className="flex items-center justify-between mb-2">
                    <MdTrackChanges className="text-[#006c49] text-lg" />
                    <span className={`w-2 h-2 rounded-full ${status.channelsStatus.facebook.pixelId ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </div>
                  <div className="text-[11px] font-[Manrope] font-bold text-[#7c839b] uppercase tracking-wider">Pixel</div>
                  <div className="text-xs font-semibold text-[#0b1c30] truncate mt-0.5">
                    {status.channelsStatus.facebook.pixelId ? (
                      <code className="font-mono text-[#006c49] text-[11px] font-bold">{status.channelsStatus.facebook.pixelId}</code>
                    ) : (
                      <span className="text-[#7c839b]">Not linked</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Asset Management Section */}
            <div id="meta-asset-manager" className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-base font-serif font-bold text-[#0b1c30]">Discovered Meta Assets</h3>
                  <p className="text-xs font-[Manrope] text-[#7c839b]">
                    Manage and select which specific Facebook Pages, Catalogs, WhatsApp accounts, or Pixels power your boutique.
                  </p>
                </div>

                {/* Tab Pill Selector */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto flex-wrap">
                  <button
                    id="tab-pages"
                    onClick={() => setActiveAssetTab("pages")}
                    className={`px-3 py-1.5 text-xs font-[Manrope] font-bold rounded-md transition-all cursor-pointer ${
                      activeAssetTab === "pages" ? "bg-white text-[#0b1c30] shadow-xs" : "text-[#7c839b] hover:text-[#0b1c30]"
                    }`}
                  >
                    Pages ({status.assets?.pages?.length || 0})
                  </button>
                  <button
                    id="tab-catalogs"
                    onClick={() => setActiveAssetTab("catalogs")}
                    className={`px-3 py-1.5 text-xs font-[Manrope] font-bold rounded-md transition-all cursor-pointer ${
                      activeAssetTab === "catalogs" ? "bg-white text-[#0b1c30] shadow-xs" : "text-[#7c839b] hover:text-[#0b1c30]"
                    }`}
                  >
                    Catalogs ({status.assets?.catalogs?.length || 0})
                  </button>
                  <button
                    id="tab-whatsapp"
                    onClick={() => setActiveAssetTab("whatsapp")}
                    className={`px-3 py-1.5 text-xs font-[Manrope] font-bold rounded-md transition-all cursor-pointer ${
                      activeAssetTab === "whatsapp" ? "bg-white text-[#0b1c30] shadow-xs" : "text-[#7c839b] hover:text-[#0b1c30]"
                    }`}
                  >
                    WhatsApp ({status.assets?.whatsappAccounts?.length || 0})
                  </button>
                  <button
                    id="tab-ads"
                    onClick={() => setActiveAssetTab("ads")}
                    className={`px-3 py-1.5 text-xs font-[Manrope] font-bold rounded-md transition-all cursor-pointer ${
                      activeAssetTab === "ads" ? "bg-white text-[#0b1c30] shadow-xs" : "text-[#7c839b] hover:text-[#0b1c30]"
                    }`}
                  >
                    Ads ({status.assets?.adAccounts?.length || 0})
                  </button>
                  <button
                    id="tab-pixels"
                    onClick={() => setActiveAssetTab("pixels")}
                    className={`px-3 py-1.5 text-xs font-[Manrope] font-bold rounded-md transition-all cursor-pointer ${
                      activeAssetTab === "pixels" ? "bg-white text-[#0b1c30] shadow-xs" : "text-[#7c839b] hover:text-[#0b1c30]"
                    }`}
                  >
                    Pixels ({status.assets?.pixels?.length || 0})
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* 1. Pages Tab */}
                {activeAssetTab === "pages" && (
                  <div className="space-y-4">
                    {status.assets?.pages?.length === 0 ? (
                      <div className="p-8 text-center text-xs font-[Manrope] text-[#7c839b]">
                        No Facebook Pages found in this Meta Business account.
                      </div>
                    ) : (
                      status.assets?.pages?.map((page) => {
                        const isActive = status.channelsStatus.facebook.id === page.id;
                        return (
                          <div
                            key={page.id}
                            className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                              isActive ? "border-[#006c49] bg-emerald-50/20" : "border-slate-200 hover:border-slate-300 bg-white"
                            }`}
                          >
                            <div className="flex items-start gap-3.5">
                              <div className="w-10 h-10 rounded-lg bg-[#1877F2]/10 text-[#1877F2] flex items-center justify-center shrink-0">
                                <SiFacebook className="text-xl" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-serif font-bold text-[#0b1c30]">{page.name}</h4>
                                  {isActive && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-[Manrope] font-bold bg-[#6cf8bb] text-[#00714d]">
                                      ACTIVE
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 text-xs font-[Manrope] text-[#7c839b] mt-0.5">
                                  <span>ID: <code className="font-mono text-slate-700">{page.id}</code></span>
                                  {page.category && <span>Category: {page.category}</span>}
                                  {page.instagramAccount && (
                                    <span className="flex items-center gap-1 text-[#E4405F]">
                                      <SiInstagram className="text-xs" /> @{page.instagramAccount.username}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {!isActive && (
                              <button
                                id={`select-page-${page.id}`}
                                onClick={() => handleSelectAsset("page", page.id)}
                                disabled={selectingAsset === page.id}
                                className="px-4 py-2 border border-slate-200 hover:border-slate-300 text-[#0b1c30] text-xs font-[Manrope] font-bold rounded-lg transition-colors self-start sm:self-auto cursor-pointer"
                              >
                                {selectingAsset === page.id ? "Switching..." : "Set as Active Page"}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 2. Catalogs Tab */}
                {activeAssetTab === "catalogs" && (
                  <div className="space-y-4">
                    {/* Direct Fetch & Link by Catalog ID Box */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h5 className="text-xs font-[Manrope] font-bold text-[#0b1c30] flex items-center gap-1.5">
                            <MdStore className="text-base text-[#0668E1]" />
                            Fetch or Link Meta Catalog by ID
                          </h5>
                          <p className="text-[11px] font-[Manrope] text-[#7c839b] mt-0.5">
                            If your catalog belongs to a specific Meta Commerce Manager portfolio, enter its Catalog ID to query Meta Graph API and link it immediately.
                          </p>
                        </div>
                        <form onSubmit={handleFetchCatalog} className="flex items-center gap-2 w-full sm:w-auto">
                          <input
                            id="meta-catalog-id-input"
                            type="text"
                            value={customCatalogId}
                            onChange={(e) => setCustomCatalogId(e.target.value)}
                            placeholder="Enter Catalog ID..."
                            className="px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-[#006c49] bg-white w-full sm:w-56"
                          />
                          <button
                            id="meta-fetch-catalog-btn"
                            type="submit"
                            disabled={fetchingCatalog || !customCatalogId.trim()}
                            className="px-3 py-1.5 bg-[#006c49] text-white text-xs font-[Manrope] font-bold rounded-lg hover:bg-[#005236] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                          >
                            {fetchingCatalog ? (
                              <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Fetching...
                              </>
                            ) : (
                              "Fetch & Link"
                            )}
                          </button>
                        </form>
                      </div>
                    </div>

                    {status.assets?.catalogs?.length === 0 ? (
                      <div className="p-8 text-center text-xs font-[Manrope] text-[#7c839b] space-y-3 bg-white rounded-xl border border-slate-200">
                        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                          <MdStore className="text-2xl" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">No product catalogs found automatically</p>
                          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                            Meta accounts with multiple business portfolios or Commerce Manager setups may require a deeper resync, or you can link directly using your Catalog ID from Meta Commerce Manager above.
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-3 pt-2">
                          <button
                            id="resync-catalogs-btn"
                            onClick={handleSyncAssets}
                            disabled={syncing}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#0b1c30] text-xs font-[Manrope] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <MdSync className={`text-base ${syncing ? "animate-spin" : ""}`} />
                            {syncing ? "Re-syncing..." : "Re-sync Meta Assets"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      status.assets?.catalogs?.map((catalog) => {
                        const isActive = status.channelsStatus.commerce.id === catalog.id;
                        return (
                          <div
                            key={catalog.id}
                            className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                              isActive ? "border-[#006c49] bg-emerald-50/20" : "border-slate-200 hover:border-slate-300 bg-white"
                            }`}
                          >
                            <div className="flex items-start gap-3.5">
                              <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#0668E1] flex items-center justify-center shrink-0">
                                <MdStore className="text-xl" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-serif font-bold text-[#0b1c30]">{catalog.name}</h4>
                                  {isActive && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-[Manrope] font-bold bg-[#6cf8bb] text-[#00714d]">
                                      ACTIVE
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 text-xs font-[Manrope] text-[#7c839b] mt-0.5">
                                  <span>ID: <code className="font-mono text-slate-700">{catalog.id}</code></span>
                                  {catalog.productCount !== undefined && (
                                    <span>Products: <strong>{catalog.productCount}</strong></span>
                                  )}
                                  {catalog.vertical && <span>Type: {catalog.vertical}</span>}
                                </div>
                              </div>
                            </div>

                            {!isActive && (
                              <button
                                id={`select-catalog-${catalog.id}`}
                                onClick={() => handleSelectAsset("catalog", catalog.id)}
                                disabled={selectingAsset === catalog.id}
                                className="px-4 py-2 border border-slate-200 hover:border-slate-300 text-[#0b1c30] text-xs font-[Manrope] font-bold rounded-lg transition-colors self-start sm:self-auto cursor-pointer"
                              >
                                {selectingAsset === catalog.id ? "Switching..." : "Set as Active Catalog"}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 3. WhatsApp Tab */}
                {activeAssetTab === "whatsapp" && (
                  <div className="space-y-4">
                    {status.assets?.whatsappAccounts?.length === 0 ? (
                      <div className="p-8 text-center text-xs font-[Manrope] text-[#7c839b] space-y-2">
                        <p>No WhatsApp Business Accounts found.</p>
                      </div>
                    ) : (
                      status.assets?.whatsappAccounts?.map((waba) => (
                        <div key={waba.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <SiWhatsapp className="text-[#25D366] text-lg" />
                              <h4 className="text-sm font-serif font-bold text-[#0b1c30]">{waba.name}</h4>
                            </div>
                            <span className="text-xs font-mono text-[#7c839b]">WABA ID: {waba.id}</span>
                          </div>

                          <div className="divide-y divide-slate-100">
                            {waba.phones.map((phone) => {
                              const isActive = status.channelsStatus.whatsapp.phone === phone.displayPhoneNumber;
                              return (
                                <div key={phone.id} className="py-2.5 flex items-center justify-between gap-4">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-slate-900 font-mono">
                                        {phone.displayPhoneNumber}
                                      </span>
                                      {phone.verifiedName && (
                                        <span className="text-xs text-slate-500">({phone.verifiedName})</span>
                                      )}
                                      {isActive && (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-[Manrope] font-bold bg-[#6cf8bb] text-[#00714d]">
                                          ACTIVE
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-[#7c839b] mt-0.5">
                                      Phone ID: <code className="font-mono">{phone.id}</code>
                                      {phone.qualityRating && ` • Quality: ${phone.qualityRating}`}
                                    </div>
                                  </div>

                                  {!isActive && (
                                    <button
                                      id={`select-phone-${phone.id}`}
                                      onClick={() => handleSelectAsset("whatsapp", waba.id, phone.id)}
                                      disabled={selectingAsset === waba.id}
                                      className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 text-[#0b1c30] text-xs font-[Manrope] font-bold rounded-lg transition-colors cursor-pointer"
                                    >
                                      Select Phone
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 4. Ads Tab */}
                {activeAssetTab === "ads" && (
                  <div className="space-y-4">
                    {status.assets?.adAccounts?.length === 0 ? (
                      <div className="p-8 text-center text-xs font-[Manrope] text-[#7c839b]">
                        No Ad Accounts discovered in this Meta Business account.
                      </div>
                    ) : (
                      status.assets?.adAccounts?.map((ad) => {
                        const isActive = status.channelsStatus.ads.id === ad.accountId || status.channelsStatus.ads.id === ad.id;
                        return (
                          <div
                            key={ad.id}
                            className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                              isActive ? "border-[#006c49] bg-emerald-50/20" : "border-slate-200 hover:border-slate-300 bg-white"
                            }`}
                          >
                            <div className="flex items-start gap-3.5">
                              <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#0668E1] flex items-center justify-center shrink-0">
                                <MdCampaign className="text-xl" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-serif font-bold text-[#0b1c30]">{ad.name}</h4>
                                  {isActive && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-[Manrope] font-bold bg-[#6cf8bb] text-[#00714d]">
                                      ACTIVE
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 text-xs font-[Manrope] text-[#7c839b] mt-0.5">
                                  <span>Account ID: <code className="font-mono text-slate-700">{ad.accountId}</code></span>
                                  {ad.currency && <span>Currency: {ad.currency}</span>}
                                </div>
                              </div>
                            </div>

                            {!isActive && (
                              <button
                                id={`select-ad-${ad.id}`}
                                onClick={() => handleSelectAsset("adAccount", ad.id)}
                                disabled={selectingAsset === ad.id}
                                className="px-4 py-2 border border-slate-200 hover:border-slate-300 text-[#0b1c30] text-xs font-[Manrope] font-bold rounded-lg transition-colors self-start sm:self-auto cursor-pointer"
                              >
                                {selectingAsset === ad.id ? "Switching..." : "Set as Active Ad Account"}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 5. Pixels Tab */}
                {activeAssetTab === "pixels" && (
                  <div className="space-y-4">
                    {status.assets?.pixels?.length === 0 ? (
                      <div className="p-8 text-center text-xs font-[Manrope] text-[#7c839b] space-y-2">
                        <p>No Meta Pixels or Datasets discovered in this Meta Business account.</p>
                        <p className="text-[11px] text-[#7c839b]/80">
                          Ensure your Meta Ad Account or Business Portfolio has an active Pixel or Dataset created in Meta Events Manager.
                        </p>
                      </div>
                    ) : (
                      status.assets?.pixels?.map((px) => {
                        const isActive = status.channelsStatus.facebook.pixelId === px.id;
                        return (
                          <div
                            key={px.id}
                            className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                              isActive ? "border-emerald-300 bg-emerald-50/20 shadow-xs" : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-3.5">
                              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#006c49] flex items-center justify-center shrink-0">
                                <MdTrackChanges className="text-xl" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-[#0b1c30]">{px.name}</span>
                                  {isActive && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-[Manrope] font-bold bg-[#6cf8bb] text-[#00714d]">
                                      ACTIVE
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 text-xs font-[Manrope] text-[#7c839b] mt-0.5">
                                  <span>Pixel / Dataset ID: <code className="font-mono text-slate-700 font-semibold">{px.id}</code></span>
                                  {px.adAccountId && <span>Linked Ad Account: <code className="font-mono text-slate-700">{px.adAccountId}</code></span>}
                                </div>
                              </div>
                            </div>

                            {!isActive && (
                              <button
                                id={`select-pixel-${px.id}`}
                                onClick={() => handleSelectAsset("pixel", px.id)}
                                disabled={selectingAsset === px.id}
                                className="px-4 py-2 border border-slate-200 hover:border-slate-300 text-[#0b1c30] text-xs font-[Manrope] font-bold rounded-lg transition-colors self-start sm:self-auto cursor-pointer"
                              >
                                {selectingAsset === px.id ? "Switching..." : "Set as Active Pixel"}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── DISCONNECTED / ONBOARDING STATE ────────────────────────── */
          <div className="space-y-8">
            <div className="bg-white rounded-xl p-8 sm:p-12 border border-slate-200/80 shadow-xs text-center max-w-[720px] mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#0668E1] flex items-center justify-center mx-auto mb-6">
                <SiMeta className="text-3xl" />
              </div>

              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#0b1c30] mb-3">
                Connect Once, Power Everything
              </h2>
              <p className="text-sm sm:text-base font-[Manrope] text-[#7c839b] max-w-lg mx-auto mb-8 leading-relaxed">
                Log in once with your Meta Business account to instantly link your Facebook Page, Instagram account,
                WhatsApp Business API, Product Catalog, and Ad campaigns—without copying and pasting API tokens.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  id="connect-meta-business-btn"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full sm:w-auto px-8 py-3.5 bg-[#0668E1] hover:bg-blue-700 text-white text-xs font-[Manrope] font-bold tracking-widest uppercase rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <SiMeta className="text-lg" />
                  <span>
                    {connecting
                      ? "Connecting..."
                      : customConfigId.trim()
                      ? `Log In with Config ID (${customConfigId.trim()})`
                      : "Log In with Facebook"}
                  </span>
                </button>

                {/* Manual Enter Meta Configuration ID Button (Replaces Sandbox Simulation) */}
                <button
                  id="enter-meta-config-btn"
                  type="button"
                  onClick={() => setShowConfigIdInput(!showConfigIdInput)}
                  className={`w-full sm:w-auto px-6 py-3.5 border text-xs font-[Manrope] font-bold tracking-wider uppercase rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                    showConfigIdInput
                      ? "bg-blue-50 border-[#0668E1] text-[#0668E1]"
                      : "bg-white border-[#c6c6cd] hover:bg-slate-50 text-[#0b1c30]"
                  }`}
                >
                  <MdTune className="text-base text-[#0668E1]" />
                  <span>{showConfigIdInput ? "Close Configuration ID" : "Enter Meta Configuration ID"}</span>
                </button>
              </div>

              {/* Collapsible Manual Meta Configuration ID Input */}
              {showConfigIdInput && (
                <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-xl text-left max-w-[540px] mx-auto transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-[Manrope] font-bold text-[#0b1c30] uppercase tracking-wider">
                      Meta Business Login Configuration ID
                    </label>
                    {customConfigId && (
                      <button
                        type="button"
                        onClick={() => setCustomConfigId("")}
                        className="text-[11px] font-[Manrope] font-semibold text-slate-400 hover:text-red-500 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={customConfigId}
                    onChange={(e) => setCustomConfigId(e.target.value)}
                    placeholder="e.g. 104465837886960 (from Meta App > Configurations)"
                    className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0668E1]"
                  />
                  <p className="text-[11px] font-[Manrope] text-[#7c839b] mt-1.5">
                    Applies your custom permission configuration from Meta App Dashboard instead of standard scopes.
                  </p>
                </div>
              )}

              <p className="text-[11px] font-[Manrope] text-slate-400 mt-5">
                Opens the secure Meta OAuth 2.0 permission dialog to connect your business assets.
              </p>
            </div>

            {/* Value Proposition Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#1877F2] flex items-center justify-center mb-3">
                  <SiFacebook className="text-xl" />
                </div>
                <h3 className="text-sm font-serif font-bold text-[#0b1c30] mb-1">Facebook & Instagram</h3>
                <p className="text-xs font-[Manrope] text-[#7c839b] leading-relaxed">
                  Automatically extracts permanent Page tokens and Instagram business account IDs for publishing drops and tracking insights.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#25D366] flex items-center justify-center mb-3">
                  <SiWhatsapp className="text-xl" />
                </div>
                <h3 className="text-sm font-serif font-bold text-[#0b1c30] mb-1">WhatsApp Business</h3>
                <p className="text-xs font-[Manrope] text-[#7c839b] leading-relaxed">
                  Discovers your registered WABA and official phone numbers. Auto-configures order notifications and VIP concierge journeys.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                  <MdStore className="text-xl" />
                </div>
                <h3 className="text-sm font-serif font-bold text-[#0b1c30] mb-1">Catalog & Ads</h3>
                <p className="text-xs font-[Manrope] text-[#7c839b] leading-relaxed">
                  Links your Meta Commerce catalog for Instagram Shopping and binds your Ad Account for real-time campaign spend tracking.
                </p>
              </div>
            </div>

            {/* Production Setup & Meta Security Configuration Dropdown */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden transition-all">
              <button
                id="toggle-production-config-dropdown-btn"
                type="button"
                onClick={() => setShowProductionConfig(!showProductionConfig)}
                className="w-full p-5 sm:p-6 flex items-center justify-between text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#0668E1] flex items-center justify-center shrink-0">
                    <MdTune className="text-xl" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-serif font-bold text-[#0b1c30]">
                        Production Configuration &amp; Meta Developer Settings
                      </h3>
                      <span className="text-[10px] font-[Manrope] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        Live App Setup
                      </span>
                    </div>
                    <p className="text-xs font-[Manrope] text-[#7c839b] mt-0.5">
                      Environment variables, HTTPS Strict enforcement, and OAuth redirect URIs.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-xs font-[Manrope] font-semibold text-[#0668E1] hidden sm:inline">
                    {showProductionConfig ? "Close Guide" : "Open Dropdown"}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                    {showProductionConfig ? (
                      <MdExpandLess className="text-xl" />
                    ) : (
                      <MdExpandMore className="text-xl" />
                    )}
                  </div>
                </div>
              </button>

              {showProductionConfig && (
                <div className="p-6 pt-3 border-t border-slate-100 space-y-6">
                  {/* Production Configuration */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                      <MdTune className="text-lg" />
                    </div>
                    <div className="w-full">
                      <h3 className="text-sm font-serif font-bold text-[#0b1c30] mb-1">Production Configuration</h3>
                      <p className="text-xs font-[Manrope] text-[#7c839b] leading-relaxed mb-4">
                        To connect to a live Meta App in production, provide these environment variables:
                      </p>
                      <div className="bg-slate-50 rounded-lg p-3 font-mono text-xs text-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span>META_APP_ID=&lt;your_meta_app_id&gt;</span>
                          <button
                            onClick={() => copyToClipboard("META_APP_ID=", "app_id")}
                            className="text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {copiedKey === "app_id" ? <MdCheck className="text-green-600" /> : <MdContentCopy />}
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>META_APP_SECRET=&lt;your_meta_app_secret&gt;</span>
                          <button
                            onClick={() => copyToClipboard("META_APP_SECRET=", "app_secret")}
                            className="text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {copiedKey === "app_secret" ? <MdCheck className="text-green-600" /> : <MdContentCopy />}
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>META_CONFIG_ID=&lt;optional_business_login_config_id&gt;</span>
                          <button
                            onClick={() => copyToClipboard("META_CONFIG_ID=", "config_id")}
                            className="text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {copiedKey === "config_id" ? <MdCheck className="text-green-600" /> : <MdContentCopy />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Meta App Security & OAuth Settings Guide */}
                  <div className="flex items-start gap-3 pt-4 border-t border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0668E1] flex items-center justify-center shrink-0 mt-0.5">
                      <MdSecurity className="text-lg" />
                    </div>
                    <div className="w-full">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <h3 className="text-sm font-serif font-bold text-[#0b1c30]">
                          Meta Developer Security &amp; OAuth Settings
                        </h3>
                        <span className="text-[11px] font-[Manrope] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                          HTTPS Strict Enforced
                        </span>
                      </div>
                      <p className="text-xs font-[Manrope] text-[#7c839b] leading-relaxed mb-4">
                        To resolve the error <em>&ldquo;Facebook has detected Prigid business inc isn&apos;t using a secure connection&rdquo;</em>,
                        ensure your app settings in the{" "}
                        <a
                          href="https://developers.facebook.com/apps"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0668E1] hover:underline font-semibold inline-flex items-center gap-0.5"
                        >
                          Meta Developer Portal <MdOpenInNew className="text-[10px]" />
                        </a>{" "}
                        use the following exact HTTPS URLs:
                      </p>

                      <div className="grid grid-cols-1 gap-3">
                        {/* Valid OAuth Redirect URI */}
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/70">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-[Manrope] font-bold uppercase tracking-wider text-slate-500">
                              1. Valid OAuth Redirect URI (Facebook Login Settings)
                            </span>
                            <button
                              onClick={() => copyToClipboard(oauthRedirectUri, "redirect_uri")}
                              className="text-xs font-[Manrope] font-semibold text-[#0668E1] hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedKey === "redirect_uri" ? (
                                <>
                                  <MdCheck className="text-green-600 text-sm" />
                                  <span className="text-green-600">Copied</span>
                                </>
                              ) : (
                                <>
                                  <MdContentCopy className="text-sm" />
                                  <span>Copy URI</span>
                                </>
                              )}
                            </button>
                          </div>
                          <code className="block font-mono text-xs text-slate-800 break-all select-all">
                            {oauthRedirectUri}
                          </code>
                        </div>

                        {/* App Domains & Site URL */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/70">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-[Manrope] font-bold uppercase tracking-wider text-slate-500">
                                2. App Domains (Settings &gt; Basic)
                              </span>
                              <button
                                onClick={() => copyToClipboard(currentHostname, "hostname")}
                                className="text-xs font-[Manrope] font-semibold text-[#0668E1] hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                              >
                                {copiedKey === "hostname" ? (
                                  <>
                                    <MdCheck className="text-green-600 text-sm" />
                                    <span className="text-green-600">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <MdContentCopy className="text-sm" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <code className="block font-mono text-xs text-slate-800 break-all select-all">
                              {currentHostname}
                            </code>
                          </div>

                          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/70">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-[Manrope] font-bold uppercase tracking-wider text-slate-500">
                                3. Site URL (Settings &gt; Website)
                              </span>
                              <button
                                onClick={() => copyToClipboard(siteUrl, "site_url")}
                                className="text-xs font-[Manrope] font-semibold text-[#0668E1] hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                              >
                                {copiedKey === "site_url" ? (
                                  <>
                                    <MdCheck className="text-green-600 text-sm" />
                                    <span className="text-green-600">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <MdContentCopy className="text-sm" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <code className="block font-mono text-xs text-slate-800 break-all select-all">
                              {siteUrl}
                            </code>
                          </div>
                        </div>

                        {/* Privacy & Terms URLs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/70">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-[Manrope] font-bold uppercase tracking-wider text-slate-500">
                                4. Privacy Policy URL
                              </span>
                              <button
                                onClick={() => copyToClipboard(privacyPolicyUrl, "privacy_url")}
                                className="text-xs font-[Manrope] font-semibold text-[#0668E1] hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                              >
                                {copiedKey === "privacy_url" ? (
                                  <>
                                    <MdCheck className="text-green-600 text-sm" />
                                    <span className="text-green-600">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <MdContentCopy className="text-sm" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <code className="block font-mono text-xs text-slate-800 break-all select-all">
                              {privacyPolicyUrl}
                            </code>
                          </div>

                          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/70">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-[Manrope] font-bold uppercase tracking-wider text-slate-500">
                                5. Terms of Service URL
                              </span>
                              <button
                                onClick={() => copyToClipboard(termsUrl, "terms_url")}
                                className="text-xs font-[Manrope] font-semibold text-[#0668E1] hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                              >
                                {copiedKey === "terms_url" ? (
                                  <>
                                    <MdCheck className="text-green-600 text-sm" />
                                    <span className="text-green-600">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <MdContentCopy className="text-sm" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <code className="block font-mono text-xs text-slate-800 break-all select-all">
                              {termsUrl}
                            </code>
                          </div>
                        </div>
                      </div>

                      {/* Checklist summary */}
                      <div className="mt-4 p-3.5 bg-blue-50/50 rounded-lg border border-blue-100 text-xs font-[Manrope] text-slate-700 space-y-1.5">
                        <div className="font-bold text-[#0b1c30] flex items-center gap-1.5">
                          <MdCheckCircle className="text-[#0668E1] text-sm" />
                          Required Settings in Meta for &ldquo;Prigid business inc&rdquo;:
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                          <li>In <strong>Facebook Login for Business &gt; Settings</strong>: Ensure <strong>Enforce HTTPS</strong> is <strong>ON</strong>.</li>
                          <li>Under <strong>Valid OAuth Redirect URIs</strong>: Add <code>{oauthRedirectUri}</code> and remove any plain <code>http://</code> URIs.</li>
                          <li>In <strong>App settings &gt; Basic</strong>: Ensure <strong>Site URL</strong>, <strong>Privacy Policy URL</strong>, and <strong>Terms of Service URL</strong> all use <code>https://</code>.</li>
                          <li>
                            <strong>Missing WhatsApp in Config UI?</strong> If WhatsApp is not included when selecting assets during the Facebook Login for Business configuration process, it is because Facebook Login for Business UI does not natively support WhatsApp asset selection out of the box in the visual builder yet. To connect WhatsApp, simply leave the Configuration ID blank on this page to use the default unified suite.
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
