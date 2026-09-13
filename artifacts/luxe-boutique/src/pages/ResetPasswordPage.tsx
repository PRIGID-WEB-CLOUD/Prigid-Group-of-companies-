import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();

  const token = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("token")
    : null;

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [showCf, setShowCf]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!token) setError("Invalid or missing reset link. Please request a new one.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to reset password."); return; }
      setSuccess(true);
      setTimeout(() => setLocation("/login"), 3000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const strength = password.length === 0 ? 0
    : password.length < 6 ? 1
    : password.length < 10 ? 2
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthColor = ["", "bg-red-400", "bg-amber-400", "bg-blue-400", "bg-emerald-500"];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9ff] px-4 py-20">
      <div className="w-full max-w-md">

        <div className="text-center mb-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 mb-3">LUXE BOUTIQUE</p>
          <h1 className="text-3xl font-serif text-slate-900">Create new password</h1>
          <p className="text-sm text-slate-500 mt-2">Choose a strong password to protect your account.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-8">
          {success ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-emerald-600" size={28} />
              </div>
              <h2 className="text-xl font-serif font-semibold text-slate-900 mb-2">Password updated!</h2>
              <p className="text-sm text-slate-500">Redirecting you to the login page…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
                  <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">New Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="Min. 6 characters"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-sm focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 h-1 mb-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`flex-1 rounded-full transition-colors ${i <= strength ? strengthColor[strength] : "bg-slate-200"}`} />
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500">{strengthLabel[strength]}</p>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Confirm Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showCf ? "text" : "password"}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    placeholder="Re-enter password"
                    className={`w-full bg-slate-50 border rounded-xl pl-10 pr-10 py-3 text-sm focus:ring-1 outline-none transition-all ${
                      confirm && confirm !== password ? "border-red-300 focus:ring-red-300" : "border-slate-200 focus:ring-slate-900"
                    }`}
                  />
                  <button type="button" onClick={() => setShowCf(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    {showCf ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {confirm && confirm !== password && (
                  <p className="text-[11px] text-red-500">Passwords do not match</p>
                )}
              </div>

              <button type="submit" disabled={loading || !token}
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Updating…</>
                ) : (
                  <><Lock size={13} /> Set New Password</>
                )}
              </button>

              <p className="text-center text-xs text-slate-400">
                Remember it?{" "}
                <Link href="/login" className="font-bold text-slate-700 hover:text-slate-900 underline">Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
