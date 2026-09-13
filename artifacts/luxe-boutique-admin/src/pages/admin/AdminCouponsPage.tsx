import { useState, useEffect, useCallback } from "react";
import AdminLayout from "./AdminLayout";

const API = "/api";

type DiscountType = "PERCENTAGE" | "FIXED";

interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const EMPTY_FORM = {
  code: "",
  description: "",
  discountType: "PERCENTAGE" as DiscountType,
  discountValue: "",
  minOrderAmount: "",
  maxUses: "",
  active: true,
  expiresAt: "",
};

function fmt(n: number | null | undefined) {
  const value = Number(n);
  return (Number.isFinite(value) ? value : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeCoupon(raw: Partial<Coupon> & Record<string, unknown>): Coupon {
  const legacyType = raw.type === "fixed" ? "FIXED" : "PERCENTAGE";
  const legacyValue = raw.value;
  const legacyUsageCount = raw.usageCount;
  const now = new Date().toISOString();

  return {
    id: String(raw.id ?? ""),
    code: String(raw.code ?? ""),
    description: String(raw.description ?? ""),
    discountType: raw.discountType === "FIXED" || raw.discountType === "PERCENTAGE"
      ? raw.discountType
      : legacyType,
    discountValue: Number(raw.discountValue ?? legacyValue ?? 0),
    minOrderAmount: Number(raw.minOrderAmount ?? 0),
    maxUses: raw.maxUses == null || (raw.maxUses as any) === "" ? null : Number(raw.maxUses),
    usedCount: Number(raw.usedCount ?? legacyUsageCount ?? 0),
    active: raw.active !== false,
    expiresAt: typeof raw.expiresAt === "string" ? raw.expiresAt : null,
    createdAt: String(raw.createdAt ?? now),
    updatedAt: String(raw.updatedAt ?? now),
  };
}

function Badge({ active }: { active: boolean }) {
  return (
    <span className={`text-[9px] font-[Manrope] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${active ? "bg-[#f0faf6] text-[#006c49] border-[#c3eed8]" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function toLocalDatetimeValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const r = await fetch(`${API}/coupons`, { credentials: "include" });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to load coupons (${r.status})`);
      }
      const payload = await r.json();
      if (!Array.isArray(payload)) throw new Error("Invalid coupon response format");
      setCoupons(payload.map((coupon) => normalizeCoupon(coupon)));
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load coupons. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(c: Coupon) {
    setEditingId(c.id);
    setForm({
      code: c.code,
      description: c.description,
      discountType: c.discountType as DiscountType,
      discountValue: String(c.discountValue),
      minOrderAmount: c.minOrderAmount ? String(c.minOrderAmount) : "",
      maxUses: c.maxUses != null ? String(c.maxUses) : "",
      active: c.active,
      expiresAt: toLocalDatetimeValue(c.expiresAt),
    });
    setFormError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  async function handleSave() {
    if (!form.code.trim()) { setFormError("Coupon code is required."); return; }
    if (!form.discountValue || isNaN(Number(form.discountValue)) || Number(form.discountValue) <= 0) {
      setFormError("A valid discount value greater than 0 is required."); return;
    }
    if (form.discountType === "PERCENTAGE" && Number(form.discountValue) > 100) {
      setFormError("Percentage discount cannot exceed 100%."); return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : 0,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        active: form.active,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      };

      const url = editingId ? `${API}/coupons/${editingId}` : `${API}/coupons`;
      const method = editingId ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) { setFormError(data.error ?? "Failed to save."); return; }

      showToast(editingId ? "Coupon updated." : "Coupon created.");
      closeForm();
      load();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`${API}/coupons/${deleteId}`, { method: "DELETE", credentials: "include" });
      showToast("Coupon deleted.");
      setDeleteId(null);
      load();
    } catch {
      showToast("Failed to delete coupon.");
    } finally {
      setDeleting(false);
    }
  }

  async function toggleActive(c: Coupon) {
    try {
      await fetch(`${API}/coupons/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active: !c.active }),
      });
      showToast(`Coupon ${!c.active ? "activated" : "deactivated"}.`);
      load();
    } catch {
      showToast("Failed to update coupon.");
    }
  }

  const filtered = coupons.filter((c) => {
    const matchSearch = !search || c.code.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase());
    const matchActive = filterActive === "all" || (filterActive === "active" ? c.active : !c.active);
    return matchSearch && matchActive;
  });

  const totalActive = coupons.filter((c) => c.active).length;
  const totalUses = coupons.reduce((s, c) => s + c.usedCount, 0);
  const expiringSoon = coupons.filter((c) => c.expiresAt && new Date(c.expiresAt) < new Date(Date.now() + 7 * 86400000) && new Date(c.expiresAt) > new Date()).length;

  return (
    <AdminLayout>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-black text-white px-5 py-3 rounded-xl font-[Manrope] font-bold text-sm shadow-xl flex items-center gap-2 animate-fade-in">
          <span className="material-symbols-outlined text-[#6cf8bb] text-base">check_circle</span>
          {toast}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-red-500 text-2xl">delete</span>
            </div>
            <h3 className="font-serif text-xl font-semibold mb-2">Delete Coupon?</h3>
            <p className="text-sm text-[#7c839b] font-[Manrope] mb-6">This action cannot be undone. The coupon code will no longer be usable.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-slate-200 rounded-lg font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-500 text-white rounded-lg font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-red-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {deleting ? <span className="material-symbols-outlined text-sm animate-spin">refresh</span> : null}
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-[32px] font-semibold tracking-tight mb-1">Coupons & Discounts</h1>
            <p className="text-sm text-[#7c839b] font-[Manrope]">{coupons.length} coupon{coupons.length !== 1 ? "s" : ""} · {totalActive} active</p>
          </div>
          <button onClick={openCreate}
            className="px-6 py-3 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors rounded-xl flex items-center gap-2 shadow-sm">
            <span className="material-symbols-outlined text-sm">add</span> Create Coupon
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Coupons", value: coupons.length, icon: "sell", color: "text-[#006c49]" },
            { label: "Active Coupons", value: totalActive, icon: "check_circle", color: "text-[#006c49]" },
            { label: "Total Uses", value: totalUses, icon: "confirmation_number", color: "text-blue-600" },
            { label: "Expiring (7 days)", value: expiringSoon, icon: "schedule", color: expiringSoon > 0 ? "text-amber-600" : "text-slate-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className={`material-symbols-outlined text-lg ${s.color}`}>{s.icon}</span>
                <span className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#7c839b]">{s.label}</span>
              </div>
              <p className="font-serif text-3xl font-semibold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Create / Edit Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
              <h2 className="font-serif text-xl font-semibold">{editingId ? "Edit Coupon" : "Create New Coupon"}</h2>
              <button onClick={closeForm} className="p-2 text-slate-400 hover:text-black transition-colors rounded-lg hover:bg-slate-50">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-8 grid grid-cols-12 gap-6">
              {/* Code */}
              <div className="col-span-12 md:col-span-4 space-y-1.5">
                <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d]">Coupon Code *</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. SUMMER20"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-mono text-sm outline-none focus:border-[#006c49] transition-colors uppercase"
                />
              </div>
              {/* Discount Type */}
              <div className="col-span-6 md:col-span-4 space-y-1.5">
                <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d]">Discount Type *</label>
                <div className="flex rounded-xl overflow-hidden border border-slate-200">
                  {(["PERCENTAGE", "FIXED"] as DiscountType[]).map((t) => (
                    <button key={t} onClick={() => setForm((p) => ({ ...p, discountType: t }))}
                      className={`flex-1 py-2.5 font-[Manrope] font-bold text-[10px] tracking-widest uppercase transition-colors ${form.discountType === t ? "bg-black text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
                      {t === "PERCENTAGE" ? "%" : "$"} {t === "PERCENTAGE" ? "Percent" : "Fixed"}
                    </button>
                  ))}
                </div>
              </div>
              {/* Discount Value */}
              <div className="col-span-6 md:col-span-4 space-y-1.5">
                <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d]">
                  Discount Value * {form.discountType === "PERCENTAGE" ? "(0–100%)" : "($ amount)"}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7c839b] font-[Manrope] font-bold text-sm">
                    {form.discountType === "PERCENTAGE" ? "%" : "$"}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={form.discountType === "PERCENTAGE" ? 100 : undefined}
                    value={form.discountValue}
                    onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))}
                    placeholder="20"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-2.5 text-sm font-[Manrope] outline-none focus:border-[#006c49] transition-colors"
                  />
                </div>
              </div>
              {/* Description */}
              <div className="col-span-12 space-y-1.5">
                <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d]">Description (internal note)</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Summer sale campaign — 20% off sitewide"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-[Manrope] outline-none focus:border-[#006c49] transition-colors"
                />
              </div>
              {/* Min Order */}
              <div className="col-span-12 md:col-span-4 space-y-1.5">
                <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d]">Min. Order Amount ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7c839b] font-mono text-sm">$</span>
                  <input
                    type="number" min="0"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm((p) => ({ ...p, minOrderAmount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-4 py-2.5 text-sm font-[Manrope] outline-none focus:border-[#006c49] transition-colors"
                  />
                </div>
                <p className="text-[11px] text-[#7c839b] font-[Manrope] italic">Leave blank for no minimum.</p>
              </div>
              {/* Max Uses */}
              <div className="col-span-12 md:col-span-4 space-y-1.5">
                <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d]">Usage Limit</label>
                <input
                  type="number" min="1"
                  value={form.maxUses}
                  onChange={(e) => setForm((p) => ({ ...p, maxUses: e.target.value }))}
                  placeholder="Unlimited"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-[Manrope] outline-none focus:border-[#006c49] transition-colors"
                />
                <p className="text-[11px] text-[#7c839b] font-[Manrope] italic">Leave blank for unlimited uses.</p>
              </div>
              {/* Expiry */}
              <div className="col-span-12 md:col-span-4 space-y-1.5">
                <label className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#45464d]">Expiry Date & Time</label>
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-[Manrope] outline-none focus:border-[#006c49] transition-colors"
                />
                <p className="text-[11px] text-[#7c839b] font-[Manrope] italic">Leave blank for no expiry.</p>
              </div>
              {/* Active Toggle */}
              <div className="col-span-12 flex items-center gap-3">
                <button
                  onClick={() => setForm((p) => ({ ...p, active: !p.active }))}
                  className={`relative w-10 h-6 rounded-full transition-colors ${form.active ? "bg-[#006c49]" : "bg-slate-200"}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.active ? "left-5" : "left-1"}`} />
                </button>
                <span className="font-[Manrope] text-sm font-bold">{form.active ? "Active — coupon can be used" : "Inactive — coupon is disabled"}</span>
              </div>
              {/* Error */}
              {formError && (
                <div className="col-span-12 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-[Manrope] font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">error</span>{formError}
                </div>
              )}
              {/* Actions */}
              <div className="col-span-12 flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="px-8 py-3 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] disabled:opacity-60 transition-colors rounded-xl flex items-center gap-2">
                  <span className={`material-symbols-outlined text-sm ${saving ? "animate-spin" : ""}`}>{saving ? "refresh" : "save"}</span>
                  {saving ? "Saving…" : editingId ? "Update Coupon" : "Create Coupon"}
                </button>
                <button onClick={closeForm} className="px-6 py-3 border border-slate-200 font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-slate-50 transition-colors rounded-xl">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code or description…"
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-[Manrope] outline-none focus:border-[#006c49] transition-colors"
            />
          </div>
          <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button key={f} onClick={() => setFilterActive(f)}
                className={`px-4 py-2.5 font-[Manrope] font-bold text-[10px] tracking-widest uppercase transition-colors ${filterActive === f ? "bg-black text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-[#7c839b]">
              <span className="material-symbols-outlined animate-spin text-2xl">refresh</span>
              <span className="font-[Manrope] text-sm">Loading coupons…</span>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-500">
              <span className="material-symbols-outlined text-3xl">error</span>
              <p className="font-[Manrope] font-bold text-sm">{loadError}</p>
              <button onClick={load} className="mt-2 px-5 py-2 border border-red-200 rounded-lg font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-red-50 transition-colors">
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#7c839b]">
              <span className="material-symbols-outlined text-4xl">sell</span>
              <p className="font-[Manrope] font-bold text-sm">{coupons.length === 0 ? "No coupons yet. Create your first one!" : "No coupons match your filters."}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-[#f8f9ff]">
                  {["Code", "Discount", "Min. Order", "Uses", "Expiry", "Status", ""].map((h) => (
                    <th key={h} className="text-left font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#7c839b] px-6 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((c) => {
                  const isExpired = c.expiresAt ? new Date() > new Date(c.expiresAt) : false;
                  const isExpiringSoon = c.expiresAt && !isExpired && new Date(c.expiresAt) < new Date(Date.now() + 7 * 86400000);
                  return (
                    <tr key={c.id} className="hover:bg-[#f8f9ff] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm tracking-widest bg-slate-100 px-2.5 py-1 rounded-lg">{c.code}</span>
                        </div>
                        {c.description && <p className="text-[11px] text-[#7c839b] font-[Manrope] mt-0.5 truncate max-w-[200px]">{c.description}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-serif text-lg font-semibold text-[#006c49]">
                          {c.discountType === "PERCENTAGE" ? `${c.discountValue}%` : `$${fmt(c.discountValue)}`}
                        </span>
                        <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mt-0.5">
                          {c.discountType === "PERCENTAGE" ? "Percentage" : "Fixed Amount"}
                        </p>
                      </td>
                      <td className="px-6 py-4 font-[Manrope] text-sm text-[#45464d]">
                        {c.minOrderAmount > 0 ? `$${fmt(c.minOrderAmount)}` : <span className="text-slate-400">None</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-[Manrope] font-bold text-sm">{c.usedCount}</span>
                        {c.maxUses != null && (
                          <span className="text-[#7c839b] font-[Manrope] text-sm"> / {c.maxUses}</span>
                        )}
                        {c.maxUses == null && <span className="text-[10px] font-[Manrope] text-slate-400 ml-1">unlimited</span>}
                        {c.maxUses != null && c.usedCount >= c.maxUses && (
                          <span className="ml-2 text-[9px] font-[Manrope] font-bold uppercase tracking-widest text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">Maxed</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-[Manrope] text-sm">
                        {c.expiresAt ? (
                          <span className={isExpired ? "text-red-500 font-bold" : isExpiringSoon ? "text-amber-600 font-bold" : "text-[#45464d]"}>
                            {new Date(c.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {isExpired && <span className="block text-[9px] font-bold uppercase tracking-widest">Expired</span>}
                            {isExpiringSoon && !isExpired && <span className="block text-[9px] font-bold uppercase tracking-widest">Soon</span>}
                          </span>
                        ) : (
                          <span className="text-slate-400">Never</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => toggleActive(c)} title={c.active ? "Click to deactivate" : "Click to activate"}>
                          <Badge active={c.active} />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(c)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-black transition-colors" title="Edit">
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button onClick={() => { navigator.clipboard.writeText(c.code).catch(() => {}); showToast(`"${c.code}" copied.`); }}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-[#006c49] transition-colors" title="Copy code">
                            <span className="material-symbols-outlined text-base">content_copy</span>
                          </button>
                          <button onClick={() => setDeleteId(c.id)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
