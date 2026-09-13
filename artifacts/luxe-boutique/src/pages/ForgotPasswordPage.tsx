import { useState } from "react";
import { Link } from "wouter";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      setError("Unable to send reset link right now.");
      setLoading(false);
      return;
    }
    setMessage("Magic link sent. Check your inbox.");
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {submitted ? (
          <div className="text-center">
            <h1 className="font-serif text-3xl text-slate-900 mb-3">Check Your Inbox</h1>
            <p className="text-slate-500 text-sm mb-8">
              {message || `If an account exists for ${email}, a password reset link will be sent shortly.`}
            </p>
            <Link href="/login">
              <button className="text-xs tracking-widest uppercase font-bold text-slate-500 hover:text-slate-900 transition-colors border-b border-slate-300 pb-0.5">
                Return to Sign In
              </button>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-serif text-3xl text-slate-900 mb-2 text-center">Forgot Password</h1>
            <p className="text-slate-400 text-sm text-center mb-10">Enter your email and we’ll send a magic link to reset your password.</p>
            {error && <p className="text-red-500 text-xs text-center mb-4">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 block mb-2">Email Address</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full border-b border-slate-200 py-3 text-sm focus:outline-none focus:border-slate-900 bg-transparent transition-colors"
                />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-4 bg-slate-900 text-white text-xs tracking-widest uppercase font-bold hover:bg-emerald-700 transition-colors">
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
            <p className="text-center mt-6 text-xs text-slate-400">
              Remembered it?{" "}
              <Link href="/login" className="font-bold text-slate-700 hover:text-slate-900">Sign In</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
