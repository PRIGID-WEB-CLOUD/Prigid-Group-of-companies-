import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [, navigate] = useLocation();
  const { login, loginWithGoogle } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const result = await login(email, password);
    if (result.error) { setError(result.error); setLoading(false); }
    else navigate("/account");
  };

  const handleGoogle = async () => {
    setLoading(true); setError("");
    const result = await loginWithGoogle();
    if (result.error) { setError(result.error); setLoading(false); }
    else navigate("/account");
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-white p-12 shadow-2xl rounded-2xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-serif text-slate-900">Sign In</h1>
          <p className="text-slate-500 text-sm">Access your private collection.</p>
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 border-2 border-slate-100 hover:border-slate-300 py-3.5 rounded-xl text-sm font-semibold text-slate-700 transition-all active:scale-[0.98]"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-[11px] text-slate-400 font-medium uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        {error && <p className="text-red-500 text-xs text-center font-bold tracking-widest">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email Address</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border-b-2 border-slate-100 focus:border-slate-900 outline-none py-3 text-sm transition-colors" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Password</label>
              <Link href="/forgot-password" className="text-[10px] font-bold text-slate-900 hover:text-emerald-600 transition-colors">Forgot Password?</Link>
            </div>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="w-full border-b-2 border-slate-100 focus:border-slate-900 outline-none py-3 text-sm transition-colors pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 transition-colors">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-5 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all rounded-lg shadow-lg active:scale-95 disabled:bg-slate-300">
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <div className="text-center">
          <p className="text-slate-500 text-xs font-medium">Don&apos;t have an account?{" "}
            <Link href="/register" className="text-slate-900 font-bold hover:text-emerald-600 transition-colors">Register</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
