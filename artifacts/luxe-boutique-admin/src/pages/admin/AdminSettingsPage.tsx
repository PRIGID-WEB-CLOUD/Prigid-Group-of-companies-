import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  MdMail,
  MdCloudUpload,
  MdStorefront,
  MdCreditCard,
  MdPublic,
  MdAlternateEmail,
  MdChatBubble,
  MdKey,
  MdCheckCircle,
  MdRadioButtonUnchecked,
  MdVisibility,
  MdVisibilityOff,
  MdContentCopy,
  MdHelp,
  MdBlock,
  MdAutorenew,
  MdWifiTethering,
  MdCheck,
  MdKeyOff,
  MdDelete,
  MdShield,
  MdWarning,
  MdDeleteForever,
  MdError,
  MdStorage,
  MdAdd,
  MdMarkEmailRead,
  MdArrowForward,
  MdSend,
  MdClose,
  MdInfo,
  MdOpenInNew,
  MdCampaign,
  MdAnalytics,
  MdLocalShipping,
  MdPalette,
} from "react-icons/md";
import { SiGoogleanalytics, SiPaypal, SiDhl } from "react-icons/si";
import AdminLayout from "./AdminLayout";
import PaymentSettingsManager from "../../components/PaymentSettingsManager";

type SettingsData = {
  settings: Record<string, string>;
  status: { cloudinaryConfigured: boolean };
};

type Section = "email" | "cloudinary" | "store" | "facebook" | "twitter" | "whatsapp" | "apikeys" | "payments" | "klaviyo" | "ga4" | "dhl" | "branding";

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  createdBy: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

const MASK = "●●●●●●●●●●●●";

type CredField = { key: string; label: string; isSecret: boolean; hint: string };

function ChannelCredsPanel({
  channel, fields, icon, title, description,
}: {
  channel: string;
  fields: CredField[];
  icon: any;
  title: string;
  description: string;
}) {
  const [saved,  setSaved]  = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ pass: boolean; latency: number } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/channels/credentials/${channel}`);
    if (res.ok) { const d = await res.json(); setSaved(d); }
  }, [channel]);

  useEffect(() => { load(); }, [load]);

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const start = Date.now();
      const res = await fetch(`/api/channels/test/${channel}`, { method: "POST" });
      const latency = Date.now() - start;
      setTestResult({ pass: res.ok, latency });
    } catch {
      setTestResult({ pass: false, latency: 0 });
    } finally {
      setTesting(false);
    }
  };

  const configuredCount = fields.filter(f => !!saved[f.key]).length;
  const allConfigured   = configuredCount === fields.length;

  return (
    <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] overflow-hidden">
      <div className="px-8 py-6 border-b border-[#e5eeff] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#f0f2ff] flex items-center justify-center">
            <div className="text-[#006c49] text-xl">{icon}</div>
          </div>
          <div>
            <h2 className="text-[24px] font-serif font-semibold text-black">{title}</h2>
            <p className="text-xs font-[Manrope] text-[#7c839b] mt-0.5">{description}</p>
          </div>
        </div>
        <StatusBadge ok={allConfigured} label={allConfigured ? "Platform Configured" : "Not Set"} />
      </div>

      <div className="p-8">
        <div className="p-5 bg-[#f8f9ff] border border-[#e5eeff] rounded-xl flex items-start gap-4">
          <MdShield className="text-[#006c49] text-2xl mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-[Manrope] font-bold text-black">Managed via Platform Environment Variables</p>
            <p className="text-xs font-[Manrope] text-[#7c839b] leading-relaxed">
              Sensitive credentials for {title} are now managed exclusively via server-side environment variables in this CaaS environment. 
              Direct editing in the seller panel has been disabled to enhance security and prevent accidental exposure.
            </p>
          </div>
        </div>

        {testResult && (
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm font-[Manrope] font-bold ${testResult.pass ? "bg-[#e6f7f1] text-[#006c49]" : "bg-[#ffdad6] text-[#ba1a1a]"}`}>
            {testResult.pass ? <MdCheckCircle className="text-base" /> : <MdError className="text-base" />}
            {testResult.pass ? `Connection successful — ${testResult.latency}ms` : "Connection failed — please verify environment variables."}
          </div>
        )}
      </div>

      <div className="px-8 py-5 border-t border-[#e5eeff] bg-[#f8f9ff] flex items-center justify-end gap-4">
        <button onClick={test} disabled={testing}
          className="px-5 py-2 border border-[#c6c6cd] font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-white transition-all rounded-lg flex items-center gap-2 disabled:opacity-60">
          <div className={`text-sm ${testing ? "animate-spin" : ""}`}>{testing ? <MdAutorenew /> : <MdWifiTethering />}</div>
          {testing ? "Testing…" : "Test Connection"}
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-[Manrope] font-bold uppercase tracking-widest ${
      ok ? "text-[#006c49] bg-[#e6f7f1]" : "text-[#7c839b] bg-[#f0f2ff]"
    }`}>
      {ok ? <MdCheckCircle className="text-[12px]" /> : <MdRadioButtonUnchecked className="text-[12px]" />}
      {ok ? "Configured" : "Not set"}
    </span>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, hint, masked, onReveal,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string; masked?: boolean; onReveal?: () => void;
}) {
  const [show, setShow] = useState(false);
  const isSecret = masked && value === MASK;

  return (
    <div>
      <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">{label}</label>
      <div className="relative">
        <input
          type={masked && !show ? "password" : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-3 font-[Manrope] text-sm outline-none focus:border-black transition-colors pr-10"
        />
        {masked && (
          <button type="button" onClick={() => {
            if (isSecret && onReveal) { onReveal(); }
            setShow(s => !s);
          }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7c839b] hover:text-black transition-colors">
            {show ? <MdVisibilityOff className="text-lg" /> : <MdVisibility className="text-lg" />}
          </button>
        )}
      </div>
      {hint && <p className="mt-1.5 text-[11px] font-[Manrope] text-[#7c839b]">{hint}</p>}
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ApiKeysPanel() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName,    setNewName]    = useState("");
  const [newKey,     setNewKey]     = useState<string | null>(null);
  const [newId,      setNewId]      = useState<string | null>(null);
  const [copied,     setCopied]     = useState(false);
  const [revokeId,   setRevokeId]   = useState<string | null>(null);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);
  const [createErr,  setCreateErr]  = useState<string | null>(null);
  const [toast,      setToast]      = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3200); };

  const { data: keys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const r = await fetch("/api/apikeys");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/apikeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Failed"); }
      return r.json() as Promise<ApiKey & { rawKey: string }>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setNewKey(data.rawKey);
      setNewId(data.id);
      setNewName("");
      setCreateErr(null);
    },
    onError: (e: Error) => setCreateErr(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/apikeys/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setRevokeId(null);
      showToast("API key revoked.");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/apikeys/${id}/permanent`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setDeleteId(null);
      showToast("API key permanently deleted.");
    },
  });

  const copyKey = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const active  = keys.filter(k => !k.revokedAt).length;
  const revoked = keys.filter(k => !!k.revokedAt).length;

  // suppress unused warning
  void newId;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] bg-black text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 font-[Manrope] text-sm font-bold animate-in slide-in-from-bottom-4">
          <MdCheckCircle className="text-[#6cf8bb] text-base" />
          {toast}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] overflow-hidden">
        <div className="px-8 py-6 border-b border-[#e5eeff] flex items-center justify-between">
          <div>
            <h2 className="text-[24px] font-serif font-semibold text-black">API Keys</h2>
            <p className="text-xs font-[Manrope] text-[#7c839b] mt-0.5">
              Issue keys for programmatic access to the Luxe Boutique API. Revoke any key instantly.
            </p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setNewKey(null); setCreateErr(null); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-all rounded-lg shadow">
            <MdAdd className="text-sm" />
            New Key
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 divide-x divide-[#f0f2ff] border-b border-[#e5eeff]">
          {[
            { label: "Total",   value: keys.length, icon: <MdKey />,          color: "text-black"     },
            { label: "Active",  value: active,       icon: <MdCheckCircle />, color: "text-[#006c49]" },
            { label: "Revoked", value: revoked,      icon: <MdBlock />,        color: "text-red-500"   },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 px-8 py-4">
              <div className={`text-xl ${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-[22px] font-serif font-bold text-black leading-none">{s.value}</p>
                <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Keys table */}
        {isLoading ? (
          <div className="py-16 flex items-center justify-center gap-3 text-[#7c839b] font-[Manrope]">
            <MdAutorenew className="animate-spin text-xl" /> Loading…
          </div>
        ) : keys.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-14 h-14 bg-[#f0f2ff] rounded-2xl flex items-center justify-center">
              <MdKeyOff className="text-2xl text-[#7c839b]" />
            </div>
            <div>
              <p className="font-serif text-[18px] font-semibold mb-1">No API keys yet</p>
              <p className="text-sm font-[Manrope] text-[#7c839b]">Create your first key to enable programmatic access.</p>
            </div>
            <button onClick={() => { setShowCreate(true); setNewKey(null); }}
              className="px-5 py-2.5 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-all rounded-lg flex items-center gap-2">
              <MdAdd className="text-sm" />
              Create First Key
            </button>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-8 py-3 bg-[#f8f9ff] border-b border-[#f0f2ff]">
              <div className="col-span-3  text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b]">Name</div>
              <div className="col-span-3  text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b]">Key Prefix</div>
              <div className="col-span-2  text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b]">Status</div>
              <div className="col-span-2  text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b]">Created</div>
              <div className="col-span-2  text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b]">Actions</div>
            </div>
            <div className="divide-y divide-[#f0f2ff]">
              {keys.map(k => {
                const isRevoked = !!k.revokedAt;
                return (
                  <div key={k.id} className={`grid grid-cols-12 gap-4 px-8 py-4 items-center hover:bg-[#fafbff] transition-colors ${isRevoked ? "opacity-55" : ""}`}>
                    {/* Name */}
                    <div className="col-span-3">
                      <p className="font-[Manrope] font-bold text-sm text-black truncate">{k.name}</p>
                      {k.createdBy && <p className="text-[10px] font-[Manrope] text-[#c6c6cd] mt-0.5">by {k.createdBy}</p>}
                    </div>
                    {/* Prefix */}
                    <div className="col-span-3">
                      <code className="text-xs font-mono bg-[#f0f2ff] px-2 py-1 rounded-md text-[#45464d]">
                        {k.keyPrefix}••••••••••••••••••••••••••••••••••••••••
                      </code>
                    </div>
                    {/* Status */}
                    <div className="col-span-2">
                      {isRevoked ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-[Manrope] font-bold bg-[#ffdad6] text-red-700">
                          <MdBlock className="text-[11px]" />
                          Revoked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-[Manrope] font-bold bg-[#e6f7f1] text-[#006c49]">
                          <MdCheckCircle className="text-[11px]" />
                          Active
                        </span>
                      )}
                    </div>
                    {/* Created */}
                    <div className="col-span-2">
                      <p className="text-xs font-[Manrope] text-[#7c839b]">{timeAgo(k.createdAt)}</p>
                      {k.lastUsedAt
                        ? <p className="text-[10px] font-[Manrope] text-[#c6c6cd] mt-0.5">Used {timeAgo(k.lastUsedAt)}</p>
                        : <p className="text-[10px] font-[Manrope] text-[#c6c6cd] mt-0.5">Never used</p>
                      }
                    </div>
                    {/* Actions */}
                    <div className="col-span-2 flex items-center gap-1">
                      {!isRevoked ? (
                        <button onClick={() => setRevokeId(k.id)}
                          title="Revoke key"
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 font-[Manrope] font-bold text-[10px] uppercase tracking-widest rounded-lg transition-all">
                          <MdBlock className="text-[12px]" />
                          Revoke
                        </button>
                      ) : (
                        <button onClick={() => setDeleteId(k.id)}
                          title="Delete permanently"
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#c6c6cd] text-[#7c839b] hover:bg-[#f0f2ff] font-[Manrope] font-bold text-[10px] uppercase tracking-widest rounded-lg transition-all">
                          <MdDelete className="text-[12px]" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Security note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
        <MdShield className="text-amber-600 text-xl mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-[Manrope] font-bold text-amber-800 mb-1">Security notice</p>
          <p className="text-[11px] font-[Manrope] text-amber-700 leading-relaxed">
            API keys grant full read/write access to the Luxe Boutique API. Never commit keys to source code or share them publicly.
            Revoke immediately if a key is suspected to be compromised — revocation takes effect instantly.
          </p>
        </div>
      </div>

      {/* ── Create Key Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-[0_24px_80px_rgba(15,23,42,0.2)] w-full max-w-md overflow-hidden">
            <div className="px-7 py-5 border-b border-[#e5eeff] flex items-center justify-between">
              <h2 className="font-serif text-[20px] font-semibold">
                {newKey ? "Key Created" : "New API Key"}
              </h2>
              <button onClick={() => { setShowCreate(false); setNewKey(null); setCreateErr(null); qc.invalidateQueries({ queryKey: ["api-keys"] }); }}
                className="w-8 h-8 rounded-full hover:bg-[#f0f2ff] flex items-center justify-center text-[#7c839b] hover:text-black transition-colors">
                <MdClose className="text-lg" />
              </button>
            </div>

            {newKey ? (
              <div className="p-7 space-y-5">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <MdWarning className="text-amber-600 text-base mt-0.5 shrink-0" />
                  <p className="text-[11px] font-[Manrope] text-amber-800 leading-relaxed">
                    <strong>Copy this key now.</strong> It will never be shown again after you close this dialog.
                  </p>
                </div>
                <div className="bg-[#f8f9ff] border border-[#e5eeff] rounded-xl p-4">
                  <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mb-2">Your API Key</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono text-[#006c49] break-all leading-relaxed">{newKey}</code>
                    <button onClick={copyKey}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-[Manrope] font-bold uppercase tracking-widest transition-all flex items-center gap-1 ${
                        copied ? "bg-[#006c49] text-white" : "border border-[#c6c6cd] hover:bg-[#f0f2ff]"
                      }`}>
                      {copied ? <MdCheck className="text-sm" /> : <MdContentCopy className="text-sm" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => { setShowCreate(false); setNewKey(null); qc.invalidateQueries({ queryKey: ["api-keys"] }); }}
                  className="w-full py-2.5 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase rounded-lg hover:bg-[#006c49] transition-all">
                  Done — I've saved my key
                </button>
              </div>
            ) : (
              <div className="p-7 space-y-5">
                <div>
                  <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">
                    Key Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Webhook Integration, Mobile App…"
                    className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-3 font-[Manrope] text-sm outline-none focus:border-black transition-colors"
                    onKeyDown={e => e.key === "Enter" && newName.trim() && createMut.mutate()}
                  />
                  <p className="mt-1.5 text-[11px] font-[Manrope] text-[#7c839b]">
                    Give it a name that describes where it will be used.
                  </p>
                </div>
                {createErr && (
                  <div className="p-3 bg-[#ffdad6] rounded-lg flex items-center gap-2">
                    <MdError className="text-red-600 text-sm" />
                    <p className="text-xs font-[Manrope] text-red-700 font-bold">{createErr}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => { setShowCreate(false); setCreateErr(null); }}
                    className="flex-1 py-2.5 border border-[#c6c6cd] font-[Manrope] font-bold text-xs tracking-widest uppercase rounded-lg hover:bg-[#f0f2ff] transition-all">
                    Cancel
                  </button>
                  <button onClick={() => createMut.mutate()} disabled={!newName.trim() || createMut.isPending}
                    className="flex-1 py-2.5 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase rounded-lg hover:bg-[#006c49] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {createMut.isPending
                      ? <><MdAutorenew className="text-sm animate-spin" /> Generating…</>
                      : <><MdKey className="text-sm" /> Generate Key</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Revoke Confirm ── */}
      {revokeId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-[0_24px_80px_rgba(15,23,42,0.2)] w-full max-w-sm p-7 space-y-5">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                <MdBlock className="text-2xl text-red-500" />
              </div>
              <div>
                <p className="font-serif text-[18px] font-semibold mb-1">Revoke this key?</p>
                <p className="text-sm font-[Manrope] text-[#7c839b] leading-relaxed">
                  Any system using this key will immediately lose access. This cannot be undone — you would need to create a new key.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRevokeId(null)}
                className="flex-1 py-2.5 border border-[#c6c6cd] font-[Manrope] font-bold text-xs tracking-widest uppercase rounded-lg hover:bg-[#f0f2ff] transition-all">
                Cancel
              </button>
              <button onClick={() => revokeMut.mutate(revokeId!)} disabled={revokeMut.isPending}
                className="flex-1 py-2.5 bg-red-600 text-white font-[Manrope] font-bold text-xs tracking-widest uppercase rounded-lg hover:bg-red-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {revokeMut.isPending
                  ? <><MdAutorenew className="text-sm animate-spin" /> Revoking…</>
                  : "Revoke Key"
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Permanent Delete Confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-[0_24px_80px_rgba(15,23,42,0.2)] w-full max-w-sm p-7 space-y-5">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                <MdDeleteForever className="text-2xl text-red-500" />
              </div>
              <div>
                <p className="font-serif text-[18px] font-semibold mb-1">Delete permanently?</p>
                <p className="text-sm font-[Manrope] text-[#7c839b] leading-relaxed">
                  This revoked key and all its records will be permanently removed from the database.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 border border-[#c6c6cd] font-[Manrope] font-bold text-xs tracking-widest uppercase rounded-lg hover:bg-[#f0f2ff] transition-all">
                Cancel
              </button>
              <button onClick={() => deleteMut.mutate(deleteId!)} disabled={deleteMut.isPending}
                className="flex-1 py-2.5 bg-red-600 text-white font-[Manrope] font-bold text-xs tracking-widest uppercase rounded-lg hover:bg-red-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {deleteMut.isPending
                  ? <><MdAutorenew className="text-sm animate-spin" /> Deleting…</>
                  : "Delete Forever"
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>("email");

  const [senderName,    setSenderName]    = useState("Luxe Boutique Concierge");
  const [senderEmail,   setSenderEmail]   = useState("");

  const [cloudName,    setCloudName]    = useState("");
  const [cloudApiKey,  setCloudApiKey]  = useState("");
  const [cloudSecret,  setCloudSecret]  = useState("");
  const [cloudPreset,  setCloudPreset]  = useState("");

  const [storeName,     setStoreName]     = useState("Luxe Boutique");
  const [storeEmail,    setStoreEmail]    = useState("");
  const [storeCurrency, setStoreCurrency] = useState("USD");
  const [storeTimezone, setStoreTimezone] = useState("UTC");
  const [storeSubdomain, setStoreSubdomain] = useState("");
  const [storeCustomDomain, setStoreCustomDomain] = useState("");
  const [storeIsPublished, setStoreIsPublished] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [savingDomain, setSavingDomain] = useState(false);

  const [brandPrimaryColor, setBrandPrimaryColor] = useState("#006c49");
  const [brandBgColor, setBrandBgColor] = useState("#0f172a");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandTypography, setBrandTypography] = useState("Georgia, serif");
  const [brandValetInstructions, setBrandValetInstructions] = useState("Complimentary valet parking is available at the main entrance.");
  const [brandHospitalityNotes, setBrandHospitalityNotes] = useState("Enjoy our signature champagne service upon your arrival.");

  // Payment gateway keys
  const [paystackPublicKey,      setPaystackPublicKey]      = useState("");
  const [paystackSecretKey,      setPaystackSecretKey]      = useState("");
  const [flutterwavePublicKey,   setFlutterwavePublicKey]   = useState("");
  const [flutterwaveSecretKey,   setFlutterwaveSecretKey]   = useState("");
  const [paypalClientId,         setPaypalClientId]         = useState("");
  const [paypalSecret,           setPaypalSecret]           = useState("");
  const [paypalMode,             setPaypalMode]             = useState("sandbox");
  const [paypalPayIn4,           setPaypalPayIn4]           = useState(true);

  // Marketing & Analytics & Fulfillment keys
  const [klaviyoApiKey,          setKlaviyoApiKey]          = useState("");
  const [klaviyoPublicListId,    setKlaviyoPublicListId]    = useState("");
  const [klaviyoSmsSender,       setKlaviyoSmsSender]       = useState("LUXE");
  const [ga4MeasurementId,       setGa4MeasurementId]       = useState("");
  const [ga4ApiSecret,           setGa4ApiSecret]           = useState("");
  const [dhlSiteId,              setDhlSiteId]              = useState("");
  const [dhlPassword,            setDhlPassword]            = useState("");
  const [dhlAccountNumber,       setDhlAccountNumber]       = useState("");
  const [dhlTestMode,            setDhlTestMode]            = useState(true);

  // Brand Logo Local Upload State
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    setUploadingLogo(true);
    setLogoUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload brand logo.");
      const uploadedUrl = data.url || (data.urls && data.urls[0]);
      if (uploadedUrl) {
        setBrandLogoUrl(uploadedUrl);
      } else {
        throw new Error("No URL returned from server.");
      }
    } catch (err: any) {
      setLogoUploadError(err.message || "Failed to upload brand logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleLogoUpload(e.dataTransfer.files[0]);
    }
  };

  const [testEmailResult,    setTestEmailResult]    = useState<{ ok: boolean; msg: string } | null>(null);
  const [testCloudResult,    setTestCloudResult]    = useState<{ ok: boolean; msg: string } | null>(null);
  const [testKlaviyoResult,  setTestKlaviyoResult]  = useState<{ ok: boolean; msg: string } | null>(null);
  const [savedSection,       setSavedSection]       = useState<Section | null>(null);
  const pendingSectionRef = useRef<Section | null>(null);

  const { data, isLoading, refetch } = useQuery<SettingsData>({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: domainData, refetch: refetchDomain } = useQuery({
    queryKey: ["tenant-domain"],
    queryFn: async () => {
      const res = await fetch("/api/settings/tenant-domain");
      if (!res.ok) throw new Error("Failed to load domain settings");
      return res.json() as Promise<{ slug: string; customDomain: string; isPublished: boolean }>;
    }
  });

  useEffect(() => {
    if (domainData) {
      setStoreSubdomain(domainData.slug || "");
      setStoreCustomDomain(domainData.customDomain || "");
      setStoreIsPublished(domainData.isPublished || false);
    }
  }, [domainData]);

  useEffect(() => {
    if (!data) return;
    const s = data.settings;
    setSenderName(s.sender_name ?? "Luxe Boutique Concierge");
    setSenderEmail(s.store_email ?? s.sender_email ?? "");
    setCloudName(s.cloudinary_cloud_name    ?? "");
    setCloudApiKey(s.cloudinary_api_key     ?? "");
    setCloudSecret(s.cloudinary_api_secret ? MASK : "");
    setCloudPreset(s.cloudinary_upload_preset ?? "");
    setStoreName(s.store_name     ?? "Luxe Boutique");
    setStoreEmail(s.store_email   ?? "");
    setStoreCurrency(s.store_currency ?? "USD");
    setStoreTimezone(s.store_timezone ?? "UTC");
    setBrandPrimaryColor(s.brand_primary_color ?? "#006c49");
    setBrandBgColor(s.brand_bg_color ?? "#0f172a");
    setBrandLogoUrl(s.brand_logo_url ?? "");
    setBrandTypography(s.brand_typography ?? "Georgia, serif");
    setBrandValetInstructions(s.brand_valet_instructions ?? "Complimentary valet parking is available at the main entrance.");
    setBrandHospitalityNotes(s.brand_hospitality_notes ?? "Enjoy our signature champagne service upon your arrival.");
    setPaystackPublicKey(s.paystack_public_key      ?? "");
    setPaystackSecretKey(s.paystack_secret_key ? MASK : "");
    setFlutterwavePublicKey(s.flutterwave_public_key  ?? "");
    setFlutterwaveSecretKey(s.flutterwave_secret_key ? MASK : "");
    setPaypalClientId(s.paypal_client_id ?? "");
    setPaypalSecret(s.paypal_secret ? MASK : "");
    setPaypalMode(s.paypal_mode ?? "sandbox");
    setPaypalPayIn4(s.paypal_pay_in_4 !== "false");
    setKlaviyoApiKey(s.klaviyo_api_key ? MASK : "");
    setKlaviyoPublicListId(s.klaviyo_public_list_id ?? "");
    setKlaviyoSmsSender(s.klaviyo_sms_sender_number ?? "LUXE");
    setGa4MeasurementId(s.ga4_measurement_id ?? "");
    setGa4ApiSecret(s.ga4_api_secret ? MASK : "");
    setDhlSiteId(s.dhl_site_id ?? "");
    setDhlPassword(s.dhl_password ? MASK : "");
    setDhlAccountNumber(s.dhl_account_number ?? "");
    setDhlTestMode(s.dhl_test_mode !== "false");
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Save failed");
    },
    onSuccess: () => {
      setSavedSection(pendingSectionRef.current);
      setTimeout(() => setSavedSection(null), 3000);
      refetch();
    },
  });

  const saveEmail = () => {
    pendingSectionRef.current = "email";
    saveMutation.mutate({
      sender_name: senderName,
      store_email: senderEmail,
      sender_email: senderEmail,
    });
    setTestEmailResult(null);
  };

  const saveStore = async () => {
    pendingSectionRef.current = "store";
    setDomainError(null);
    setSavingDomain(true);

    try {
      const res = await fetch("/api/settings/tenant-domain", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: storeSubdomain, customDomain: storeCustomDomain, isPublished: storeIsPublished }),
      });
      if (!res.ok) {
        const errData = await res.json();
        setDomainError(errData.error || "Failed to save domain details.");
        setSavingDomain(false);
        return;
      }
      refetchDomain();
    } catch (err: any) {
      setDomainError(err.message || "Failed to save domain details.");
      setSavingDomain(false);
      return;
    }

    setSavingDomain(false);
    saveMutation.mutate({
      store_name: storeName, store_email: storeEmail,
      store_currency: storeCurrency, store_timezone: storeTimezone,
    });
  };

  const saveBranding = () => {
    pendingSectionRef.current = "branding";
    saveMutation.mutate({
      brand_primary_color: brandPrimaryColor,
      brand_bg_color: brandBgColor,
      brand_logo_url: brandLogoUrl,
      brand_typography: brandTypography,
      brand_valet_instructions: brandValetInstructions,
      brand_hospitality_notes: brandHospitalityNotes,
    });
  };

  const testEmail = async () => {
    setTestEmailResult(null);
    try {
      const res = await fetch("/api/settings/test/email", { method: "POST" });
      const data = await res.json();
      if (res.ok) setTestEmailResult({ ok: true, msg: `Notification dispatched to ${data.sentTo}` });
      else setTestEmailResult({ ok: false, msg: data.error });
    } catch { setTestEmailResult({ ok: false, msg: "Connection failed" }); }
  };

  const testCloudinary = async () => {
    setTestCloudResult(null);
    try {
      const res = await fetch("/api/settings/test/cloudinary", { method: "POST" });
      const data = await res.json();
      if (res.ok) setTestCloudResult({ ok: true, msg: `Connected to cloud "${data.cloudName}"` });
      else setTestCloudResult({ ok: false, msg: data.error });
    } catch { setTestCloudResult({ ok: false, msg: "Connection failed" }); }
  };

  const testKlaviyoSms = async () => {
    setTestKlaviyoResult(null);
    try {
      const res = await fetch("/api/marketing/klaviyo/test-sms", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) setTestKlaviyoResult({ ok: true, msg: data.message });
      else setTestKlaviyoResult({ ok: false, msg: data.error || "SMS test dispatch failed" });
    } catch { setTestKlaviyoResult({ ok: false, msg: "Connection failed" }); }
  };

  const cloud = data?.status.cloudinaryConfigured ?? false;

  const paystackConfigured     = !!(data?.settings.paystack_secret_key && data?.settings.paystack_public_key);
  const flutterwaveConfigured  = !!(data?.settings.flutterwave_secret_key && data?.settings.flutterwave_public_key);
  const paypalConfigured       = !!(data?.settings.paypal_client_id);
  const paymentsConfigured     = paystackConfigured || flutterwaveConfigured || paypalConfigured;
  const klaviyoConfigured      = !!(data?.settings.klaviyo_api_key);
  const ga4Configured          = !!(data?.settings.ga4_measurement_id);
  const dhlConfigured          = !!(data?.settings.dhl_site_id && data?.settings.dhl_account_number);

  const sections: { key: Section; icon: any; label: string; ok: boolean; group?: string }[] = [
    { key: "email",      icon: <MdMail />,          label: "Email & Notifications", ok: true,              group: "Core"     },
    { key: "cloudinary", icon: <MdCloudUpload />,   label: "Media Storage",    ok: cloud,             group: "Core"     },
    { key: "store",      icon: <MdStorefront />,     label: "General Store",    ok: true,              group: "Core"     },
    { key: "branding",   icon: <MdPalette />,       label: "Boutique Branding",ok: true,              group: "Core"     },
    { key: "payments",   icon: <MdCreditCard />,    label: "Payments & PayPal", ok: paymentsConfigured, group: "Core"    },
    { key: "klaviyo",    icon: <MdCampaign />,      label: "Klaviyo VIP & SMS", ok: klaviyoConfigured, group: "Growth"   },
    { key: "ga4",        icon: <SiGoogleanalytics />,label: "Google Analytics 4", ok: ga4Configured, group: "Growth"   },
    { key: "dhl",        icon: <SiDhl />,           label: "DHL Express Logistics", ok: dhlConfigured, group: "Growth"   },
    { key: "facebook",   icon: <MdPublic />,         label: "Meta / Facebook",  ok: false,             group: "Channels" },
    { key: "twitter",    icon: <MdAlternateEmail />,label: "X (Twitter)",      ok: false,             group: "Channels" },
    { key: "whatsapp",   icon: <MdChatBubble />,    label: "WhatsApp",         ok: false,             group: "Channels" },
    { key: "apikeys",    icon: <MdKey />,            label: "API Keys",         ok: true,              group: "Security" },
  ];

  return (
    <AdminLayout sidebar="main">
      <div className="p-4 sm:p-8 bg-[#f8f9ff] min-h-screen">

        {/* Header */}
        <div className="mb-10">
          <p className="text-[11px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mb-2">Admin</p>
          <h1 className="text-3xl sm:text-5xl font-serif font-bold leading-tight text-black">Settings</h1>
          <p className="text-sm font-[Manrope] text-[#45464d] mt-1">Configure integrations and preferences. All values are stored securely in your database.</p>
        </div>

        <div className="grid grid-cols-12 gap-6">

          {/* Sidebar nav */}
          <div className="col-span-12 lg:col-span-3">
            <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] p-2 sm:p-3 flex lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1 scrollbar-hide">
              {["Core", "Growth", "Channels", "Security"].map(group => (
                <div key={group} className="flex lg:flex-col shrink-0">
                  <p className="hidden lg:block text-[9px] font-[Manrope] font-bold uppercase tracking-widest text-[#c6c6cd] px-4 pt-3 pb-1">{group}</p>
                  <div className="flex lg:flex-col gap-1">
                    {sections.filter(s => s.group === group).map(s => (
                      <button key={s.key} onClick={() => setActiveSection(s.key)}
                        className={`whitespace-nowrap flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-all text-left ${
                          activeSection === s.key
                            ? "bg-black text-white"
                            : "text-[#45464d] hover:bg-[#f8f9ff]"
                        }`}>
                        <div className="text-base sm:text-lg shrink-0">{s.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] sm:text-xs font-[Manrope] font-bold">{s.label}</p>
                        </div>
                        <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${s.ok ? "bg-[#006c49]" : "bg-[#c6c6cd]"}`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 p-4 bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] hidden lg:block">
              <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mb-3">Storage</p>
              <div className="flex items-start gap-2">
                <MdStorage className="text-[#006c49] text-base mt-0.5 shrink-0" />
                <p className="text-[11px] font-[Manrope] text-[#45464d] leading-relaxed">
                  All credentials are saved directly to your database — no environment variables needed.
                </p>
              </div>
            </div>
          </div>

          {/* Main panel */}
          <div className="col-span-12 lg:col-span-9">

            {isLoading ? (
              <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] flex items-center justify-center py-32 gap-3 text-[#7c839b]">
                <MdAutorenew className="animate-spin text-2xl" />
                <span className="font-[Manrope] text-sm">Loading settings…</span>
              </div>
            ) : (

              <>
                {/* ── Email & Notifications ── */}
                {activeSection === "email" && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] overflow-hidden">
                      <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-[#e5eeff] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h2 className="text-[20px] sm:text-[24px] font-serif font-semibold text-black">Email &amp; Notifications</h2>
                          <p className="text-[11px] sm:text-xs font-[Manrope] text-[#7c839b] mt-0.5">Configure store notification dispatch and Google Workspace integrations.</p>
                        </div>
                        <StatusBadge ok={true} label="Active" />
                      </div>

                      <div className="p-4 sm:p-8 space-y-6">
                        {/* Google Workspace highlight card */}
                        <div className="p-4 sm:p-5 bg-[#e6f7f1]/60 border border-[#006c49]/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#006c49] text-white flex items-center justify-center shrink-0">
                              <MdMarkEmailRead className="text-xl" />
                            </div>
                            <div>
                              <p className="text-sm font-[Manrope] font-bold text-[#006c49]">Google Workspace (Sheets, Drive, Gmail &amp; Contacts)</p>
                              <p className="text-[11px] sm:text-xs font-[Manrope] text-[#45464d] mt-0.5 leading-relaxed">
                                Live inventory &amp; sales spreadsheets, Drive brand vault &amp; receipt archiving, VIP contacts, and high-touch Gmail concierge.
                              </p>
                            </div>
                          </div>
                          <Link href="/channels/google-workspace"
                            className="shrink-0 px-4 py-2 bg-black text-white text-[10px] font-[Manrope] font-bold tracking-widest uppercase rounded-lg hover:bg-[#006c49] transition-all flex items-center gap-1.5 self-start sm:self-center">
                            <span>Open Workspace Hub</span>
                            <MdArrowForward className="text-sm" />
                          </Link>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                          <Field
                            label="Sender Display Name"
                            value={senderName}
                            onChange={setSenderName}
                            placeholder="Luxe Boutique Concierge"
                            hint="Name shown on outbound customer messages and receipts."
                          />
                          <Field
                            label="Store Notification / Sender Email"
                            value={senderEmail}
                            onChange={setSenderEmail}
                            placeholder="concierge@luxeboutique.com"
                            hint="Address used for system dispatches and order alerts."
                          />
                        </div>

                        {testEmailResult && (
                          <div className={`p-4 rounded-lg flex items-center gap-3 ${
                            testEmailResult.ok ? "bg-[#e6f7f1] text-[#006c49]" : "bg-[#ffdad6] text-[#ba1a1a]"
                          }`}>
                            {testEmailResult.ok ? <MdCheckCircle className="text-lg" /> : <MdError className="text-lg" />}
                            <p className="text-sm font-[Manrope] font-bold">{testEmailResult.msg}</p>
                          </div>
                        )}
                      </div>

                      <div className="px-4 sm:px-8 py-5 border-t border-[#e5eeff] bg-[#f8f9ff] flex flex-col sm:flex-row items-center justify-between gap-4">
                        <button onClick={testEmail}
                          className="w-full sm:w-auto px-5 py-2 border border-[#c6c6cd] font-[Manrope] font-bold text-[10px] tracking-widest uppercase hover:bg-white transition-all rounded-lg flex items-center justify-center gap-2">
                          <MdSend className="text-sm" />
                          Test Notification
                        </button>
                        <button onClick={saveEmail} disabled={saveMutation.isPending}
                          className="w-full sm:w-auto px-8 py-2.5 bg-black text-white font-[Manrope] font-bold text-[10px] tracking-widest uppercase hover:bg-[#006c49] transition-all rounded-lg shadow disabled:opacity-60 flex items-center justify-center gap-2">
                          {saveMutation.isPending
                            ? <><MdAutorenew className="text-sm animate-spin" /> Saving…</>
                            : savedSection === "email"
                              ? <><MdCheck className="text-sm" /> Saved!</>
                              : "Save Changes"
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Cloudinary ── */}
                {activeSection === "cloudinary" && (
                  <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] overflow-hidden">
                    <div className="px-8 py-6 border-b border-[#e5eeff] flex items-center justify-between">
                      <div>
                        <h2 className="text-[24px] font-serif font-semibold text-black">Media Storage</h2>
                        <p className="text-xs font-[Manrope] text-[#7c839b] mt-0.5">Cloudinary is used to host product images, banners, and all media assets.</p>
                      </div>
                      <StatusBadge ok={cloud} label="" />
                    </div>

                    <div className="p-8">
                      <div className="p-5 bg-[#f8f9ff] border border-[#e5eeff] rounded-xl flex items-start gap-4">
                        <MdShield className="text-[#006c49] text-2xl mt-0.5 shrink-0" />
                        <div className="space-y-1">
                          <p className="text-sm font-[Manrope] font-bold text-black">Managed via Platform Environment Variables</p>
                          <p className="text-xs font-[Manrope] text-[#7c839b] leading-relaxed">
                            Cloudinary credentials (Cloud Name, API Key, and Secret) are managed via server-side environment variables in this CaaS environment. 
                            Manual overrides are disabled for security.
                          </p>
                        </div>
                      </div>

                      {testCloudResult && (
                        <div className={`mt-6 p-4 rounded-lg flex items-center gap-3 ${
                          testCloudResult.ok ? "bg-[#e6f7f1] text-[#006c49]" : "bg-[#ffdad6] text-[#ba1a1a]"
                        }`}>
                          {testCloudResult.ok ? <MdCheckCircle className="text-lg" /> : <MdError className="text-lg" />}
                          <p className="text-sm font-[Manrope] font-bold">{testCloudResult.msg}</p>
                        </div>
                      )}
                    </div>

                    <div className="px-8 py-5 border-t border-[#e5eeff] bg-[#f8f9ff] flex items-center justify-start">
                      <button onClick={testCloudinary}
                        className="px-5 py-2 border border-[#c6c6cd] font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-white transition-all rounded-lg flex items-center gap-2">
                        <MdWifiTethering className="text-sm" />
                        Test Connection
                      </button>
                    </div>
                  </div>
                )}

                {/* ── General Store ── */}
                {activeSection === "store" && (
                  <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] overflow-hidden">
                    <div className="px-8 py-6 border-b border-[#e5eeff]">
                      <h2 className="text-[24px] font-serif font-semibold text-black">General Store</h2>
                      <p className="text-xs font-[Manrope] text-[#7c839b] mt-0.5">Basic information shown across your store and emails.</p>
                    </div>

                    <div className="p-8 space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                          <Field label="Store Name" value={storeName} onChange={setStoreName} placeholder="Luxe Boutique" />
                        </div>
                        <div className="sm:col-span-2">
                          <Field label="Contact / Reply-To Email" value={storeEmail} onChange={setStoreEmail}
                            placeholder="hello@yourdomain.com" hint="Shown in footers and support replies." />
                        </div>
                        <div>
                          <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">Currency</label>
                          <select value={storeCurrency} onChange={e => setStoreCurrency(e.target.value)}
                            className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-3 font-[Manrope] text-sm outline-none focus:border-black transition-colors">
                            {["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "SGD", "NGN", "GHS", "KES", "ZAR"].map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">Timezone</label>
                          <select value={storeTimezone} onChange={e => setStoreTimezone(e.target.value)}
                            className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-3 font-[Manrope] text-sm outline-none focus:border-black transition-colors">
                            {[
                              "UTC", "America/New_York", "America/Chicago", "America/Denver",
                              "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin",
                              "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo",
                              "Africa/Lagos", "Africa/Nairobi", "Africa/Johannesburg", "Australia/Sydney",
                            ].map(tz => <option key={tz} value={tz}>{tz}</option>)}
                          </select>
                        </div>
                        <div className="sm:col-span-2 border-t border-[#e5eeff] pt-5">
                          <h3 className="text-sm font-serif font-bold text-black mb-1">Storefront Publication Status</h3>
                          <p className="text-xs font-[Manrope] text-[#7c839b] mb-4">Control whether your storefront is visible to the public or in Private Preview.</p>
                          
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#f8f9ff] border border-[#e5eeff] rounded-xl mb-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {storeIsPublished ? (
                                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-[Manrope] bg-green-50 text-green-700 border border-green-200">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                    Live / Public
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-[Manrope] bg-[#fff8eb] text-[#b25e00] border border-[#ffe0b2]">
                                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                                    Private / Unpublished
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 max-w-md font-[Manrope]">
                                {storeIsPublished 
                                  ? "Your storefront is publicly accessible. Anyone with the URL or your custom domain can view and purchase from your store." 
                                  : "Your storefront is restricted. Only logged-in administrators can preview and customize your storefront."}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <a href="/" target="_blank" rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-white border border-[#c6c6cd] text-slate-700 rounded-lg text-xs font-semibold font-[Manrope] hover:bg-slate-50 transition-all flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Launch Preview
                              </a>
                              
                              <button type="button" onClick={() => setStoreIsPublished(!storeIsPublished)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold font-[Manrope] tracking-wide transition-all border ${
                                  storeIsPublished 
                                    ? "bg-[#ffdad6] hover:bg-[#ffb4ab] text-[#ba1a1a] border-[#ffb4ab]" 
                                    : "bg-black hover:bg-[#006c49] text-white border-black hover:border-[#006c49]"
                                }`}>
                                {storeIsPublished ? "Unpublish Store" : "Publish Storefront"}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="sm:col-span-2 border-t border-[#e5eeff] pt-5">
                          <h3 className="text-sm font-serif font-bold text-black mb-1">SaaS Domain Mapping</h3>
                          <p className="text-xs font-[Manrope] text-[#7c839b] mb-4">Configure how customers locate your boutique online.</p>
                        </div>
                        <div className="sm:col-span-2">
                          <Field label="SaaS Platform Subdomain" value={storeSubdomain} onChange={setStoreSubdomain}
                            placeholder="my-boutique" hint="Your default store URL will be: https://[subdomain].yourplatform.com" />
                        </div>
                        <div className="sm:col-span-2">
                          <Field label="Custom Domain" value={storeCustomDomain} onChange={setStoreCustomDomain}
                            placeholder="www.myboutique.com" hint="Configure your DNS record (A / CNAME) to route custom traffic here." />
                        </div>
                      </div>

                      {domainError && (
                        <div className="mt-5 p-4 bg-[#ffdad6] text-[#ba1a1a] rounded-lg text-xs font-[Manrope] font-semibold flex items-center gap-2">
                          <MdError className="text-sm shrink-0" />
                          <span>{domainError}</span>
                        </div>
                      )}
                    </div>

                    <div className="px-8 py-5 border-t border-[#e5eeff] bg-[#f8f9ff] flex justify-end">
                      <button onClick={saveStore} disabled={saveMutation.isPending}
                        className="px-8 py-2.5 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-all rounded-lg shadow disabled:opacity-60 flex items-center gap-2">
                        {saveMutation.isPending
                          ? <><MdAutorenew className="text-sm animate-spin" /> Saving…</>
                          : savedSection === "store"
                            ? <><MdCheck className="text-sm" /> Saved!</>
                            : "Save Changes"
                        }
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Boutique Branding Customizer ── */}
                {activeSection === "branding" && (
                  <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] overflow-hidden">
                    <div className="px-8 py-6 border-b border-[#e5eeff] flex justify-between items-center bg-white">
                      <div>
                        <h2 className="text-[24px] font-serif font-semibold text-black">Boutique Branding</h2>
                        <p className="text-xs font-[Manrope] text-[#7c839b] mt-0.5">Customize your luxury aesthetic. These styles dynamically apply across your store, emails, and apps.</p>
                      </div>
                      <MdPalette className="text-3xl text-[#006c49]" />
                    </div>

                    <div className="p-8 space-y-8">
                      {/* Visual Palette Controls */}
                      <div>
                        <h3 className="text-sm font-[Manrope] font-bold text-black uppercase tracking-widest mb-4">Luxury Aesthetic Palette</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          
                          {/* Primary Accent Color */}
                          <div className="p-4 rounded-xl border border-[#e5eeff] bg-[#f8f9ff]">
                            <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">Primary Brand Accent</label>
                            <div className="flex items-center gap-3">
                              <input type="color" value={brandPrimaryColor} onChange={e => setBrandPrimaryColor(e.target.value)}
                                className="w-12 h-12 rounded-lg border border-[#c6c6cd] cursor-pointer bg-transparent outline-none" />
                              <div className="flex-1">
                                <input type="text" value={brandPrimaryColor} onChange={e => setBrandPrimaryColor(e.target.value)}
                                  className="w-full bg-white border border-[#c6c6cd] rounded-lg px-3 py-1.5 font-mono text-xs text-black outline-none focus:border-black transition-colors" />
                                <span className="text-[10px] font-[Manrope] text-[#7c839b] mt-1 block">Used for links, buttons, and visual highlights.</span>
                              </div>
                            </div>
                          </div>

                          {/* Canvas Background Color */}
                          <div className="p-4 rounded-xl border border-[#e5eeff] bg-[#f8f9ff]">
                            <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">Canvas Luxury Background</label>
                            <div className="flex items-center gap-3">
                              <input type="color" value={brandBgColor} onChange={e => setBrandBgColor(e.target.value)}
                                className="w-12 h-12 rounded-lg border border-[#c6c6cd] cursor-pointer bg-transparent outline-none" />
                              <div className="flex-1">
                                <input type="text" value={brandBgColor} onChange={e => setBrandBgColor(e.target.value)}
                                  className="w-full bg-white border border-[#c6c6cd] rounded-lg px-3 py-1.5 font-mono text-xs text-black outline-none focus:border-black transition-colors" />
                                <span className="text-[10px] font-[Manrope] text-[#7c839b] mt-1 block">Luxury backdrop canvas used behind store products.</span>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Font Family & Logo */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">Typography Font Family</label>
                          <select value={brandTypography} onChange={e => setBrandTypography(e.target.value)}
                            className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-3 font-[Manrope] text-sm outline-none focus:border-black transition-colors">
                            <option value="Georgia, serif">Georgia (Classic Serene)</option>
                            <option value="'Playfair Display', serif">Playfair Display (Premium Luxury)</option>
                            <option value="'Cinzel', serif">Cinzel (Imperial Elegance)</option>
                            <option value="'Cormorant Garamond', serif">Cormorant Garamond (Editorial Chic)</option>
                            <option value="system-ui, sans-serif">Modern Minimalist (Sans-Serif)</option>
                          </select>
                          <span className="text-[10px] font-[Manrope] text-[#7c839b] mt-1 block">Select your signature serif or clean display typography.</span>
                        </div>

                        <div>
                          <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">
                            Brand Logo Image
                          </label>
                          <input
                            type="file"
                            ref={logoInputRef}
                            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/avif"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleLogoUpload(e.target.files[0]);
                              }
                            }}
                          />

                          {/* Preview or Dropzone */}
                          {brandLogoUrl ? (
                            <div className="p-4 rounded-xl border border-[#e5eeff] bg-[#f8f9ff] flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-16 h-16 rounded-lg border border-[#c6c6cd] bg-white p-2 flex items-center justify-center shrink-0">
                                  <img
                                    src={brandLogoUrl}
                                    alt="Brand Logo Preview"
                                    className="max-h-full max-w-full object-contain"
                                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-[Manrope] font-bold text-black truncate">
                                    Current Brand Logo
                                  </p>
                                  <p className="text-[10px] font-mono text-[#7c839b] truncate">
                                    {brandLogoUrl}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => logoInputRef.current?.click()}
                                  disabled={uploadingLogo}
                                  className="px-3 py-1.5 border border-[#c6c6cd] font-[Manrope] font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-white transition-all flex items-center gap-1.5"
                                >
                                  {uploadingLogo ? (
                                    <MdAutorenew className="animate-spin text-sm" />
                                  ) : (
                                    <MdCloudUpload className="text-sm text-[#006c49]" />
                                  )}
                                  Change
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setBrandLogoUrl("")}
                                  className="p-1.5 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
                                  title="Remove logo"
                                >
                                  <MdDelete className="text-sm" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onDragOver={(e) => { e.preventDefault(); setIsDraggingLogo(true); }}
                              onDragLeave={() => setIsDraggingLogo(false)}
                              onDrop={handleLogoDrop}
                              onClick={() => logoInputRef.current?.click()}
                              className={`p-6 border-2 border-dashed rounded-xl cursor-pointer text-center transition-all ${
                                isDraggingLogo
                                  ? "border-[#006c49] bg-[#e6f7f1]"
                                  : "border-[#c6c6cd] hover:border-black bg-[#f8f9ff]"
                              }`}
                            >
                              <div className="w-10 h-10 rounded-full bg-[#f0f2ff] text-[#006c49] mx-auto flex items-center justify-center mb-2">
                                {uploadingLogo ? (
                                  <MdAutorenew className="text-xl animate-spin" />
                                ) : (
                                  <MdCloudUpload className="text-xl" />
                                )}
                              </div>
                              <p className="text-xs font-[Manrope] font-bold text-black mb-1">
                                {uploadingLogo
                                  ? "Uploading Brand Logo..."
                                  : "Click or Drag & Drop local logo image file"}
                              </p>
                              <p className="text-[10px] font-[Manrope] text-[#7c839b]">
                                Supports PNG, JPG, WEBP, SVG or AVIF (Up to 20MB)
                              </p>
                            </div>
                          )}

                          {logoUploadError && (
                            <p className="mt-1.5 text-[11px] font-[Manrope] font-bold text-red-600 flex items-center gap-1">
                              <MdError className="text-sm shrink-0" />
                              {logoUploadError}
                            </p>
                          )}

                          {/* Manual URL input fallback */}
                          <div className="mt-3">
                            <label className="text-[9px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] block mb-1">
                              Or enter direct Logo URL
                            </label>
                            <input
                              type="text"
                              value={brandLogoUrl}
                              onChange={(e) => setBrandLogoUrl(e.target.value)}
                              placeholder="https://example.com/logo.png"
                              className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-3 py-2 font-[Manrope] text-xs text-black outline-none focus:border-black transition-colors"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Hospitality & Valet Copy blocks */}
                      <div>
                        <h3 className="text-sm font-[Manrope] font-bold text-black uppercase tracking-widest mb-4">Concierge & Pre-arrival Guest Experience</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">Valet & Parking Copy Block</label>
                            <textarea value={brandValetInstructions} onChange={e => setBrandValetInstructions(e.target.value)}
                              rows={2} placeholder="Complimentary valet parking is available..."
                              className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg p-3 font-[Manrope] text-xs outline-none focus:border-black transition-colors" />
                            <span className="text-[10px] font-[Manrope] text-[#7c839b] mt-1 block">Injected automatically into the Gmail Concierge pre-arrival section.</span>
                          </div>

                          <div>
                            <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">Signature Hospitality & Champagne Notes</label>
                            <textarea value={brandHospitalityNotes} onChange={e => setBrandHospitalityNotes(e.target.value)}
                              rows={2} placeholder="Enjoy our signature champagne service..."
                              className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg p-3 font-[Manrope] text-xs outline-none focus:border-black transition-colors" />
                            <span className="text-[10px] font-[Manrope] text-[#7c839b] mt-1 block">Shown under pre-booking amenities and in invitation footprints.</span>
                          </div>
                        </div>
                      </div>

                      {/* Dynamic Live Preview Panel */}
                      <div className="p-6 rounded-xl border border-[#d6e4ff] bg-[#eff4ff] space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-[Manrope] font-bold text-black uppercase tracking-wider">Live Invitation Mockup Preview</h4>
                          <span className="text-[10px] font-[Manrope] font-bold text-[#006c49] bg-[#e6f7f1] px-2 py-0.5 rounded-full">REAL-TIME PREVIEW</span>
                        </div>
                        
                        <div className="bg-white border border-[#e5eeff] rounded-lg p-6 shadow-sm font-serif animate-fade-in" style={{ fontFamily: brandTypography }}>
                          <div className="flex items-center justify-between border-b border-[#f0f2ff] pb-4 mb-4">
                            {brandLogoUrl ? (
                              <img src={brandLogoUrl} alt="Logo" className="h-8 object-contain" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                            ) : (
                              <span className="text-lg font-bold tracking-widest text-black" style={{ color: brandPrimaryColor }}>{storeName.toUpperCase()}</span>
                            )}
                            <span className="text-xs font-[Manrope] uppercase text-[#7c839b] tracking-wider">VIP Concierge</span>
                          </div>

                          <h5 className="text-xl font-bold text-black mb-2">Your Styling Consultation is Scheduled</h5>
                          <p className="text-xs font-[Manrope] text-[#45464d] leading-relaxed mb-4">
                            We are delighted to welcome you to <strong>{storeName}</strong>. Below are your dynamic pre-arrival styling itinerary details.
                          </p>

                          <div className="p-4 rounded-lg border-l-4 mb-4" style={{ borderColor: brandPrimaryColor, backgroundColor: "#fcfcfd" }}>
                            <p className="text-xs font-[Manrope] text-black">
                              🚗 <strong>Valet details:</strong> {brandValetInstructions}
                            </p>
                          </div>

                          <div className="p-4 rounded-lg border-l-4 mb-4" style={{ borderColor: brandPrimaryColor, backgroundColor: "#fcfcfd" }}>
                            <p className="text-xs font-[Manrope] text-black">
                              🥂 <strong>Amenities:</strong> {brandHospitalityNotes}
                            </p>
                          </div>

                          <button className="px-6 py-2.5 text-white font-[Manrope] font-bold text-[10px] uppercase tracking-widest rounded-lg shadow-sm transition-all block w-full text-center"
                            style={{ backgroundColor: brandPrimaryColor }}>
                            Join Styling Session (Google Meet)
                          </button>
                        </div>
                      </div>

                    </div>

                    <div className="px-8 py-5 border-t border-[#e5eeff] bg-[#f8f9ff] flex justify-end">
                      <button onClick={saveBranding} disabled={saveMutation.isPending}
                        className="px-8 py-2.5 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-all rounded-lg shadow disabled:opacity-60 flex items-center gap-2">
                        {saveMutation.isPending
                          ? <><MdAutorenew className="text-sm animate-spin" /> Saving…</>
                          : savedSection === "branding"
                            ? <><MdCheck className="text-sm" /> Saved!</>
                            : "Save Branding Copy & Styles"
                        }
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Payments ── */}
                {activeSection === "payments" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-[#eff4ff] border border-[#d6e4ff] rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <MdCreditCard className="text-[#006c49] text-xl shrink-0" />
                        <p className="text-xs font-[Manrope] text-[#45464d]">
                          Payment gateways and processors are also available under the dedicated <strong>Providers Hub</strong>.
                        </p>
                      </div>
                      <Link href="/providers">
                        <button className="shrink-0 px-4 py-1.5 bg-black text-white font-[Manrope] font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#006c49] transition-all flex items-center gap-1.5">
                          <span>Open Providers Hub →</span>
                        </button>
                      </Link>
                    </div>
                    <PaymentSettingsManager />
                  </div>
                )}

                {/* ── Meta / Facebook ── */}
                {activeSection === "facebook" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-[#eff4ff] rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <MdInfo className="text-[#006c49] text-xl" />
                        <p className="text-xs font-[Manrope] text-[#45464d]">
                          These credentials are also used by the <strong>Meta & Facebook Manager</strong> channel page.
                        </p>
                      </div>
                      <Link href="/channels/facebook">
                        <button className="shrink-0 px-4 py-1.5 border border-[#c6c6cd] font-[Manrope] font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-white transition-all">
                          Open Channel →
                        </button>
                      </Link>
                    </div>
                    <ChannelCredsPanel
                      channel="facebook"
                      icon={<MdPublic />}
                      title="Meta / Facebook"
                      description="Page posts, Pixel events, catalog sync, and ad attribution."
                      fields={[
                        { key: "catalog_id",        label: "Commerce Catalog ID",  isSecret: false, hint: "Facebook Commerce Manager → Catalog → Settings → Catalog ID." },
                        { key: "app_id",             label: "App ID",               isSecret: false, hint: "Meta for Developers → App Dashboard → App ID." },
                        { key: "app_secret",         label: "App Secret",           isSecret: true,  hint: "App Dashboard → Settings → Basic → App Secret." },
                        { key: "page_access_token",  label: "Page Access Token",    isSecret: true,  hint: "Graph API Explorer → generate a long-lived page token for your Page." },
                        { key: "pixel_id",           label: "Pixel ID",             isSecret: false, hint: "Events Manager → Data Sources → your Pixel → Pixel ID." },
                        { key: "ad_account_id",      label: "Ad Account ID",        isSecret: false, hint: "Meta Business Manager → Ad Accounts (format: act_XXXXXXXXX)." },
                      ]}
                    />
                  </div>
                )}

                {/* ── X (Twitter) ── */}
                {activeSection === "twitter" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-[#eff4ff] rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <MdInfo className="text-[#006c49] text-xl" />
                        <p className="text-xs font-[Manrope] text-[#45464d]">
                          These credentials are also used by the <strong>X (Twitter) Settings</strong> channel page.
                        </p>
                      </div>
                      <Link href="/channels/twitter">
                        <button className="shrink-0 px-4 py-1.5 border border-[#c6c6cd] font-[Manrope] font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-white transition-all">
                          Open Channel →
                        </button>
                      </Link>
                    </div>
                    <ChannelCredsPanel
                      channel="twitter"
                      icon={<MdAlternateEmail />}
                      title="X (Twitter)"
                      description="Tweet scheduling, auto-post rules, and product drop announcements."
                      fields={[
                        { key: "api_key",             label: "API Key (Consumer Key)",       isSecret: false, hint: "developer.x.com → Your App → Keys & Tokens → API Key." },
                        { key: "api_secret",          label: "API Secret (Consumer Secret)", isSecret: true,  hint: "developer.x.com → Your App → Keys & Tokens → API Secret." },
                        { key: "bearer_token",        label: "Bearer Token",                 isSecret: true,  hint: "Used for App-only read-only API v2 access." },
                        { key: "access_token",        label: "Access Token",                 isSecret: false, hint: "Authorises API calls on behalf of your @luxeboutique X account." },
                        { key: "access_token_secret", label: "Access Token Secret",          isSecret: true,  hint: "Paired with the Access Token. Regenerate if compromised." },
                      ]}
                    />
                  </div>
                )}

                {/* ── WhatsApp ── */}
                {activeSection === "whatsapp" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-[#eff4ff] rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <MdInfo className="text-[#006c49] text-xl" />
                        <p className="text-xs font-[Manrope] text-[#45464d]">
                          These credentials are also used by the <strong>WhatsApp API Console</strong> channel page.
                        </p>
                      </div>
                      <Link href="/channels/whatsapp">
                        <button className="shrink-0 px-4 py-1.5 border border-[#c6c6cd] font-[Manrope] font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-white transition-all">
                          Open Channel →
                        </button>
                      </Link>
                    </div>
                    <ChannelCredsPanel
                      channel="whatsapp"
                      icon={<MdChatBubble />}
                      title="WhatsApp Cloud API"
                      description="Message templates, automated journeys, and subscriber opt-in flows."
                      fields={[
                        { key: "phone_number_id",     label: "Cloud API Phone Number ID",    isSecret: false, hint: "WhatsApp Business Platform → Phone Numbers → Phone Number ID." },
                        { key: "waba_id",             label: "WhatsApp Business Account ID", isSecret: false, hint: "Meta Business Manager → WhatsApp Accounts → Account ID." },
                        { key: "system_access_token", label: "System Access Token",          isSecret: true,  hint: "Meta Business Manager → System Users → Generate Token (never-expiring recommended)." },
                        { key: "webhook_verify_token",label: "Webhook Verify Token",         isSecret: true,  hint: "A secret string you choose — enter the same value in the Meta webhook configuration." },
                      ]}
                    />
                  </div>
                )}

                {/* ── Klaviyo VIP & SMS ── */}
                {activeSection === "klaviyo" && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] overflow-hidden">
                      <div className="px-8 py-5 border-b border-[#e5eeff] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-[#006c49]/10 flex items-center justify-center">
                            <MdCampaign className="text-[#006c49] text-xl" />
                          </div>
                          <div>
                            <h3 className="font-serif text-[20px] font-semibold text-black">Klaviyo VIP Marketing &amp; SMS</h3>
                            <p className="text-xs font-[Manrope] text-[#7c839b]">VIP client list synchronization, private sale drops, and SMS marketing concierge.</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-[Manrope] font-bold uppercase tracking-widest ${
                          klaviyoConfigured ? "bg-[#e6f7f1] text-[#006c49]" : "bg-gray-100 text-gray-500"
                        }`}>
                          {klaviyoConfigured ? "Connected" : "Not Connected"}
                        </span>
                      </div>
                    <div className="p-8 space-y-6">
                      <div className="p-5 bg-[#f8f9ff] border border-[#e5eeff] rounded-xl flex items-start gap-4">
                        <MdShield className="text-[#006c49] text-2xl mt-0.5 shrink-0" />
                        <div className="space-y-1">
                          <p className="text-sm font-[Manrope] font-bold text-black">Managed via Platform Environment Variables</p>
                          <p className="text-xs font-[Manrope] text-[#7c839b] leading-relaxed">
                            Klaviyo API credentials and list IDs are managed via server-side environment variables in this CaaS environment.
                          </p>
                        </div>
                      </div>
                      <div className="px-8 py-4 border-t border-[#e5eeff] bg-[#f8f9ff] flex flex-wrap items-center justify-between gap-4">
                        <a href="https://www.klaviyo.com/settings/api-keys" target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] font-[Manrope] font-bold text-[#006c49] hover:underline">
                          <MdOpenInNew className="text-sm" />
                          Open Klaviyo Settings → API Keys
                        </a>
                        <button
                          onClick={testKlaviyoSms}
                          className="px-4 py-2 bg-white border border-[#c6c6cd] hover:border-black font-[Manrope] text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                        >
                          <MdSend className="text-sm text-[#006c49]" />
                          Send Test VIP SMS Notification
                        </button>
                      </div>
                      {testKlaviyoResult && (
                        <div className={`mx-8 mb-6 p-4 rounded-xl text-xs font-[Manrope] flex items-center gap-2 ${
                          testKlaviyoResult.ok ? "bg-[#e6f7f1] text-[#006c49]" : "bg-red-50 text-red-700"
                        }`}>
                          {testKlaviyoResult.ok ? <MdCheckCircle className="text-base shrink-0" /> : <MdError className="text-base shrink-0" />}
                          {testKlaviyoResult.msg}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                )}

                {/* ── Google Analytics 4 ── */}
                {activeSection === "ga4" && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] overflow-hidden">
                      <div className="px-8 py-5 border-b border-[#e5eeff] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-[#E37400]/10 flex items-center justify-center">
                            <SiGoogleanalytics className="text-[#E37400] text-xl" />
                          </div>
                          <div>
                            <h3 className="font-serif text-[20px] font-semibold text-black">Google Analytics 4 &amp; Measurement Protocol</h3>
                            <p className="text-xs font-[Manrope] text-[#7c839b]">Real-time luxury e-commerce telemetry, server-side purchase tracking, and client attribution.</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-[Manrope] font-bold uppercase tracking-widest ${
                          ga4Configured ? "bg-[#e6f7f1] text-[#006c49]" : "bg-gray-100 text-gray-500"
                        }`}>
                          {ga4Configured ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <div className="p-8 space-y-6">
                        <div className="p-5 bg-[#f8f9ff] border border-[#e5eeff] rounded-xl flex items-start gap-4">
                          <MdShield className="text-[#006c49] text-2xl mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <p className="text-sm font-[Manrope] font-bold text-black">Managed via Platform Environment Variables</p>
                            <p className="text-xs font-[Manrope] text-[#7c839b] leading-relaxed">
                              Google Analytics 4 Measurement ID and API Secret are managed via server-side environment variables.
                            </p>
                          </div>
                        </div>
                        <div className="px-8 py-4 border-t border-[#e5eeff] bg-[#f8f9ff]">
                          <a href="https://analytics.google.com/analytics/web/" target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-[11px] font-[Manrope] font-bold text-[#E37400] hover:underline">
                            <MdOpenInNew className="text-sm" />
                            Open Google Analytics Admin Dashboard
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── DHL Express Logistics ── */}
                {activeSection === "dhl" && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)] overflow-hidden">
                      <div className="px-8 py-5 border-b border-[#e5eeff] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-[#D40511]/10 flex items-center justify-center">
                            <SiDhl className="text-[#D40511] text-2xl" />
                          </div>
                          <div>
                            <h3 className="font-serif text-[20px] font-semibold text-black">DHL Express Logistics</h3>
                            <p className="text-xs font-[Manrope] text-[#7c839b]">International courier rates, automated air waybill generation, and luxury shipment tracking.</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-[Manrope] font-bold uppercase tracking-widest ${
                          dhlConfigured ? "bg-[#e6f7f1] text-[#006c49]" : "bg-gray-100 text-gray-500"
                        }`}>
                          {dhlConfigured ? "Connected" : "Inactive"}
                        </span>
                      </div>
                      <div className="p-8 space-y-6">
                        <div className="p-5 bg-[#f8f9ff] border border-[#e5eeff] rounded-xl flex items-start gap-4">
                          <MdShield className="text-[#006c49] text-2xl mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <p className="text-sm font-[Manrope] font-bold text-black">Managed via Platform Environment Variables</p>
                            <p className="text-xs font-[Manrope] text-[#7c839b] leading-relaxed">
                              DHL Express logistics credentials (Site ID, Password, and Account Number) are managed via server-side environment variables.
                            </p>
                          </div>
                        </div>
                        <div className="px-8 py-4 border-t border-[#e5eeff] bg-[#f8f9ff]">
                          <a href="https://developer.dhl.com/" target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-[11px] font-[Manrope] font-bold text-[#D40511] hover:underline">
                            <MdOpenInNew className="text-sm" />
                            Open DHL Developer Portal
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── API Keys ── */}
                {activeSection === "apikeys" && <ApiKeysPanel />}

              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
