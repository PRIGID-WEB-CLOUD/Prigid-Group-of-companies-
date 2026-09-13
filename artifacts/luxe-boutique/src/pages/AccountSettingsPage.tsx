import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import AccountSidebar from "@/components/AccountSidebar";

export default function AccountSettingsPage() {
  const { user, loading, refetch } = useAuth();
  const [, navigate] = useLocation();
  const isCustomer = Boolean(user) && (!user?.role || ["CUSTOMER", "ADMIN", "SUPER_ADMIN"].includes(user.role.toUpperCase()));
  const [name, setName] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
    else if (!loading && user && !isCustomer) navigate("/");
    if (user) setName(user.name || "");
  }, [user, loading, navigate, isCustomer]);

  if (loading || !user || !isCustomer) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const body: Record<string, string> = { name };
      if (newPw) { body.currentPassword = currentPw; body.newPassword = newPw; }
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setMsg({ type: "ok", text: "Your details have been updated." });
      setCurrentPw(""); setNewPw("");
      await refetch();
    } catch (err: any) {
      setMsg({ type: "err", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-24 pb-16 px-4 max-w-7xl mx-auto">
      <div className="flex gap-12">
        <AccountSidebar />
        <div className="flex-1 max-w-xl">
          <h1 className="font-serif text-3xl text-slate-900 mb-2">Account Settings</h1>
          <p className="text-slate-500 mb-8 text-sm">Update your display name and password.</p>

          {msg && (
            <div className={`mb-6 px-4 py-3 text-sm rounded ${msg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 block mb-2">Display Name</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full border-b border-slate-200 py-3 text-sm focus:outline-none focus:border-slate-900 bg-transparent transition-colors"
              />
            </div>

            <div className="pt-6 border-t border-slate-100">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-4">Change Password <span className="normal-case font-normal text-slate-400">(leave blank to keep current)</span></p>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block mb-2">Current Password</label>
                  <input
                    type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                    className="w-full border-b border-slate-200 py-3 text-sm focus:outline-none focus:border-slate-900 bg-transparent transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block mb-2">New Password</label>
                  <input
                    type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                    className="w-full border-b border-slate-200 py-3 text-sm focus:outline-none focus:border-slate-900 bg-transparent transition-colors"
                  />
                </div>
              </div>
            </div>

            <button type="submit" disabled={saving}
              className="mt-4 px-10 py-4 bg-slate-900 text-white text-xs tracking-widest uppercase font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
