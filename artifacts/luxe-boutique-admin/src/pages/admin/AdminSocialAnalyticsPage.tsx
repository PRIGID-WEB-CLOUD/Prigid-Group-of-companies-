import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  MdHub,
  MdThumbUp,
  MdPhotoCamera,
  MdCampaign,
  MdShare,
  MdChat,
  MdOpenInNew,
  MdArrowForward,
  MdArrowBack,
  MdRefresh,
  MdGroup,
  MdSettings
} from "react-icons/md";
import AdminLayout from "./AdminLayout";

type ChannelFilter = "all" | "facebook" | "instagram" | "twitter" | "whatsapp" | "ads";

interface PageInfo   { name?: string; fan_count?: number; }
interface IgAccount  { username?: string; followers_count?: number; media_count?: number; }
interface TwitterUser{ username?: string; public_metrics?: { followers_count: number; tweet_count: number }; }
interface PhoneInfo  { display_phone_number?: string; quality_rating?: string; status?: string; }
interface AdsInsights{ spend?: string; impressions?: string; reach?: string; cpc?: string; }

interface ChannelData {
  facebook?:  { ok: boolean; info?: PageInfo;   error?: string };
  instagram?: { ok: boolean; info?: IgAccount;  error?: string };
  twitter?:   { ok: boolean; info?: TwitterUser;error?: string };
  whatsapp?:  { ok: boolean; info?: PhoneInfo;  error?: string };
  ads?:       { ok: boolean; info?: AdsInsights;error?: string };
}

const CHANNEL_TABS: { key: ChannelFilter; label: string; icon: React.ReactNode; href: string }[] = [
  { key: "all",       label: "Overview",   icon: <MdHub />,          href: "/channels"              },
  { key: "facebook",  label: "Facebook",   icon: <MdThumbUp />,     href: "/channels/facebook"     },
  { key: "instagram", label: "Instagram",  icon: <MdPhotoCamera />, href: "/channels/instagram"    },
  { key: "ads",       label: "Meta Ads",   icon: <MdCampaign />,     href: "/channels/meta-ads"     },
  { key: "twitter",   label: "X / Twitter",icon: <MdShare />,        href: "/channels/twitter"      },
  { key: "whatsapp",  label: "WhatsApp",   icon: <MdChat />,         href: "/channels/whatsapp"     },
];

function fmtNum(n: number | string | undefined) {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

function StatusDot({ ok, error }: { ok?: boolean; error?: string }) {
  if (ok === undefined) return <span className="w-2 h-2 rounded-full bg-slate-200 inline-block" />;
  return ok
    ? <span className="w-2 h-2 rounded-full bg-[#006c49] inline-block" />
    : <span title={error} className="w-2 h-2 rounded-full bg-red-400 inline-block" />;
}

function MetricCard({ label, value, sub, icon, href }: { label: string; value: string; sub?: string; icon: React.ReactNode; href: string }) {
  return (
    <Link href={href}>
      <div className="bg-white p-6 rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] hover:shadow-[0px_8px_30px_rgba(15,23,42,0.10)] transition-all cursor-pointer group">
        <div className="flex justify-between items-start mb-4">
          <div className="w-10 h-10 bg-[#f0faf6] rounded-xl flex items-center justify-center group-hover:bg-[#006c49] transition-colors">
            <div className="text-[#006c49] group-hover:text-white text-xl transition-colors">{icon}</div>
          </div>
          <MdOpenInNew className="text-slate-300 group-hover:text-[#006c49] text-sm transition-colors" />
        </div>
        <h3 className="text-[28px] font-serif font-bold text-[#0b1c30] mb-1">{value}</h3>
        <p className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#7c839b] mb-1">{label}</p>
        {sub && <p className="font-[Manrope] text-[11px] text-[#7c839b]">{sub}</p>}
      </div>
    </Link>
  );
}

function ChannelCard({
  icon, title, href, ch,
}: {
  icon: React.ReactNode; title: string; href: string;
  ch: { ok: boolean; info?: Record<string, any>; error?: string } | undefined;
}) {
  const connected = ch?.ok === true;
  const noCredentials = ch?.error?.toLowerCase().includes("missing");

  return (
    <Link href={href}>
      <div className={`p-5 rounded-xl border transition-all cursor-pointer group ${connected ? "border-[#c3eed8] bg-[#f0faf6] hover:border-[#006c49]" : "border-slate-100 bg-white hover:border-slate-300"}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${connected ? "bg-[#006c49]" : "bg-slate-100"}`}>
            <div className={`text-lg ${connected ? "text-white" : "text-slate-400"}`}>{icon}</div>
          </div>
          <div className="flex-1">
            <p className="font-[Manrope] font-bold text-sm text-[#0b1c30]">{title}</p>
            <span className={`inline-flex items-center gap-1 text-[10px] font-[Manrope] font-bold tracking-widest uppercase ${connected ? "text-[#006c49]" : noCredentials ? "text-amber-600" : "text-red-500"}`}>
              <StatusDot ok={ch?.ok} error={ch?.error} />
              {ch === undefined ? "Loading…" : connected ? "Connected" : noCredentials ? "No Credentials" : "Error"}
            </span>
          </div>
          <MdArrowForward className="text-slate-300 group-hover:text-[#006c49] text-sm transition-colors" />
        </div>
        {connected && ch?.info && (
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(ch.info)
              .filter(([, v]) => typeof v === "number" || typeof v === "string")
              .slice(0, 4)
              .map(([k, v]) => (
                <div key={k} className="bg-white rounded-lg p-2">
                  <p className="text-[10px] font-[Manrope] text-[#7c839b] capitalize">{k.replace(/_/g, " ")}</p>
                  <p className="font-[Manrope] font-bold text-xs text-[#0b1c30] truncate">{typeof v === "number" ? fmtNum(v) : String(v)}</p>
                </div>
              ))}
          </div>
        )}
        {!connected && ch?.error && !noCredentials && (
          <p className="text-[11px] font-[Manrope] text-red-500 truncate mt-1">{ch.error}</p>
        )}
        {!connected && noCredentials && (
          <p className="text-[11px] font-[Manrope] text-amber-600 mt-1">Add credentials to connect →</p>
        )}
      </div>
    </Link>
  );
}

export default function AdminSocialAnalyticsPage() {
  const [filter, setFilter] = useState<ChannelFilter>("all");
  const [data, setData]     = useState<ChannelData>({});
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [fbRes, igRes, twRes, waRes, adsRes] = await Promise.allSettled([
      fetch("/api/facebook/page-info",           { credentials: "include" }),
      fetch("/api/facebook/instagram/account",   { credentials: "include" }),
      fetch("/api/twitter/me",                   { credentials: "include" }),
      fetch("/api/whatsapp/phone-info",          { credentials: "include" }),
      fetch("/api/facebook/ads/insights?preset=last_7d", { credentials: "include" }),
    ]);

    const parse = async (r: PromiseSettledResult<Response>) => {
      if (r.status === "rejected") return { ok: false, error: r.reason?.message ?? "Network error" };
      const res = r.value;
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error ?? `HTTP ${res.status}` };
      return { ok: true, info: body };
    };

    const [fb, ig, tw, wa, ads] = await Promise.all([
      parse(fbRes), parse(igRes), parse(twRes), parse(waRes), parse(adsRes),
    ]);

    setData({ facebook: fb, instagram: ig, twitter: tw, whatsapp: wa, ads });
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fbInfo  = data.facebook?.info  as PageInfo | undefined;
  const igInfo  = data.instagram?.info as IgAccount | undefined;
  const twInfo  = (data.twitter?.info as any)?.data as TwitterUser | undefined;
  const adsInfo = (data.ads?.info as any)?.data?.[0] as AdsInsights | undefined;

  const totalReach   = (fbInfo?.fan_count ?? 0) + (igInfo?.followers_count ?? 0) + (twInfo?.public_metrics?.followers_count ?? 0);
  const adSpend      = adsInfo?.spend ? `$${parseFloat(adsInfo.spend).toFixed(2)}` : "—";
  const adImpressions = adsInfo?.impressions ? fmtNum(adsInfo.impressions) : "—";
  const anyConnected = Object.values(data).some((d) => d?.ok);

  return (
    <AdminLayout sidebar="channels">
      <main className="p-4 sm:p-10 max-w-[1280px] mx-auto">
        {/* Header */}
        <div className="mb-10 flex justify-between items-end">
          <div>
            <Link href="/channels" className="inline-flex items-center gap-1.5 text-[#7c839b] hover:text-[#006c49] transition-colors font-[Manrope] font-bold text-xs tracking-widest uppercase mb-4 no-underline">
              <MdArrowBack className="text-base" /> Omnichannel Hub
            </Link>
            <h1 className="text-[44px] font-serif font-bold text-[#0b1c30] mb-2">Social Analytics</h1>
            <p className="text-[17px] font-[Manrope] text-[#7c839b]">
              Live performance across your commerce social ecosystem.
              {!loading && (
                <span className="ml-2 text-[12px] text-slate-400">
                  Last updated {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#006c49] text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-black transition-colors rounded-sm disabled:opacity-50"
          >
            <MdRefresh className={`text-sm ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {/* Channel filter tabs */}
        <div className="flex gap-2 mb-8 border-b border-slate-100 pb-4 overflow-x-auto">
          {CHANNEL_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-[Manrope] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                filter === tab.key ? "bg-black text-white" : "bg-slate-100 text-[#7c839b] hover:bg-slate-200 hover:text-black"
              }`}
            >
              <div className="text-sm">{tab.icon}</div>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {filter === "all" && (
          <>
            {/* Aggregate metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
              <MetricCard
                label="Total Reach"
                value={totalReach > 0 ? fmtNum(totalReach) : "—"}
                sub="Fans + Followers across all channels"
                icon={<MdGroup />}
                href="/channels"
              />
              <MetricCard
                label="Instagram Followers"
                value={igInfo?.followers_count ? fmtNum(igInfo.followers_count) : "—"}
                sub={igInfo?.username ? `@${igInfo.username}` : "Connect Instagram"}
                icon={<MdPhotoCamera />}
                href="/channels/instagram"
              />
              <MetricCard
                label="Ad Spend (7d)"
                value={adSpend}
                sub={adsInfo?.impressions ? `${adImpressions} impressions` : "Connect Meta Ads"}
                icon={<MdCampaign />}
                href="/channels/meta-ads"
              />
              <MetricCard
                label="Tweets Published"
                value={twInfo?.public_metrics?.tweet_count ? fmtNum(twInfo.public_metrics.tweet_count) : "—"}
                sub={twInfo?.username ? `@${twInfo.username}` : "Connect X"}
                icon={<MdShare />}
                href="/channels/twitter"
              />
            </div>

            {/* Channel health cards */}
            <h2 className="font-serif text-[22px] font-semibold text-[#0b1c30] mb-5">Channel Health</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
              <ChannelCard
                icon={<MdThumbUp />} title="Facebook Pages"
                href="/channels/facebook"
                ch={data.facebook && {
                  ok: data.facebook.ok,
                  error: data.facebook.error,
                  info: fbInfo ? { name: fbInfo.name, fans: fbInfo.fan_count } : undefined,
                }}
              />
              <ChannelCard
                icon={<MdPhotoCamera />} title="Instagram"
                href="/channels/instagram"
                ch={data.instagram && {
                  ok: data.instagram.ok,
                  error: data.instagram.error,
                  info: igInfo ? { username: igInfo.username, followers: igInfo.followers_count, media: igInfo.media_count } : undefined,
                }}
              />
              <ChannelCard
                icon={<MdCampaign />} title="Meta Ads"
                href="/channels/meta-ads"
                ch={data.ads && {
                  ok: data.ads.ok,
                  error: data.ads.error,
                  info: adsInfo ? { spend: `$${parseFloat(adsInfo.spend ?? "0").toFixed(2)}`, impressions: adsInfo.impressions, reach: adsInfo.reach } : undefined,
                }}
              />
              <ChannelCard
                icon={<MdShare />} title="X / Twitter"
                href="/channels/twitter"
                ch={data.twitter && {
                  ok: data.twitter.ok,
                  error: data.twitter.error,
                  info: twInfo ? { username: twInfo.username, followers: twInfo.public_metrics?.followers_count, tweets: twInfo.public_metrics?.tweet_count } : undefined,
                }}
              />
              <ChannelCard
                icon={<MdChat />} title="WhatsApp Business"
                href="/channels/whatsapp"
                ch={data.whatsapp && {
                  ok: data.whatsapp.ok,
                  error: data.whatsapp.error,
                  info: (data.whatsapp.info as PhoneInfo) ? {
                    phone: (data.whatsapp.info as PhoneInfo).display_phone_number,
                    status: (data.whatsapp.info as PhoneInfo).status,
                    quality: (data.whatsapp.info as PhoneInfo).quality_rating,
                  } : undefined,
                }}
              />
            </div>

            {/* No channels connected prompt */}
            {!loading && !anyConnected && (
              <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] p-16 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-5">
                  <MdHub className="text-3xl text-slate-300" />
                </div>
                <h3 className="font-serif text-[22px] font-semibold text-[#0b1c30] mb-2">No channels connected</h3>
                <p className="font-[Manrope] text-[#7c839b] max-w-sm mx-auto mb-8">
                  Add API credentials to each channel to start seeing live reach, engagement, and revenue metrics here.
                </p>
                <Link href="/channels">
                  <button className="px-8 py-3 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors rounded-lg">
                    Go to Channel Hub
                  </button>
                </Link>
              </div>
            )}
          </>
        )}

        {/* Facebook detail */}
        {filter === "facebook" && (
          <ChannelDetail
            title="Facebook Pages" icon={<MdThumbUp />}
            ok={data.facebook?.ok} error={data.facebook?.error}
            href="/channels/facebook"
          >
            {fbInfo && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Page Name",  value: fbInfo.name ?? "—" },
                  { label: "Page Fans",  value: fbInfo.fan_count != null ? fmtNum(fbInfo.fan_count) : "—" },
                ].map(({ label, value }) => (
                  <StatBox key={label} label={label} value={value} />
                ))}
              </div>
            )}
          </ChannelDetail>
        )}

        {/* Instagram detail */}
        {filter === "instagram" && (
          <ChannelDetail
            title="Instagram" icon={<MdPhotoCamera />}
            ok={data.instagram?.ok} error={data.instagram?.error}
            href="/channels/instagram"
          >
            {igInfo && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Username",    value: igInfo.username ? `@${igInfo.username}` : "—" },
                  { label: "Followers",   value: igInfo.followers_count != null ? fmtNum(igInfo.followers_count) : "—" },
                  { label: "Media Count", value: igInfo.media_count != null ? fmtNum(igInfo.media_count) : "—" },
                ].map(({ label, value }) => (
                  <StatBox key={label} label={label} value={value} />
                ))}
              </div>
            )}
          </ChannelDetail>
        )}

        {/* Meta Ads detail */}
        {filter === "ads" && (
          <ChannelDetail
            title="Meta Ads" icon={<MdCampaign />}
            ok={data.ads?.ok} error={data.ads?.error}
            href="/channels/meta-ads"
          >
            {adsInfo && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Ad Spend",     value: `$${parseFloat(adsInfo.spend ?? "0").toFixed(2)}` },
                  { label: "Impressions",  value: adsInfo.impressions ? fmtNum(adsInfo.impressions) : "—" },
                  { label: "Reach",        value: adsInfo.reach ? fmtNum(adsInfo.reach) : "—" },
                  { label: "Avg. CPC",     value: adsInfo.cpc ? `$${parseFloat(adsInfo.cpc).toFixed(2)}` : "—" },
                ].map(({ label, value }) => (
                  <StatBox key={label} label={label} value={value} />
                ))}
              </div>
            )}
          </ChannelDetail>
        )}

        {/* Twitter detail */}
        {filter === "twitter" && (
          <ChannelDetail
            title="X / Twitter" icon={<MdShare />}
            ok={data.twitter?.ok} error={data.twitter?.error}
            href="/channels/twitter"
          >
            {twInfo && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Username",   value: twInfo.username ? `@${twInfo.username}` : "—" },
                  { label: "Followers",  value: twInfo.public_metrics?.followers_count != null ? fmtNum(twInfo.public_metrics.followers_count) : "—" },
                  { label: "Tweets",     value: twInfo.public_metrics?.tweet_count != null ? fmtNum(twInfo.public_metrics.tweet_count) : "—" },
                ].map(({ label, value }) => (
                  <StatBox key={label} label={label} value={value} />
                ))}
              </div>
            )}
          </ChannelDetail>
        )}

        {/* WhatsApp detail */}
        {filter === "whatsapp" && (
          <ChannelDetail
            title="WhatsApp Business" icon={<MdChat />}
            ok={data.whatsapp?.ok} error={data.whatsapp?.error}
            href="/channels/whatsapp"
          >
            {(data.whatsapp?.info as PhoneInfo) && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Phone Number",   value: (data.whatsapp!.info as PhoneInfo).display_phone_number ?? "—" },
                  { label: "Status",         value: (data.whatsapp!.info as PhoneInfo).status ?? "—" },
                  { label: "Quality Rating", value: (data.whatsapp!.info as PhoneInfo).quality_rating ?? "—" },
                ].map(({ label, value }) => (
                  <StatBox key={label} label={label} value={value} />
                ))}
              </div>
            )}
          </ChannelDetail>
        )}
      </main>
    </AdminLayout>
  );
}

function ChannelDetail({
  title, icon, ok, error, href, children,
}: {
  title: string; icon: React.ReactNode; ok?: boolean; error?: string; href: string; children?: React.ReactNode;
}) {
  const noCredentials = error?.toLowerCase().includes("missing");

  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-xl border ${ok ? "border-[#c3eed8] bg-[#f0faf6]" : "border-slate-100 bg-white"}`}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ok ? "bg-[#006c49]" : "bg-slate-100"}`}>
              <div className={`text-xl ${ok ? "text-white" : "text-slate-400"}`}>{icon}</div>
            </div>
            <div>
              <h2 className="font-serif text-[20px] font-semibold text-[#0b1c30]">{title}</h2>
              <span className={`text-[11px] font-[Manrope] font-bold tracking-widest uppercase ${ok ? "text-[#006c49]" : noCredentials ? "text-amber-600" : "text-red-500"}`}>
                {ok ? "● Connected" : noCredentials ? "● No Credentials" : "● Disconnected"}
              </span>
            </div>
          </div>
          <Link href={href}>
            <button className="px-4 py-2 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors rounded-sm flex items-center gap-2">
              <MdSettings className="text-sm" /> Manage
            </button>
          </Link>
        </div>
        {ok && children}
        {!ok && (
          <div className="mt-2 p-4 rounded-lg bg-white border border-slate-100">
            <p className="font-[Manrope] text-sm text-[#7c839b]">
              {noCredentials
                ? "Enter your API credentials in the channel settings to connect."
                : (error ?? "Channel not connected.")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
      <p className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#7c839b] mb-2">{label}</p>
      <h3 className="text-[24px] font-serif font-bold text-[#0b1c30]">{value}</h3>
    </div>
  );
}
