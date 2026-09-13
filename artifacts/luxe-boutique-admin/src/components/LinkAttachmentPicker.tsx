import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  MdLink,
  MdLinkOff,
  MdOpenInNew,
  MdClose,
  MdShoppingBag,
  MdStorefront,
  MdAutoAwesome,
  MdCheckCircle,
  MdKeyboardArrowDown,
  MdOutlineContentCopy,
} from "react-icons/md";

interface ProductOption {
  id: string;
  name: string;
  price?: number;
  slug?: string;
  images?: string[] | string;
}

interface CategoryOption {
  id: string;
  name: string;
  slug?: string;
}

interface BlogPostOption {
  id: string;
  title: string;
  slug?: string;
  imageUrl?: string;
  content?: string;
  authorName?: string;
}

interface CouponOption {
  id: string;
  code: string;
  discountType?: string;
  discountValue?: number;
  active?: boolean;
}

interface LinkAttachmentPickerProps {
  value: string;
  onChange: (url: string) => void;
  messageText?: string;
  label?: string;
  placeholder?: string;
  hint?: string;
  onImageDetected?: (imageUrl: string, meta?: { title: string; image: string; domain: string }) => void;
}

export const LinkAttachmentPicker: React.FC<LinkAttachmentPickerProps> = ({
  value,
  onChange,
  messageText = "",
  label = "Link Attachment (Optional URL)",
  placeholder = "https://example.com/promo or select from store dropdown",
  hint = "Attach a direct product, collection, article, or custom URL to generate a clickable link card.",
  onImageDetected,
}) => {
  const [isOpen, setIsOpen] = useState(Boolean(value));
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [posts, setPosts] = useState<BlogPostOption[]>([]);
  const [coupons, setCoupons] = useState<CouponOption[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("custom");
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract base origin
  const origin = typeof window !== "undefined" ? window.location.origin : "https://luxeboutique.store";

  // Preset destination routes (only included if corresponding items/content exist in store)
  const STORE_PRESETS = useMemo(() => {
    const presets: { label: string; path: string; category: string }[] = [
      { label: "Store Homepage", path: `${origin}/`, category: "Pages" },
    ];

    if (products.length > 0) {
      presets.push(
        { label: "Luxury Catalog (All Items)", path: `${origin}/catalog`, category: "Pages" },
        { label: "New Arrivals & Drops", path: `${origin}/catalog?filter=new`, category: "Pages" }
      );
    }

    if (categories.length > 0) {
      presets.push(
        { label: "Collections & Categories Page", path: `${origin}/categories`, category: "Pages" }
      );
    }

    if (posts.length > 0) {
      presets.push(
        { label: "Editorial Blog & Lookbooks Main Page", path: `${origin}/blog`, category: "Pages" }
      );
    }

    presets.push(
      { label: "Order Tracking & Concierge", path: `${origin}/orders/track`, category: "Support" }
    );

    return presets;
  }, [origin, products.length, categories.length, posts.length]);

  // Load products, categories, blog posts, and active coupons from store API
  useEffect(() => {
    let mounted = true;
    setLoadingItems(true);

    Promise.allSettled([
      fetch("/api/products").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/categories").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/posts").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/coupons").then((r) => (r.ok ? r.json() : [])),
    ]).then(([prodRes, catRes, postRes, couponRes]) => {
      if (!mounted) return;

      if (prodRes.status === "fulfilled") {
        const data = prodRes.value;
        if (Array.isArray(data)) setProducts(data);
        else if (data && Array.isArray(data.products)) setProducts(data.products);
      }

      if (catRes.status === "fulfilled") {
        const data = catRes.value;
        if (Array.isArray(data)) setCategories(data);
      }

      if (postRes.status === "fulfilled") {
        const data = postRes.value;
        if (Array.isArray(data)) setPosts(data);
      }

      if (couponRes.status === "fulfilled") {
        const data = couponRes.value;
        if (Array.isArray(data)) {
          setCoupons(data.filter((c: any) => c && c.active !== false));
        }
      }
    }).finally(() => {
      if (mounted) setLoadingItems(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Auto-detect URL from message/caption text
  useEffect(() => {
    if (!messageText) {
      setDetectedUrl(null);
      return;
    }

    // Match http://, https://, or www. URLs in the text
    const urlMatch = messageText.match(/(https?:\/\/[^\s]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-.~%#?&=/_+]+)/i);
    if (urlMatch && urlMatch[0]) {
      let raw = urlMatch[0].trim();
      // Remove trailing punctuation like period or comma
      raw = raw.replace(/[.,;!?)]+$/, "");
      if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
        raw = `https://${raw}`;
      }
      setDetectedUrl(raw);

      // If user has not manually set a link yet and post message contains a URL, auto-set or propose
      if (!value) {
        // We leave it as detectedUrl so user can 1-click attach, or auto-sync
      }
    } else {
      setDetectedUrl(null);
    }
  }, [messageText, value]);

  // Match existing value to preset if applicable
  useEffect(() => {
    if (!value) {
      setSelectedPreset("custom");
      return;
    }
    const foundPreset = STORE_PRESETS.find((p) => p.path === value);
    if (foundPreset) {
      setSelectedPreset(foundPreset.path);
      return;
    }
    const foundProduct = products.find((prod) => {
      const prodUrl = `${origin}/products/${prod.slug || prod.id}`;
      return prodUrl === value;
    });
    if (foundProduct) {
      setSelectedPreset(`${origin}/products/${foundProduct.slug || foundProduct.id}`);
      return;
    }
    const foundCategory = categories.find((cat) => {
      const catUrl = `${origin}/categories?category=${cat.slug || cat.id}`;
      return catUrl === value;
    });
    if (foundCategory) {
      setSelectedPreset(`${origin}/categories?category=${foundCategory.slug || foundCategory.id}`);
      return;
    }
    const foundPost = posts.find((post) => {
      const postUrl = `${origin}/blog/${post.slug || post.id}`;
      return postUrl === value;
    });
    if (foundPost) {
      setSelectedPreset(`${origin}/blog/${foundPost.slug || foundPost.id}`);
      return;
    }
    const foundCoupon = coupons.find((cp) => {
      const cpUrl = `${origin}/checkout?coupon=${cp.code}`;
      return cpUrl === value;
    });
    if (foundCoupon) {
      setSelectedPreset(`${origin}/checkout?coupon=${foundCoupon.code}`);
      return;
    }
    setSelectedPreset("custom");
  }, [value, STORE_PRESETS, products, categories, posts, coupons, origin]);

  const handleSelectPreset = (val: string) => {
    setSelectedPreset(val);
    if (val === "custom") {
      if (inputRef.current) inputRef.current.focus();
    } else if (val === "") {
      onChange("");
    } else {
      onChange(val);
    }
  };

  const handleAttachDetectedUrl = () => {
    if (detectedUrl) {
      onChange(detectedUrl);
      setIsOpen(true);
    }
  };

  const handleClear = () => {
    onChange("");
    setSelectedPreset("custom");
    setIsOpen(false);
  };

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAttached = Boolean(value && value.trim().length > 0);

  // Map preset or URL to prefilled image card meta
  const resolvedCardMeta = useMemo(() => {
    if (!value) return null;
    const urlLower = value.toLowerCase();

    // Check products first
    const matchedProduct = products.find((prod) => {
      const pUrl = `${origin}/products/${prod.slug || prod.id}`.toLowerCase();
      return pUrl === urlLower || urlLower.includes(`/products/${prod.slug || prod.id}`);
    });

    if (matchedProduct) {
      let img = "";
      if (Array.isArray(matchedProduct.images) && matchedProduct.images.length > 0) {
        img = matchedProduct.images[0];
      } else if (typeof matchedProduct.images === "string") {
        img = matchedProduct.images;
      }
      if (!img) {
        img = "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80";
      }
      return {
        title: matchedProduct.name,
        subtitle: matchedProduct.price ? `€${Number(matchedProduct.price).toFixed(2)} • LUXE BOUTIQUE` : "LUXE BOUTIQUE",
        image: img,
        domain: "luxeboutique.store",
        type: "product"
      };
    }

    // Check categories
    const matchedCategory = categories.find((cat) => {
      const catUrl = `${origin}/categories?category=${cat.slug || cat.id}`.toLowerCase();
      return catUrl === urlLower || urlLower.includes(`category=${(cat.slug || cat.id).toLowerCase()}`);
    });

    if (matchedCategory) {
      return {
        title: `${matchedCategory.name} Collection`,
        subtitle: `Explore ${matchedCategory.name} Category • LUXE BOUTIQUE`,
        image: "https://images.unsplash.com/photo-1470309864661-68328b2cd0a5?auto=format&fit=crop&w=1200&q=80",
        domain: "luxeboutique.store",
        type: "category"
      };
    }

    // Check blog posts / lookbooks
    const matchedPost = posts.find((post) => {
      const postUrl = `${origin}/blog/${post.slug || post.id}`.toLowerCase();
      return postUrl === urlLower || urlLower.includes(`/blog/${post.slug || post.id}`);
    });

    if (matchedPost) {
      return {
        title: matchedPost.title,
        subtitle: `Editorial Lookbook • By ${matchedPost.authorName || "LUXE BOUTIQUE"}`,
        image: matchedPost.imageUrl || "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80",
        domain: "luxeboutique.store",
        type: "post"
      };
    }

    // Check active coupons
    const matchedCoupon = coupons.find((cp) => {
      const cpUrl = `${origin}/checkout?coupon=${cp.code}`.toLowerCase();
      return cpUrl === urlLower || urlLower.includes(`coupon=${cp.code.toLowerCase()}`);
    });

    if (matchedCoupon) {
      const discountText = matchedCoupon.discountType === "PERCENTAGE"
        ? `${matchedCoupon.discountValue}% OFF`
        : `€${matchedCoupon.discountValue} OFF`;
      return {
        title: `Special Promo: ${matchedCoupon.code} (${discountText})`,
        subtitle: `Claim Exclusive Checkout Discount • LUXE BOUTIQUE`,
        image: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80",
        domain: "luxeboutique.store",
        type: "coupon"
      };
    }

    // Check preset pages
    if (urlLower.includes("/catalog?filter=new")) {
      return {
        title: "New Arrivals & Capsule Drops",
        subtitle: "Exclusive Seasonal Collection • LUXE BOUTIQUE",
        image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80",
        domain: "luxeboutique.store",
        type: "preset"
      };
    }
    if (urlLower.includes("/catalog")) {
      return {
        title: "Luxury Catalog & Couture Collections",
        subtitle: "Explore All Products • LUXE BOUTIQUE",
        image: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=80",
        domain: "luxeboutique.store",
        type: "preset"
      };
    }
    if (urlLower.includes("/categories")) {
      return {
        title: "Boutique Categories & Lookbooks",
        subtitle: "Designer Fashion & Accessories",
        image: "https://images.unsplash.com/photo-1470309864661-68328b2cd0a5?auto=format&fit=crop&w=1200&q=80",
        domain: "luxeboutique.store",
        type: "preset"
      };
    }
    if (urlLower.includes("/blog")) {
      return {
        title: "Editorial Fashion Journal & Style Guides",
        subtitle: "Behind the Atelier • LUXE BOUTIQUE",
        image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80",
        domain: "luxeboutique.store",
        type: "preset"
      };
    }
    if (urlLower.includes("/orders/track")) {
      return {
        title: "White-Glove Order Tracking & Concierge",
        subtitle: "Real-time Order Updates • LUXE BOUTIQUE",
        image: "https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?auto=format&fit=crop&w=1200&q=80",
        domain: "luxeboutique.store",
        type: "preset"
      };
    }

    // Default Fallback Store Card
    let hostname = "luxeboutique.store";
    try {
      hostname = new URL(value, origin).hostname;
    } catch (_) {}

    return {
      title: "LUXE BOUTIQUE | Official Online Store",
      subtitle: "High Fashion & Designer Apparel",
      image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
      domain: hostname,
      type: "general"
    };
  }, [value, products, categories, posts, coupons, origin]);

  // Notify parent on image card detection
  useEffect(() => {
    if (resolvedCardMeta && onImageDetected) {
      onImageDetected(resolvedCardMeta.image, {
        title: resolvedCardMeta.title,
        image: resolvedCardMeta.image,
        domain: resolvedCardMeta.domain,
      });
    }
  }, [resolvedCardMeta, onImageDetected]);

  return (
    <div className="space-y-2">
      {/* Header with Title and Toggle/Clear Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <label className="font-[Manrope] font-bold text-[11px] tracking-widest uppercase text-[#45464d] flex items-center gap-1">
            <MdLink className="text-sm text-[#006c49]" />
            {label}
          </label>
          {isAttached && (
            <span className="px-1.5 py-0.5 bg-emerald-50 text-[#006c49] border border-emerald-200 rounded text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-0.5">
              <MdCheckCircle className="text-[10px]" /> Attached
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isAttached ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] font-bold font-[Manrope] text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1"
            >
              <MdClose className="text-xs" /> Remove Link
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsOpen(!isOpen);
                if (!isOpen && !value && detectedUrl) {
                  onChange(detectedUrl);
                }
              }}
              className="text-[11px] font-bold font-[Manrope] text-[#006c49] hover:text-[#005237] hover:bg-emerald-50 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1"
            >
              {isOpen ? "Close Picker" : "+ Select / Attach URL"}
            </button>
          )}
        </div>
      </div>

      {/* Auto URL Detection Banner */}
      {detectedUrl && detectedUrl !== value && (
        <div className="p-2.5 bg-amber-50 border border-amber-200/90 rounded-xl flex items-center justify-between gap-2 transition-all">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <MdAutoAwesome className="text-xs" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-amber-900 truncate font-[Manrope]">
                Detected link in message text
              </p>
              <p className="text-[10px] text-amber-700 truncate font-mono">
                {detectedUrl}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAttachDetectedUrl}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold font-[Manrope] shrink-0 shadow-xs transition-colors flex items-center gap-1"
          >
            <MdLink /> Attach Link
          </button>
        </div>
      )}

      {/* Main Link Attachment Controls (shown if open or if a value is attached) */}
      {(isOpen || isAttached) && (
        <div className="p-3 bg-slate-50/90 border border-slate-200/80 rounded-xl space-y-2.5 transition-all">
          {/* Dropdown Select for Fast Store Destinations & Catalog Items */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-[Manrope] flex items-center justify-between">
              <span>Choose Destination Preset or Live Product / Article / Coupon</span>
              {loadingItems && <span className="text-[9px] text-slate-400 font-normal">Loading store data...</span>}
            </label>
            <div className="relative">
              <select
                value={selectedPreset}
                onChange={(e) => handleSelectPreset(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-[Manrope] text-slate-800 outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] appearance-none pr-8 cursor-pointer"
              >
                <option value="custom">✏️ Custom URL / Manual Input</option>
                <optgroup label="Store Pages & Navigation">
                  {STORE_PRESETS.map((p) => (
                    <option key={p.path} value={p.path}>
                      {p.label} ({p.path.replace(origin, "")})
                    </option>
                  ))}
                </optgroup>
                {categories.length > 0 && (
                  <optgroup label={`📁 Categories & Collections (${categories.length})`}>
                    {categories.map((cat) => {
                      const catUrl = `${origin}/categories?category=${cat.slug || cat.id}`;
                      return (
                        <option key={cat.id} value={catUrl}>
                          📁 {cat.name} (/categories?category={cat.slug || cat.id})
                        </option>
                      );
                    })}
                  </optgroup>
                )}
                {posts.length > 0 && (
                  <optgroup label={`📰 Lookbooks & Editorial Articles (${posts.length})`}>
                    {posts.map((post) => {
                      const postUrl = `${origin}/blog/${post.slug || post.id}`;
                      return (
                        <option key={post.id} value={postUrl}>
                          📖 {post.title} (/blog/{post.slug || post.id})
                        </option>
                      );
                    })}
                  </optgroup>
                )}
                {coupons.length > 0 && (
                  <optgroup label={`🎟️ Active Promo Checkout Coupons (${coupons.length})`}>
                    {coupons.map((cp) => {
                      const cpUrl = `${origin}/checkout?coupon=${cp.code}`;
                      const discountStr = cp.discountType === "PERCENTAGE" 
                        ? `${cp.discountValue}% OFF` 
                        : `€${cp.discountValue} OFF`;
                      return (
                        <option key={cp.id} value={cpUrl}>
                          🎟️ Coupon: {cp.code} ({discountStr})
                        </option>
                      );
                    })}
                  </optgroup>
                )}
                {products.length > 0 && (
                  <optgroup label={`🛍️ Boutique Products (${products.length})`}>
                    {products.map((prod) => {
                      const prodUrl = `${origin}/products/${prod.slug || prod.id}`;
                      const priceStr = prod.price ? ` — €${Number(prod.price).toFixed(2)}` : "";
                      return (
                        <option key={prod.id} value={prodUrl}>
                          {prod.name}{priceStr}
                        </option>
                      );
                    })}
                  </optgroup>
                )}
              </select>
              <MdKeyboardArrowDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-base" />
            </div>
          </div>

          {/* Editable Full URL Input Field */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-[Manrope]">
              Destination URL
            </label>
            <div className="flex gap-1.5 items-center">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="url"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
                />
              </div>
              {value && (
                <>
                  <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open destination in new tab"
                    className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-[#006c49] hover:border-[#006c49] rounded-lg text-xs transition-colors shrink-0"
                  >
                    <MdOpenInNew />
                  </a>
                  <button
                    type="button"
                    onClick={handleCopy}
                    title="Copy URL"
                    className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg text-xs transition-colors shrink-0"
                  >
                    {copied ? <MdCheckCircle className="text-emerald-600" /> : <MdOutlineContentCopy />}
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    title="Clear link"
                    className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-red-600 rounded-lg text-xs transition-colors shrink-0"
                  >
                    <MdClose />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Prefilled Link Card Preview Box */}
          {isAttached && resolvedCardMeta && (
            <div className="mt-2.5 p-2.5 bg-white border border-slate-200/90 rounded-xl shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 font-[Manrope]">
                <span className="flex items-center gap-1 text-[#006c49]">
                  <MdAutoAwesome className="text-xs" />
                  Prefilled Link Card Preview
                </span>
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-mono text-[9px]">
                  {resolvedCardMeta.domain}
                </span>
              </div>
              
              <div className="flex gap-3 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="w-16 h-12 rounded-md overflow-hidden bg-slate-200 shrink-0 border border-slate-200/60">
                  <img
                    src={resolvedCardMeta.image}
                    alt={resolvedCardMeta.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate font-[Manrope]">
                    {resolvedCardMeta.title}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate font-[Manrope]">
                    {resolvedCardMeta.subtitle}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Active Link Preview Info Badge */}
          {isAttached && (
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 text-slate-500 font-[Manrope]">
              <span className="flex items-center gap-1 truncate">
                <MdStorefront className="text-[#006c49] shrink-0" />
                <span className="truncate">{value}</span>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-[10px] font-bold uppercase tracking-wider shrink-0 ml-2"
              >
                Close Picker
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fallback hint when closed */}
      {!isOpen && !isAttached && (
        <p className="text-[11px] text-slate-400 font-[Manrope]">{hint}</p>
      )}
    </div>
  );
};
