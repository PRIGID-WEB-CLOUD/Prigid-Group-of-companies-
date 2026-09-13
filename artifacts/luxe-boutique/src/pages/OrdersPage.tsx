import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle } from "lucide-react";
import AccountSidebar from "@/components/AccountSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=400&auto=format&fit=crop";

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const isCustomer = Boolean(user) && (!user?.role || ["CUSTOMER", "ADMIN", "SUPER_ADMIN"].includes(user.role.toUpperCase()));
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
    else if (!authLoading && user && !isCustomer) navigate("/");
    else if (user) fetch("/api/orders").then(r => r.json()).then(d => { setOrders(Array.isArray(d) ? d : []); setLoading(false); });
  }, [user, authLoading, navigate, isCustomer]);

  if (authLoading || loading || (user && !isCustomer)) return <div className="max-w-7xl mx-auto px-8 py-20 text-center uppercase tracking-widest font-bold font-serif">Retrieving History...</div>;

  return (
    <div className="bg-slate-50 min-h-screen py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-12"><h1 className="text-4xl font-serif text-slate-900">Order History</h1></header>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          <AccountSidebar />
          <div className="lg:col-span-3">
            {orders.length > 0 ? (
              <div className="space-y-8">
                {orders.map((order: any) => (
                  <div key={order.id} className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
                    <div className="bg-slate-50 p-6 flex flex-wrap justify-between items-center gap-4">
                      <div className="flex gap-8">
                        <div><p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Order Reference</p><p className="font-bold text-sm">#{order.id.slice(-8).toUpperCase()}</p></div>
                        <div><p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Placed On</p><p className="font-bold text-sm">{new Date(order.createdAt).toLocaleDateString()}</p></div>
                        <div><p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Total</p><p className="font-bold text-sm">{formatPrice(order.total)}</p></div>
                      </div>
                      <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest">
                        <CheckCircle size={14} />{order.status}
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {order.items?.map((item: any) => (
                          <div key={item.id} className="flex gap-4">
                            <div className="w-16 h-20 bg-slate-100 rounded overflow-hidden flex-shrink-0">
                              <img src={item.product?.imageUrl || FALLBACK_IMAGE} alt={item.product?.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { const target = e.currentTarget; if (target.src !== FALLBACK_IMAGE) target.src = FALLBACK_IMAGE; }} />
                            </div>
                            <div><p className="text-sm font-bold">{item.product?.name}</p><p className="text-xs text-slate-400 mt-1">Qty: {item.quantity}</p></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-2xl"><p className="text-slate-500 italic">No orders yet. Start exploring the collection.</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
