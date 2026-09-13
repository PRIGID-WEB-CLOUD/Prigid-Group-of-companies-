import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MdCheckCircle,
  MdError,
  MdClose,
  MdSync,
  MdReceiptLong,
  MdTaskAlt,
  MdHourglassTop,
  MdSearch,
  MdAutorenew,
  MdInbox,
  MdOpenInNew,
  MdExpandMore,
  MdSave,
  MdStart,
  MdLocalShipping,
  MdVisibility,
  MdMail,
  MdSend,
  MdLogin,
  MdLogout,
  MdAccountCircle,
  MdWarning,
  MdNotificationsNone,
  MdHelp,
  MdDescription,
  MdVerified,
  MdHourglassEmpty,
  MdRefresh,
  MdInventory2,
  MdReceipt,
  MdImage,
  MdCheck,
  MdInfo,
  MdMarkEmailRead,
  MdDelete
} from "react-icons/md";
import AdminLayout from "./AdminLayout";
import {
  initAuth,
  googleSignIn,
  googleLogout,
  sendGmailMessage,
} from "../../lib/googleWorkspace";
import type { User as FirebaseUser } from "firebase/auth";

type OrderItem = {
  id?: string;
  productId?: string;
  name?: string;
  price: number;
  quantity: number;
  size?: string;
  color?: string;
  imageUrl?: string;
  product?: { id: string; name: string } | null;
};

type Order = {
  id: string;
  customerId?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  total: number;
  status: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
  paymentStatus?: "PENDING" | "PAID" | "FAILED" | "REFUNDED" | null;
  paymentProvider?: string | null;
  paymentReference?: string | null;
  shippingAddress?: Record<string, string> | string | null;
  billingAddress?: Record<string, string> | string | null;
  createdAt: string;
  items: OrderItem[];
};

type OrderStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";

export const ACTIVE_STATUSES: OrderStatus[] = ["PENDING", "PROCESSING", "SHIPPED"];
export const TERMINAL_STATUSES: OrderStatus[] = ["DELIVERED", "REFUNDED", "CANCELLED"];

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as OrderStatus);
}

export function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.includes(status as OrderStatus);
}

const STATUS_OPTIONS: OrderStatus[] = [
  ...ACTIVE_STATUSES,
  ...TERMINAL_STATUSES,
];

const statusStyle: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  PROCESSING: "bg-blue-50 text-blue-700 border-blue-200",
  SHIPPED: "bg-purple-50 text-purple-700 border-purple-200",
  DELIVERED: "bg-emerald-50 text-[#006c49] border-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
  REFUNDED: "bg-rose-50 text-rose-700 border-rose-200",
};

const paymentStatusStyle: Record<string, string> = {
  PAID: "bg-emerald-50 text-[#006c49] border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  FAILED: "bg-rose-50 text-rose-700 border-rose-200",
  REFUNDED: "bg-purple-50 text-purple-700 border-purple-200",
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatAddress(addr: unknown): string {
  if (!addr) return "No address provided";
  if (typeof addr === "string") return addr;
  if (typeof addr === "object" && addr !== null) {
    const a = addr as Record<string, string>;
    const lines = [
      a.street || a.line1 || a.address1,
      a.line2 || a.address2,
      a.city,
      a.state || a.province,
      a.postalCode || a.zipCode || a.zip,
      a.country,
    ].filter(Boolean);
    return lines.length > 0 ? lines.join(", ") : Object.values(a).filter(v => typeof v === "string").join(", ");
  }
  return "—";
}

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [rowStatusChanges, setRowStatusChanges] = useState<Record<string, OrderStatus>>({});
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Google Workspace / Gmail Transactional Emails
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [emailModalOrder, setEmailModalOrder] = useState<Order | null>(null);
  const [emailType, setEmailType] = useState<"RECEIPT" | "SHIPPING" | "CONCIERGE">("RECEIPT");
  const [customNote, setCustomNote] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [isSendingOrderEmail, setIsSendingOrderEmail] = useState(false);

  useEffect(() => {
    const unsub = initAuth(
      (u, t) => {
        setGoogleUser(u);
        setGoogleToken(t);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsub();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleSigningIn(true);
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        showToast("success", `Signed in to Gmail as ${res.user.email}`);
      }
    } catch (e: unknown) {
      showToast("error", (e as Error).message || "Google sign in failed");
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const openEmailModalForOrder = (order: Order, type: "RECEIPT" | "SHIPPING" | "CONCIERGE" = "RECEIPT") => {
    setEmailModalOrder(order);
    setEmailType(type);
    const orderNum = order.id.slice(0, 8).toUpperCase();
    if (type === "RECEIPT") {
      setCustomSubject(`Order Confirmation & Receipt #${orderNum} — Luxe Boutique`);
      setCustomNote("Thank you for your patronage. We are preparing your order with utmost care.");
    } else if (type === "SHIPPING") {
      setCustomSubject(`Your Order #${orderNum} Has Shipped — Luxe Boutique`);
      setCustomNote("Your bespoke parcel has been securely dispatched. Delivery tracking details are below.");
    } else {
      setCustomSubject(`Concierge Update for Order #${orderNum} — Luxe Boutique`);
      setCustomNote("Please find an update regarding your recent order with Luxe Boutique.");
    }
  };

  const generateOrderEmailHtml = (order: Order, type: string, note: string) => {
    const orderNum = order.id.slice(0, 8).toUpperCase();
    const itemsHtml = (order.items || [])
      .map((item) => {
        const name = item.name || item.product?.name || "Luxe Item";
        const price = Number(item.price || 0).toFixed(2);
        const qty = item.quantity || 1;
        const total = (Number(item.price || 0) * qty).toFixed(2);
        const details = [item.size, item.color].filter(Boolean).join(" · ");
        return `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f1f3f9;">
              <strong style="color: #0b1c30; font-size: 14px;">${name}</strong>
              ${details ? `<br/><span style="color: #7c839b; font-size: 12px;">${details}</span>` : ""}
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f1f3f9; text-align: center; color: #45464d; font-size: 13px;">${qty}</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f1f3f9; text-align: right; color: #45464d; font-size: 13px;">$${price}</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f1f3f9; text-align: right; color: #0b1c30; font-weight: 700; font-size: 14px;">$${total}</td>
          </tr>
        `;
      })
      .join("");

    const addressStr = formatAddress(order.shippingAddress);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 24px 0; background-color: #f8f9ff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5eeff; box-shadow: 0 4px 20px rgba(15,23,42,0.05);">
            <!-- Brand Header -->
            <tr>
              <td style="background-color: #080e0b; padding: 28px 32px; text-align: center;">
                <span style="color: #ffffff; font-size: 15px; font-weight: 700; letter-spacing: 0.28em; text-transform: uppercase;">✦ Luxe Boutique</span>
              </td>
            </tr>
            <!-- Order Title & Status -->
            <tr>
              <td style="padding: 32px 32px 16px 32px;">
                <span style="display: inline-block; padding: 4px 12px; background-color: #e6f7f1; color: #006c49; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; border-radius: 999px; margin-bottom: 12px;">
                  Status: ${order.status}
                </span>
                <h1 style="font-size: 22px; font-weight: 700; color: #0b1c30; margin: 0 0 12px 0; font-family: Georgia, serif;">
                  Order #${orderNum}
                </h1>
                <p style="font-size: 14px; color: #45464d; line-height: 1.6; margin: 0 0 20px 0;">
                  Dear ${order.customerName || "Valued Client"},<br/><br/>
                  ${note.replace(/\n/g, "<br/>")}
                </p>
              </td>
            </tr>
            <!-- Line Items Table -->
            <tr>
              <td style="padding: 0 32px 24px 32px;">
                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                  <thead>
                    <tr style="border-bottom: 2px solid #e5eeff;">
                      <th style="padding: 8px 0; text-align: left; font-size: 11px; font-weight: 700; color: #7c839b; text-transform: uppercase; letter-spacing: 0.1em;">Item</th>
                      <th style="padding: 8px 0; text-align: center; font-size: 11px; font-weight: 700; color: #7c839b; text-transform: uppercase; letter-spacing: 0.1em;">Qty</th>
                      <th style="padding: 8px 0; text-align: right; font-size: 11px; font-weight: 700; color: #7c839b; text-transform: uppercase; letter-spacing: 0.1em;">Price</th>
                      <th style="padding: 8px 0; text-align: right; font-size: 11px; font-weight: 700; color: #7c839b; text-transform: uppercase; letter-spacing: 0.1em;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="3" style="padding: 16px 0 0 0; text-align: right; font-size: 13px; font-weight: 700; color: #0b1c30; text-transform: uppercase;">Order Total:</td>
                      <td style="padding: 16px 0 0 0; text-align: right; font-size: 18px; font-weight: 700; color: #006c49; font-family: Georgia, serif;">$${Number(order.total || 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </td>
            </tr>
            <!-- Shipping & Info -->
            <tr>
              <td style="padding: 0 32px 32px 32px;">
                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8f9ff; border-radius: 12px; padding: 16px;">
                  <tr>
                    <td>
                      <p style="margin: 0 0 4px 0; font-size: 10px; font-weight: 700; color: #7c839b; text-transform: uppercase; letter-spacing: 0.1em;">Delivery Address</p>
                      <p style="margin: 0; font-size: 13px; color: #0b1c30; line-height: 1.5;">${addressStr}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background-color: #080e0b; padding: 24px 32px; text-align: center;">
                <p style="font-size: 11px; color: #ffffff; margin: 0 0 4px 0; letter-spacing: 0.15em; text-transform: uppercase;">Luxe Boutique Concierge</p>
                <p style="font-size: 10px; color: #8899a6; margin: 0;">If you have any questions, simply reply directly to this email.</p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  };

  const handleSendOrderEmailViaGmail = async () => {
    if (!emailModalOrder || !emailModalOrder.customerEmail) {
      showToast("error", "No recipient email found for this order");
      return;
    }
    if (!googleToken || !googleUser) {
      await handleGoogleSignIn();
      return;
    }

    try {
      setIsSendingOrderEmail(true);
      const html = generateOrderEmailHtml(emailModalOrder, emailType, customNote);
      await sendGmailMessage(googleToken, {
        to: emailModalOrder.customerEmail,
        subject: customSubject,
        bodyHtml: html,
      });
      showToast("success", `Transactional email dispatched to ${emailModalOrder.customerEmail} via Gmail!`);
      setEmailModalOrder(null);
    } catch (e: unknown) {
      showToast("error", (e as Error).message || "Failed to send email via Gmail");
    } finally {
      setIsSendingOrderEmail(false);
    }
  };

  const { data: orders = [], isLoading, isFetching, error: fetchError, refetch } = useQuery<Order[]>({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const res = await fetch("/api/orders", {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch orders");
      }
      return res.json();
    },
  });

  const showToast = (type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleRefresh = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      const result = await refetch();
      if (result.isError) {
        showToast("error", (result.error as Error)?.message || "Failed to refresh orders");
      } else {
        showToast("success", "Order data refreshed successfully.");
      }
    } catch (e: unknown) {
      showToast("error", (e as Error).message || "Failed to refresh orders");
    }
  };

  const updateStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      setUpdatingOrderId(orderId);
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update order status");
      }
      return res.json();
    },
    onSuccess: (updatedOrder: Order, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      // Clear row draft status
      setRowStatusChanges((prev) => {
        const next = { ...prev };
        delete next[variables.orderId];
        return next;
      });
      // If the selected order is open in modal, update it
      if (selectedOrder && selectedOrder.id === variables.orderId) {
        setSelectedOrder({ ...selectedOrder, status: variables.status });
      }
      showToast("success", `Order #${variables.orderId.slice(0, 8).toUpperCase()} status updated to ${variables.status}.`);
    },
    onError: (err: Error) => {
      showToast("error", err.message || "Failed to update order status");
    },
    onSettled: () => {
      setUpdatingOrderId(null);
    },
  });

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (visibleIds: string[]) => {
    if (selectedIds.size === visibleIds.length && visibleIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !confirm(`Are you sure you want to delete ${selectedIds.size} orders?`)) return;
    setIsBulkLoading(true);
    try {
      const res = await fetch("/api/orders/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Failed to bulk delete orders");
      showToast("success", `Deleted ${selectedIds.size} orders successfully.`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e: unknown) {
      showToast("error", (e as Error).message || "Bulk delete failed");
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkUpdateStatus = async (newStatus: OrderStatus) => {
    if (selectedIds.size === 0 || !confirm(`Update ${selectedIds.size} orders to ${newStatus}?`)) return;
    setIsBulkLoading(true);
    try {
      const res = await fetch("/api/orders/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: Array.from(selectedIds), status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to bulk update orders");
      showToast("success", `Updated ${selectedIds.size} orders to ${newStatus}.`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e: unknown) {
      showToast("error", (e as Error).message || "Bulk update failed");
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleApplyRowStatus = (orderId: string, currentStatus: OrderStatus) => {
    const targetStatus = rowStatusChanges[orderId] || currentStatus;
    updateStatus.mutate({ orderId, status: targetStatus });
  };

  const handleQuickStatusTransition = (orderId: string, nextStatus: OrderStatus) => {
    updateStatus.mutate({ orderId, status: nextStatus });
  };

  const filtered = orders.filter((o) => {
    let matchesFilter = true;
    if (filterStatus === "All") {
      matchesFilter = true;
    } else if (filterStatus === "Active") {
      matchesFilter = isActiveStatus(o.status);
    } else if (filterStatus === "Terminal") {
      matchesFilter = isTerminalStatus(o.status);
    } else {
      matchesFilter = o.status === filterStatus;
    }
    if (!matchesFilter) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const idMatch = o.id.toLowerCase().includes(q);
    const customerNameMatch = (o.customerName ?? "").toLowerCase().includes(q);
    const customerEmailMatch = (o.customerEmail ?? "").toLowerCase().includes(q);
    const itemMatch = (o.items ?? []).some((i) =>
      (i.name || i.product?.name || "").toLowerCase().includes(q)
    );
    return idMatch || customerNameMatch || customerEmailMatch || itemMatch;
  });

  const tabs = ["All", "Active", "Terminal", ...STATUS_OPTIONS];

  return (
    <AdminLayout sidebar="main">
      <div className="mx-auto px-4 sm:px-8 py-6 sm:py-10 2xl:py-16">
        {/* Floating Toast Notification */}
        {toastMessage && (
          <div
            id="order-toast-notification"
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border text-sm font-[Manrope] font-semibold transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
              toastMessage.type === "success"
                ? "bg-emerald-50 text-[#006c49] border-[#c3eed8]"
                : "bg-red-50 text-[#93000a] border-red-200"
            }`}
          >
            {toastMessage.type === "success" ? <MdCheckCircle className="text-xl shrink-0" /> : <MdError className="text-xl shrink-0" />}
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 opacity-60 hover:opacity-100 p-0.5"
              aria-label="Dismiss"
            >
              <MdClose className="text-sm" />
            </button>
          </div>
        )}

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="text-[32px] sm:text-[36px] font-serif font-bold text-[#0b1c30] mb-2">
                Order Management
              </h1>
              <p className="font-[Manrope] text-[#7c839b] text-sm">
                Track active orders (Pending, Processing, Shipped) and terminal orders (Delivered, Refunded, Canceled).
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                id="refresh-orders-button"
                onClick={handleRefresh}
                disabled={isFetching}
                className="flex items-center gap-2 px-4 py-2 text-xs font-[Manrope] font-bold uppercase tracking-wider bg-white border border-slate-200 text-[#0b1c30] rounded-lg hover:border-black transition-colors disabled:opacity-50 cursor-pointer"
                title="Refresh orders"
              >
                <MdSync className={`text-base ${isFetching ? "animate-spin text-[#006c49]" : ""}`} />
                <span>{isFetching ? "Refreshing…" : "Refresh"}</span>
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { label: "Total Orders", value: orders.length, icon: <MdReceiptLong />, color: "text-[#0b1c30]" },
              {
                label: "Active Orders",
                value: orders.filter((o) => isActiveStatus(o.status)).length,
                icon: <MdSync />,
                color: "text-blue-600",
              },
              {
                label: "Terminal Orders",
                value: orders.filter((o) => isTerminalStatus(o.status)).length,
                icon: <MdTaskAlt />,
                color: "text-[#006c49]",
              },
              {
                label: "Pending Review",
                value: orders.filter((o) => o.status === "PENDING").length,
                icon: <MdHourglassTop />,
                color: "text-amber-600",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white p-5 rounded-xl shadow-[0_4px_20_rgba(15,23,42,0.04)] border border-slate-100 flex items-center justify-between"
              >
                <div>
                  <p className="font-[Manrope] font-bold text-[10px] tracking-widest uppercase text-[#7c839b] mb-1">
                    {s.label}
                  </p>
                  <span className={`text-[20px] sm:text-[24px] font-serif font-bold ${s.color}`}>
                    {s.value}
                  </span>
                </div>
                <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                  <div className="text-xl">{s.icon}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="mb-4 p-3.5 bg-white border border-[#006c49]/30 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#006c49] animate-pulse" />
              <span className="text-xs font-[Manrope] font-bold text-[#006c49]">
                {selectedIds.size} order{selectedIds.size > 1 ? "s" : ""} selected
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-[Manrope] text-[#7c839b] font-medium hidden sm:inline">Bulk status:</span>
              <button
                onClick={() => handleBulkUpdateStatus("PROCESSING")}
                disabled={isBulkLoading}
                className="px-2.5 py-1.5 text-[11px] font-[Manrope] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 uppercase tracking-wider disabled:opacity-50"
              >
                Mark Processing
              </button>
              <button
                onClick={() => handleBulkUpdateStatus("SHIPPED")}
                disabled={isBulkLoading}
                className="px-2.5 py-1.5 text-[11px] font-[Manrope] font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200 uppercase tracking-wider disabled:opacity-50"
              >
                Mark Shipped
              </button>
              <button
                onClick={() => handleBulkUpdateStatus("DELIVERED")}
                disabled={isBulkLoading}
                className="px-2.5 py-1.5 text-[11px] font-[Manrope] font-bold bg-emerald-50 text-[#006c49] hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 uppercase tracking-wider disabled:opacity-50"
              >
                Mark Delivered
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isBulkLoading}
                className="px-3 py-1.5 text-[11px] font-[Manrope] font-bold bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-red-200 uppercase tracking-wider flex items-center gap-1 disabled:opacity-50"
              >
                <MdDelete className="text-sm" />
                <span>Delete ({selectedIds.size})</span>
              </button>
            </div>
          </div>
        )}

        {/* Table Container */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Controls: Search and Tabs */}
          <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-hide">
              {tabs.map((tab) => {
                const count =
                  tab === "All"
                    ? orders.length
                    : tab === "Active"
                    ? orders.filter((o) => isActiveStatus(o.status)).length
                    : tab === "Terminal"
                    ? orders.filter((o) => isTerminalStatus(o.status)).length
                    : orders.filter((o) => o.status === tab).length;
                const isActive = filterStatus === tab;
                return (
                  <button
                    key={tab}
                    id={`filter-tab-${tab.toLowerCase()}`}
                    onClick={() => setFilterStatus(tab)}
                    className={`whitespace-nowrap px-3.5 py-1.5 rounded-lg font-[Manrope] font-bold text-[10px] sm:text-[11px] tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                      isActive
                        ? "bg-[#0b1c30] text-white shadow-sm"
                        : "text-[#7c839b] hover:text-[#0b1c30] hover:bg-slate-50"
                    }`}
                  >
                    <span>{tab}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                        isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full lg:w-72">
              <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
              <input
                id="orders-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID, customer, item..."
                className="w-full pl-9 pr-8 py-2 text-xs font-[Manrope] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#006c49] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <MdClose className="text-sm" />
                </button>
              )}
            </div>
          </div>

          {/* Table Content */}
          {fetchError ? (
            <div className="p-16 text-center text-[#93000a] font-[Manrope]">
              <MdError className="text-4xl block mx-auto mb-2" />
              <p className="font-bold mb-1">Failed to load orders</p>
              <p className="text-xs text-[#7c839b] mb-4">{(fetchError as Error).message}</p>
              <button
                onClick={handleRefresh}
                disabled={isFetching}
                className="px-4 py-2 bg-[#006c49] text-white rounded text-xs font-bold uppercase tracking-wider hover:bg-[#005237] disabled:opacity-50"
              >
                {isFetching ? "Retrying…" : "Retry"}
              </button>
            </div>
          ) : isLoading ? (
            <div className="p-16 text-center text-[#7c839b] font-[Manrope]">
              <MdAutorenew className="text-3xl animate-spin block mx-auto mb-2 text-[#006c49]" />
              Loading orders...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center text-[#7c839b] font-[Manrope]">
              <MdInbox className="text-4xl block mx-auto mb-2 text-slate-300" />
              No orders found matching your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200">
                    <th className="px-6 py-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onChange={() => toggleAll(filtered.map(o => o.id))}
                        className="w-4 h-4 text-[#006c49] border-gray-300 rounded focus:ring-[#006c49]"
                      />
                    </th>
                    <th className="px-6 py-4 font-[Manrope] font-bold text-[#7c839b] text-[11px] uppercase tracking-widest">
                      Order ID
                    </th>
                    <th className="px-6 py-4 font-[Manrope] font-bold text-[#7c839b] text-[11px] uppercase tracking-widest">
                      Customer
                    </th>
                    <th className="px-6 py-4 font-[Manrope] font-bold text-[#7c839b] text-[11px] uppercase tracking-widest">
                      Date
                    </th>
                    <th className="px-6 py-4 font-[Manrope] font-bold text-[#7c839b] text-[11px] uppercase tracking-widest">
                      Items
                    </th>
                    <th className="px-6 py-4 font-[Manrope] font-bold text-[#7c839b] text-[11px] uppercase tracking-widest">
                      Total
                    </th>
                    <th className="px-6 py-4 font-[Manrope] font-bold text-[#7c839b] text-[11px] uppercase tracking-widest">
                      Current Status
                    </th>
                    <th className="px-6 py-4 font-[Manrope] font-bold text-[#7c839b] text-[11px] uppercase tracking-widest min-w-[260px]">
                      Update Status
                    </th>
                    <th className="px-6 py-4 font-[Manrope] font-bold text-[#7c839b] text-[11px] uppercase tracking-widest text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((o) => {
                    const isUpdatingThis = updatingOrderId === o.id && updateStatus.isPending;
                    const draftStatus = rowStatusChanges[o.id] ?? o.status;
                    const hasStatusChanged = draftStatus !== o.status;

                    return (
                      <tr
                        key={o.id}
                        id={`order-row-${o.id}`}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(o.id)}
                            onChange={() => toggleSelection(o.id)}
                            className="w-4 h-4 text-[#006c49] border-gray-300 rounded focus:ring-[#006c49]"
                          />
                        </td>
                        {/* Order ID */}
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setSelectedOrder(o)}
                            className="font-mono font-bold text-xs text-[#0b1c30] hover:text-[#006c49] flex items-center gap-1 group-hover:underline cursor-pointer"
                            title="View order details"
                          >
                            <span>#{o.id.slice(0, 8).toUpperCase()}</span>
                            <MdOpenInNew className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </td>

                        {/* Customer */}
                        <td className="px-6 py-4">
                          <div className="text-xs font-[Manrope] font-bold text-[#0b1c30]">
                            {o.customerName || "Customer"}
                          </div>
                          <div className="text-[11px] text-[#7c839b] font-[Manrope] truncate max-w-[160px]">
                            {o.customerEmail || "No email"}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="px-6 py-4 text-xs text-[#7c839b] font-[Manrope] whitespace-nowrap">
                          {formatDate(o.createdAt)}
                        </td>

                        {/* Items */}
                        <td className="px-6 py-4 text-xs font-[Manrope]">
                          <span className="font-semibold text-[#0b1c30]">
                            {o.items?.length || 0} item{(o.items?.length ?? 0) !== 1 ? "s" : ""}
                          </span>
                          <div className="text-[10px] text-[#7c839b] mt-0.5 line-clamp-1 max-w-xs">
                            {(o.items ?? [])
                              .slice(0, 2)
                              .map((i) => i.name || i.product?.name || "Item")
                              .filter(Boolean)
                              .join(", ")}
                            {(o.items?.length ?? 0) > 2 && " ..."}
                          </div>
                        </td>

                        {/* Total & Payment Status */}
                        <td className="px-6 py-4 font-[Manrope]">
                          <span className="font-bold text-xs text-[#0b1c30]">
                            ${Number(o.total || 0).toFixed(2)}
                          </span>
                          {o.paymentStatus && (
                            <div className="mt-0.5">
                              <span
                                className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                                  paymentStatusStyle[o.paymentStatus] || "bg-slate-100 text-slate-600 border-slate-200"
                                }`}
                              >
                                {o.paymentStatus}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Current Status Badge */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-[Manrope] font-bold border uppercase tracking-wider ${
                                statusStyle[o.status] ?? "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {o.status}
                            </span>
                            {isTerminalStatus(o.status) ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-[Manrope] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                <MdTaskAlt className="text-[10px]" />
                                Terminal State
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-[Manrope] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                <MdSync className="text-[10px]" />
                                Active State
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Update Status Controls & Button */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {/* Status Selector Dropdown */}
                            <div className="relative">
                              <select
                                id={`select-status-${o.id}`}
                                disabled={isUpdatingThis}
                                className={`appearance-none bg-slate-50 border rounded-lg pl-3 pr-8 py-1.5 text-xs font-[Manrope] font-semibold tracking-wider outline-none cursor-pointer transition-colors ${
                                  hasStatusChanged
                                    ? "border-[#006c49] ring-1 ring-[#006c49] bg-emerald-50/40 text-[#006c49]"
                                    : "border-slate-300 text-[#0b1c30] hover:border-black"
                                } disabled:opacity-50`}
                                value={draftStatus}
                                onChange={(e) => {
                                  const newStatus = e.target.value as OrderStatus;
                                  setRowStatusChanges((prev) => ({
                                    ...prev,
                                    [o.id]: newStatus,
                                  }));
                                }}
                              >
                                <optgroup label="Active States">
                                  {ACTIVE_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="Terminal States">
                                  {TERMINAL_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                              <MdExpandMore className="absolute right-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none text-slate-400" />
                            </div>

                            {/* Explicit Update Status Button */}
                            <button
                              id={`update-status-btn-${o.id}`}
                              disabled={isUpdatingThis}
                              onClick={() => handleApplyRowStatus(o.id, o.status)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-[Manrope] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 shrink-0 ${
                                hasStatusChanged
                                  ? "bg-[#006c49] text-white hover:bg-[#005237] shadow-sm active:scale-95"
                                  : "bg-slate-100 text-[#0b1c30] hover:bg-slate-200 border border-slate-200 active:scale-95"
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                              title="Click to update order status"
                            >
                              {isUpdatingThis ? (
                                <>
                                  <MdAutorenew className="text-sm animate-spin" />
                                  <span>Saving...</span>
                                </>
                              ) : (
                                <>
                                  <div className="text-sm">{hasStatusChanged ? <MdSave /> : <MdSync />}</div>
                                  <span>{hasStatusChanged ? "Save" : "Update"}</span>
                                </>
                              )}
                            </button>

                            {/* Quick Action Button based on current status */}
                            {o.status === "PENDING" && (
                              <button
                                id={`quick-process-btn-${o.id}`}
                                disabled={isUpdatingThis}
                                onClick={() => handleQuickStatusTransition(o.id, "PROCESSING")}
                                className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-[Manrope] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shrink-0"
                                title="Quick update: Mark as Processing"
                              >
                                <MdStart className="text-xs" />
                                Process
                              </button>
                            )}
                            {o.status === "PROCESSING" && (
                              <button
                                id={`quick-ship-btn-${o.id}`}
                                disabled={isUpdatingThis}
                                onClick={() => handleQuickStatusTransition(o.id, "SHIPPED")}
                                className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-[Manrope] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors shrink-0"
                                title="Quick update: Mark as Shipped"
                              >
                                <MdLocalShipping className="text-xs" />
                                Ship
                              </button>
                            )}
                            {o.status === "SHIPPED" && (
                              <button
                                id={`quick-deliver-btn-${o.id}`}
                                disabled={isUpdatingThis}
                                onClick={() => handleQuickStatusTransition(o.id, "DELIVERED")}
                                className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-[Manrope] font-bold uppercase tracking-wider text-[#006c49] bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shrink-0"
                                title="Quick update: Mark as Delivered"
                              >
                                <MdCheckCircle className="text-xs" />
                                Deliver
                              </button>
                            )}
                            {isTerminalStatus(o.status) && (
                              <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-[Manrope] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 rounded-lg shrink-0" title="Order reached terminal state">
                                <MdTaskAlt className="text-xs" />
                                Terminal State
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <button
                            id={`view-details-btn-${o.id}`}
                            onClick={() => setSelectedOrder(o)}
                            className="px-3 py-1.5 text-xs font-[Manrope] font-bold tracking-wider text-[#006c49] hover:bg-[#e6f7f1] rounded-lg transition-colors inline-flex items-center gap-1 uppercase"
                          >
                            <span>Details</span>
                            <MdVisibility className="text-sm" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer Info */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="font-[Manrope] font-bold text-[11px] tracking-widest text-[#7c839b] uppercase">
              Showing {filtered.length} of {orders.length} orders
            </p>
          </div>
        </div>
      </div>

      {/* Order Details & Status Fulfillment Modal */}
      {selectedOrder && (
        <div
          id="order-details-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedOrder(null);
          }}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-serif font-bold text-[#0b1c30]">
                    Order #{selectedOrder.id.slice(0, 8).toUpperCase()}
                  </h2>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-[Manrope] font-bold border uppercase tracking-wider ${
                      statusStyle[selectedOrder.status] ?? "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {selectedOrder.status}
                  </span>
                  {selectedOrder.paymentStatus && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-[Manrope] font-bold uppercase tracking-wider border ${
                        paymentStatusStyle[selectedOrder.paymentStatus] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      Payment: {selectedOrder.paymentStatus}
                    </span>
                  )}
                </div>
                <p className="text-xs font-[Manrope] text-[#7c839b]">
                  Placed on {formatDate(selectedOrder.createdAt)}
                </p>
              </div>

              <button
                id="close-order-modal-button"
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-black hover:bg-slate-100 transition-colors"
              >
                <MdClose className="text-lg" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Status Update Quick Action Buttons */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-[Manrope] font-bold text-xs uppercase tracking-widest text-[#0b1c30]">
                    Status Management
                  </p>
                  {isTerminalStatus(selectedOrder.status) ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      <MdTaskAlt className="text-xs" />
                      Terminal State
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      <MdSync className="text-xs" />
                      Active State
                    </span>
                  )}
                </div>

                <div className="space-y-3 mb-3">
                  <div>
                    <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Active States (In Progress)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {ACTIVE_STATUSES.map((statusOption) => {
                        const isCurrent = selectedOrder.status === statusOption;
                        const isPending = updatingOrderId === selectedOrder.id && updateStatus.isPending;

                        return (
                          <button
                            key={statusOption}
                            id={`modal-btn-status-${statusOption.toLowerCase()}`}
                            disabled={isPending}
                            onClick={() =>
                              updateStatus.mutate({
                                orderId: selectedOrder.id,
                                status: statusOption,
                              })
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-[Manrope] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                              isCurrent
                                ? "bg-blue-700 text-white shadow-sm ring-2 ring-blue-700/20"
                                : "bg-white text-slate-700 border border-slate-200 hover:border-black hover:bg-slate-100"
                            } disabled:opacity-50`}
                          >
                            {isCurrent && (
                              <MdCheck className="text-xs" />
                            )}
                            <span>{statusOption}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Terminal States (Completed / Closed)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {TERMINAL_STATUSES.map((statusOption) => {
                        const isCurrent = selectedOrder.status === statusOption;
                        const isPending = updatingOrderId === selectedOrder.id && updateStatus.isPending;

                        return (
                          <button
                            key={statusOption}
                            id={`modal-btn-status-${statusOption.toLowerCase()}`}
                            disabled={isPending}
                            onClick={() =>
                              updateStatus.mutate({
                                orderId: selectedOrder.id,
                                status: statusOption,
                              })
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-[Manrope] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                              isCurrent
                                ? "bg-[#0b1c30] text-white shadow-sm ring-2 ring-[#0b1c30]/20"
                                : "bg-white text-slate-700 border border-slate-200 hover:border-black hover:bg-slate-100"
                            } disabled:opacity-50`}
                          >
                            {isCurrent && (
                              <MdCheck className="text-xs" />
                            )}
                            <span>{statusOption}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] font-[Manrope] text-[#7c839b]">
                  {isTerminalStatus(selectedOrder.status)
                    ? "This order has reached a terminal state (Delivered, Refunded, or Canceled). Active state updates remain accessible if required."
                    : "Active orders remain open while Pending, Processing, or Shipped. Transition to Delivered, Refunded, or Canceled to conclude."}
                </p>
              </div>

              {/* Customer and Shipping Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mb-1">
                    Customer Information
                  </p>
                  <p className="font-[Manrope] font-bold text-sm text-[#0b1c30]">
                    {selectedOrder.customerName || "Customer"}
                  </p>
                  <p className="font-[Manrope] text-xs text-[#7c839b] mt-0.5">
                    {selectedOrder.customerEmail || "No email available"}
                  </p>
                  {selectedOrder.paymentReference && (
                    <div className="mt-3 pt-3 border-t border-slate-200/60">
                      <p className="text-[9px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b]">
                        Reference:
                      </p>
                      <p className="font-mono text-[11px] text-slate-700 truncate">
                        {selectedOrder.paymentReference}
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mb-1">
                    Shipping Destination
                  </p>
                  <p className="font-[Manrope] text-xs text-[#0b1c30] leading-relaxed">
                    {formatAddress(selectedOrder.shippingAddress)}
                  </p>
                </div>
              </div>

              {/* Order Items Table */}
              <div>
                <p className="text-xs font-[Manrope] font-bold uppercase tracking-widest text-[#0b1c30] mb-3">
                  Ordered Items ({selectedOrder.items?.length || 0})
                </p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs font-[Manrope]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-3 font-bold text-[#7c839b] uppercase tracking-wider">Item</th>
                        <th className="p-3 font-bold text-[#7c839b] uppercase tracking-wider text-center">Qty</th>
                        <th className="p-3 font-bold text-[#7c839b] uppercase tracking-wider text-right">Price</th>
                        <th className="p-3 font-bold text-[#7c839b] uppercase tracking-wider text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedOrder.items ?? []).map((item, idx) => {
                        const itemName = item.name || item.product?.name || "Product Item";
                        const itemPrice = Number(item.price || 0);
                        const itemQty = Number(item.quantity || 1);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={itemName}
                                    className="w-10 h-10 object-cover rounded-lg bg-slate-100 shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                                    <MdImage className="text-base" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-semibold text-[#0b1c30]">{itemName}</p>
                                  {(item.size || item.color) && (
                                    <p className="text-[10px] text-[#7c839b]">
                                      {[item.size, item.color].filter(Boolean).join(" · ")}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center font-bold text-slate-600">{itemQty}</td>
                            <td className="p-3 text-right text-slate-600">${itemPrice.toFixed(2)}</td>
                            <td className="p-3 text-right font-bold text-[#0b1c30]">
                              ${(itemPrice * itemQty).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50/80 border-t border-slate-200">
                      <tr>
                        <td colSpan={3} className="p-3 text-right font-bold text-[#0b1c30] uppercase tracking-wider">
                          Order Total:
                        </td>
                        <td className="p-3 text-right font-serif font-bold text-base text-[#006c49]">
                          ${Number(selectedOrder.total || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-[Manrope] text-[#7c839b]">
                Order #{selectedOrder.id}
              </span>
              <div className="flex items-center gap-3">
                {selectedOrder.customerEmail && (
                  <button
                    type="button"
                    onClick={() => openEmailModalForOrder(selectedOrder, "RECEIPT")}
                    className="px-4 py-2 text-xs font-[Manrope] font-bold uppercase tracking-wider bg-[#006c49] text-white rounded-lg hover:bg-black transition-colors flex items-center gap-1.5 shadow"
                  >
                    <MdMarkEmailRead className="text-sm" />
                    Email via Gmail
                  </button>
                )}
                <button
                  id="close-modal-footer-btn"
                  onClick={() => setSelectedOrder(null)}
                  className="px-5 py-2 text-xs font-[Manrope] font-bold uppercase tracking-wider bg-black text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transactional Email Modal */}
      {emailModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#006c49]/10 text-[#006c49] flex items-center justify-center">
                  <MdMarkEmailRead className="text-xl" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-[#0b1c30]">Send Order Update via Gmail</h3>
                  <p className="text-xs font-[Manrope] text-[#7c839b]">
                    Recipient: <strong className="text-[#0b1c30]">{emailModalOrder.customerEmail}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEmailModalOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
              >
                <MdClose className="text-sm" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 font-[Manrope]">
              {/* Google Workspace Banner */}
              <div className="p-3.5 bg-[#f8f9ff] border border-[#e5eeff] rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <MdAccountCircle className="text-base text-[#006c49]" />
                  <span className="text-[#45464d]">
                    Sender: <strong>{googleUser ? googleUser.email : "Not signed in"}</strong>
                  </span>
                </div>
                {!googleUser && (
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleSigningIn}
                    className="px-3 py-1 bg-black text-white text-[11px] font-bold uppercase tracking-wider rounded-lg hover:bg-[#006c49]"
                  >
                    {isGoogleSigningIn ? "Connecting…" : "Sign In with Google"}
                  </button>
                )}
              </div>

              {/* Template Selector */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#7c839b] block mb-2">
                  Email Preset
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["RECEIPT", "SHIPPING", "CONCIERGE"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => openEmailModalForOrder(emailModalOrder, t)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                        emailType === t
                          ? "bg-black text-white border-black"
                          : "bg-white text-[#45464d] border-slate-200 hover:border-black"
                      }`}
                    >
                      {t === "RECEIPT" ? "Order Receipt" : t === "SHIPPING" ? "Shipping Notice" : "Concierge Note"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#7c839b] block mb-1.5">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-slate-200 rounded-lg px-4 py-2.5 text-xs font-[Manrope] outline-none focus:border-black"
                />
              </div>

              {/* Message note */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#7c839b] block mb-1.5">
                  Client Message / Notes
                </label>
                <textarea
                  rows={4}
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  className="w-full bg-[#f8f9ff] border border-slate-200 rounded-lg px-4 py-2.5 text-xs font-[Manrope] outline-none focus:border-black resize-none leading-relaxed"
                />
              </div>

              {/* Preview Notice */}
              <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                <MdInfo className="text-base shrink-0 mt-0.5" />
                <span>
                  This email will include the complete branded Luxe Boutique receipt, itemized breakdown (${Number(emailModalOrder.total || 0).toFixed(2)}), delivery address, and concierge support signature.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEmailModalOrder(null)}
                className="px-4 py-2 text-xs font-[Manrope] font-bold uppercase tracking-wider text-slate-600 hover:text-black"
              >
                Cancel
              </button>
              {googleUser ? (
                <button
                  type="button"
                  onClick={handleSendOrderEmailViaGmail}
                  disabled={isSendingOrderEmail || !customSubject.trim()}
                  className="px-6 py-2.5 bg-[#006c49] text-white text-xs font-[Manrope] font-bold uppercase tracking-wider rounded-lg hover:bg-black transition-all shadow flex items-center gap-2 disabled:opacity-40"
                >
                  {isSendingOrderEmail ? (
                    <><MdAutorenew className="text-sm animate-spin" /> Dispatching…</>
                  ) : (
                    <><MdSend className="text-sm" /> Send via Gmail</>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleSigningIn}
                  className="px-6 py-2.5 bg-black text-white text-xs font-[Manrope] font-bold uppercase tracking-wider rounded-lg hover:bg-[#006c49] transition-all shadow flex items-center gap-2"
                >
                  <MdLogin className="text-sm" />
                  Connect Gmail to Send
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
