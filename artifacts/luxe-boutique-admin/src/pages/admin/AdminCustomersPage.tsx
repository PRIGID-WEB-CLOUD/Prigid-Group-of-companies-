import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  MdWorkspacePremium,
  MdCheckCircle,
  MdError,
  MdPeople,
  MdPerson,
  MdContacts,
  MdSearch,
  MdSync,
  MdCloudUpload,
  MdMail,
  MdSend,
  MdOutgoingMail,
} from "react-icons/md";
import AdminLayout from "./AdminLayout";
import {
  initAuth,
  googleSignIn,
  createGoogleContact,
  sendGmailMessage,
  listGoogleContacts,
  type GoogleContact,
} from "../../lib/googleWorkspace";
import type { User as FirebaseUser } from "firebase/auth";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export default function AdminCustomersPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [googleContacts, setGoogleContacts] = useState<GoogleContact[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Email modal
  const [emailTarget, setEmailTarget] = useState<User | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showConfirmSend, setShowConfirmSend] = useState(false);

  // Search
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const showError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 5000);
  };

  useEffect(() => {
    const unsub = initAuth(
      (u, t) => {
        setUser(u);
        setToken(t);
        listGoogleContacts(t).then(setGoogleContacts).catch(() => {});
      },
      () => {
        setUser(null);
        setToken(null);
        setGoogleContacts([]);
      }
    );
    return () => unsub();
  }, []);

  
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
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
    if (selectedIds.size === 0 || !confirm(`Are you sure you want to delete ${selectedIds.size} users?`)) return;
    setIsBulkLoading(true);
    try {
      const res = await fetch("/api/users/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      if (!res.ok) throw new Error("Failed to bulk delete users");
      showToast(`Deleted ${selectedIds.size} users successfully.`);
      setSelectedIds(new Set());
      window.location.reload();
    } catch (e: any) {
      showError(e.message);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkUpdateRole = async (newRole: "USER" | "ADMIN") => {
    if (selectedIds.size === 0 || !confirm(`Update ${selectedIds.size} users to ${newRole}?`)) return;
    setIsBulkLoading(true);
    try {
      const res = await fetch("/api/users/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), role: newRole })
      });
      if (!res.ok) throw new Error("Failed to bulk update users");
      showToast(`Updated ${selectedIds.size} users successfully.`);
      setSelectedIds(new Set());
      window.location.reload();
    } catch (e: any) {
      showError(e.message);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete user");
      showToast("User deleted successfully.");
      window.location.reload();
    } catch (e: any) {
      showError(e.message);
    }
  };

  const handleConnect = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        showToast("Connected to Google Workspace.");
        const contacts = await listGoogleContacts(res.accessToken);
        setGoogleContacts(contacts);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect to Google Workspace";
      showError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const handleSyncToContacts = async (u: User) => {
    if (!token) {
      showError("Please connect to Google Workspace first.");
      return;
    }
    setSyncingId(u.id);
    try {
      const parts = (u.name || "").trim().split(" ");
      const givenName = parts[0] || u.email.split("@")[0];
      const familyName = parts.slice(1).join(" ");

      await createGoogleContact(token, {
        givenName,
        familyName,
        email: u.email,
        organization: "LUXE Boutique Client",
        notes: `Customer registered: ${new Date(u.createdAt).toLocaleDateString()}. Role: ${u.role}`,
      });

      showToast(`Synced ${u.name || u.email} to Google Contacts.`);
      const updated = await listGoogleContacts(token);
      setGoogleContacts(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed.";
      showError(msg);
    } finally {
      setSyncingId(null);
    }
  };

  const openEmailModal = (u: User) => {
    setEmailTarget(u);
    setEmailSubject(`A Personal Note from LUXE Boutique Concierge`);
    setEmailBody(
      `<p>Dear ${u.name || "Valued Client"},</p><p>We are delighted to connect with you regarding your LUXE Boutique experience.</p><p>Warm regards,<br/><strong>LUXE Boutique Concierge</strong></p>`
    );
  };

  const handleSendEmail = async () => {
    if (!token || !emailTarget) return;
    setSendingEmail(true);
    try {
      await sendGmailMessage(token, {
        to: emailTarget.email,
        subject: emailSubject,
        bodyHtml: emailBody,
      });
      showToast(`Email sent to ${emailTarget.email} via Gmail.`);
      setShowConfirmSend(false);
      setEmailTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send email.";
      showError(msg);
    } finally {
      setSendingEmail(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = search.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(term)) ||
      u.email.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term)
    );
  });

  const admins = users.filter((u) => u.role === "ADMIN" || u.role === "SUPER_ADMIN");
  const regularUsers = users.filter((u) => u.role !== "ADMIN" && u.role !== "SUPER_ADMIN");

  return (
    <AdminLayout sidebar="main">
      <div className="flex-1 ml-0 p-4 sm:p-6 max-w-[1280px] mx-auto font-[Manrope]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-5xl font-serif font-bold text-black mb-2">Customers</h1>
            <p className="text-[#45464d] max-w-md text-sm">
              Manage client accounts, synchronize with Google Contacts, and provide 1-on-1 concierge via Gmail.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/channels/google-workspace"
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <MdWorkspacePremium className="text-sm" />
              Google Workspace Hub
            </Link>

            {!token ? (
              <button
                onClick={handleConnect}
                disabled={isLoggingIn}
                className="px-4 py-2.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                {isLoggingIn ? "Connecting..." : "Connect Google"}
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold truncate max-w-[160px]">{user?.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Toasts */}
        {toast && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
            <MdCheckCircle className="text-emerald-600 text-sm" />
            <span>{toast}</span>
          </div>
        )}
        {errorToast && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center gap-2">
            <MdError className="text-red-600 text-sm" />
            <span>{errorToast}</span>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mb-8">
          {[
            { label: "Total Users", icon: <MdPeople />, value: users.length },
            { label: "Customers", icon: <MdPerson />, value: regularUsers.length },
            { label: "Google Contacts Synced", icon: <MdContacts />, value: googleContacts.length },
          ].map((m) => (
            <div key={m.label} className="bg-white p-5 sm:p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] border border-slate-100 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-[10px] sm:text-[11px] tracking-widest uppercase text-[#7c839b]">{m.label}</span>
                <span className="text-[#006c49] text-xl sm:text-2xl">{m.icon}</span>
              </div>
              <div className="text-[28px] sm:text-[36px] font-serif font-bold text-black">{m.value}</div>
            </div>
          ))}
        </div>

        {/* Search bar */}
        <div className="mb-6">
          <div className="relative max-w-md w-full">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-black focus:outline-none focus:border-[#006c49]"
            />
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="mb-4 p-3 bg-white border border-[#006c49]/20 rounded-lg shadow-sm flex items-center justify-between">
            <span className="text-sm font-semibold text-[#006c49]">
              {selectedIds.size} user{selectedIds.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleBulkUpdateRole("ADMIN")}
                disabled={isBulkLoading}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-[#003399] hover:bg-slate-200 rounded-md transition-colors"
              >
                Make Admin
              </button>
              <button 
                onClick={() => handleBulkUpdateRole("USER")}
                disabled={isBulkLoading}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
              >
                Make User
              </button>
              <button 
                onClick={handleBulkDelete}
                disabled={isBulkLoading}
                className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors"
              >
                Delete Selected
              </button>
            </div>
          </div>
        )}
        
        {/* Users Table */}
        <div className="bg-white shadow-[0px_4px_20px_rgba(15,23,42,0.05)] border border-slate-100 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-16 text-center text-[#7c839b]">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-16 text-center text-[#7c839b]">No matching users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={filteredUsers.length > 0 && selectedIds.size === filteredUsers.length}
                          onChange={() => toggleAll(filteredUsers.map((u) => u.id))}
                          className="w-4 h-4 text-[#006c49] border-gray-300 rounded focus:ring-[#006c49]"
                        />
                      </th>
                      {["NAME", "EMAIL", "ROLE", "GOOGLE CONTACTS", "ACTIONS"].map((h) => (
                      <th key={h} className="px-6 py-4 font-bold text-[11px] tracking-widest uppercase text-[#7c839b]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                {filteredUsers.map((u) => {
                  const isSynced = googleContacts.some((gc) =>
                    gc.emailAddresses?.some((e) => e.value.toLowerCase() === u.email.toLowerCase())
                  );
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(u.id)}
                          onChange={() => toggleSelection(u.id)}
                          className="w-4 h-4 text-[#006c49] border-gray-300 rounded focus:ring-[#006c49]"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-600">
                            {getInitials(u.name, u.email)}
                          </div>
                          <div>
                            <span className="font-serif text-sm font-semibold text-black block">{u.name ?? "—"}</span>
                            <span className="text-[11px] text-slate-400">Joined {formatDate(u.createdAt)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[#45464d] text-sm">{u.email}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            u.role === "ADMIN"
                              ? "bg-[#dce9ff] text-[#003399]"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isSynced ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Synced
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Not Synced
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSyncToContacts(u)}
                            disabled={syncingId === u.id || !token}
                            className="px-3 py-1 bg-white border border-slate-200 hover:border-[#006c49] text-slate-700 hover:text-[#006c49] text-xs font-semibold rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
                            title="Sync contact into Google Contacts"
                          >
                            {syncingId === u.id ? <MdSync className="text-xs animate-spin" /> : <MdCloudUpload className="text-xs" />}
                            {syncingId === u.id ? "Syncing..." : isSynced ? "Re-sync" : "Sync Contact"}
                          </button>
                          <button
                            onClick={() => openEmailModal(u)}
                            disabled={!token}
                            className="px-3 py-1 bg-[#006c49]/10 hover:bg-[#006c49]/20 text-[#006c49] text-xs font-semibold rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
                            title="Send Concierge Email via Gmail"
                          >
                            <MdMail className="text-xs" />
                            Gmail Concierge
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

          <div className="p-6 border-t border-slate-50 font-bold text-[11px] tracking-widest text-[#45464d] uppercase">
            Showing {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* EMAIL COMPOSE MODAL */}
        {emailTarget && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 font-[Manrope]">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <MdMail className="text-[#006c49]" />
                  <h3 className="font-serif font-bold text-lg text-black">Gmail VIP Concierge</h3>
                </div>
                <button
                  onClick={() => setEmailTarget(null)}
                  className="text-slate-400 hover:text-black text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">To</label>
                  <input
                    type="text"
                    disabled
                    value={`${emailTarget.name || "Client"} <${emailTarget.email}>`}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm text-black focus:border-[#006c49] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">HTML Body</label>
                  <textarea
                    rows={6}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono text-black focus:border-[#006c49] focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setEmailTarget(null)}
                    className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowConfirmSend(true)}
                    className="px-5 py-2 bg-[#006c49] text-white rounded-lg text-xs font-semibold hover:bg-[#005237] flex items-center gap-1.5"
                  >
                    <MdSend className="text-sm" />
                    Send via Gmail
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRM EMAIL SEND MODAL (MANDATORY CONFIRMATION) */}
        {showConfirmSend && emailTarget && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-[Manrope]">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-[#006c49]">
                  <MdOutgoingMail className="text-lg" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-black">Confirm Dispatch</h3>
                  <p className="text-xs text-slate-500">
                    Send email directly from {user?.email} to {emailTarget.email}?
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowConfirmSend(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="px-5 py-2 bg-[#006c49] text-white rounded-lg text-xs font-semibold hover:bg-[#005237]"
                >
                  {sendingEmail ? "Sending..." : "Yes, Send Email"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

