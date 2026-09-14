import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { SiMeta } from "react-icons/si";
import {
  MdArrowBack,
  MdCampaign,
  MdKey,
  MdAccountBalance,
  MdBarChart,
  MdRefresh,
  MdVisibility,
  MdAdsClick,
  MdPayments,
  MdPercent,
  MdAttachMoney,
  MdPeople,
  MdRepeat,
  MdLayers,
  MdPhotoLibrary,
  MdAdd,
  MdDelete,
  MdEdit,
  MdPlayArrow,
  MdPause,
  MdInsights,
  MdClose,
  MdCheckCircle,
  MdCloudUpload,
  MdLink,
} from "react-icons/md";
import AdminLayout from "./AdminLayout";

type Tab = "credentials" | "account" | "insights" | "campaigns" | "adsets" | "ads";

interface AdAccount {
  id: string;
  name: string;
  currency: string;
  account_status: number;
  amount_spent: string;
  balance: string;
}

interface AdInsights {
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  cpc?: string;
  reach?: string;
  frequency?: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  budget_remaining?: string;
  daily_budget?: string;
}

interface AdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  billing_event?: string;
}

interface Ad {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  creative?: {
    id?: string;
    name?: string;
    title?: string;
    body?: string;
    image_url?: string;
  };
}

interface CampaignInsight {
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  cpc?: string;
  reach?: string;
}

const DATE_PRESETS = [
  { value: "maximum", label: "Lifetime (All Time)" },
  { value: "last_30d", label: "Last 30 Days" },
  { value: "last_14d", label: "Last 14 Days" },
  { value: "last_7d", label: "Last 7 Days" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_90d", label: "Last 90 Days" },
];

const CAMPAIGN_OBJECTIVES = [
  { value: "OUTCOME_SALES", label: "Sales & Conversions" },
  { value: "OUTCOME_TRAFFIC", label: "Traffic & Link Clicks" },
  { value: "OUTCOME_AWARENESS", label: "Brand Awareness & Reach" },
  { value: "OUTCOME_ENGAGEMENT", label: "Post Engagement" },
  { value: "OUTCOME_LEADS", label: "Lead Generation" },
];

function CredField({
  label,
  hint,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hint}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006c49]/20 focus:border-[#006c49] font-mono"
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-lg text-[#1877F2]">{icon}</div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminMetaAdsPage() {
  const [tab, setTab] = useState<Tab>("credentials");
  const [creds, setCreds] = useState({ ad_account_id: "", page_access_token: "", source: "" });
  const [metaStatus, setMetaStatus] = useState<{ connected: boolean; business?: { id: string; name: string } } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [account, setAccount] = useState<AdAccount | null>(null);
  const [accountErr, setAccountErr] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);

  const [insights, setInsights] = useState<AdInsights | null>(null);
  const [insightsErr, setInsightsErr] = useState("");
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsFetched, setInsightsFetched] = useState(false);
  const [insightsHasActivity, setInsightsHasActivity] = useState(false);
  const [insightsActId, setInsightsActId] = useState("");
  const [datePreset, setDatePreset] = useState("maximum");

  // Campaigns
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsErr, setCampaignsErr] = useState("");

  // Ad Sets
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [adSetsLoading, setAdSetsLoading] = useState(false);
  const [adSetsErr, setAdSetsErr] = useState("");
  const [adSetCampaignFilter, setAdSetCampaignFilter] = useState<string>("all");

  // Ads
  const [ads, setAds] = useState<Ad[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adsErr, setAdsErr] = useState("");
  const [adAdSetFilter, setAdAdSetFilter] = useState<string>("all");

  // Global Notification / Toast
  const [actionMsg, setActionMsg] = useState("");

  // Create Campaign Modal
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    objective: "OUTCOME_SALES",
    dailyBudget: "20.00",
    status: "PAUSED",
  });
  const [campaignSaving, setCampaignSaving] = useState(false);

  // Edit Campaign Modal
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editCampaignForm, setEditCampaignForm] = useState({
    name: "",
    dailyBudget: "",
  });
  const [campaignUpdating, setCampaignUpdating] = useState(false);

  // Delete Campaign Confirmation
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);
  const [deleteCampaignLoading, setDeleteCampaignLoading] = useState(false);

  // Campaign Insights Modal
  const [insightsCampaign, setInsightsCampaign] = useState<Campaign | null>(null);
  const [campaignInsights, setCampaignInsights] = useState<CampaignInsight | null>(null);
  const [campaignInsightsLoading, setCampaignInsightsLoading] = useState(false);
  const [campaignInsightsErr, setCampaignInsightsErr] = useState("");
  const [campaignPreset, setCampaignPreset] = useState("maximum");

  // Create Ad Set Modal
  const [isCreatingAdSet, setIsCreatingAdSet] = useState(false);
  const [adSetForm, setAdSetForm] = useState({
    name: "",
    campaignId: "",
    dailyBudget: "10.00",
    optimizationGoal: "OFFSITE_CONVERSIONS",
    billingEvent: "IMPRESSIONS",
    status: "PAUSED",
  });
  const [adSetSaving, setAdSetSaving] = useState(false);

  // Create Ad Modal
  const [isCreatingAd, setIsCreatingAd] = useState(false);
  const [adForm, setAdForm] = useState({
    name: "",
    adSetId: "",
    headline: "",
    message: "",
    link: window.location.origin,
    imageUrl: "",
    status: "PAUSED",
  });
  const [adSaving, setAdSaving] = useState(false);
  const [adMediaSource, setAdMediaSource] = useState<"upload" | "url">("upload");
  const [adUploadingImage, setAdUploadingImage] = useState(false);
  const [adUploadError, setAdUploadError] = useState<string | null>(null);
  const adFileInputRef = useRef<HTMLInputElement>(null);

  const handleAdFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setAdUploadError("Please upload an image file (JPG, PNG, WebP, GIF, AVIF).");
      return;
    }
    setAdUploadingImage(true);
    setAdUploadError(null);
    const formData = new FormData();
    formData.append("files", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }
      const uploadedUrl = data.urls?.[0] || data.url;
      if (uploadedUrl) {
        setAdForm((prev) => ({ ...prev, imageUrl: uploadedUrl }));
        setActionMsg("Image uploaded successfully for ad creative.");
      }
    } catch (err: any) {
      setAdUploadError(err.message || "Failed to upload image.");
    } finally {
      setAdUploadingImage(false);
      if (adFileInputRef.current) adFileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    fetch("/api/channels/credentials/ads", { credentials: "include" })
      .then((r) => r.json())
      .then((d: Record<string, string>) => {
        setCreds({
          ad_account_id: d.ad_account_id ?? "",
          page_access_token: d.page_access_token ?? "",
          source: d.source ?? "",
        });
      })
      .catch(() => {});

    fetch("/api/channels/meta/status", { credentials: "include" })
      .then((r) => r.json())
      .then((m) => {
        setMetaStatus(m);
      })
      .catch(() => {});
  }, []);

  async function saveCreds() {
    setSaving(true);
    setSaveMsg("");
    try {
      await fetch("/api/channels/credentials/ads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(creds),
      });
      setSaveMsg("Credentials saved successfully.");
    } catch {
      setSaveMsg("Save failed.");
    }
    setSaving(false);
  }

  async function fetchAccount() {
    setAccountLoading(true);
    setAccountErr("");
    try {
      const r = await fetch("/api/facebook/ads/account", { credentials: "include" });
      const d = await r.json();
      if (!r.ok) setAccountErr(d.error ?? "Failed");
      else setAccount(d);
    } catch {
      setAccountErr("Network error");
    }
    setAccountLoading(false);
  }

  async function fetchInsights(presetToUse?: string) {
    const p = presetToUse ?? datePreset;
    setInsightsLoading(true);
    setInsightsErr("");
    try {
      const r = await fetch(`/api/facebook/ads/insights?date_preset=${p}`, {
        credentials: "include",
      });
      const d = await r.json();
      setInsightsFetched(true);
      if (!r.ok) {
        setInsightsErr(d.error ?? "Failed to fetch insights from Meta Graph API.");
        setInsights(null);
      } else {
        setInsightsActId(d.actId || creds.ad_account_id);
        if (d.data && d.data.length > 0) {
          setInsights(d.data[0]);
          setInsightsHasActivity(true);
        } else {
          setInsights({
            impressions: "0",
            clicks: "0",
            spend: "0.00",
            ctr: "0.00",
            cpc: "0.00",
            reach: "0",
            frequency: "0.00",
          });
          setInsightsHasActivity(false);
        }
      }
    } catch {
      setInsightsErr("Network error connecting to Meta Ads insights endpoint.");
      setInsights(null);
    }
    setInsightsLoading(false);
  }

  async function fetchCampaigns() {
    setCampaignsLoading(true);
    setCampaignsErr("");
    try {
      const r = await fetch("/api/facebook/ads/campaigns", { credentials: "include" });
      const d = await r.json();
      if (!r.ok) setCampaignsErr(d.error ?? "Failed to load campaigns.");
      else setCampaigns(d.data ?? []);
    } catch {
      setCampaignsErr("Network error");
    }
    setCampaignsLoading(false);
  }

  async function fetchAdSets(campId?: string) {
    setAdSetsLoading(true);
    setAdSetsErr("");
    try {
      const q = campId && campId !== "all" ? `?campaign_id=${encodeURIComponent(campId)}` : "";
      const r = await fetch(`/api/facebook/ads/adsets${q}`, { credentials: "include" });
      const d = await r.json();
      if (!r.ok) setAdSetsErr(d.error ?? "Failed to load ad sets.");
      else setAdSets(d.data ?? []);
    } catch {
      setAdSetsErr("Network error");
    }
    setAdSetsLoading(false);
  }

  async function fetchAds(adsetId?: string) {
    setAdsLoading(true);
    setAdsErr("");
    try {
      const q = adsetId && adsetId !== "all" ? `?adset_id=${encodeURIComponent(adsetId)}` : "";
      const r = await fetch(`/api/facebook/ads/ads${q}`, { credentials: "include" });
      const d = await r.json();
      if (!r.ok) setAdsErr(d.error ?? "Failed to load ads.");
      else setAds(d.data ?? []);
    } catch {
      setAdsErr("Network error");
    }
    setAdsLoading(false);
  }

  // Toggle Campaign Status
  async function toggleCampaignStatus(c: Campaign) {
    const nextStatus = c.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const r = await fetch(`/api/facebook/ads/campaigns/${c.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });
      const d = await r.json();
      if (!r.ok) {
        setActionMsg(`Error: ${d.error || "Failed to update campaign status."}`);
      } else {
        setCampaigns((prev) =>
          prev.map((item) => (item.id === c.id ? { ...item, status: nextStatus } : item))
        );
        setActionMsg(`Campaign "${c.name}" status updated to ${nextStatus}.`);
      }
    } catch {
      setActionMsg("Network error updating campaign status.");
    }
  }

  // Create Campaign
  async function handleCreateCampaign() {
    if (!campaignForm.name.trim()) return;
    setCampaignSaving(true);
    try {
      const r = await fetch("/api/facebook/ads/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: campaignForm.name,
          objective: campaignForm.objective,
          status: campaignForm.status,
          daily_budget: campaignForm.dailyBudget ? parseFloat(campaignForm.dailyBudget) : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setActionMsg(`Error: ${d.error || "Failed to create campaign."}`);
      } else {
        setIsCreatingCampaign(false);
        setCampaignForm({
          name: "",
          objective: "OUTCOME_SALES",
          dailyBudget: "20.00",
          status: "PAUSED",
        });
        setActionMsg("Campaign successfully created on Meta Ads.");
        fetchCampaigns();
      }
    } catch {
      setActionMsg("Network error creating campaign.");
    }
    setCampaignSaving(false);
  }

  // Edit Campaign
  function startEditCampaign(c: Campaign) {
    setEditingCampaign(c);
    const rawBudget = c.daily_budget ? (parseInt(c.daily_budget) / 100).toFixed(2) : "";
    setEditCampaignForm({
      name: c.name,
      dailyBudget: rawBudget,
    });
  }

  async function handleSaveCampaign() {
    if (!editingCampaign) return;
    setCampaignUpdating(true);
    try {
      const r = await fetch(`/api/facebook/ads/campaigns/${editingCampaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editCampaignForm.name,
          daily_budget: editCampaignForm.dailyBudget ? parseFloat(editCampaignForm.dailyBudget) : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setActionMsg(`Error: ${d.error || "Failed to update campaign."}`);
      } else {
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === editingCampaign.id
              ? {
                  ...c,
                  name: editCampaignForm.name,
                  daily_budget: editCampaignForm.dailyBudget
                    ? String(Math.round(parseFloat(editCampaignForm.dailyBudget) * 100))
                    : c.daily_budget,
                }
              : c
          )
        );
        setEditingCampaign(null);
        setActionMsg("Campaign updated on Meta Ads.");
      }
    } catch {
      setActionMsg("Network error updating campaign.");
    }
    setCampaignUpdating(false);
  }

  // Delete Campaign
  async function handleConfirmDeleteCampaign() {
    if (!deletingCampaign) return;
    setDeleteCampaignLoading(true);
    try {
      const r = await fetch(`/api/facebook/ads/campaigns/${deletingCampaign.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) {
        setActionMsg(`Error: ${d.error || "Failed to delete campaign."}`);
      } else {
        setCampaigns((prev) => prev.filter((c) => c.id !== deletingCampaign.id));
        setActionMsg(`Campaign "${deletingCampaign.name}" deleted from Meta.`);
        setDeletingCampaign(null);
      }
    } catch {
      setActionMsg("Network error deleting campaign.");
    }
    setDeleteCampaignLoading(false);
  }

  // Campaign Insights
  async function openCampaignInsights(c: Campaign, preset?: string) {
    const p = preset ?? campaignPreset;
    setInsightsCampaign(c);
    setCampaignInsights(null);
    setCampaignInsightsErr("");
    setCampaignInsightsLoading(true);
    try {
      const r = await fetch(`/api/facebook/ads/campaigns/${c.id}/insights?date_preset=${p}`, {
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) {
        setCampaignInsightsErr(d.error || "Failed to load campaign performance insights.");
      } else if (d.data && d.data.length > 0) {
        setCampaignInsights(d.data[0]);
      } else {
        setCampaignInsights({
          impressions: "0",
          clicks: "0",
          spend: "0",
          ctr: "0",
          cpc: "0",
          reach: "0",
        });
      }
    } catch {
      setCampaignInsightsErr("Network error fetching campaign insights.");
    }
    setCampaignInsightsLoading(false);
  }

  // Toggle Ad Set Status
  async function toggleAdSetStatus(as: AdSet) {
    const nextStatus = as.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const r = await fetch(`/api/facebook/ads/adsets/${as.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });
      const d = await r.json();
      if (!r.ok) {
        setActionMsg(`Error: ${d.error || "Failed to update ad set status."}`);
      } else {
        setAdSets((prev) =>
          prev.map((item) => (item.id === as.id ? { ...item, status: nextStatus } : item))
        );
        setActionMsg(`Ad Set "${as.name}" status updated to ${nextStatus}.`);
      }
    } catch {
      setActionMsg("Network error updating ad set status.");
    }
  }

  // Create Ad Set
  async function handleCreateAdSet() {
    if (!adSetForm.name.trim() || !adSetForm.campaignId) {
      setActionMsg("Error: Please provide a name and select a Campaign.");
      return;
    }
    setAdSetSaving(true);
    try {
      const r = await fetch("/api/facebook/ads/adsets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: adSetForm.name,
          campaign_id: adSetForm.campaignId,
          daily_budget: adSetForm.dailyBudget ? parseFloat(adSetForm.dailyBudget) : undefined,
          optimization_goal: adSetForm.optimizationGoal,
          billing_event: adSetForm.billingEvent,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setActionMsg(`Error: ${d.error || "Failed to create ad set."}`);
      } else {
        setIsCreatingAdSet(false);
        setAdSetForm({
          name: "",
          campaignId: "",
          dailyBudget: "10.00",
          optimizationGoal: "OFFSITE_CONVERSIONS",
          billingEvent: "IMPRESSIONS",
          status: "PAUSED",
        });
        setActionMsg("Ad Set created successfully.");
        fetchAdSets(adSetCampaignFilter);
      }
    } catch {
      setActionMsg("Network error creating ad set.");
    }
    setAdSetSaving(false);
  }

  // Toggle Ad Status
  async function toggleAdStatus(a: Ad) {
    const nextStatus = a.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const r = await fetch(`/api/facebook/ads/ads/${a.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });
      const d = await r.json();
      if (!r.ok) {
        setActionMsg(`Error: ${d.error || "Failed to update ad status."}`);
      } else {
        setAds((prev) =>
          prev.map((item) => (item.id === a.id ? { ...item, status: nextStatus } : item))
        );
        setActionMsg(`Ad "${a.name}" status updated to ${nextStatus}.`);
      }
    } catch {
      setActionMsg("Network error updating ad status.");
    }
  }

  // Create Ad
  async function handleCreateAd() {
    if (!adForm.name.trim() || !adForm.adSetId) {
      setActionMsg("Error: Please provide a name and select an Ad Set.");
      return;
    }
    setAdSaving(true);
    try {
      const r = await fetch("/api/facebook/ads/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: adForm.name,
          adset_id: adForm.adSetId,
          headline: adForm.headline,
          message: adForm.message,
          link: adForm.link,
          image_url: adForm.imageUrl || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setActionMsg(`Error: ${d.error || "Failed to create ad."}`);
      } else {
        setIsCreatingAd(false);
        setAdForm({
          name: "",
          adSetId: "",
          headline: "",
          message: "",
          link: window.location.origin,
          imageUrl: "",
          status: "PAUSED",
        });
        setActionMsg("Ad and Creative created successfully on Meta.");
        fetchAds(adAdSetFilter);
      }
    } catch {
      setActionMsg("Network error creating ad.");
    }
    setAdSaving(false);
  }

  const accountStatusLabel = (s?: number) => {
    const map: Record<number, string> = {
      1: "Active",
      2: "Disabled",
      3: "Unsettled",
      7: "Pending",
      9: "In Grace Period",
      100: "Pending Closure",
      101: "Closed",
      201: "Any Active",
    };
    return s != null ? map[s] ?? `Status ${s}` : "—";
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "credentials", label: "Credentials", icon: <MdKey /> },
    { id: "account", label: "Account", icon: <MdAccountBalance /> },
    { id: "insights", label: "Insights", icon: <MdBarChart /> },
    { id: "campaigns", label: "Campaigns", icon: <MdCampaign /> },
    { id: "adsets", label: "Ad Sets", icon: <MdLayers /> },
    { id: "ads", label: "Ads & Creatives", icon: <MdPhotoLibrary /> },
  ];

  return (
    <AdminLayout sidebar="channels">
      <div className="flex-1 ml-0 p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/channels" className="text-slate-400 hover:text-slate-600 transition-colors">
              <MdArrowBack className="text-xl" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-[#1877F2] flex items-center justify-center text-white shadow-xs">
              <MdCampaign className="text-xl" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 font-serif">Meta Ads Manager</h1>
              <p className="text-xs text-slate-500 font-[Manrope]">
                Live campaigns, ad sets, creatives, and real-time conversion insights
              </p>
            </div>
          </div>
        </div>

        {/* Global Toast Message */}
        {actionMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold font-[Manrope] flex items-center justify-between ${
              actionMsg.startsWith("Error")
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
            }`}
          >
            <span>{actionMsg}</span>
            <button onClick={() => setActionMsg("")} className="hover:opacity-75">
              <MdClose className="text-sm" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                if (t.id === "account") fetchAccount();
                if (t.id === "campaigns") fetchCampaigns();
                if (t.id === "insights") fetchInsights();
                if (t.id === "adsets") {
                  fetchCampaigns();
                  fetchAdSets();
                }
                if (t.id === "ads") {
                  fetchAdSets();
                  fetchAds();
                }
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all font-[Manrope] ${
                tab === t.id ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <div className="text-base">{t.icon}</div>
              {t.label}
            </button>
          ))}
        </div>

        {/* Credentials Tab */}
        {tab === "credentials" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <MdKey className="text-2xl text-slate-400" />
                <div>
                  <p className="text-sm font-[Manrope] font-bold text-black">Managed via Platform Environment Variables</p>
                  <p className="text-xs font-[Manrope] text-slate-500 mt-1">Manual entry of Meta Ads credentials is disabled in this environment.</p>
                </div>
              </div>
              <ul className="space-y-2 text-xs font-[Manrope] text-slate-600 list-disc list-inside">
                <li><span className="font-bold text-slate-800">Ad Account ID</span></li>
                <li><span className="font-bold text-slate-800">Access Token</span></li>
              </ul>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-xs font-semibold text-blue-900 mb-2">Required Permissions</p>
              <div className="flex flex-wrap gap-2">
                {["ads_read", "ads_management", "business_management"].map((p) => (
                  <span
                    key={p}
                    className="px-2 py-0.5 bg-white border border-blue-200 rounded text-xs text-blue-700 font-mono"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Account Tab */}
        {tab === "account" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Ad Account Details</h2>
                <p className="text-xs text-slate-500 font-[Manrope]">Status, spend, and currency for your connected Ad Account</p>
              </div>
              <button
                onClick={fetchAccount}
                disabled={accountLoading}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                <MdRefresh className="text-base" />
                {accountLoading ? "Loading…" : "Refresh"}
              </button>
            </div>
            {accountErr && <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 mb-4">{accountErr}</div>}
            {!account && !accountErr && (
              <div className="text-center py-12 text-slate-400">
                <MdAccountBalance className="text-4xl mb-3 mx-auto block" />
                <p className="text-sm">Click Refresh to load your ad account</p>
              </div>
            )}
            {account && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl md:col-span-2">
                  <p className="text-xs text-slate-500 mb-1 font-medium">Account Name & ID</p>
                  <p className="text-lg font-bold text-slate-900">{account.name}</p>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">act_{account.id}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1 font-medium">Status</p>
                  <p className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        account.account_status === 1 ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    {accountStatusLabel(account.account_status)}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1 font-medium">Currency</p>
                  <p className="text-base font-bold text-slate-900">{account.currency}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1 font-medium">Total Spent</p>
                  <p className="text-xl font-bold text-slate-900">
                    {account.amount_spent
                      ? `${(parseFloat(account.amount_spent) / 100).toFixed(2)} ${account.currency}`
                      : "—"}
                  </p>
                </div>
                <div className="p-4 bg-[#006c49]/5 rounded-xl border border-[#006c49]/20">
                  <p className="text-xs text-[#006c49] mb-1 font-semibold">Account Balance</p>
                  <p className="text-xl font-bold text-[#006c49]">
                    {account.balance
                      ? `${(parseFloat(account.balance) / 100).toFixed(2)} ${account.currency}`
                      : "—"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Insights Tab */}
        {tab === "insights" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700">Date Range:</span>
                <select
                  value={datePreset}
                  onChange={(e) => {
                    const nextP = e.target.value;
                    setDatePreset(nextP);
                    fetchInsights(nextP);
                  }}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006c49]/20 bg-white font-medium"
                >
                  {DATE_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchInsights()}
                  disabled={insightsLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-semibold hover:bg-[#1564d3] disabled:opacity-50 transition-colors shadow-xs"
                >
                  <MdRefresh className={`text-base ${insightsLoading ? "animate-spin" : ""}`} />
                  {insightsLoading ? "Querying Meta Graph API…" : "Refresh Insights"}
                </button>
              </div>
            </div>

            {insightsErr && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 space-y-1">
                <div className="font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Meta Graph API Error
                </div>
                <p className="text-xs font-mono">{insightsErr}</p>
                <p className="text-xs text-red-600 mt-2">
                  Tip: Verify your Ad Account ID ({creds.ad_account_id || "not configured"}) in the Credentials tab and ensure your Access Token has <code>ads_read</code> or <code>ads_management</code> permissions.
                </p>
              </div>
            )}

            {!insightsFetched && !insightsLoading && !insightsErr && (
              <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200">
                <MdBarChart className="text-4xl mb-3 mx-auto block text-slate-300" />
                <p className="text-sm font-medium text-slate-600">No Insights Query Loaded Yet</p>
                <p className="text-xs text-slate-400 mt-1">Select your date range and click "Refresh Insights" to pull live delivery stats from Meta.</p>
                <button
                  onClick={() => fetchInsights()}
                  className="mt-4 px-4 py-2 bg-[#1877F2] text-white rounded-lg text-xs font-bold hover:bg-[#1564d3]"
                >
                  Load Insights Now
                </button>
              </div>
            )}

            {insightsFetched && !insightsErr && insights && (
              <div className="space-y-4">
                <div className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  insightsHasActivity
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-slate-50 border-slate-200 text-slate-700"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${insightsHasActivity ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                    <span>
                      {insightsHasActivity
                        ? `Meta Graph API: Live delivery & performance data loaded for Ad Account ${insightsActId || creds.ad_account_id}`
                        : `Meta Graph API: Query succeeded. 0 delivery events or spend recorded during ${DATE_PRESETS.find(p => p.value === datePreset)?.label || datePreset}.`}
                    </span>
                  </div>
                  {!insightsHasActivity && (
                    <button
                      onClick={() => {
                        setDatePreset("maximum");
                        fetchInsights("maximum");
                      }}
                      className="text-xs font-bold text-[#1877F2] hover:underline"
                    >
                      Try Lifetime (All Time) →
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard label="Impressions" value={parseInt(insights.impressions ?? "0").toLocaleString()} icon={<MdVisibility />} />
                  <MetricCard label="Link / Ad Clicks" value={parseInt(insights.clicks ?? "0").toLocaleString()} icon={<MdAdsClick />} />
                  <MetricCard label="Total Spend" value={`$${parseFloat(insights.spend ?? "0").toFixed(2)}`} icon={<MdPayments />} />
                  <MetricCard label="Click-Through Rate (CTR)" value={insights.ctr ? `${parseFloat(insights.ctr).toFixed(2)}%` : "0.00%"} icon={<MdPercent />} />
                  <MetricCard label="Cost Per Click (CPC)" value={insights.cpc ? `$${parseFloat(insights.cpc).toFixed(2)}` : "$0.00"} icon={<MdAttachMoney />} />
                  <MetricCard label="Unique Reach" value={parseInt(insights.reach ?? "0").toLocaleString()} icon={<MdPeople />} />
                  <MetricCard label="Frequency" value={insights.frequency ? parseFloat(insights.frequency).toFixed(2) : "0.00"} icon={<MdRepeat />} sub="avg. impressions / user" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Campaigns Tab */}
        {tab === "campaigns" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Ad Campaigns</h2>
                <p className="text-xs text-slate-500 font-[Manrope]">Create, toggle, budget, and analyze your Meta Ad campaigns</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCreatingCampaign(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#006c49] text-white rounded-lg text-xs font-bold hover:bg-emerald-800 shadow-xs"
                >
                  <MdAdd className="text-base" /> Create Campaign
                </button>
                <button
                  onClick={fetchCampaigns}
                  disabled={campaignsLoading}
                  className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <MdRefresh className="text-base" />
                  {campaignsLoading ? "Loading…" : "Refresh"}
                </button>
              </div>
            </div>

            {campaignsErr && <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{campaignsErr}</div>}

            {!campaigns.length && !campaignsErr && (
              <div className="text-center py-12 text-slate-400">
                <MdCampaign className="text-4xl mb-3 mx-auto block" />
                <p className="text-sm">No campaigns found. Click "Create Campaign" or Refresh.</p>
              </div>
            )}

            {campaigns.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-500 font-semibold">
                      <th className="pb-3 text-left">Campaign Name</th>
                      <th className="pb-3 text-left">Status</th>
                      <th className="pb-3 text-left">Objective</th>
                      <th className="pb-3 text-right">Daily Budget</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-3">
                          <div className="font-semibold text-slate-800">{c.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">ID: {c.id}</div>
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold font-[Manrope] inline-flex items-center gap-1 ${
                              c.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800"
                                : c.status === "PAUSED"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                c.status === "ACTIVE" ? "bg-emerald-600" : "bg-amber-600"
                              }`}
                            />
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 text-slate-600 text-xs font-medium">
                          {c.objective?.replace(/_/g, " ")}
                        </td>
                        <td className="py-3 text-right font-medium text-slate-700">
                          {c.daily_budget ? `$${(parseInt(c.daily_budget) / 100).toFixed(2)}` : "—"}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => toggleCampaignStatus(c)}
                              title={c.status === "ACTIVE" ? "Pause Campaign" : "Activate Campaign"}
                              className={`p-1.5 rounded-lg border text-xs font-bold transition-colors ${
                                c.status === "ACTIVE"
                                  ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                                  : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {c.status === "ACTIVE" ? <MdPause /> : <MdPlayArrow />}
                            </button>
                            <button
                              onClick={() => openCampaignInsights(c)}
                              title="Campaign Insights"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                            >
                              <MdInsights />
                            </button>
                            <button
                              onClick={() => startEditCampaign(c)}
                              title="Edit Campaign"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                            >
                              <MdEdit />
                            </button>
                            <button
                              onClick={() => setDeletingCampaign(c)}
                              title="Delete Campaign"
                              className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                            >
                              <MdDelete />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Ad Sets Tab */}
        {tab === "adsets" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Ad Sets</h2>
                <p className="text-xs text-slate-500 font-[Manrope]">Manage budget, targeting, and optimization goals</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (campaigns.length === 0) fetchCampaigns();
                    setIsCreatingAdSet(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#006c49] text-white rounded-lg text-xs font-bold hover:bg-emerald-800 shadow-xs"
                >
                  <MdAdd className="text-base" /> Create Ad Set
                </button>
                <button
                  onClick={() => fetchAdSets(adSetCampaignFilter)}
                  disabled={adSetsLoading}
                  className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <MdRefresh className="text-base" />
                  {adSetsLoading ? "Loading…" : "Refresh"}
                </button>
              </div>
            </div>

            {/* Filter by Campaign */}
            {campaigns.length > 0 && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs font-semibold text-slate-600">Filter by Campaign:</span>
                <select
                  value={adSetCampaignFilter}
                  onChange={(e) => {
                    setAdSetCampaignFilter(e.target.value);
                    fetchAdSets(e.target.value);
                  }}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#006c49] bg-white"
                >
                  <option value="all">All Campaigns</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {adSetsErr && <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{adSetsErr}</div>}

            {!adSets.length && !adSetsErr && (
              <div className="text-center py-12 text-slate-400">
                <MdLayers className="text-4xl mb-3 mx-auto block" />
                <p className="text-sm">No Ad Sets found. Click "Create Ad Set" to launch one.</p>
              </div>
            )}

            {adSets.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-500 font-semibold">
                      <th className="pb-3 text-left">Ad Set Name</th>
                      <th className="pb-3 text-left">Status</th>
                      <th className="pb-3 text-left">Optimization</th>
                      <th className="pb-3 text-right">Daily Budget</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {adSets.map((as) => (
                      <tr key={as.id} className="hover:bg-slate-50">
                        <td className="py-3">
                          <div className="font-semibold text-slate-800">{as.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">ID: {as.id}</div>
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold font-[Manrope] inline-flex items-center gap-1 ${
                              as.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800"
                                : as.status === "PAUSED"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                as.status === "ACTIVE" ? "bg-emerald-600" : "bg-amber-600"
                              }`}
                            />
                            {as.status}
                          </span>
                        </td>
                        <td className="py-3 text-slate-600 text-xs font-medium">
                          {as.optimization_goal?.replace(/_/g, " ") || "—"}
                        </td>
                        <td className="py-3 text-right font-medium text-slate-700">
                          {as.daily_budget ? `$${(parseInt(as.daily_budget) / 100).toFixed(2)}` : "—"}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => toggleAdSetStatus(as)}
                            title={as.status === "ACTIVE" ? "Pause Ad Set" : "Activate Ad Set"}
                            className={`p-1.5 rounded-lg border text-xs font-bold transition-colors ${
                              as.status === "ACTIVE"
                                ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                                : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {as.status === "ACTIVE" ? <MdPause /> : <MdPlayArrow />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Ads Tab */}
        {tab === "ads" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Ads & Creatives</h2>
                <p className="text-xs text-slate-500 font-[Manrope]">Manage individual ad creatives, links, and ad copies</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (adSets.length === 0) fetchAdSets();
                    setIsCreatingAd(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#006c49] text-white rounded-lg text-xs font-bold hover:bg-emerald-800 shadow-xs"
                >
                  <MdAdd className="text-base" /> Create Ad
                </button>
                <button
                  onClick={() => fetchAds(adAdSetFilter)}
                  disabled={adsLoading}
                  className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <MdRefresh className="text-base" />
                  {adsLoading ? "Loading…" : "Refresh"}
                </button>
              </div>
            </div>

            {/* Filter by Ad Set */}
            {adSets.length > 0 && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs font-semibold text-slate-600">Filter by Ad Set:</span>
                <select
                  value={adAdSetFilter}
                  onChange={(e) => {
                    setAdAdSetFilter(e.target.value);
                    fetchAds(e.target.value);
                  }}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#006c49] bg-white"
                >
                  <option value="all">All Ad Sets</option>
                  {adSets.map((as) => (
                    <option key={as.id} value={as.id}>
                      {as.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {adsErr && <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{adsErr}</div>}

            {!ads.length && !adsErr && (
              <div className="text-center py-12 text-slate-400">
                <MdPhotoLibrary className="text-4xl mb-3 mx-auto block" />
                <p className="text-sm">No ads found. Click "Create Ad" to build your first creative.</p>
              </div>
            )}

            {ads.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-500 font-semibold">
                      <th className="pb-3 text-left">Ad Creative</th>
                      <th className="pb-3 text-left">Status</th>
                      <th className="pb-3 text-left">Ad Set ID</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {ads.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            {a.creative?.image_url ? (
                              <img
                                src={a.creative.image_url}
                                alt={a.name}
                                className="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-200"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                <MdPhotoLibrary className="text-lg" />
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-800">{a.name}</div>
                              {a.creative?.title && (
                                <div className="text-xs text-slate-500">{a.creative.title}</div>
                              )}
                              <div className="text-[10px] font-mono text-slate-400">ID: {a.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold font-[Manrope] inline-flex items-center gap-1 ${
                              a.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800"
                                : a.status === "PAUSED"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                a.status === "ACTIVE" ? "bg-emerald-600" : "bg-amber-600"
                              }`}
                            />
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3 text-xs font-mono text-slate-500">{a.adset_id}</td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => toggleAdStatus(a)}
                            title={a.status === "ACTIVE" ? "Pause Ad" : "Activate Ad"}
                            className={`p-1.5 rounded-lg border text-xs font-bold transition-colors ${
                              a.status === "ACTIVE"
                                ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                                : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {a.status === "ACTIVE" ? <MdPause /> : <MdPlayArrow />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal: Create Campaign */}
        {isCreatingCampaign && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-serif font-bold text-slate-900 text-base">Create Meta Ad Campaign</h3>
                <button onClick={() => setIsCreatingCampaign(false)} className="text-slate-400 hover:text-slate-600">
                  <MdClose className="text-lg" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Summer Haute Couture 2026"
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">
                    Objective
                  </label>
                  <select
                    value={campaignForm.objective}
                    onChange={(e) => setCampaignForm({ ...campaignForm, objective: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                  >
                    {CAMPAIGN_OBJECTIVES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">
                      Daily Budget ($)
                    </label>
                    <input
                      type="number"
                      step="1"
                      placeholder="20.00"
                      value={campaignForm.dailyBudget}
                      onChange={(e) => setCampaignForm({ ...campaignForm, dailyBudget: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">
                      Initial Status
                    </label>
                    <select
                      value={campaignForm.status}
                      onChange={(e) => setCampaignForm({ ...campaignForm, status: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                    >
                      <option value="PAUSED">PAUSED (Draft)</option>
                      <option value="ACTIVE">ACTIVE (Immediate)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreatingCampaign(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold font-[Manrope] hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCampaign}
                  disabled={campaignSaving || !campaignForm.name.trim()}
                  className="px-4 py-2 bg-[#006c49] text-white rounded-lg text-xs font-bold font-[Manrope] hover:bg-emerald-800 disabled:opacity-50"
                >
                  {campaignSaving ? "Creating..." : "Create Campaign"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Edit Campaign */}
        {editingCampaign && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-serif font-bold text-slate-900 text-base">Edit Campaign</h3>
                <button onClick={() => setEditingCampaign(null)} className="text-slate-400 hover:text-slate-600">
                  <MdClose className="text-lg" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    value={editCampaignForm.name}
                    onChange={(e) => setEditCampaignForm({ ...editCampaignForm, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">
                    Daily Budget ($)
                  </label>
                  <input
                    type="number"
                    step="1"
                    placeholder="25.00"
                    value={editCampaignForm.dailyBudget}
                    onChange={(e) => setEditCampaignForm({ ...editCampaignForm, dailyBudget: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCampaign(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold font-[Manrope] hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCampaign}
                  disabled={campaignUpdating || !editCampaignForm.name.trim()}
                  className="px-4 py-2 bg-[#006c49] text-white rounded-lg text-xs font-bold font-[Manrope] hover:bg-emerald-800 disabled:opacity-50"
                >
                  {campaignUpdating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Delete Campaign Confirmation */}
        {deletingCampaign && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl space-y-4">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                <MdDelete className="text-xl" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-slate-900 text-base">Delete Campaign?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to permanently delete{" "}
                  <span className="font-bold text-slate-700">"{deletingCampaign.name}"</span>? All associated Ad Sets and Ads will also be removed on Meta.
                </p>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingCampaign(null)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold font-[Manrope] hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCampaign}
                  disabled={deleteCampaignLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold font-[Manrope] hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteCampaignLoading ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Campaign Insights */}
        {insightsCampaign && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-serif font-bold text-slate-900 text-base">Campaign Insights</h3>
                  <p className="text-xs text-slate-500 font-mono truncate max-w-xs">{insightsCampaign.name}</p>
                </div>
                <button onClick={() => setInsightsCampaign(null)} className="text-slate-400 hover:text-slate-600">
                  <MdClose className="text-lg" />
                </button>
              </div>

              {/* Date Preset Selector */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600">Time Range:</span>
                <select
                  value={campaignPreset}
                  onChange={(e) => {
                    const newP = e.target.value;
                    setCampaignPreset(newP);
                    openCampaignInsights(insightsCampaign, newP);
                  }}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#006c49] bg-white font-medium"
                >
                  {DATE_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {campaignInsightsLoading && (
                <div className="text-center py-8 text-slate-400">
                  <MdRefresh className="text-3xl animate-spin mx-auto mb-2 text-[#1877F2]" />
                  <p className="text-xs">Fetching campaign performance data from Meta...</p>
                </div>
              )}

              {campaignInsightsErr && !campaignInsightsLoading && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-1">
                  <p className="font-bold">Error loading campaign insights:</p>
                  <p className="font-mono text-[11px]">{campaignInsightsErr}</p>
                </div>
              )}

              {!campaignInsightsLoading && !campaignInsightsErr && campaignInsights && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] text-slate-500 mb-0.5">Impressions</p>
                      <p className="text-lg font-bold text-slate-900">
                        {campaignInsights.impressions
                          ? parseInt(campaignInsights.impressions).toLocaleString()
                          : "0"}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] text-slate-500 mb-0.5">Clicks</p>
                      <p className="text-lg font-bold text-slate-900">
                        {campaignInsights.clicks
                          ? parseInt(campaignInsights.clicks).toLocaleString()
                          : "0"}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] text-slate-500 mb-0.5">Spend</p>
                      <p className="text-lg font-bold text-[#006c49]">
                        ${parseFloat(campaignInsights.spend ?? "0").toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] text-slate-500 mb-0.5">CTR</p>
                      <p className="text-lg font-bold text-slate-900">
                        {campaignInsights.ctr ? `${parseFloat(campaignInsights.ctr).toFixed(2)}%` : "0.00%"}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] text-slate-500 mb-0.5">CPC</p>
                      <p className="text-lg font-bold text-slate-900">
                        {campaignInsights.cpc ? `$${parseFloat(campaignInsights.cpc).toFixed(2)}` : "$0.00"}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] text-slate-500 mb-0.5">Reach</p>
                      <p className="text-lg font-bold text-slate-900">
                        {campaignInsights.reach
                          ? parseInt(campaignInsights.reach).toLocaleString()
                          : "0"}
                      </p>
                    </div>
                  </div>
                  {(!campaignInsights.impressions || campaignInsights.impressions === "0") && (
                    <p className="text-[11px] text-slate-400 text-center italic">
                      No delivery recorded in this period. Try selecting Lifetime (All Time).
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInsightsCampaign(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold font-[Manrope] hover:bg-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Create Ad Set */}
        {isCreatingAdSet && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-serif font-bold text-slate-900 text-base">Create Ad Set</h3>
                <button onClick={() => setIsCreatingAdSet(false)} className="text-slate-400 hover:text-slate-600">
                  <MdClose className="text-lg" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">
                    Parent Campaign *
                  </label>
                  <select
                    value={adSetForm.campaignId}
                    onChange={(e) => setAdSetForm({ ...adSetForm, campaignId: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                  >
                    <option value="">Select a Campaign...</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">
                    Ad Set Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. EU High-Net-Worth Women 25-54"
                    value={adSetForm.name}
                    onChange={(e) => setAdSetForm({ ...adSetForm, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">
                      Daily Budget ($)
                    </label>
                    <input
                      type="number"
                      step="1"
                      placeholder="10.00"
                      value={adSetForm.dailyBudget}
                      onChange={(e) => setAdSetForm({ ...adSetForm, dailyBudget: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">
                      Optimization Goal
                    </label>
                    <select
                      value={adSetForm.optimizationGoal}
                      onChange={(e) => setAdSetForm({ ...adSetForm, optimizationGoal: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                    >
                      <option value="OFFSITE_CONVERSIONS">Conversions</option>
                      <option value="LINK_CLICKS">Link Clicks</option>
                      <option value="IMPRESSIONS">Impressions</option>
                      <option value="REACH">Reach</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreatingAdSet(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold font-[Manrope] hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateAdSet}
                  disabled={adSetSaving || !adSetForm.name.trim() || !adSetForm.campaignId}
                  className="px-4 py-2 bg-[#006c49] text-white rounded-lg text-xs font-bold font-[Manrope] hover:bg-emerald-800 disabled:opacity-50"
                >
                  {adSetSaving ? "Creating..." : "Create Ad Set"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Create Ad & Creative */}
        {isCreatingAd && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-serif font-bold text-slate-900 text-base">Create Ad & Creative</h3>
                <button onClick={() => setIsCreatingAd(false)} className="text-slate-400 hover:text-slate-600">
                  <MdClose className="text-lg" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">
                    Parent Ad Set *
                  </label>
                  <select
                    value={adForm.adSetId}
                    onChange={(e) => setAdForm({ ...adForm, adSetId: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                  >
                    <option value="">Select an Ad Set...</option>
                    {adSets.map((as) => (
                      <option key={as.id} value={as.id}>
                        {as.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">
                    Ad Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Silk Dress Collection Hero Ad"
                    value={adForm.name}
                    onChange={(e) => setAdForm({ ...adForm, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">
                    Headline (Callout)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Exclusive Italian Silk Collection"
                    value={adForm.headline}
                    onChange={(e) => setAdForm({ ...adForm, headline: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">
                    Primary Text / Message
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Unmatched sophistication. Discover handcrafted evening wear tailored with bespoke artistry."
                    value={adForm.message}
                    onChange={(e) => setAdForm({ ...adForm, message: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">
                    Website URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={adForm.link}
                    onChange={(e) => setAdForm({ ...adForm, link: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                  />
                </div>
                {/* Media Creative Selection */}
                <div className="space-y-3 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-[Manrope]">
                      Ad Creative Image
                    </label>
                    <div className="flex bg-slate-200/70 p-0.5 rounded-lg text-[11px] font-[Manrope] font-bold">
                      <button
                        type="button"
                        onClick={() => setAdMediaSource("upload")}
                        className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                          adMediaSource === "upload" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <MdCloudUpload className="text-xs" />
                        Upload File
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdMediaSource("url")}
                        className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                          adMediaSource === "url" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <MdLink className="text-xs" />
                        Image URL
                      </button>
                    </div>
                  </div>

                  {adMediaSource === "upload" ? (
                    <div>
                      <input
                        ref={adFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleAdFileUpload(e.target.files[0]);
                          }
                        }}
                      />
                      {!adForm.imageUrl ? (
                        <div
                          onClick={() => adFileInputRef.current?.click()}
                          className="border-2 border-dashed border-slate-300 hover:border-[#006c49] bg-white rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 group"
                        >
                          <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#006c49] group-hover:scale-110 flex items-center justify-center transition-transform">
                            <MdCloudUpload className="text-xl" />
                          </div>
                          <p className="text-xs font-bold text-slate-800 font-[Manrope]">
                            {adUploadingImage ? "Uploading creative image..." : "Click to select local ad banner/creative"}
                          </p>
                          <p className="text-[11px] text-slate-400 font-[Manrope]">
                            High-res PNG, JPG, WebP (1:1 or 1.91:1 recommended)
                          </p>
                        </div>
                      ) : (
                        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white group">
                          <img
                            src={adForm.imageUrl}
                            alt="Ad Creative preview"
                            className="w-full h-36 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => adFileInputRef.current?.click()}
                              className="px-3 py-1.5 bg-white text-slate-800 text-xs font-bold rounded-lg shadow-sm hover:bg-slate-100 flex items-center gap-1 font-[Manrope]"
                            >
                              <MdCloudUpload /> Change File
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdForm((prev) => ({ ...prev, imageUrl: "" }))}
                              className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-red-700 flex items-center gap-1 font-[Manrope]"
                            >
                              <MdDelete /> Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="https://images.unsplash.com/..."
                        value={adForm.imageUrl}
                        onChange={(e) => setAdForm({ ...adForm, imageUrl: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#006c49]"
                      />
                      {adForm.imageUrl && (
                        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white h-32">
                          <img
                            src={adForm.imageUrl}
                            alt="Creative preview"
                            className="w-full h-full object-cover"
                            onError={() => setAdUploadError("Creative image failed to load from provided URL")}
                          />
                          <button
                            type="button"
                            onClick={() => setAdForm((prev) => ({ ...prev, imageUrl: "" }))}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black text-white rounded-lg text-xs"
                          >
                            <MdDelete />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {adUploadError && (
                    <p className="text-[11px] text-red-600 font-[Manrope]">{adUploadError}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreatingAd(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold font-[Manrope] hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateAd}
                  disabled={adSaving || !adForm.name.trim() || !adForm.adSetId}
                  className="px-4 py-2 bg-[#006c49] text-white rounded-lg text-xs font-bold font-[Manrope] hover:bg-emerald-800 disabled:opacity-50"
                >
                  {adSaving ? "Publishing to Meta..." : "Create Ad"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
