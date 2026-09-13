import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  MdPendingActions, 
  MdAdd,
  MdTrendingUp,
  MdShoppingCart,
  MdInventory,
  MdGroup,
  MdAttachMoney,
  MdBarChart,
  MdCategory,
  MdWarning
} from "react-icons/md";
import AdminLayout from "./AdminLayout";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ──────────────────────────────────────────────────────────────────────

type OrderItem = { name: string; qty: number; price: number };
type Order = { id: string; total: number; status: string; createdAt: string; items: OrderItem[] };

type Stats = {
  role: "ADMIN" | "SUPER_ADMIN";
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  pendingOrders: number;
  recentOrders: Order[];
  statusBreakdown: Record<string, number>;
  productCount: number;
  lowStockProducts: { id: string; name: string; stock: number }[];
  // Super-admin extras
  revenueByMonth?: Record<string, number>;
  totalUsers?: number;
  adminCount?: number;
  topProducts?: { name: string; revenue: number; units: number }[];
  categoryCount?: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const statusStyle: Record<string, string> = {
  PENDING:    "bg-amber-50 text-amber-700 border-amber-200",
  PROCESSING: "bg-blue-50 text-blue-700 border-blue-200",
  SHIPPED:    "bg-purple-50 text-purple-700 border-purple-200",
  DELIVERED:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED:  "bg-red-50 text-red-700 border-red-200",
  REFUNDED:   "bg-slate-100 text-slate-700 border-slate-200",
};

const TERMINAL_STATUSES = ["DELIVERED", "REFUNDED", "CANCELLED"];

function fmt(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, accent = false, sub, icon }: { label: string; value: string; accent?: boolean; sub?: string; icon?: any }) {
  return (
    <div className={`bg-white p-4 sm:p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] rounded-sm relative overflow-hidden ${accent ? "border-l-4 border-emerald-600" : ""}`}>
      <div className="relative z-10">
        <span className="text-[10px] sm:text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#7c839b] block mb-2 sm:mb-3">{label}</span>
        <h3 className="text-[20px] sm:text-[24px] font-serif font-semibold">{value}</h3>
        {sub && <p className="text-[10px] sm:text-[11px] text-[#7c839b] mt-1">{sub}</p>}
      </div>
      {icon && (
        <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] text-8xl pointer-events-none">
          {icon}
        </div>
      )}
    </div>
  );
}

function RecentOrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) return <div className="p-16 text-center text-[#7c839b] font-[Manrope]">No orders yet.</div>;
  return (
    <table className="w-full text-left min-w-[600px]">
      <thead>
        <tr className="bg-slate-50/50">
          {["Order ID", "Status", "Items", "Total", "Date"].map((h) => (
            <th key={h} className="px-4 sm:px-8 py-4 text-[10px] font-[Manrope] font-bold uppercase text-[#7c839b] tracking-widest">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {orders.map((o) => (
          <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
            <td className="px-4 sm:px-8 py-5 text-xs font-bold">#{o.id.slice(0, 8).toUpperCase()}</td>
            <td className="px-4 sm:px-8 py-5">
              <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${statusStyle[o.status] ?? "bg-slate-100 text-slate-600"}`}>{o.status}</span>
            </td>
            <td className="px-4 sm:px-8 py-5 text-xs text-[#7c839b]">
              {o.items.length} item{o.items.length !== 1 ? "s" : ""}
              {o.items.length > 0 && <div className="text-[10px] mt-0.5 line-clamp-1">{o.items.slice(0, 2).map((i) => i.name).join(", ")}</div>}
            </td>
            <td className="px-4 sm:px-8 py-5 text-xs font-bold">{fmt(o.total)}</td>
            <td className="px-4 sm:px-8 py-5 text-xs text-[#7c839b]">{fmtDate(o.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Revenue chart (sparkline bars) ─────────────────────────────────────────────

function RevenueChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="bg-white shadow-[0px_4px_20px_rgba(15,23,42,0.05)] rounded-sm p-4 sm:p-8 overflow-hidden">
      <span className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#7c839b] block mb-6">Revenue — Last 6 Months</span>
      <div className="flex items-end gap-2 sm:gap-3 h-28 overflow-x-auto pb-2 scrollbar-hide">
        {entries.map(([month, value]) => (
          <div key={month} className="flex-1 min-w-[40px] flex flex-col items-center gap-2">
            <span className="text-[9px] sm:text-[10px] text-emerald-700 font-bold">{value > 0 ? `$${(value / 1000).toFixed(1)}k` : ""}</span>
            <div
              className="w-full bg-emerald-500 rounded-t-sm transition-all"
              style={{ height: `${Math.max((value / max) * 80, value > 0 ? 4 : 0)}px` }}
            />
            <span className="text-[8px] sm:text-[9px] font-[Manrope] text-[#7c839b] tracking-wider whitespace-nowrap">{month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top products table ─────────────────────────────────────────────────────────

function TopProductsPanel({ products }: { products: { name: string; revenue: number; units: number }[] }) {
  return (
    <div className="bg-white shadow-[0px_4px_20px_rgba(15,23,42,0.05)] rounded-sm overflow-hidden">
      <div className="px-4 sm:px-8 py-6 border-b border-slate-100">
        <h3 className="text-[18px] sm:text-[20px] font-serif font-semibold">Top Products by Revenue</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[400px]">
          <thead>
            <tr className="bg-slate-50/50">
              {["Product", "Units Sold", "Revenue"].map((h) => (
                <th key={h} className="px-4 sm:px-8 py-3 text-[10px] font-[Manrope] font-bold uppercase text-[#7c839b] tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {products.length === 0 ? (
              <tr><td colSpan={3} className="px-4 sm:px-8 py-8 text-center text-[#7c839b] text-sm">No sales data yet.</td></tr>
            ) : products.map((p, i) => (
              <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                <td className="px-4 sm:px-8 py-4 text-xs font-semibold">{p.name}</td>
                <td className="px-4 sm:px-8 py-4 text-xs text-[#7c839b]">{p.units}</td>
                <td className="px-4 sm:px-8 py-4 text-xs font-bold text-emerald-700">{fmt(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Super-admin overview panel ─────────────────────────────────────────────────

function SuperAdminPanel({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-6 sm:y-8">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard label="Total Revenue"    value={fmt(stats.totalRevenue)}   accent icon={<MdAttachMoney />} />
        <MetricCard label="Total Orders"     value={stats.totalOrders.toString()} icon={<MdShoppingCart />} />
        <MetricCard label="Avg. Order Value" value={fmt(stats.avgOrderValue)} icon={<MdTrendingUp />} />
        <MetricCard label="Products Listed"  value={stats.productCount.toString()} icon={<MdInventory />} />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard label="Registered Customers" value={(stats.totalUsers ?? 0).toString()} icon={<MdGroup />} />
        <MetricCard label="Admin Users"          value={(stats.adminCount ?? 0).toString()} icon={<MdGroup />} />
        <MetricCard label="Categories"           value={(stats.categoryCount ?? 0).toString()} icon={<MdCategory />} />
        <MetricCard label="Low-Stock Items"      value={stats.lowStockProducts.length.toString()} sub={stats.lowStockProducts.length > 0 ? stats.lowStockProducts.slice(0, 2).map(p => p.name).join(", ") : undefined} icon={<MdWarning />} />
      </section>

      {stats.revenueByMonth && <RevenueChart data={stats.revenueByMonth} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {stats.topProducts && <TopProductsPanel products={stats.topProducts} />}

        <div className="bg-white shadow-[0px_4px_20px_rgba(15,23,42,0.05)] rounded-sm overflow-hidden">
          <div className="px-4 sm:px-8 py-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-[18px] sm:text-[20px] font-serif font-semibold">Order Status Breakdown</h3>
          </div>
          <div className="p-4 sm:p-8 space-y-3">
            {Object.entries(stats.statusBreakdown).length === 0 ? (
              <p className="text-sm text-[#7c839b]">No orders yet.</p>
            ) : Object.entries(stats.statusBreakdown).map(([status, count]) => {
              const isTerminal = TERMINAL_STATUSES.includes(status);
              return (
                <div key={status} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${statusStyle[status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>{status}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${isTerminal ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-blue-50 text-blue-600 border-blue-100"}`}>
                      {isTerminal ? "Terminal" : "Active"}
                    </span>
                  </div>
                  <span className="text-sm font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white shadow-[0px_4px_20px_rgba(15,23,42,0.05)] rounded-sm overflow-hidden">
        <div className="px-4 sm:px-8 py-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-[18px] sm:text-[20px] font-serif font-semibold">Recent Transactions</h3>
          <Link href="/orders">
            <button className="text-xs font-[Manrope] font-bold tracking-widest uppercase text-emerald-600 hover:underline">View All</button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <RecentOrdersTable orders={stats.recentOrders} />
        </div>
      </div>
    </div>
  );
}

// ── Regular-admin panel ────────────────────────────────────────────────────────

function AdminPanel({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard label="Total Orders"     value={stats.totalOrders.toString()} accent icon={<MdShoppingCart />} />
        <MetricCard label="Pending"          value={stats.pendingOrders.toString()} icon={<MdPendingActions />} />
        <MetricCard label="Products Listed"  value={stats.productCount.toString()} icon={<MdInventory />} />
        <MetricCard label="Low-Stock Items"  value={stats.lowStockProducts.length.toString()} icon={<MdWarning />} />
      </section>

      {stats.pendingOrders > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-sm px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 shadow-sm">
          <div className="flex items-center gap-3">
            <MdPendingActions className="text-amber-600 text-xl" />
            <span className="font-[Manrope] font-bold text-sm text-amber-800">
              {stats.pendingOrders} order{stats.pendingOrders !== 1 ? "s" : ""} awaiting action
            </span>
          </div>
          <Link href="/orders">
            <button className="text-xs font-[Manrope] font-bold tracking-widest uppercase text-amber-700 hover:underline">Review →</button>
          </Link>
        </div>
      )}

      {stats.lowStockProducts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-sm px-4 sm:px-6 py-4">
          <span className="font-[Manrope] font-bold text-sm text-red-800 block mb-2">Low-stock alert</span>
          <div className="flex flex-wrap gap-2">
            {stats.lowStockProducts.map((p) => (
              <span key={p.id} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-semibold">{p.name} ({p.stock} left)</span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white shadow-[0px_4px_20px_rgba(15,23,42,0.05)] rounded-sm overflow-hidden">
          <div className="px-4 sm:px-8 py-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-[18px] sm:text-[20px] font-serif font-semibold">Order Status</h3>
          </div>
          <div className="p-4 sm:p-8 space-y-3">
            {Object.entries(stats.statusBreakdown).map(([status, count]) => {
              const isTerminal = TERMINAL_STATUSES.includes(status);
              return (
                <div key={status} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${statusStyle[status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>{status}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${isTerminal ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-blue-50 text-blue-600 border-blue-100"}`}>
                      {isTerminal ? "Terminal" : "Active"}
                    </span>
                  </div>
                  <span className="text-sm font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white shadow-[0px_4px_20px_rgba(15,23,42,0.05)] rounded-sm p-4 sm:p-8">
          <span className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#7c839b] block mb-6">Quick Actions</span>
          <div className="space-y-3">
            <Link href="/products/new">
              <button className="w-full px-4 py-3 bg-black text-white text-xs font-[Manrope] font-bold tracking-widest uppercase hover:bg-emerald-800 transition-colors text-left">+ Add Product</button>
            </Link>
            <Link href="/orders">
              <button className="w-full px-4 py-3 border border-slate-200 text-xs font-[Manrope] font-bold tracking-widest uppercase hover:bg-slate-50 transition-colors text-left">View Orders Queue</button>
            </Link>
            <Link href="/catalog">
              <button className="w-full px-4 py-3 border border-slate-200 text-xs font-[Manrope] font-bold tracking-widest uppercase hover:bg-slate-50 transition-colors text-left">Manage Catalog</button>
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-[0px_4px_20px_rgba(15,23,42,0.05)] rounded-sm overflow-hidden">
        <div className="px-4 sm:px-8 py-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-[18px] sm:text-[20px] font-serif font-semibold">Recent Orders</h3>
          <Link href="/orders">
            <button className="text-xs font-[Manrope] font-bold tracking-widest uppercase text-emerald-600 hover:underline">View All</button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <RecentOrdersTable orders={stats.recentOrders} />
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
    staleTime: 30_000,
  });

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const title        = isSuperAdmin ? "Executive Overview" : "Operations Dashboard";
  const badge        = isSuperAdmin ? "Super Admin" : "Admin";
  const badgeColor   = isSuperAdmin ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700";

  return (
    <AdminLayout sidebar="main">
      <div className="p-4 sm:p-10 2xl:p-16 bg-slate-50/30 min-h-screen">
        <section className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[12px] font-[Manrope] font-bold tracking-widest uppercase text-[#7c839b]">Daily Summary</span>
              <span className={`px-2 py-0.5 text-[10px] font-[Manrope] font-bold uppercase tracking-wider rounded-full ${badgeColor}`}>{badge}</span>
            </div>
            <h2 className="text-2xl sm:text-[36px] font-serif font-bold leading-tight">{title}</h2>
          </div>
          <Link href="/products/new">
            <button className="px-6 py-2.5 bg-black text-white text-xs font-[Manrope] font-bold tracking-widest uppercase hover:bg-[#006c49] transition-colors w-full sm:w-auto">
              Add Inventory
            </button>
          </Link>
        </section>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-[#7c839b] font-[Manrope] text-sm">Loading dashboard…</div>
          </div>
        ) : !stats ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-red-500 font-[Manrope] text-sm">Failed to load stats. Please refresh.</div>
          </div>
        ) : isSuperAdmin ? (
          <SuperAdminPanel stats={stats} />
        ) : (
          <AdminPanel stats={stats} />
        )}
      </div>

      <Link href="/products/new">
        <button className="fixed bottom-10 right-10 w-14 h-14 bg-black text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-50 hover:bg-[#006c49]">
          <MdAdd className="text-2xl" />
        </button>
      </Link>
    </AdminLayout>
  );
}
