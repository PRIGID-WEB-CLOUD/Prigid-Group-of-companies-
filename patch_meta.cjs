const fs = require('fs');
let code = fs.readFileSync('artifacts/luxe-boutique-admin/src/pages/admin/AdminMetaCommercePage.tsx', 'utf-8');

// State
code = code.replace(
  'const [searchQuery, setSearchQuery] = useState("");',
  `const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);`
);

// Bulk handlers
code = code.replace(
  'async function handleConfirmDeleteProduct() {',
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
    if (selectedIds.size === 0 || !confirm(\`Are you sure you want to delete \${selectedIds.size} products from Meta?\`)) return;
    setIsBulkLoading(true);
    try {
      const res = await fetch("/api/facebook/catalog/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: "DELETE" })
      });
      if (!res.ok) throw new Error("Failed to bulk delete");
      setProductActionMsg(\`Deleted \${selectedIds.size} products from Meta.\`);
      setProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
    } catch (e: any) {
      setProductActionMsg(\`Error: \${e.message}\`);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkUpdateAvailability = async (avail: string) => {
    if (selectedIds.size === 0 || !confirm(\`Update \${selectedIds.size} products to \${avail}?\`)) return;
    setIsBulkLoading(true);
    try {
      const res = await fetch("/api/facebook/catalog/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: "UPDATE", updates: { availability: avail } })
      });
      if (!res.ok) throw new Error("Failed to bulk update");
      setProductActionMsg(\`Updated \${selectedIds.size} products to \${avail} on Meta.\`);
      setProducts(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, availability: avail } : p));
      setSelectedIds(new Set());
    } catch (e: any) {
      setProductActionMsg(\`Error: \${e.message}\`);
    } finally {
      setIsBulkLoading(false);
    }
  };

  async function handleConfirmDeleteProduct() {`
);

// Toolbar above table
code = code.replace(
  `{products.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">`,
  `{products.length > 0 && (
              <>
                {selectedIds.size > 0 && (
                  <div className="mb-4 p-3 bg-white border border-[#006c49]/20 rounded-lg shadow-sm flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#006c49]">
                      {selectedIds.size} item{selectedIds.size > 1 ? "s" : ""} selected
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) handleBulkUpdateAvailability(e.target.value);
                          e.target.value = "";
                        }}
                        disabled={isBulkLoading}
                        className="text-xs px-2 py-1.5 border border-slate-200 rounded-md font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 outline-none"
                      >
                        <option value="">Bulk Update Availability...</option>
                        <option value="in stock">In Stock</option>
                        <option value="out of stock">Out of Stock</option>
                        <option value="preorder">Preorder</option>
                        <option value="available for order">Available for Order</option>
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
                  <table className="w-full text-sm">`
);

// Closing tags for products
code = code.replace(
  `</table>
              </div>
            )}`,
  `</table>
              </div>
              </>
            )}`
);

// Table Header Checkbox
code = code.replace(
  `<th className="pb-2 text-left">Product</th>`,
  `<th className="pb-2 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          products.filter((p) => {
                            const q = searchQuery.toLowerCase();
                            const matchesSearch = !q || p.name?.toLowerCase().includes(q) || p.retailer_id?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q);
                            const matchesAvail = availabilityFilter === "all" || p.availability === availabilityFilter;
                            return matchesSearch && matchesAvail;
                          }).length > 0 &&
                          selectedIds.size === products.filter((p) => {
                            const q = searchQuery.toLowerCase();
                            const matchesSearch = !q || p.name?.toLowerCase().includes(q) || p.retailer_id?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q);
                            const matchesAvail = availabilityFilter === "all" || p.availability === availabilityFilter;
                            return matchesSearch && matchesAvail;
                          }).length
                        }
                        onChange={() => toggleAll(
                          products.filter((p) => {
                            const q = searchQuery.toLowerCase();
                            const matchesSearch = !q || p.name?.toLowerCase().includes(q) || p.retailer_id?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q);
                            const matchesAvail = availabilityFilter === "all" || p.availability === availabilityFilter;
                            return matchesSearch && matchesAvail;
                          }).map(p => p.id)
                        )}
                        className="w-4 h-4 text-[#006c49] border-gray-300 rounded focus:ring-[#006c49]"
                      />
                    </th>
                    <th className="pb-2 text-left">Product</th>`
);

// Table Body Checkbox
code = code.replace(
  `<td className="py-3 flex items-center gap-3">`,
  `<td className="py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(p.id)}
                            onChange={() => toggleSelection(p.id)}
                            className="w-4 h-4 text-[#006c49] border-gray-300 rounded focus:ring-[#006c49]"
                          />
                        </td>
                        <td className="py-3 flex items-center gap-3">`
);

fs.writeFileSync('artifacts/luxe-boutique-admin/src/pages/admin/AdminMetaCommercePage.tsx', code);
