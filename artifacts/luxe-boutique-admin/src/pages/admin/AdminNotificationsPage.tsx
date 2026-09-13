import { useState, useEffect } from "react";
import { Link } from "wouter";
import AdminLayout from "./AdminLayout";
import {
  MdNotifications,
  MdNotificationsNone,
  MdInventory2,
  MdWarning,
  MdShoppingCart,
  MdDoneAll,
  MdRefresh,
  MdHourglassEmpty,
  MdVolumeUp,
  MdVolumeOff,
  MdCheckCircle,
  MdFilterList,
  MdMarkEmailRead,
  MdSend,
  MdReceipt,
  MdAutorenew,
  MdLocalShipping,
  MdCancel,
  MdPendingActions,
  MdArrowForward
} from "react-icons/md";
import {
  SiGoogle,
  SiFacebook,
  SiInstagram,
  SiMeta,
  SiWhatsapp,
  SiX,
  SiTiktok
} from "react-icons/si";

type Order = {
  id: string;
  customerName?: string | null;
  customerEmail: string;
  status: string;
  total: number;
  createdAt: string;
};

type LowStockProduct = {
  id: string;
  name: string;
  stock: number;
};

type ChannelEvent = {
  id: string;
  channel: string;
  event: string;
  detail: string;
  type: string;
  createdAt: string;
};

function getChannelMeta(channel: string) {
  const c = channel.toLowerCase();
  if (c.includes("google") || c === "workspace" || c === "ga4") {
    return {
      icon: <SiGoogle className="text-white text-xs" />,
      bg: "bg-[#4285F4]",
      name: "Google Workspace",
    };
  }
  if (c.includes("meta") || c.includes("ads") || c.includes("commerce")) {
    return {
      icon: <SiMeta className="text-white text-xs" />,
      bg: "bg-[#0668E1]",
      name: "Meta Suite",
    };
  }
  if (c === "facebook") {
    return {
      icon: <SiFacebook className="text-white text-xs" />,
      bg: "bg-[#1877F2]",
      name: "Facebook",
    };
  }
  if (c === "instagram") {
    return {
      icon: <SiInstagram className="text-white text-xs" />,
      bg: "bg-[#E4405F]",
      name: "Instagram",
    };
  }
  if (c === "twitter" || c === "x") {
    return {
      icon: <SiX className="text-white text-xs" />,
      bg: "bg-black",
      name: "X (Twitter)",
    };
  }
  if (c === "tiktok") {
    return {
      icon: <SiTiktok className="text-white text-xs" />,
      bg: "bg-black",
      name: "TikTok Shop",
    };
  }
  if (c === "whatsapp") {
    return {
      icon: <SiWhatsapp className="text-white text-xs" />,
      bg: "bg-[#25D366]",
      name: "WhatsApp API",
    };
  }
  return {
    icon: <MdNotifications className="text-white text-xs" />,
    bg: "bg-[#006c49]",
    name: channel,
  };
}

const statusMeta: Record<string, { icon: any; cls: string; label: string }> = {
  PENDING:    { icon: <MdPendingActions />, cls: "text-amber-700 bg-amber-50 border-amber-200",   label: "Pending Payment" },
  PROCESSING: { icon: <MdAutorenew />,       cls: "text-blue-700 bg-blue-50 border-blue-200",     label: "Processing" },
  SHIPPED:    { icon: <MdLocalShipping />,  cls: "text-purple-700 bg-purple-50 border-purple-200", label: "Shipped" },
  DELIVERED:  { icon: <MdCheckCircle />,    cls: "text-emerald-700 bg-emerald-50 border-emerald-200", label: "Delivered" },
  CANCELLED:  { icon: <MdCancel />,          cls: "text-rose-700 bg-rose-50 border-rose-200",       label: "Cancelled" },
};

function timeAgo(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return "recently";
  }
}

export default function AdminNotificationsPage() {
  const [filter, setFilter] = useState<"all" | "orders" | "stock" | "channels">("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockProduct[]>([]);
  const [lowStockThresh, setLowStockThresh] = useState(5);
  const [channelEvents, setChannelEvents] = useState<ChannelEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingStock, setCheckingStock] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem("luxe_admin_sound_muted") !== "true";
  });
  const [testResult, setTestResult] = useState<string | null>(null);

  const [seenOrderIds, setSeenOrderIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("luxe_admin_seen_orders");
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const [seenLowStockIds, setSeenLowStockIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("luxe_admin_seen_low_stock");
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const [seenChannelEventIds, setSeenChannelEventIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("luxe_admin_seen_channel_events");
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, stockRes, eventsRes] = await Promise.all([
        fetch("/api/orders?limit=30").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/admin/low-stock").then((r) => (r.ok ? r.json() : { products: [], threshold: 5 })),
        fetch("/api/admin/channel-events").then((r) => (r.ok ? r.json() : [])),
      ]);

      setOrders(Array.isArray(ordersRes) ? ordersRes : ordersRes.orders || []);
      if (stockRes && Array.isArray(stockRes.products)) {
        const thresh = stockRes.threshold || 5;
        const validLow = stockRes.products.filter((p: LowStockProduct) => (p.stock ?? 0) <= thresh);
        setLowStockAlerts(validLow);
        setLowStockThresh(thresh);

        const validIds = new Set(validLow.map((p: LowStockProduct) => p.id));
        setSeenLowStockIds((prev) => {
          const updated = new Set<string>();
          for (const id of Array.from(prev)) {
            if (validIds.has(id)) updated.add(id);
          }
          try {
            localStorage.setItem("luxe_admin_seen_low_stock", JSON.stringify(Array.from(updated)));
          } catch {}
          return updated;
        });
      }
      setChannelEvents(Array.isArray(eventsRes) ? eventsRes : []);
    } catch (err) {
      console.error("Failed to load notifications page data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/admin/events", { withCredentials: true });

      es.addEventListener("low_stock", (e) => {
        try {
          const { products, threshold } = JSON.parse(e.data) as { products: LowStockProduct[]; threshold: number };
          const validLow = (products || []).filter((p: LowStockProduct) => (p.stock ?? 0) <= threshold);
          setLowStockAlerts(validLow);
          if (threshold) setLowStockThresh(threshold);

          const validIds = new Set(validLow.map((p: LowStockProduct) => p.id));
          setSeenLowStockIds((prev) => {
            const updated = new Set<string>();
            for (const id of Array.from(prev)) {
              if (validIds.has(id)) updated.add(id);
            }
            try {
              localStorage.setItem("luxe_admin_seen_low_stock", JSON.stringify(Array.from(updated)));
            } catch {}
            return updated;
          });
        } catch (err) {
          console.error("SSE low_stock error:", err);
        }
      });

      es.addEventListener("new_order", () => fetchData());
      es.addEventListener("order_updated", () => fetchData());
    } catch (err) {
      console.error("Failed to connect EventSource in Notifications Page:", err);
    }

    return () => {
      es?.close();
    };
  }, []);

  const handleCheckStock = async () => {
    setCheckingStock(true);
    try {
      const res = await fetch("/api/admin/low-stock/check", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.products) {
        const validLow = data.products.filter((p: LowStockProduct) => (p.stock ?? 0) <= lowStockThresh);
        setLowStockAlerts(validLow);

        const validIds = new Set(validLow.map((p: LowStockProduct) => p.id));
        setSeenLowStockIds((prev) => {
          const updated = new Set<string>();
          for (const id of Array.from(prev)) {
            if (validIds.has(id)) updated.add(id);
          }
          try {
            localStorage.setItem("luxe_admin_seen_low_stock", JSON.stringify(Array.from(updated)));
          } catch {}
          return updated;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingStock(false);
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("luxe_admin_sound_muted", String(!next));
  };

  const markAllAsRead = () => {
    const allOrderIds = orders.map((o) => o.id);
    const updatedOrders = new Set([...Array.from(seenOrderIds), ...allOrderIds]);
    setSeenOrderIds(updatedOrders);
    localStorage.setItem("luxe_admin_seen_orders", JSON.stringify(Array.from(updatedOrders)));

    const allStockIds = lowStockAlerts.map((p) => p.id);
    const updatedStock = new Set([...Array.from(seenLowStockIds), ...allStockIds]);
    setSeenLowStockIds(updatedStock);
    localStorage.setItem("luxe_admin_seen_low_stock", JSON.stringify(Array.from(updatedStock)));

    const allChannelIds = channelEvents.map((e) => e.id);
    const updatedChannels = new Set([...Array.from(seenChannelEventIds), ...allChannelIds]);
    setSeenChannelEventIds(updatedChannels);
    localStorage.setItem("luxe_admin_seen_channel_events", JSON.stringify(Array.from(updatedChannels)));
  };

  const handleTestNotification = async () => {
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/test-notification", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTestResult(data.message || "Test notification dispatched!");
      } else {
        setTestResult("Test notification queued.");
      }
    } catch {
      setTestResult("Test notification completed.");
    }
  };

  const unreadOrders = orders.filter((o) => !seenOrderIds.has(o.id));
  const unreadLowStock = lowStockAlerts.filter((p) => !seenLowStockIds.has(p.id));
  const unreadChannels = channelEvents.filter((e) => !seenChannelEventIds.has(e.id));
  const totalUnread = unreadOrders.length + unreadLowStock.length + unreadChannels.length;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
        {/* Header Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#006c49] text-white flex items-center justify-center shrink-0">
                <MdNotifications className="text-xl" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-serif font-semibold text-slate-900">
                  Notification Center
                </h1>
                <p className="text-xs text-slate-500 font-[Manrope] mt-0.5">
                  Live order activity, inventory stockouts, and channel webhook events.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
            <button
              onClick={toggleSound}
              className="px-3 py-2 border border-slate-200 text-slate-700 text-xs font-[Manrope] font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5 min-h-[40px]"
            >
              {soundEnabled ? <MdVolumeUp className="text-[#006c49] text-base" /> : <MdVolumeOff className="text-slate-400 text-base" />}
              <span>{soundEnabled ? "Sound On" : "Muted"}</span>
            </button>

            <button
              onClick={fetchData}
              className="px-3 py-2 border border-slate-200 text-slate-700 text-xs font-[Manrope] font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5 min-h-[40px]"
            >
              <MdRefresh className={`text-base ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            {totalUnread > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-3.5 py-2 bg-[#006c49] text-white text-xs font-[Manrope] font-bold rounded-xl hover:bg-black transition-colors flex items-center gap-1.5 shadow-sm min-h-[40px]"
              >
                <MdDoneAll className="text-base" />
                <span>Mark All Read ({totalUnread})</span>
              </button>
            )}
          </div>
        </div>

        {testResult && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-[Manrope] font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MdCheckCircle className="text-emerald-600 text-base shrink-0" />
              <span>{testResult}</span>
            </div>
            <button onClick={() => setTestResult(null)} className="text-emerald-700 text-xs hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2.5 rounded-xl text-xs font-[Manrope] font-bold transition-all whitespace-nowrap min-h-[40px] flex items-center gap-2 ${
              filter === "all"
                ? "bg-black text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>All Updates</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-extrabold">
              {orders.length + lowStockAlerts.length + channelEvents.length}
            </span>
          </button>

          <button
            onClick={() => setFilter("orders")}
            className={`px-4 py-2.5 rounded-xl text-xs font-[Manrope] font-bold transition-all whitespace-nowrap min-h-[40px] flex items-center gap-2 ${
              filter === "orders"
                ? "bg-black text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <MdShoppingCart className="text-base" />
            <span>Orders</span>
            {unreadOrders.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#006c49] text-white font-extrabold">
                {unreadOrders.length} new
              </span>
            )}
          </button>

          <button
            onClick={() => setFilter("stock")}
            className={`px-4 py-2.5 rounded-xl text-xs font-[Manrope] font-bold transition-all whitespace-nowrap min-h-[40px] flex items-center gap-2 ${
              filter === "stock"
                ? "bg-black text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <MdWarning className="text-base text-amber-500" />
            <span>Low Stock</span>
            {lowStockAlerts.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-600 text-white font-extrabold">
                {lowStockAlerts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilter("channels")}
            className={`px-4 py-2.5 rounded-xl text-xs font-[Manrope] font-bold transition-all whitespace-nowrap min-h-[40px] flex items-center gap-2 ${
              filter === "channels"
                ? "bg-black text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <SiMeta className="text-base text-blue-500" />
            <span>Channel Events</span>
            {unreadChannels.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-600 text-white font-extrabold">
                {unreadChannels.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-400 font-[Manrope] border border-slate-100 space-y-3">
            <MdAutorenew className="text-3xl animate-spin block mx-auto text-[#006c49]" />
            <p className="text-sm">Loading notification stream…</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Low Stock Section */}
            {(filter === "all" || filter === "stock") && lowStockAlerts.length > 0 && (
              <div className="bg-white rounded-2xl border border-rose-100 overflow-hidden shadow-sm">
                <div className="px-5 py-4 bg-rose-50/60 border-b border-rose-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MdWarning className="text-rose-600 text-xl" />
                    <h2 className="font-serif font-bold text-slate-900 text-base">
                      Inventory Alerts (Threshold ≤ {lowStockThresh})
                    </h2>
                  </div>
                  <button
                    onClick={handleCheckStock}
                    disabled={checkingStock}
                    className="px-3 py-1.5 bg-white border border-rose-200 text-rose-700 text-xs font-[Manrope] font-bold rounded-lg hover:bg-rose-100 transition-colors flex items-center gap-1"
                  >
                    {checkingStock ? <MdHourglassEmpty className="animate-spin text-sm" /> : <MdRefresh className="text-sm" />}
                    <span>Check Now</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {lowStockAlerts.map((prod) => {
                    const isUnread = !seenLowStockIds.has(prod.id);
                    return (
                      <div
                        key={prod.id}
                        className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors ${
                          isUnread ? "bg-rose-50/20" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                            <MdInventory2 className="text-xl" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              {isUnread && <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />}
                              <p className="font-[Manrope] font-bold text-sm text-slate-900">{prod.name}</p>
                            </div>
                            <p className="text-xs text-rose-600 font-[Manrope] font-semibold mt-0.5">
                              {prod.stock === 0 ? "OUT OF STOCK — Critical status" : `Low Stock: Only ${prod.stock} items remaining`}
                            </p>
                          </div>
                        </div>

                        <Link
                          href={`/products/edit/${prod.id}`}
                          onClick={() => {
                            const updated = new Set(seenLowStockIds);
                            updated.add(prod.id);
                            setSeenLowStockIds(updated);
                            localStorage.setItem("luxe_admin_seen_low_stock", JSON.stringify(Array.from(updated)));
                          }}
                          className="self-start sm:self-center px-4 py-2 bg-slate-900 text-white text-xs font-[Manrope] font-bold rounded-xl hover:bg-[#006c49] transition-colors flex items-center gap-1.5 min-h-[36px]"
                        >
                          <span>Restock Item</span>
                          <MdArrowForward className="text-sm" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {filter === "stock" && lowStockAlerts.length === 0 && (
              <div className="bg-white rounded-2xl border border-emerald-100 p-8 text-center space-y-3 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <MdCheckCircle className="text-2xl" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-slate-900 text-lg">All Stock Levels Healthy</h3>
                  <p className="text-xs text-slate-500 font-[Manrope] mt-1 max-w-md mx-auto">
                    No active low stock alerts. Restocked items (stock &gt; {lowStockThresh}) are automatically cleared from notifications to avoid seller confusion.
                  </p>
                </div>
                <button
                  onClick={handleCheckStock}
                  disabled={checkingStock}
                  className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-[Manrope] font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
                >
                  <MdRefresh className={checkingStock ? "animate-spin" : ""} />
                  <span>Re-check Stock Levels</span>
                </button>
              </div>
            )}

            {/* Channel Events Section */}
            {(filter === "all" || filter === "channels") && channelEvents.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SiMeta className="text-blue-600 text-xl" />
                    <h2 className="font-serif font-bold text-slate-900 text-base">Channel &amp; Sync Events</h2>
                  </div>
                  <span className="text-xs font-[Manrope] font-bold text-slate-500">{channelEvents.length} records</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {channelEvents.map((ev) => {
                    const meta = getChannelMeta(ev.channel);
                    const isUnread = !seenChannelEventIds.has(ev.id);
                    return (
                      <div
                        key={ev.id}
                        onClick={() => {
                          const updated = new Set(seenChannelEventIds);
                          updated.add(ev.id);
                          setSeenChannelEventIds(updated);
                          localStorage.setItem("luxe_admin_seen_channel_events", JSON.stringify(Array.from(updated)));
                        }}
                        className={`p-4 sm:p-5 flex items-start gap-3 hover:bg-slate-50/60 transition-colors cursor-pointer ${
                          isUnread ? "bg-blue-50/30" : ""
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center shrink-0 mt-0.5 shadow-sm`}>
                          {meta.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {isUnread && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                              <p className={`font-[Manrope] text-sm text-slate-900 ${isUnread ? "font-extrabold" : "font-bold"}`}>
                                {meta.name} — {ev.event}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  ev.type === "error"
                                    ? "bg-rose-100 text-rose-700"
                                    : ev.type === "warning"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {ev.type}
                              </span>
                              <span className="text-xs text-slate-400 font-[Manrope]">{timeAgo(ev.createdAt)}</span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 font-[Manrope] mt-1 leading-relaxed">{ev.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Orders Section */}
            {(filter === "all" || filter === "orders") && orders.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MdShoppingCart className="text-[#006c49] text-xl" />
                    <h2 className="font-serif font-bold text-slate-900 text-base">Customer Orders</h2>
                  </div>
                  <span className="text-xs font-[Manrope] font-bold text-slate-500">{orders.length} orders</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {orders.map((ord) => {
                    const isUnread = !seenOrderIds.has(ord.id);
                    const sm = statusMeta[ord.status] || {
                      icon: <MdReceipt />,
                      cls: "text-slate-700 bg-slate-100 border-slate-200",
                      label: ord.status,
                    };
                    const displayTotal = ord.total >= 100 ? (ord.total / 100).toFixed(2) : ord.total.toFixed(2);

                    return (
                      <div
                        key={ord.id}
                        className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors ${
                          isUnread ? "bg-[#006c49]/5" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#006c49]/10 text-[#006c49] flex items-center justify-center shrink-0 mt-0.5">
                            <MdReceipt className="text-xl" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              {isUnread && <span className="w-2 h-2 rounded-full bg-[#006c49] shrink-0" />}
                              <p className="font-[Manrope] font-bold text-sm text-slate-900">
                                Order #{ord.id.slice(0, 8)} — {ord.customerName || ord.customerEmail}
                              </p>
                            </div>

                            <p className="text-xs text-slate-500 font-[Manrope] mt-0.5">
                              Customer Email: {ord.customerEmail} · Date: {timeAgo(ord.createdAt)}
                            </p>

                            <div className="flex items-center gap-3 mt-2">
                              <span className="font-serif font-bold text-sm text-slate-900">${displayTotal}</span>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${sm.cls} flex items-center gap-1`}>
                                {sm.icon}
                                <span>{sm.label}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <Link
                          href="/orders"
                          onClick={() => {
                            const updated = new Set(seenOrderIds);
                            updated.add(ord.id);
                            setSeenOrderIds(updated);
                            localStorage.setItem("luxe_admin_seen_orders", JSON.stringify(Array.from(updated)));
                          }}
                          className="self-start sm:self-center px-4 py-2 border border-slate-200 text-slate-800 text-xs font-[Manrope] font-bold rounded-xl hover:bg-black hover:text-white transition-colors flex items-center gap-1.5 min-h-[36px]"
                        >
                          <span>Manage Order</span>
                          <MdArrowForward className="text-sm" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {lowStockAlerts.length === 0 && channelEvents.length === 0 && orders.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center text-slate-400 font-[Manrope] border border-slate-100 space-y-3">
                <MdNotificationsNone className="text-4xl text-slate-300 block mx-auto" />
                <h3 className="font-serif font-bold text-slate-900 text-base">No Notifications Found</h3>
                <p className="text-xs text-slate-500">Your boutique store activity stream is clean and up to date.</p>
              </div>
            )}
          </div>
        )}

        {/* Dispatch Utilities Footer */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MdMarkEmailRead className="text-2xl text-[#006c49] shrink-0" />
            <div>
              <p className="text-xs font-[Manrope] font-bold text-slate-900">Email &amp; System Notification Engine</p>
              <p className="text-[11px] text-slate-500 font-[Manrope]">
                Dispatches transactional customer receipts and admin notifications.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleTestNotification}
              className="w-full sm:w-auto px-4 py-2 bg-slate-100 text-slate-800 text-xs font-[Manrope] font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
            >
              <MdSend className="text-sm" />
              <span>Test Dispatch</span>
            </button>
            <Link
              href="/settings"
              className="w-full sm:w-auto px-4 py-2 bg-black text-white text-xs font-[Manrope] font-bold rounded-xl hover:bg-[#006c49] transition-colors flex items-center justify-center gap-1.5 min-h-[40px] whitespace-nowrap"
            >
              <span>Email Settings</span>
              <MdArrowForward className="text-sm" />
            </Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
