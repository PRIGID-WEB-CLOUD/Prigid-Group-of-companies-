import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { SiTiktok } from "react-icons/si";
import {
  MdCheckCircle,
  MdRadioButtonUnchecked,
  MdAutorenew,
  MdSync,
  MdSave,
  MdHelp,
  MdArrowBack,
  MdVisibility,
  MdVisibilityOff,
  MdContentCopy,
  MdStorefront,
  MdLiveTv,
  MdPercent,
} from "react-icons/md";
import AdminLayout from "./AdminLayout";

type TikTokConfig = {
  appKey: string;
  appSecret: string;
  shopId: string;
  shopName: string;
  connected: boolean;
  autoSyncProducts: boolean;
  liveCommerceEnabled: boolean;
  creatorCommissionRate: string;
};

export default function AdminTikTokPage() {
  const queryClient = useQueryClient();
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [shopId, setShopId] = useState("");
  const [shopName, setShopName] = useState("Luxe Boutique TikTok Store");
  const [autoSync, setAutoSync] = useState(true);
  const [liveCommerce, setLiveCommerce] = useState(true);
  const [commissionRate, setCommissionRate] = useState("15");
  const [showSecret, setShowSecret] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const { data: config, isLoading } = useQuery<TikTokConfig>({
    queryKey: ["tiktok-config"],
    queryFn: async () => {
      const res = await fetch("/api/channels/tiktok/config");
      if (!res.ok) throw new Error("Failed to load TikTok configuration");
      return res.json();
    },
  });

  useEffect(() => {
    if (config) {
      setAppKey(config.appKey || "");
      setAppSecret(config.appSecret || "");
      setShopId(config.shopId || "");
      setShopName(config.shopName || "Luxe Boutique TikTok Store");
      setAutoSync(config.autoSyncProducts ?? true);
      setLiveCommerce(config.liveCommerceEnabled ?? true);
      setCommissionRate(config.creatorCommissionRate || "15");
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/channels/tiktok/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appKey,
          appSecret,
          shopId,
          shopName,
          autoSyncProducts: autoSync,
          liveCommerceEnabled: liveCommerce,
          creatorCommissionRate: commissionRate,
        }),
      });
      if (!res.ok) throw new Error("Failed to save configuration");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-config"] });
      showToast("TikTok Shop credentials and settings saved successfully!");
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/channels/tiktok/sync-catalog", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: (data) => {
      showToast(`Catalog synced! ${data.syncedCount} luxury items active on TikTok Shop.`);
    },
  });

  const isConnected = Boolean(config?.connected || (appKey && shopId));

  return (
    <AdminLayout sidebar="main">
      <div className="p-4 sm:p-8 bg-[#f8f9ff] min-h-screen">
        {/* Top bar navigation */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link
              href="/channels"
              className="w-10 h-10 rounded-xl bg-white border border-[#e5eeff] flex items-center justify-center text-[#7c839b] hover:text-black shadow-sm transition-colors"
            >
              <MdArrowBack className="text-xl" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center">
                  <SiTiktok className="text-lg" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-black">
                  TikTok Shop for Luxury
                </h1>
              </div>
              <p className="text-xs font-[Manrope] text-[#7c839b] mt-0.5">
                Live commerce sync, short-form video tagging, and creator affiliate drops
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-[Manrope] font-bold uppercase tracking-wider ${
              isConnected ? "text-[#006c49] bg-[#e6f7f1]" : "text-[#7c839b] bg-[#f0f2ff]"
            }`}
          >
            {isConnected ? <MdCheckCircle className="text-sm" /> : <MdRadioButtonUnchecked className="text-sm" />}
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {toast && (
          <div className="mb-6 p-4 bg-[#e6f7f1] border border-[#a8e8cc] text-[#006c49] rounded-xl flex items-center gap-2 text-sm font-[Manrope] font-bold">
            <MdCheckCircle className="text-lg" />
            {toast}
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Main Credentials Form */}
          <div className="col-span-12 lg:col-span-7 space-y-6">
            <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] p-6 sm:p-8 space-y-5">
              <h2 className="font-serif text-lg font-semibold text-black border-b border-[#f0f2ff] pb-3">
                TikTok Open Platform API Credentials
              </h2>

              <div>
                <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">
                  TikTok App Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={appKey}
                  onChange={(e) => setAppKey(e.target.value)}
                  placeholder="e.g. 6a7b8c9d0e1f"
                  className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-3 font-[Manrope] text-sm outline-none focus:border-black transition-colors"
                />
                <p className="mt-1 text-[11px] font-[Manrope] text-[#7c839b]">
                  Obtain from your TikTok Developer Portal App details.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">
                  TikTok App Secret <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-3 font-[Manrope] text-sm outline-none focus:border-black transition-colors pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7c839b] hover:text-black transition-colors"
                  >
                    {showSecret ? <MdVisibilityOff className="text-lg" /> : <MdVisibility className="text-lg" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">
                    TikTok Shop ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={shopId}
                    onChange={(e) => setShopId(e.target.value)}
                    placeholder="e.g. USLC123456"
                    className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-3 font-[Manrope] text-sm outline-none focus:border-black transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">
                    Shop Display Name
                  </label>
                  <input
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Luxe Boutique TikTok Store"
                    className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-3 font-[Manrope] text-sm outline-none focus:border-black transition-colors"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-4 border-t border-[#f0f2ff] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MdStorefront className="text-xl text-[#006c49]" />
                    <div>
                      <p className="text-xs font-[Manrope] font-bold text-black">Auto-Sync Catalog Products</p>
                      <p className="text-[11px] font-[Manrope] text-[#7c839b]">
                        Synchronize catalog inventory and price updates with TikTok Seller Center
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                    className="w-4 h-4 accent-black rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MdLiveTv className="text-xl text-[#006c49]" />
                    <div>
                      <p className="text-xs font-[Manrope] font-bold text-black">Live Shopping Pins</p>
                      <p className="text-[11px] font-[Manrope] text-[#7c839b]">
                        Enable one-tap shopping showcase during TikTok Live broadcasts
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={liveCommerce}
                    onChange={(e) => setLiveCommerce(e.target.checked)}
                    className="w-4 h-4 accent-black rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MdPercent className="text-xl text-[#006c49]" />
                    <div>
                      <p className="text-xs font-[Manrope] font-bold text-black">Creator Affiliate Commission</p>
                      <p className="text-[11px] font-[Manrope] text-[#7c839b]">
                        Default payout percentage for fashion creators tagging boutique items
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)}
                      className="w-16 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-2 py-1 text-center font-[Manrope] text-xs font-bold"
                    />
                    <span className="text-xs font-bold font-[Manrope]">%</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f2ff]">
                <button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending || !isConnected}
                  className="px-5 py-2.5 border border-[#c6c6cd] rounded-lg text-xs font-[Manrope] font-bold uppercase tracking-wider hover:bg-[#f0f2ff] transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <MdSync className={`text-base ${syncMutation.isPending ? "animate-spin" : ""}`} />
                  {syncMutation.isPending ? "Syncing Catalog…" : "Sync Catalog Now"}
                </button>

                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="px-6 py-2.5 bg-black text-white rounded-lg text-xs font-[Manrope] font-bold uppercase tracking-wider hover:bg-[#006c49] transition-all flex items-center gap-2 shadow disabled:opacity-50"
                >
                  {saveMutation.isPending ? <MdAutorenew className="animate-spin text-base" /> : <MdSave className="text-base" />}
                  Save Settings
                </button>
              </div>
            </div>
          </div>

          {/* Guide & Webhook info */}
          <div className="col-span-12 lg:col-span-5 space-y-6">
            <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] p-6 space-y-4">
              <h3 className="font-serif text-sm font-semibold flex items-center gap-2 text-black">
                <MdHelp className="text-[#006c49] text-base" />
                Setup Instructions
              </h3>
              <div className="space-y-3 text-xs font-[Manrope] text-[#45464d]">
                <div className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#006c49] text-white font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                  <p>Register as a Seller at <strong>TikTok Shop Seller Center</strong>.</p>
                </div>
                <div className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#006c49] text-white font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                  <p>Create a custom app under <strong>TikTok Developer Portal</strong> and request <em>Product & Order Management</em> permissions.</p>
                </div>
                <div className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#006c49] text-white font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                  <p>Paste the App Key, Secret, and Shop ID into this panel to activate real-time catalog syncing.</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] p-6 space-y-3">
              <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b]">
                Webhook Endpoint
              </p>
              <div className="bg-[#f8f9ff] border border-[#e5eeff] rounded-lg p-3 flex items-center justify-between gap-2">
                <code className="text-xs font-mono text-[#006c49] truncate">
                  /api/channels/tiktok/webhook
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/api/channels/tiktok/webhook`);
                    showToast("Webhook URL copied to clipboard!");
                  }}
                  className="p-1.5 text-[#7c839b] hover:text-[#006c49] transition-colors"
                >
                  <MdContentCopy className="text-sm" />
                </button>
              </div>
              <p className="text-[11px] font-[Manrope] text-[#7c839b]">
                Add this URL to your TikTok Developer App for order notifications and fulfillment updates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
