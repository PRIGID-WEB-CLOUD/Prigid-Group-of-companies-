import { useState, useEffect } from "react";
import { useLocation } from "wouter";

type InviteInfo = {
  email: string;
  name: string | null;
  role: string;
  invitedBy: string | null;
};

type Stage =
  | { type: "loading" }
  | { type: "invalid"; message: string }
  | { type: "expired" }
  | { type: "already_accepted"; email: string }
  | { type: "ready"; info: InviteInfo }
  | { type: "accepting" }
  | { type: "done"; email: string; role: string };

const ROLE_COLOR: Record<string, string> = {
  Owner:  "text-[#b45309] bg-amber-50 border-amber-200",
  Admin:  "text-[#006c49] bg-[#e6f7f1] border-[#c3eed8]",
  Editor: "text-[#1d4ed8] bg-blue-50 border-blue-200",
  Viewer: "text-[#7c839b] bg-[#f0f2ff] border-[#c6c6cd]",
};

const ROLE_ICON: Record<string, string> = {
  Owner:  "shield_person",
  Admin:  "admin_panel_settings",
  Editor: "edit_note",
  Viewer: "visibility",
};

function getToken() {
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

export default function AdminAcceptInvitePage() {
  const [, navigate] = useLocation();
  const [stage, setStage]     = useState<Stage>({ type: "loading" });
  const [displayName, setDisplayName] = useState("");
  const [nameError,   setNameError]   = useState<string | null>(null);
  const token = getToken();

  useEffect(() => {
    if (!token) { setStage({ type: "invalid", message: "No invite token found in this link." }); return; }

    fetch(`/api/team/accept?token=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (r.status === 409) return setStage({ type: "already_accepted", email: d.email ?? "" });
        if (r.status === 410) return setStage({ type: "expired" });
        if (!r.ok)            return setStage({ type: "invalid", message: d.error ?? "Invalid invite link." });
        setDisplayName(d.name ?? "");
        setStage({ type: "ready", info: d });
      })
      .catch(() => setStage({ type: "invalid", message: "Could not reach the server. Please try again." }));
  }, [token]);

  const accept = async () => {
    if (stage.type !== "ready") return;
    if (!displayName.trim()) { setNameError("Please enter your name to continue."); return; }
    setNameError(null);
    setStage({ type: "accepting" });

    const r = await fetch("/api/team/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name: displayName.trim() }),
    });
    const d = await r.json();
    if (!r.ok) {
      setStage({ type: "invalid", message: d.error ?? "Something went wrong." });
      return;
    }
    setStage({ type: "done", email: d.email, role: d.role });
  };

  return (
    <div className="min-h-screen bg-[#0a0f0d] flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-10 flex items-center gap-3">
        <div className="w-8 h-8 bg-[#006c49] rounded flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-base">storefront</span>
        </div>
        <span className="text-white font-[Manrope] font-bold text-sm tracking-[0.25em] uppercase">Luxe Boutique</span>
      </div>

      <div className="w-full max-w-md">

        {/* ── Loading ── */}
        {stage.type === "loading" && (
          <div className="bg-white rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.4)] p-10 flex flex-col items-center gap-4">
            <span className="material-symbols-outlined text-4xl text-[#c6c6cd] animate-spin">autorenew</span>
            <p className="font-[Manrope] text-[#7c839b] text-sm">Validating your invite…</p>
          </div>
        )}

        {/* ── Invalid ── */}
        {stage.type === "invalid" && (
          <div className="bg-white rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.4)] p-10 flex flex-col items-center gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-red-500">link_off</span>
            </div>
            <div>
              <h1 className="font-serif text-[22px] font-semibold mb-2">Invalid Link</h1>
              <p className="text-sm font-[Manrope] text-[#7c839b] leading-relaxed">{stage.message}</p>
            </div>
            <p className="text-[11px] font-[Manrope] text-[#c6c6cd]">
              Ask your admin to resend the invitation from the Team page.
            </p>
          </div>
        )}

        {/* ── Expired ── */}
        {stage.type === "expired" && (
          <div className="bg-white rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.4)] p-10 flex flex-col items-center gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-amber-500">schedule</span>
            </div>
            <div>
              <h1 className="font-serif text-[22px] font-semibold mb-2">Invite Expired</h1>
              <p className="text-sm font-[Manrope] text-[#7c839b] leading-relaxed">
                This invite link has expired (links are valid for 7 days). Ask your admin to resend it from the Team page.
              </p>
            </div>
          </div>
        )}

        {/* ── Already accepted ── */}
        {stage.type === "already_accepted" && (
          <div className="bg-white rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.4)] p-10 flex flex-col items-center gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#e6f7f1] flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-[#006c49]">verified</span>
            </div>
            <div>
              <h1 className="font-serif text-[22px] font-semibold mb-2">Already Joined</h1>
              <p className="text-sm font-[Manrope] text-[#7c839b] leading-relaxed">
                This invitation has already been accepted. Sign in to access the admin portal.
              </p>
            </div>
            <button onClick={() => navigate("/login")}
              className="w-full py-3 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-[#006c49] transition-all">
              Go to Sign In
            </button>
          </div>
        )}

        {/* ── Ready to accept ── */}
        {(stage.type === "ready" || stage.type === "accepting") && (
          (() => {
            const info = (stage as { type: "ready"; info: InviteInfo } | { type: "accepting" }).type === "ready"
              ? (stage as { type: "ready"; info: InviteInfo }).info
              : null;
            if (!info && stage.type !== "accepting") return null;
            const roleInfo = info ?? { role: "Editor", email: "", invitedBy: null, name: null };

            return (
              <div className="bg-white rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.4)] overflow-hidden">
                {/* Top bar */}
                <div className="bg-[#080e0b] px-8 py-5 text-center">
                  <p className="text-[11px] font-[Manrope] font-bold text-[#7c839b] uppercase tracking-widest mb-1">Admin Portal Invitation</p>
                  <p className="text-white font-serif text-[22px] font-semibold">You're invited to join the team</p>
                </div>

                <div className="p-8 space-y-6">
                  {/* Role badge */}
                  {info && (
                    <div className="flex flex-col items-center gap-3 py-2">
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-[Manrope] font-bold ${ROLE_COLOR[info.role] ?? ROLE_COLOR.Viewer}`}>
                        <span className="material-symbols-outlined text-base">{ROLE_ICON[info.role] ?? "badge"}</span>
                        {info.role}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-[Manrope] text-[#45464d]">
                          {info.invitedBy
                            ? <><strong className="text-black">{info.invitedBy}</strong> has invited <strong className="text-black">{info.email}</strong></>
                            : <>Invitation for <strong className="text-black">{info.email}</strong></>
                          }
                        </p>
                        <p className="text-xs font-[Manrope] text-[#7c839b] mt-0.5">to the Luxe Boutique admin portal.</p>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-[#f0f2ff] pt-5 space-y-4">
                    {/* Name field */}
                    <div>
                      <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-2">
                        Your Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={e => { setDisplayName(e.target.value); setNameError(null); }}
                        placeholder="e.g. Sarah Chen"
                        className={`w-full bg-[#f8f9ff] border rounded-xl px-4 py-3 font-[Manrope] text-sm outline-none transition-colors ${nameError ? "border-red-400 focus:border-red-500" : "border-[#c6c6cd] focus:border-black"}`}
                        disabled={stage.type === "accepting"}
                        onKeyDown={e => e.key === "Enter" && accept()}
                      />
                      {nameError && (
                        <p className="mt-1.5 text-[11px] font-[Manrope] text-red-600 font-bold">{nameError}</p>
                      )}
                      <p className="mt-1.5 text-[11px] font-[Manrope] text-[#7c839b]">
                        This will appear on your admin profile.
                      </p>
                    </div>

                    <button
                      onClick={accept}
                      disabled={stage.type === "accepting"}
                      className="w-full py-3.5 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-[#006c49] transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg">
                      {stage.type === "accepting"
                        ? <><span className="material-symbols-outlined text-sm animate-spin">autorenew</span> Joining…</>
                        : <><span className="material-symbols-outlined text-sm">how_to_reg</span> Accept Invitation</>
                      }
                    </button>
                  </div>

                  <p className="text-center text-[10px] font-[Manrope] text-[#c6c6cd] leading-relaxed">
                    By accepting, you'll gain <strong className="text-[#7c839b]">{info?.role ?? "team"}</strong> access to the admin portal.
                    You'll sign in using the OTP method via <strong className="text-[#7c839b]">{info?.email ?? "your email"}</strong>.
                  </p>
                </div>
              </div>
            );
          })()
        )}

        {/* ── Done ── */}
        {stage.type === "done" && (
          <div className="bg-white rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.4)] p-10 flex flex-col items-center gap-6 text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#e6f7f1] flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-[#006c49]">how_to_reg</span>
            </div>
            <div>
              <h1 className="font-serif text-[26px] font-semibold mb-2">Welcome to the team!</h1>
              <p className="text-sm font-[Manrope] text-[#7c839b] leading-relaxed">
                Your account has been activated as a <strong className="text-black">{stage.role}</strong>.
                Sign in using the one-time code sent to <strong className="text-black">{stage.email}</strong>.
              </p>
            </div>

            <div className="w-full bg-[#f8f9ff] border border-[#e5eeff] rounded-xl p-4 text-left space-y-2">
              <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b]">How to sign in</p>
              {[
                { icon: "mail",         text: `Go to the admin sign-in page` },
                { icon: "mark_email_read", text: `Enter ${stage.email}` },
                { icon: "pin",          text: "Enter the 6-digit code from your email" },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#e6f7f1] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[12px] text-[#006c49]">{s.icon}</span>
                  </div>
                  <p className="text-[11px] font-[Manrope] text-[#45464d]">{s.text}</p>
                </div>
              ))}
            </div>

            <button onClick={() => navigate("/login")}
              className="w-full py-3.5 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-[#006c49] transition-all shadow-lg flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-sm">login</span>
              Go to Admin Sign In
            </button>
          </div>
        )}
      </div>

      <p className="mt-8 text-[10px] font-[Manrope] text-[#3a4040] tracking-widest uppercase">
        © {new Date().getFullYear()} Luxe Boutique · Admin Portal
      </p>
    </div>
  );
}
