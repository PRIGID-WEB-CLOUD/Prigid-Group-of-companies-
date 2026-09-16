import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { SiPinterest } from "react-icons/si";
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
  MdVerified,
  MdCollections,
} from "react-icons/md";
import AdminLayout from "./AdminLayout";

type PinterestConfig = {
  appId: string;
  appSecret: string;
  merchantId: string;
  verifiedDomain: string;
  richPinsEnabled: boolean;
  autoCreateBoards: boolean;
  connected: boolean;
};

export default function AdminPinterestPage() {
  const queryClient = useQueryClient();
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [verifiedDomain, setVerifiedDomain] = useState("");
  const [richPins, setRichPins] = useState(true);
  const [autoBoards, setAutoBoards] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const { data: config } = useQuery<PinterestConfig>({
    queryKey: ["pinterest-config"],
    queryFn: async () => {
      const res = await fetch("/api/channels/pinterest/config");
      if (!res.ok) throw new Error("Failed to load Pinterest settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (config) {
      setAppId(config.appId || "");
      setAppSecret(config.appSecret || "");
      setMerchantId(config.merchantId || "");
      setVerifiedDomain(config.verifiedDomain || "");
      setRichPins(config.richPinsEnabled ?? true);
      setAutoBoards(config.autoCreateBoards ?? true);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/channels/pinterest/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId,
          appSecret,
          merchantId,
          verifiedDomain,
          richPinsEnabled: richPins,
          autoCreateBoards: autoBoards,
        }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pinterest-config"] });
      showToast("Pinterest configuration and Merchant settings saved successfully!");
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/channels/pinterest/sync-pins", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: (data) => {
      showToast(`Lookbooks synchronized! Generated ${data.syncedPins} Rich Product Pins across seasonal boards.`);
    },
  });

  const isConnected = Boolean(config?.connected || (appId && merchantId));

  return (
    <AdminLayout sidebar="main">
      <div className="p-4 sm:p-8 bg-[#f8f9ff] min-h-screen">
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
                <div className="w-8 h-8 rounded-lg bg-[#E60023] text-white flex items-center justify-center">
                  <SiPinterest className="text-lg" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-black">
                  Pinterest Luxury Lookbook
                </h1>
              </div>
              <p className="text-xs font-[Manrope] text-[#7c839b] mt-0.5">
                Visual discovery, Verified Merchant Program, and automatic Rich Product Pin generation
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
          <div className="col-span-12 lg:col-span-7 space-y-6">
            <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] p-6 sm:p-8 space-y-5">
              <h2 className="font-serif text-lg font-semibold text-black border-b border-[#f0f2ff] pb-3">
                Pinterest Business & Merchant API
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">
                    Pinterest App ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="e.g. 1498234"
                    className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-3 font-[Manrope] text-sm outline-none focus:border-black transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">
                    Merchant Account ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={merchantId}
                    onChange={(e) => setMerchantId(e.target.value)}
                    placeholder="e.g. pin_m_983274"
                    className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-3 font-[Manrope] text-sm outline-none focus:border-black transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">
                  Pinterest App Secret <span className="text-red-500">*</span>
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

              <div>
                <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">
                  Verified Merchant Domain
                </label>
                <input
                  type="text"
                  value={verifiedDomain}
                  onChange={(e) => setVerifiedDomain(e.target.value)}
                  placeholder="luxeboutique.com"
                  className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-3 font-[Manrope] text-sm outline-none focus:border-black transition-colors"
                />
              </div>

              {/* Toggles */}
              <div className="pt-4 border-t border-[#f0f2ff] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MdVerified className="text-xl text-[#006c49]" />
                    <div>
                      <p className="text-xs font-[Manrope] font-bold text-black">Rich Product Pins</p>
                      <p className="text-[11px] font-[Manrope] text-[#7c839b]">
                        Include live price tag, stock status, and title metadata on every pinned photo
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={richPins}
                    onChange={(e) => setRichPins(e.target.checked)}
                    className="w-4 h-4 accent-black rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MdCollections className="text-xl text-[#006c49]" />
                    <div>
                      <p className="text-xs font-[Manrope] font-bold text-black">Seasonal Lookbook Boards</p>
                      <p className="text-[11px] font-[Manrope] text-[#7c839b]">
                        Automatically generate curated category boards matching boutique collections
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoBoards}
                    onChange={(e) => setAutoBoards(e.target.checked)}
                    className="w-4 h-4 accent-black rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f2ff]">
                <button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending || !isConnected}
                  className="px-5 py-2.5 border border-[#c6c6cd] rounded-lg text-xs font-[Manrope] font-bold uppercase tracking-wider hover:bg-[#f0f2ff] transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <MdSync className={`text-base ${syncMutation.isPending ? "animate-spin" : ""}`} />
                  {syncMutation.isPending ? "Syncing Lookbooks…" : "Sync Pins to Boards"}
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

          <div className="col-span-12 lg:col-span-5 space-y-6">
            <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] p-6 space-y-4">
              <h3 className="font-serif text-sm font-semibold flex items-center gap-2 text-black">
                <MdHelp className="text-[#006c49] text-base" />
                Pinterest Verified Merchant
              </h3>
              <div className="space-y-3 text-xs font-[Manrope] text-[#45464d]">
                <p className="leading-relaxed">
                  Joining the <strong>Pinterest Verified Merchant Program</strong> awards your boutique profile a blue checkmark and gives your products exclusive shop tab placement.
                </p>
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-[11px] text-red-900 leading-relaxed">
                  Rich Pins automatically scrape OpenGraph and Schema.org microdata from your live product pages to ensure pricing accuracy across all shared pins.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
