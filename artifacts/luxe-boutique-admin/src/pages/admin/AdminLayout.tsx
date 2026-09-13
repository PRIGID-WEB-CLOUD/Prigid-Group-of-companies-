import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../../contexts/AuthContext";
import { 
  MdDashboard, 
  MdLocationOn,
  MdShoppingCart, 
  MdInventory, 
  MdPeople, 
  MdHub, 
  MdAnalytics, 
  MdGroup, 
  MdArticle, 
  MdSettings,
  MdHelp,
  MdMenu,
  MdMenuOpen,
  MdSearch,
  MdNotifications,
  MdExpandMore,
  MdLogout,
  MdCategory,
  MdCalendarMonth,
  MdSell,
  MdPhotoLibrary,
  MdMail,
  MdOutlineWorkspacePremium,
  MdExtension,
  MdGroupAdd,
  MdPendingActions,
  MdAutorenew,
  MdLocalShipping,
  MdCheckCircle,
  MdCancel,
  MdClose,
  MdStorefront,
  MdCampaign,
  MdChat,
  MdShare,
  MdPhotoCamera,
  MdThumbUp,
  MdMarkEmailRead,
  MdArrowForward,
  MdAdd,
  MdDescription,
  MdVerified,
  MdKeyboardDoubleArrowLeft,
  MdKeyboardDoubleArrowRight,
  MdWarning,
  MdHourglassEmpty,
  MdRefresh,
  MdInventory2,
  MdNotificationsNone,
  MdReceipt,
  MdVolumeUp,
  MdVolumeOff,
  MdDoneAll,
  MdTrendingUp
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

interface AdminLayoutProps {
  children: React.ReactNode;
  sidebar?: "main" | "channels";
}

const mainNavItems = [
  { icon: <MdDashboard />,       label: "Dashboard",  href: "/"             },
  { icon: <MdInventory />,       label: "Catalog",    href: "/catalog"      },
  { icon: <MdCategory />,        label: "Categories", href: "/categories"   },
  { icon: <MdShoppingCart />,    label: "Orders",     href: "/orders"       },
  { icon: <MdCalendarMonth />,   label: "Calendar",   href: "/calendar"     },
  { icon: <MdPeople />,          label: "Customers",  href: "/customers"    },
  { icon: <MdChat />,            label: "Inbox CRM",  href: "/chat"         },
  { icon: <MdSell />,            label: "Coupons",    href: "/coupons"      },
  { icon: <MdAnalytics />,       label: "Analytics",  href: "/analytics"    },
  { icon: <MdPhotoLibrary />,    label: "Media",      href: "/media"        },
  { icon: <MdArticle />,         label: "Journal",    href: "/blog"         },
  { icon: <MdMail />,            label: "Newsletter", href: "/newsletter"   },
  { icon: <SiGoogle className="text-[#4285F4]" />, label: "Google Workspace", href: "/channels/google-workspace" },
  { icon: <MdHub />,             label: "Channels",   href: "/channels"     },
  { icon: <MdStorefront />,      label: "App Store",  href: "/appstore"     },
  { icon: <MdExtension />,       label: "Providers",  href: "/providers"    },
  { icon: <MdGroupAdd />,        label: "Team",       href: "/team"         },
  { icon: <MdLocationOn />,      label: "Showrooms",  href: "/showrooms"    },
  { icon: <MdNotifications />,   label: "Notifications", href: "/notifications" },
  { icon: <MdSettings />,        label: "Settings",   href: "/settings"     },
];

const channelNavItems = [
  { icon: <MdHub />,             label: "Channel Hub",    href: "/channels"                },
  { icon: <MdChat />,            label: "Inbox CRM",      href: "/chat"                    },
  { icon: <SiMeta className="text-[#0668E1]" />,   label: "Meta Business Suite", href: "/channels/meta-business" },
  { icon: <MdCalendarMonth />,   label: "Google Calendar", href: "/calendar"            },
  { icon: <SiGoogle className="text-[#4285F4]" />, label: "Google Workspace", href: "/channels/google-workspace" },
  { icon: <SiFacebook className="text-[#1877F2]" />, label: "Facebook Pages", href: "/channels/facebook"       },
  { icon: <SiInstagram className="text-[#E4405F]" />, label: "Instagram",      href: "/channels/instagram"      },
  { icon: <SiMeta className="text-[#0668E1]" />,   label: "Meta Commerce",  href: "/channels/meta-commerce"  },
  { icon: <SiMeta className="text-[#0668E1]" />,   label: "Meta Ads",       href: "/channels/meta-ads"       },
  { icon: <SiWhatsapp className="text-[#25D366]" />, label: "WhatsApp API",   href: "/channels/whatsapp"       },
  { icon: <SiX className="text-black" />,          label: "X / Twitter",    href: "/channels/twitter"        },
];

type Order = { id: string; customerName?: string | null; customerEmail: string; status: string; total: number; createdAt: string };
type Toast = { id: string; order: Order };
type LowStockProduct = { id: string; name: string; stock: number };

function getInitials(name: string | null | undefined, email: string) {
  if (name && name.trim()) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getChannelMeta(channel: string) {
  const c = channel.toLowerCase();
  if (c.includes("google") || c === "workspace" || c === "ga4") {
    return {
      icon: <SiGoogle className="text-white text-xs" />,
      bg: "bg-[#4285F4]",
      name: c === "ga4" ? "Google Analytics" : "Google Workspace",
    };
  }
  if (c.includes("facebook") || c.includes("meta") || c.includes("commerce") || c.includes("ads") || c === "metaBusiness" || c.includes("metabusiness")) {
    return {
      icon: <SiMeta className="text-white text-xs" />,
      bg: "bg-[#0668E1]",
      name: "Meta Suite",
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

const statusIcon: Record<string, { icon: any; cls: string }> = {
  PENDING:    { icon: <MdPendingActions />, cls: "text-amber-600 bg-amber-50"   },
  PROCESSING: { icon: <MdAutorenew />,       cls: "text-blue-600 bg-blue-50"     },
  SHIPPED:    { icon: <MdLocalShipping />,  cls: "text-purple-600 bg-purple-50" },
  DELIVERED:  { icon: <MdCheckCircle />,    cls: "text-[#006c49] bg-[#f0faf6]"  },
  CANCELLED:  { icon: <MdCancel />,          cls: "text-red-500 bg-red-50"       },
};

let sharedAudioContext: AudioContext | null = null;

function initAudioContext() {
  try {
    if (!sharedAudioContext) {
      sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedAudioContext && sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

// Industry standard "warmup" listener to unlock AudioContext on first interaction
if (typeof window !== "undefined") {
  const unlock = () => {
    try {
      const ctx = initAudioContext();
      if (ctx && ctx.state === "running") {
        document.removeEventListener("click", unlock);
        document.removeEventListener("keydown", unlock);
        document.removeEventListener("touchstart", unlock);
      }
    } catch {
      // Ignore
    }
  };
  document.addEventListener("click", unlock);
  document.addEventListener("keydown", unlock);
  document.addEventListener("touchstart", unlock);
}

function playNotificationChime() {
  try {
    const ctx = initAudioContext();
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // AudioContext blocked or not supported
  }
}

function OrderToast({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Slide in
    const t1 = setTimeout(() => setVisible(true), 20);
    // Auto-dismiss after 7s
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 400);
    }, 7000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [toast.id, onDismiss]);

  const displayTotal = (toast.order.total >= 100 
    ? (toast.order.total / 100).toFixed(2) 
    : toast.order.total.toFixed(2));

  return (
    <div
      className={`w-80 bg-white rounded-xl shadow-[0_8px_40px_rgba(15,23,42,0.18)] border border-slate-100 overflow-hidden transition-all duration-400 ${
        visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      }`}
      style={{ transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease" }}
    >
      {/* Progress bar */}
      <div className="h-0.5 bg-[#006c49] animate-[shrink_7s_linear_forwards]" style={{ transformOrigin: "left" }} />

      <div className="flex items-start gap-3 px-4 py-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-[#006c49]/10 flex items-center justify-center shrink-0">
          <MdShoppingCart className="text-[#006c49] text-xl" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className="font-[Manrope] font-bold text-[13px] text-[#0b1c30]">New Order!</p>
            <span className="text-[10px] text-[#7c839b] font-[Manrope] shrink-0">just now</span>
          </div>
          <p className="text-[12px] text-[#45464d] font-[Manrope] truncate">
            {toast.order.customerName || toast.order.customerEmail}
          </p>
          <p className="text-[12px] font-[Manrope] font-bold text-[#006c49] mt-1">
            ${displayTotal} · {toast.order.status || "PENDING"}
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => { setVisible(false); setTimeout(() => onDismiss(toast.id), 400); }}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <MdClose className="text-sm" />
        </button>
      </div>

      <div className="px-4 pb-3">
        <Link href="/orders" onClick={() => onDismiss(toast.id)}>
          <button className="w-full py-2 text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-white bg-[#006c49] hover:bg-black transition-colors rounded-lg">
            View Order
          </button>
        </Link>
      </div>
    </div>
  );
}

export default function AdminLayout({ children, sidebar = "main" }: AdminLayoutProps) {
  const [location]  = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [showNotif,      setShowNotif]      = useState(false);
  const [showUser,       setShowUser]       = useState(false);
  const [orders,         setOrders]         = useState<Order[]>([]);
  const [seenIds,        setSeenIds]        = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("luxe_admin_seen_orders");
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const [soundEnabled,   setSoundEnabled]   = useState<boolean>(() => {
    return localStorage.getItem("luxe_admin_sound_muted") !== "true";
  });
  
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const [toasts,         setToasts]         = useState<Toast[]>([]);
  const [sseStatus,      setSseStatus]      = useState<"connecting" | "live" | "offline">("connecting");
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockProduct[]>([]);
  const [lowStockThresh, setLowStockThresh] = useState(5);
  const [seenLowStockIds, setSeenLowStockIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("luxe_admin_seen_low_stock");
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const [checkingStock,  setCheckingStock]  = useState(false);
  const [dbUnreadCount,  setDbUnreadCount]  = useState<number | null>(null);
  const [actionableDbIds, setActionableDbIds] = useState<string[]>([]);
  
  const [channelEvents, setChannelEvents] = useState<any[]>([]);
  const [seenChannelEventIds, setSeenChannelEventIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("luxe_admin_seen_channel_events");
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef  = useRef<HTMLDivElement>(null);

  const navItems = sidebar === "channels" ? channelNavItems : mainNavItems;
  
  // Responsive sidebar width/margin logic
  const sidebarW = collapsed ? "w-[68px]" : "w-64";
  
  // For desktop: margin-left for the main content to clear the fixed sidebar
  // For mobile: sidebar is an overlay (translate-x)
  const contentL = collapsed ? "lg:ml-[68px]" : "lg:ml-64";
  const topbarPadding = collapsed ? "lg:pl-[68px]" : "lg:pl-64";

  // ── Initial fetch ──────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) setOrders(await res.json());
    } catch { /* silently ignore */ }
  }, []);

  const fetchLowStock = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/low-stock");
      if (res.ok) {
        const { products, threshold } = await res.json() as { products: LowStockProduct[]; threshold: number };
        const activeOnly = (products || []).filter((p) => (p.stock ?? 0) <= threshold);
        setLowStockAlerts(activeOnly);
        setLowStockThresh(threshold);

        const currentIds = new Set(activeOnly.map((p) => p.id));
        setSeenLowStockIds((prev) => {
          const updated = new Set<string>();
          for (const id of Array.from(prev)) {
            if (currentIds.has(id)) updated.add(id);
          }
          try {
            localStorage.setItem("luxe_admin_seen_low_stock", JSON.stringify(Array.from(updated)));
          } catch { /* ignore */ }
          return updated;
        });
      }
    } catch { /* silently ignore */ }
  }, []);

  const fetchDbUnreadCount = useCallback(async () => {
    try {
      const seenArray = Array.from(seenIds);
      const res = await fetch(`/api/admin/notifications/unread-count?seenIds=${encodeURIComponent(seenArray.join(","))}`);
      if (res.ok) {
        const data = await res.json() as { unreadCount: number; actionableIds?: string[] };
        setDbUnreadCount(data.unreadCount);
        if (data.actionableIds) {
          setActionableDbIds(data.actionableIds);
        }
      }
    } catch { /* silently ignore */ }
  }, [seenIds]);

  const fetchChannelEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/channels/events");
      if (res.ok) {
        setChannelEvents(await res.json());
      }
    } catch { /* silently ignore */ }
  }, []);

  useEffect(() => { 
    fetchOrders(); 
    fetchLowStock(); 
    fetchDbUnreadCount();
    fetchChannelEvents();
  }, [fetchOrders, fetchLowStock, fetchDbUnreadCount, fetchChannelEvents]);

  useEffect(() => {
    fetchDbUnreadCount();
  }, [orders, seenIds, fetchDbUnreadCount]);

  const checkNow = useCallback(async () => {
    setCheckingStock(true);
    try {
      const res = await fetch("/api/admin/low-stock/check", { method: "POST" });
      if (res.ok) {
        const { products, threshold } = await res.json() as { products: LowStockProduct[]; threshold: number };
        setLowStockAlerts(products);
        setLowStockThresh(threshold);
      }
    } catch { /* silently ignore */ }
    finally { setCheckingStock(false); }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("luxe_admin_sound_muted", next ? "false" : "true");
      return next;
    });
  }, []);

  // ── SSE real-time connection ──────────────────────────────────────────────
  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 2000;

    function connect() {
      setSseStatus("connecting");
      es = new EventSource("/api/admin/events", { withCredentials: true });

      es.addEventListener("connected", () => {
        setSseStatus("live");
        retryDelay = 2000;
      });

      es.addEventListener("new_order", (e) => {
        const order: Order = JSON.parse(e.data);
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === order.id);
          return exists ? prev : [order, ...prev];
        });
        setToasts((prev) => [...prev, { id: `toast-${order.id}`, order }]);
        if (soundEnabledRef.current) {
          playNotificationChime();
        }
      });

      es.addEventListener("order_updated", (e) => {
        const { id, status } = JSON.parse(e.data) as { id: string; status: string };
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
      });

      es.addEventListener("low_stock", (e) => {
        const { products, threshold } = JSON.parse(e.data) as { products: LowStockProduct[]; threshold: number };
        const activeOnly = (products || []).filter((p) => (p.stock ?? 0) <= threshold);
        setLowStockAlerts(activeOnly);
        setLowStockThresh(threshold);
        
        const currentIds = new Set(activeOnly.map((p) => p.id));
        setSeenLowStockIds((prev) => {
          const updated = new Set<string>();
          for (const id of Array.from(prev)) {
            if (currentIds.has(id)) updated.add(id);
          }
          try {
            localStorage.setItem("luxe_admin_seen_low_stock", JSON.stringify(Array.from(updated)));
          } catch { /* ignore */ }
          return updated;
        });

        if (activeOnly.length > 0 && soundEnabledRef.current) {
          playNotificationChime();
        }
      });

      es.addEventListener("channel_event", (e) => {
        const ev = JSON.parse(e.data);
        setChannelEvents((prev) => {
          const exists = prev.some((x) => x.id === ev.id);
          return exists ? prev : [ev, ...prev];
        });
        if (soundEnabledRef.current) {
          playNotificationChime();
        }
      });

      es.addEventListener("heartbeat", () => {
        setSseStatus("live");
      });

      es.onerror = () => {
        setSseStatus("offline");
        es?.close();
        retryTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 1.5, 30_000);
          connect();
        }, retryDelay);
      };
    }

    connect();

    return () => {
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  // ── Close dropdowns on outside click ────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (userRef.current  && !userRef.current.contains(e.target as Node))  setShowUser(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const recentOrders         = orders.filter((o) => (o.status === "PENDING" || o.status === "PROCESSING" || o.status === "PAID") && !seenIds.has(o.id)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);
  const actionableOrders     = orders.filter((o) => o.status === "PENDING" || o.status === "PROCESSING" || o.status === "PAID");
  const unreadOrderCount     = orders.filter((o) => (o.status === "PENDING" || o.status === "PROCESSING" || o.status === "PAID") && !seenIds.has(o.id)).length;
  const activeLowStockAlerts = lowStockAlerts.filter((p) => !seenLowStockIds.has(p.id));
  const unreadLowStock       = activeLowStockAlerts.length > 0 ? 1 : 0;

  const activeChannelEvents  = channelEvents.filter((ev) => !seenChannelEventIds.has(ev.id));
  const unreadChannelCount   = activeChannelEvents.length;

  const unreadCount          = unreadOrderCount + unreadLowStock + unreadChannelCount;
  const displayBadgeCount    = (dbUnreadCount !== null ? dbUnreadCount + unreadLowStock : unreadOrderCount + unreadLowStock) + unreadChannelCount;

  const markAllAsRead = useCallback(() => {
    const allIds = Array.from(new Set([...orders.map((o) => o.id), ...actionableDbIds]));
    setSeenIds((prev) => {
      const updated = new Set([...Array.from(prev), ...allIds]);
      try {
        localStorage.setItem("luxe_admin_seen_orders", JSON.stringify(Array.from(updated)));
      } catch { /* ignore */ }
      return updated;
    });

    const allLowStockIds = lowStockAlerts.map((p) => p.id);
    setSeenLowStockIds((prev) => {
      const updated = new Set([...Array.from(prev), ...allLowStockIds]);
      try {
        localStorage.setItem("luxe_admin_seen_low_stock", JSON.stringify(Array.from(updated)));
      } catch { /* ignore */ }
      return updated;
    });

    const allChannelIds = channelEvents.map((ev) => ev.id);
    setSeenChannelEventIds((prev) => {
      const updated = new Set([...Array.from(prev), ...allChannelIds]);
      try {
        localStorage.setItem("luxe_admin_seen_channel_events", JSON.stringify(Array.from(updated)));
      } catch { /* ignore */ }
      return updated;
    });

    setDbUnreadCount(0);
  }, [orders, lowStockAlerts, actionableDbIds, channelEvents]);

  const markSingleOrderAsRead = useCallback((orderId: string) => {
    setSeenIds((prev) => {
      const updated = new Set(prev);
      updated.add(orderId);
      try {
        localStorage.setItem("luxe_admin_seen_orders", JSON.stringify(Array.from(updated)));
      } catch { /* ignore */ }
      return updated;
    });
  }, []);

  const markSingleChannelEventAsRead = useCallback((eventId: string) => {
    setSeenChannelEventIds((prev) => {
      const updated = new Set(prev);
      updated.add(eventId);
      try {
        localStorage.setItem("luxe_admin_seen_channel_events", JSON.stringify(Array.from(updated)));
      } catch { /* ignore */ }
      return updated;
    });
  }, []);

  const openNotif = () => {
    setShowNotif((v) => !v);
    setShowUser(false);
  };

  const openUser = () => {
    setShowUser((v) => !v);
    setShowNotif(false);
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-[Manrope,sans-serif] text-[#0b1c30]">
      <style>{`
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          font-family: 'Material Symbols Outlined';
          display: inline-block;
          vertical-align: middle;
        }
        .admin-sidebar { transition: width 0.22s cubic-bezier(0.4,0,0.2,1); }
        .admin-topbar  { transition: left  0.22s cubic-bezier(0.4,0,0.2,1); }
        .admin-main    { transition: margin-left 0.22s cubic-bezier(0.4,0,0.2,1); }
        .sidebar-label { transition: opacity 0.15s ease, max-width 0.22s cubic-bezier(0.4,0,0.2,1), margin 0.22s; overflow: hidden; white-space: nowrap; }
        @keyframes shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
        @keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      {/* ── Toast stack (bottom-right) ── */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <OrderToast toast={t} onDismiss={dismissToast} />
          </div>
        ))}
      </div>

      {/* ── Sidebar ── */}
      <aside className={`admin-sidebar fixed left-0 top-0 h-screen ${sidebarW} bg-slate-50 border-r border-slate-200 flex flex-col z-50 overflow-hidden transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>

        <div className="flex items-center border-b border-slate-100 h-20 px-3 shrink-0">
          {!collapsed ? (
            <div className="flex items-center justify-between w-full">
              <Link href="/dashboard" className="flex items-center gap-3 cursor-pointer no-underline min-w-0 pl-1">
                <div className="w-9 h-9 bg-black rounded-sm flex items-center justify-center shrink-0 shadow-lg">
                  <MdDashboard className="text-white text-xl" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-serif font-black tracking-widest text-slate-900 uppercase leading-tight">BOUTIQUE</h1>
                  <p className="text-[10px] font-[Manrope] uppercase tracking-widest text-[#7c839b]">Admin Terminal</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors ml-auto cursor-pointer"
                title="Collapse sidebar"
              >
                <MdKeyboardDoubleArrowLeft className="text-xl" />
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-center">
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="w-10 h-10 bg-black rounded-sm flex items-center justify-center shadow-lg hover:ring-2 hover:ring-[#006c49] transition-all cursor-pointer group"
                title="Expand sidebar"
              >
                <MdDashboard className="text-white text-xl group-hover:scale-110 transition-transform" />
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isActive = sidebar === "main"
              ? (item.href === "/" ? location === "/" : location.startsWith(item.href))
              : location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 py-3.5 transition-all duration-200 font-serif text-sm uppercase tracking-wider cursor-pointer rounded-sm
                  ${collapsed ? "justify-center px-2" : "px-5"}
                  ${isActive
                    ? "bg-white text-emerald-700 border-r-2 border-emerald-600 font-bold shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
              >
                <div className="text-xl shrink-0">{item.icon}</div>
                {!collapsed && <span className="sidebar-label">{item.label}</span>}
              </Link>
            );
          })}

          {sidebar === "channels" && !collapsed && (
            <div className="pt-4 px-2">
              <Link
                href="/appstore"
                className="w-full bg-black text-white py-3 px-4 font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors flex items-center justify-center gap-2 rounded-sm no-underline"
              >
                <MdAdd className="text-sm" /> Add New Channel
              </Link>
            </div>
          )}
          {sidebar === "channels" && collapsed && (
            <div className="pt-4 flex justify-center">
              <Link
                href="/appstore"
                title="Add New Channel / App Store"
                className="w-10 h-10 bg-black text-white flex items-center justify-center hover:bg-[#006c49] transition-colors rounded-sm no-underline"
              >
                <MdAdd className="text-sm" />
              </Link>
            </div>
          )}
        </nav>

        <div className="mt-auto border-t border-slate-200 px-2 py-3 space-y-1">
          {sidebar === "channels" ? (
            <>
              <a href="#" title="Help Center" className={`flex items-center gap-3 py-2.5 text-slate-500 text-xs font-serif italic hover:text-emerald-600 transition-colors rounded-sm ${collapsed ? "justify-center px-2" : "px-5"}`}>
                <MdHelp className="text-lg shrink-0" />
                {!collapsed && <span className="sidebar-label">Help Center</span>}
              </a>
              <a href="#" title="API Docs" className={`flex items-center gap-3 py-2.5 text-slate-500 text-xs font-serif italic hover:text-emerald-600 transition-colors rounded-sm ${collapsed ? "justify-center px-2" : "px-5"}`}>
                <MdDescription className="text-lg shrink-0" />
                {!collapsed && <span className="sidebar-label">API Docs</span>}
              </a>
            </>
          ) : (
            <>
              <Link href="/settings" title="Settings" className={`flex items-center gap-3 py-3.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all font-serif text-sm uppercase tracking-wider rounded-sm ${collapsed ? "justify-center px-2" : "px-5"}`}>
                <MdSettings className="text-xl shrink-0" />
                {!collapsed && <span className="sidebar-label">Settings</span>}
              </Link>
              <a href="#" title="Help" className={`flex items-center gap-3 py-3.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all font-serif text-sm uppercase tracking-wider rounded-sm ${collapsed ? "justify-center px-2" : "px-5"}`}>
                <MdHelp className="text-xl shrink-0" />
                {!collapsed && <span className="sidebar-label">Help</span>}
              </a>
            </>
          )}

          {/* ── Bottom-level Sidebar Expand / Collapse Toggle Button ── */}
          <div className="pt-2 border-t border-slate-200/80">
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`w-full flex items-center py-2.5 text-slate-600 hover:text-slate-950 hover:bg-slate-200/70 active:bg-slate-300/60 rounded-md transition-all cursor-pointer font-[Manrope] font-semibold text-xs ${
                collapsed ? "justify-center px-1" : "px-4 justify-between"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg shrink-0 text-slate-700">
                  {collapsed ? <MdKeyboardDoubleArrowRight /> : <MdKeyboardDoubleArrowLeft />}
                </span>
                {!collapsed && <span>Collapse Sidebar</span>}
              </div>
              {!collapsed && (
                <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                  Toggle
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile Overlay ── */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Top Bar ── */}
      <header className={`admin-topbar fixed top-0 left-0 right-0 h-24 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm flex items-center justify-between z-30 transition-all duration-200 ${topbarPadding}`}>
        <div className="flex items-center gap-8 px-6 lg:px-10 h-full">
          <button 
            onClick={() => setMobileOpen(true)}
            className="lg:hidden w-12 h-12 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <MdMenu className="text-2xl" />
          </button>

          <div className="hidden md:flex items-center bg-slate-50 rounded-full px-6 py-3 border border-slate-200 w-96 shadow-sm focus-within:ring-2 focus-within:ring-[#006c49]/20 focus-within:border-[#006c49] transition-all">
            <MdSearch className="text-slate-400 text-xl" />
            <input className="bg-transparent border-none outline-none text-base ml-3 w-full text-slate-700 placeholder-slate-400 font-[Manrope]" placeholder="Search boutique admin..." type="text" />
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">

          {/* ── Live indicator ── */}
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-[Manrope] font-bold uppercase tracking-widest border transition-colors
            ${sseStatus === 'live' ? 'text-[#006c49] bg-[#006c49]/5 border-[#006c49]/10' : sseStatus === 'connecting' ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-red-500 bg-red-50 border-red-100'}`}>
            <span
              className={`w-2 h-2 rounded-full ${sseStatus === "live" ? "bg-[#006c49]" : sseStatus === "connecting" ? "bg-amber-500" : "bg-red-500"}`}
              style={{ animation: sseStatus === "live" ? "pulse-dot 2s ease-in-out infinite" : sseStatus === "connecting" ? "pulse-dot 0.8s ease-in-out infinite" : "none" }}
            />
            <span>{sseStatus === "live" ? "Live" : sseStatus === "connecting" ? "Connecting…" : "Offline"}</span>
          </div>

          {/* ── Notifications ── */}
          <div ref={notifRef} className="relative">
            <button
              onClick={openNotif}
              className="relative w-10 h-10 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-[#006c49] transition-colors"
              title="Notifications"
            >
              <MdNotifications className="text-2xl" />
              {displayBadgeCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4.5 h-4.5 bg-[#006c49] text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {displayBadgeCount > 9 ? "9+" : displayBadgeCount}
                </span>
              )}
            </button>

            {showNotif && (
              <div className="fixed inset-x-3 top-20 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96 bg-white rounded-2xl sm:rounded-xl shadow-[0_8px_40px_rgba(15,23,42,0.2)] border border-slate-100 z-50 overflow-hidden max-h-[calc(100vh-6rem)] sm:max-h-[36rem] flex flex-col">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif font-semibold text-[15px]">Notifications</h3>
                      {displayBadgeCount > 0 && (
                        <span className="bg-[#006c49] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {displayBadgeCount} new
                        </span>
                      )}
                    </div>
                    {(actionableOrders.length > 0 || lowStockAlerts.length > 0) && (
                      <p className="text-[10px] font-[Manrope] font-bold text-amber-600 mt-0.5">
                        {[
                          actionableOrders.length > 0 && `${actionableOrders.length} order${actionableOrders.length !== 1 ? "s" : ""} pending`,
                          lowStockAlerts.length > 0 && `${lowStockAlerts.length} low stock`,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Sound mute/unmute toggle */}
                    <button
                      onClick={toggleSound}
                      title={soundEnabled ? "Mute notification sounds" : "Unmute notification sounds"}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-base"
                    >
                      {soundEnabled ? <MdVolumeUp className="text-[#006c49]" /> : <MdVolumeOff className="text-slate-400" />}
                    </button>

                    {/* Mark all as read */}
                    {displayBadgeCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        title="Mark all notifications as read"
                        className="flex items-center gap-1 text-[10px] font-[Manrope] font-bold text-[#006c49] hover:text-black bg-[#006c49]/10 hover:bg-[#006c49]/20 px-2 py-1 rounded transition-colors"
                      >
                        <MdDoneAll className="text-sm" />
                        <span>Read all</span>
                      </button>
                    )}

                    <div className={`flex items-center gap-1 text-[9px] font-[Manrope] font-bold uppercase tracking-widest ${sseStatus === "live" ? "text-[#006c49]" : "text-amber-500"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sseStatus === "live" ? "bg-[#006c49]" : "bg-amber-500"}`} />
                      {sseStatus}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[26rem]">
                  {/* ── Low Stock Alerts ── */}
                  {activeLowStockAlerts.length > 0 && (
                    <div className="border-b border-slate-100">
                      <div className="px-5 pt-3 pb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <MdWarning className="text-red-500 text-sm" />
                          <span className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-red-500">
                            Low Stock — threshold ≤ {lowStockThresh}
                          </span>
                        </div>
                        <button
                          onClick={checkNow}
                          disabled={checkingStock}
                          className="text-[9px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] hover:text-[#006c49] transition-colors flex items-center gap-0.5"
                        >
                          <div className="text-[11px]">{checkingStock ? <MdHourglassEmpty className="animate-spin" /> : <MdRefresh />}</div>
                          Check now
                        </button>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {activeLowStockAlerts.map((p) => (
                          <Link 
                            key={p.id} 
                            href="/catalog" 
                            onClick={() => {
                              setSeenLowStockIds((prev) => {
                                const updated = new Set(prev);
                                updated.add(p.id);
                                try {
                                  localStorage.setItem("luxe_admin_seen_low_stock", JSON.stringify(Array.from(updated)));
                                } catch { /* ignore */ }
                                return updated;
                              });
                              setShowNotif(false);
                            }}
                          >
                            <div className="flex items-center gap-3 px-5 py-3 hover:bg-red-50/40 cursor-pointer transition-colors bg-red-50/20">
                              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                                <MdInventory2 className="text-red-500 text-sm" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-[Manrope] font-bold text-xs text-[#0b1c30] truncate">{p.name}</p>
                                <p className="text-[11px] text-red-500 font-[Manrope] font-bold mt-0.5">
                                  {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                                </p>
                              </div>
                              <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0 ${p.stock === 0 ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"}`}>
                                {p.stock === 0 ? "Critical" : "Low"}
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Channel Notifications ── */}
                  {activeChannelEvents.length > 0 && (
                    <div className="border-b border-slate-100">
                      <div className="px-5 pt-3 pb-1.5 flex items-center justify-between bg-slate-50/50">
                        <span className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#006c49]">
                          Channel Notifications ({activeChannelEvents.length})
                        </span>
                      </div>
                      <div className="divide-y divide-slate-50 max-h-[16rem] overflow-y-auto">
                        {activeChannelEvents.map((ev) => {
                          const meta = getChannelMeta(ev.channel);
                          const isUnread = !seenChannelEventIds.has(ev.id);
                          return (
                            <div 
                              key={ev.id} 
                              onClick={() => {
                                markSingleChannelEventAsRead(ev.id);
                              }}
                              className={`flex items-start gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${isUnread ? "bg-blue-50/30" : ""}`}
                            >
                              <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center shrink-0 mt-0.5 shadow-sm`}>
                                {meta.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    {isUnread && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                    )}
                                    <p className={`font-[Manrope] text-xs text-[#0b1c30] truncate ${isUnread ? "font-extrabold" : "font-semibold"}`}>
                                      {meta.name}: {ev.event}
                                    </p>
                                  </div>
                                  <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                                    ev.type === "error" ? "bg-red-50 text-red-600" :
                                    ev.type === "warning" ? "bg-amber-50 text-amber-600" :
                                    ev.type === "sync" ? "bg-emerald-50 text-emerald-600" :
                                    "bg-slate-100 text-slate-600"
                                  }`}>
                                    {ev.type}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#7c839b] font-[Manrope] mt-0.5 leading-relaxed break-words">
                                  {ev.detail}
                                </p>
                              </div>
                              <span className="text-[10px] text-[#7c839b] font-[Manrope] shrink-0 mt-0.5 whitespace-nowrap">{timeAgo(ev.createdAt)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Orders ── */}
                  <div className="divide-y divide-slate-50">
                    {recentOrders.length === 0 && activeLowStockAlerts.length === 0 && activeChannelEvents.length === 0 ? (
                      <div className="py-12 text-center text-[#7c839b] font-[Manrope]">
                        <MdNotificationsNone className="text-3xl text-slate-200 block mx-auto mb-2" />
                        All clear — nothing needs attention
                      </div>
                    ) : recentOrders.length === 0 ? (
                      <div className="py-6 text-center text-[#7c839b] font-[Manrope] text-[11px]">No orders yet</div>
                    ) : (
                      recentOrders.map((o) => {
                        const s = statusIcon[o.status] ?? { icon: <MdReceipt />, cls: "text-slate-500 bg-slate-100" };
                        const isActionable = o.status === "PENDING" || o.status === "PROCESSING" || o.status === "PAID";
                        const isUnread = !seenIds.has(o.id);
                        const displayTotal = (o.total >= 100 ? (o.total / 100).toFixed(2) : o.total.toFixed(2));
                        return (
                          <Link 
                            key={o.id} 
                            href="/orders" 
                            onClick={() => {
                              markSingleOrderAsRead(o.id);
                              setShowNotif(false);
                            }}
                          >
                            <div className={`flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors ${isUnread ? "bg-amber-50/50" : isActionable ? "bg-slate-50/50" : ""}`}>
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${s.cls}`}>
                                <div className="text-sm">{s.icon}</div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    {isUnread && (
                                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                    )}
                                    <p className={`font-[Manrope] text-xs text-[#0b1c30] truncate ${isUnread ? "font-extrabold" : "font-semibold"}`}>
                                      Order #{o.id.slice(0, 8).toUpperCase()}
                                    </p>
                                  </div>
                                  {isActionable && (
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">
                                      Action needed
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#7c839b] font-[Manrope] mt-0.5">
                                  {o.status.charAt(0) + o.status.slice(1).toLowerCase()} · ${displayTotal}
                                </p>
                              </div>
                              <span className="text-[10px] text-[#7c839b] font-[Manrope] shrink-0 mt-0.5">{timeAgo(o.createdAt)}</span>
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <Link href="/notifications" onClick={() => setShowNotif(false)}>
                    <button className="py-1 text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#006c49] hover:text-black transition-colors">
                      View All Notifications →
                    </button>
                  </Link>
                  <Link href="/orders" onClick={() => setShowNotif(false)}>
                    <button className="py-1 text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">
                      Orders →
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* ── User avatar ── */}
          <div ref={userRef} className="relative">
            <button
              onClick={openUser}
              className="flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full hover:bg-slate-100 transition-colors"
              title={user?.name ?? user?.email ?? "Account"}
            >
              <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm shrink-0 select-none shadow-sm">
                {user ? getInitials(user.name, user.email) : "?"}
              </div>
              {!collapsed && user && (
                <span className="font-[Manrope] font-bold text-[13px] text-[#0b1c30] hidden lg:block max-w-[120px] truncate">
                  {user.name ?? user.email}
                </span>
              )}
              <MdExpandMore className="text-slate-400 text-lg hidden lg:inline" />
            </button>

            {showUser && (
              <div className="absolute right-0 top-12 w-[calc(100vw-2rem)] sm:w-72 bg-white rounded-xl shadow-[0_8px_40px_rgba(15,23,42,0.15)] border border-slate-100 z-50 overflow-hidden">
                <div className="px-5 py-5 flex items-center gap-4 border-b border-slate-100">
                  <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-bold text-base shrink-0 select-none">
                    {user ? getInitials(user.name, user.email) : "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-serif font-semibold text-[15px] text-[#0b1c30] truncate">
                      {user?.name ?? "Administrator"}
                    </p>
                    <p className="font-[Manrope] text-[11px] text-[#7c839b] truncate mt-0.5">
                      {user?.email}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-[#eff4ff] text-[#006c49] text-[9px] font-[Manrope] font-bold uppercase tracking-widest rounded-full">
                      <MdVerified className="text-[10px]" />
                      {user?.role ?? "Admin"}
                    </span>
                  </div>
                </div>

                <div className="py-2">
                  <Link href="/dashboard" onClick={() => setShowUser(false)}>
                    <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors">
                      <MdDashboard className="text-slate-400 text-base" />
                      <span className="font-[Manrope] text-sm text-[#0b1c30]">Dashboard</span>
                    </div>
                  </Link>
                  <Link href="/settings" onClick={() => setShowUser(false)}>
                    <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors">
                      <MdSettings className="text-slate-400 text-base" />
                      <span className="font-[Manrope] text-sm text-[#0b1c30]">Settings</span>
                    </div>
                  </Link>
                </div>

                <div className="border-t border-slate-100 py-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-red-50 cursor-pointer transition-colors group"
                  >
                    <MdLogout className="text-slate-400 text-lg group-hover:text-red-500 transition-colors" />
                    <span className="font-[Manrope] text-sm text-[#0b1c30] group-hover:text-red-500 transition-colors">Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className={`admin-main ${contentL} pt-24 min-h-screen`}>
        <div className="max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
