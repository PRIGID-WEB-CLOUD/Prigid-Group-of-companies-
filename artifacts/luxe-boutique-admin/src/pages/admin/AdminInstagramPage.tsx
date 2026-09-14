import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { SiInstagram, SiMeta } from "react-icons/si";
import {
  MdKey,
  MdAccountCircle,
  MdPhotoLibrary,
  MdCloudUpload,
  MdRefresh,
  MdArrowBack,
  MdPhotoCamera,
  MdInfo,
  MdLink,
  MdCheckCircle,
  MdErrorOutline,
  MdClose,
  MdPlayCircle,
  MdHistoryToggleOff,
  MdOutlineLayers,
} from "react-icons/md";
import AdminLayout from "./AdminLayout";
import { ProductTagPicker, TaggedProduct } from "../../components/ProductTagPicker";

type Tab = "credentials" | "account" | "media" | "publish";
type IgPublishType = "FEED" | "REELS" | "STORIES";

interface IgAccount {
  instagram_business_account?: {
    id: string; name: string; username: string;
    profile_picture_url: string; followers_count: number; media_count: number;
  };
}

interface IgMedia {
  id: string; caption?: string; media_type: string; media_product_type?: string; media_url?: string;
  thumbnail_url?: string; timestamp: string; like_count: number;
  comments_count: number; permalink: string;
}

const CHANNEL = "instagram";

function CredField({ label, hint, value, onChange, type = "text" }: {
  label: string; hint: string; value: string;
  onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={hint}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006c49]/20 focus:border-[#006c49] font-mono"
      />
    </div>
  );
}

export default function AdminInstagramPage() {
  const [tab, setTab] = useState<Tab>("credentials");
  const [creds, setCreds] = useState({ ig_user_id: "", page_access_token: "", source: "" });
  const [metaStatus, setMetaStatus] = useState<{ connected: boolean; business?: { id: string; name: string } } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [account, setAccount] = useState<IgAccount | null>(null);
  const [accountErr, setAccountErr] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [media, setMedia] = useState<IgMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaErr, setMediaErr] = useState("");
  const [publishType, setPublishType] = useState<IgPublishType>("FEED");
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [shareToFeed, setShareToFeed] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState("");
  const [imageSpecs, setImageSpecs] = useState<{ width?: number; height?: number; ratio?: number; format?: string; isVideo?: boolean } | null>(null);
  const [userTags, setUserTags] = useState<{ username: string; x?: number; y?: number }[]>([]);
  const [taggedProducts, setTaggedProducts] = useState<TaggedProduct[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/channels/credentials/instagram", { credentials: "include" })
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        setCreds({
          ig_user_id: data.ig_user_id ?? "",
          page_access_token: data.page_access_token ?? "",
          source: data.source ?? "",
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
    setSaving(true); setSaveMsg("");
    try {
      await fetch(`/api/channels/credentials/${CHANNEL}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(creds),
      });
      setSaveMsg("Credentials saved.");
    } catch { setSaveMsg("Save failed."); }
    setSaving(false);
  }

  async function fetchAccount() {
    setAccountLoading(true); setAccountErr("");
    try {
      const r = await fetch("/api/facebook/instagram/account", { credentials: "include" });
      const text = await r.text();
      let d: any = {};
      try { d = JSON.parse(text); } catch { throw new Error(`Server error (${r.status})`); }
      if (!r.ok) { setAccountErr(d.error ?? "Failed to load Instagram account"); }
      else setAccount(d);
    } catch (err: any) { setAccountErr(err?.message || "Network error loading Instagram account"); }
    setAccountLoading(false);
  }

  async function fetchMedia() {
    setMediaLoading(true); setMediaErr("");
    try {
      const r = await fetch("/api/facebook/instagram/media", { credentials: "include" });
      const text = await r.text();
      let d: any = {};
      try { d = JSON.parse(text); } catch { throw new Error(`Server error (${r.status})`); }
      if (!r.ok) { setMediaErr(d.error ?? "Failed to load Instagram media"); setMedia([]); }
      else setMedia(d.data ?? []);
    } catch (err: any) { setMediaErr(err?.message || "Network error loading Instagram media"); }
    setMediaLoading(false);
  }

  function handleFileSelect(file: File) {
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isVideo && !isImage) {
      setPublishMsg("Please select an image or video file.");
      return;
    }

    if (publishType === "REELS" && !isVideo) {
      setPublishMsg("Instagram Reels require a video file (MP4, MOV, WEBM).");
      return;
    }

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    const blobUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(blobUrl);
    setPublishMsg("");

    if (isImage) {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const ratio = h > 0 ? w / h : 1;
        setImageSpecs({
          width: w,
          height: h,
          ratio,
          format: file.type.replace("image/", "").toUpperCase(),
          isVideo: false,
        });
      };
      img.src = blobUrl;
    } else {
      setImageSpecs({
        format: file.type.replace("video/", "").toUpperCase(),
        isVideo: true,
      });
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleClearFile() {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl("");
    setImageSpecs(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function publishPost() {
    if (uploadMode === "file" && !selectedFile) {
      setPublishMsg(`Please select or drop a local ${publishType === "REELS" ? "video" : "media"} file to publish.`);
      return;
    }
    if (uploadMode === "url" && !imageUrl.trim()) {
      setPublishMsg("Media URL is required.");
      return;
    }

    setPublishing(true);
    setPublishMsg("");

    try {
      let res: Response;
      if (uploadMode === "file" && selectedFile) {
        const formData = new FormData();
        formData.append("media", selectedFile);
        formData.append("mediaType", publishType);
        formData.append("caption", caption.trim());
        if (publishType === "REELS") {
          formData.append("shareToFeed", String(shareToFeed));
        }
        if (userTags.length > 0 && publishType === "FEED") {
          formData.append("userTags", JSON.stringify(userTags));
        }
        if (taggedProducts.length > 0) {
          formData.append("productTags", JSON.stringify(taggedProducts));
        }
        res = await fetch("/api/facebook/instagram/publish", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
      } else {
        res = await fetch("/api/facebook/instagram/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            mediaUrl: imageUrl.trim(),
            mediaType: publishType,
            caption: caption.trim(),
            shareToFeed: publishType === "REELS" ? shareToFeed : undefined,
            userTags: userTags.length > 0 && publishType === "FEED" ? userTags : undefined,
            productTags: taggedProducts.length > 0 ? taggedProducts : undefined,
          }),
        });
      }

      const d = await res.json();
      if (!res.ok) {
        setPublishMsg(d.error ?? "Publish failed");
      } else {
        const typeLabel = publishType === "REELS" ? "Instagram Reel" : (publishType === "STORIES" ? "Instagram Story" : "Instagram Feed Post");
        const formatNotice = d.originalFormat && !["jpeg", "jpg"].includes(String(d.originalFormat).toLowerCase())
          ? ` • Converted ${String(d.originalFormat).toUpperCase()} to Instagram JPEG`
          : "";
        const padNotice = d.adjustedAspectRatio ? " • Aspect ratio auto-fitted to Instagram standard" : "";
        const tagNotice = userTags.length > 0 && publishType === "FEED" ? ` • Tagged ${userTags.length} account${userTags.length > 1 ? "s" : ""}` : "";
        const prodTagNotice = taggedProducts.length > 0 ? ` • Tagged ${taggedProducts.length} product${taggedProducts.length > 1 ? "s" : ""} (Shoppable)` : "";
        setPublishMsg(`${typeLabel} published successfully! Instagram Media ID: ${d.mediaId}${formatNotice}${padNotice}${tagNotice}${prodTagNotice}`);
        setCaption("");
        setImageUrl("");
        setUserTags([]);
        setTaggedProducts([]);
        handleClearFile();
        fetchMedia();
      }
    } catch {
      setPublishMsg("Network error publishing to Instagram.");
    } finally {
      setPublishing(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "credentials", label: "Credentials", icon: <MdKey /> },
    { id: "account",     label: "Account",     icon: <MdAccountCircle /> },
    { id: "media",       label: "Media Feed",  icon: <MdPhotoLibrary /> },
    { id: "publish",     label: "Publish",     icon: <MdCloudUpload /> },
  ];

  const ig = account?.instagram_business_account;

  return (
    <AdminLayout sidebar="channels">
      <div className="p-4 sm:p-10 max-w-5xl mx-auto min-h-screen">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Link href="/channels" className="text-slate-400 hover:text-slate-600 transition-colors">
              <MdArrowBack className="text-xl" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888] flex items-center justify-center text-white shrink-0 shadow-lg">
              <SiInstagram className="text-xl" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900" style={{ fontFamily: "Noto Serif, serif" }}>Instagram Business</h1>
              <p className="text-xs text-slate-500">Publish posts, view media feed, and manage account</p>
            </div>
          </div>
          <Link href="/chat" className="no-underline self-start sm:self-auto">
            <button className="flex items-center gap-1.5 text-xs font-[Manrope] font-bold text-white bg-[#006c49] hover:bg-[#005a3c] px-4 py-2.5 rounded-lg transition-all shadow-sm">
              <span className="material-symbols-outlined text-sm">chat</span>
              <span>Open CRM Inbox</span>
            </button>
          </Link>
        </div>

        <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); if (t.id === "account") fetchAccount(); if (t.id === "media") fetchMedia(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <div className="text-base">{t.icon}</div>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "credentials" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <MdKey className="text-2xl text-slate-400" />
                <div>
                  <p className="text-sm font-[Manrope] font-bold text-black">Managed via Platform Environment Variables</p>
                  <p className="text-xs font-[Manrope] text-slate-500 mt-1">Manual entry of Instagram credentials is disabled in this environment.</p>
                </div>
              </div>
              <ul className="space-y-2 text-xs font-[Manrope] text-slate-600 list-disc list-inside">
                <li><span className="font-bold text-slate-800">Instagram Business Account ID</span></li>
                <li><span className="font-bold text-slate-800">Page Access Token</span></li>
              </ul>
            </div>
          </div>
        )}

        {tab === "account" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-900">Account Overview</h2>
              <button onClick={fetchAccount} disabled={accountLoading} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                <MdRefresh className={`text-base ${accountLoading ? "animate-spin" : ""}`} />
                {accountLoading ? "Loading…" : "Refresh"}
              </button>
            </div>
            {accountErr && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 mb-4">{accountErr}</div>
            )}
            {!ig && !accountErr && !accountLoading && (
              <div className="text-center py-12 text-slate-400">
                <MdPhotoCamera className="text-4xl mb-3 mx-auto block" />
                <p className="text-sm">Click Refresh to load your Instagram account</p>
              </div>
            )}
            {ig && (
              <div className="flex items-start gap-5">
                <img src={ig.profile_picture_url} alt={ig.username} className="w-20 h-20 rounded-full object-cover border-2 border-slate-200" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <div className="flex-1">
                  <p className="text-lg font-semibold text-slate-900">@{ig.username}</p>
                  <p className="text-sm text-slate-500 mb-4">{ig.name}</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-slate-50 rounded-xl">
                      <p className="text-xl font-bold text-slate-900">{ig.followers_count?.toLocaleString() ?? "—"}</p>
                      <p className="text-xs text-slate-500">Followers</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-xl">
                      <p className="text-xl font-bold text-slate-900">{ig.media_count?.toLocaleString() ?? "—"}</p>
                      <p className="text-xs text-slate-500">Posts</p>
                    </div>
                    <div className="text-center p-3 bg-[#006c49]/5 rounded-xl">
                      <p className="text-xl font-bold text-[#006c49]">Active</p>
                      <p className="text-xs text-slate-500">Status</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "media" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-900">Media Feed</h2>
              <button onClick={fetchMedia} disabled={mediaLoading} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                <MdRefresh className={`text-base ${mediaLoading ? "animate-spin" : ""}`} />
                {mediaLoading ? "Loading…" : "Refresh"}
              </button>
            </div>
            {mediaErr && <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 mb-4">{mediaErr}</div>}
            {!media.length && !mediaErr && (
              <div className="text-center py-12 text-slate-400">
                <MdPhotoLibrary className="text-4xl mb-3 mx-auto block" />
                <p className="text-sm">Click Refresh to load your Instagram media</p>
              </div>
            )}
            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {media.map((m) => (
                  <a key={m.id} href={m.permalink} target="_blank" rel="noreferrer" className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 block">
                    {(m.media_url || m.thumbnail_url) && (
                      <img src={m.media_url ?? m.thumbnail_url} alt={m.caption ?? ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                      <div className="p-2 w-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex gap-3 text-white text-xs font-semibold">
                          <span>♥ {m.like_count}</span>
                          <span>💬 {m.comments_count}</span>
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "publish" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 max-w-2xl shadow-xs">
            {/* Publish Type Selector */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-700 mb-2">Publish Target Type</label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setPublishType("FEED");
                    handleClearFile();
                  }}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-semibold cursor-pointer ${
                    publishType === "FEED"
                      ? "border-[#bc1888] bg-pink-50/50 text-[#bc1888] shadow-xs"
                      : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                  }`}
                >
                  <MdOutlineLayers className="text-xl" />
                  <span>Feed Post</span>
                  <span className="text-[10px] text-slate-400 font-normal">Photos & Videos</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPublishType("REELS");
                    handleClearFile();
                  }}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-semibold cursor-pointer ${
                    publishType === "REELS"
                      ? "border-[#bc1888] bg-pink-50/50 text-[#bc1888] shadow-xs"
                      : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                  }`}
                >
                  <MdPlayCircle className="text-xl" />
                  <span>Instagram Reel</span>
                  <span className="text-[10px] text-slate-400 font-normal">Vertical Video (9:16)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPublishType("STORIES");
                    handleClearFile();
                  }}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-semibold cursor-pointer ${
                    publishType === "STORIES"
                      ? "border-[#bc1888] bg-pink-50/50 text-[#bc1888] shadow-xs"
                      : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                  }`}
                >
                  <MdHistoryToggleOff className="text-xl" />
                  <span>Instagram Story</span>
                  <span className="text-[10px] text-slate-400 font-normal">24h Ephemeral (9:16)</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <SiInstagram className="text-[#bc1888] text-lg" />
                  {publishType === "REELS"
                    ? "Publish Instagram Reel"
                    : publishType === "STORIES"
                    ? "Publish Instagram Story"
                    : "Publish to Instagram Feed"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {publishType === "REELS"
                    ? "Upload high quality MP4/MOV videos up to 15 minutes as Instagram Reels"
                    : publishType === "STORIES"
                    ? "Publish 24-hour photo or video stories directly to your profile"
                    : "Share photos or videos directly to your connected Instagram Business grid"}
                </p>
              </div>
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setUploadMode("file")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    uploadMode === "file" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <MdCloudUpload className="text-sm" />
                  Local File
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode("url")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    uploadMode === "url" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <MdLink className="text-sm" />
                  Media URL
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {uploadMode === "file" ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Local Media File <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {publishType === "REELS" ? "MP4, MOV, WEBM (Video)" : "Photos (JPEG, PNG, WEBP) & MP4 Videos"}
                    </span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={publishType === "REELS" ? "video/mp4,video/quicktime,video/webm" : "image/jpeg,image/png,image/webp,image/jpg,image/gif,image/heic,image/avif,video/mp4,video/quicktime"}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />

                  {!selectedFile ? (
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                        isDragging
                          ? "border-[#bc1888] bg-pink-50/40"
                          : "border-slate-200 hover:border-[#bc1888]/50 bg-slate-50/60 hover:bg-slate-50"
                      }`}
                    >
                      <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-[#f09433]/15 via-[#e6683c]/15 to-[#bc1888]/15 text-[#bc1888] flex items-center justify-center text-2xl shadow-xs">
                        {publishType === "REELS" ? <MdPlayCircle /> : <MdPhotoCamera />}
                      </div>
                      <p className="text-sm font-semibold text-slate-800 mb-1">
                        Click to choose {publishType === "REELS" ? "video" : "photo or video"} or drag & drop here
                      </p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        {publishType === "REELS"
                          ? "Reels require video in MP4/MOV format. Vertical 9:16 aspect ratio recommended."
                          : "Accepts photos (PNG, WebP, HEIC, JPG) and videos (MP4). Auto-converts to Instagram standard."}
                      </p>
                      <div className="mt-4">
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 shadow-2xs hover:bg-slate-100">
                          <MdCloudUpload className="text-sm" />
                          Browse Files
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/80">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-black/5 shrink-0 border border-slate-200 relative aspect-square shadow-2xs flex items-center justify-center">
                          {imageSpecs?.isVideo ? (
                            <video
                              src={previewUrl}
                              className="w-full h-full object-cover"
                              controls={false}
                              muted
                              playsInline
                            />
                          ) : (
                            <img
                              src={previewUrl}
                              alt="Selected preview"
                              className="w-full h-full object-contain bg-slate-900/5"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                              {imageSpecs?.isVideo ? "Selected Video" : "Selected Image"}
                            </span>
                            {imageSpecs?.ratio !== undefined && !imageSpecs?.isVideo && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  imageSpecs.ratio >= 0.8 && imageSpecs.ratio <= 1.91
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {imageSpecs.ratio >= 0.8 && imageSpecs.ratio <= 1.91
                                  ? `Ratio ${imageSpecs.ratio.toFixed(2)}:1 (Compliant)`
                                  : `Ratio ${imageSpecs.ratio.toFixed(2)}:1 (Auto-fitting)`}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800">
                              {publishType === "REELS" ? "Instagram Reel Video" : (publishType === "STORIES" ? "Instagram Story" : "Auto Instagram JPEG")}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-slate-900 truncate mt-1">
                            {selectedFile.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                            {imageSpecs?.width && imageSpecs?.height ? ` • ${imageSpecs.width} × ${imageSpecs.height} px` : ""}
                            {` • ${selectedFile.type.toUpperCase() || "MEDIA"}`}
                          </p>
                          <div className="flex items-center gap-2 mt-3">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                            >
                              Change File
                            </button>
                            <button
                              type="button"
                              onClick={handleClearFile}
                              className="px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <MdClose className="text-sm" />
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Public Media URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      setPreviewUrl(e.target.value);
                    }}
                    placeholder={publishType === "REELS" ? "https://your-cdn.com/video.mp4" : "https://your-cdn.com/image.jpg"}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006c49]/20 focus:border-[#006c49] font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Must be a publicly accessible HTTPS URL.
                  </p>

                  {imageUrl && (
                    <div className="mt-3 rounded-xl overflow-hidden bg-slate-100 aspect-square max-w-xs border border-slate-200 shadow-2xs">
                      {imageUrl.match(/\.(mp4|mov|webm)(\?.*)?$/i) ? (
                        <video src={imageUrl} className="w-full h-full object-cover" controls />
                      ) : (
                        <img
                          src={imageUrl}
                          alt="preview"
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {publishType !== "STORIES" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Caption</label>
                    <span className="text-[11px] text-slate-400">{caption.length} / 2200</span>
                  </div>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={4}
                    maxLength={2200}
                    placeholder="Write your post caption… (Include @mentions and hashtags like #luxury #boutique #fashion)"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#bc1888]/20 focus:border-[#bc1888] resize-none"
                  />
                </div>
              )}

              {publishType === "REELS" && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-slate-800">Share Reel to Main Feed</label>
                    <p className="text-[11px] text-slate-500">Also show this Reel on your main Instagram profile grid</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={shareToFeed}
                    onChange={(e) => setShareToFeed(e.target.checked)}
                    className="w-4 h-4 text-[#bc1888] rounded border-slate-300 focus:ring-[#bc1888]"
                  />
                </div>
              )}

              {/* Tag Users & Accounts on Photo (user_tags for FEED only) */}
              {publishType === "FEED" && (
                <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-[#bc1888]">person_add</span>
                        Tag Accounts on Photo (<code className="text-[11px] font-mono text-slate-600">user_tags</code>)
                      </label>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tag other Instagram handles directly on this photo so viewers can tap and open their profile.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">@</span>
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const clean = newTagInput.replace(/^@/, "").trim().toLowerCase();
                            if (clean && !userTags.some((t) => t.username === clean)) {
                              setUserTags((prev) => [...prev, { username: clean, x: 0.5, y: 0.5 }]);
                              setNewTagInput("");
                            }
                          }
                        }}
                        placeholder="instagram_handle (e.g. vogue, gucci, luxury_vip)"
                        className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-[#bc1888]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const clean = newTagInput.replace(/^@/, "").trim().toLowerCase();
                        if (clean && !userTags.some((t) => t.username === clean)) {
                          setUserTags((prev) => [...prev, { username: clean, x: 0.5, y: 0.5 }]);
                          setNewTagInput("");
                        }
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
                    >
                      Add Tag
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const clean = newTagInput.replace(/^@/, "").trim();
                        if (clean) {
                          setCaption((prev) => (prev ? `${prev} @${clean}` : `@${clean}`));
                          setNewTagInput("");
                        }
                      }}
                      title="Insert @handle into post caption"
                      className="px-3 py-1.5 bg-pink-50 border border-pink-200 text-[#bc1888] hover:bg-pink-100 rounded-lg text-xs font-semibold"
                    >
                      + Caption Mention
                    </button>
                  </div>

                  {userTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {userTags.map((t) => (
                        <span
                          key={t.username}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-pink-200 rounded-lg text-xs text-[#bc1888] font-medium shadow-2xs"
                        >
                          <span>@{t.username}</span>
                          <button
                            type="button"
                            onClick={() => setUserTags((prev) => prev.filter((x) => x.username !== t.username))}
                            className="text-slate-400 hover:text-red-600 ml-1 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Product Tagging (Shoppable Instagram Posts, Reels & Stories) */}
              <ProductTagPicker
                platform="instagram"
                targetType={publishType}
                taggedProducts={taggedProducts}
                onChange={setTaggedProducts}
                onAppendToCaption={(txt) => setCaption((prev) => `${prev}${txt}`)}
                previewImageUrl={previewUrl || imageUrl}
                maxTags={publishType === "REELS" ? 30 : 20}
              />

              <button
                type="button"
                onClick={publishPost}
                disabled={publishing || (uploadMode === "file" ? !selectedFile : !imageUrl.trim())}
                className="w-full py-3 bg-gradient-to-r from-[#f09433] via-[#e6683c] to-[#bc1888] text-white text-sm font-semibold rounded-xl hover:opacity-95 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-sm"
              >
                {publishing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>
                      {publishType === "REELS"
                        ? "Publishing Instagram Reel…"
                        : publishType === "STORIES"
                        ? "Publishing Instagram Story…"
                        : "Publishing to Instagram Feed…"}
                    </span>
                  </>
                ) : (
                  <>
                    <SiInstagram className="text-base" />
                    <span>
                      {publishType === "REELS"
                        ? "Publish Reel to Instagram"
                        : publishType === "STORIES"
                        ? "Publish Story to Instagram"
                        : "Publish Post to Instagram"}
                    </span>
                  </>
                )}
              </button>

              {publishMsg && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
                    publishMsg.startsWith("Published") || publishMsg.includes("published successfully")
                      ? "bg-emerald-50 text-[#006c49] border border-emerald-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {publishMsg.startsWith("Published") || publishMsg.includes("published successfully") ? (
                    <MdCheckCircle className="text-base shrink-0" />
                  ) : (
                    <MdErrorOutline className="text-base shrink-0" />
                  )}
                  <span>{publishMsg}</span>
                </div>
              )}

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 flex items-start gap-2.5 text-xs text-slate-500">
                <MdInfo className="text-base text-slate-400 shrink-0 mt-0.5" />
                <p>
                  Local files are uploaded to the media storage server and delivered as public HTTPS URLs directly to Meta's Instagram Graph API container engine. Meta polls and completes video/photo container initialization before final publication.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
