const fs = require('fs');
let code = fs.readFileSync('artifacts/luxe-boutique-admin/src/pages/admin/AdminOrdersPage.tsx', 'utf-8');

// State for selection
code = code.replace(
  'const [search, setSearch] = useState("");',
  `const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);`
);

// Add bulk functions
code = code.replace(
  'const handleDownloadCSV = () => {',
  `
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
    if (selectedIds.size === 0 || !confirm(\`Are you sure you want to delete \${selectedIds.size} orders?\`)) return;
    setIsBulkLoading(true);
    try {
      const res = await fetch("/api/orders/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      if (!res.ok) throw new Error("Failed to bulk delete");
      showToast("success", \`Deleted \${selectedIds.size} orders.\`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e: any) {
      showToast("error", e.message);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkUpdateStatus = async (newStatus: OrderStatus) => {
    if (selectedIds.size === 0 || !confirm(\`Update \${selectedIds.size} orders to \${newStatus}?\`)) return;
    setIsBulkLoading(true);
    try {
      const res = await fetch("/api/orders/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), status: newStatus })
      });
      if (!res.ok) throw new Error("Failed to bulk update");
      showToast("success", \`Updated \${selectedIds.size} orders.\`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e: any) {
      showToast("error", e.message);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this order?")) return;
    try {
      const res = await fetch(\`/api/orders/\${id}\`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete order");
      showToast("success", "Order deleted.");
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e: any) {
      showToast("error", e.message);
    }
  };

  const handleDownloadCSV = () => {`
);

// Add bulk toolbar above the table
code = code.replace(
  `<div className="overflow-x-auto">
              <table className="w-full text-left min-w-[1000px]">`,
  `{/* Bulk Actions */}
              {selectedIds.size > 0 && (
                <div className="mb-4 p-3 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#006c49]">
                    {selectedIds.size} order{selectedIds.size > 1 ? "s" : ""} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      onChange={(e) => {
                        if (e.target.value) handleBulkUpdateStatus(e.target.value as OrderStatus);
                        e.target.value = "";
                      }}
                      disabled={isBulkLoading}
                      className="text-xs px-2 py-1.5 border border-slate-200 rounded-md font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 outline-none"
                    >
                      <option value="">Bulk Update Status...</option>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button 
                      onClick={handleBulkDelete}
                      disabled={isBulkLoading}
                      className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-md transition-colors"
                    >
                      Delete Selected
                    </button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[1000px]">`
);

// Header Checkbox
code = code.replace(
  `<th className="px-6 py-4 font-[Manrope] font-bold text-[#7c839b] text-[11px] uppercase tracking-widest">
                      Order ID
                    </th>`,
  `<th className="px-6 py-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onChange={() => toggleAll(filtered.map(o => o.id))}
                        className="w-4 h-4 text-[#006c49] border-gray-300 rounded focus:ring-[#006c49]"
                      />
                    </th>
                    <th className="px-6 py-4 font-[Manrope] font-bold text-[#7c839b] text-[11px] uppercase tracking-widest">
                      Order ID
                    </th>`
);

// Body Checkbox
code = code.replace(
  `{/* Order ID */}
                        <td className="px-6 py-4">`,
  `<td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(o.id)}
                            onChange={() => toggleSelection(o.id)}
                            className="w-4 h-4 text-[#006c49] border-gray-300 rounded focus:ring-[#006c49]"
                          />
                        </td>
                        {/* Order ID */}
                        <td className="px-6 py-4">`
);

// Delete Icon in Actions
code = code.replace(
  `<button
                                onClick={() => openEmailModal(o)}
                                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                                title="Send Email"
                              >
                                <MdMail className="text-sm" />
                              </button>`,
  `<button
                                onClick={() => openEmailModal(o)}
                                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                                title="Send Email"
                              >
                                <MdMail className="text-sm" />
                              </button>
                              <button
                                onClick={() => handleDelete(o.id)}
                                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="Delete Order"
                              >
                                <MdClose className="text-sm" />
                              </button>`
);

fs.writeFileSync('artifacts/luxe-boutique-admin/src/pages/admin/AdminOrdersPage.tsx', code);
