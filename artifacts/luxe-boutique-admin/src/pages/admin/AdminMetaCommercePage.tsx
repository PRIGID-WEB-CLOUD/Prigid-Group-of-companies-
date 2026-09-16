import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { SiMeta } from "react-icons/si";
import { MdCloudUpload, MdLink, MdDelete, MdKey, MdCheckCircle } from "react-icons/md";
import AdminLayout from "./AdminLayout";

type Tab = "credentials" | "catalog" | "products" | "sync";

interface CatalogInfo { id: string; name: string; product_count: number; vertical?: string; }
interface CatalogProduct { id: string; name: string; retailer_id: string; price: string; currency: string; availability: string; condition?: string; description?: string; image_url?: string; url?: string; }
interface CatalogSettings { id: string; includedCategories: string[]; minPrice: number; maxPrice: number; }

const ALL_CATEGORIES = ["Ready-to-Wear","Footwear","Accessories","Bags & Luggage","Jewellery","Outerwear","Swimwear"];

function CredField({ label, hint, value, onChange, type = "text" }: { label: string; hint: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={hint} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006c49]/20 focus:border-[#006c49] font-mono" />
    </div>
  );
}

export default function AdminMetaCommercePage() {
  const [tab, setTab] = useState<Tab>("credentials");
  const [creds, setCreds] = useState({ catalog_id: "", page_access_token: "", source: "" });
  const [metaStatus, setMetaStatus] = useState<{ connected: boolean; business?: { id: string; name: string } } | null>(null);
  const [saving, setSaving] = useState(false); const [saveMsg, setSaveMsg] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoveredCatalogs, setDiscoveredCatalogs] = useState<{ id: string; name: string }[] | null>(null);
  const [catalogInfo, setCatalogInfo] = useState<CatalogInfo | null>(null);
  const [catalogErr, setCatalogErr] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [isEditingCatalogName, setIsEditingCatalogName] = useState(false);
  const [newCatalogName, setNewCatalogName] = useState("");
  const [catalogNameSaving, setCatalogNameSaving] = useState(false);
  const [catalogNameMsg, setCatalogNameMsg] = useState("");

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsErr, setProductsErr] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "in stock" | "out of stock">("all");

  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    price: "",
    availability: "in stock",
    condition: "new",
    description: "",
    imageUrl: "",
  });
  const [productSaving, setProductSaving] = useState(false);
  const [productActionMsg, setProductActionMsg] = useState("");

  // Add Product to Meta modal
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [addForm, setAddForm] = useState({
    retailerId: "",
    title: "",
    price: "",
    availability: "in stock",
    condition: "new",
    description: "",
    imageUrl: "",
    category: "Apparel & Accessories",
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  const [copiedFeed, setCopiedFeed] = useState(false);

  // Delete product confirmation
  const [deletingProduct, setDeletingProduct] = useState<CatalogProduct | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [editMediaSource, setEditMediaSource] = useState<"upload" | "url">("upload");
  const [editUploading, setEditUploading] = useState(false);
  const [editUploadErr, setEditUploadErr] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [addMediaSource, setAddMediaSource] = useState<"upload" | "url">("upload");
  const [addUploading, setAddUploading] = useState(false);
  const [addUploadErr, setAddUploadErr] = useState<string | null>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  const handleEditFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setEditUploadErr("Please upload an image file.");
      return;
    }
    setEditUploading(true);
    setEditUploadErr(null);
    const formData = new FormData();
    formData.append("files", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const url = data.urls?.[0] || data.url;
      if (url) {
        setEditForm((prev) => ({ ...prev, imageUrl: url }));
      }
    } catch (err: any) {
      setEditUploadErr(err.message || "Failed to upload image.");
    } finally {
      setEditUploading(false);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    }
  };

  const handleAddFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setAddUploadErr("Please upload an image file.");
      return;
    }
    setAddUploading(true);
    setAddUploadErr(null);
    const formData = new FormData();
    formData.append("files", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const url = data.urls?.[0] || data.url;
      if (url) {
        setAddForm((prev) => ({ ...prev, imageUrl: url }));
      }
    } catch (err: any) {
      setAddUploadErr(err.message || "Failed to upload image.");
    } finally {
      setAddUploading(false);
      if (addFileInputRef.current) addFileInputRef.current.value = "";
    }
  };

  const [settings, setSettings] = useState<CatalogSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState("");
  const [prodDomain, setProdDomain] = useState(() => (typeof window !== "undefined" ? window.location.host : ""));
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState("");

  useEffect(() => {
    fetch("/api/channels/credentials/commerce", { credentials: "include" })
      .then((r) => r.json()).then((data: any) => {
        setCreds({
          catalog_id: data.catalog_id ?? "",
          page_access_token: data.page_access_token ?? "",
          source: data.source ?? "",
        });
        if (data.discovered_catalogs) {
          setDiscoveredCatalogs(data.discovered_catalogs);
        }
      }).catch(() => {});
    fetch("/api/facebook/catalog", { credentials: "include" })
      .then((r) => r.json()).then(setSettings).catch(() => {});
    fetch("/api/channels/meta/status", { credentials: "include" })
      .then((r) => r.json()).then(setMetaStatus).catch(() => {});
  }, []);

  async function saveCreds() {
    setSaving(true); setSaveMsg("");
    try {
      await fetch("/api/channels/credentials/commerce", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(creds),
      });
      setSaveMsg("Credentials saved.");
    } catch { setSaveMsg("Save failed."); }
    setSaving(false);
  }

  async function discoverCatalogs() {
    setDiscovering(true); setSaveMsg("");
    try {
      const res = await fetch("/api/facebook/catalog/discover", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ page_access_token: creds.page_access_token })
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMsg(data.error || "Discover failed.");
      } else {
        setDiscoveredCatalogs(data.catalogs || []);
        setSaveMsg(`Found ${data.catalogs?.length || 0} catalog(s).`);
      }
    } catch { setSaveMsg("Network error."); }
    setDiscovering(false);
  }

  async function fetchCatalog() {
    setCatalogLoading(true); setCatalogErr(""); setCatalogNameMsg("");
    try {
      const r = await fetch("/api/facebook/catalog/info", { credentials: "include" });
      const d = await r.json();
      if (!r.ok) {
        setCatalogErr(d.error ?? "Failed");
      } else {
        setCatalogInfo(d);
        setNewCatalogName(d.name || "");
      }
    } catch { setCatalogErr("Network error"); }
    setCatalogLoading(false);
  }

  async function handleSaveCatalogName() {
    if (!newCatalogName.trim()) return;
    setCatalogNameSaving(true);
    setCatalogNameMsg("");
    try {
      const r = await fetch("/api/facebook/catalog/info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newCatalogName.trim() }),
      });
      const d = await r.json();
      if (!r.ok) {
        setCatalogNameMsg(d.error || "Failed to update catalog name on Meta.");
      } else {
        setCatalogInfo((prev) => prev ? { ...prev, name: newCatalogName.trim() } : null);
        setIsEditingCatalogName(false);
        setCatalogNameMsg("Catalog name successfully updated on Meta Commerce.");
      }
    } catch {
      setCatalogNameMsg("Network error updating catalog.");
    }
    setCatalogNameSaving(false);
  }

  async function fetchProducts() {
    setProductsLoading(true); setProductsErr(""); setProductActionMsg("");
    try {
      const r = await fetch("/api/facebook/catalog/products", { credentials: "include" });
      const d = await r.json();
      if (!r.ok) setProductsErr(d.error ?? "Failed"); else setProducts(d.data ?? []);
    } catch { setProductsErr("Network error"); }
    setProductsLoading(false);
  }

  function startEditProduct(p: CatalogProduct) {
    const rawPrice = (p.price || "").replace(/[^0-9.]/g, "");
    setEditingProduct(p);
    setEditForm({
      title: p.name || "",
      price: rawPrice || "0",
      availability: p.availability === "in stock" ? "in stock" : "out of stock",
      condition: p.condition || "new",
      description: p.description || "",
      imageUrl: p.image_url || "",
    });
  }

  async function handleSaveProduct() {
    if (!editingProduct) return;
    setProductSaving(true);
    try {
      const r = await fetch(`/api/facebook/catalog/products/${encodeURIComponent(editingProduct.retailer_id || editingProduct.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editForm),
      });
      const d = await r.json();
      if (!r.ok) {
        setProductActionMsg(`Error: ${d.error || "Failed to update product on Meta Commerce."}`);
      } else {
        setProducts((prev) =>
          prev.map((item) =>
            item.id === editingProduct.id || item.retailer_id === editingProduct.retailer_id
              ? {
                  ...item,
                  name: editForm.title,
                  price: editForm.price,
                  availability: editForm.availability,
                  condition: editForm.condition,
                  description: editForm.description,
                  image_url: editForm.imageUrl || item.image_url,
                }
              : item
          )
        );
        setEditingProduct(null);
        setProductActionMsg(`Product "${editForm.title}" locally updated. (Note: Meta may take a few seconds to reflect these changes globally.)`);
      }
    } catch {
      setProductActionMsg("Network error updating product.");
    }
    setProductSaving(false);
  }

  async function handleAddProduct() {
    if (!addForm.title.trim() || !addForm.price.trim()) {
      setAddError("Title and Price are required.");
      return;
    }
    setAddSaving(true);
    setAddError("");
    try {
      const r = await fetch("/api/facebook/catalog/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(addForm),
      });
      const d = await r.json();
      if (!r.ok) {
        setAddError(d.error || "Failed to add product to Meta Catalog.");
      } else {
        setIsAddingProduct(false);
        setAddForm({
          retailerId: "",
          title: "",
          price: "",
          availability: "in stock",
          condition: "new",
          description: "",
          imageUrl: "",
          category: "Apparel & Accessories",
        });
        setProductActionMsg(`Product "${addForm.title}" added to Meta Catalog.`);
        fetchProducts();
      }
    } catch {
      setAddError("Network error adding product.");
    }
    setAddSaving(false);
  }

  
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (visibleIds: string[]) => {
    if (selectedIds.size === visibleIds.length && visibleIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !confirm(`Are you sure you want to delete ${selectedIds.size} products from Meta?`)) return;
    setIsBulkLoading(true);
    try {
      const res = await fetch("/api/facebook/catalog/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: "DELETE" })
      });
      if (!res.ok) throw new Error("Failed to bulk delete");
      setProductActionMsg(`Deleted ${selectedIds.size} products from Meta.`);
      setProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
    } catch (e: any) {
      setProductActionMsg(`Error: ${e.message}`);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkUpdateAvailability = async (avail: string) => {
    if (selectedIds.size === 0 || !confirm(`Update ${selectedIds.size} products to ${avail}?`)) return;
    setIsBulkLoading(true);
    try {
      const res = await fetch("/api/facebook/catalog/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: "UPDATE", updates: { availability: avail } })
      });
      if (!res.ok) throw new Error("Failed to bulk update");
      setProductActionMsg(`Updated ${selectedIds.size} products to ${avail} on Meta.`);
      setProducts(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, availability: avail } : p));
      setSelectedIds(new Set());
    } catch (e: any) {
      setProductActionMsg(`Error: ${e.message}`);
    } finally {
      setIsBulkLoading(false);
    }
  };

  async function handleConfirmDeleteProduct() {
    if (!deletingProduct) return;
    const graphId = deletingProduct.id;
    const retailerId = deletingProduct.retailer_id || "";
    setDeleteSaving(true);
    try {
      const url = `/api/facebook/catalog/products/${encodeURIComponent(graphId)}?retailerId=${encodeURIComponent(retailerId)}`;
      const r = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) {
        setProductActionMsg(`Error: ${d.error || "Failed to delete product from Meta."}`);
      } else {
        setProducts((prev) => prev.filter((item) => item.id !== deletingProduct.id));
        setProductActionMsg(`Product "${deletingProduct.name}" permanently removed from Meta Catalog.`);
        setDeletingProduct(null);
      }
    } catch {
      setProductActionMsg("Network error deleting product from Meta.");
    }
    setDeleteSaving(false);
  }

  async function syncProducts() {
    setSyncing(true); setSyncResult("");
    try {
      const r = await fetch("/api/facebook/catalog/sync", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ storeDomain: prodDomain }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setSyncResult(`Error: ${d.error || (d.errors && d.errors[0]) || "Catalog sync failed."}`);
      } else {
        setSyncResult(d.message || `Synced ${d.synced} product(s) to Meta Commerce catalog.`);
        fetchProducts();
      }
    } catch { setSyncResult("Network error during sync."); }
    setSyncing(false);
  }

  async function saveCatalogSettings() {
    if (!settings) return;
    setSettingsSaving(true);
    setSettingsSavedMsg("");
    try {
      await fetch("/api/facebook/catalog", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(settings),
      });
      setSettingsSavedMsg("Sync rules & price limits saved successfully.");
    } catch {
      setSettingsSavedMsg("Failed to save rules.");
    }
    setSettingsSaving(false);
  }

  function toggleCategory(cat: string) {
    if (!settings) return;
    const has = settings.includedCategories.includes(cat);
    setSettings({ ...settings, includedCategories: has ? settings.includedCategories.filter((c) => c !== cat) : [...settings.includedCategories, cat] });
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "credentials", label: "Credentials", icon: "key" },
    { id: "catalog",     label: "Catalog",     icon: "inventory_2" },
    { id: "products",    label: "Products",    icon: "shopping_bag" },
    { id: "sync",        label: "Sync Rules",  icon: "sync" },
  ];

  return (
    <AdminLayout sidebar="channels">
      <div className="flex-1 ml-0 p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/channels" className="text-slate-400 hover:text-slate-600 transition-colors">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </Link>
          <div className="w-10 h-10 rounded-xl bg-[#1877F2] flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-xl">storefront</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900" style={{ fontFamily: "Noto Serif, serif" }}>Meta Commerce</h1>
            <p className="text-xs text-slate-500">Sync your product catalog to Meta Commerce and Facebook Shop</p>
          </div>
        </div>

        <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); if (t.id === "catalog") fetchCatalog(); if (t.id === "products") fetchProducts(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <span className="material-symbols-outlined text-base">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {tab === "credentials" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <MdKey className="text-2xl text-slate-400" />
                <div>
                  <p className="text-sm font-[Manrope] font-bold text-black">Managed via Platform Environment Variables</p>
                  <p className="text-xs font-[Manrope] text-slate-500 mt-1">Manual entry of Meta Commerce credentials is disabled in this environment.</p>
                </div>
              </div>
              <ul className="space-y-2 text-xs font-[Manrope] text-slate-600 list-disc list-inside">
                <li><span className="font-bold text-slate-800">Product Catalog ID</span></li>
                <li><span className="font-bold text-slate-800">Page Access Token</span></li>
              </ul>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-xs font-semibold text-blue-900 mb-2">Required Permissions</p>
              <div className="flex flex-wrap gap-2">
                {["catalog_management","business_management","pages_read_engagement"].map((p) => (
                  <span key={p} className="px-2 py-0.5 bg-white border border-blue-200 rounded text-xs text-blue-700 font-mono">{p}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "catalog" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Catalog Details</h2>
                <p className="text-xs text-slate-500 font-[Manrope]">View and modify your active Meta Commerce Catalog.</p>
              </div>
              <button onClick={fetchCatalog} disabled={catalogLoading} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                <span className="material-symbols-outlined text-base">refresh</span>{catalogLoading ? "Loading…" : "Refresh"}
              </button>
            </div>

            {catalogErr && <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 mb-4">{catalogErr}</div>}
            {catalogNameMsg && (
              <div className={`p-3 rounded-xl text-xs font-[Manrope] mb-4 font-semibold ${catalogNameMsg.includes("Failed") || catalogNameMsg.includes("error") ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-800 border border-emerald-200"}`}>
                {catalogNameMsg}
              </div>
            )}

            {!catalogInfo && !catalogErr && (
              <div className="text-center py-12 text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-3 block">inventory_2</span>
                <p className="text-sm">Click Refresh to load catalog info from Meta</p>
              </div>
            )}

            {catalogInfo && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1">Catalog ID</p>
                    <p className="text-sm font-mono font-semibold text-slate-800">{catalogInfo.id}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Catalog Name</p>
                      <p className="text-sm font-semibold text-slate-800">{catalogInfo.name}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => { setIsEditingCatalogName(true); setNewCatalogName(catalogInfo.name); }}
                        className="text-xs font-semibold text-[#006c49] hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span> Rename
                      </button>
                      <a
                        href={`https://business.facebook.com/commerce_manager/catalogs/${catalogInfo.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-[#1877F2] hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span> Open in Meta
                      </a>
                    </div>
                  </div>
                  <div className="p-4 bg-[#006c49]/5 rounded-xl border border-[#006c49]/20">
                    <p className="text-xs text-slate-500 mb-1">Products in Catalog</p>
                    <p className="text-2xl font-bold text-[#006c49]">{catalogInfo.product_count?.toLocaleString() ?? 0}</p>
                  </div>
                </div>

                {isEditingCatalogName && (
                  <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <h3 className="text-xs font-bold text-slate-800 font-[Manrope] uppercase tracking-wider">Rename Meta Catalog</h3>
                    <p className="text-xs text-slate-500 font-[Manrope]">Updating this will rename your Product Catalog directly on Meta Commerce Manager.</p>
                    <div className="flex gap-2 max-w-md">
                      <input
                        type="text"
                        value={newCatalogName}
                        onChange={(e) => setNewCatalogName(e.target.value)}
                        placeholder="Catalog Name"
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                      />
                      <button
                        onClick={handleSaveCatalogName}
                        disabled={catalogNameSaving || !newCatalogName.trim()}
                        className="px-4 py-2 bg-[#006c49] text-white rounded-lg text-xs font-bold font-[Manrope] hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {catalogNameSaving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setIsEditingCatalogName(false)}
                        className="px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "products" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Catalog Products</h2>
                <p className="text-xs text-slate-500 font-[Manrope]">View, edit price/stock, add, or remove items directly in your Meta Catalog.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsAddingProduct(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#006c49] text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 shadow-xs"
                >
                  <span className="material-symbols-outlined text-base">add</span> Add to Meta
                </button>
                <button onClick={fetchProducts} disabled={productsLoading} className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  <span className="material-symbols-outlined text-base">refresh</span>{productsLoading ? "Loading…" : "Refresh"}
                </button>
                <button onClick={syncProducts} disabled={syncing} className="flex items-center gap-2 px-3.5 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-medium hover:bg-[#1564d3] disabled:opacity-50">
                  <span className="material-symbols-outlined text-base">sync</span>{syncing ? "Syncing…" : "Sync Store"}
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
                <input
                  type="text"
                  placeholder="Search products by title, ID or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#006c49]"
                />
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {(["all", "in stock", "out of stock"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setAvailabilityFilter(mode)}
                    className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                      availabilityFilter === mode ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {productActionMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold font-[Manrope]">
                {productActionMsg}
              </div>
            )}
            {syncResult && <div className={`p-3 rounded-xl text-sm ${syncResult.startsWith("Error") ? "bg-red-50 text-red-600 border border-red-100" : "bg-[#006c49]/5 text-[#006c49] border border-[#006c49]/20"}`}>{syncResult}</div>}
            {productsErr && <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{productsErr}</div>}
            
            {!products.length && !productsErr && (
              <div className="text-center py-12 text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-3 block">shopping_bag</span>
                <p className="text-sm">Click Refresh to fetch products from your catalog, or Add to Meta to create items</p>
              </div>
            )}

            {products.length > 0 && (
              <>
                {selectedIds.size > 0 && (
                  <div className="mb-4 p-3 bg-white border border-[#006c49]/20 rounded-lg shadow-sm flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#006c49]">
                      {selectedIds.size} item{selectedIds.size > 1 ? "s" : ""} selected
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) handleBulkUpdateAvailability(e.target.value);
                          e.target.value = "";
                        }}
                        disabled={isBulkLoading}
                        className="text-xs px-2 py-1.5 border border-slate-200 rounded-md font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 outline-none"
                      >
                        <option value="">Bulk Update Availability...</option>
                        <option value="in stock">In Stock</option>
                        <option value="out of stock">Out of Stock</option>
                        <option value="preorder">Preorder</option>
                        <option value="available for order">Available for Order</option>
                      </select>
                      <button 
                        onClick={handleBulkDelete}
                        disabled={isBulkLoading}
                        className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-md transition-colors"
                      >
                        Delete Selected
                      </button>
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="pb-2 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          products.filter((p) => {
                            const q = searchQuery.toLowerCase();
                            const matchesSearch = !q || p.name?.toLowerCase().includes(q) || p.retailer_id?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q);
                            const matchesAvail = availabilityFilter === "all" || p.availability === availabilityFilter;
                            return matchesSearch && matchesAvail;
                          }).length > 0 &&
                          selectedIds.size === products.filter((p) => {
                            const q = searchQuery.toLowerCase();
                            const matchesSearch = !q || p.name?.toLowerCase().includes(q) || p.retailer_id?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q);
                            const matchesAvail = availabilityFilter === "all" || p.availability === availabilityFilter;
                            return matchesSearch && matchesAvail;
                          }).length
                        }
                        onChange={() => toggleAll(
                          products.filter((p) => {
                            const q = searchQuery.toLowerCase();
                            const matchesSearch = !q || p.name?.toLowerCase().includes(q) || p.retailer_id?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q);
                            const matchesAvail = availabilityFilter === "all" || p.availability === availabilityFilter;
                            return matchesSearch && matchesAvail;
                          }).map(p => p.id)
                        )}
                        className="w-4 h-4 text-[#006c49] border-gray-300 rounded focus:ring-[#006c49]"
                      />
                    </th>
                    <th className="pb-2 text-left">Product</th>
                    <th className="pb-2 text-left">Price</th>
                    <th className="pb-2 text-left">Availability</th>
                    <th className="pb-2 text-left">Retailer SKU / ID</th>
                    <th className="pb-2 text-right">Actions on Meta</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {products
                      .filter((p) => {
                        const q = searchQuery.toLowerCase();
                        const matchesSearch = !q || p.name?.toLowerCase().includes(q) || p.retailer_id?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q);
                        const matchesAvail = availabilityFilter === "all" || p.availability === availabilityFilter;
                        return matchesSearch && matchesAvail;
                      })
                      .map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(p.id)}
                            onChange={() => toggleSelection(p.id)}
                            className="w-4 h-4 text-[#006c49] border-gray-300 rounded focus:ring-[#006c49]"
                          />
                        </td>
                        <td className="py-3 flex items-center gap-3">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-100" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                              <span className="material-symbols-outlined text-lg">image</span>
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-slate-800 block">{p.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">Meta ID: {p.id}</span>
                          </div>
                        </td>
                        <td className="py-3 text-slate-600 font-medium">{p.price} {p.currency}</td>
                        <td className="py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${p.availability === "in stock" ? "bg-[#6cf8bb] text-[#00714d]" : "bg-red-100 text-red-600"}`}>{p.availability}</span></td>
                        <td className="py-3 text-xs font-mono text-slate-500">{p.retailer_id || p.id}</td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => startEditProduct(p)}
                              title="Edit item directly on Meta"
                              className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-xs">edit</span> Edit
                            </button>
                            <button
                              onClick={() => setDeletingProduct(p)}
                              title="Remove item from Meta catalog"
                              className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-md flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-xs">delete</span> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}

            {/* Edit Product Modal */}
            {editingProduct && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-serif font-bold text-slate-900 text-base">Edit Meta Product</h3>
                      <p className="text-xs text-slate-400 font-mono">Item ID: {editingProduct.retailer_id || editingProduct.id}</p>
                    </div>
                    <button onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-slate-600">
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">Product Title</label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">Price (EUR)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.price}
                          onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">Availability</label>
                        <select
                          value={editForm.availability}
                          onChange={(e) => setEditForm({ ...editForm, availability: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                        >
                          <option value="in stock">In Stock</option>
                          <option value="out of stock">Out of Stock</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">Condition</label>
                        <select
                          value={editForm.condition}
                          onChange={(e) => setEditForm({ ...editForm, condition: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                        >
                          <option value="new">New</option>
                          <option value="refurbished">Refurbished</option>
                          <option value="used">Used</option>
                        </select>
                      </div>
                      {/* Image Upload/URL for Edit */}
                      <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-[Manrope]">Product Image</label>
                          <div className="flex bg-slate-200/70 p-0.5 rounded-lg text-[11px] font-[Manrope] font-bold">
                            <button
                              type="button"
                              onClick={() => setEditMediaSource("upload")}
                              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                editMediaSource === "upload" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              <MdCloudUpload className="text-xs" /> Upload File
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditMediaSource("url")}
                              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                editMediaSource === "url" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              <MdLink className="text-xs" /> Image URL
                            </button>
                          </div>
                        </div>

                        {editMediaSource === "upload" ? (
                          <div>
                            <input
                              ref={editFileInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleEditFileUpload(e.target.files[0]);
                                }
                              }}
                            />
                            {!editForm.imageUrl ? (
                              <div
                                onClick={() => editFileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-300 hover:border-[#006c49] bg-white rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1 group"
                              >
                                <div className="w-8 h-8 rounded-full bg-emerald-50 text-[#006c49] group-hover:scale-110 flex items-center justify-center transition-transform">
                                  <MdCloudUpload className="text-lg" />
                                </div>
                                <p className="text-xs font-bold text-slate-800 font-[Manrope]">
                                  {editUploading ? "Uploading image..." : "Click to select product image file"}
                                </p>
                              </div>
                            ) : (
                              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white group h-28">
                                <img
                                  src={editForm.imageUrl}
                                  alt="Product preview"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => editFileInputRef.current?.click()}
                                    className="px-2.5 py-1 bg-white text-slate-800 text-xs font-bold rounded-lg shadow-sm hover:bg-slate-100 flex items-center gap-1 font-[Manrope]"
                                  >
                                    <MdCloudUpload /> Change
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditForm((prev) => ({ ...prev, imageUrl: "" }))}
                                    className="px-2.5 py-1 bg-red-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-red-700 flex items-center gap-1 font-[Manrope]"
                                  >
                                    <MdDelete /> Remove
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={editForm.imageUrl}
                            placeholder="https://..."
                            onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                          />
                        )}
                        {editUploadErr && <p className="text-[11px] text-red-600 font-[Manrope]">{editUploadErr}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">Description</label>
                      <textarea
                        rows={3}
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingProduct(null)}
                      className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold font-[Manrope] hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProduct}
                      disabled={productSaving}
                      className="px-4 py-2 bg-[#006c49] text-white rounded-lg text-xs font-bold font-[Manrope] hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {productSaving ? "Updating on Meta..." : "Save to Meta"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add Product Modal */}
            {isAddingProduct && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-serif font-bold text-slate-900 text-base">Add Product Directly to Meta Catalog</h3>
                    <button onClick={() => setIsAddingProduct(false)} className="text-slate-400 hover:text-slate-600">
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>

                  {addError && (
                    <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-medium">
                      {addError}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">Retailer ID / SKU</label>
                        <input
                          type="text"
                          placeholder="e.g. LUXE-DR-001"
                          value={addForm.retailerId}
                          onChange={(e) => setAddForm({ ...addForm, retailerId: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49] font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">Price (EUR) *</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="120.00"
                          value={addForm.price}
                          onChange={(e) => setAddForm({ ...addForm, price: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">Product Title *</label>
                      <input
                        type="text"
                        placeholder="e.g. Silk Evening Gown"
                        value={addForm.title}
                        onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">Availability</label>
                        <select
                          value={addForm.availability}
                          onChange={(e) => setAddForm({ ...addForm, availability: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                        >
                          <option value="in stock">In Stock</option>
                          <option value="out of stock">Out of Stock</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">Condition</label>
                        <select
                          value={addForm.condition}
                          onChange={(e) => setAddForm({ ...addForm, condition: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                        >
                          <option value="new">New</option>
                          <option value="refurbished">Refurbished</option>
                          <option value="used">Used</option>
                        </select>
                      </div>
                    </div>

                    {/* Image Upload/URL for Add */}
                    <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-[Manrope]">Product Image</label>
                        <div className="flex bg-slate-200/70 p-0.5 rounded-lg text-[11px] font-[Manrope] font-bold">
                          <button
                            type="button"
                            onClick={() => setAddMediaSource("upload")}
                            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                              addMediaSource === "upload" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            <MdCloudUpload className="text-xs" /> Upload File
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddMediaSource("url")}
                            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                              addMediaSource === "url" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            <MdLink className="text-xs" /> Image URL
                          </button>
                        </div>
                      </div>

                      {addMediaSource === "upload" ? (
                        <div>
                          <input
                            ref={addFileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleAddFileUpload(e.target.files[0]);
                              }
                            }}
                          />
                          {!addForm.imageUrl ? (
                            <div
                              onClick={() => addFileInputRef.current?.click()}
                              className="border-2 border-dashed border-slate-300 hover:border-[#006c49] bg-white rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1 group"
                            >
                              <div className="w-8 h-8 rounded-full bg-emerald-50 text-[#006c49] group-hover:scale-110 flex items-center justify-center transition-transform">
                                <MdCloudUpload className="text-lg" />
                              </div>
                              <p className="text-xs font-bold text-slate-800 font-[Manrope]">
                                {addUploading ? "Uploading image..." : "Click to select product image file"}
                              </p>
                            </div>
                          ) : (
                            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white group h-28">
                              <img
                                src={addForm.imageUrl}
                                alt="Product preview"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => addFileInputRef.current?.click()}
                                  className="px-2.5 py-1 bg-white text-slate-800 text-xs font-bold rounded-lg shadow-sm hover:bg-slate-100 flex items-center gap-1 font-[Manrope]"
                                >
                                  <MdCloudUpload /> Change
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAddForm((prev) => ({ ...prev, imageUrl: "" }))}
                                  className="px-2.5 py-1 bg-red-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-red-700 flex items-center gap-1 font-[Manrope]"
                                >
                                  <MdDelete /> Remove
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="https://..."
                          value={addForm.imageUrl}
                          onChange={(e) => setAddForm({ ...addForm, imageUrl: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                        />
                      )}
                      {addUploadErr && <p className="text-[11px] text-red-600 font-[Manrope]">{addUploadErr}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">Description</label>
                      <textarea
                        rows={3}
                        placeholder="Product description for Meta catalog..."
                        value={addForm.description}
                        onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsAddingProduct(false)}
                      className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold font-[Manrope] hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddProduct}
                      disabled={addSaving}
                      className="px-4 py-2 bg-[#006c49] text-white rounded-lg text-xs font-bold font-[Manrope] hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {addSaving ? "Adding..." : "Add to Catalog"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingProduct && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl space-y-4">
                  <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-slate-900 text-base">Remove from Meta Catalog?</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Are you sure you want to remove <span className="font-bold text-slate-700">"{deletingProduct.name}"</span> ({deletingProduct.retailer_id || deletingProduct.id}) from your Meta Commerce Catalog?
                    </p>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setDeletingProduct(null)}
                      className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold font-[Manrope] hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeleteProduct}
                      disabled={deleteSaving}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold font-[Manrope] hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleteSaving ? "Removing..." : "Confirm Delete"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "sync" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-1">Catalog Sync & Price Filtering Rules</h2>
              <p className="text-sm text-slate-500 mb-5">Define which inventory tiers and categories are synchronized with your Meta Commerce catalog and live XML feed.</p>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-[Manrope]">Production Domain</label>
                  <p className="text-[11px] text-slate-500 mb-2">The domain used for product links in the Meta catalog (e.g., yourboutique.com).</p>
                  <input
                    type="text"
                    value={prodDomain}
                    onChange={(e) => setProdDomain(e.target.value)}
                    placeholder="e.g. yourboutique.com"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#1877F2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-[Manrope]">Included Categories</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {ALL_CATEGORIES.map((cat) => (
                      <button key={cat} onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${settings?.includedCategories.includes(cat) ? "bg-[#006c49] text-white border-[#006c49]" : "bg-white text-slate-600 border-slate-200 hover:border-[#006c49]"}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">Minimum Price (EUR)</label>
                    <input
                      type="number"
                      min={0}
                      value={settings?.minPrice ?? 0}
                      onChange={(e) => setSettings(s => s ? ({ ...s, minPrice: Number(e.target.value) }) : null)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-[Manrope]">Maximum Price (EUR)</label>
                    <input
                      type="number"
                      min={0}
                      value={settings?.maxPrice ?? 10000}
                      onChange={(e) => setSettings(s => s ? ({ ...s, maxPrice: Number(e.target.value) }) : null)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#006c49]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={saveCatalogSettings}
                    disabled={settingsSaving}
                    className="px-5 py-2.5 bg-[#006c49] text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-50"
                  >
                    {settingsSaving ? "Saving..." : "Save Rules"}
                  </button>
                  {settingsSavedMsg && (
                    <span className="text-xs font-semibold font-[Manrope] text-emerald-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      {settingsSavedMsg}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-1">Push Store Inventory to Meta Catalog</h2>
              <p className="text-sm text-slate-500 mb-5">Batch-updates all filtered store products in your Meta Commerce catalog using the Graph items_batch API.</p>
              
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-5 text-xs text-slate-600 font-[Manrope] space-y-3">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-[#006c49]">tips_and_updates</span>
                  Two Ways Your Meta Catalog Stays Updated:
                </p>
                <div>
                  <p className="mb-1.5">1. <strong>Live RSS/XML Scheduled Data Feed:</strong> Meta periodically pulls product data directly from your live store feed URL.</p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                    <code className="font-mono text-[11px] text-slate-700 select-all truncate flex-1 px-1">
                      {typeof window !== "undefined" ? window.location.origin : ""}/api/facebook/catalog/feed.xml
                    </code>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            navigator.clipboard.writeText(`${window.location.origin}/api/facebook/catalog/feed.xml`);
                            setCopiedFeed(true);
                            setTimeout(() => setCopiedFeed(false), 2500);
                          }
                        }}
                        className="px-2.5 py-1 bg-[#1877F2] text-white rounded text-[10px] font-bold uppercase tracking-wider hover:bg-blue-700 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">{copiedFeed ? "check" : "content_copy"}</span>
                        {copiedFeed ? "Copied!" : "Copy URL"}
                      </button>
                      <a
                        href="/api/facebook/catalog/feed.xml"
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 border border-slate-300 text-slate-700 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50 flex items-center gap-1 no-underline"
                      >
                        <span className="material-symbols-outlined text-xs">open_in_new</span> Test
                      </a>
                    </div>
                  </div>
                </div>
                <p>2. <strong>Immediate Batch Push:</strong> Click the button below to force-push the latest catalog changes directly to Meta Commerce Manager in real-time.</p>
              </div>

              <button onClick={syncProducts} disabled={syncing} className="flex items-center gap-2 px-5 py-2.5 bg-[#1877F2] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#1564d3] disabled:opacity-50 transition-colors">
                <span className="material-symbols-outlined text-base">sync</span>{syncing ? "Syncing…" : "Sync Store Products → Meta Catalog"}
              </button>
              {syncResult && <p className={`mt-3 text-sm ${syncResult.startsWith("Error") ? "text-red-600" : "text-[#006c49]"}`}>{syncResult}</p>}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
