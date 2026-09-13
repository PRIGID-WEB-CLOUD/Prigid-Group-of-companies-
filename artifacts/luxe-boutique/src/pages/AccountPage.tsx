import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "motion/react";
import { Package, User, ShoppingBag } from "lucide-react";
import AccountSidebar from "@/components/AccountSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function AccountPage() {
  const { user, loading: authLoading } = useAuth();
  const isCustomer = Boolean(user) && (!user?.role || ["CUSTOMER", "ADMIN", "SUPER_ADMIN"].includes(user.role.toUpperCase()));
  const [, navigate] = useLocation();
  const [orders, setOrders] = useState<any[]>([]);
  const [wishlistCount, setWishlistCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
    else if (!authLoading && user && !isCustomer) navigate("/");
    else if (user) {
      Promise.all([
        fetch("/api/orders").then(r => r.json()),
        fetch("/api/wishlist").then(r => r.json()),
      ]).then(([ordersData, wishlistData]) => {
        setOrders(Array.isArray(ordersData) ? ordersData.slice(0, 3) : []);
        setWishlistCount(Array.isArray(wishlistData) ? wishlistData.length : 0);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [user, authLoading, isCustomer]);

  if (authLoading || loading || (user && !isCustomer)) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-900"></div></div>;

  return (
    <div className="bg-slate-50 min-h-screen py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-12">
          <h1 className="text-4xl font-serif text-slate-900">Account Dashboard</h1>
          <p className="text-slate-500 mt-2 font-medium">Welcome back, {user?.name || "Member"}.</p>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          <AccountSidebar />
          <div className="lg:col-span-3 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: "Total Orders",    value: orders.length,                                           icon: Package,    color: "bg-blue-50 text-blue-600"    },
                { label: "Active Wishlist", value: wishlistCount !== null ? wishlistCount : "—",            icon: ShoppingBag, color: "bg-emerald-50 text-emerald-600" },
                { label: "Account Status", value: "Verified",                                              icon: User,       color: "bg-purple-50 text-purple-600" },
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-6">
                  <div className={`h-14 w-14 ${stat.color} rounded-2xl flex items-center justify-center`}><stat.icon size={24} /></div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            {orders.length > 0 && (
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <h2 className="text-xl font-serif text-slate-900 mb-6">Recent Orders</h2>
                <div className="space-y-4">
                  {orders.map((order: any) => (
                    <div key={order.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                      <div>
                        <p className="font-bold text-sm">#{order.id.slice(-8).toUpperCase()}</p>
                        <p className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className="text-sm font-bold">{formatPrice(order.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
