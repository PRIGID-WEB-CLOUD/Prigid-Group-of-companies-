import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { SiX } from "react-icons/si";
import {
  MdEditNote,
  MdKey,
  MdQueue,
  MdRule,
  MdDescription,
  MdArrowBack,
  MdRefresh,
  MdCheckCircle,
  MdSave,
  MdWifiTethering,
  MdVisibility,
  MdVisibilityOff,
  MdContentCopy,
  MdSend,
  MdHelp,
  MdAdd,
  MdInventory2,
  MdError
} from "react-icons/md";
import AdminLayout from "./AdminLayout";
import { ProductTagPicker, TaggedProduct } from "../../components/ProductTagPicker";

const MAX_CHARS = 280;
type ActiveTab = "composer" | "credentials" | "rules" | "queue" | "templates";

interface Hashtag         { id: string; tag: string; }
interface AutoRule        { id: string; trigger: string; action: string; template: string; active: boolean; }
interface QueuedTweet     { id: string; text: string; scheduledFor: string; status: string; imageStyle: string; }
interface ContentTemplate { id: string; name: string; body: string; usageCount: number; }
interface Scheduler       { id: string; schedulerOn: boolean; dropFrequency: string; imageStyle: string; }

export default function AdminTwitterPage() {
  const [activeTab, setActiveTab]             = useState<ActiveTab>("composer");
  const [hashtags, setHashtags]               = useState<Hashtag[]>([]);
  const [rules, setRules]                     = useState<AutoRule[]>([]);
  const [queue, setQueue]                     = useState<QueuedTweet[]>([]);
  const [templates, setTemplates]             = useState<ContentTemplate[]>([]);
  const [scheduler, setScheduler]             = useState<Scheduler | null>(null);
  const [loading, setLoading]                 = useState(true);

  const [tweetText, setTweetText]             = useState("");
  const [taggedProducts, setTaggedProducts]   = useState<TaggedProduct[]>([]);
  const [newTag, setNewTag]                   = useState("");
  const [scheduling, setScheduling]           = useState(false);
  const [publishing, setPublishing]           = useState(false);
  const [publishResult, setPublishResult]     = useState<{ok: boolean; msg: string} | null>(null);
  const [toast, setToast]                     = useState<string | null>(null);
  const [twitterUser, setTwitterUser]         = useState<{name?: string; username?: string; profile_image_url?: string; public_metrics?: Record<string, number>} | null>(null);
  const [twitterUserErr, setTwitterUserErr]   = useState("");
  const [twitterUserLoading, setTwitterUserLoading] = useState(false);

  const [showNewRule, setShowNewRule]         = useState(false);
  const [newRuleTrigger, setNewRuleTrigger]   = useState("New Product Published");
  const [newRuleAction, setNewRuleAction]     = useState("Post immediately");

  // Credentials
  const [twCreds,     setTwCreds]     = useState<Record<string, string>>({});
  const [credsDirty,  setCredsDirty]  = useState<Record<string, string>>({});
  const [credsSaving, setCredsSaving] = useState(false);
  const [showSecret,  setShowSecret]  = useState<Record<string, boolean>>({});
  const [twConfig, setTwConfig] = useState<{ hasEnvClientId: boolean; hasEnvClientSecret: boolean; hasDbClientId: boolean; hasDbClientSecret: boolean; isConfigured: boolean } | null>(null);
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const TW_OAUTH_FIELDS = [
    { key: "client_id",           label: "OAuth 2.0 Client ID",            isSecret: false, hint: "developer.x.com → Your App → Settings → User authentication settings → Client ID" },
    { key: "client_secret",       label: "OAuth 2.0 Client Secret",        isSecret: true,  hint: "developer.x.com → Your App → Settings → User authentication settings → Client Secret. (Optional for Public apps)" },
  ];

  const connectTwitterOAuth = async () => {
    setConnectingOAuth(true);
    try {
      const res = await fetch("/api/twitter/auth-url");
      const d = await res.json();
      if (!res.ok) {
        alert(d.error || "Failed to generate connection URL. Please ensure Client ID is saved first.");
        setConnectingOAuth(false);
        return;
      }
      
      const w = 600, h = 750;
      const left = (window.screen.width / 2) - (w / 2);
      const top = (window.screen.height / 2) - (h / 2);
      const popup = window.open(d.authUrl, "TwitterOAuth", `width=${w},height=${h},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`);
      
      if (!popup) {
        alert("Popup blocked! Please allow popups for this site to complete linking your account.");
        setConnectingOAuth(false);
        return;
      }

      const handleMessage = (e: MessageEvent) => {
        if (e.data?.type === "TWITTER_OAUTH_SUCCESS") {
          showToast("X (Twitter) connected successfully!");
          loadAll();
          loadTwitterUser();
          window.removeEventListener("message", handleMessage);
          setConnectingOAuth(false);
        }
      };
      window.addEventListener("message", handleMessage);

      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setConnectingOAuth(false);
        }
      }, 1000);
    } catch (err) {
      showToast("Network error starting OAuth.");
      setConnectingOAuth(false);
    }
  };

  const disconnectTwitter = async () => {
    if (!window.confirm("Are you sure you want to disconnect your X (Twitter) account?")) return;
    setDisconnecting(true);
    const res = await fetch("/api/channels/credentials/twitter", { method: "DELETE" });
    if (res.ok) {
      setTwCreds({});
      setCredsDirty({});
      setTwitterUser(null);
      showToast("X (Twitter) disconnected.");
    } else {
      showToast("Failed to disconnect.");
    }
    setDisconnecting(false);
  };

  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTplName, setNewTplName]           = useState("");
  const [newTplBody, setNewTplBody]           = useState("");

  const tagInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const loadAll = useCallback(async () => {
    const [hRes, rRes, qRes, tRes, sRes, credRes, configRes] = await Promise.all([
      fetch("/api/twitter/hashtags"),
      fetch("/api/twitter/rules"),
      fetch("/api/twitter/queue"),
      fetch("/api/twitter/templates"),
      fetch("/api/twitter/scheduler"),
      fetch("/api/channels/credentials/twitter"),
      fetch("/api/twitter/config"),
    ]);
    if (hRes.ok) setHashtags(await hRes.json());
    if (rRes.ok) setRules(await rRes.json());
    if (qRes.ok) setQueue(await qRes.json());
    if (tRes.ok) setTemplates(await tRes.json());
    if (sRes.ok) setScheduler(await sRes.json());
    if (credRes.ok) { const d = await credRes.json(); setTwCreds(d); setCredsDirty(d); }
    if (configRes.ok) setTwConfig(await configRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (twCreds.bearer_token || twCreds.access_token) {
      loadTwitterUser();
    }
  }, [twCreds.bearer_token, twCreds.access_token]);

  const addHashtag = async () => {
    if (!newTag.trim()) return;
    const tag = newTag.trim().startsWith("#") ? newTag.trim() : `#${newTag.trim()}`;
    if (hashtags.find((h) => h.tag === tag)) { showToast("That hashtag already exists."); return; }
    if (hashtags.length >= 10) { showToast("Maximum 10 hashtags."); return; }
    const res = await fetch("/api/twitter/hashtags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tag }) });
    if (res.ok) { const created = await res.json(); setHashtags((p) => [...p, created]); setNewTag(""); tagInputRef.current?.focus(); }
  };

  const removeHashtag = async (h: Hashtag) => {
    setHashtags((p) => p.filter((x) => x.id !== h.id));
    await fetch(`/api/twitter/hashtags/${h.id}`, { method: "DELETE" });
  };

  const publishNow = async () => {
    if (!tweetText.trim() || tweetText.length > MAX_CHARS) return;
    setPublishing(true); setPublishResult(null);
    try {
      const res = await fetch("/api/twitter/posts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text: tweetText,
          taggedProducts: taggedProducts.length > 0 ? taggedProducts : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setPublishResult({ ok: false, msg: d.error ?? "Publish failed" });
      } else {
        const tagNote = taggedProducts.length > 0 ? ` (${taggedProducts.length} product${taggedProducts.length > 1 ? "s" : ""} tagged)` : "";
        setPublishResult({ ok: true, msg: `Tweet published! ID: ${d.tweet?.id ?? ""}${tagNote}` });
        setTweetText("");
        setTaggedProducts([]);
        if (d.queued) setQueue((p) => [d.queued, ...p]);
      }
    } catch {
      setPublishResult({ ok: false, msg: "Network error" });
    }
    setPublishing(false);
  };

  const scheduleTweet = async () => {
    if (!tweetText.trim() || tweetText.length > MAX_CHARS || !scheduler) return;
    setScheduling(true);
    const scheduledFor = scheduler.dropFrequency === "Real-time (Immediate)" ? "Posting now…"
      : scheduler.dropFrequency === "Daily Digest (6 PM)" ? "Today 6:00 PM" : "Next Monday 9:00 AM";
    const res = await fetch("/api/twitter/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: tweetText, scheduledFor, status: "Queued", imageStyle: scheduler?.imageStyle ?? "None" }) });
    if (res.ok) {
      const created = await res.json();
      setQueue((p) => [created, ...p]);
      showToast("Tweet added to queue.");
    }
    setScheduling(false);
  };

  const loadTwitterUser = async () => {
    setTwitterUserErr("");
    setTwitterUserLoading(true);
    try {
      const r = await fetch("/api/twitter/me", { credentials: "include" });
      const text = await r.text();
      let d: any = {};
      try {
        d = JSON.parse(text);
      } catch {
        throw new Error(`Server response error (${r.status})`);
      }
      if (!r.ok) {
        setTwitterUserErr(d.error ?? `Error ${r.status}: Failed to fetch account`);
      } else {
        const u = d.data ?? d;
        if (u && (u.name || u.username)) {
          setTwitterUser(u);
        } else {
          setTwitterUserErr("No account data returned from X API");
        }
      }
    } catch (err: any) {
      setTwitterUserErr(err?.message || "Network error loading X account");
    } finally {
      setTwitterUserLoading(false);
    }
  };

  const cancelTweet = async (id: string) => {
    setQueue((p) => p.filter((t) => t.id !== id));
    await fetch(`/api/twitter/queue/${id}`, { method: "DELETE" });
    showToast("Tweet removed from queue.");
  };

  const retryTweet = async (id: string) => {
    setQueue((p) => p.map((t) => t.id === id ? { ...t, status: "Queued" } : t));
    await fetch(`/api/twitter/queue/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Queued" }) });
    showToast("Tweet re-queued.");
  };

  const toggleRule = async (r: AutoRule) => {
    setRules((p) => p.map((x) => x.id === r.id ? { ...x, active: !x.active } : x));
    await fetch(`/api/twitter/rules/${r.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !r.active }) });
    showToast(`Rule "${r.trigger}" ${r.active ? "disabled" : "enabled"}.`);
  };

  const addRule = async () => {
    const res = await fetch("/api/twitter/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trigger: newRuleTrigger, action: newRuleAction, template: "new_arrival", active: true }) });
    if (res.ok) { const created = await res.json(); setRules((p) => [...p, created]); setShowNewRule(false); showToast("Auto-post rule created."); }
  };

  const useTemplate = async (tpl: ContentTemplate) => {
    setTweetText(tpl.body); setActiveTab("composer");
    await fetch(`/api/twitter/templates/${tpl.id}/use`, { method: "PUT" });
    setTemplates((p) => p.map((t) => t.id === tpl.id ? { ...t, usageCount: t.usageCount + 1 } : t));
    showToast(`Template "${tpl.name}" loaded into composer.`);
  };

  const addTemplate = async () => {
    if (!newTplName.trim() || !newTplBody.trim()) { showToast("Name and body required."); return; }
    const res = await fetch("/api/twitter/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newTplName, body: newTplBody }) });
    if (res.ok) { const created = await res.json(); setTemplates((p) => [...p, created]); setNewTplName(""); setNewTplBody(""); setShowNewTemplate(false); showToast("Template saved."); }
  };

  const updateScheduler = async (patch: Partial<Scheduler>) => {
    if (!scheduler) return;
    const updated = { ...scheduler, ...patch };
    setScheduler(updated);
    await fetch("/api/twitter/scheduler", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  };

  const charsLeft = MAX_CHARS - tweetText.length;
  const overLimit = charsLeft < 0;
  const r = 10, circ = 2 * Math.PI * r;
  const circlePercent = Math.min(100, (tweetText.length / MAX_CHARS) * 100);
  const circleColor = charsLeft <= 20 ? (overLimit ? "#ba1a1a" : "#f59e0b") : "#006c49";

  const saveTwCreds = async () => {
    setCredsSaving(true);
    await fetch("/api/channels/credentials/twitter", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credsDirty) });
    setTwCreds(credsDirty);
    setCredsSaving(false);
    showToast("API credentials saved securely.");
  };

  const isLinked = Boolean(twCreds.bearer_token || twCreds.access_token);
  const queuedCount = queue.filter((t) => t.status === "Queued").length;
  const sentCount   = queue.filter((t) => t.status === "Sent").length;

  const tabs: { key: ActiveTab; label: string; icon: any; badge?: number }[] = [
    { key: "composer",    label: "Composer",       icon: <MdEditNote />   },
    { key: "credentials", label: "API Credentials",icon: <MdKey />         },
    { key: "queue",       label: "Queue",          icon: <MdQueue />,       badge: queuedCount },
    { key: "rules",       label: "Auto-post Rules",icon: <MdRule />        },
    { key: "templates",   label: "Templates",      icon: <MdDescription /> },
  ];

  const statusStyle: Record<string, string> = {
    Queued: "bg-blue-50 text-blue-700",
    Sent:   "bg-[#6cf8bb] text-[#00714d]",
    Failed: "bg-red-100 text-red-600",
  };

  if (loading) return (
    <AdminLayout sidebar="channels">
      <div className="flex items-center justify-center min-h-screen">
        <MdRefresh className="animate-spin text-[#006c49] text-3xl" />
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout sidebar="channels">
      <div className="p-4 sm:p-10 max-w-[1280px] mx-auto min-h-screen">
        {toast && (
          <div className="fixed top-6 right-6 z-50 bg-black text-white px-6 py-3 rounded-lg shadow-2xl font-[Manrope] text-sm font-bold flex items-center gap-3">
            <MdCheckCircle className="text-[#6cf8bb] text-base" />{toast}
          </div>
        )}

        <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <Link href="/channels" className="inline-flex items-center gap-1.5 text-[#7c839b] hover:text-[#006c49] transition-colors font-[Manrope] font-bold text-xs tracking-widest uppercase mb-4 no-underline">
              <MdArrowBack className="text-base" /> Channel Hub
            </Link>
            <h2 className="text-2xl sm:text-[36px] font-serif font-bold text-[#0b1c30] mb-2 flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white shrink-0 shadow-lg">
                <SiX className="text-xl" />
              </div>
              X (Twitter) Settings
            </h2>
            <p className="font-[Manrope] text-[#7c839b] max-w-2xl">Compose & schedule tweets, manage auto-post rules, and maintain a content template library.</p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-3">
            {isLinked ? (
              <div className="flex items-center gap-3 px-4 py-2 bg-[#6cf8bb]/30 border border-[#6cf8bb] rounded-full">
                <span className="flex h-2 w-2 rounded-full bg-[#006c49]"></span>
                <span className="text-[#006c49] font-[Manrope] font-bold text-[11px] tracking-widest uppercase">Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full">
                <span className="flex h-2 w-2 rounded-full bg-amber-500"></span>
                <span className="text-amber-700 font-[Manrope] font-bold text-[11px] tracking-widest uppercase">Disconnected</span>
              </div>
            )}
            <div className="flex gap-4 text-xs font-[Manrope] text-[#7c839b]">
              <span><strong className="text-black">{queuedCount}</strong> queued</span>
              <span><strong className="text-black">{sentCount}</strong> sent</span>
              <span><strong className="text-black">{rules.filter((r) => r.active).length}</strong> rules active</span>
            </div>
          </div>
        </div>

        {/* Scheduler bar */}
        {scheduler && (
          <div className="bg-white p-5 rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] border border-slate-100 mb-6 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-lg transition-colors ${scheduler.schedulerOn ? "bg-[#6cf8bb]" : "bg-slate-100"}`}>
                <MdInventory2 className={`text-xl ${scheduler.schedulerOn ? "text-[#006c49]" : "text-slate-400"}`} />
              </div>
              <div>
                <h3 className="font-serif font-semibold text-base">Product Drop Scheduler</h3>
                <p className="text-xs text-[#7c839b] font-[Manrope]">Auto-post new inventory arrivals · <strong>{scheduler.schedulerOn ? "ON" : "OFF"}</strong></p>
              </div>
            </div>
            <div className={`flex items-center gap-4 transition-opacity ${scheduler.schedulerOn ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
              <select value={scheduler.dropFrequency} onChange={(e) => updateScheduler({ dropFrequency: e.target.value })} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-sm font-[Manrope] outline-none">
                {["Real-time (Immediate)", "Daily Digest (6 PM)", "Weekly Roundup"].map((o) => <option key={o}>{o}</option>)}
              </select>
              <select value={scheduler.imageStyle} onChange={(e) => updateScheduler({ imageStyle: e.target.value })} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-sm font-[Manrope] outline-none">
                {["Single Product High-Res", "Grid (4-up)", "Carousel Thread"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <button onClick={() => updateScheduler({ schedulerOn: !scheduler.schedulerOn })}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${scheduler.schedulerOn ? "bg-[#006c49]" : "bg-slate-300"}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${scheduler.schedulerOn ? "translate-x-5" : "translate-x-0.5"}`}></span>
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-6 py-4 font-[Manrope] font-bold text-xs tracking-widest uppercase transition-colors whitespace-nowrap relative ${activeTab === t.key ? "border-b-2 border-[#006c49] text-[#006c49]" : "text-[#7c839b] hover:text-black"}`}>
                <div className="text-sm">{t.icon}</div>{t.label}
                {t.badge !== undefined && t.badge > 0 && <span className="ml-1 bg-[#006c49] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{t.badge}</span>}
              </button>
            ))}
          </div>

          <div className="p-8">
            {/* COMPOSER */}
            {activeTab === "composer" && (
              <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12 lg:col-span-7 space-y-6">
                  <div>
                    <h3 className="font-serif font-semibold text-lg">Live Queue</h3>
                    {queue.length === 0 ? <div className="text-sm text-[#7c839b] font-[Manrope] py-6">No queued posts yet.</div> : (
                      <div className="space-y-3">
                        {queue.map((tw) => (
                          <div key={tw.id} className="p-4 bg-[#f8f9ff] rounded-xl border border-slate-100">
                            <p className="text-sm font-[Manrope] text-[#0b1c30]">{tw.text}</p>
                            <div className="mt-2 text-xs text-[#7c839b] font-[Manrope]">{tw.scheduledFor} · {tw.status}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                  <div className="col-span-12 lg:col-span-5 space-y-5">
                    {/* Connected Account */}
                    {twitterUser ? (
                      <div className="bg-black text-white p-5 rounded-xl space-y-3">
                        <div className="flex items-center gap-3">
                          {twitterUser.profile_image_url && <img src={twitterUser.profile_image_url} alt={twitterUser.username} className="w-10 h-10 rounded-full" />}
                          <div>
                            <p className="font-semibold text-sm">{twitterUser.name}</p>
                            <p className="text-white/60 text-xs">@{twitterUser.username}</p>
                          </div>
                        </div>
                        {twitterUser.public_metrics && (
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                            <div><p className="text-xl font-bold">{twitterUser.public_metrics.followers_count?.toLocaleString()}</p><p className="text-white/50 text-xs">Followers</p></div>
                            <div><p className="text-xl font-bold">{twitterUser.public_metrics.tweet_count?.toLocaleString()}</p><p className="text-white/50 text-xs">Tweets</p></div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center">
                        <p className="text-sm text-slate-500 mb-3">Connect your X account to see profile</p>
                        <button
                          onClick={loadTwitterUser}
                          disabled={twitterUserLoading}
                          className="px-4 py-2 bg-black text-white text-xs font-bold rounded-lg hover:bg-[#006c49] transition-colors font-[Manrope] tracking-widest uppercase flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                        >
                          {twitterUserLoading && <MdRefresh className="animate-spin text-sm" />}
                          {twitterUserLoading ? "Loading Account…" : "Load Account"}
                        </button>
                        {twitterUserErr && <p className="text-xs text-red-500 mt-2 font-[Manrope]">{twitterUserErr}</p>}
                      </div>
                    )}
                    {/* Publish Now */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                      <h4 className="font-serif font-semibold text-base">Publish Now</h4>
                      <textarea value={tweetText} onChange={(e) => { setTweetText(e.target.value); setPublishResult(null); }} rows={4} maxLength={290}
                        placeholder="What's happening?"
                        className={`w-full border rounded-xl p-4 text-sm font-[Manrope] outline-none resize-none transition-colors ${overLimit ? "border-red-400 bg-red-50" : "border-slate-200 focus:border-black"}`} />
                      
                      {/* Product Tagging (Shoppable X / Twitter Posts) */}
                      <ProductTagPicker
                        platform="twitter"
                        targetType="tweet"
                        taggedProducts={taggedProducts}
                        onChange={setTaggedProducts}
                        onAppendToCaption={(txt) => setTweetText((prev) => `${prev}${txt}`)}
                        maxTags={5}
                      />

                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-mono ${overLimit ? "text-red-500 font-bold" : charsLeft <= 20 ? "text-amber-500" : "text-slate-400"}`}>{charsLeft}</span>
                        <div className="flex gap-2">
                          <button onClick={scheduleTweet} disabled={scheduling || overLimit || !tweetText.trim()} className="px-3 py-2 border border-slate-200 text-[10px] font-[Manrope] font-bold tracking-widest uppercase rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors">
                            {scheduling ? "Queuing…" : "+ Queue"}
                          </button>
                          <button onClick={publishNow} disabled={publishing || overLimit || !tweetText.trim()} className="px-4 py-2 bg-black text-white text-[10px] font-[Manrope] font-bold tracking-widest uppercase rounded-lg hover:bg-[#006c49] disabled:opacity-50 transition-colors flex items-center gap-1">
                            <MdSend className="text-sm" />
                            {publishing ? "Posting…" : "Publish Now"}
                          </button>
                        </div>
                      </div>
                      {publishResult && (
                        <div className={`p-3 rounded-xl text-xs font-[Manrope] font-semibold border ${publishResult.ok ? "bg-[#f0faf6] text-[#006c49] border-[#c3eed8]" : "bg-red-50 text-red-600 border-red-200"}`}>
                          {publishResult.msg}
                        </div>
                      )}
                    </div>
                    <div className="bg-white border border-slate-100 rounded-xl p-5">
                      <h3 className="font-serif font-semibold mb-2">Queue Status</h3>
                      <p className="text-sm text-[#7c839b] font-[Manrope]">{queuedCount} queued · {sentCount} sent</p>
                    </div>
                  </div>
              </div>
            )}

            {/* API CREDENTIALS */}
            {activeTab === "credentials" && (
              <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12 lg:col-span-7 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                      <h3 className="font-serif text-[22px] font-semibold mb-1">X (Twitter) Connection</h3>
                      <p className="text-xs text-[#7c839b] font-[Manrope]">Authenticate via secure OAuth 2.0 to link your account.</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {twCreds.bearer_token ? (
                      <div className="p-6 bg-[#f0faf6] border border-[#c3eed8] rounded-xl space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-[#6cf8bb]">
                              <SiX className="text-lg" />
                            </div>
                            <div>
                              <h4 className="font-serif font-bold text-base text-[#006c49] flex items-center gap-1.5">
                                <MdCheckCircle className="text-lg text-[#006c49]" /> Account Connected
                              </h4>
                              <p className="text-xs text-[#006c49]/80 font-[Manrope]">
                                Linked via secure OAuth 2.0 PKCE User context.
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={disconnectTwitter}
                            disabled={disconnecting}
                            className="px-3 py-1.5 bg-white text-red-600 border border-red-200 text-[10px] font-bold font-[Manrope] uppercase tracking-widest rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {disconnecting ? "Disconnecting…" : "Disconnect"}
                          </button>
                        </div>

                        {twitterUser ? (
                          <div className="p-4 bg-white/60 border border-emerald-100 rounded-lg flex items-center gap-3">
                            {twitterUser.profile_image_url && (
                              <img src={twitterUser.profile_image_url} alt={twitterUser.username} className="w-10 h-10 rounded-full border border-emerald-200" />
                            )}
                            <div>
                              <p className="font-semibold text-sm text-[#0b1c30]">{twitterUser.name}</p>
                              <p className="text-slate-500 text-xs font-[Manrope]">@{twitterUser.username}</p>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={loadTwitterUser}
                            disabled={twitterUserLoading}
                            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold tracking-widest uppercase rounded-lg transition-colors font-[Manrope] flex items-center gap-2 disabled:opacity-50"
                          >
                            {twitterUserLoading && <MdRefresh className="animate-spin text-sm" />}
                            Load Profile Details
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl space-y-6">
                        <div>
                          <h4 className="font-serif font-semibold text-base mb-1">Set Up OAuth 2.0 PKCE</h4>
                          <p className="text-xs text-[#7c839b] font-[Manrope] leading-relaxed">
                            Register the dynamic callback URI in your X Developer Portal, and then link your account with one click.
                          </p>
                        </div>

                        {/* Dynamic Callback URI section */}
                        <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-1.5">
                          <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-slate-400">Callback URI for X Developer Portal</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={window.location.origin + "/api/twitter/callback"}
                              className="w-full bg-slate-50 border border-slate-100 rounded px-3 py-1.5 font-mono text-xs text-slate-600 outline-none"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(window.location.origin + "/api/twitter/callback").catch(() => {});
                                showToast("Callback URI copied!");
                              }}
                              className="p-2 border border-slate-200 hover:border-black rounded text-slate-500 hover:text-black transition-colors"
                            >
                              <MdContentCopy className="text-sm" />
                            </button>
                          </div>
                          <p className="text-[11px] text-[#7c839b] font-[Manrope] italic">
                            Add this exact URL under "User authentication settings" in your Developer App settings.
                          </p>
                        </div>

                        <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl">
                          <div className="flex items-center gap-3 mb-4">
                            <MdKey className="text-2xl text-slate-400" />
                            <div>
                              <p className="text-sm font-[Manrope] font-bold text-black">Managed via Platform Environment Variables</p>
                              <p className="text-xs font-[Manrope] text-slate-500 mt-1">Manual entry of Twitter credentials is disabled in this environment.</p>
                            </div>
                          </div>
                          <ul className="space-y-2 text-xs font-[Manrope] text-slate-600 list-disc list-inside">
                            {TW_OAUTH_FIELDS.map(f => (
                              <li key={f.key}><span className="font-bold text-slate-800">{f.label}</span></li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <button
                            onClick={connectTwitterOAuth}
                            disabled={connectingOAuth}
                            className="flex-1 py-3 bg-[#006c49] hover:bg-[#005237] text-white font-[Manrope] font-bold text-xs tracking-widest uppercase disabled:opacity-40 transition-colors rounded-lg flex items-center justify-center gap-2"
                          >
                            <SiX className="text-sm" />
                            {connectingOAuth ? "Connecting…" : "Connect with X"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-12 lg:col-span-5 space-y-4">
                  <div className="p-5 bg-[#f8f9ff] rounded-xl border border-slate-100 space-y-4">
                    <h4 className="font-serif font-semibold flex items-center gap-2"><MdHelp className="text-[#006c49] text-base" />Connected Data</h4>
                    <p className="text-xs text-[#7c839b] font-[Manrope] leading-relaxed">
                      We support both modern OAuth 2.0 PKCE user authorization and classic OAuth 1.0a access keys. Saving credentials updates the database securely.
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <h4 className="font-serif font-semibold text-sm">Queue Summary</h4>
                    <p className="text-xs text-[#7c839b] font-[Manrope]">{queuedCount} queued · {sentCount} sent</p>
                  </div>
                </div>
              </div>
            )}

            {/* QUEUE */}
            {activeTab === "queue" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div><h3 className="font-serif text-[20px] font-semibold mb-1">Tweet Queue</h3><p className="text-sm text-[#7c839b] font-[Manrope]">{queuedCount} scheduled · {sentCount} sent — persisted to database</p></div>
                  <button onClick={() => setActiveTab("composer")} className="px-5 py-2 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors rounded-lg flex items-center gap-2">
                    <MdEditNote className="text-sm" /> New Tweet
                  </button>
                </div>
                {queue.length === 0 ? <div className="text-center py-16 text-[#7c839b] font-[Manrope]">No tweets in queue.</div> : (
                  <div className="space-y-3">
                    {queue.map((tw) => (
                      <div key={tw.id} className={`p-5 rounded-xl border flex items-start gap-4 ${tw.status === "Queued" ? "bg-[#f8f9ff] border-slate-100" : tw.status === "Sent" ? "bg-emerald-50/50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
                        <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold shrink-0">LB</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-[Manrope] text-[#0b1c30] line-clamp-2 mb-2">{tw.text}</p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`text-[10px] font-[Manrope] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${statusStyle[tw.status] ?? "bg-slate-100 text-slate-500"}`}>{tw.status}</span>
                            <span className="text-xs text-[#7c839b] font-[Manrope]">{tw.scheduledFor}</span>
                            <span className="text-xs text-[#7c839b] font-[Manrope]">· {tw.imageStyle}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {tw.status === "Queued" && <button onClick={() => cancelTweet(tw.id)} className="text-xs font-[Manrope] text-[#7c839b] hover:text-red-500 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors">Cancel</button>}
                          {tw.status === "Failed" && <button onClick={() => retryTweet(tw.id)} className="text-xs font-[Manrope] font-bold text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">Retry</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AUTO-POST RULES */}
            {activeTab === "rules" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div><h3 className="font-serif text-[20px] font-semibold mb-1">Auto-post Rules</h3><p className="text-sm text-[#7c839b] font-[Manrope]">{rules.filter((r) => r.active).length}/{rules.length} active — saved to database</p></div>
                  <button onClick={() => setShowNewRule((v) => !v)} className="px-5 py-2 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors rounded-lg flex items-center gap-2">
                    <MdAdd className="text-sm" /> New Rule
                  </button>
                </div>
                {showNewRule && (
                  <div className="mb-6 p-5 bg-[#f8f9ff] rounded-xl border border-dashed border-slate-200 space-y-4">
                    <h4 className="font-serif font-semibold">Create Rule</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d]">Trigger</label>
                        <select value={newRuleTrigger} onChange={(e) => setNewRuleTrigger(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-[Manrope] outline-none focus:border-[#006c49]">
                          {["New Product Published", "Price Drop > 20%", "Back In Stock", "Order Milestone (100/wk)", "New Collection Live"].map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d]">Action</label>
                        <select value={newRuleAction} onChange={(e) => setNewRuleAction(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-[Manrope] outline-none focus:border-[#006c49]">
                          {["Post immediately", "Post in 30 minutes", "Post in 1 hour", "Post daily digest", "Post weekly digest"].map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={addRule} className="px-5 py-2 bg-[#006c49] text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-black transition-colors rounded-lg">Save Rule</button>
                      <button onClick={() => setShowNewRule(false)} className="px-5 py-2 border border-slate-200 font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-slate-50 transition-colors rounded-lg">Cancel</button>
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  {rules.map((rule) => (
                    <div key={rule.id} className={`p-5 rounded-xl border flex items-center gap-4 transition-all ${rule.active ? "bg-[#f8f9ff] border-slate-100" : "bg-white border-dashed border-slate-200 opacity-60"}`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${rule.active ? "bg-[#006c49]" : "bg-slate-200"}`}>
                        <MdRule className="text-white text-sm" />
                      </div>
                      <div className="flex-1">
                        <p className="font-[Manrope] font-bold text-sm">When: {rule.trigger}</p>
                        <div className="flex items-center gap-2 text-xs text-[#7c839b] font-[Manrope]">
                          <span>→ {rule.action}</span>
                          <span>· Template: <code className="font-mono text-[#006c49]">{rule.template}</code></span>
                        </div>
                      </div>
                      <button onClick={() => toggleRule(rule)}
                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${rule.active ? "bg-[#006c49]" : "bg-slate-300"}`}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${rule.active ? "translate-x-5" : "translate-x-0.5"}`}></span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TEMPLATES */}
            {activeTab === "templates" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div><h3 className="font-serif text-[20px] font-semibold mb-1">Content Templates</h3><p className="text-sm text-[#7c839b] font-[Manrope]">Reusable tweet skeletons. Click "Use" to load into composer.</p></div>
                  <button onClick={() => setShowNewTemplate((v) => !v)} className="px-5 py-2 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors rounded-lg flex items-center gap-2">
                    <MdAdd className="text-sm" /> New Template
                  </button>
                </div>
                {showNewTemplate && (
                  <div className="mb-6 p-5 bg-[#f8f9ff] rounded-xl border border-dashed border-slate-200 space-y-4">
                    <h4 className="font-serif font-semibold">Create Template</h4>
                    <div className="space-y-1">
                      <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d]">Template Name</label>
                      <input value={newTplName} onChange={(e) => setNewTplName(e.target.value)} placeholder="e.g. flash_sale" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm font-[Manrope] outline-none focus:border-[#006c49]" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d]">Body</label>
                      <textarea value={newTplBody} onChange={(e) => setNewTplBody(e.target.value)} rows={3} placeholder="⚡ FLASH SALE — {{product_name}} is {{discount}}% off. {{hashtags}}"
                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm font-[Manrope] outline-none focus:border-[#006c49] resize-none" />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={addTemplate} className="px-5 py-2 bg-[#006c49] text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-black transition-colors rounded-lg">Save Template</button>
                      <button onClick={() => setShowNewTemplate(false)} className="px-5 py-2 border border-slate-200 font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-slate-50 transition-colors rounded-lg">Cancel</button>
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  {templates.map((tpl) => (
                    <div key={tpl.id} className="p-5 bg-white border border-slate-100 rounded-xl">
                      <div className="flex items-start justify-between mb-2">
                        <code className="font-mono text-sm font-bold text-[#0b1c30]">{tpl.name}</code>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-[Manrope] text-[#7c839b]">Used {tpl.usageCount}×</span>
                          <button onClick={() => useTemplate(tpl)} className="px-4 py-1.5 bg-black text-white font-[Manrope] font-bold text-[10px] tracking-widest uppercase hover:bg-[#006c49] transition-colors rounded-lg">Use</button>
                        </div>
                      </div>
                      <p className="text-sm font-[Manrope] text-[#45464d] bg-[#f8f9ff] px-4 py-3 rounded-lg border-l-2 border-[#006c49]">{tpl.body}</p>
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
