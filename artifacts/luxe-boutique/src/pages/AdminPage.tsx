import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import AccountSidebar from "@/components/AccountSidebar";
import { Package, CheckCircle2, XCircle, RefreshCw, Eye, ArrowRight, AlertTriangle, Plug } from "lucide-react";

interface StagedProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  stock: number;
  tags: string | null;
  status: string;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  status: string;
  imageUrl: string | null;
  tags: string | null;
  createdAt: string;
  category?: { name: string } | null;
}

type Tab = "overview" | "eprolo" | "products";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");

  const [eproloConfigured, setEproloConfigured] = useState(false);
  const [staged, setStaged] = useState<StagedProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [stagedLoading, setStagedLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== "ADMIN")) navigate("/login");
  }, [user, loading, navigate]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadEproloStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/eprolo/configured");
      if (r.ok) {
        const d = await r.json();
        setEproloConfigured(d.configured);
      }
    } catch {}
  }, []);

  const loadStaged = useCallback(async () => {
    setStagedLoading(true);
    try {
      const r = await fetch("/api/eprolo/staged");
      if (r.ok) setStaged(await r.json());
    } catch {}
    setStagedLoading(false);
  }, []);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const r = await fetch("/api/products");
      if (r.ok) {
        const all = await r.json();
        setProducts(Array.isArray(all) ? all : []);
      }
    } catch {}
    setProductsLoading(false);
  }, []);

  useEffect(() => {
    if (user?.role === "ADMIN") {
      loadEproloStatus();
    }
  }, [user, loadEproloStatus]);

  useEffect(() => {
    if (tab === "eprolo" && user?.role === "ADMIN") loadStaged();
    if (tab === "products" && user?.role === "ADMIN") loadProducts();
  }, [tab, user, loadStaged, loadProducts]);

  const handlePublish = async (id: string) => {
    setPublishing(id);
    try {
      const r = await fetch(`/api/eprolo/staged/${id}/publish`, { method: "POST" });
      if (r.ok) {
        showToast("Product published to live catalog!");
        setStaged(s => s.filter(p => p.id !== id));
      } else {
        const d = await r.json();
        showToast(d.error || "Publish failed", false);
      }
    } catch { showToast("Network error", false); }
    setPublishing(null);
  };

  const handleReject = async (id: string) => {
    if (!confirm("Delete this draft product? This cannot be undone.")) return;
    try {
      const r = await fetch(`/api/eprolo/staged/${id}`, { method: "DELETE" });
      if (r.ok) {
        showToast("Draft product removed.");
        setStaged(s => s.filter(p => p.id !== id));
      } else showToast("Delete failed", false);
    } catch { showToast("Network error", false); }
  };

  const handleManualSync = async (product: Product) => {
    setSyncing(product.id);
    try {
      const r = await fetch(`/api/products/${product.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: product.stock, status: product.status }),
      });
      if (r.ok) {
        const d = await r.json();
        showToast(`"${product.name}" synced at ${new Date(d.syncedAt).toLocaleTimeString()}`);
        setProducts(ps => ps.map(p => p.id === product.id ? { ...p, ...d.product } : p));
      } else showToast("Sync failed", false);
    } catch { showToast("Network error", false); }
    setSyncing(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }
  if (!user || user.role !== "ADMIN") return null;

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "overview", label: "Overview" },
    ...(eproloConfigured ? [{ key: "eprolo" as Tab, label: "Eprolo Staging", badge: staged.length || undefined }] : []),
    { key: "products", label: "Products" },
  ];

  return (
    <div className="pt-24 pb-16 px-4 max-w-7xl mx-auto">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 transition-all ${toast.ok ? "bg-slate-900 text-white" : "bg-red-600 text-white"}`}>
          {toast.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="flex gap-12">
        <AccountSidebar />
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-3xl text-slate-900 mb-1">Admin Dashboard</h1>
          <p className="text-slate-400 text-sm mb-8">Manage products, review Eprolo imports, and sync your catalog.</p>

          <div className="flex gap-1 mb-8 border-b border-slate-100">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors relative ${tab === t.key ? "text-slate-900 border-b-2 border-slate-900 -mb-px" : "text-slate-400 hover:text-slate-600"}`}>
                {t.label}
                {t.badge ? (
                  <span className="ml-2 bg-amber-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">{t.badge}</span>
                ) : null}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <button onClick={() => setTab("products")}
                  className="border border-slate-200 rounded-2xl p-6 text-left hover:border-slate-400 transition-colors group">
                  <Package size={22} className="text-slate-400 mb-3" />
                  <p className="text-xs tracking-widest uppercase text-slate-400 mb-1">Products</p>
                  <p className="font-serif text-xl text-slate-900 group-hover:text-slate-700">Manage catalog</p>
                  <ArrowRight size={14} className="mt-3 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                </button>

                {eproloConfigured ? (
                  <button onClick={() => { setTab("eprolo"); loadStaged(); }}
                    className="border border-amber-200 rounded-2xl p-6 text-left hover:border-amber-400 bg-amber-50/30 transition-colors group">
                    <RefreshCw size={22} className="text-amber-500 mb-3" />
                    <p className="text-xs tracking-widest uppercase text-amber-500 mb-1">Eprolo Staging</p>
                    <p className="font-serif text-xl text-slate-900 group-hover:text-slate-700">Review imports</p>
                    <ArrowRight size={14} className="mt-3 text-amber-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                  </button>
                ) : (
                  <div className="border border-slate-100 rounded-2xl p-6 bg-slate-50 opacity-60">
                    <Plug size={22} className="text-slate-300 mb-3" />
                    <p className="text-xs tracking-widest uppercase text-slate-300 mb-1">Eprolo</p>
                    <p className="text-sm text-slate-400">Connect Eprolo in Providers to unlock import staging.</p>
                  </div>
                )}

                <div className="border border-slate-200 rounded-2xl p-6">
                  <AlertTriangle size={22} className="text-slate-400 mb-3" />
                  <p className="text-xs tracking-widest uppercase text-slate-400 mb-1">Orders</p>
                  <p className="font-serif text-xl text-slate-900">Auto-forwarded</p>
                  <p className="text-xs text-slate-400 mt-2">Eprolo dropship orders are auto-submitted on checkout.</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <h2 className="font-serif text-lg text-slate-900 mb-1">How it works</h2>
                <ul className="text-sm text-slate-500 space-y-2 mt-3">
                  <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span> Import products from Eprolo → they land in <strong className="text-slate-700">Staging</strong> (DRAFT, not visible to customers).</li>
                  <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span> Review each import here — edit name/price, then click <strong className="text-slate-700">Publish</strong> to make it live.</li>
                  <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span> When a customer orders an Eprolo product, the fulfillment order is <strong className="text-slate-700">auto-submitted</strong> to Eprolo.</li>
                  <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span> Manually-added products can be <strong className="text-slate-700">synced</strong> at any time from the Products tab.</li>
                </ul>
              </div>
            </div>
          )}

          {tab === "eprolo" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-xl text-slate-900">Eprolo Staging Queue</h2>
                  <p className="text-sm text-slate-400 mt-0.5">These products were imported from Eprolo and are awaiting your review before going live.</p>
                </div>
                <button onClick={loadStaged}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">
                  <RefreshCw size={14} className={stagedLoading ? "animate-spin" : ""} /> Refresh
                </button>
              </div>

              {stagedLoading ? (
                <div className="flex items-center justify-center py-20 text-slate-300">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-300" />
                </div>
              ) : staged.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-slate-200 rounded-2xl">
                  <CheckCircle2 size={40} className="text-slate-200 mx-auto mb-4" />
                  <p className="font-serif text-lg text-slate-400">No products awaiting review</p>
                  <p className="text-sm text-slate-300 mt-1">Import products from Eprolo and they'll appear here first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {staged.map(p => (
                    <div key={p.id} className="border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-colors">
                      <div className="flex">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-28 h-28 object-cover shrink-0" />
                        ) : (
                          <div className="w-28 h-28 bg-slate-100 shrink-0 flex items-center justify-center">
                            <Package size={24} className="text-slate-300" />
                          </div>
                        )}
                        <div className="flex-1 p-4 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium text-slate-900 text-sm leading-tight truncate">{p.name}</h3>
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">DRAFT</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.description}</p>
                          <p className="text-sm font-bold text-slate-900 mt-2">₦{p.price.toLocaleString()}</p>
                          <div className="flex gap-2 mt-3">
                            <button
                              disabled={publishing === p.id}
                              onClick={() => handlePublish(p.id)}
                              className="flex-1 flex items-center justify-center gap-1.5 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
                              {publishing === p.id ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                              Publish
                            </button>
                            <button
                              onClick={() => handleReject(p.id)}
                              className="flex-1 flex items-center justify-center gap-1.5 border border-red-200 text-red-500 text-[10px] font-bold uppercase tracking-widest py-2 rounded-lg hover:bg-red-50 transition-colors">
                              <XCircle size={12} /> Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "products" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-xl text-slate-900">Product Catalog</h2>
                  <p className="text-sm text-slate-400 mt-0.5">All active and draft products. Use Sync to push manual updates.</p>
                </div>
                <button onClick={loadProducts}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">
                  <RefreshCw size={14} className={productsLoading ? "animate-spin" : ""} /> Refresh
                </button>
              </div>

              {productsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-300" />
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-slate-200 rounded-2xl">
                  <Package size={40} className="text-slate-200 mx-auto mb-4" />
                  <p className="font-serif text-lg text-slate-400">No products yet</p>
                </div>
              ) : (
                <div className="overflow-hidden border border-slate-100 rounded-2xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Product</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">Price</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">Stock</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {products.map(p => {
                        const isEprolo = p.tags?.includes("eprolo");
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {p.imageUrl ? (
                                  <img src={p.imageUrl} alt={p.name} className="w-9 h-9 object-cover rounded-lg" />
                                ) : (
                                  <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
                                    <Package size={14} className="text-slate-300" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-slate-900 text-xs leading-tight">{p.name}</p>
                                  {isEprolo && <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wide">Eprolo</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 hidden md:table-cell">₦{p.price.toLocaleString()}</td>
                            <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{p.stock}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                p.status === "ACTIVE" ? "bg-emerald-100 text-emerald-600" :
                                p.status === "DRAFT"  ? "bg-amber-100 text-amber-600" :
                                "bg-slate-100 text-slate-500"
                              }`}>{p.status}</span>
                            </td>
                            <td className="px-4 py-3">
                              {!isEprolo && (
                                <button
                                  disabled={syncing === p.id}
                                  onClick={() => handleManualSync(p)}
                                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40">
                                  <RefreshCw size={11} className={syncing === p.id ? "animate-spin" : ""} /> Sync
                                </button>
                              )}
                              {isEprolo && p.status === "DRAFT" && (
                                <button
                                  disabled={publishing === p.id}
                                  onClick={() => handlePublish(p.id)}
                                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40">
                                  <Eye size={11} /> Publish
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
