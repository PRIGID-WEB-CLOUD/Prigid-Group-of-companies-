const fs = require('fs');
let code = fs.readFileSync('artifacts/luxe-boutique-admin/src/pages/admin/AdminCustomersPage.tsx', 'utf-8');

// Add state for selection
code = code.replace(
  'const [search, setSearch] = useState("");',
  `const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);`
);

// Add bulk / individual delete functions
code = code.replace(
  'const handleConnect = async () => {',
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
    if (selectedIds.size === 0 || !confirm(\`Are you sure you want to delete \${selectedIds.size} users?\`)) return;
    setIsBulkLoading(true);
    try {
      const res = await fetch("/api/users/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      if (!res.ok) throw new Error("Failed to bulk delete users");
      showToast(\`Deleted \${selectedIds.size} users successfully.\`);
      setSelectedIds(new Set());
      window.location.reload();
    } catch (e: any) {
      showError(e.message);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkUpdateRole = async (newRole: "USER" | "ADMIN") => {
    if (selectedIds.size === 0 || !confirm(\`Update \${selectedIds.size} users to \${newRole}?\`)) return;
    setIsBulkLoading(true);
    try {
      const res = await fetch("/api/users/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), role: newRole })
      });
      if (!res.ok) throw new Error("Failed to bulk update users");
      showToast(\`Updated \${selectedIds.size} users successfully.\`);
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
      const res = await fetch(\`/api/users/\${id}\`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete user");
      showToast("User deleted successfully.");
      window.location.reload();
    } catch (e: any) {
      showError(e.message);
    }
  };

  const handleConnect = async () => {`
);

// Add bulk actions toolbar above the table
code = code.replace(
  '{/* Users Table */}',
  `{/* Bulk Actions */}
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
        
        {/* Users Table */}`
);

// Add checkbox to table header
code = code.replace(
  `{["NAME", "EMAIL", "ROLE", "GOOGLE CONTACTS", "ACTIONS"].map((h) => (`,
  `<th className="px-6 py-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={filteredUsers.length > 0 && selectedIds.size === filteredUsers.length}
                          onChange={() => toggleAll(filteredUsers.map((u) => u.id))}
                          className="w-4 h-4 text-[#006c49] border-gray-300 rounded focus:ring-[#006c49]"
                        />
                      </th>
                      {["NAME", "EMAIL", "ROLE", "GOOGLE CONTACTS", "ACTIONS"].map((h) => (`
);

// Add checkbox and delete button to table body
code = code.replace(
  `<td className="px-6 py-4">
                        <div className="flex items-center gap-3">`,
  `<td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(u.id)}
                          onChange={() => toggleSelection(u.id)}
                          className="w-4 h-4 text-[#006c49] border-gray-300 rounded focus:ring-[#006c49]"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">`
);

code = code.replace(
  `{syncingId === u.id ? <MdSync className="text-xs animate-spin" /> : <MdCloudUpload className="text-xs" />}
                            Sync
                          </button>`,
  `{syncingId === u.id ? <MdSync className="text-xs animate-spin" /> : <MdCloudUpload className="text-xs" />}
                            Sync
                          </button>
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-md transition-colors"
                            title="Delete user"
                          >
                            Delete
                          </button>`
);

fs.writeFileSync('artifacts/luxe-boutique-admin/src/pages/admin/AdminCustomersPage.tsx', code);
