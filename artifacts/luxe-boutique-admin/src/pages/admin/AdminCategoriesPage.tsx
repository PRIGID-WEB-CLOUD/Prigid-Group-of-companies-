import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MdClose,
  MdFolder,
  MdAdd,
  MdSubdirectoryArrowRight,
  MdFolderOpen
} from "react-icons/md";
import AdminLayout from "./AdminLayout";

type Category = {
  id: string;
  name: string;
  parentId: string | null;
  slug: string | null;
  description: string | null;
  sortOrder: number;
};

type CategoryTree = Category & { children: Category[] };

function buildTree(cats: Category[]): CategoryTree[] {
  const roots = cats.filter(c => !c.parentId);
  return roots.map(r => ({
    ...r,
    children: cats.filter(c => c.parentId === r.id),
  }));
}

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName]       = useState("");
  const [newParent, setNewParent]   = useState("");
  const [newDesc, setNewDesc]       = useState("");
  const [editId, setEditId]         = useState<string | null>(null);
  const [editName, setEditName]     = useState("");
  const [editParent, setEditParent] = useState("");
  const [editDesc, setEditDesc]     = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formError, setFormError]   = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showSubFor, setShowSubFor] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const tree = useMemo(() => buildTree(categories), [categories]);
  const rootCats = useMemo(() => categories.filter(c => !c.parentId), [categories]);

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; parentId?: string; description?: string }) => {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to create category"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNewName(""); setNewParent(""); setNewDesc(""); setFormError(null); setShowSubFor(null);
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, parentId, description }: { id: string; name: string; parentId?: string; description?: string }) => {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: parentId || null, description }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to update category"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditId(null); setEditName(""); setEditParent(""); setEditDesc("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to delete category"); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setDeleteConfirm(null); setDeleteError(null);
    },
    onError: (e: Error) => { setDeleteConfirm(null); setDeleteError(e.message); },
  });

  const startEdit = (cat: Category) => {
    setEditId(cat.id); setEditName(cat.name);
    setEditParent(cat.parentId ?? ""); setEditDesc(cat.description ?? "");
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) { setFormError("Name is required"); return; }
    createMutation.mutate({ name: newName.trim(), parentId: newParent || undefined, description: newDesc.trim() || undefined });
  };

  const totalSubcats = categories.filter(c => c.parentId).length;

  return (
    <AdminLayout sidebar="main">
      <div className="p-4 sm:p-8 bg-[#f8f9ff] min-h-screen">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-[11px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mb-2">Catalog</p>
            <h1 className="text-3xl sm:text-[48px] font-serif font-bold leading-tight text-black">Categories</h1>
            <p className="text-sm font-[Manrope] text-[#45464d] mt-1">Organize your product catalog. Subcategories can be nested one level deep.</p>
          </div>
          <div className="flex items-center gap-6 text-center flex-wrap sm:flex-nowrap">
            <div>
              <p className="text-[32px] font-serif font-bold text-black leading-none">{rootCats.length}</p>
              <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mt-1">Root</p>
            </div>
            <div className="w-px h-10 bg-[#e5eeff]" />
            <div>
              <p className="text-[32px] font-serif font-bold text-black leading-none">{totalSubcats}</p>
              <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mt-1">Sub</p>
            </div>
            <div className="w-px h-10 bg-[#e5eeff]" />
            <div>
              <p className="text-[32px] font-serif font-bold text-black leading-none">{categories.length}</p>
              <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mt-1">Total</p>
            </div>
          </div>
        </div>

        {/* Add New */}
        <div className="bg-white shadow-[0px_4px_20px_rgba(15,23,42,0.05)] p-6 mb-6 rounded-xl">
          <h3 className="text-[16px] font-serif font-semibold mb-4">Add Category</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1.5">
                  Name <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-2.5 font-[Manrope] text-sm outline-none focus:border-black transition-colors"
                  type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Ready-to-Wear"
                />
              </div>
              <div>
                <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1.5">
                  Parent Category
                </label>
                <select
                  className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-2.5 font-[Manrope] text-sm outline-none focus:border-black transition-colors"
                  value={newParent} onChange={e => setNewParent(e.target.value)}>
                  <option value="">— None (top-level) —</option>
                  {rootCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1.5">
                Description <span className="text-[#7c839b] font-normal normal-case">(optional)</span>
              </label>
              <input
                className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-2.5 font-[Manrope] text-sm outline-none focus:border-black transition-colors"
                type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="Brief description…"
              />
            </div>
            {formError && <p className="text-sm text-[#ba1a1a] font-[Manrope]">{formError}</p>}
            <button type="submit" disabled={createMutation.isPending}
              className="bg-black text-white px-8 py-2.5 font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors rounded-lg disabled:opacity-60">
              {createMutation.isPending ? "Adding…" : "Add Category"}
            </button>
          </form>
        </div>

        {deleteError && (
          <div className="mb-4 p-4 bg-[#ffdad6] text-[#93000a] text-sm font-[Manrope] rounded-xl flex items-start justify-between gap-3">
            <span>{deleteError}</span>
            <button onClick={() => setDeleteError(null)} className="shrink-0 text-[#93000a] hover:opacity-70">
              <MdClose className="text-sm" />
            </button>
          </div>
        )}

        {/* Category Tree */}
        <div className="bg-white shadow-[0px_4px_20px_rgba(15,23,42,0.05)] overflow-hidden rounded-xl">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-7 h-7 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : tree.length === 0 ? (
            <div className="p-12 text-center text-[#7c839b] font-[Manrope]">No categories yet. Add one above.</div>
          ) : (
            <div className="divide-y divide-[#f0f2ff]">
              {tree.map(cat => (
                <div key={cat.id}>
                  {/* Parent row */}
                  <div className="px-6 py-4 hover:bg-[#f8f9ff] transition-colors">
                      <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <MdFolder className="text-[#006c49] text-lg" />
                        <div className="flex-1 min-w-0">
                          {editId === cat.id ? (
                            <div className="flex gap-2 items-center">
                              <input
                                className="bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-3 py-1.5 font-[Manrope] text-sm outline-none focus:border-black w-40"
                                value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                              />
                              <select
                                className="bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-3 py-1.5 font-[Manrope] text-sm outline-none focus:border-black"
                                value={editParent} onChange={e => setEditParent(e.target.value)}>
                                <option value="">No parent</option>
                                {rootCats.filter(c => c.id !== cat.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                              <input
                                className="bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-3 py-1.5 font-[Manrope] text-sm outline-none focus:border-black w-40"
                                value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description…"
                              />
                            </div>
                          ) : (
                            <div>
                              <p className="font-[Manrope] font-semibold text-[#0b1c30]">{cat.name}</p>
                              {cat.description && <p className="text-[12px] text-[#7c839b] font-[Manrope] mt-0.5">{cat.description}</p>}
                            </div>
                          )}
                        </div>
                        {cat.children.length > 0 && (
                          <span className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] bg-[#f8f9ff] px-2 py-0.5 rounded-full">
                            {cat.children.length} sub
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setShowSubFor(showSubFor === cat.id ? null : cat.id)}
                          className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] hover:text-black flex items-center gap-1 px-3 py-1.5 border border-[#e5eeff] rounded-lg hover:border-black transition-all">
                          <MdAdd className="text-sm" /> Sub
                        </button>
                        {editId === cat.id ? (
                          <>
                            <button onClick={() => updateMutation.mutate({ id: cat.id, name: editName, parentId: editParent, description: editDesc })}
                              disabled={updateMutation.isPending}
                              className="text-[#006c49] font-[Manrope] font-bold text-xs tracking-widest uppercase hover:underline">
                              {updateMutation.isPending ? "Saving…" : "Save"}
                            </button>
                            <button onClick={() => setEditId(null)} className="text-[#7c839b] font-[Manrope] font-bold text-xs uppercase hover:text-black">Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(cat)} className="text-[#006c49] font-[Manrope] font-bold text-xs tracking-widest uppercase hover:underline">Edit</button>
                            {deleteConfirm === cat.id ? (
                              <>
                                <button onClick={() => deleteMutation.mutate(cat.id)} disabled={deleteMutation.isPending}
                                  className="text-[#ba1a1a] font-[Manrope] font-bold text-xs uppercase hover:underline">
                                  {deleteMutation.isPending ? "Deleting…" : "Confirm"}
                                </button>
                                <button onClick={() => setDeleteConfirm(null)} className="text-[#7c839b] font-[Manrope] font-bold text-xs uppercase hover:text-black">Cancel</button>
                              </>
                            ) : (
                              <button onClick={() => setDeleteConfirm(cat.id)} className="text-[#7c839b] hover:text-[#ba1a1a] font-[Manrope] font-bold text-xs uppercase transition-colors">Delete</button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Inline add subcategory form */}
                    {showSubFor === cat.id && (
                      <div className="mt-3 ml-8 flex gap-2 items-center">
                        <MdSubdirectoryArrowRight className="text-[#c6c6cd] text-base" />
                        <input
                          className="flex-1 max-w-xs bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-3 py-1.5 font-[Manrope] text-sm outline-none focus:border-black"
                          placeholder={`Subcategory of ${cat.name}…`}
                          value={newParent === cat.id ? newName : ""}
                          onChange={e => { setNewName(e.target.value); setNewParent(cat.id); }}
                          autoFocus
                        />
                        <button
                          onClick={() => { if (newName.trim() && newParent === cat.id) createMutation.mutate({ name: newName.trim(), parentId: cat.id }); }}
                          disabled={createMutation.isPending || !newName.trim() || newParent !== cat.id}
                          className="px-4 py-1.5 bg-black text-white font-[Manrope] font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-[#006c49] transition-colors disabled:opacity-40">
                          Add
                        </button>
                        <button onClick={() => setShowSubFor(null)} className="text-[#7c839b] hover:text-black">
                          <MdClose className="text-sm" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Children rows */}
                  {cat.children.map(child => (
                    <div key={child.id} className="px-6 py-3 bg-[#fafbff] border-t border-[#f0f2ff] hover:bg-[#f8f9ff] transition-colors">
                      <div className="flex items-center justify-between gap-4 ml-8">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <MdSubdirectoryArrowRight className="text-[#c6c6cd] text-base" />
                          <MdFolderOpen className="text-[#7c839b] text-sm" />
                          {editId === child.id ? (
                            <input
                              className="bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-3 py-1 font-[Manrope] text-sm outline-none focus:border-black w-40"
                              value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                            />
                          ) : (
                            <span className="font-[Manrope] text-sm text-[#45464d]">{child.name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {editId === child.id ? (
                            <>
                              <button onClick={() => updateMutation.mutate({ id: child.id, name: editName, parentId: child.parentId ?? undefined })}
                                disabled={updateMutation.isPending}
                                className="text-[#006c49] font-[Manrope] font-bold text-xs uppercase hover:underline">
                                {updateMutation.isPending ? "Saving…" : "Save"}
                              </button>
                              <button onClick={() => setEditId(null)} className="text-[#7c839b] font-[Manrope] font-bold text-xs uppercase hover:text-black">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(child)} className="text-[#006c49] font-[Manrope] font-bold text-xs uppercase hover:underline">Edit</button>
                              {deleteConfirm === child.id ? (
                                <>
                                  <button onClick={() => deleteMutation.mutate(child.id)} disabled={deleteMutation.isPending}
                                    className="text-[#ba1a1a] font-[Manrope] font-bold text-xs uppercase hover:underline">
                                    {deleteMutation.isPending ? "Deleting…" : "Confirm"}
                                  </button>
                                  <button onClick={() => setDeleteConfirm(null)} className="text-[#7c839b] font-[Manrope] font-bold text-xs uppercase hover:text-black">Cancel</button>
                                </>
                              ) : (
                                <button onClick={() => setDeleteConfirm(child.id)} className="text-[#7c839b] hover:text-[#ba1a1a] font-[Manrope] font-bold text-xs uppercase transition-colors">Delete</button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="p-5 border-t border-[#f0f2ff]">
            <p className="text-xs text-[#7c839b] font-[Manrope]">
              {categories.length} categor{categories.length !== 1 ? "ies" : "y"} — {rootCats.length} top-level, {totalSubcats} subcategor{totalSubcats !== 1 ? "ies" : "y"}
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
