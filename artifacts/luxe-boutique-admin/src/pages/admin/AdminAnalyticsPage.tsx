import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MdRefresh, MdShoppingBag, MdInventory2, MdImage, MdBarChart } from "react-icons/md";
import AdminLayout from "./AdminLayout";

type Order = { id: string; total: number; status: string; createdAt: string; items: { product: { name: string } | null }[] };
type Product = { id: string; name: string; price: number; imageUrl: string | null; category: { name: string } | null };

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function AdminAnalyticsPage() {
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const isLoading = ordersLoading || productsLoading;

  const activeOrdersCount = orders.filter((o) => ["PENDING", "PROCESSING", "SHIPPED"].includes(o.status)).length;
  const terminalOrdersCount = orders.filter((o) => ["DELIVERED", "REFUNDED", "CANCELLED"].includes(o.status)).length;

  const totalRevenue   = orders.reduce((s, o) => s + o.total, 0);
  const delivered      = orders.filter((o) => o.status === "DELIVERED");
  const avgOrderValue  = orders.length > 0 ? totalRevenue / orders.length : 0;
  const topProducts    = products.slice(0, 3);

  const statusCounts: Record<string, number> = {};
  for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;

  return (
    <AdminLayout sidebar="main">
      <main className="flex-1 p-4 sm:p-6 lg:p-10 2xl:p-12 bg-[#f8f9ff]">
        <div className="mb-8 sm:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] sm:text-5xl font-serif font-bold leading-tight text-[#0b1c30]">Market Performance</h1>
            <p className="font-[Manrope] text-sm sm:text-lg text-[#45464d] max-w-2xl">A sophisticated overview of your boutique's financial health and lifecycle metrics.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-32 text-[#7c839b] font-[Manrope]">
            <MdRefresh className="animate-spin text-3xl mr-3 text-[#006c49]" />
            Loading analytics…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
              {[
                { label: "Total Revenue",    value: orders.length > 0 ? fmt(totalRevenue)      : "—", sub: `${orders.length} total orders`,           border: "border-l-4 border-emerald-600" },
                { label: "Active Orders",    value: String(activeOrdersCount),                      sub: "Pending, Processing, Shipped",          border: "border-l-4 border-blue-600" },
                { label: "Terminal Orders",  value: String(terminalOrdersCount),                    sub: "Delivered, Refunded, Canceled",         border: "border-l-4 border-slate-600" },
                { label: "Avg. Order Value", value: orders.length > 0 ? `$${avgOrderValue.toFixed(2)}` : "—", sub: "per transaction",                  border: "border-l-4 border-black" },
              ].map((m) => (
                <div key={m.label} className={`bg-white p-5 sm:p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] rounded-r-xl ${m.border}`}>
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-[Manrope] font-bold text-[10px] sm:text-xs tracking-widest uppercase text-[#45464d]">{m.label}</span>
                  </div>
                  <div className="text-[24px] sm:text-[28px] font-serif font-semibold text-[#0b1c30] mb-1">{m.value}</div>
                  <p className="text-[10px] sm:text-[11px] text-[#7c839b] font-[Manrope]">{m.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 sm:mb-12">
              {/* Order Status Breakdown */}
              <div className="bg-white p-5 sm:p-8 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
                  <h3 className="text-[20px] sm:text-[24px] font-serif font-semibold text-[#0b1c30]">Order Lifecycle Breakdown</h3>
                  <span className="self-start text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2.5 py-1 rounded">Active vs Terminal</span>
                </div>
                {orders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-[#7c839b] font-[Manrope]">
                    <MdShoppingBag className="text-4xl mb-3 text-slate-200" />
                    No orders yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(["PENDING","PROCESSING","SHIPPED","DELIVERED","REFUNDED","CANCELLED"] as const).map((status) => {
                      const count = statusCounts[status] ?? 0;
                      const pct = orders.length > 0 ? Math.round((count / orders.length) * 100) : 0;
                      const isTerminal = ["DELIVERED", "REFUNDED", "CANCELLED"].includes(status);
                      const colors: Record<string, string> = {
                        PENDING: "bg-amber-400", PROCESSING: "bg-blue-400", SHIPPED: "bg-purple-400",
                        DELIVERED: "bg-[#006c49]", REFUNDED: "bg-slate-500", CANCELLED: "bg-red-400",
                      };
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <div className="w-36 flex items-center gap-1.5 shrink-0">
                            <span className="font-[Manrope] text-xs text-[#45464d] uppercase font-bold">{status}</span>
                            <span className={`text-[8px] font-bold uppercase tracking-wider px-1 py-0.2 rounded ${isTerminal ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-600"}`}>
                              {isTerminal ? "Terminal" : "Active"}
                            </span>
                          </div>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${colors[status]} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }}></div>
                          </div>
                          <span className="font-[Manrope] font-bold text-xs w-20 text-right">{count} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Products */}
              <div className="bg-white p-8 shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[24px] font-serif font-semibold text-[#0b1c30]">Catalog Highlights</h3>
                  <Link href="/catalog">
                    <span className="text-xs font-[Manrope] font-bold tracking-widest text-[#006c49] hover:underline cursor-pointer">View All</span>
                  </Link>
                </div>
                {products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-[#7c839b] font-[Manrope]">
                    <MdInventory2 className="text-4xl mb-3 text-slate-200" />
                    No products in catalog.
                    <Link href="/products/new">
                      <button className="mt-4 px-4 py-2 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors">
                        Add First Product
                      </button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {topProducts.map((p) => (
                      <div key={p.id} className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-100 flex-shrink-0 rounded-sm overflow-hidden">
                          {p.imageUrl
                            ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-slate-300"><MdImage /></div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#0b1c30] truncate">{p.name}</p>
                          <p className="text-[10px] text-[#7c839b] font-[Manrope] mt-0.5">{p.category?.name ?? "Uncategorised"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold font-serif">${p.price.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                    {products.length > 3 && (
                      <p className="text-[11px] text-[#7c839b] font-[Manrope] text-center pt-2">+{products.length - 3} more in catalog</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {orders.length === 0 && products.length === 0 && (
              <div className="bg-white p-12 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] text-center">
                <MdBarChart className="text-5xl text-slate-200 mx-auto mb-4 block" />
                <h3 className="font-serif text-[20px] font-semibold text-[#0b1c30] mb-2">No data yet</h3>
                <p className="font-[Manrope] text-[#7c839b] mb-6">Add products and receive orders to see performance analytics here.</p>
                <div className="flex justify-center gap-4">
                  <Link href="/products/new">
                    <button className="px-6 py-2.5 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors">
                      Add Products
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </AdminLayout>
  );
}
