import { useState } from "react";
import { motion } from "motion/react";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) { setStatus("success"); setMessage(data.message || "Thank you for subscribing!"); setEmail(""); }
      else { setStatus("error"); setMessage(data.error || "Failed to subscribe"); }
    } catch { setStatus("error"); setMessage("An unexpected error occurred."); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div className="flex flex-col space-y-2">
        <label htmlFor="newsletter" className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-900">Join the Atelier</label>
        <div className="relative flex">
          <input
            id="newsletter" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
            className="w-full bg-transparent border-b-2 border-slate-200 focus:border-slate-900 outline-none py-2 text-xs transition-colors pr-12 placeholder:text-slate-400"
            required disabled={status === "loading" || status === "success"}
          />
          <button type="submit" disabled={status === "loading" || status === "success"}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-widest text-slate-900 hover:text-emerald-600 transition-colors disabled:opacity-50">
            {status === "loading" ? "..." : "Join"}
          </button>
        </div>
      </div>
      {message && (
        <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
          className={`text-[10px] font-medium uppercase tracking-widest ${status === "success" ? "text-emerald-600" : "text-rose-600"}`}>
          {message}
        </motion.p>
      )}
    </form>
  );
}
