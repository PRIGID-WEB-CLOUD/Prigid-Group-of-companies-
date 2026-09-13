import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useSearch, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "./AdminLayout";

type Category = { id: string; name: string };
type Variant = { id: string; name?: string; size?: string; color?: string; price?: number; sku?: string; stock?: number };
type Product = {
  id: string; name: string; description: string; price: number;
  compareAtPrice?: number | null; imageUrl: string | null; images?: string | null;
  categoryId: string; status: string; tags?: string | null;
  seoTitle?: string | null; seoDescription?: string | null;
  trackQuantity: boolean; metaSyncEnabled: boolean; variants?: Variant[];
};

const STATUS_OPTS = ["ACTIVE", "DRAFT", "ARCHIVED"];
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ACTIVE:   { label: "Published",  cls: "text-[#00714d] bg-[#6cf8bb]/30" },
  DRAFT:    { label: "Draft",      cls: "text-[#45464d] bg-[#e5eeff]"    },
  ARCHIVED: { label: "Archived",   cls: "text-[#ba1a1a] bg-[#ffdad6]"   },
};

function VariantRow({
  v, onSave, onDelete,
}: { v: Variant; onSave: (v: Variant) => void; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const displayName = v.name || [v.color, v.size].filter(Boolean).join(" / ") || [v.size, v.color].filter(Boolean).join(" / ") || "Standard Variant";
  const numPrice = typeof v.price === "number" ? v.price : parseFloat(String(v.price ?? 0)) || 0;
  const numStock = typeof v.stock === "number" ? v.stock : parseInt(String(v.stock ?? 0), 10) || 0;

  const [form, setForm] = useState({
    ...v,
    name: displayName,
    price: numPrice,
    stock: numStock,
    sku: v.sku || "",
  });

  const stockCls = numStock === 0
    ? "bg-[#ba1a1a]"
    : numStock < 5 ? "bg-amber-400" : "bg-[#006c49]";

  if (editing) return (
    <tr className="border-b border-[#e5eeff] bg-[#f8f9ff]">
      <td className="py-3 pr-3">
        <input
          className="w-full border border-[#c6c6cd] rounded px-2 py-1 text-sm font-[Manrope] outline-none"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Black / L"
        />
      </td>
      <td className="py-3 pr-3">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#45464d] text-xs">$</span>
          <input
            className="w-full border border-[#c6c6cd] rounded pl-5 pr-2 py-1 text-sm font-[Manrope] outline-none"
            type="number" step="0.01" min="0"
            value={form.price}
            onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
          />
        </div>
      </td>
      <td className="py-3 pr-3">
        <input
          className="w-full border border-[#c6c6cd] rounded px-2 py-1 text-sm font-[Manrope] outline-none"
          value={form.sku}
          onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
          placeholder="SKU-001"
        />
      </td>
      <td className="py-3 pr-3">
        <input
          className="w-20 border border-[#c6c6cd] rounded px-2 py-1 text-sm font-[Manrope] outline-none"
          type="number" min="0"
          value={form.stock}
          onChange={e => setForm(f => ({ ...f, stock: parseInt(e.target.value) || 0 }))}
        />
      </td>
      <td className="py-3 flex items-center gap-2">
        <button onClick={() => { onSave(form); setEditing(false); }}
          className="px-3 py-1 bg-black text-white text-[10px] font-[Manrope] font-bold uppercase tracking-widest hover:bg-[#006c49] transition-colors">
          Save
        </button>
        <button onClick={() => setEditing(false)}
          className="px-3 py-1 border border-[#c6c6cd] text-[10px] font-[Manrope] font-bold uppercase tracking-widest hover:bg-[#eff4ff] transition-colors">
          Cancel
        </button>
      </td>
    </tr>
  );

  return (
    <tr className="border-b border-[#e5eeff] group hover:bg-[#f8f9ff] transition-colors">
      <td className="py-4 pr-3 font-[Manrope] text-sm text-[#0b1c30] flex items-center gap-2">
        {v.color && <div className="w-4 h-4 rounded-sm shrink-0 border border-slate-200" style={{ background: v.color.toLowerCase() }} />}
        <span>{displayName}</span>
      </td>
      <td className="py-4 pr-3 font-[Manrope] text-sm text-[#0b1c30]">${numPrice.toFixed(2)}</td>
      <td className="py-4 pr-3 font-[Manrope] text-sm text-[#7c839b]">{v.sku || "—"}</td>
      <td className="py-4 pr-3">
        <span className="flex items-center gap-1.5 text-sm font-[Manrope]">
          <span className={`inline-block w-2 h-2 rounded-full ${stockCls}`} />
          {numStock === 0 ? "Out of stock" : `${numStock} in stock`}
        </span>
      </td>
      <td className="py-4">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => { setForm({ ...v, name: displayName, price: numPrice, stock: numStock, sku: v.sku || "" }); setEditing(true); }}
            className="text-[#45464d] hover:text-black transition-colors" title="Edit">
            <span className="material-symbols-outlined text-base">edit</span>
          </button>
          <button onClick={() => onDelete(v.id)}
            className="text-[#45464d] hover:text-[#ba1a1a] transition-colors" title="Delete">
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminProductEditorPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const search = useSearch();
  const routeParams = useParams<{ id?: string }>();

  const searchParams = new URLSearchParams(search || (typeof window !== "undefined" ? window.location.search : ""));
  const productId = routeParams?.id || searchParams.get("id");
  const isEdit = !!productId;

  const [form, setForm] = useState({
    name: "", description: "", price: "", compareAtPrice: "",
    imageUrl: "", categoryId: "", status: "ACTIVE",
    tags: [] as string[], tagInput: "",
    seoTitle: "", seoDescription: "", trackQuantity: true, metaSyncEnabled: true,
  });
  const [images, setImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live preview interactive state
  const [previewTab, setPreviewTab] = useState<"detail" | "card" | "iframe">("detail");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [iframeKey, setIframeKey] = useState(0);
  const [activePreviewImg, setActivePreviewImg] = useState<string | null>(null);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [showNewVariant, setShowNewVariant] = useState(false);
  const [newVariant, setNewVariant] = useState({ name: "", price: "", sku: "", stock: "0", color: "" });

  // Matrix Generator State
  const [showMatrixGen, setShowMatrixGen] = useState(false);
  const [matrixSizes, setMatrixSizes] = useState("XS, S, M, L, XL");
  const [matrixColors, setMatrixColors] = useState("Black, Ivory, Gold");
  const [matrixStock, setMatrixStock] = useState("10");
  const [isGeneratingMatrix, setIsGeneratingMatrix] = useState(false);
  const [matrixSuccessMsg, setMatrixSuccessMsg] = useState<string | null>(null);

  const handleGenerateMatrix = async () => {
    setIsGeneratingMatrix(true);
    setMatrixSuccessMsg(null);
    try {
      const sizes = matrixSizes.split(",").map(s => s.trim()).filter(Boolean);
      const colors = matrixColors.split(",").map(c => c.trim()).filter(Boolean);
      if (sizes.length === 0 || colors.length === 0) {
        alert("Please enter at least one size and one color.");
        return;
      }

      const defaultPriceVal = form.price ? parseFloat(form.price) : 0;
      const defaultStockVal = parseInt(matrixStock) || 10;

      if (!productId) {
        // Local generation for new product
        const generated: Variant[] = [];
        const prodPrefix = (form.name || "PROD").replace(/[^a-zA-Z0-9]/g, "").substring(0, 4).toUpperCase();
        for (const size of sizes) {
          for (const color of colors) {
            const cleanSize = size.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
            const cleanColor = color.replace(/[^a-zA-Z0-9]/g, "").substring(0, 3).toUpperCase();
            generated.push({
              id: `local-matrix-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: `${color} / ${size}`,
              size,
              color,
              price: defaultPriceVal,
              stock: defaultStockVal,
              sku: `${prodPrefix}-${cleanSize}-${cleanColor}`,
            });
          }
        }
        setVariants(vs => {
          const existingKeys = new Set(vs.map(v => `${(v.size || "").toLowerCase()}_${(v.color || "").toLowerCase()}`));
          const newOnly = generated.filter(g => !existingKeys.has(`${g.size?.toLowerCase()}_${g.color?.toLowerCase()}`));
          setMatrixSuccessMsg(`Generated ${newOnly.length} variant combination(s)! Click Save Product to persist them.`);
          return [...vs, ...newOnly];
        });
        return;
      }

      const res = await fetch(`/api/products/${productId}/generate-variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sizes,
          colors,
          defaultPrice: defaultPriceVal,
          defaultStock: defaultStockVal,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const mapped = (data.variants || []).map((v: any) => ({
          ...v,
          name: v.name || [v.color, v.size].filter(Boolean).join(" / ") || [v.size, v.color].filter(Boolean).join(" / ") || "Standard",
          price: Number(v.price ?? defaultPriceVal),
          stock: Number(v.stock ?? defaultStockVal),
        }));
        setVariants(mapped);
        setMatrixSuccessMsg(`Generated ${data.createdCount} new variant combination(s)!`);
        queryClient.invalidateQueries({ queryKey: ["product", productId] });
      } else {
        alert(data.error || "Failed to generate variant matrix.");
      }
    } catch (err) {
      console.error("Matrix generation error", err);
      alert("Error generating matrix.");
    } finally {
      setIsGeneratingMatrix(false);
    }
  };
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSeoEdit, setShowSeoEdit] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: existingProduct, isLoading: productLoading, isError: productError } = useQuery<Product>({
    queryKey: ["product", productId],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}`);
      if (!res.ok) throw new Error("Product not found");
      return res.json();
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingProduct) {
      let parsedTags: string[] = [];
      try { parsedTags = existingProduct.tags ? JSON.parse(existingProduct.tags) : []; } catch { parsedTags = []; }
      let parsedImages: string[] = [];
      try { parsedImages = existingProduct.images ? JSON.parse(existingProduct.images) : []; } catch { parsedImages = []; }

      setForm({
        name: existingProduct.name,
        description: existingProduct.description,
        price: String(existingProduct.price),
        compareAtPrice: existingProduct.compareAtPrice ? String(existingProduct.compareAtPrice) : "",
        imageUrl: existingProduct.imageUrl ?? "",
        categoryId: existingProduct.categoryId,
        status: existingProduct.status || "ACTIVE",
        tags: parsedTags,
        tagInput: "",
        seoTitle: existingProduct.seoTitle ?? "",
        seoDescription: existingProduct.seoDescription ?? "",
        trackQuantity: existingProduct.trackQuantity !== false,
        metaSyncEnabled: existingProduct.metaSyncEnabled !== false,
      });
      setImages(parsedImages);
      if (existingProduct.variants) setVariants(existingProduct.variants);
    }
  }, [existingProduct]);

  useEffect(() => {
    if (!form.categoryId && categories.length > 0) {
      setForm(f => ({ ...f, categoryId: f.categoryId || categories[0].id }));
    }
  }, [categories, form.categoryId]);

  const mutation = useMutation({
    mutationFn: async () => {
      const allImages = form.imageUrl ? [form.imageUrl, ...images.filter(i => i !== form.imageUrl)] : images;
      const primaryImage = allImages[0] || null;

      const url = isEdit ? `/api/products/${productId}` : "/api/products";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description,
          price: form.price ? parseFloat(form.price) : 0,
          compareAtPrice: form.compareAtPrice ? parseFloat(form.compareAtPrice) : null,
          imageUrl: primaryImage,
          images: allImages,
          categoryId: form.categoryId || null,
          status: form.status,
          tags: form.tags,
          seoTitle: form.seoTitle || null,
          seoDescription: form.seoDescription || null,
          trackQuantity: form.trackQuantity,
          metaSyncEnabled: form.metaSyncEnabled,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        const msg = d.error || (d.issues ? d.issues.map((i: any) => `${i.path || i.field || "field"}: ${i.message}`).join(", ") : "Failed to save product");
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setLastSaved(new Date());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);

      const targetProdId = productId || data?.id;
      if (targetProdId && variants.some(v => v.id.startsWith("local-"))) {
        const localVars = variants.filter(v => v.id.startsWith("local-"));
        for (const lv of localVars) {
          try {
            let size = lv.size || "";
            let color = lv.color || "";
            if (!size && !color && lv.name) {
              const parts = lv.name.split("/").map(s => s.trim());
              if (parts.length >= 2) {
                color = parts[0];
                size = parts[1];
              } else {
                size = lv.name;
              }
            }
            await fetch(`/api/products/${targetProdId}/variants`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                size,
                color,
                price: lv.price,
                stock: lv.stock,
                sku: lv.sku,
              }),
            });
          } catch { /* ignore */ }
        }
      }

      if (!isEdit && data?.id) {
        setLocation(`/products/edit?id=${data.id}`);
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  const saveVariant = useCallback(async (v: Variant) => {
    setVariants(vs => vs.map(x => x.id === v.id ? v : x));
    if (!productId || v.id.startsWith("local-")) return;

    let size = v.size || "";
    let color = v.color || "";
    if (!size && !color && v.name) {
      const parts = v.name.split("/").map(s => s.trim());
      if (parts.length >= 2) {
        color = parts[0];
        size = parts[1];
      } else {
        size = v.name;
      }
    }

    await fetch(`/api/products/${productId}/variants/${v.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        size,
        color,
        price: v.price,
        stock: v.stock,
        sku: v.sku,
      }),
    });
  }, [productId]);

  const deleteVariant = useCallback(async (id: string) => {
    setVariants(vs => vs.filter(v => v.id !== id));
    if (!productId || id.startsWith("local-")) return;
    await fetch(`/api/products/${productId}/variants/${id}`, { method: "DELETE" });
  }, [productId]);

  const addVariant = async () => {
    if (!newVariant.name && !newVariant.color) return;
    const priceVal = parseFloat(newVariant.price) || (form.price ? parseFloat(form.price) : 0);
    const stockVal = parseInt(newVariant.stock) || 0;

    let size = "";
    let color = newVariant.color || "";
    if (newVariant.name) {
      const parts = newVariant.name.split("/").map(s => s.trim());
      if (parts.length >= 2) {
        color = parts[0];
        size = parts[1];
      } else {
        size = newVariant.name;
      }
    }
    const nameVal = newVariant.name || [color, size].filter(Boolean).join(" / ") || "Standard";

    if (!productId) {
      const localVar: Variant = {
        id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: nameVal,
        size,
        color,
        price: priceVal,
        stock: stockVal,
        sku: newVariant.sku || `${(form.name || "PROD").substring(0, 4).toUpperCase()}-${(size || "VAR").toUpperCase()}`,
      };
      setVariants(vs => [...vs, localVar]);
      setNewVariant({ name: "", price: "", sku: "", stock: "0", color: "" });
      setShowNewVariant(false);
      return;
    }

    const res = await fetch(`/api/products/${productId}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        size,
        color,
        price: priceVal,
        stock: stockVal,
        sku: newVariant.sku,
      }),
    });
    if (res.ok) {
      const v = await res.json();
      setVariants(vs => [...vs, { ...v, name: nameVal }]);
      setNewVariant({ name: "", price: "", sku: "", stock: "0", color: "" });
      setShowNewVariant(false);
    }
  };

  const handleFilesUpload = async (files: FileList | File[]) => {
    const fileList = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (fileList.length === 0) {
      setUploadError("Please select valid image files (JPG, PNG, WEBP, GIF, SVG, AVIF).");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    const formData = new FormData();
    fileList.forEach(f => formData.append("files", f));

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload image(s).");
      }

      const uploadedUrls: string[] = data.urls || (data.url ? [data.url] : []);
      if (uploadedUrls.length > 0) {
        setImages(prev => {
          const combined = [...prev, ...uploadedUrls];
          return Array.from(new Set(combined));
        });
        if (!form.imageUrl) {
          setForm(f => ({ ...f, imageUrl: uploadedUrls[0] }));
        }
        if (!activePreviewImg) {
          setActivePreviewImg(uploadedUrls[0]);
        }
      }
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload images. Please check the file format and try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  const addImageUrl = () => {
    if (!newImageUrl.trim()) return;
    setImages(imgs => [...imgs, newImageUrl.trim()]);
    if (!form.imageUrl) setForm(f => ({ ...f, imageUrl: newImageUrl.trim() }));
    setNewImageUrl("");
    setShowUrlInput(false);
  };

  const removeImage = (url: string) => {
    setImages(imgs => imgs.filter(i => i !== url));
    if (form.imageUrl === url) {
      const remaining = images.filter(i => i !== url);
      setForm(f => ({ ...f, imageUrl: remaining[0] ?? "" }));
    }
    if (activePreviewImg === url) {
      const remaining = images.filter(i => i !== url);
      setActivePreviewImg(remaining[0] ?? null);
    }
  };

  const addTag = () => {
    const t = form.tagInput.trim();
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t], tagInput: "" }));
  };

  const insertFormat = (pre: string, post: string) => {
    const ta = descRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const selected = value.slice(s, e);
    const newVal = value.slice(0, s) + pre + selected + post + value.slice(e);
    setForm(f => ({ ...f, description: newVal }));
    setTimeout(() => { ta.setSelectionRange(s + pre.length, e + pre.length); ta.focus(); }, 0);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!form.name || !form.description || !form.price || !form.categoryId) {
      setError("Please fill in all required fields (name, description, price, category).");
      return;
    }
    mutation.mutate();
  };

  const seoTitle = form.seoTitle || (form.name ? `${form.name} | Luxe Boutique` : "Product | Luxe Boutique");
  const seoDesc = form.seoDescription || form.description.slice(0, 120);
  const allImages = form.imageUrl
    ? [form.imageUrl, ...images.filter(i => i !== form.imageUrl)]
    : images;

  // Real storefront origin resolution
  const storefrontOrigin = (() => {
    const configured = (import.meta.env.VITE_STOREFRONT_ORIGIN as string | undefined)?.replace(/\/$/, "");
    if (configured) return configured;
    if (typeof window !== "undefined") {
      if (window.location.port === "3005") {
        return `${window.location.protocol}//${window.location.hostname}:3000`;
      }
      return window.location.origin;
    }
    return "https://luxeboutique.com";
  })();
  const liveProductUrl = productId ? `${storefrontOrigin}/products/${encodeURIComponent(productId)}` : null;

  const selectedCategoryName = categories.find(c => c.id === form.categoryId)?.name || "Boutique Collection";
  const fallbackPreviewImg = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=1000&auto=format&fit=crop";
  const currentPreviewImage = (activePreviewImg && allImages.includes(activePreviewImg))
    ? activePreviewImg
    : (allImages[0] || fallbackPreviewImg);

  const stCfg = STATUS_LABEL[form.status] ?? STATUS_LABEL.ACTIVE;
  const lastSavedStr = lastSaved
    ? `Last saved ${Math.round((Date.now() - lastSaved.getTime()) / 60000)} min ago`
    : isEdit ? "Unsaved changes" : "Not yet saved";

  return (
    <AdminLayout sidebar="main">
      <div className="p-4 sm:p-8 bg-[#f8f9ff] min-h-screen">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap sm:flex-nowrap">
              <Link href="/catalog"
                className="text-[#7c839b] hover:text-black transition-colors text-sm font-[Manrope] flex items-center gap-1 no-underline shrink-0">
                <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Catalog
              </Link>
              <span className="text-[#c6c6cd]">·</span>
              <span className={`text-[11px] font-[Manrope] font-bold tracking-widest uppercase px-2 py-0.5 rounded shrink-0 ${stCfg.cls}`}>
                {stCfg.label}
              </span>
              <span className="text-[11px] font-[Manrope] text-[#7c839b] shrink-0">{lastSavedStr}</span>
            </div>
            <h1 className="text-3xl sm:text-[48px] font-serif font-bold leading-tight text-black">
              {form.name || (isEdit ? "Edit Product" : "New Product")}
            </h1>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link href="/catalog" className="flex-1 sm:flex-none">
              <button type="button"
                className="w-full px-6 py-2 border border-[#c6c6cd] font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#eff4ff] transition-all">
                Discard
              </button>
            </Link>
            <button
              onClick={() => handleSubmit()}
              disabled={mutation.isPending}
              className="flex-1 sm:flex-none px-8 py-2.5 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {mutation.isPending && <span className="material-symbols-outlined text-sm animate-spin">autorenew</span>}
              {mutation.isPending ? "Saving..." : saved ? "Saved!" : isEdit ? "Save Changes" : "Create Product"}
            </button>
          </div>
        </div>

        {isEdit && productLoading && (
          <div className="mb-6 p-4 bg-emerald-50 text-[#006c49] text-sm font-[Manrope] rounded-lg flex items-center gap-2 border border-[#c3eed8]">
            <span className="material-symbols-outlined text-base animate-spin">autorenew</span> Loading product details...
          </div>
        )}

        {isEdit && productError && (
          <div className="mb-6 p-4 bg-[#ffdad6] text-[#93000a] text-sm font-[Manrope] rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span> Product not found or could not be loaded.
            </div>
            <Link href="/catalog" className="font-bold underline text-xs uppercase tracking-wider text-[#93000a] hover:opacity-80">
              Return to Catalog
            </Link>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-[#ffdad6] text-[#93000a] text-sm font-[Manrope] rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-12 gap-6">

            {/* ── Left column ── */}
            <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">

              {/* General Info */}
              <section className="bg-white p-6 rounded-lg shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
                <h3 className="text-[24px] font-serif font-semibold text-black mb-6">General Information</h3>
                <div className="space-y-6">
                  <div>
                    <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">
                      Product Name <span className="text-[#ba1a1a]">*</span>
                    </label>
                    <input
                      className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg focus:border-black px-4 py-3 font-[Manrope] outline-none transition-colors"
                      type="text" value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Enter product name"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">
                      Description <span className="text-[#ba1a1a]">*</span>
                    </label>
                    <div className="border border-[#c6c6cd] rounded-lg overflow-hidden focus-within:border-black transition-colors">
                      <div className="bg-[#eff4ff] px-4 py-2 border-b border-[#c6c6cd] flex items-center gap-4">
                        {[
                          { icon: "format_bold",   action: () => insertFormat("**", "**")    },
                          { icon: "format_italic",  action: () => insertFormat("_", "_")      },
                          { icon: "list",           action: () => insertFormat("\n- ", "")    },
                          { icon: "link",           action: () => insertFormat("[", "](url)") },
                        ].map(({ icon, action }) => (
                          <button key={icon} type="button" onClick={action}
                            className="text-[#45464d] hover:text-black transition-colors">
                            <span className="material-symbols-outlined text-lg">{icon}</span>
                          </button>
                        ))}
                      </div>
                      <textarea
                        ref={descRef}
                        className="w-full bg-[#f8f9ff] border-none focus:ring-0 px-4 py-3 font-[Manrope] text-[#0b1c30] outline-none resize-none"
                        rows={6} value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Describe the product in detail..."
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Media Gallery */}
              <section
                className={`bg-white p-6 rounded-lg shadow-[0px_4px_20px_rgba(15,23,42,0.05)] transition-all ${
                  isDragging ? "ring-2 ring-black bg-[#eff4ff]/50" : ""
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                  <div>
                    <h3 className="text-[24px] font-serif font-semibold text-black flex items-center gap-2">
                      Media Gallery
                      {allImages.length > 0 && (
                        <span className="text-xs font-[Manrope] text-[#7c839b] font-normal">
                          ({allImages.length} {allImages.length === 1 ? "image" : "images"})
                        </span>
                      )}
                    </h3>
                    <p className="text-xs font-[Manrope] text-[#7c839b] mt-0.5">
                      Drag & drop product images, or upload from your computer. The first image is the primary store photo.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
                      multiple
                      onChange={e => e.target.files && handleFilesUpload(e.target.files)}
                      className="hidden"
                    />

                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-black text-white text-[11px] font-[Manrope] font-bold uppercase tracking-widest hover:bg-[#006c49] transition-colors rounded-lg flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-base">upload_file</span>
                      {isUploading ? "Uploading..." : "Upload Photos"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowUrlInput(v => !v)}
                      className="px-3 py-2 border border-[#c6c6cd] text-[#45464d] hover:text-black text-[11px] font-[Manrope] font-bold uppercase tracking-widest hover:bg-[#eff4ff] transition-colors rounded-lg flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-base">link</span>
                      {showUrlInput ? "Hide URL" : "Paste URL"}
                    </button>
                  </div>
                </div>

                {uploadError && (
                  <div className="mb-4 p-3.5 bg-[#ffdad6] text-[#93000a] text-xs font-[Manrope] rounded-lg flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">error</span>
                      <span>{uploadError}</span>
                    </div>
                    <button type="button" onClick={() => setUploadError(null)} className="text-[#93000a] hover:opacity-70">
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>
                )}

                {isUploading && (
                  <div className="mb-4 p-4 bg-[#e5eeff] rounded-lg border border-[#c6c6cd] flex items-center gap-3">
                    <span className="material-symbols-outlined text-xl text-[#006c49] animate-spin">autorenew</span>
                    <div className="text-xs font-[Manrope] text-[#0b1c30]">
                      <p className="font-bold">Uploading and saving local image(s)...</p>
                      <p className="text-[#7c839b]">Adding directly to your store media inventory</p>
                    </div>
                  </div>
                )}

                {/* Optional URL adder */}
                {showUrlInput && (
                  <div className="flex gap-2 mb-4 p-3 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg">
                    <input
                      className="flex-1 bg-white border border-[#c6c6cd] rounded-lg px-4 py-2 text-sm font-[Manrope] outline-none focus:border-black transition-colors"
                      placeholder="Paste image URL (e.g. https://...)..."
                      value={newImageUrl}
                      onChange={e => setNewImageUrl(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addImageUrl())}
                    />
                    <button
                      type="button"
                      onClick={addImageUrl}
                      className="px-4 py-2 bg-black text-white text-[10px] font-[Manrope] font-bold uppercase tracking-widest hover:bg-[#006c49] transition-colors rounded-lg"
                    >
                      Add URL
                    </button>
                  </div>
                )}

                {allImages.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {allImages.map((url, i) => (
                      <div
                        key={url}
                        onClick={() => setActivePreviewImg(url)}
                        className={`relative group cursor-pointer overflow-hidden rounded-lg border transition-all ${
                          i === 0
                            ? "col-span-2 row-span-2 border-black shadow-md"
                            : "aspect-square border-[#c6c6cd] hover:border-black"
                        } ${activePreviewImg === url ? "ring-2 ring-[#006c49]" : ""}`}
                        style={i === 0 ? { aspectRatio: "1/1" } : {}}
                      >
                        <img
                          src={url}
                          alt={`Product image ${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />

                        {/* Always-visible Primary badge */}
                        {i === 0 ? (
                          <div className="absolute top-2 left-2 bg-black text-white text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow pointer-events-none flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">star</span> Primary
                          </div>
                        ) : (
                          <div className="absolute top-2 left-2 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            #{i + 1}
                          </div>
                        )}

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            removeImage(url);
                          }}
                          title="Remove image"
                          className="absolute top-2 right-2 w-7 h-7 bg-white/95 hover:bg-[#ffdad6] text-[#ba1a1a] rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                          <span className="material-symbols-outlined text-sm leading-none">close</span>
                        </button>

                        {/* Hover overlay — Make Primary button for non-primary images */}
                        {i !== 0 && (
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setImages(imgs => [url, ...imgs.filter(x => x !== url)]);
                                setForm(f => ({ ...f, imageUrl: url }));
                                setActivePreviewImg(url);
                              }}
                              title="Set as primary"
                              className="px-3 py-1.5 bg-white text-black text-[10px] font-[Manrope] font-bold uppercase tracking-widest rounded-md shadow flex items-center gap-1 hover:bg-black hover:text-white transition-colors"
                            >
                              <span className="material-symbols-outlined text-xs">star</span> Set Primary
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Upload slot button inside grid */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-[#c6c6cd] flex flex-col items-center justify-center gap-2 text-[#7c839b] hover:bg-[#eff4ff] hover:border-black hover:text-black transition-all rounded-lg aspect-square cursor-pointer group"
                    >
                      <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">add_photo_alternate</span>
                      <span className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest">Add More</span>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#c6c6cd] rounded-xl flex flex-col items-center justify-center gap-3 py-12 px-6 text-[#7c839b] hover:bg-[#eff4ff]/60 hover:border-black transition-all cursor-pointer text-center group"
                  >
                    <div className="w-14 h-14 rounded-full bg-[#f8f9ff] group-hover:bg-white flex items-center justify-center border border-[#c6c6cd] group-hover:border-black transition-colors shadow-sm">
                      <span className="material-symbols-outlined text-3xl text-black">cloud_upload</span>
                    </div>
                    <div>
                      <p className="text-base font-[Manrope] font-bold text-black mb-1">
                        Drag & drop images here, or <span className="text-[#006c49] underline">browse local files</span>
                      </p>
                      <p className="text-xs font-[Manrope] text-[#7c839b]">
                        Supports JPG, PNG, WEBP, GIF, AVIF up to 20MB per file.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <button
                        type="button"
                        className="px-5 py-2 bg-black text-white text-[11px] font-[Manrope] font-bold uppercase tracking-widest rounded-lg group-hover:bg-[#006c49] transition-colors shadow-sm"
                      >
                        Select from Computer
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Product Variants */}
              <section className="bg-white p-6 rounded-lg shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
                <h3 className="text-[24px] font-serif font-semibold text-black mb-6">Product Variants</h3>

                {!isEdit && variants.length > 0 && (
                  <div className="mb-4 p-3 bg-[#e6f4ea] rounded-lg text-xs font-[Manrope] text-[#137333] flex items-center gap-2 font-semibold">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {variants.length} staged variant(s) ready — click Save Product to save them with this product.
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#c6c6cd]">
                        {["Variant", "Price", "SKU", "Stock", ""].map(h => (
                          <th key={h} className="py-3 pr-3 text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map(v => (
                        <VariantRow key={v.id} v={v} onSave={saveVariant} onDelete={deleteVariant} />
                      ))}
                      {showNewVariant && (
                        <tr className="border-b border-[#e5eeff] bg-[#f8f9ff]">
                          <td className="py-3 pr-3">
                            <input className="w-full border border-[#c6c6cd] rounded px-2 py-1 text-sm font-[Manrope] outline-none"
                              placeholder="e.g. Black / L"
                              value={newVariant.name} onChange={e => setNewVariant(n => ({ ...n, name: e.target.value }))} />
                          </td>
                          <td className="py-3 pr-3">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#45464d] text-xs">$</span>
                              <input className="w-full border border-[#c6c6cd] rounded pl-5 pr-2 py-1 text-sm font-[Manrope] outline-none"
                                type="number" step="0.01" min="0" placeholder="0.00"
                                value={newVariant.price} onChange={e => setNewVariant(n => ({ ...n, price: e.target.value }))} />
                            </div>
                          </td>
                          <td className="py-3 pr-3">
                            <input className="w-full border border-[#c6c6cd] rounded px-2 py-1 text-sm font-[Manrope] outline-none"
                              placeholder="SKU-001"
                              value={newVariant.sku} onChange={e => setNewVariant(n => ({ ...n, sku: e.target.value }))} />
                          </td>
                          <td className="py-3 pr-3">
                            <input className="w-20 border border-[#c6c6cd] rounded px-2 py-1 text-sm font-[Manrope] outline-none"
                              type="number" min="0"
                              value={newVariant.stock} onChange={e => setNewVariant(n => ({ ...n, stock: e.target.value }))} />
                          </td>
                          <td className="py-3 flex items-center gap-2">
                            <button type="button" onClick={addVariant}
                              className="px-3 py-1 bg-black text-white text-[10px] font-[Manrope] font-bold uppercase tracking-widest hover:bg-[#006c49] transition-colors">
                              Add
                            </button>
                            <button type="button" onClick={() => setShowNewVariant(false)}
                              className="px-3 py-1 border border-[#c6c6cd] text-[10px] font-[Manrope] font-bold uppercase tracking-widest hover:bg-[#eff4ff] transition-colors">
                              Cancel
                            </button>
                          </td>
                        </tr>
                      )}
                      {variants.length === 0 && !showNewVariant && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-sm font-[Manrope] text-[#7c839b]">
                            No variants yet — generate a matrix or add custom variants below.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 pt-6 border-t border-[#e5eeff]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-[Manrope] font-bold text-black flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-[#006c49]">auto_awesome</span>
                        Automated Variant Matrix Generator
                      </h4>
                      <p className="text-xs text-[#7c839b]">Generate matrix combinations of sizes and colors in 1 click.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMatrixGen(v => !v)}
                      className="px-3 py-1.5 border border-[#c6c6cd] text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] hover:bg-[#f8f9ff] transition-colors rounded-lg flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">{showMatrixGen ? "expand_less" : "grid_on"}</span>
                      {showMatrixGen ? "Hide Generator" : "Open Matrix Generator"}
                    </button>
                  </div>

                  {showMatrixGen && (
                    <div className="p-4 bg-[#f8f9ff] border border-[#c6c6cd] rounded-xl space-y-4">
                      {matrixSuccessMsg && (
                        <div className="p-3 bg-[#e6f4ea] text-[#137333] text-xs font-[Manrope] font-bold rounded-lg flex items-center gap-2">
                          <span className="material-symbols-outlined text-base">check_circle</span>
                          <span>{matrixSuccessMsg}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1">
                            Sizes (Comma-separated)
                          </label>
                          <input
                            className="w-full bg-white border border-[#c6c6cd] rounded-lg px-3 py-2 text-xs font-[Manrope] outline-none focus:border-black"
                            value={matrixSizes}
                            onChange={e => setMatrixSizes(e.target.value)}
                            placeholder="e.g. XS, S, M, L, XL"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1">
                            Colors (Comma-separated)
                          </label>
                          <input
                            className="w-full bg-white border border-[#c6c6cd] rounded-lg px-3 py-2 text-xs font-[Manrope] outline-none focus:border-black"
                            value={matrixColors}
                            onChange={e => setMatrixColors(e.target.value)}
                            placeholder="e.g. Black, Ivory, Gold, Emerald"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 pt-2">
                        <div>
                          <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1">
                            Default Stock Per Variant
                          </label>
                          <input
                            type="number" min="0"
                            className="w-28 bg-white border border-[#c6c6cd] rounded-lg px-3 py-2 text-xs font-[Manrope] outline-none focus:border-black"
                            value={matrixStock}
                            onChange={e => setMatrixStock(e.target.value)}
                          />
                        </div>

                        <div className="flex-1 flex justify-end items-end pt-5">
                          <button
                            type="button"
                            disabled={isGeneratingMatrix}
                            onClick={handleGenerateMatrix}
                            className="px-5 py-2.5 bg-[#006c49] text-white text-[11px] font-[Manrope] font-bold uppercase tracking-widest rounded-lg hover:bg-black transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-base">bolt</span>
                            {isGeneratingMatrix ? "Generating..." : "Generate Variant Matrix"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {!showNewVariant && (
                  <button type="button" onClick={() => setShowNewVariant(true)}
                    className="mt-4 w-full py-3 border border-dashed border-[#c6c6cd] text-[11px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] hover:bg-[#eff4ff] transition-colors flex items-center justify-center gap-2 rounded-lg">
                    <span className="material-symbols-outlined text-sm">add</span> Add Single Custom Variant
                  </button>
                )}
              </section>
            </div>

            {/* ── Right column ── */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">

              {/* Status & Organisation */}
              <section className="bg-white p-6 rounded-lg shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
                <h3 className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] mb-6">
                  Status & Organization
                </h3>
                <div className="space-y-5">
                  <div>
                    <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">
                      Product Status
                    </label>
                    <select
                      className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg focus:border-black px-4 py-2 font-[Manrope] outline-none"
                      value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      {STATUS_OPTS.map(s => (
                        <option key={s} value={s}>{STATUS_LABEL[s]?.label ?? s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">
                      Category <span className="text-[#ba1a1a]">*</span>
                    </label>
                    {categories.length === 0 ? (
                      <div className="text-sm text-[#7c839b] font-[Manrope]">
                        No categories yet.{" "}
                        <Link href="/categories" className="text-black underline">Create one</Link>
                      </div>
                    ) : (
                      <select
                        className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg focus:border-black px-4 py-2 font-[Manrope] outline-none"
                        value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {form.tags.map(tag => (
                        <span key={tag} className="bg-[#e5eeff] text-[#0b1c30] px-2 py-0.5 text-xs font-[Manrope] font-medium rounded-full flex items-center gap-1">
                          {tag}
                          <button type="button" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))}>
                            <span className="material-symbols-outlined text-[12px] leading-none">close</span>
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-3 py-1.5 text-sm font-[Manrope] outline-none focus:border-black"
                        placeholder="Add tag..."
                        value={form.tagInput}
                        onChange={e => setForm(f => ({ ...f, tagInput: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                      />
                      <button type="button" onClick={addTag}
                        className="px-3 py-1.5 bg-[#eff4ff] text-black text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors rounded-lg">
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Pricing & Stock */}
              <section className="bg-white p-6 rounded-lg shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
                <h3 className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] mb-6">
                  Pricing & Stock
                </h3>
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">
                        Price <span className="text-[#ba1a1a]">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#45464d] font-[Manrope] text-sm">$</span>
                        <input
                          className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg pl-7 py-2 font-[Manrope] outline-none focus:border-black"
                          type="number" step="0.01" min="0" placeholder="0.00"
                          value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">
                        Compare At
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#45464d] font-[Manrope] text-sm">$</span>
                        <input
                          className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg pl-7 py-2 font-[Manrope] outline-none focus:border-black"
                          type="number" step="0.01" min="0" placeholder="0.00"
                          value={form.compareAtPrice} onChange={e => setForm(f => ({ ...f, compareAtPrice: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">
                      Inventory Policy
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, trackQuantity: !f.trackQuantity }))}
                        className={`relative w-10 h-5 rounded-full transition-colors ${form.trackQuantity ? "bg-[#006c49]" : "bg-[#c6c6cd]"}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.trackQuantity ? "right-0.5" : "left-0.5"}`} />
                      </button>
                      <span className="text-sm font-[Manrope] text-[#0b1c30]">
                        {form.trackQuantity ? "Track quantity" : "Don't track"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">
                      Meta Catalog Sync
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, metaSyncEnabled: !f.metaSyncEnabled }))}
                        className={`relative w-10 h-5 rounded-full transition-colors ${form.metaSyncEnabled ? "bg-[#1877f2]" : "bg-[#c6c6cd]"}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.metaSyncEnabled ? "right-0.5" : "left-0.5"}`} />
                      </button>
                      <span className="text-sm font-[Manrope] text-[#0b1c30]">
                        {form.metaSyncEnabled ? "Sync to Meta" : "Excluded from Meta"}
                      </span>
                    </div>
                  </div>
                  {form.compareAtPrice && parseFloat(form.compareAtPrice) > parseFloat(form.price || "0") && (
                    <div className="p-3 bg-[#eff4ff] rounded-lg text-xs font-[Manrope] text-[#45464d]">
                      <span className="font-bold text-[#006c49]">
                        {Math.round((1 - parseFloat(form.price) / parseFloat(form.compareAtPrice)) * 100)}% off
                      </span>{" "}
                      compared to original price
                    </div>
                  )}
                </div>
              </section>

              {/* Live storefront preview */}
              <section className="bg-white p-6 rounded-lg shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
                {/* Header & Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-[#e5eeff]">
                  <div>
                    <h3 className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#006c49] animate-pulse" />
                      Live Storefront Preview
                    </h3>
                    <p className="text-xs font-[Manrope] text-[#7c839b] mt-0.5">
                      {isEdit ? "Real-time interactive preview and live storefront view." : "Interactive preview updates in real-time as you compose your product."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Viewport switch */}
                    <div className="flex items-center bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setPreviewDevice("desktop")}
                        title="Desktop view"
                        className={`px-2.5 py-1 text-xs font-[Manrope] font-bold rounded flex items-center gap-1 transition-colors ${
                          previewDevice === "desktop" ? "bg-white text-black shadow-sm" : "text-[#7c839b] hover:text-black"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">desktop_windows</span>
                        <span className="hidden sm:inline text-[10px] uppercase tracking-wider">Desktop</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice("mobile")}
                        title="Mobile view"
                        className={`px-2.5 py-1 text-xs font-[Manrope] font-bold rounded flex items-center gap-1 transition-colors ${
                          previewDevice === "mobile" ? "bg-white text-black shadow-sm" : "text-[#7c839b] hover:text-black"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">smartphone</span>
                        <span className="hidden sm:inline text-[10px] uppercase tracking-wider">Mobile</span>
                      </button>
                    </div>

                    {/* Mode Tabs */}
                    <div className="flex items-center bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setPreviewTab("detail")}
                        className={`px-3 py-1 text-[10px] font-[Manrope] font-bold uppercase tracking-wider rounded transition-colors ${
                          previewTab === "detail" ? "bg-black text-white" : "text-[#45464d] hover:text-black"
                        }`}
                      >
                        Detail View
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTab("card")}
                        className={`px-3 py-1 text-[10px] font-[Manrope] font-bold uppercase tracking-wider rounded transition-colors ${
                          previewTab === "card" ? "bg-black text-white" : "text-[#45464d] hover:text-black"
                        }`}
                      >
                        Card View
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTab("iframe")}
                        className={`px-3 py-1 text-[10px] font-[Manrope] font-bold uppercase tracking-wider rounded transition-colors ${
                          previewTab === "iframe" ? "bg-black text-white" : "text-[#45464d] hover:text-black"
                        }`}
                      >
                        Live Store {isEdit ? "" : "(Save first)"}
                      </button>
                    </div>

                    {liveProductUrl && (
                      <a
                        href={liveProductUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 border border-[#c6c6cd] hover:border-black text-black text-[10px] font-[Manrope] font-bold uppercase tracking-widest rounded-lg flex items-center gap-1 transition-colors hover:bg-[#eff4ff]"
                      >
                        <span className="material-symbols-outlined text-xs">open_in_new</span>
                        Store Tab
                      </a>
                    )}
                  </div>
                </div>

                {/* Preview Viewport Container */}
                <div
                  className={`mx-auto transition-all ${
                    previewDevice === "mobile"
                      ? "max-w-[390px] border-4 border-[#0b1c30] rounded-3xl overflow-hidden shadow-2xl bg-white p-2"
                      : "w-full"
                  }`}
                >
                  {/* TAB 1: Real-time Interactive Product Detail Preview */}
                  {previewTab === "detail" && (
                    <div className="border border-[#c6c6cd] rounded-xl bg-white p-4 sm:p-6 shadow-sm">
                      {/* Breadcrumbs */}
                      <div className="flex items-center space-x-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#7c839b] mb-6 overflow-x-auto pb-1">
                        <span>Home</span>
                        <span className="text-[#c6c6cd]">/</span>
                        <span>Collections</span>
                        <span className="text-[#c6c6cd]">/</span>
                        <span className="text-black font-semibold">{selectedCategoryName}</span>
                        <span className="text-[#c6c6cd]">/</span>
                        <span className="truncate max-w-[140px] text-[#006c49]">
                          {form.name || "Untitled Product"}
                        </span>
                      </div>

                      <div className={`grid gap-6 ${previewDevice === "mobile" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-12"}`}>
                        {/* Image Gallery */}
                        <div className={previewDevice === "mobile" ? "w-full" : "md:col-span-6 lg:col-span-7"}>
                          <div className="aspect-[3/4] relative bg-[#f8f9ff] rounded-xl overflow-hidden border border-[#e5eeff] group">
                            <img
                              src={currentPreviewImage}
                              alt={form.name || "Product preview"}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (target.src !== fallbackPreviewImg) target.src = fallbackPreviewImg;
                              }}
                            />

                            <div className="absolute top-3 right-3 w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-sm">
                              <span className="material-symbols-outlined text-black text-lg">favorite_border</span>
                            </div>

                            {form.compareAtPrice && parseFloat(form.compareAtPrice) > parseFloat(form.price || "0") && (
                              <div className="absolute top-3 left-3 bg-[#ba1a1a] text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow">
                                {Math.round((1 - parseFloat(form.price) / parseFloat(form.compareAtPrice)) * 100)}% OFF
                              </div>
                            )}
                          </div>

                          {/* Thumbnails row */}
                          {allImages.length > 1 && (
                            <div className="flex items-center gap-2 overflow-x-auto pt-3 pb-1">
                              {allImages.map((url, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setActivePreviewImg(url)}
                                  className={`relative w-14 h-16 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                                    currentPreviewImage === url ? "border-black shadow-md scale-105" : "border-[#c6c6cd] opacity-70 hover:opacity-100"
                                  }`}
                                >
                                  <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className={`space-y-4 ${previewDevice === "mobile" ? "w-full" : "md:col-span-6 lg:col-span-5"}`}>
                          <div>
                            <span className="text-[#006c49] text-[10px] font-bold tracking-[0.2em] uppercase block mb-1">
                              {selectedCategoryName}
                            </span>
                            <h4 className="text-2xl sm:text-3xl font-serif text-[#0b1c30] leading-tight">
                              {form.name || "Untitled Product"}
                            </h4>
                          </div>

                          {/* Pricing */}
                          <div className="flex items-baseline gap-3 pt-1">
                            <span className="text-2xl font-bold text-black font-[Manrope]">
                              ${form.price ? parseFloat(form.price).toFixed(2) : "0.00"}
                            </span>
                            {form.compareAtPrice && parseFloat(form.compareAtPrice) > parseFloat(form.price || "0") && (
                              <span className="text-sm text-[#7c839b] line-through font-[Manrope]">
                                ${parseFloat(form.compareAtPrice).toFixed(2)}
                              </span>
                            )}
                          </div>

                          {/* Stock badge */}
                          <div>
                            {form.trackQuantity ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eff4ff] text-[#006c49] text-[10px] font-bold uppercase tracking-widest">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#006c49]" />
                                In Stock & Ready to Ship
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f8f9ff] text-[#7c839b] text-[10px] font-bold uppercase tracking-widest border border-[#c6c6cd]">
                                Unlimited Order
                              </span>
                            )}
                          </div>

                          {/* Description */}
                          <div className="pt-2 border-t border-[#e5eeff]">
                            <p className="text-xs sm:text-sm text-[#45464d] leading-relaxed line-clamp-4 font-[Manrope]">
                              {form.description || "Enter a product description to preview detailed product storytelling..."}
                            </p>
                          </div>

                          {/* Tags */}
                          {form.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {form.tags.map(t => (
                                <span key={t} className="px-2 py-0.5 bg-[#f8f9ff] border border-[#c6c6cd] rounded text-[9px] font-[Manrope] font-semibold text-[#45464d]">
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Mock Add to Bag */}
                          <div className="pt-4 space-y-3">
                            <button
                              type="button"
                              className="w-full bg-black text-white py-3.5 px-4 rounded-lg font-[Manrope] text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#006c49] transition-colors shadow-sm"
                            >
                              <span className="material-symbols-outlined text-base">shopping_bag</span>
                              <span>Add to Bag</span>
                            </button>

                            <div className="flex items-center justify-center gap-2 text-[10px] font-[Manrope] text-[#7c839b]">
                              <span className="material-symbols-outlined text-sm text-[#006c49]">local_shipping</span>
                              <span>Complimentary Global Express Delivery</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Storefront Catalog Card View */}
                  {previewTab === "card" && (
                    <div className="p-8 bg-[#f8f9ff] rounded-xl border border-[#c6c6cd] flex items-center justify-center">
                      <div className="w-full max-w-[280px] bg-white rounded-xl overflow-hidden border border-[#e5eeff] shadow-md group">
                        <div className="aspect-[3/4] relative bg-[#eff4ff] overflow-hidden">
                          <img
                            src={currentPreviewImage}
                            alt={form.name || "Product"}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (target.src !== fallbackPreviewImg) target.src = fallbackPreviewImg;
                            }}
                          />
                          {form.compareAtPrice && parseFloat(form.compareAtPrice) > parseFloat(form.price || "0") && (
                            <div className="absolute top-2.5 left-2.5 bg-[#ba1a1a] text-white text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full">
                              Sale
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                            <div className="w-full bg-white text-black py-2 rounded text-center text-[10px] font-bold uppercase tracking-widest shadow">
                              Quick View
                            </div>
                          </div>
                        </div>
                        <div className="p-4 space-y-1.5">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-[#006c49]">
                            {selectedCategoryName}
                          </p>
                          <h5 className="font-serif text-base font-semibold text-black truncate">
                            {form.name || "Product Name"}
                          </h5>
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="font-[Manrope] font-bold text-sm text-black">
                              ${form.price ? parseFloat(form.price).toFixed(2) : "0.00"}
                            </span>
                            {form.compareAtPrice && parseFloat(form.compareAtPrice) > parseFloat(form.price || "0") && (
                              <span className="font-[Manrope] text-xs text-[#7c839b] line-through">
                                ${parseFloat(form.compareAtPrice).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: Live Storefront iframe */}
                  {previewTab === "iframe" && (
                    <>
                      {liveProductUrl ? (
                        <div className="overflow-hidden rounded-xl border border-[#c6c6cd] bg-[#f8f9ff]">
                          <div className="flex items-center justify-between gap-3 border-b border-[#c6c6cd] bg-white px-4 py-2.5">
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#006c49]" />
                              <p className="truncate text-xs font-[Manrope] font-bold text-[#0b1c30]">{seoTitle}</p>
                              <span className="text-[10px] font-[Manrope] text-[#7c839b] hidden md:inline truncate max-w-[280px]">
                                {liveProductUrl}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setIframeKey(k => k + 1)}
                                title="Reload live frame"
                                className="p-1 text-[#45464d] hover:text-black rounded hover:bg-[#eff4ff] transition-colors"
                              >
                                <span className="material-symbols-outlined text-base">refresh</span>
                              </button>
                              <a
                                href={liveProductUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-black hover:text-[#006c49] flex items-center gap-1"
                              >
                                <span>Open Full Page</span>
                                <span className="material-symbols-outlined text-xs">arrow_outward</span>
                              </a>
                            </div>
                          </div>
                          <iframe
                            key={iframeKey}
                            src={liveProductUrl}
                            title={`Live storefront preview for ${form.name || "product"}`}
                            loading="lazy"
                            className="block h-[640px] w-full border-0 bg-white"
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-[#c6c6cd] bg-[#f8f9ff] px-6 py-12 text-center">
                          <span className="material-symbols-outlined mb-3 text-4xl text-[#7c839b]">storefront</span>
                          <p className="font-[Manrope] text-base font-bold text-[#0b1c30] mb-1">
                            Save this product to publish the live URL
                          </p>
                          <p className="font-[Manrope] text-xs text-[#7c839b] max-w-md mx-auto mb-4">
                            You are currently composing a new product. Use the <strong>Detail View</strong> tab to test your layout in real-time, or click below to save and generate the live storefront page.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleSubmit()}
                            className="px-5 py-2.5 bg-black text-white text-[11px] font-[Manrope] font-bold uppercase tracking-widest rounded-lg hover:bg-[#006c49] transition-colors shadow-sm inline-flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-base">save</span>
                            Save Product Now
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <button type="button" onClick={() => setShowSeoEdit(v => !v)}
                  className="mt-4 text-[11px] font-[Manrope] font-bold uppercase tracking-widest text-black border-b border-black pb-0.5 hover:text-[#006c49] hover:border-[#006c49] transition-colors">
                  {showSeoEdit ? "Hide SEO Fields" : "Edit SEO Meta"}
                </button>

                {showSeoEdit && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1">
                        SEO Title
                      </label>
                      <input
                        className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-3 py-2 text-sm font-[Manrope] outline-none focus:border-black"
                        placeholder={`${form.name} | Luxe Boutique`}
                        value={form.seoTitle} onChange={e => setForm(f => ({ ...f, seoTitle: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1">
                        SEO Description
                      </label>
                      <textarea
                        className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-3 py-2 text-sm font-[Manrope] outline-none focus:border-black resize-none"
                        rows={3} placeholder="Brief description for search engines..."
                        value={form.seoDescription} onChange={e => setForm(f => ({ ...f, seoDescription: e.target.value }))} />
                      <p className="text-[10px] font-[Manrope] text-[#7c839b] mt-1">{form.seoDescription.length}/160 characters</p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
