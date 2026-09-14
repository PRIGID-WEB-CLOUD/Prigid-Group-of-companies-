import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { isSignInWithEmailLink, signInWithEmailLink, sendSignInLinkToEmail } from "firebase/auth";
import { auth, isFirebaseOperational } from "@/lib/firebase";

type Step = "email" | "otp" | "bootstrap";

export default function AdminLoginPage() {
  const [step, setStep]                   = useState<Step>("email");
  const [loginMethod, setLoginMethod]     = useState<"magic_link" | "otp">(isFirebaseOperational ? "magic_link" : "otp");
  const [email, setEmail]                 = useState("");
  const [bootstrapName, setBootstrapName] = useState("");
  const [bootstrapEmail, setBootstrapEmail] = useState("");
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [otp, setOtp]                     = useState(["", "", "", "", "", ""]);
  const [error, setError]                 = useState("");
  const [info, setInfo]                   = useState("");
  const [loading, setLoading]             = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [adminExists, setAdminExists]     = useState<boolean | null>(null);
  const [admins, setAdmins]               = useState<Array<{ email: string; name: string; role: string }>>([]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { user, loading: authLoading, refetch, quickLogin } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!authLoading && (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN")) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  // Handle incoming Firebase Magic Sign-In Link redirect on page load
  useEffect(() => {
    if (!isFirebaseOperational) return;
    try {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        let emailVal = window.localStorage.getItem("emailForSignIn") || "";
        if (!emailVal) {
          emailVal = window.prompt("Please confirm your email address to sign in:") || "";
        }
        if (emailVal) {
          setLoading(true);
          setError("");
          setInfo("Verifying magic link and authorizing your session...");
          signInWithEmailLink(auth, emailVal.trim(), window.location.href)
            .then(async (result) => {
              const userEmail = result.user?.email;
              if (!userEmail) {
                throw new Error("No email received from credentials verification.");
              }

              // Sync identity with our central database session manager
              const res = await fetch("/api/auth/firebase", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: userEmail, uid: result.user.uid, name: result.user.displayName || "" }),
              });

              if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Failed to issue store session.");
              }

              const data = await res.json();
              if (data.role !== "ADMIN" && data.role !== "SUPER_ADMIN") {
                await fetch("/api/auth/logout", { method: "POST" });
                throw new Error("Access Denied: You do not have administrator permissions.");
              }

              if (data.token) {
                localStorage.setItem("luxe_admin_token", data.token);
              }
              window.localStorage.removeItem("emailForSignIn");
              setInfo("Successfully logged in! Loading your dashboard...");
              await refetch();
              navigate("/");
            })
            .catch((err) => {
              console.error("Firebase Sign-In Error:", err);
              setError(err.message || "Failed to complete magic link authentication.");
              setLoading(false);
            });
        }
      }
    } catch (e) {
      console.warn("Firebase check isSignInWithEmailLink failed:", e);
    }
  }, [navigate, refetch]);

  useEffect(() => {
    let mounted = true;
    const checkAdmin = (retries = 2) => {
      fetch("/api/auth/admin/exists")
        .then(async (r) => {
          if (r.status === 503 && retries > 0) {
            setTimeout(() => checkAdmin(retries - 1), 600);
            return;
          }
          const d = await r.json();
          if (mounted) {
            setAdminExists(d.exists ?? false);
            if (Array.isArray(d.admins)) setAdmins(d.admins);
          }
        })
        .catch(() => {
          if (retries > 0) {
            setTimeout(() => checkAdmin(retries - 1), 600);
          } else if (mounted) {
            setAdminExists(false);
          }
        });
    };
    checkAdmin();
    return () => { mounted = false; };
  }, []);

  const handleQuickLogin = async (adminEmail?: string) => {
    if (loading) return;
    setLoading(true);
    setError("");
    setInfo("Signing in...");
    const result = await quickLogin(adminEmail);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      await refetch();
      navigate("/");
    }
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Handler 1: Firebase Magic Link Dispatcher
  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setError(""); setInfo("");
    try {
      if (!isFirebaseOperational) {
        throw new Error(
          "Firebase Magic Link services are currently restricted inside this sandboxed preview iframe. Please sign in with the OTP Code option instead, or open the app in a new browser tab to use magic links."
        );
      }
      const emailTrim = email.trim();
      if (!emailTrim) {
        setError("Please enter your admin email.");
        setLoading(false);
        return;
      }

      // Check if email belongs to an allowed admin before requesting Magic Link
      const checkRes = await fetch("/api/auth/admin/exists");
      const checkData = await checkRes.json();
      const isAllowed = Array.isArray(checkData.admins) && 
        checkData.admins.some((a: any) => a.email.toLowerCase() === emailTrim.toLowerCase());

      if (!isAllowed) {
        setError("Access Denied: No admin account found for this email.");
        setLoading(false);
        return;
      }

      const actionCodeSettings = {
        url: window.location.origin + "/seller/login",
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, emailTrim, actionCodeSettings);
      window.localStorage.setItem("emailForSignIn", emailTrim);
      setInfo(`A secure magic login link was sent to ${emailTrim}. Open it to sign in instantly!`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to dispatch magic link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handler 2: Custom Server OTP Code Dispatcher
  const requestOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading) return;
    setLoading(true); setError(""); setInfo("");
    try {
      const res = await fetch("/api/auth/admin/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send code. Please try again.");
        setLoading(false);
        return;
      }
      setStep("otp");
      setResendCooldown(60);
      if (data.devCode) {
        const digits = String(data.devCode).split("");
        setOtp(digits);
        setInfo(`Dev mode — code: ${data.devCode}`);
        setTimeout(() => verifyOtp(String(data.devCode)), 600);
      } else {
        setInfo(`A 6-digit sign-in code was sent to ${email.trim()}`);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    if (digit && idx < 5) inputRefs.current[idx + 1]?.focus();
    if (digit && next.every((d) => d !== "") && idx === 5) {
      verifyOtp(next.join(""));
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      inputRefs.current[5]?.focus();
      verifyOtp(pasted);
    }
  };

  const verifyOtp = async (code?: string) => {
    const finalCode = code ?? otp.join("");
    if (finalCode.length !== 6) { setError("Enter all 6 digits."); return; }
    if (loading) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/admin/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: finalCode }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Invalid code. Please try again.");
        setOtp(["", "", "", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("luxe_admin_token", data.token);
      }
      await refetch();
      navigate("/");
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  };

  const bootstrapAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/admin/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Bootstrap-Secret": bootstrapSecret },
        body: JSON.stringify({ name: bootstrapName, email: bootstrapEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Setup failed. Please try again.");
        setLoading(false);
        return;
      }
      setAdminExists(true);
      setEmail(bootstrapEmail.trim());
      setStep("email");
      setError("");
      setInfo("Admin account created! Enter your email below to sign in.");
      setBootstrapName(""); setBootstrapEmail("");
      setBootstrapSecret("");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-[#006c49] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex font-[Manrope]">

      {/* ── Left panel ──────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] flex-col bg-[#080e0b] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(#ffffff 1px,transparent 1px),linear-gradient(90deg,#ffffff 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="absolute top-[-120px] left-[-80px] w-[520px] h-[520px] bg-[#006c49] opacity-[0.12] rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-80px] right-[-60px] w-[360px] h-[360px] bg-[#006c49] opacity-[0.08] rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 p-12">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#006c49] rounded flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[18px]">storefront</span>
            </div>
            <span className="text-white font-[Manrope] font-bold text-[13px] tracking-[0.22em] uppercase">Luxe Boutique</span>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center px-16 pb-16">
          <div className="space-y-6 max-w-[420px]">
            <div className="inline-flex items-center gap-2 bg-[#006c49]/15 border border-[#006c49]/30 px-4 py-2 rounded-full">
              <span className="material-symbols-outlined text-[#4edea3] text-[14px]">shield</span>
              <span className="text-[#4edea3] text-[11px] font-bold tracking-[0.18em] uppercase">Seller Portal</span>
            </div>
            <h1 className="font-serif text-white text-[42px] leading-[1.1] font-semibold">Your store,<br />under control.</h1>
            <p className="text-white/50 text-[15px] leading-relaxed">Manage products, orders, customers, and marketing channels from a single command centre.</p>
          </div>

          <div className="mt-14 max-w-[420px] space-y-5">
            <p className="text-white/30 text-[11px] font-bold tracking-[0.18em] uppercase">Flexible Secure Sign-In</p>
            {[
              { icon: "magic_button", title: "Option 1: Firebase Magic Link", body: "Send a passwordless validation link directly to your admin email address." },
              { icon: "pin",          title: "Option 2: 6-Digit OTP Code",     body: "Receive a numerical credentials code valid for 10 minutes." },
              { icon: "verified",     title: "Strict Role Permissions",         body: "Access matches your assigned role: Owner, Admin, Editor, or Viewer." },
            ].map((s) => (
              <div key={s.icon} className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full border border-[#006c49]/40 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#4edea3] text-[16px]">{s.icon}</span>
                </div>
                <div>
                  <p className="text-white/80 font-bold text-sm mb-0.5">{s.title}</p>
                  <p className="text-white/35 text-xs leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 px-12 py-8 border-t border-white/[0.06] flex items-center justify-between">
          <p className="text-white/25 text-[11px] tracking-widest uppercase">Secure Admin Access</p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
            <span className="text-white/30 text-[11px]">All systems operational</span>
          </div>
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────────────────── */}
      <div className="flex-1 bg-[#f8f9ff] flex flex-col">

        <div className="lg:hidden flex items-center gap-3 p-8 border-b border-slate-100 bg-white">
          <div className="w-8 h-8 bg-[#006c49] rounded flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[18px]">storefront</span>
          </div>
          <span className="font-bold text-[13px] tracking-[0.22em] uppercase text-[#0a0f0d]">Luxe Boutique</span>
          <span className="ml-auto text-[10px] font-bold tracking-widest uppercase text-[#006c49] bg-[#006c49]/10 px-3 py-1 rounded-full">Seller Portal</span>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-[420px] space-y-8">

            {/* Step indicator (hidden on bootstrap) */}
            {step !== "bootstrap" && (
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold transition-all ${step === "email" ? "bg-[#0a0f0d] text-white" : "bg-[#006c49] text-white"}`}>
                  {step === "email" ? "1" : <span className="material-symbols-outlined text-[14px]">check</span>}
                </div>
                <div className="flex-1 h-px bg-slate-200" />
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold transition-all ${step === "otp" ? "bg-[#0a0f0d] text-white" : "bg-slate-200 text-slate-400"}`}>2</div>
              </div>
            )}

            {/* Heading */}
            <div className="space-y-1.5">
              <h2 className="font-serif text-[30px] text-[#0a0f0d] font-semibold leading-tight">
                {step === "email" ? "Seller Sign In" : step === "otp" ? "Enter your code" : "First Time Setup"}
              </h2>
              <p className="text-[#7c839b] text-sm">
                {step === "email"
                  ? "Select your preferred secure sign-in method below."
                  : step === "otp"
                  ? `Check your inbox at ${email.trim()}`
                  : "Create the first admin account for this store."}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <span className="material-symbols-outlined text-red-500 text-[18px] shrink-0 mt-0.5">error</span>
                <p className="text-red-700 text-sm font-semibold">{error}</p>
              </div>
            )}

            {/* Info */}
            {info && !error && (
              <div className="flex items-start gap-3 bg-[#f0faf6] border border-[#c3eed8] rounded-xl p-4">
                <span className="material-symbols-outlined text-[#006c49] text-[18px] shrink-0 mt-0.5">check_circle</span>
                <p className="text-[#006c49] text-sm font-semibold">{info}</p>
              </div>
            )}

            {/* STEP 1 — Email Form & Switcher */}
            {step === "email" && (
              <div className="space-y-6">

                {/* Preferred Method Switcher */}
                <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setLoginMethod("magic_link")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      loginMethod === "magic_link"
                        ? "bg-white text-[#006c49] shadow-sm"
                        : "text-slate-500 hover:text-[#0a0f0d]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">magic_button</span>
                    Magic Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethod("otp")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      loginMethod === "otp"
                        ? "bg-white text-[#006c49] shadow-sm"
                        : "text-slate-500 hover:text-[#0a0f0d]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">pin</span>
                    OTP Code
                  </button>
                </div>

                {/* Quick 1-Click Access for detected admins (Strictly Development / Demo Only) */}
                {!import.meta.env.PROD && admins.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#006c49] text-[18px]">verified_user</span>
                      <span className="text-[11px] font-bold uppercase tracking-widest text-[#0a0f0d]">
                        Instant Access (Demo Mode)
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Click below to bypass email delivery and sign straight in with operational permissions:
                    </p>
                    <div className="space-y-2 pt-1">
                      {admins.map((admin) => (
                        <button
                          key={admin.email}
                          type="button"
                          disabled={loading}
                          onClick={() => handleQuickLogin(admin.email)}
                          className="w-full text-left bg-slate-50 hover:bg-[#006c49]/10 border border-slate-200 hover:border-[#006c49]/40 p-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer disabled:opacity-60"
                        >
                          <div>
                            <p className="text-xs font-bold text-[#0a0f0d] group-hover:text-[#006c49]">
                              {admin.name || "Administrator"}
                            </p>
                            <p className="text-[11px] text-slate-400">{admin.email}</p>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-slate-200/60 group-hover:bg-[#006c49] group-hover:text-white transition-colors">
                            {admin.role}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-4 text-slate-400 text-[11px] uppercase tracking-widest font-bold">
                    Or Sign In with Email
                  </span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <form onSubmit={loginMethod === "magic_link" ? sendMagicLink : requestOtp} className="space-y-5">
                  {loginMethod === "magic_link" && !isFirebaseOperational && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
                      <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">warning</span>
                      <div className="space-y-1">
                        <p className="text-amber-800 text-xs font-bold leading-tight">Firebase Link Restrictions</p>
                        <p className="text-amber-700 text-[11px] leading-relaxed">
                          Magic links are restricted inside this sandboxed preview iframe. Please sign in with the <strong>OTP Code</strong> option instead, or open the app in a new window/tab to use magic links.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#45464d]">Admin Email</label>
                    <input
                      type="email" required autoFocus
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@luxeboutique.com"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10 transition-all placeholder:text-slate-300"
                    />
                  </div>
                  <button type="submit" disabled={loading || !email.trim()}
                    className="w-full bg-[#0a0f0d] text-white py-4 rounded-xl font-bold text-[12px] tracking-[0.18em] uppercase hover:bg-[#006c49] transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2.5 shadow-lg shadow-black/10">
                    {loading ? (
                      <><span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>Processing…</>
                    ) : loginMethod === "magic_link" ? (
                      <><span className="material-symbols-outlined text-[16px]">magic_button</span>Send Magic Link</>
                    ) : (
                      <><span className="material-symbols-outlined text-[16px]">mail</span>Send Sign-In Code</>
                    )}
                  </button>
                  {adminExists === false && (
                    <p className="text-center text-[12px] text-[#b0b8cc]">
                      Setting up for the first time?{" "}
                      <button type="button" onClick={() => { setError(""); setInfo(""); setStep("bootstrap"); }}
                        className="text-[#006c49] font-bold hover:underline">
                        Create admin account
                      </button>
                    </p>
                  )}
                </form>
              </div>
            )}

            {/* STEP 0 — Bootstrap */}
            {step === "bootstrap" && adminExists === false && (
              <form onSubmit={bootstrapAdmin} className="space-y-5">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">info</span>
                  <p className="text-amber-800 text-[12px] leading-relaxed font-medium">
                    This creates the <strong>first admin account</strong>. Only one admin setup is allowed.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-[#45464d]">Your Name</label>
                  <input
                    type="text" required autoFocus
                    value={bootstrapName} onChange={(e) => setBootstrapName(e.target.value)}
                    placeholder="Store Owner"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10 transition-all placeholder:text-slate-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-[#45464d]">Admin Email</label>
                  <input
                    type="email" required
                    value={bootstrapEmail} onChange={(e) => setBootstrapEmail(e.target.value)}
                    placeholder="admin@luxeboutique.com"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10 transition-all placeholder:text-slate-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-[#45464d]">Setup Secret</label>
                  <input
                    type="password" required autoComplete="off"
                    value={bootstrapSecret} onChange={(e) => setBootstrapSecret(e.target.value)}
                    placeholder="Enter the server setup secret"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10 transition-all placeholder:text-slate-300"
                  />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-[#0a0f0d] text-white py-4 rounded-xl font-bold text-[12px] tracking-[0.18em] uppercase hover:bg-[#006c49] transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2.5 shadow-lg shadow-black/10">
                  {loading
                    ? <><span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>Creating account…</>
                    : <><span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>Create Admin Account</>}
                </button>
                <button type="button" onClick={() => { setStep("email"); setError(""); setInfo(""); }}
                  className="w-full text-[#7c839b] hover:text-[#0a0f0d] transition-colors text-[12px] flex items-center justify-center gap-1 py-1">
                  <span className="material-symbols-outlined text-[14px]">arrow_back</span> Back to sign in
                </button>
              </form>
            )}

            {/* STEP 2 — OTP Form */}
            {step === "otp" && (
              <div className="space-y-6">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-[#45464d] block mb-3">6-Digit Code</label>
                  <div className="flex gap-2.5" onPaste={handleOtpPaste}>
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { inputRefs.current[idx] = el; }}
                        type="text" inputMode="numeric" maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className={`w-12 h-14 text-center text-[22px] font-mono font-bold border-2 rounded-xl outline-none transition-all bg-white
                          ${digit ? "border-[#006c49] text-[#0a0f0d]" : "border-slate-200 text-slate-300"}
                          focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-[#7c839b] mt-2.5">You can paste the code directly into any box.</p>
                </div>

                <button
                  onClick={() => verifyOtp()} disabled={loading || otp.some((d) => !d)}
                  className="w-full bg-[#0a0f0d] text-white py-4 rounded-xl font-bold text-[12px] tracking-[0.18em] uppercase hover:bg-[#006c49] transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2.5 shadow-lg shadow-black/10">
                  {loading
                    ? <><span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>Verifying…</>
                    : <><span className="material-symbols-outlined text-[16px]">lock_open</span>Verify & Sign In</>}
                </button>

                <div className="flex items-center justify-between text-sm">
                  <button onClick={() => { setStep("email"); setOtp(["","","","","",""]); setError(""); setInfo(""); }}
                    className="text-[#7c839b] hover:text-[#0a0f0d] transition-colors text-[12px] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">arrow_back</span> Change email
                  </button>
                  <button
                    onClick={() => requestOtp()} disabled={resendCooldown > 0 || loading}
                    className="text-[#006c49] font-bold hover:underline disabled:opacity-50 disabled:no-underline text-[12px] transition-colors">
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                </div>
              </div>
            )}

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { icon: "lock",          label: "Encrypted"    },
                { icon: "verified_user", label: "Role-checked" },
                { icon: "history",       label: "Audit logged" },
              ].map((b) => (
                <div key={b.label} className="flex flex-col items-center gap-1.5 bg-white border border-slate-100 rounded-xl py-3.5 px-2">
                  <span className="material-symbols-outlined text-[#006c49] text-[18px]">{b.icon}</span>
                  <span className="text-[10px] text-[#7c839b] font-bold tracking-widest uppercase text-center">{b.label}</span>
                </div>
              ))}
            </div>

            <p className="text-center text-[12px] text-[#7c839b]">
              Contact the store owner if you need access.
            </p>
          </div>
        </div>

        <div className="px-8 py-5 border-t border-slate-100 bg-white">
          <p className="text-center text-[11px] text-slate-400">
            © {new Date().getFullYear()} Luxe Boutique — Seller Portal · All access is monitored and logged.
          </p>
        </div>
      </div>
    </div>
  );
}
