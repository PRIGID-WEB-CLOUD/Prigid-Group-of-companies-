import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Minus, Plus, Trash2, ArrowRight, Tag, CheckCircle, X } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/contexts/CartContext";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=400&auto=format&fit=crop";

type Coupon = { code: string; type: string; value: number; discount: number; description: string };

export default function CartPage() {
  const [, navigate] = useLocation();
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { formatPrice } = useCurrency();
  const { refreshCart } = useCart();

  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const fetchCart = async () => {
    const res = await fetch("/api/cart");
    const data = await res.json();
    setCart(data);
    setLoading(false);
  };

  useEffect(() => { fetchCart(); }, []);

  const updateQuantity = async (productId: string, newQty: number) => {
    if (newQty < 1) return;
    const res = await fetch(`/api/cart/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: newQty }),
    });
    if (res.ok) { fetchCart(); await refreshCart(); }
  };

  const removeItem = async (productId: string) => {
    const res = await fetch(`/api/cart/${productId}`, { method: "DELETE" });
    if (res.ok) { fetchCart(); await refreshCart(); }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError(null);
    setCoupon(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim(), orderAmount: subtotal }),
      });
      const data = await res.json();
      if (!res.ok) { setCouponError(data.error || "Invalid coupon code"); return; }
      setCoupon({ code: data.code, type: data.type, value: data.value, discount: data.discount, description: data.description });
    } catch {
      setCouponError("Could not validate coupon. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => { setCoupon(null); setCouponCode(""); setCouponError(null); };

  const handleCheckout = () => {
    const url = coupon ? `/checkout?coupon=${encodeURIComponent(coupon.code)}` : "/checkout";
    navigate(url);
  };

  const subtotal = cart?.items?.reduce((acc: number, item: any) => {
    const itemPrice = (item.product?.selectedVariant && typeof item.product.selectedVariant.price === "number")
      ? item.product.selectedVariant.price
      : item.product.price;
    return acc + (itemPrice * item.quantity);
  }, 0) || 0;
  const discount = coupon?.discount ?? 0;
  const total = Math.max(0, subtotal - discount);

  if (loading) return (
    <div className="max-w-7xl mx-auto px-8 py-20 flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="w-7 h-7 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading your bag…</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 min-h-[60vh]">
      <header className="mb-12">
        <h1 className="text-3xl md:text-5xl font-serif text-slate-900 leading-tight">Shopping Bag</h1>
        <p className="text-slate-500 mt-2 text-sm">You have {cart?.items?.length || 0} item{cart?.items?.length !== 1 ? "s" : ""} in your bag.</p>
      </header>

      {cart?.items?.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Items */}
          <div className="lg:col-span-8 space-y-6">
            {cart.items.map((item: any) => {
              const itemPrice = (item.product?.selectedVariant && typeof item.product.selectedVariant.price === "number")
                ? item.product.selectedVariant.price
                : item.product.price;
              const size = item.product.selectedSize || item.product.selectedVariant?.size;
              const color = item.product.selectedColor || item.product.selectedVariant?.color;
              const variantText = [
                size ? `Size: ${size}` : null,
                color ? `Color: ${color}` : null
              ].filter(Boolean).join(" • ") || "Standard Edition";

              return (
                <div key={item.id} className="bg-white p-4 sm:p-6 shadow-sm border border-slate-50 flex flex-col sm:flex-row gap-6 rounded-lg transition-all hover:shadow-md">
                  <div className="w-full sm:w-32 h-64 sm:h-40 relative bg-slate-50 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={item.product.imageUrl || FALLBACK_IMAGE}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => { const t = e.currentTarget; if (t.src !== FALLBACK_IMAGE) t.src = FALLBACK_IMAGE; }}
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-between py-1 sm:py-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">{item.product.name}</h3>
                        <p className="text-[11px] font-medium text-emerald-700 bg-emerald-50 inline-block px-2.5 py-0.5 rounded mt-1.5">{variantText}</p>
                      </div>
                      <span className="text-lg font-bold sm:text-right">{formatPrice(itemPrice * item.quantity)}</span>
                    </div>
                  <div className="flex justify-between items-center sm:items-end mt-6 sm:mt-8">
                    <div className="flex items-center border border-slate-200 rounded-full p-1.5 sm:p-2 gap-3 sm:gap-4">
                      <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="hover:text-emerald-600 transition-colors p-1"><Minus size={14} /></button>
                      <span className="font-bold w-4 text-center text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="hover:text-emerald-600 transition-colors p-1"><Plus size={14} /></button>
                    </div>
                    <button onClick={() => removeItem(item.productId)} className="text-slate-400 hover:text-red-500 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors p-2">
                      <Trash2 size={14} /> <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>

          {/* Summary */}
          <div className="lg:col-span-4">
            <div className="bg-slate-50 p-8 rounded-xl sticky top-32 space-y-6">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Order Summary</h2>

              {/* Coupon */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Tag size={11} /> Promo Code
                </p>
                {coupon ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-bold text-sm text-emerald-800 tracking-widest">{coupon.code}</p>
                        <p className="text-[11px] text-emerald-600 mt-0.5">
                          {coupon.type === "PERCENTAGE" ? `${coupon.value}% off` : `${formatPrice(coupon.value)} off`}
                        </p>
                      </div>
                    </div>
                    <button onClick={removeCoupon} className="text-slate-400 hover:text-slate-700 transition-colors ml-2">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(null); }}
                      onKeyDown={e => e.key === "Enter" && applyCoupon()}
                      placeholder="PROMO CODE"
                      className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold tracking-widest uppercase focus:ring-1 focus:ring-slate-900 outline-none transition-all placeholder:text-slate-300"
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="px-4 py-2.5 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {couponLoading ? "…" : "Apply"}
                    </button>
                  </div>
                )}
                {couponError && (
                  <p className="text-[11px] text-red-500 font-medium flex items-center gap-1">
                    <X size={11} /> {couponError}
                  </p>
                )}
              </div>

              {/* Totals */}
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <div className="flex justify-between text-slate-600">
                  <span className="text-sm">Subtotal</span>
                  <span className="font-bold text-slate-900">{formatPrice(subtotal)}</span>
                </div>
                {coupon && discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span className="text-sm font-medium flex items-center gap-1"><Tag size={12} /> {coupon.code}</span>
                    <span className="font-bold">− {formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span className="text-sm">Shipping</span>
                  <span className="text-emerald-600 font-bold uppercase text-[10px] tracking-widest">Complimentary</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-slate-200">
                  <span className="text-lg font-bold text-slate-900">Total</span>
                  <span className="text-xl font-bold text-slate-900">{formatPrice(total)}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full bg-slate-900 text-white py-5 rounded-none font-bold uppercase tracking-widest text-xs flex items-center justify-center space-x-3 hover:bg-emerald-600 transition-all"
              >
                <span>Proceed to Checkout</span><ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-50 rounded-2xl space-y-6">
          <p className="text-slate-500 text-lg">Your bag is empty.</p>
          <Link href="/products" className="inline-block border-b-2 border-slate-900 pb-1 text-xs font-bold uppercase tracking-widest hover:text-emerald-600 hover:border-emerald-600">
            Discover the Collection
          </Link>
        </div>
      )}
    </div>
  );
}
