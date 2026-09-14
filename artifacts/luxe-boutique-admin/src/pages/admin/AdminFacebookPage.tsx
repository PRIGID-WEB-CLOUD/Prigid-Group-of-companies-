import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { SiFacebook, SiInstagram, SiMessenger, SiMeta } from "react-icons/si";
import { 
  MdRssFeed, 
  MdKey, 
  MdStorage, 
  MdTrackChanges, 
  MdGroup, 
  MdBarChart,
  MdRefresh,
  MdCloudOff,
  MdCheckCircle,
  MdArrowBack,
  MdStorefront,
  MdPhotoCamera,
  MdChat,
  MdVisibility,
  MdVisibilityOff,
  MdContentCopy,
  MdSave,
  MdWifiTethering,
  MdHelp,
  MdInfo,
  MdCheck,
  MdCheckBox,
  MdCheckBoxOutlineBlank,
  MdWarning,
  MdArrowForward,
  MdCloudUpload,
  MdDelete,
  MdLink,
  MdVideoLibrary,
  MdSlowMotionVideo,
  MdAutoAwesomeMotion,
  MdPlayCircle,
  MdVideocam,
} from "react-icons/md";
import AdminLayout from "./AdminLayout";
import { LinkAttachmentPicker } from "../../components/LinkAttachmentPicker";
import { ProductTagPicker, TaggedProduct } from "../../components/ProductTagPicker";

type ActiveTab = "posts" | "reels" | "stories" | "credentials" | "catalog" | "pixel" | "audiences" | "ads";
type PostFilter = "All" | "Published" | "Scheduled" | "Draft";

interface Connection      { id: string; connectionKey: string; active: boolean; }
interface CatalogSettings { id: string; includedCategories: string[]; minPrice: number; maxPrice: number; }
interface PixelEvent      { id: string; storeEvent: string; fbEvent: string; enabled: boolean; }
interface Audience        { id: string; name: string; size: string; type: string; status: string; }
interface PagePost {
  id: string; caption: string; imageUrl: string | null; link: string | null;
  postType: string; scheduledFor: string | null; status: string;
  likes: number; comments: number; shares: number; reach: number; createdAt: string;
}
interface PostTemplate    { id: string; name: string; body: string; postType: string; usageCount: number; }

const ALL_CATEGORIES = ["Ready-to-Wear","Footwear","Accessories","Bags & Luggage","Jewellery","Outerwear","Swimwear"];
const POST_TYPES = ["Standard","Product Spotlight","Collection Launch","Promotion","Brand Story","Event","Teaser"];

const audienceTypeStyle: Record<string, string> = {
  Custom: "bg-blue-50 text-blue-700", Lookalike: "bg-purple-50 text-purple-700", Retargeting: "bg-amber-50 text-amber-700",
};
const audienceStatusStyle: Record<string, string> = {
  Active: "bg-[#6cf8bb] text-[#00714d]", Building: "bg-amber-100 text-amber-700", Paused: "bg-slate-100 text-slate-500",
};
const postStatusStyle: Record<string, string> = {
  Published: "bg-[#6cf8bb] text-[#00714d]",
  Scheduled: "bg-blue-50 text-blue-700",
  Draft:     "bg-slate-100 text-slate-500",
  Failed:    "bg-red-100 text-red-600",
};
const postTypeColor: Record<string, string> = {
  "Standard":          "bg-slate-100 text-slate-600",
  "Product Spotlight": "bg-[#eff4ff] text-[#006c49]",
  "Collection Launch": "bg-purple-50 text-purple-700",
  "Promotion":         "bg-amber-50 text-amber-700",
  "Brand Story":       "bg-pink-50 text-pink-700",
  "Event":             "bg-cyan-50 text-cyan-700",
  "Teaser":            "bg-slate-50 text-slate-600",
};
const connectionMeta: { key: string; label: string; icon: any }[] = [
  { key: "facebook",  label: "Facebook Shop",      icon: <SiFacebook className="text-[#1877F2]" /> },
  { key: "instagram", label: "Instagram Shopping", icon: <SiInstagram className="text-[#E4405F]" /> },
  { key: "pixel",     label: "Pixel Tracking",     icon: <MdTrackChanges className="text-blue-500" /> },
  { key: "messenger", label: "Messenger Bot",      icon: <SiMessenger className="text-[#00B2FF]" /> },
];

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

export default function AdminFacebookPage() {
  const [connections,    setConnections]    = useState<Connection[]>([]);
  const [catalog,        setCatalog]        = useState<CatalogSettings | null>(null);
  const [pixelEvents,    setPixelEvents]    = useState<PixelEvent[]>([]);
  const [audiences,      setAudiences]      = useState<Audience[]>([]);
  const [posts,          setPosts]          = useState<PagePost[]>([]);
  const [postTemplates,  setPostTemplates]  = useState<PostTemplate[]>([]);
  const [catalogInfo,    setCatalogInfo]    = useState<any>(null);
  const [loading,        setLoading]        = useState(true);
  const [loadError,      setLoadError]      = useState(false);

  const [activeTab,   setActiveTab]   = useState<ActiveTab>("posts");
  const [syncState,   setSyncState]   = useState<"idle"|"syncing"|"done">("idle");
  const [toast,       setToast]       = useState<string | null>(null);
  const [postFilter,  setPostFilter]  = useState<PostFilter>("All");

  // Audiences
  const [newAudName, setNewAudName] = useState("");
  const [newAudType, setNewAudType] = useState("Custom");

  // Post composer
  const [caption,       setCaption]       = useState("");
  const [postType,      setPostType]      = useState("Standard");
  const [imageUrl,      setImageUrl]      = useState("");
  const [linkUrl,       setLinkUrl]       = useState("");
  const [linkCardImage, setLinkCardImage] = useState("");
  const [linkCardTitle, setLinkCardTitle] = useState("");
  const [linkCardDomain, setLinkCardDomain] = useState("");
  const [mediaSource,   setMediaSource]   = useState<"upload" | "url">("upload");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scheduleWhen,  setScheduleWhen]  = useState<"now"|"schedule">("now");
  const [scheduleTime,  setScheduleTime]  = useState("");
  const [postSubmitting, setPostSubmitting] = useState<"idle"|"posting"|"scheduling"|"drafting">("idle");
  const [showTemplates, setShowTemplates] = useState(false);
  const [newTplName,    setNewTplName]    = useState("");
  const [newTplBody,    setNewTplBody]    = useState("");
  const [newTplType,    setNewTplType]    = useState("Standard");
  const [showNewTpl,    setShowNewTpl]    = useState(false);
  const [taggedProducts, setTaggedProducts] = useState<TaggedProduct[]>([]);

  // Reels publishing state
  const [reelTitle, setReelTitle] = useState("");
  const [reelDescription, setReelDescription] = useState("");
  const [reelVideoUrl, setReelVideoUrl] = useState("");
  const [reelVideoFile, setReelVideoFile] = useState<File | null>(null);
  const [reelSubmitting, setReelSubmitting] = useState(false);
  const [reelStatusResult, setReelStatusResult] = useState<any>(null);
  const [reelTaggedProducts, setReelTaggedProducts] = useState<TaggedProduct[]>([]);
  const reelFileInputRef = useRef<HTMLInputElement>(null);

  // Stories publishing state
  const [storyType, setStoryType] = useState<"photo" | "video">("photo");
  const [storyMediaUrl, setStoryMediaUrl] = useState("");
  const [storyCaption, setStoryCaption] = useState("");
  const [storyMediaFile, setStoryMediaFile] = useState<File | null>(null);
  const [storySubmitting, setStorySubmitting] = useState(false);
  const [storyTaggedProducts, setStoryTaggedProducts] = useState<TaggedProduct[]>([]);
  const storyFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setImageUploadError("Please upload an image file (JPG, PNG, WebP, GIF, AVIF).");
      return;
    }
    setUploadingImage(true);
    setImageUploadError(null);
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
        setImageUrl(uploadedUrl);
        showToast("Image uploaded successfully.");
      }
    } catch (err: any) {
      setImageUploadError(err.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const captionRef = useRef<HTMLTextAreaElement>(null);

  // Page Mentions State
  const [showMentionSearch, setShowMentionSearch] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionResults, setMentionResults] = useState<{ id: string; name: string; username?: string }[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);

  // Ad Campaigns State
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsErr, setCampaignsErr] = useState("");
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignObjective, setNewCampaignObjective] = useState("OUTCOMES_SALES");
  const [newCampaignBudget, setNewCampaignBudget] = useState(10);
  const [newCampaignStatus, setNewCampaignStatus] = useState("PAUSED");
  const [campaignSubmitting, setCampaignSubmitting] = useState(false);

  const handleMentionSearch = async (q: string) => {
    if (!q.trim()) {
      setMentionResults([]);
      return;
    }
    setMentionLoading(true);
    try {
      const res = await fetch(`/api/facebook/pages/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        setMentionResults(await res.json());
      }
    } catch {}
    setMentionLoading(false);
  };

  const insertMention = (id: string, name: string) => {
    const tag = `@[${id}]`;
    setCaption((prev) => prev ? `${prev} ${tag}` : tag);
    setShowMentionSearch(false);
    setMentionQuery("");
    setMentionResults([]);
    showToast(`Page "${name}" tag inserted.`);
  };

  const loadCampaigns = async () => {
    setCampaignsLoading(true); setCampaignsErr("");
    try {
      const res = await fetch("/api/facebook/ads/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.data || []);
      } else {
        const d = await res.json().catch(() => ({}));
        setCampaignsErr(d.error || "Failed to fetch ad campaigns.");
      }
    } catch {
      setCampaignsErr("Network error.");
    }
    setCampaignsLoading(false);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName.trim()) {
      showToast("Campaign Name is required.");
      return;
    }
    setCampaignSubmitting(true);
    try {
      const res = await fetch("/api/facebook/ads/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCampaignName,
          objective: newCampaignObjective,
          status: newCampaignStatus,
          dailyBudget: newCampaignBudget,
        }),
      });
      if (res.ok) {
        showToast(`Ad Campaign "${newCampaignName}" created successfully!`);
        setNewCampaignName("");
        setShowCreateCampaign(false);
        loadCampaigns();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(`Error: ${d.error || "Failed to create campaign"}`);
      }
    } catch {
      showToast("Network error creating campaign.");
    }
    setCampaignSubmitting(false);
  };

  // Credentials tab
  const [fbCreds,     setFbCreds]     = useState<Record<string, string>>({});
  const [credsDirty,  setCredsDirty]  = useState<Record<string, string>>({});
  const [credsSaving, setCredsSaving] = useState(false);
  const [showSecret,  setShowSecret]  = useState<Record<string, boolean>>({});
  const [testingConn, setTestingConn] = useState(false);
  const [testResult,  setTestResult]  = useState<{pass: boolean; latency: number; missing?: string[]} | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [metaStatus,  setMetaStatus]  = useState<{ connected: boolean; business?: { id: string; name: string } } | null>(null);

  const FB_CRED_FIELDS = [
    { key: "page_id",            label: "Facebook Page ID",      isSecret: false, hint: "Go to your Facebook Page → About → scroll to the bottom → Page ID. Required to publish posts and use Messenger." },
    { key: "catalog_id",         label: "Commerce Catalog ID",   isSecret: false, hint: "Facebook Commerce Manager → Catalog → Settings → Catalog ID. Required to sync your product feed to Facebook Shop." },
    { key: "app_id",             label: "App ID",                isSecret: false, hint: "Meta for Developers → App Dashboard → App ID"                           },
    { key: "app_secret",         label: "App Secret",            isSecret: true,  hint: "App Dashboard → Settings → Basic → App Secret. Never share publicly."   },
    { key: "page_access_token",  label: "Page Access Token",     isSecret: true,  hint: "Graph API Explorer → generate a long-lived page token for your page."   },
    { key: "pixel_id",           label: "Pixel ID",              isSecret: false, hint: "Events Manager → Data Sources → your Pixel → Pixel ID"                  },
    { key: "ad_account_id",      label: "Ad Account ID",         isSecret: false, hint: "Meta Business Manager → Ad Accounts (format: act_XXXXXXXXX)"            },
  ];

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  const loadAll = useCallback(async () => {
    try {
      const [cRes, catRes, pxRes, audRes, postsRes, tplRes, credRes, infoRes, metaRes] = await Promise.all([
        fetch("/api/facebook/connections"),
        fetch("/api/facebook/catalog"),
        fetch("/api/facebook/pixel-events"),
        fetch("/api/facebook/audiences"),
        fetch("/api/facebook/posts"),
        fetch("/api/facebook/post-templates"),
        fetch("/api/channels/credentials/facebook"),
        fetch("/api/facebook/catalog/info").catch(() => null),
        fetch("/api/channels/meta/status").catch(() => null),
      ]);
      if (cRes.ok)     setConnections(await cRes.json());
      if (catRes.ok)   setCatalog(await catRes.json());
      if (pxRes.ok)    setPixelEvents(await pxRes.json());
      if (audRes.ok)   setAudiences(await audRes.json());
      if (postsRes.ok) setPosts(await postsRes.json());
      if (tplRes.ok)   setPostTemplates(await tplRes.json());
      if (credRes.ok)  { const d = await credRes.json(); setFbCreds(d); setCredsDirty(d); }
      if (infoRes && infoRes.ok) setCatalogInfo(await infoRes.json());
      if (metaRes && metaRes.ok) {
        const m = await metaRes.json();
        setMetaStatus(m);
      }
      if (!cRes.ok && !postsRes.ok) setLoadError(true);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (activeTab === "ads" && fbCreds.ad_account_id) {
      loadCampaigns();
    }
  }, [activeTab, fbCreds.ad_account_id]);

  // ── Connections ──────────────────────────────────────────────────────────
  const toggleConnection = async (connectionKey: string, active: boolean) => {
    setConnections((p) => p.map((c) => c.connectionKey === connectionKey ? { ...c, active } : c));
    await fetch(`/api/facebook/connections/${connectionKey}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) });
    showToast(`${connectionMeta.find((m) => m.key === connectionKey)?.label} ${active ? "activated" : "paused"}.`);
  };

  // ── Catalog ──────────────────────────────────────────────────────────────
  const toggleCategory = async (cat: string) => {
    if (!catalog) return;
    const next = catalog.includedCategories.includes(cat) ? catalog.includedCategories.filter((c) => c !== cat) : [...catalog.includedCategories, cat];
    setCatalog((p) => p ? { ...p, includedCategories: next } : p);
    await fetch("/api/facebook/catalog", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...catalog, includedCategories: next }) });
  };
  const updatePriceRange = async (min: number, max: number) => {
    if (!catalog) return;
    const updated = { ...catalog, minPrice: min, maxPrice: max };
    setCatalog(updated);
    await fetch("/api/facebook/catalog", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
  };
  const runSync = async () => {
    setSyncState("syncing");
    try {
      const res = await fetch("/api/facebook/catalog/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const d = await res.json();
      setSyncState("done");
      if (!res.ok) showToast(`Sync error: ${d.error ?? "Failed"}`);
      else showToast(`Synced ${d.synced ?? 0} products to Meta Commerce.`);
    } catch {
      setSyncState("done");
      showToast("Catalog sync failed — check credentials.");
    }
    setTimeout(() => setSyncState("idle"), 3000);
  };

  // ── Pixel ────────────────────────────────────────────────────────────────
  const togglePixelEvent = async (ev: PixelEvent) => {
    setPixelEvents((p) => p.map((e) => e.id === ev.id ? { ...e, enabled: !e.enabled } : e));
    await fetch(`/api/facebook/pixel-events/${ev.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !ev.enabled }) });
    showToast(`"${ev.storeEvent}" ${ev.enabled ? "disabled" : "enabled"}.`);
  };

  // ── Audiences ────────────────────────────────────────────────────────────
  const createAudience = async () => {
    if (!newAudName.trim()) return;
    const res = await fetch("/api/facebook/audiences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newAudName.trim(), type: newAudType }) });
    if (res.ok) { const created = await res.json(); setAudiences((p) => [created, ...p]); setNewAudName(""); showToast(`Audience "${newAudName}" creation started.`); }
  };
  const toggleAudience = async (aud: Audience) => {
    const next = aud.status === "Active" ? "Paused" : "Active";
    setAudiences((p) => p.map((a) => a.id === aud.id ? { ...a, status: next } : a));
    await fetch(`/api/facebook/audiences/${aud.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
  };
  const deleteAudience = async (aud: Audience) => {
    setAudiences((p) => p.filter((a) => a.id !== aud.id));
    await fetch(`/api/facebook/audiences/${aud.id}`, { method: "DELETE" });
    showToast(`Audience "${aud.name}" deleted.`);
  };

  // ── Credentials ──────────────────────────────────────────────────────────
  const saveFbCreds = async () => {
    setCredsSaving(true);
    await fetch("/api/channels/credentials/facebook", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credsDirty) });
    setFbCreds(credsDirty);
    setCredsSaving(false);
    showToast("API credentials saved securely.");
  };
  const testFbConn = async () => {
    setTestingConn(true); setTestResult(null);
    const res = await fetch("/api/channels/configs/facebook/test", { method: "POST" });
    if (res.ok) setTestResult(await res.json());
    setTestingConn(false);
  };

  // ── Page Posts ───────────────────────────────────────────────────────────
  const submitPost = async (status: "Published" | "Scheduled" | "Draft") => {
    if (!caption.trim()) { showToast("Caption is required."); return; }
    if (status === "Scheduled" && !scheduleTime) { showToast("Choose a scheduled time."); return; }
    const key = status === "Published" ? "posting" : status === "Scheduled" ? "scheduling" : "drafting";
    setPostSubmitting(key);
    const finalImageUrl = imageUrl || linkCardImage || null;
    const body = {
      caption,
      imageUrl: finalImageUrl,
      link: linkUrl || null,
      postType,
      scheduledFor: status === "Scheduled" ? scheduleTime : null,
      status,
      taggedProducts: taggedProducts.length > 0 ? taggedProducts : undefined,
    };
    const res = await fetch("/api/facebook/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      const created = await res.json();
      setPosts((p) => [created, ...p]);
      setCaption(""); setImageUrl(""); setLinkUrl(""); setLinkCardImage(""); setLinkCardTitle(""); setLinkCardDomain(""); setScheduleTime("");
      setTaggedProducts([]);
      showToast(status === "Published" ? "Post published to Facebook Page." : status === "Scheduled" ? `Post scheduled for ${scheduleTime}.` : "Draft saved.");
    }
    setPostSubmitting("idle");
  };

  const publishPost = async (post: PagePost) => {
    setPublishingId(post.id);
    const res = await fetch(`/api/facebook/posts/${post.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) { const updated = await res.json(); setPosts((p) => p.map((x) => x.id === post.id ? updated : x)); showToast("Post published to Facebook Page."); }
    else { const err = await res.json().catch(() => ({})); showToast(err.error || "Facebook publish failed."); }
    setPublishingId(null);
  };

  const deletePost = async (post: PagePost) => {
    setPosts((p) => p.filter((x) => x.id !== post.id));
    await fetch(`/api/facebook/posts/${post.id}`, { method: "DELETE" });
    showToast("Post deleted.");
  };

  const useTemplate = async (tpl: PostTemplate) => {
    setCaption(tpl.body); setPostType(tpl.postType);
    setShowTemplates(false);
    await fetch(`/api/facebook/post-templates/${tpl.id}/use`, { method: "PUT" });
    setPostTemplates((p) => p.map((t) => t.id === tpl.id ? { ...t, usageCount: t.usageCount + 1 } : t));
    showToast(`Template "${tpl.name}" loaded.`);
    captionRef.current?.focus();
  };

  const saveNewTemplate = async () => {
    if (!newTplName.trim() || !newTplBody.trim()) { showToast("Name and body required."); return; }
    const res = await fetch("/api/facebook/post-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newTplName, body: newTplBody, postType: newTplType }) });
    if (res.ok) { const created = await res.json(); setPostTemplates((p) => [created, ...p]); setNewTplName(""); setNewTplBody(""); setShowNewTpl(false); showToast("Template saved."); }
  };

  const publishReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reelVideoFile && !reelVideoUrl.trim()) {
      showToast("Please upload a video file or provide a video URL for the Reel.");
      return;
    }
    setReelSubmitting(true);
    setReelStatusResult(null);
    try {
      const formData = new FormData();
      if (reelVideoFile) {
        formData.append("video", reelVideoFile);
      } else {
        formData.append("videoUrl", reelVideoUrl.trim());
      }
      if (reelTitle.trim()) formData.append("title", reelTitle.trim());
      if (reelDescription.trim()) formData.append("description", reelDescription.trim());
      if (reelTaggedProducts.length > 0) {
        formData.append("productTags", JSON.stringify(reelTaggedProducts));
      }

      const res = await fetch("/api/facebook/reels/publish", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Reel published successfully!");
        setReelStatusResult(data);
        setReelTitle("");
        setReelDescription("");
        setReelVideoUrl("");
        setReelVideoFile(null);
        setReelTaggedProducts([]);
        if (reelFileInputRef.current) reelFileInputRef.current.value = "";
        loadAll();
      } else {
        showToast(data.error || "Failed to publish Facebook Reel.");
      }
    } catch (err: any) {
      showToast(err?.message || "Network error while publishing Reel.");
    } finally {
      setReelSubmitting(false);
    }
  };

  const publishStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyMediaFile && !storyMediaUrl.trim()) {
      showToast("Please select a media file or URL for the Story.");
      return;
    }
    setStorySubmitting(true);
    try {
      const formData = new FormData();
      if (storyMediaFile) {
        formData.append("media", storyMediaFile);
      } else {
        formData.append("mediaUrl", storyMediaUrl.trim());
      }
      formData.append("mediaType", storyType);
      if (storyCaption.trim()) formData.append("caption", storyCaption.trim());
      if (storyTaggedProducts.length > 0) {
        formData.append("productTags", JSON.stringify(storyTaggedProducts));
      }

      const res = await fetch("/api/facebook/stories/publish", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Facebook ${storyType === "video" ? "Video" : "Photo"} Story published!`);
        setStoryMediaUrl("");
        setStoryCaption("");
        setStoryMediaFile(null);
        setStoryTaggedProducts([]);
        if (storyFileInputRef.current) storyFileInputRef.current.value = "";
        loadAll();
      } else {
        showToast(data.error || "Failed to publish Page Story.");
      }
    } catch (err: any) {
      showToast(err?.message || "Network error publishing Story.");
    } finally {
      setStorySubmitting(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const publishedPosts  = posts.filter((p) => p.status === "Published");
  const scheduledPosts  = posts.filter((p) => p.status === "Scheduled");
  const draftPosts      = posts.filter((p) => p.status === "Draft");
  const filteredPosts   = posts.filter((p) => postFilter === "All" || p.status === postFilter);
  const totalReach      = publishedPosts.reduce((s, p) => s + p.reach, 0);
  const totalLikes      = publishedPosts.reduce((s, p) => s + p.likes, 0);
  const configuredCredsCount = FB_CRED_FIELDS.filter((f) => !!fbCreds[f.key]).length;
  const tabs: { key: ActiveTab; label: string; icon: any; badge?: number }[] = [
    { key: "posts",       label: "Live Posts",       icon: <MdRssFeed /> },
    { key: "reels",       label: "Facebook Reels",   icon: <MdSlowMotionVideo /> },
    { key: "stories",     label: "Page Stories",     icon: <MdAutoAwesomeMotion /> },
    { key: "credentials", label: "Real Credentials",  icon: <MdKey />          },
    { key: "catalog",     label: "Live Catalog",      icon: <MdStorage />     },
    { key: "pixel",       label: "Live Pixel Events", icon: <MdTrackChanges />},
    { key: "audiences",   label: "Live Audiences",    icon: <MdGroup />        },
    { key: "ads",         label: "Live Ad Data",      icon: <MdBarChart />    },
  ];

  if (loading) return (
    <AdminLayout sidebar="channels">
      <div className="flex items-center justify-center min-h-screen">
        <MdRefresh className="animate-spin text-[#006c49] text-3xl" />
      </div>
    </AdminLayout>
  );

  if (loadError) return (
    <AdminLayout sidebar="channels">
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <MdCloudOff className="text-red-400 text-5xl" />
        <h2 className="font-serif text-2xl font-semibold text-[#0b1c30]">Could not load Facebook data</h2>
        <p className="font-[Manrope] text-[#7c839b] text-sm">This usually means your session has expired or the API server is restarting.</p>
        <button onClick={() => { setLoadError(false); setLoading(true); loadAll(); }}
          className="mt-2 px-6 py-3 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors rounded-lg flex items-center gap-2">
          <MdRefresh className="text-sm" /> Try Again
        </button>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout sidebar="channels">
      <div className="p-4 sm:p-10 max-w-[1320px] mx-auto min-h-screen">
        {toast && (
          <div className="fixed top-6 right-6 z-50 bg-black text-white px-6 py-3 rounded-lg shadow-2xl font-[Manrope] text-sm font-bold flex items-center gap-3">
            <MdCheckCircle className="text-[#6cf8bb] text-base" />{toast}
          </div>
        )}

        {/* Header */}
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <Link href="/channels" className="inline-flex items-center gap-1.5 text-[#7c839b] hover:text-[#006c49] transition-colors font-[Manrope] font-bold text-xs tracking-widest uppercase mb-4 no-underline">
              <MdArrowBack className="text-base" /> Channel Hub
            </Link>
            <div className="flex items-center gap-3 mb-2">
              <SiMeta className="text-3xl text-[#0668E1]" />
              <h2 className="text-3xl sm:text-[36px] font-serif font-bold text-[#0b1c30]">Meta Manager</h2>
            </div>
            <p className="font-[Manrope] text-[16px] text-[#7c839b] max-w-2xl">Compose & schedule page posts, manage catalog rules, pixel events, and custom audiences.</p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-3">
            <Link href="/chat" className="no-underline">
              <button className="flex items-center gap-1.5 text-xs font-[Manrope] font-bold text-white bg-[#006c49] hover:bg-[#005a3c] px-4 py-2 rounded-lg transition-all shadow-sm">
                <span className="material-symbols-outlined text-sm">chat</span>
                <span>Open CRM Inbox</span>
              </button>
            </Link>
            <div className="flex flex-col gap-2">
              {connectionMeta.slice(0, 2).map((item) => {
              const conn = connections.find((c) => c.connectionKey === item.key);
              return (
                <div key={item.key} className="flex items-center gap-2 text-xs font-[Manrope]">
                  <span className={`w-1.5 h-1.5 rounded-full ${conn?.active ? "bg-[#006c49]" : "bg-amber-500"}`}></span>
                  <span className="text-[#7c839b]">{item.label}</span>
                  <span className={`font-bold ${conn?.active ? "text-[#006c49]" : "text-amber-600"}`}>{conn?.active ? "Active" : "Paused"}</span>
                </div>
              );
            })}
          </div>
          </div>
        </div>

        {/* 1-Click Meta Business Suite Login Banner */}
        {metaStatus?.connected || fbCreds.source === "meta_business" ? (
          <div className="mb-8 p-5 bg-gradient-to-r from-emerald-50/70 to-teal-50/50 rounded-xl border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <SiMeta className="text-xl" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-bold text-sm text-emerald-950">Meta Business Suite Connected</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-[Manrope] font-bold bg-[#6cf8bb] text-[#00714d]">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs font-[Manrope] text-emerald-700 mt-0.5">
                  Linked to {metaStatus?.business?.name ? `"${metaStatus.business.name}"` : "Meta Business Suite"}. Facebook Page, tokens, and catalog sync are managed automatically.
                </p>
              </div>
            </div>
            <Link
              id="go-to-meta-login-banner-btn"
              href="/channels/meta-business"
              className="shrink-0 px-4 py-2.5 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 font-[Manrope] font-bold text-xs tracking-wider uppercase rounded-lg transition-colors flex items-center gap-2 no-underline self-start sm:self-auto shadow-xs"
            >
              <SiMeta className="text-sm" />
              <span>Manage Meta Suite</span>
            </Link>
          </div>
        ) : (
          <div className="mb-8 p-5 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 rounded-xl border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#0668E1] text-white flex items-center justify-center shrink-0 shadow-xs">
                <SiMeta className="text-xl" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-sm text-[#0b1c30]">One-Click Facebook & Meta Business Login</h3>
                <p className="text-xs font-[Manrope] text-[#7c839b] mt-0.5">
                  Authenticate via Facebook for Business to auto-discover Pages, Page Tokens, Catalog, and Instagram without copy-pasting tokens.
                </p>
              </div>
            </div>
            <Link
              id="go-to-meta-login-banner-btn"
              href="/channels/meta-business"
              className="shrink-0 px-4 py-2.5 bg-[#0668E1] hover:bg-blue-700 text-white font-[Manrope] font-bold text-xs tracking-wider uppercase rounded-lg transition-colors flex items-center gap-2 no-underline self-start sm:self-auto"
            >
              <SiMeta className="text-sm" />
              <span>Launch Meta Business Login</span>
            </Link>
          </div>
        )}

        {/* Connection toggles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {connectionMeta.map((item) => {
            const conn = connections.find((c) => c.connectionKey === item.key);
            const active = conn?.active ?? false;
            return (
              <div key={item.key} className="bg-white p-4 rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-xl shrink-0">{item.icon}</div>
                  <span className="font-[Manrope] font-semibold text-sm">{item.label}</span>
                </div>
                <button onClick={() => toggleConnection(item.key, !active)}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ${active ? "bg-[#006c49]" : "bg-slate-300"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${active ? "translate-x-5" : "translate-x-0.5"}`}></span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Tabbed Panel */}
        <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-6 py-4 font-[Manrope] font-bold text-xs tracking-widest uppercase transition-colors whitespace-nowrap relative ${activeTab === t.key ? "border-b-2 border-[#006c49] text-[#006c49]" : "text-[#7c839b] hover:text-black"}`}>
                <div className="text-lg">{t.icon}</div>{t.label}
                {t.badge && <span className="bg-blue-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{t.badge}</span>}
              </button>
            ))}
          </div>

          <div className="p-8">

            {/* ══════════════════════ PAGE POSTS ══════════════════════ */}
            {activeTab === "posts" && (
              <div className="grid grid-cols-12 gap-8">
                {/* Left Column: Post Composer */}
                <div className="col-span-12 lg:col-span-6 space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                    <div>
                      <h3 className="font-serif text-[20px] font-semibold text-slate-900">Create a Post</h3>
                      <p className="text-xs text-slate-500 font-[Manrope]">Draft, schedule, or publish posts directly to your linked Facebook Page.</p>
                    </div>

                    <div className="space-y-4">
                      {/* Caption/Message Text Area */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="font-[Manrope] font-bold text-[11px] tracking-widest uppercase text-[#45464d]">Message / Caption</label>
                          <span className="text-[10px] text-slate-400 font-[Manrope]">{caption.length} chars</span>
                        </div>
                        <textarea
                          ref={captionRef}
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
                          placeholder="Write something engaging... Mention another page using the helper below!"
                          rows={4}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none transition-all focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
                        />
                      </div>

                      {/* Mentioning Feature Helper */}
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5 font-[Manrope]">
                            <span className="material-symbols-outlined text-sm text-[#006c49]">alternate_email</span>
                            Mention Facebook Page
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowMentionSearch(!showMentionSearch)}
                            className="text-xs text-[#0668E1] font-semibold hover:underline"
                          >
                            {showMentionSearch ? "Close search" : "Search Page to Tag"}
                          </button>
                        </div>

                        {showMentionSearch && (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={mentionQuery}
                              onChange={(e) => {
                                setMentionQuery(e.target.value);
                                handleMentionSearch(e.target.value);
                              }}
                              placeholder="Type page name to search... (e.g. Vogue)"
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#006c49]"
                            />
                            {mentionLoading && <p className="text-[10px] text-slate-400 animate-pulse">Searching Meta Pages...</p>}
                            {mentionResults.length > 0 ? (
                              <div className="max-h-36 overflow-y-auto border border-slate-100 rounded-lg bg-white divide-y divide-slate-50">
                                {mentionResults.map((page) => (
                                  <button
                                    key={page.id}
                                    type="button"
                                    onClick={() => insertMention(page.id, page.name)}
                                    className="w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50"
                                  >
                                    <div>
                                      <p className="font-semibold text-slate-800">{page.name}</p>
                                      {page.username && <p className="text-[10px] text-slate-400">@{page.username}</p>}
                                    </div>
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-mono">Tag @[{page.id}]</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              mentionQuery && !mentionLoading && <p className="text-[10px] text-slate-400">No pages found.</p>
                            )}
                          </div>
                        )}
                        <p className="text-[10px] text-slate-500 leading-normal font-[Manrope]">
                          Adding a mention inserts <code className="bg-slate-200/60 px-1 rounded font-mono font-bold text-slate-700">@[Page_ID]</code> or <code className="bg-slate-200/60 px-1 rounded font-mono font-bold text-slate-700">@PageName</code> into your text. <em>Note:</em> Under Meta Platform Privacy rules, third-party APIs can tag public Facebook Pages and Instagram accounts, while tagging personal user profiles is restricted by Meta.
                        </p>
                      </div>

                      {/* Media & Attachment Selection */}
                      <div className="space-y-3 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                          <label className="font-[Manrope] font-bold text-[11px] tracking-widest uppercase text-[#45464d] flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-[#006c49]">image</span>
                            Post Photo / Media
                          </label>
                          <div className="flex bg-slate-200/70 p-0.5 rounded-lg text-[11px] font-[Manrope] font-bold">
                            <button
                              type="button"
                              onClick={() => setMediaSource("upload")}
                              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                mediaSource === "upload" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              <MdCloudUpload className="text-xs" />
                              Upload File
                            </button>
                            <button
                              type="button"
                              onClick={() => setMediaSource("url")}
                              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                mediaSource === "url" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              <MdLink className="text-xs" />
                              Image URL
                            </button>
                          </div>
                        </div>

                        {mediaSource === "upload" ? (
                          <div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleFileUpload(e.target.files[0]);
                                }
                              }}
                            />
                            {!imageUrl ? (
                              linkUrl && linkCardImage ? (
                                <div className="p-3 bg-[#f8f9ff] border border-emerald-300/80 rounded-xl space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-[#006c49] font-[Manrope] flex items-center gap-1">
                                      <span className="material-symbols-outlined text-base">auto_awesome</span>
                                      Prefilled Link Card Image
                                    </span>
                                    <span className="px-2 py-0.5 bg-emerald-100 text-[#006c49] text-[9px] font-mono font-bold rounded uppercase">
                                      Link Attachment Card
                                    </span>
                                  </div>
                                  <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-white h-36 group">
                                    <img
                                      src={linkCardImage}
                                      alt="Prefilled card"
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-3 py-1.5 bg-white text-slate-800 text-xs font-bold rounded-lg shadow-sm hover:bg-slate-100 flex items-center gap-1 font-[Manrope]"
                                      >
                                        <MdCloudUpload /> Upload Custom File
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setImageUrl("")}
                                        className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-red-700 flex items-center gap-1 font-[Manrope]"
                                      >
                                        <MdDelete /> Clear
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-[Manrope]">
                                    <span>Prefilled for <strong>{linkCardTitle || linkCardDomain || "selected link"}</strong></span>
                                    <button
                                      type="button"
                                      onClick={() => fileInputRef.current?.click()}
                                      className="text-[#006c49] font-bold hover:underline"
                                    >
                                      Upload custom image
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onClick={() => fileInputRef.current?.click()}
                                  className="border-2 border-dashed border-slate-300 hover:border-[#006c49] bg-white rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 group"
                                >
                                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#006c49] group-hover:scale-110 flex items-center justify-center transition-transform">
                                    <MdCloudUpload className="text-xl" />
                                  </div>
                                  <p className="text-xs font-bold text-slate-800 font-[Manrope]">
                                    {uploadingImage ? "Uploading image to store media..." : "Click to select local image file"}
                                  </p>
                                  <p className="text-[11px] text-slate-400 font-[Manrope]">
                                    PNG, JPG, WebP, GIF, AVIF up to 30MB
                                  </p>
                                </div>
                              )
                            ) : (
                              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white group">
                                <img
                                  src={imageUrl}
                                  alt="Post attachment"
                                  className="w-full h-40 object-cover"
                                />
                                {imageUrl === linkCardImage && (
                                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-900/80 backdrop-blur-xs text-white text-[10px] font-bold font-[Manrope] rounded shadow-xs flex items-center gap-1">
                                    <span className="material-symbols-outlined text-xs">auto_awesome</span>
                                    Prefilled from Link
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-3 py-1.5 bg-white text-slate-800 text-xs font-bold rounded-lg shadow-sm hover:bg-slate-100 flex items-center gap-1 font-[Manrope]"
                                  >
                                    <MdCloudUpload /> Change File
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setImageUrl("")}
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
                              value={imageUrl}
                              onChange={(e) => setImageUrl(e.target.value)}
                              placeholder="https://example.com/image.jpg"
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#006c49]"
                            />
                            {imageUrl && (
                              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white h-32">
                                <img
                                  src={imageUrl}
                                  alt="Post preview"
                                  className="w-full h-full object-cover"
                                  onError={() => setImageUploadError("Image failed to load from provided URL")}
                                />
                                <button
                                  type="button"
                                  onClick={() => setImageUrl("")}
                                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black text-white rounded-lg text-xs"
                                >
                                  <MdDelete />
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {imageUploadError && (
                          <p className="text-[11px] text-red-600 font-[Manrope]">{imageUploadError}</p>
                        )}
                      </div>

                      {/* Link Attachment Picker with Auto-Detection & Store Dropdown */}
                      <LinkAttachmentPicker
                        value={linkUrl}
                        onChange={(newUrl) => {
                          setLinkUrl(newUrl);
                          if (!newUrl) {
                            setLinkCardImage("");
                            setLinkCardTitle("");
                            setLinkCardDomain("");
                            if (imageUrl && imageUrl === linkCardImage) {
                              setImageUrl("");
                            }
                          }
                        }}
                        onImageDetected={(imgUrl, meta) => {
                          setLinkCardImage(imgUrl);
                          if (meta) {
                            setLinkCardTitle(meta.title);
                            setLinkCardDomain(meta.domain);
                          }
                          // Automatically prefill imageUrl if no image set or if imageUrl was previous card image
                          if (!imageUrl || imageUrl === linkCardImage) {
                            setImageUrl(imgUrl);
                          }
                        }}
                        messageText={caption}
                        label="Link Attachment (Optional URL)"
                        placeholder="https://example.com/promo or select from store dropdown"
                        hint="Attach a clickable link card to your Facebook post. Supports auto-detection from caption, store presets, and catalog products."
                      />

                      {/* Post Type Selector */}
                      <div className="space-y-1.5">
                        <label className="font-[Manrope] font-bold text-[11px] tracking-widest uppercase text-[#45464d]">Post Type / Category</label>
                        <select
                          value={postType}
                          onChange={(e) => setPostType(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#006c49]"
                        >
                          {POST_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      {/* Product Tagging (Shoppable Facebook Posts) */}
                      <ProductTagPicker
                        platform="facebook"
                        targetType="post"
                        taggedProducts={taggedProducts}
                        onChange={setTaggedProducts}
                        onAppendToCaption={(txt) => setCaption((prev) => `${prev}${txt}`)}
                        previewImageUrl={imageUrl || linkCardImage}
                        maxTags={20}
                      />

                      {/* Schedule Settings */}
                      <div className="p-4 bg-[#f8f9ff] rounded-xl border border-slate-100 space-y-3">
                        <div className="flex items-center gap-4 text-xs font-[Manrope]">
                          <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                            <input
                              type="radio"
                              name="scheduleWhen"
                              checked={scheduleWhen === "now"}
                              onChange={() => setScheduleWhen("now")}
                              className="accent-[#006c49]"
                            />
                            Publish Now
                          </label>
                          <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                            <input
                              type="radio"
                              name="scheduleWhen"
                              checked={scheduleWhen === "schedule"}
                              onChange={() => setScheduleWhen("schedule")}
                              className="accent-[#006c49]"
                            />
                            Schedule Post
                          </label>
                        </div>

                        {scheduleWhen === "schedule" && (
                          <div className="space-y-1.5">
                            <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#7c839b]">Schedule Date & Time</label>
                            <input
                              type="datetime-local"
                              value={scheduleTime}
                              onChange={(e) => setScheduleTime(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#006c49]"
                            />
                          </div>
                        )}
                      </div>

                      {/* Templates selector button */}
                      <div className="flex justify-between items-center text-xs pt-1">
                        <button
                          type="button"
                          onClick={() => setShowTemplates(!showTemplates)}
                          className="text-[#006c49] font-bold hover:underline flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">auto_awesome</span>
                          {showTemplates ? "Hide Templates" : "Use Post Template"}
                        </button>
                      </div>

                      {showTemplates && (
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-3 max-h-48 overflow-y-auto">
                          {postTemplates.length === 0 ? (
                            <p className="text-xs text-slate-400">No templates saved yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {postTemplates.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => useTemplate(t)}
                                  className="w-full text-left p-2.5 bg-white rounded border border-slate-100 hover:border-[#006c49] text-xs flex justify-between items-center transition-colors"
                                >
                                  <div className="truncate pr-4">
                                    <p className="font-semibold text-slate-800">{t.name}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{t.body}</p>
                                  </div>
                                  <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">Used {t.usageCount}x</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Post actions */}
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => submitPost(scheduleWhen === "schedule" ? "Scheduled" : "Published")}
                          disabled={postSubmitting !== "idle"}
                          className="flex-1 py-3 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] disabled:opacity-50 transition-colors rounded-lg flex items-center justify-center gap-2"
                        >
                          {postSubmitting === "posting" || postSubmitting === "scheduling" ? (
                            <>
                              <MdRefresh className="animate-spin" />
                              <span>Processing...</span>
                            </>
                          ) : (
                            <>
                              <MdRssFeed />
                              <span>{scheduleWhen === "schedule" ? "Schedule Post" : "Publish to Facebook"}</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => submitPost("Draft")}
                          disabled={postSubmitting !== "idle"}
                          className="px-5 py-3 border border-slate-200 font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-slate-50 transition-colors rounded-lg flex items-center justify-center gap-2"
                        >
                          <span>Save Draft</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Feed and Stats */}
                <div className="col-span-12 lg:col-span-6 space-y-6">
                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Published",    value: publishedPosts.length,    icon: "check_circle",  cls: "text-[#006c49]"  },
                      { label: "Scheduled",    value: scheduledPosts.length,    icon: "schedule",      cls: "text-blue-600"   },
                      { label: "Total Reach",  value: fmt(totalReach),          icon: "visibility",    cls: "text-[#006c49]"  },
                    ].map((s) => (
                      <div key={s.label} className="bg-[#f8f9ff] rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`material-symbols-outlined text-base ${s.cls}`}>{s.icon}</span>
                          <span className="font-[Manrope] font-bold text-[9px] tracking-widest uppercase text-[#7c839b]">{s.label}</span>
                        </div>
                        <p className="text-[20px] font-serif font-semibold">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Post feed list */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="font-serif text-[18px] font-semibold text-slate-900">Post Feed</h3>
                      <div className="flex gap-1">
                        {(["All", "Published", "Scheduled", "Draft"] as PostFilter[]).map((f) => (
                          <button
                            key={f}
                            onClick={() => setPostFilter(f)}
                            className={`px-2.5 py-1 rounded text-xs font-[Manrope] font-bold transition-all ${
                              postFilter === f ? "bg-slate-100 text-black" : "text-slate-400 hover:text-black"
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    {filteredPosts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-[#7c839b] font-[Manrope] bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <span className="material-symbols-outlined text-3xl mb-2 text-slate-300">post_add</span>
                        No {postFilter !== "All" ? postFilter.toLowerCase() : ""} posts found.
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                        {filteredPosts.map((post) => (
                          <div key={post.id} className="rounded-xl border overflow-hidden bg-white hover:shadow-xs transition-shadow">
                            <div className="px-4 pt-4 pb-3">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-[#006c49]/10 text-[#006c49] flex items-center justify-center font-bold text-xs">LB</div>
                                  <div>
                                    <p className="font-[Manrope] font-bold text-xs text-[#0b1c30] leading-tight">Luxe Boutique</p>
                                    <p className="text-[9px] text-[#7c839b] font-[Manrope]">{new Date(post.createdAt).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${postStatusStyle[post.status] ?? "bg-slate-100"}`}>
                                  {post.status}
                                </span>
                              </div>

                              <p className="text-sm font-[Manrope] text-[#0b1c30] whitespace-pre-line line-clamp-4 mb-3">{post.caption}</p>
                              {post.imageUrl && <img src={post.imageUrl} alt="" className="w-full rounded-lg mb-3 object-cover max-h-48" />}
                              {post.link && <div className="text-xs font-[Manrope] text-[#006c49] bg-[#f0faf6] border border-[#c3eed8] rounded-lg px-3 py-1.5 break-all">{post.link}</div>}
                              
                              <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between gap-3 text-xs text-slate-400 font-[Manrope]">
                                <div className="flex items-center gap-4">
                                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">thumb_up</span>{post.likes}</span>
                                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">chat_bubble</span>{post.comments}</span>
                                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">share</span>{post.shares}</span>
                                </div>
                                <div className="flex gap-2">
                                  {post.status !== "Published" && (
                                    <button
                                      onClick={() => publishPost(post)}
                                      disabled={publishingId === post.id}
                                      className="px-2.5 py-1 rounded bg-[#006c49] text-white font-bold uppercase text-[9px] tracking-wider hover:bg-emerald-800 disabled:opacity-50"
                                    >
                                      {publishingId === post.id ? "Publishing…" : "Publish Now"}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => deletePost(post)}
                                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════ FACEBOOK REELS PUBLISHING ══════════════════════ */}
            {activeTab === "reels" && (
              <div className="grid grid-cols-12 gap-8">
                {/* Left Column: Reel Upload & Details */}
                <div className="col-span-12 lg:col-span-7 space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-lg bg-pink-50 text-pink-600 text-lg">
                          <MdSlowMotionVideo />
                        </span>
                        <div>
                          <h3 className="font-serif text-[20px] font-semibold text-slate-900">Publish Facebook Reel</h3>
                          <p className="text-xs text-slate-500 font-[Manrope]">
                            Upload and publish vertical short-form video reels directly to your Facebook Page using the official Meta Video API.
                          </p>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={publishReel} className="space-y-4">
                      {/* Video File Upload / URL input */}
                      <div className="space-y-1.5">
                        <label className="font-[Manrope] font-bold text-[11px] tracking-widest uppercase text-[#45464d]">
                          Reel Video (MP4 / MOV) <span className="text-red-500">*</span>
                        </label>
                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-[Manrope] text-slate-600">Select local file or provide URL</span>
                            <button
                              type="button"
                              onClick={() => reelFileInputRef.current?.click()}
                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-[Manrope] font-bold text-slate-700 hover:border-[#006c49] flex items-center gap-1.5 shadow-xs"
                            >
                              <MdCloudUpload className="text-sm text-[#006c49]" />
                              Browse Video File
                            </button>
                          </div>

                          <input
                            ref={reelFileInputRef}
                            type="file"
                            accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setReelVideoFile(file);
                                setReelVideoUrl("");
                              }
                            }}
                          />

                          {reelVideoFile ? (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                              <div className="flex items-center gap-2 truncate">
                                <MdCheckCircle className="text-emerald-600 shrink-0" />
                                <span className="text-xs font-[Manrope] font-semibold text-emerald-900 truncate">
                                  {reelVideoFile.name} ({(reelVideoFile.size / (1024 * 1024)).toFixed(1)} MB)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setReelVideoFile(null);
                                  if (reelFileInputRef.current) reelFileInputRef.current.value = "";
                                }}
                                className="text-red-600 hover:text-red-800 p-1 text-sm"
                              >
                                <MdDelete />
                              </button>
                            </div>
                          ) : (
                            <div>
                              <input
                                type="text"
                                value={reelVideoUrl}
                                onChange={(e) => setReelVideoUrl(e.target.value)}
                                placeholder="Or enter hosted video URL (https://... or /api/uploads/...)"
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#006c49]"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Reel Title */}
                      <div className="space-y-1.5">
                        <label className="font-[Manrope] font-bold text-[11px] tracking-widest uppercase text-[#45464d]">
                          Reel Title (Optional)
                        </label>
                        <input
                          type="text"
                          value={reelTitle}
                          onChange={(e) => setReelTitle(e.target.value)}
                          placeholder="e.g. Summer Collection Spotlight"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#006c49]"
                        />
                      </div>

                      {/* Reel Description / Caption */}
                      <div className="space-y-1.5">
                        <label className="font-[Manrope] font-bold text-[11px] tracking-widest uppercase text-[#45464d]">
                          Caption / Description
                        </label>
                        <textarea
                          value={reelDescription}
                          onChange={(e) => setReelDescription(e.target.value)}
                          placeholder="Write a captivating description with #hashtags for your Reel..."
                          rows={3}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-xs outline-none focus:border-[#006c49]"
                        />
                      </div>

                      {/* Product Tagging (Shoppable Facebook Reels) */}
                      <ProductTagPicker
                        platform="facebook"
                        targetType="reel"
                        taggedProducts={reelTaggedProducts}
                        onChange={setReelTaggedProducts}
                        onAppendToCaption={(txt) => setReelDescription((prev) => `${prev}${txt}`)}
                        maxTags={30}
                      />

                      {/* Submit Reel Button */}
                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={reelSubmitting || (!reelVideoFile && !reelVideoUrl.trim())}
                          className="w-full py-3 bg-gradient-to-r from-pink-600 to-rose-600 text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:opacity-90 disabled:opacity-50 transition-opacity rounded-lg flex items-center justify-center gap-2 shadow-sm"
                        >
                          {reelSubmitting ? (
                            <>
                              <MdRefresh className="animate-spin text-sm" />
                              <span>Uploading & Publishing Reel...</span>
                            </>
                          ) : (
                            <>
                              <MdSlowMotionVideo className="text-sm" />
                              <span>Publish Facebook Reel</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>

                    {reelStatusResult && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 mt-4">
                        <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs font-[Manrope]">
                          <MdCheckCircle className="text-emerald-600" />
                          <span>Reel Created Successfully!</span>
                        </div>
                        <p className="text-xs text-emerald-700 font-mono">
                          Video ID: {reelStatusResult.videoId}
                        </p>
                        <p className="text-[11px] text-emerald-600 font-[Manrope]">
                          Status: {reelStatusResult.status}. Meta is encoding and delivering your Reel to follower feeds.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Guidelines & Specs */}
                <div className="col-span-12 lg:col-span-5 space-y-6">
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4">
                    <h4 className="font-serif text-[16px] font-bold text-slate-800 flex items-center gap-2">
                      <MdInfo className="text-[#006c49]" /> Facebook Reels Publishing Protocol
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-[Manrope]">
                      Facebook Reels utilizes Meta's 3-Phase Resumable Upload protocol to ensure high reliability for video content:
                    </p>
                    <ul className="space-y-2 text-xs font-[Manrope] text-slate-700 list-disc list-inside">
                      <li><strong>Phase 1 (Start):</strong> Calls <code>POST /&#123;page_id&#125;/video_reels</code> to obtain an authorized session.</li>
                      <li><strong>Phase 2 (Transfer):</strong> Streams binary chunk bytes directly into <code>rupload.facebook.com</code>.</li>
                      <li><strong>Phase 3 (Finish):</strong> Commits publication parameters with <code>video_state=PUBLISHED</code>.</li>
                    </ul>

                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1 text-[11px] font-[Manrope]">
                      <p className="font-bold text-slate-800">Reel Specifications:</p>
                      <p className="text-slate-600">• Aspect ratio: 9:16 vertical orientation recommended</p>
                      <p className="text-slate-600">• Duration: 3 seconds to 90 seconds</p>
                      <p className="text-slate-600">• Container: MP4 or MOV format (H.264 video codec, AAC audio)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════ FACEBOOK PAGE STORIES ══════════════════════ */}
            {activeTab === "stories" && (
              <div className="grid grid-cols-12 gap-8">
                {/* Left Column: Story Composer */}
                <div className="col-span-12 lg:col-span-7 space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600 text-lg">
                          <MdAutoAwesomeMotion />
                        </span>
                        <div>
                          <h3 className="font-serif text-[20px] font-semibold text-slate-900">Publish Page Story</h3>
                          <p className="text-xs text-slate-500 font-[Manrope]">
                            Broadcast 24-hour visual photo or video stories to your Page's followers via the Facebook Stories API.
                          </p>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={publishStory} className="space-y-4">
                      {/* Story Format Switcher */}
                      <div className="space-y-1.5">
                        <label className="font-[Manrope] font-bold text-[11px] tracking-widest uppercase text-[#45464d]">
                          Story Type
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setStoryType("photo");
                              setStoryMediaFile(null);
                            }}
                            className={`p-3 rounded-lg border text-xs font-[Manrope] font-bold flex items-center justify-center gap-2 transition-colors ${
                              storyType === "photo"
                                ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <MdPhotoCamera />
                            <span>Photo Story</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setStoryType("video");
                              setStoryMediaFile(null);
                            }}
                            className={`p-3 rounded-lg border text-xs font-[Manrope] font-bold flex items-center justify-center gap-2 transition-colors ${
                              storyType === "video"
                                ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <MdVideocam />
                            <span>Video Story</span>
                          </button>
                        </div>
                      </div>

                      {/* Story Media Upload / URL */}
                      <div className="space-y-1.5">
                        <label className="font-[Manrope] font-bold text-[11px] tracking-widest uppercase text-[#45464d]">
                          {storyType === "photo" ? "Story Photo (JPEG / PNG / WebP)" : "Story Video (MP4 / MOV)"} <span className="text-red-500">*</span>
                        </label>
                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-[Manrope] text-slate-600">Select file or provide hosted URL</span>
                            <button
                              type="button"
                              onClick={() => storyFileInputRef.current?.click()}
                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-[Manrope] font-bold text-slate-700 hover:border-indigo-600 flex items-center gap-1.5 shadow-xs"
                            >
                              <MdCloudUpload className="text-sm text-indigo-600" />
                              Browse Media File
                            </button>
                          </div>

                          <input
                            ref={storyFileInputRef}
                            type="file"
                            accept={storyType === "photo" ? "image/*" : "video/*"}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setStoryMediaFile(file);
                                setStoryMediaUrl("");
                              }
                            }}
                          />

                          {storyMediaFile ? (
                            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
                              <div className="flex items-center gap-2 truncate">
                                <MdCheckCircle className="text-indigo-600 shrink-0" />
                                <span className="text-xs font-[Manrope] font-semibold text-indigo-900 truncate">
                                  {storyMediaFile.name} ({(storyMediaFile.size / (1024 * 1024)).toFixed(1)} MB)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setStoryMediaFile(null);
                                  if (storyFileInputRef.current) storyFileInputRef.current.value = "";
                                }}
                                className="text-red-600 hover:text-red-800 p-1 text-sm"
                              >
                                <MdDelete />
                              </button>
                            </div>
                          ) : (
                            <div>
                              <input
                                type="text"
                                value={storyMediaUrl}
                                onChange={(e) => setStoryMediaUrl(e.target.value)}
                                placeholder="Or enter public media URL (https://... or /api/uploads/...)"
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-600"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Optional Caption */}
                      <div className="space-y-1.5">
                        <label className="font-[Manrope] font-bold text-[11px] tracking-widest uppercase text-[#45464d]">
                          Story Note / Caption (Optional)
                        </label>
                        <input
                          type="text"
                          value={storyCaption}
                          onChange={(e) => setStoryCaption(e.target.value)}
                          placeholder="e.g. Flash sale ending in 24 hours!"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-600"
                        />
                      </div>

                      {/* Product Tagging (Shoppable Facebook Stories) */}
                      <ProductTagPicker
                        platform="facebook"
                        targetType="story"
                        taggedProducts={storyTaggedProducts}
                        onChange={setStoryTaggedProducts}
                        onAppendToCaption={(txt) => setStoryCaption((prev) => `${prev}${txt}`)}
                        maxTags={20}
                      />

                      {/* Submit Story Button */}
                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={storySubmitting || (!storyMediaFile && !storyMediaUrl.trim())}
                          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:opacity-90 disabled:opacity-50 transition-opacity rounded-lg flex items-center justify-center gap-2 shadow-sm"
                        >
                          {storySubmitting ? (
                            <>
                              <MdRefresh className="animate-spin text-sm" />
                              <span>Publishing Story...</span>
                            </>
                          ) : (
                            <>
                              <MdAutoAwesomeMotion className="text-sm" />
                              <span>Publish to Facebook Stories</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Right Column: Story API specs */}
                <div className="col-span-12 lg:col-span-5 space-y-6">
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4">
                    <h4 className="font-serif text-[16px] font-bold text-slate-800 flex items-center gap-2">
                      <MdInfo className="text-indigo-600" /> Page Stories API Workflow
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-[Manrope]">
                      The Facebook Page Stories API supports both photo and video publishing modes:
                    </p>
                    <ul className="space-y-2 text-xs font-[Manrope] text-slate-700 list-disc list-inside">
                      <li><strong>Photo Stories:</strong> Uploads an unpublished photo object to <code>/{`{page_id}`}/photos</code> (with <code>published=false</code>), then posts the photo ID to <code>/{`{page_id}`}/photo_stories</code>.</li>
                      <li><strong>Video Stories:</strong> Initiates a 3-phase video upload session directly on <code>/{`{page_id}`}/video_stories</code> and activates delivery.</li>
                    </ul>

                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1 text-[11px] font-[Manrope]">
                      <p className="font-bold text-slate-800">Story Specifications:</p>
                      <p className="text-slate-600">• Aspect ratio: 9:16 vertical full screen</p>
                      <p className="text-slate-600">• Photo format: JPEG, PNG</p>
                      <p className="text-slate-600">• Video duration: up to 60 seconds</p>
                      <p className="text-slate-600">• Stories remain visible to Page followers for 24 hours</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════ API CREDENTIALS ══════════════════════ */}
            {activeTab === "credentials" && (
              <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12 lg:col-span-7 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-[20px] font-semibold mb-1">Meta API Credentials</h3>
                      <p className="text-sm text-[#7c839b] font-[Manrope]">Enter your credentials from the Meta for Developers dashboard. Saved securely to the database.</p>
                    </div>
                    <span className={`text-[10px] font-[Manrope] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${configuredCredsCount === FB_CRED_FIELDS.length ? "bg-[#6cf8bb] text-[#00714d] border-[#6cf8bb]" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                      {configuredCredsCount}/{FB_CRED_FIELDS.length} Configured
                    </span>
                  </div>

                  {/* 1-Click Meta Business Login Shortcut Box */}
                  {metaStatus?.connected || fbCreds.source === "meta_business" ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <SiMeta className="text-2xl text-[#0668E1] shrink-0" />
                        <div>
                          <p className="text-xs font-serif font-bold text-emerald-900 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                            Auto-Configured via Meta Business Suite
                          </p>
                          <p className="text-[11px] font-[Manrope] text-emerald-700 mt-0.5">
                            This Facebook Page was automatically discovered and linked from your Meta Business Suite login. Manual token entry is optional.
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/channels/meta-business"
                        className="px-3 py-1 bg-white border border-emerald-300 text-emerald-800 text-xs font-bold rounded-lg no-underline hover:bg-emerald-100 whitespace-nowrap"
                      >
                        Manage Suite
                      </Link>
                    </div>
                  ) : (
                    <div className="p-4 bg-[#eff4ff] border border-blue-200 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <SiMeta className="text-2xl text-[#0668E1] shrink-0" />
                        <div>
                          <p className="text-xs font-serif font-bold text-[#0b1c30]">Don't want to copy and paste API tokens manually?</p>
                          <p className="text-[11px] font-[Manrope] text-[#7c839b] mt-0.5">Use Meta Business Suite Login to authenticate directly with Facebook in one click.</p>
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
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-3 mb-4">
                      <MdKey className="text-2xl text-slate-400" />
                      <div>
                        <p className="text-sm font-[Manrope] font-bold text-black">Managed via Platform Environment Variables</p>
                        <p className="text-xs font-[Manrope] text-slate-500 mt-1">Manual entry of Meta credentials is disabled in this environment.</p>
                      </div>
                    </div>
                    <ul className="space-y-2 text-xs font-[Manrope] text-slate-600 list-disc list-inside">
                      {FB_CRED_FIELDS.map(f => (
                        <li key={f.key}><span className="font-bold text-slate-800">{f.label}</span></li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={testFbConn} disabled={testingConn}
                      className="px-6 py-3 border border-slate-200 font-[Manrope] font-bold text-xs tracking-widest uppercase hover:border-[#006c49] hover:text-[#006c49] disabled:opacity-60 transition-colors rounded-lg flex items-center gap-2">
                      <span className={`material-symbols-outlined text-sm ${testingConn ? "animate-spin" : ""}`}>{testingConn ? "refresh" : "wifi_tethering"}</span>
                      {testingConn ? "Testing…" : "Test Connection"}
                    </button>
                  </div>
                  {testResult && (
                    <div className={`p-4 rounded-xl border font-[Manrope] text-sm ${testResult.pass ? "bg-[#f0faf6] border-[#c3eed8] text-[#006c49]" : "bg-red-50 border-red-200 text-red-700"}`}>
                      <div className="flex items-center gap-2 font-bold mb-1">
                        <span className="material-symbols-outlined text-base">{testResult.pass ? "check_circle" : "error"}</span>
                        {testResult.pass ? `All credentials present — ${testResult.latency}ms` : "Missing required credentials"}
                      </div>
                      {!testResult.pass && testResult.missing && testResult.missing.length > 0 && (
                        <ul className="mt-2 space-y-1 pl-6 list-disc text-xs text-red-600">
                          {testResult.missing.map((k) => {
                            const field = FB_CRED_FIELDS.find((f) => f.key === k);
                            return <li key={k} className="font-semibold">{field?.label ?? k}</li>;
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <div className="col-span-12 lg:col-span-5 space-y-4">
                  <div className="p-5 bg-[#f8f9ff] rounded-xl border border-slate-100 space-y-4">
                    <h4 className="font-serif font-semibold flex items-center gap-2"><span className="material-symbols-outlined text-[#006c49] text-base">webhook</span>Meta Webhook Callback URL</h4>
                    <p className="text-xs text-[#7c839b] font-[Manrope]">Provide this URL in your Meta App Dashboard &gt; Webhooks for Messenger and Facebook Page subscription events.</p>
                    <div className="flex items-center justify-between gap-2 p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800">
                      <span className="truncate">{typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/facebook</span>
                      <button
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/facebook`);
                            showToast("Webhook URL copied to clipboard!");
                          }
                        }}
                        className="px-2.5 py-1 bg-slate-900 text-white rounded font-[Manrope] text-[10px] font-bold uppercase tracking-wider shrink-0 hover:bg-slate-800"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="p-5 bg-[#f8f9ff] rounded-xl border border-slate-100 space-y-4">
                    <h4 className="font-serif font-semibold flex items-center gap-2"><span className="material-symbols-outlined text-[#006c49] text-base">help</span>Where to find your credentials</h4>
                    {[
                      { step: "1", title: "Find your Page ID", body: "Go to your Facebook Page → click About (left sidebar) → scroll to the bottom. The Page ID is a long number shown under 'More info'." },
                      { step: "2", title: "Create a Meta App", body: "Go to developers.facebook.com → My Apps → Create App. Choose Business type for commerce + ads access." },
                      { step: "3", title: "Get App ID & Secret", body: "App Dashboard → Settings → Basic. Copy the App ID (public) and App Secret (keep private)." },
                      { step: "4", title: "Generate Page Token", body: "Use Graph API Explorer → select your app and page → generate token → exchange for a long-lived token via the token debugger." },
                      { step: "5", title: "Find Pixel ID", body: "Meta Business Manager → Events Manager → Data Sources → your Pixel → copy the Pixel ID from the overview." },
                      { step: "6", title: "Ad Account ID", body: "Meta Business Manager → Ad Accounts → click your account. The ID appears as act_XXXXXXXXX in the URL." },
                    ].map((s) => (
                      <div key={s.step} className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#006c49] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{s.step}</span>
                        <div><p className="font-[Manrope] font-bold text-sm mb-0.5">{s.title}</p><p className="text-xs text-[#7c839b] font-[Manrope]">{s.body}</p></div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-xs font-[Manrope] text-amber-800 flex items-start gap-2">
                      <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">lock</span>
                      Credentials are stored in the database and never exposed in client-side code. Secret fields are masked during display.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════ CATALOG RULES ══════════════════════ */}
            {activeTab === "catalog" && catalog && (
              <div className="space-y-6">
                {/* Catalog ID banner */}
                <div className={`flex items-center gap-4 p-4 rounded-xl border ${fbCreds["catalog_id"] ? "bg-[#f0faf6] border-[#c3eed8]" : "bg-amber-50 border-amber-200"}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${fbCreds["catalog_id"] ? "bg-[#006c49]" : "bg-amber-400"}`}>
                    <span className="material-symbols-outlined text-white text-base">database</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#7c839b] mb-0.5">Facebook Commerce Catalog ID</p>
                    {fbCreds["catalog_id"] ? (
                      <div className="flex items-center gap-3">
                        <code className="font-mono text-sm font-bold text-[#006c49]">{fbCreds["catalog_id"]}</code>
                        {catalogInfo && (
                          <span className="text-xs px-2 py-0.5 bg-[#d4f8e8] text-[#00714d] rounded font-semibold font-[Manrope]">
                            {catalogInfo.name ?? "Live Catalog"} {catalogInfo.product_count !== undefined ? `(${catalogInfo.product_count} products)` : ""}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="font-[Manrope] text-sm text-amber-700 font-semibold">Not configured — enter your Catalog ID in the API Credentials tab to enable product sync.</p>
                    )}
                  </div>
                  <button onClick={() => setActiveTab("credentials")}
                    className={`shrink-0 px-4 py-2 rounded-lg font-[Manrope] font-bold text-xs tracking-widest uppercase transition-colors ${fbCreds["catalog_id"] ? "border border-[#006c49] text-[#006c49] hover:bg-[#006c49] hover:text-white" : "bg-amber-600 text-white hover:bg-amber-700"}`}>
                    {fbCreds["catalog_id"] ? "Edit" : "Set Catalog ID"}
                  </button>
                </div>

                {/* XML Catalog Feed & Reviews Feed Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Live RSS Catalog Feed */}
                  <div className="flex flex-col justify-between gap-3 p-4 rounded-xl border bg-slate-50 border-slate-200">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-base text-[#1877F2]">rss_feed</span>
                        <p className="font-[Manrope] font-bold text-[11px] tracking-widest uppercase text-slate-800">Meta Commerce XML Data Feed</p>
                      </div>
                      <p className="text-[11px] text-slate-500 font-[Manrope] mb-2">Automated scheduled feed for Facebook Shop &amp; Instagram Shopping.</p>
                      <code className="font-mono text-xs text-slate-700 bg-white p-2 rounded border border-slate-200 block truncate select-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/facebook/catalog/feed.xml</code>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            navigator.clipboard.writeText(`${window.location.origin}/api/facebook/catalog/feed.xml`);
                            showToast("Catalog XML Feed URL copied!");
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg font-[Manrope] font-bold text-xs tracking-wider uppercase bg-[#1877F2] text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-xs">content_copy</span> Copy XML Feed
                      </button>
                      <a
                        href="/api/facebook/catalog/feed.xml"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg font-[Manrope] font-bold text-xs tracking-wider uppercase border border-slate-300 text-slate-700 hover:bg-white transition-colors flex items-center gap-1.5 no-underline"
                      >
                        <span className="material-symbols-outlined text-xs">open_in_new</span> Test Feed
                      </a>
                    </div>
                  </div>

                  {/* Reviews Feed */}
                  <div className="flex flex-col justify-between gap-3 p-4 rounded-xl border bg-slate-50 border-slate-200">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-base text-amber-600">reviews</span>
                        <p className="font-[Manrope] font-bold text-[11px] tracking-widest uppercase text-slate-800">Ratings &amp; Reviews CSV Feed</p>
                      </div>
                      <p className="text-[11px] text-slate-500 font-[Manrope] mb-2">Feed for Meta Commerce product star ratings and buyer reviews.</p>
                      <code className="font-mono text-xs text-slate-700 bg-white p-2 rounded border border-slate-200 block truncate select-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/facebook/reviews-feed.csv</code>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            navigator.clipboard.writeText(`${window.location.origin}/api/facebook/reviews-feed.csv`);
                            showToast("Reviews Feed CSV URL copied!");
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg font-[Manrope] font-bold text-xs tracking-wider uppercase bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-xs">content_copy</span> Copy Reviews Feed
                      </button>
                      <a
                        href="/api/facebook/reviews-feed.csv"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg font-[Manrope] font-bold text-xs tracking-wider uppercase border border-slate-300 text-slate-700 hover:bg-white transition-colors flex items-center gap-1.5 no-underline"
                      >
                        <span className="material-symbols-outlined text-xs">open_in_new</span> Test CSV
                      </a>
                    </div>
                  </div>
                </div>

              <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12 lg:col-span-7 space-y-6">
                  <div>
                    <h3 className="font-serif text-[20px] font-semibold mb-1">Category Filter</h3>
                    <p className="text-sm text-[#7c839b] font-[Manrope] mb-4">Select which product categories sync to Facebook Commerce.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ALL_CATEGORIES.map((cat) => {
                        const on = catalog.includedCategories.includes(cat);
                        return (
                          <button key={cat} onClick={() => toggleCategory(cat)}
                            className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-[Manrope] font-semibold text-left transition-all ${on ? "bg-[#eff4ff] border-[#006c49] text-[#006c49]" : "bg-white border-slate-200 text-slate-400"}`}>
                            <span className="material-symbols-outlined text-sm">{on ? "check_box" : "check_box_outline_blank"}</span>{cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-serif text-[18px] font-semibold mb-1">Price Range Filter</h3>
                    <p className="text-sm text-[#7c839b] font-[Manrope] mb-3">Only sync products within this price range.</p>
                    <div className="flex items-center gap-4">
                      {[{ label: "Min Price", val: catalog.minPrice, setVal: (v: number) => updatePriceRange(v, catalog.maxPrice) },
                        { label: "Max Price", val: catalog.maxPrice, setVal: (v: number) => updatePriceRange(catalog.minPrice, v) }].map((f, i) => (
                        <div key={i} className="flex-1 space-y-1">
                          <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d]">{f.label}</label>
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                            <span className="text-slate-400 font-[Manrope]">$</span>
                            <input type="number" defaultValue={f.val} onBlur={(e) => f.setVal(Number(e.target.value))} className="bg-transparent outline-none font-[Manrope] text-sm w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="col-span-12 lg:col-span-5 space-y-4">
                  <div className="p-5 bg-[#f8f9ff] rounded-xl">
                    <h4 className="font-serif font-semibold mb-3">Sync Preview</h4>
                    <div className="space-y-2 text-sm font-[Manrope]">
                      <div className="flex justify-between"><span className="text-[#7c839b]">Categories included</span><span className="font-bold">{catalog.includedCategories.length}/{ALL_CATEGORIES.length}</span></div>
                      <div className="flex justify-between"><span className="text-[#7c839b]">Est. products to sync</span><span className="font-bold">{catalog.includedCategories.length * 178}</span></div>
                      <div className="flex justify-between"><span className="text-[#7c839b]">Price range</span><span className="font-bold">${catalog.minPrice} – ${catalog.maxPrice}</span></div>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl" style={{ background: "linear-gradient(135deg,#0b1c30,#006c49)" }}>
                    <p className="text-white font-serif text-[15px] font-semibold mb-1">Ready to push?</p>
                    <p className="text-white/60 text-xs font-[Manrope] mb-4">Sync {catalog.includedCategories.length} categories to Facebook Commerce.</p>
                    <button onClick={runSync} disabled={syncState === "syncing"}
                      className="w-full bg-white text-black py-2.5 font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#6cf8bb] disabled:opacity-60 transition-colors flex items-center justify-center gap-2 rounded-lg">
                      <span className={`material-symbols-outlined text-sm ${syncState === "syncing" ? "animate-spin" : ""}`}>refresh</span>
                      {syncState === "syncing" ? "Syncing…" : syncState === "done" ? "Synced ✓" : "Run Sync"}
                    </button>
                  </div>
                </div>
              </div>
              </div>
            )}

            {/* ══════════════════════ PIXEL EVENTS ══════════════════════ */}
            {activeTab === "pixel" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-serif text-[20px] font-semibold mb-1">Pixel Event Mapping</h3>
                    <p className="text-sm text-[#7c839b] font-[Manrope]">Map store events to Facebook Pixel standard events for precise ad attribution.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-[Manrope] font-bold text-[#7c839b] uppercase tracking-widest block">Pixel ID</span>
                    {fbCreds.pixel_id
                      ? <code className="text-sm font-mono text-[#006c49]">{fbCreds.pixel_id}</code>
                      : <button onClick={() => setActiveTab("credentials")} className="text-xs font-[Manrope] font-bold text-amber-600 hover:text-black transition-colors flex items-center gap-1 ml-auto"><span className="material-symbols-outlined text-xs">warning</span>Not set</button>
                    }
                  </div>
                </div>
                <div className="space-y-2">
                  {pixelEvents.map((ev) => (
                    <div key={ev.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${ev.enabled ? "bg-[#f8f9ff] border-slate-100" : "bg-white border-dashed border-slate-200 opacity-60"}`}>
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div><p className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#7c839b] mb-0.5">Store Event</p><p className="font-[Manrope] font-semibold text-sm">{ev.storeEvent}</p></div>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-300 text-sm">arrow_forward</span>
                          <div><p className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#7c839b] mb-0.5">Facebook Event</p><code className="font-mono text-sm text-[#006c49]">{ev.fbEvent}</code></div>
                        </div>
                      </div>
                      <button onClick={() => togglePixelEvent(ev)} className={`relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ${ev.enabled ? "bg-[#006c49]" : "bg-slate-300"}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${ev.enabled ? "translate-x-5" : "translate-x-0.5"}`}></span>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <p className="text-sm font-[Manrope] text-amber-800 flex items-center gap-2"><span className="material-symbols-outlined text-sm">info</span>Changes saved to database. Verify events in Facebook Events Manager before going live.</p>
                </div>
              </div>
            )}

            {/* ══════════════════════ AUDIENCES ══════════════════════ */}
            {activeTab === "audiences" && (
              <div>
                <div className="mb-6"><h3 className="font-serif text-[20px] font-semibold mb-1">Custom Audiences</h3><p className="text-sm text-[#7c839b] font-[Manrope]">Sync customer segments to Facebook for precision ad targeting.</p></div>
                <div className="flex gap-3 mb-6 p-4 bg-[#f8f9ff] rounded-xl">
                  <input value={newAudName} onChange={(e) => setNewAudName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createAudience()} placeholder="Audience name…" className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm font-[Manrope] outline-none focus:border-[#006c49]" />
                  <select value={newAudType} onChange={(e) => setNewAudType(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-[Manrope] outline-none focus:border-[#006c49]">
                    {["Custom","Lookalike","Retargeting"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <button onClick={createAudience} className="px-5 py-2 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors rounded-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">add</span> Create
                  </button>
                </div>
                <div className="space-y-3">
                  {audiences.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#eff4ff] rounded-lg flex items-center justify-center"><span className="material-symbols-outlined text-[#006c49] text-base">group</span></div>
                        <div>
                          <p className="font-[Manrope] font-bold text-sm">{a.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-[Manrope] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${audienceTypeStyle[a.type] ?? "bg-slate-100 text-slate-600"}`}>{a.type}</span>
                            <span className="text-xs text-[#7c839b] font-[Manrope]">{a.size} users</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-[Manrope] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${audienceStatusStyle[a.status] ?? "bg-slate-100 text-slate-500"}`}>{a.status}</span>
                        <button onClick={() => toggleAudience(a)} className="text-xs font-[Manrope] text-[#7c839b] hover:text-[#006c49] border border-slate-200 px-3 py-1 rounded transition-colors">{a.status === "Active" ? "Pause" : "Resume"}</button>
                        <button onClick={() => deleteAudience(a)} className="text-[#7c839b] hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-base">delete</span></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════════════ AD PERFORMANCE ══════════════════════ */}
            {activeTab === "ads" && (
              <div>
                {!fbCreds.ad_account_id ? (
                  /* ── Empty state: no Ad Account ID saved ── */
                  <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#f8f9ff] flex items-center justify-center">
                      <span className="material-symbols-outlined text-3xl text-[#c6c6cd]">bar_chart</span>
                    </div>
                    <div>
                      <h3 className="font-serif text-[20px] font-semibold mb-2">No Ad Account connected</h3>
                      <p className="text-sm font-[Manrope] text-[#7c839b] max-w-sm leading-relaxed">
                        Add your <strong>Ad Account ID</strong> in the API Credentials tab to unlock ad performance data. Format: <code className="bg-slate-100 px-1 rounded text-xs">act_XXXXXXXXX</code>
                      </p>
                    </div>
                    <button onClick={() => setActiveTab("credentials")}
                      className="px-6 py-2.5 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-all rounded-lg flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">key</span>
                      Go to API Credentials
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-serif text-[20px] font-semibold">Ad Performance Overview</h3>
                        <p className="text-[11px] font-[Manrope] text-[#7c839b] font-bold flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-xs">info</span>
                          Live data only
                        </p>
                      </div>
                      <span className="text-[10px] font-[Manrope] text-[#7c839b]">Account: <code className="text-black font-mono">{fbCreds.ad_account_id}</code></span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                      {[
                        { label: "Impressions", value: fmt(totalReach), note: "live posts" },
                        { label: "Engagement", value: fmt(totalLikes + totalReach), note: "live totals" },
                        { label: "Comments", value: fmt(publishedPosts.reduce((s, p) => s + p.comments, 0)), note: "live posts" },
                        { label: "Shares", value: fmt(publishedPosts.reduce((s, p) => s + p.shares, 0)), note: "live posts" },
                      ].map((m) => (
                        <div key={m.label} className="p-5 bg-[#f8f9ff] rounded-xl">
                          <p className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#7c839b] mb-2">{m.label}</p>
                          <p className="text-[28px] font-serif font-semibold">{m.value}</p>
                          <p className="text-xs font-[Manrope] font-bold mt-1 text-[#7c839b]">{m.note}</p>
                        </div>
                      ))}
                    </div>

                    {/* Meta Ad Campaigns Section */}
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-serif text-[18px] font-semibold text-slate-900">Campaigns Manager</h4>
                          <p className="text-xs text-slate-500 font-[Manrope]">Monitor, launch, and paused ad campaigns on Meta Ads Network.</p>
                        </div>
                        <button
                          onClick={() => setShowCreateCampaign(!showCreateCampaign)}
                          className="px-4 py-2 bg-[#006c49] text-white hover:bg-emerald-800 transition-colors rounded-lg font-[Manrope] font-bold text-xs flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-sm">{showCreateCampaign ? "close" : "add"}</span>
                          {showCreateCampaign ? "Cancel" : "Create Campaign"}
                        </button>
                      </div>

                      {showCreateCampaign && (
                        <form onSubmit={handleCreateCampaign} className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4">
                          <p className="text-xs font-bold font-[Manrope] text-slate-700 uppercase tracking-wider">New Meta Campaign Setup</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-[Manrope]">Campaign Name</label>
                              <input
                                type="text"
                                required
                                value={newCampaignName}
                                onChange={(e) => setNewCampaignName(e.target.value)}
                                placeholder="e.g. Autumn Luxury Collection Launch"
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-[Manrope]">Objective</label>
                              <select
                                value={newCampaignObjective}
                                onChange={(e) => setNewCampaignObjective(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                              >
                                <option value="OUTCOMES_SALES">Sales & Conversions (Recommended)</option>
                                <option value="OUTCOMES_TRAFFIC">Traffic Boost</option>
                                <option value="OUTCOMES_ENGAGEMENT">Engagement / Page Likes</option>
                                <option value="OUTCOMES_LEADS">Leads Generation</option>
                                <option value="OUTCOMES_AWARENESS">Awareness & Reach</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-[Manrope]">Daily Budget (EUR)</label>
                              <input
                                type="number"
                                min={1}
                                max={1000}
                                value={newCampaignBudget}
                                onChange={(e) => setNewCampaignBudget(Number(e.target.value))}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-[Manrope]">Initial Status</label>
                              <select
                                value={newCampaignStatus}
                                onChange={(e) => setNewCampaignStatus(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                              >
                                <option value="PAUSED">Paused (Draft Mode)</option>
                                <option value="ACTIVE">Active (Live Immediately)</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex gap-3 pt-2">
                            <button
                              type="submit"
                              disabled={campaignSubmitting}
                              className="px-5 py-2.5 bg-black text-white hover:bg-[#006c49] font-[Manrope] font-bold text-xs uppercase tracking-widest rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {campaignSubmitting ? "Creating..." : "Submit Campaign"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowCreateCampaign(false)}
                              className="px-5 py-2.5 border border-slate-200 rounded-lg font-[Manrope] text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Campaigns list display */}
                      {campaignsLoading ? (
                        <p className="text-xs text-slate-400 animate-pulse font-[Manrope]">Loading campaigns from Meta Graph API...</p>
                      ) : campaignsErr ? (
                        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs font-[Manrope]">
                          {campaignsErr}. Make sure your App Secret & Page Token are valid. Showing Sandbox Mode fallbacks:
                          <div className="space-y-3 mt-3">
                            {[
                              { id: "camp_112233", name: "Luxe Fall Runway Showcase", status: "ACTIVE", objective: "OUTCOMES_SALES", daily_budget: 25.00 },
                              { id: "camp_445566", name: "Premium Accessories Brand Push", status: "PAUSED", objective: "OUTCOMES_AWARENESS", daily_budget: 10.00 },
                              { id: "camp_778899", name: "Retargeting Cart Abandoners", status: "ACTIVE", objective: "OUTCOMES_SALES", daily_budget: 15.50 }
                            ].map((c) => (
                              <div key={c.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg text-slate-800">
                                <div>
                                  <p className="font-bold">{c.name}</p>
                                  <p className="text-[10px] text-slate-500 font-mono">ID: {c.id} | {c.objective}</p>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                  <div>
                                    <p className="font-semibold">{c.daily_budget} EUR/day</p>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    c.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                                  }`}>{c.status}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : campaigns.length === 0 ? (
                        <p className="text-xs text-slate-400 font-[Manrope]">No campaigns found on this Meta Ads account.</p>
                      ) : (
                        <div className="space-y-3">
                          {campaigns.map((c) => (
                            <div key={c.id} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-xl shadow-xs">
                              <div>
                                <p className="font-[Manrope] font-bold text-sm text-slate-900">{c.name}</p>
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {c.id} | Objective: {c.objective}</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-xs font-bold text-slate-800 font-[Manrope]">
                                    {c.daily_budget ? `${(Number(c.daily_budget) / 100).toFixed(2)} EUR/day` : "No limit"}
                                  </p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  c.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-[#7c839b]"
                                }`}>{c.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
