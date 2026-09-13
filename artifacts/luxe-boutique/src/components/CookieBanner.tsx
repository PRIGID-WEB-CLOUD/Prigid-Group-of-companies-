import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "wouter";

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) Promise.resolve().then(() => setIsVisible(true));
  }, []);

  const handleAccept = () => { localStorage.setItem("cookieConsent", "accepted"); setIsVisible(false); };
  const handleDecline = () => { localStorage.setItem("cookieConsent", "declined"); setIsVisible(false); };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.5 }}
          className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-900 text-white p-6 sm:px-8 sm:py-6 shadow-2xl">
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              We use cookies to elevate your experience within our digital atelier. Read more in our{" "}
              <Link href="/privacy" className="underline underline-offset-4 hover:text-emerald-400 transition-colors">Privacy Policy</Link>.
            </p>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <button onClick={handleDecline} className="flex-1 sm:flex-none px-6 py-3 border border-slate-700 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all text-slate-300">
                Decline
              </button>
              <button onClick={handleAccept} className="flex-1 sm:flex-none px-6 py-3 bg-white text-slate-900 border border-white text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all">
                Accept All
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
