import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Lock, ChevronLeft, Tag, CheckCircle, X, CreditCard, ShieldCheck, Landmark, Smartphone } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { trackMetaEvent } from "@/components/MetaPixelTracker";
import AddressMapPicker, { AddressBreakdownData } from "@/components/AddressMapPicker";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=400&auto=format&fit=crop";

type Coupon = { code: string; type: string; value: number; discount: number; description: string };

export default function CheckoutPage() {
  const [location] = useLocation();
  const [cart, setCart]           = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [shippingAddress, setShippingAddress] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [processing, setProcessing]   = useState(false);
  const { formatPrice, currencyCode, exchangeRate } = useCurrency();

  const [couponCode, setCouponCode]   = useState("");
  const [coupon, setCoupon]           = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [activeProvider, setActiveProvider] = useState<{ id: string; name: string } | null>(null);
  const [activeProviders, setActiveProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");

  const subtotal = cart?.items?.reduce((acc: number, item: any) => {
    const itemPrice = (item.product?.selectedVariant && typeof item.product.selectedVariant.price === "number")
      ? item.product.selectedVariant.price
      : (item.product?.price || 0);
    return acc + (itemPrice * item.quantity);
  }, 0) || 0;
  const discount  = coupon?.discount ?? 0;
  const total     = Math.max(0, subtotal - discount);

  const validateCoupon = useCallback(async (code: string, amount: number): Promise<Coupon | null> => {
    if (!code.trim()) return null;
    const res = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim(), orderAmount: amount }),
    });
    const data = await res.json();
    if (!res.ok) return null;
    return { code: data.code, type: data.type, value: data.value, discount: data.discount, description: data.description ?? "" };
  }, []);

  useEffect(() => {
    fetch("/api/payments/checkout-config")
      .then(r => r.json())
      .then(d => {
        if (d?.activeProviders && Array.isArray(d.activeProviders) && d.activeProviders.length > 0) {
          setActiveProviders(d.activeProviders);
          setSelectedProvider(d.activeProviders[0].provider);
          setActiveProvider({ id: d.activeProviders[0].provider, name: d.activeProviders[0].name });
        } else if (d?.activeProvider) {
          const defaultProv = { provider: d.activeProvider, name: d.activeProviderName || d.activeProvider };
          setActiveProviders([defaultProv]);
          setSelectedProvider(d.activeProvider);
          setActiveProvider({ id: d.activeProvider, name: d.activeProviderName || d.activeProvider });
        }
      })
      .catch(() => {});

    fetch("/api/cart").then(r => r.json()).then(async d => {
      setCart(d);
      const cartSubtotal = d?.items?.reduce((acc: number, item: any) => acc + (item.product.price * item.quantity), 0) || 0;

      // Track InitiateCheckout
      if (d?.items?.length > 0) {
        trackMetaEvent("InitiateCheckout", {
          content_ids: d.items.map((i: any) => i.productId),
          content_type: "product",
          value: cartSubtotal,
          currency: "EUR",
          num_items: d.items.reduce((acc: number, i: any) => acc + i.quantity, 0)
        });
      }

      // Auto-apply coupon from URL (?coupon=CODE from cart page)
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get("coupon");
      if (urlCode) {
        setCouponCode(urlCode.toUpperCase());
        try {
          const result = await validateCoupon(urlCode, cartSubtotal);
          if (result) setCoupon(result);
          else setCouponError("The promo code could not be applied to this order.");
        } catch {
          // silently skip auto-apply failure
        }
      }
      setLoading(false);
    });
  }, [validateCoupon]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError(null);
    setCoupon(null);
    try {
      const result = await validateCoupon(couponCode, subtotal);
      if (!result) {
        // Re-fetch error message
        const res = await fetch("/api/coupons/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: couponCode.trim(), orderAmount: subtotal }),
        });
        const data = await res.json();
        setCouponError(data.error || "Invalid coupon code");
      } else {
        setCoupon(result);
      }
    } catch {
      setCouponError("Failed to apply coupon. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => { setCoupon(null); setCouponCode(""); setCouponError(null); };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingAddress) { alert("Please enter your shipping address"); return; }
    setProcessing(true);
    try {
      sessionStorage.setItem("checkout_shipping", shippingAddress);
      sessionStorage.setItem("checkout_email", customerEmail.trim());
      if (coupon) {
        sessionStorage.setItem("checkout_coupon", coupon.code);
        sessionStorage.setItem("checkout_discount", String(coupon.discount));
      } else {
        sessionStorage.removeItem("checkout_coupon");
        sessionStorage.removeItem("checkout_discount");
      }

      const initRes = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Guest",
          customerEmail: customerEmail.trim(),
          provider: selectedProvider,
          currency: currencyCode,
          exchangeRate: exchangeRate,
          couponCode: coupon?.code,
          shippingAddress,
          items: (cart?.items || []).map((i: any) => ({
            productId: i.product?.id || i.productId,
            quantity: i.quantity,
            price: i.product?.price || i.price || 0,
            name: i.product?.name || i.name || "Item",
          })),
          callbackUrl: `${window.location.origin}/checkout/verify`,
        }),
      });
      const data = await initRes.json();
      if (!initRes.ok) throw new Error(data?.error || "Payment provider is currently unavailable. Please try another provider or check back shortly.");
      const redirectUrl = data?.data?.authorization_url;
      if (redirectUrl) {
        window.location.assign(redirectUrl);
      } else {
        throw new Error("No payment authorization URL was returned.");
      }
    } catch (err: any) {
      console.error("Checkout error", err);
      alert(err.message || "Payment initialization failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto px-8 py-20 flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="w-7 h-7 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Secure checkout loading…</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">

        {/* Breadcrumb */}
        <div className="lg:col-span-12 mb-4">
          <Link href="/cart" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors w-fit">
            <ChevronLeft size={16} /> Return to Bag
          </Link>
          <h1 className="text-3xl md:text-4xl font-serif text-slate-900 mt-8">Secure Checkout</h1>
        </div>

        {/* Left: Form */}
        <div className="lg:col-span-7 space-y-10">
          <form onSubmit={handleCheckout} className="space-y-10">

            {/* Step 1 — Shipping */}
            <section className="space-y-5">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0">01</span>
                <h3 className="text-xl font-bold">Shipping Information</h3>
              </div>

              {/* Map & GPS Auto-Locate Integration */}
              <AddressMapPicker
                currentAddress={shippingAddress}
                onAddressSelect={(formatted) => {
                  setShippingAddress(formatted);
                }}
              />

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Full Shipping Address</label>
                <textarea
                  required
                  value={shippingAddress}
                  onChange={e => setShippingAddress(e.target.value)}
                  rows={3}
                  placeholder="Street, city, state, postcode, country…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-1 focus:ring-slate-900 transition-all outline-none resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Email for Order Updates</label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-1 focus:ring-slate-900 transition-all outline-none"
                />
              </div>
            </section>

            {/* Step 2 — Promo */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0">02</span>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  Promo Code <Tag size={14} className="text-slate-400" />
                </h3>
              </div>

              {coupon ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-sm text-emerald-800 tracking-widest">{coupon.code}</p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {coupon.type === "PERCENTAGE" ? `${coupon.value}% off` : `${formatPrice(coupon.value)} off`}
                        {" — "}saving {formatPrice(discount)}
                      </p>
                      {coupon.description && (
                        <p className="text-[11px] text-emerald-500 mt-0.5">{coupon.description}</p>
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={removeCoupon} className="text-slate-400 hover:text-slate-700 transition-colors ml-4">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(null); }}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), applyCoupon())}
                    placeholder="Enter promo code"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold tracking-widest uppercase focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    className="px-6 py-3 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {couponLoading ? "…" : "Apply"}
                  </button>
                </div>
              )}
              {couponError && (
                <p className="text-xs text-red-500 font-medium flex items-center gap-1.5">
                  <X size={12} /> {couponError}
                </p>
              )}
            </section>

            {/* Step 3 — Payment */}
            <section className="space-y-5">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0">03</span>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  Payment <Lock size={14} className="text-emerald-600" />
                </h3>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <p className="text-slate-600 text-sm">You will be redirected to our secure payment gateway to complete your purchase.</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Select Payment Method</label>
                  <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck size={12} /> 256-bit SSL Encrypted
                  </span>
                </div>
                
                {activeProviders.length > 1 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeProviders.map((prov) => {
                      const isSelected = selectedProvider === prov.provider;
                      const isStripe = prov.provider === "stripe";
                      const isPaystack = prov.provider === "paystack";
                      const isFlutterwave = prov.provider === "flutterwave";

                      return (
                        <div
                          key={prov.provider}
                          onClick={() => {
                            setSelectedProvider(prov.provider);
                            setActiveProvider({ id: prov.provider, name: prov.name });
                          }}
                          className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between min-h-[96px] relative overflow-hidden ${
                            isSelected 
                              ? "border-slate-900 bg-slate-900 text-white shadow-lg ring-2 ring-slate-900/10" 
                              : "border-slate-200 bg-white hover:border-slate-400 text-slate-800 hover:shadow-sm"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                isSelected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"
                              }`}>
                                {isStripe ? <CreditCard size={18} /> : isPaystack ? <Landmark size={18} /> : <Smartphone size={18} />}
                              </div>
                              <div>
                                <span className="text-xs font-bold uppercase tracking-wider block">
                                  {isStripe ? "Credit / Debit Card (Stripe)" : isPaystack ? "Paystack" : isFlutterwave ? "Flutterwave" : prov.name}
                                </span>
                                <span className={`text-[10px] font-medium block ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                                  {isStripe ? "Visa, Mastercard, Amex, Apple Pay" : isPaystack ? "Cards, Bank Transfer, Mobile Money" : "Global Cards, Mobile & Bank"}
                                </span>
                              </div>
                            </div>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                              isSelected ? "border-white bg-emerald-500" : "border-slate-300"
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/10">
                            <span className={`text-[9px] uppercase tracking-widest font-semibold ${isSelected ? "text-emerald-400" : "text-slate-400"}`}>
                              {isSelected ? "Selected Gateway" : "Click to select"}
                            </span>
                            <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${isSelected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"}`}>
                              Instant Redirect
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-slate-900 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center">
                        <CreditCard size={18} />
                      </div>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider block">
                          {activeProviders[0]?.name || activeProvider?.name || "Stripe / Multi-Gateway"}
                        </span>
                        <span className="text-[10px] text-slate-300 font-medium block">
                          Direct encrypted checkout
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Encrypted Gateway
                    </span>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={processing || !cart?.items?.length}
                className="w-full bg-slate-900 text-white py-5 rounded-none font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-50"
              >
                <Lock size={14} />
                {processing ? "Processing…" : `Secure Checkout — ${formatPrice(total)}`}
              </button>
            </section>
          </form>
        </div>

        {/* Right: Order Summary */}
        <div className="lg:col-span-5">
          <div className="bg-slate-50 p-8 rounded-xl sticky top-28 space-y-6">
            <h3 className="font-bold text-lg text-slate-900">Your Order</h3>

            <div className="space-y-4 divide-y divide-slate-200">
              {cart?.items?.map((item: any) => {
                const itemPrice = (item.product?.selectedVariant && typeof item.product.selectedVariant.price === "number")
                  ? item.product.selectedVariant.price
                  : (item.product?.price || 0);
                const size = item.product?.selectedSize || item.product?.selectedVariant?.size;
                const color = item.product?.selectedColor || item.product?.selectedVariant?.color;
                const variantText = [
                  size ? `Size: ${size}` : null,
                  color ? `Color: ${color}` : null
                ].filter(Boolean).join(" • ");

                return (
                  <div key={item.id} className="flex gap-4 pt-4 first:pt-0">
                    <div className="w-16 h-20 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={item.product.imageUrl || FALLBACK_IMAGE}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => { const t = e.currentTarget; if (t.src !== FALLBACK_IMAGE) t.src = FALLBACK_IMAGE; }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-slate-900">{item.product.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Qty: {item.quantity} {variantText && <span className="text-emerald-700 font-semibold ml-1">({variantText})</span>}
                      </p>
                      <p className="font-bold text-sm text-slate-900 mt-1">{formatPrice(itemPrice * item.quantity)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">Subtotal</span>
                <span className="font-bold">{formatPrice(subtotal)}</span>
              </div>
              {coupon && discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span className="text-sm font-medium flex items-center gap-1">
                    <Tag size={12} /> {coupon.code}
                  </span>
                  <span className="font-bold">− {formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">Shipping</span>
                <span className="text-emerald-600 font-bold text-xs uppercase tracking-widest">Complimentary</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-slate-200">
                <span className="font-bold text-lg">Total</span>
                <span className="font-bold text-lg">{formatPrice(total)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
