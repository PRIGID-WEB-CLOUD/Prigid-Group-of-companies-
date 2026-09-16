import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  MdLocalOffer,
  MdAdd,
  MdClose,
  MdSearch,
  MdShoppingBag,
  MdCheck,
  MdPlace,
  MdOpenInNew,
  MdBolt,
  MdFormatQuote,
  MdInfo,
  MdDeleteOutline,
} from "react-icons/md";

export interface TaggedProduct {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  slug?: string;
  x?: number; // 0 to 1 (horizontal coordinate)
  y?: number; // 0 to 1 (vertical coordinate)
  retailerId?: string;
  catalogProductId?: string;
}

interface ProductItem {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  slug?: string;
  status?: string;
  categoryName?: string;
  retailerId?: string;
}

interface ProductTagPickerProps {
  platform: "instagram" | "facebook" | "twitter";
  targetType?: "FEED" | "REELS" | "STORIES" | "POST" | "TWEET" | "feed" | "reels" | "reel" | "stories" | "story" | "post" | "tweet" | string;
  taggedProducts: TaggedProduct[];
  onChange: (products: TaggedProduct[]) => void;
  onAppendToCaption?: (textToAppend: string) => void;
  maxTags?: number;
  previewImageUrl?: string;
}

export const ProductTagPicker: React.FC<ProductTagPickerProps> = ({
  platform,
  targetType: rawTargetType = "FEED",
  taggedProducts,
  onChange,
  onAppendToCaption,
  maxTags = 20,
  previewImageUrl,
}) => {
  const targetType = String(rawTargetType).toUpperCase();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [catalogProducts, setCatalogProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedForPinning, setSelectedForPinning] = useState<TaggedProduct | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // Fetch store catalog products for tagging
  useEffect(() => {
    let isMounted = true;
    async function fetchProducts() {
      setLoading(true);
      try {
        const res = await fetch("/api/products");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data)) {
            const mapped: ProductItem[] = data.map((p: any) => ({
              id: p.id,
              name: p.name || "Untitled Product",
              price: typeof p.price === "number" ? p.price : Number(p.price || 0),
              imageUrl: p.imageUrl || (Array.isArray(p.images) ? p.images[0] : undefined),
              slug: p.slug || p.id,
              status: p.status,
              categoryName: p.category?.name || p.categoryName,
              retailerId: p.id,
            }));
            setCatalogProducts(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to load catalog products for tagging:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return catalogProducts.slice(0, 30);
    return catalogProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.categoryName && p.categoryName.toLowerCase().includes(q))
      )
      .slice(0, 30);
  }, [catalogProducts, searchTerm]);

  const handleToggleProduct = (prod: ProductItem) => {
    const exists = taggedProducts.some((t) => t.id === prod.id);
    if (exists) {
      onChange(taggedProducts.filter((t) => t.id !== prod.id));
    } else {
      if (taggedProducts.length >= maxTags) {
        alert(`You can tag up to ${maxTags} products on this ${platform} post.`);
        return;
      }
      const newTag: TaggedProduct = {
        id: prod.id,
        name: prod.name,
        price: prod.price,
        imageUrl: prod.imageUrl,
        slug: prod.slug,
        x: 0.5,
        y: 0.5,
        retailerId: prod.retailerId || prod.id,
        catalogProductId: prod.id,
      };
      onChange([...taggedProducts, newTag]);
    }
  };

  const handleRemoveTag = (id: string) => {
    onChange(taggedProducts.filter((t) => t.id !== id));
  };

  const handleUpdatePinPosition = (id: string, x: number, y: number) => {
    onChange(
      taggedProducts.map((t) => (t.id === id ? { ...t, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 } : t))
    );
  };

  const generateInstantBuyLink = (prod: TaggedProduct) => {
    const prodUrl = `${origin}/products/${prod.slug || prod.id}`;
    return `🛍️ ${prod.name} ($${prod.price.toLocaleString()})\nInstant Buy: ${prodUrl}`;
  };

  const platformTitle =
    platform === "instagram"
      ? "Instagram Shoppable Product Tagging"
      : platform === "facebook"
      ? "Facebook Shoppable Product Tagging"
      : "X (Twitter) Shoppable Product Tagging";

  const targetDescription =
    targetType === "REELS"
      ? "Tag specific catalog items in your Reel so viewers can tap and purchase instantly."
      : targetType === "STORIES"
      ? "Tag catalog products and attach instant buy swipe/link tags in your Story."
      : "Tag specific catalog products on your post so shoppers can view details and checkout directly.";

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 space-y-4 shadow-2xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500/10 to-teal-500/15 text-emerald-700 flex items-center justify-center text-lg shrink-0">
            <MdLocalOffer />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 tracking-tight">{platformTitle}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {taggedProducts.length} / {maxTags} Tagged
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{targetDescription}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer self-start sm:self-auto"
        >
          {isOpen ? <MdClose className="text-sm" /> : <MdAdd className="text-sm" />}
          <span>{isOpen ? "Close Product Selector" : "Tag Products"}</span>
        </button>
      </div>

      {/* Selected Tagged Products List */}
      {taggedProducts.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Product Tags ({taggedProducts.length})
            </span>
            {onAppendToCaption && (
              <button
                type="button"
                onClick={() => {
                  const links = taggedProducts
                    .map((p) => `🛍️ ${p.name} ($${p.price.toLocaleString()}) → ${origin}/products/${p.slug || p.id}`)
                    .join("\n");
                  onAppendToCaption(`\n\n${links}`);
                }}
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
              >
                <MdFormatQuote className="text-sm" />
                <span>Append all buy links to post</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {taggedProducts.map((p) => (
              <div
                key={p.id}
                className="p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/40 flex items-center justify-between gap-3 group transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <MdShoppingBag className="text-slate-400 text-lg" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                    <p className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                      ${p.price.toLocaleString()}
                      {p.x !== undefined && p.y !== undefined && platform === "instagram" && targetType === "FEED" && (
                        <span className="text-[10px] text-slate-400 font-normal ml-2">
                          Pin: ({Math.round(p.x * 100)}%, {Math.round(p.y * 100)}%)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {platform === "instagram" && targetType === "FEED" && previewImageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedForPinning(p);
                        setShowPinModal(true);
                      }}
                      title="Adjust photo pin position"
                      className="p-1.5 text-slate-500 hover:text-emerald-700 rounded-lg hover:bg-emerald-100/60 transition-colors"
                    >
                      <MdPlace className="text-sm" />
                    </button>
                  )}

                  {onAppendToCaption && (
                    <button
                      type="button"
                      onClick={() => onAppendToCaption(`\n\n${generateInstantBuyLink(p)}`)}
                      title="Insert buy link into caption"
                      className="p-1.5 text-slate-500 hover:text-emerald-700 rounded-lg hover:bg-emerald-100/60 transition-colors"
                    >
                      <MdBolt className="text-sm" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveTag(p.id)}
                    title="Remove tag"
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <MdDeleteOutline className="text-sm" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
          <p className="text-xs text-slate-500">
            No products tagged yet. Click <strong>Tag Products</strong> to choose items from your catalog.
          </p>
        </div>
      )}

      {/* Product Selection Drawer / Accordion */}
      {isOpen && (
        <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-3">
          {/* Search Box */}
          <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products by title, category, or ID…"
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
            />
          </div>

          {/* Product Grid / List */}
          {loading ? (
            <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              <span>Loading store catalog…</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No products found matching &ldquo;{searchTerm}&rdquo;.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {filteredProducts.map((p) => {
                const isTagged = taggedProducts.some((t) => t.id === p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => handleToggleProduct(p)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      isTagged
                        ? "bg-emerald-50 border-emerald-300 shadow-2xs"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <MdShoppingBag className="text-slate-400 text-base" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                        <p className="text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-800">${p.price.toLocaleString()}</span>
                          {p.categoryName ? ` • ${p.categoryName}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isTagged ? "bg-emerald-600 text-white" : "border border-slate-300 text-transparent"
                        }`}
                      >
                        <MdCheck />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pin Position Modal (When clicking photo for Instagram Feed) */}
      {showPinModal && selectedForPinning && previewImageUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            ref={modalRef}
            className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <MdPlace className="text-emerald-600" />
                  Position Tag for &ldquo;{selectedForPinning.name}&rdquo;
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click anywhere on the photo where this product is displayed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <MdClose />
              </button>
            </div>

            <div
              className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-200 aspect-square max-h-80 mx-auto cursor-crosshair group flex items-center justify-center"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = (e.clientX - rect.left) / rect.width;
                const clickY = (e.clientY - rect.top) / rect.height;
                handleUpdatePinPosition(selectedForPinning.id, clickX, clickY);
                setSelectedForPinning({
                  ...selectedForPinning,
                  x: Math.round(clickX * 1000) / 1000,
                  y: Math.round(clickY * 1000) / 1000,
                });
              }}
            >
              <img src={previewImageUrl} alt="Target pin locator" className="w-full h-full object-contain pointer-events-none" />

              {/* Pin Indicator */}
              {selectedForPinning.x !== undefined && selectedForPinning.y !== undefined && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none transition-all duration-75"
                  style={{
                    left: `${selectedForPinning.x * 100}%`,
                    top: `${selectedForPinning.y * 100}%`,
                  }}
                >
                  <div className="px-2 py-0.5 rounded-md bg-slate-900/90 backdrop-blur-xs text-white text-[10px] font-bold shadow-lg border border-white/20 whitespace-nowrap mb-1">
                    {selectedForPinning.name} • ${selectedForPinning.price}
                  </div>
                  <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-lg animate-ping absolute" />
                  <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-lg relative" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Coordinates: ({Math.round((selectedForPinning.x ?? 0.5) * 100)}%, {Math.round((selectedForPinning.y ?? 0.5) * 100)}%)
              </span>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Save Pin Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
