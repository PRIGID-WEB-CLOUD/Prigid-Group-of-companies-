import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "motion/react";
import { X, ShoppingBag } from "lucide-react";
import AccountSidebar from "@/components/AccountSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/contexts/CartContext";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=800&auto=format&fit=crop";

export default function WishlistPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const isCustomer = Boolean(user) && (!user?.role || ["CUSTOMER", "ADMIN", "SUPER_ADMIN"].includes(user.role.toUpperCase()));
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const { formatPrice } = useCurrency();
  const { refreshCart } = useCart();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
    else if (!authLoading && user && !isCustomer) navigate("/");
    else if (user) { fetch("/api/wishlist").then(r => r.json()).then(d => { setWishlist(Array.isArray(d) ? d : []); setLoading(false); }); }
  }, [user, authLoading, navigate, isCustomer]);

  const removeItem = async (productId: string) => {
    await fetch(`/api/wishlist/${productId}`, { method: "DELETE" });
    setWishlist(prev => prev.filter((item: any) => item.productId !== productId));
  };

  const addToCart = async (productId: string) => {
    setAddingToCart(productId);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      if (res.ok) {
        await refreshCart();
        navigate("/cart");
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to add item to cart.");
      }
    } catch {
      alert("Failed to add item to cart. Please check your connection.");
    } finally {
      setAddingToCart(null);
    }
  };

  if (authLoading || loading || (user && !isCustomer)) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-900"></div></div>;

  return (
    <div className="bg-slate-50 min-h-screen py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-12"><h1 className="text-4xl font-serif text-slate-900">My Wishlist</h1></header>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          <AccountSidebar />
          <div className="lg:col-span-3">
            {wishlist.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                {wishlist.map((item: any) => (
                  <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group relative bg-white rounded-2xl overflow-hidden shadow-sm">
                    <button onClick={() => removeItem(item.productId)} className="absolute top-3 right-3 z-10 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm hover:bg-red-50 hover:text-red-500 transition-all">
                      <X size={14} />
                    </button>
                    <Link href={`/products/${item.productId}`} className="block">
                      <div className="aspect-[3/4] relative">
                        <img src={item.product?.imageUrl || FALLBACK_IMAGE} alt={item.product?.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" referrerPolicy="no-referrer" onError={(e) => { const target = e.currentTarget; if (target.src !== FALLBACK_IMAGE) target.src = FALLBACK_IMAGE; }} />
                      </div>
                      <div className="p-4">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">{item.product?.category?.name}</p>
                        <p className="font-bold text-sm mt-1 text-slate-900 truncate">{item.product?.name}</p>
                        <p className="font-bold text-sm text-slate-900 mt-1">{formatPrice(item.product?.price)}</p>
                      </div>
                    </Link>
                    <div className="px-4 pb-4">
                      <button
                        onClick={() => addToCart(item.productId)}
                        disabled={addingToCart === item.productId}
                        className="w-full py-3 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-50"
                      >
                        <ShoppingBag size={14} />
                        {addingToCart === item.productId ? "Adding…" : "Add to Bag"}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-2xl space-y-4">
                <p className="text-slate-500 italic">Your wishlist is empty.</p>
                <Link href="/products" className="inline-block text-xs font-bold uppercase tracking-widest border-b border-slate-900 pb-1">Discover the Collection</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
