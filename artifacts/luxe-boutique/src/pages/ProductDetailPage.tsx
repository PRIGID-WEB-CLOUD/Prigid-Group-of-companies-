import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { motion } from "motion/react";
import { ChevronRight, Minus, Plus, ShoppingBag, Heart, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/contexts/CartContext";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=1000&auto=format&fit=crop";

import { logCartDiagnostic } from "../utils/cartDiagnostic";
import { trackMetaEvent } from "@/components/MetaPixelTracker";
import { SEO } from "@/components/SEO";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { refreshCart } = useCart();
  const [product, setProduct] = useState<any>(null);
  const [activeImage, setActiveImage] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const availableSizes: string[] = Array.from(new Set(variants.map((v: any) => v.size).filter(Boolean)));
  const availableColors: string[] = Array.from(new Set(variants.map((v: any) => v.color).filter(Boolean)));

  const selectedVariant = variants.find((v: any) => {
    const sizeMatch = !selectedSize || v.size === selectedSize;
    const colorMatch = !selectedColor || v.color === selectedColor;
    return sizeMatch && colorMatch;
  });

  const activePrice = (selectedVariant && typeof selectedVariant.price === "number" && selectedVariant.price > 0)
    ? selectedVariant.price
    : (product?.price ?? 0);

  const activeStock = selectedVariant && typeof selectedVariant.stock === "number"
    ? selectedVariant.stock
    : (product?.stock ?? 0);

  const stock: number = activeStock;
  const inStock = stock > 0;
  const lowStock = stock > 0 && stock <= 5;

  const [addingToCart, setAddingToCart] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [addingToWishlist, setAddingToWishlist] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then(r => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(d => {
        if (d && d.id) {
          setProduct(d);
          const firstImg = d.imageUrl || (Array.isArray(d.images) && d.images[0]) || FALLBACK_IMAGE;
          setActiveImage(firstImg);

          if (Array.isArray(d.variants) && d.variants.length > 0) {
            const first = d.variants[0];
            if (first.size) setSelectedSize(first.size);
            if (first.color) setSelectedColor(first.color);
          }
          
          // Track ViewContent
          trackMetaEvent("ViewContent", {
            content_name: d.name,
            content_category: d.category?.name,
            content_ids: [d.id],
            content_type: "product",
            value: d.price,
            currency: "EUR"
          });
        } else {
          setProduct(null);
        }
        setLoading(false);
      })
      .catch(() => {
        setProduct(null);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (user) {
      fetch("/api/wishlist").then(r => r.json()).then(w => { if (Array.isArray(w)) setIsWishlisted(w.some((item: any) => item.productId === id)); });
    }
  }, [user, id]);

  const addToCart = async () => {
    setAddingToCart(true);
    let res: Response | undefined;
    let data: any;
    try {
      res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: id,
          quantity,
          variantId: selectedVariant?.id,
          selectedSize,
          selectedColor,
        }),
      });
      data = await res.clone().json().catch(() => ({}));
      
      // Execute diagnostic utility logger
      await logCartDiagnostic(id || "", quantity, user, res, data);

      if (res.ok) {
        await refreshCart();
        
        // Track AddToCart
        trackMetaEvent("AddToCart", {
          content_name: product?.name,
          content_ids: [id],
          content_type: "product",
          value: activePrice * quantity,
          currency: "EUR",
          quantity: quantity
        });

        navigate("/cart");
      } else {
        alert(data?.error || "Failed to add item to cart.");
      }
    } catch (err) {
      console.error("Cart Request Error:", err);
      alert("Failed to add item to cart. Please check your connection.");
    } finally {
      setAddingToCart(false);
    }
  };

  const toggleWishlist = async () => {
    if (!user) { navigate("/login"); return; }
    setAddingToWishlist(true);
    try {
      if (isWishlisted) {
        await fetch(`/api/wishlist/${id}`, { method: "DELETE" });
        setIsWishlisted(false);
      } else {
        await fetch("/api/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: id }) });
        setIsWishlisted(true);
      }
    } finally { setAddingToWishlist(false); }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate("/login"); return; }
    if (!reviewText.trim()) return;
    setSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: id, rating, comment: reviewText }) });
      if (res.ok) {
        const newReview = await res.json();
        setProduct((prev: any) => ({ ...prev, reviews: [newReview, ...prev.reviews] }));
        setReviewText(""); setRating(5);
      }
    } finally { setSubmittingReview(false); }
  };

  if (loading) return <div className="max-w-7xl mx-auto px-8 py-20">Loading...</div>;
  if (!product) return <div className="max-w-7xl mx-auto px-8 py-20 text-center">Product not found</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
      <SEO
        title={product.seoTitle || `${product.name} — LUXE BOUTIQUE`}
        description={product.seoDescription || product.description || `Buy ${product.name} at LUXE BOUTIQUE. Luxury fashion & designer apparel.`}
        image={activeImage || product.imageUrl || FALLBACK_IMAGE}
        type="product"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          image: [activeImage || product.imageUrl || FALLBACK_IMAGE],
          description: product.description || product.name,
          sku: product.sku || product.id,
          offers: {
            "@type": "Offer",
            priceCurrency: "USD",
            price: activePrice,
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: window.location.href,
          },
        }}
      />
      <nav className="mb-12">
        <ol className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <li><Link href="/">Home</Link></li>
          <li><ChevronRight size={12} /></li>
          <li><Link href="/products">Collections</Link></li>
          <li><ChevronRight size={12} /></li>
          <li className="text-slate-900">{product.name}</li>
        </ol>
      </nav>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 mb-24">
        <div className="lg:col-span-7 space-y-4">
          <div className="aspect-[3/4] relative bg-slate-50 overflow-hidden rounded-xl shadow-sm group">
            <img
              src={activeImage || product.imageUrl || FALLBACK_IMAGE}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== FALLBACK_IMAGE) target.src = FALLBACK_IMAGE;
              }}
            />
            <button
              onClick={toggleWishlist}
              disabled={addingToWishlist}
              className="absolute top-6 right-6 w-12 h-12 bg-white/90 backdrop-blur rounded-full flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all shadow-sm"
            >
              <Heart size={20} className={isWishlisted ? "fill-slate-900 text-slate-900" : ""} />
            </button>
          </div>

          {Array.isArray(product.images) && product.images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
              {product.images.map((img: string, idx: number) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImage(img)}
                  className={`relative w-20 h-24 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                    activeImage === img
                      ? "border-slate-900 shadow-md scale-105"
                      : "border-slate-200 opacity-70 hover:opacity-100 hover:border-slate-400"
                  }`}
                >
                  <img src={img} alt={`${product.name} thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="lg:col-span-5 space-y-10">
          <header className="space-y-4">
            <span className="text-emerald-600 text-xs font-bold tracking-[0.2em] uppercase">{product.category?.name || "Exclusive Edition"}</span>
            <h1 className="text-3xl md:text-5xl font-serif text-slate-900 leading-tight">{product.name}</h1>
            <div className="flex items-baseline gap-4">
              <p className="text-2xl md:text-3xl font-medium text-slate-900">{formatPrice(activePrice)}</p>
              {selectedVariant?.sku && (
                <span className="text-xs text-slate-400 font-mono">SKU: {selectedVariant.sku}</span>
              )}
            </div>
          </header>
          <p className="text-slate-600 text-base leading-relaxed">{product.description}</p>
          <div className="space-y-6 pt-6 border-t border-slate-100">
            {/* Color Swatches */}
            {availableColors.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-900">
                  <span>Color: <span className="text-emerald-600 normal-case font-semibold">{selectedColor || "Select Color"}</span></span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {availableColors.map((colorName) => {
                    const isSelected = selectedColor === colorName;
                    return (
                      <button
                        key={colorName}
                        type="button"
                        onClick={() => setSelectedColor(colorName)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-bold transition-all ${
                          isSelected
                            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
                          style={{
                            backgroundColor: colorName.toLowerCase().includes("gold") ? "#D4AF37"
                              : colorName.toLowerCase().includes("ivory") ? "#FFFFF0"
                              : colorName.toLowerCase().includes("black") ? "#111827"
                              : colorName.toLowerCase().includes("emerald") ? "#047857"
                              : colorName.toLowerCase().includes("navy") ? "#1E3A8A"
                              : colorName.toLowerCase().includes("red") ? "#DC2626"
                              : colorName.toLowerCase().includes("pink") ? "#EC4899"
                              : colorName.toLowerCase().includes("white") ? "#FFFFFF"
                              : colorName.toLowerCase(),
                          }}
                        />
                        <span>{colorName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Chips */}
            {availableSizes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-900">
                  <span>Size: <span className="text-emerald-600 font-semibold">{selectedSize || "Select Size"}</span></span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {availableSizes.map((sizeName) => {
                    const isSelected = selectedSize === sizeName;
                    return (
                      <button
                        key={sizeName}
                        type="button"
                        onClick={() => setSelectedSize(sizeName)}
                        className={`min-w-[48px] px-4 py-2.5 rounded-lg border text-xs font-bold tracking-wider transition-all ${
                          isSelected
                            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                        }`}
                      >
                        {sizeName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {product && (
              <div className="flex items-center gap-2">
                {inStock ? (
                  lowStock ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                      Only {stock} left
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      In Stock ({stock})
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                    Out of Stock
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center space-x-6">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-900">Quantity</span>
              <div className="flex items-center border border-slate-200 rounded-lg p-2 gap-4">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-1 hover:text-emerald-600"><Minus size={16} /></button>
                <span className="w-8 text-center font-bold">{quantity}</span>
                <button onClick={() => setQuantity(q => Math.min(q + 1, stock > 0 ? stock : 99))} className="p-1 hover:text-emerald-600"><Plus size={16} /></button>
              </div>
            </div>
            <button onClick={addToCart} disabled={addingToCart || !inStock} className="w-full bg-slate-900 text-white py-5 rounded-none font-bold uppercase tracking-widest text-xs flex items-center justify-center space-x-3 hover:bg-emerald-600 transition-all active:scale-95 disabled:bg-slate-300 shadow-lg">
              <ShoppingBag size={18} />
              <span>{addingToCart ? "Adding..." : inStock ? "Add to Bag" : "Out of Stock"}</span>
            </button>
          </div>
          <div className="pt-10 space-y-6">
            <div className="flex items-center space-x-4 text-slate-500">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                <ShoppingBag size={16} className="text-slate-400" />
              </div>
              <span className="text-xs uppercase tracking-widest font-semibold text-slate-900">Complimentary Global Express Shipping</span>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-100 pt-16">
        <h2 className="text-2xl font-serif text-slate-900 mb-10">Customer Reviews</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            {product.reviews && product.reviews.length > 0 ? (
              <div className="space-y-8">
                {product.reviews.map((review: any) => (
                  <div key={review.id} className="border-b border-slate-100 pb-8 last:border-0">
                    <div className="flex items-center space-x-1 mb-3 text-emerald-600">
                      {[...Array(5)].map((_, i) => <Star key={i} size={14} className={i < review.rating ? "fill-emerald-600" : "fill-slate-200 text-slate-200"} />)}
                    </div>
                    <p className="text-slate-600 italic mb-3">&quot;{review.comment}&quot;</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">— {review.user?.name || "Anonymous Guest"}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-500 italic">No reviews yet. Be the first to review this product.</p>}
          </div>
          <div className="bg-slate-50 p-8 rounded-xl">
            <h3 className="text-lg font-serif text-slate-900 mb-6">Write a Review</h3>
            {user ? (
              <form onSubmit={submitReview} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Rating</label>
                  <div className="flex items-center space-x-2 text-emerald-600">
                    {[1,2,3,4,5].map(star => (
                      <button key={star} type="button" onClick={() => setRating(star)} className="hover:scale-110 transition-transform">
                        <Star size={24} className={star <= rating ? "fill-emerald-600" : "fill-slate-200 text-slate-200"} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Review</label>
                  <textarea rows={4} value={reviewText} onChange={e => setReviewText(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-4 text-sm outline-none focus:border-slate-900 transition-colors resize-none" placeholder="Share your thoughts..." required />
                </div>
                <button type="submit" disabled={submittingReview} className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest px-8 py-4 rounded hover:bg-slate-800 transition-colors disabled:bg-slate-400">
                  {submittingReview ? "Submitting..." : "Submit Review"}
                </button>
              </form>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500 mb-4">Please log in to leave a review.</p>
                <Link href="/login" className="inline-block bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest px-8 py-4 rounded hover:bg-slate-800 transition-colors">Log In</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
