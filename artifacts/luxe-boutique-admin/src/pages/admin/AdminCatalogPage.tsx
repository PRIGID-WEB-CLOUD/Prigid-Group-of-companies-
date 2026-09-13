import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MdAdd, MdImage } from "react-icons/md";
import AdminLayout from "./AdminLayout";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number | null;
  imageUrl: string | null;
  categoryId: string;
  category: { id: string; name: string } | null;
  createdAt: string;
};

export default function AdminCatalogPage() {
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete product");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setDeleteConfirm(null);
    },
  });

  return (
    <AdminLayout sidebar="main">
      <div className="p-4 sm:p-8 2xl:p-12 mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <h2 className="text-2xl sm:text-[36px] font-serif font-bold leading-tight">Product Catalog</h2>
            <p className="text-[#7c839b] text-sm sm:text-[16px] mt-1">Manage your boutique inventory and collections.</p>
          </div>
          <Link href="/products/new">
            <button className="bg-black text-white px-6 py-3 font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors flex items-center justify-center gap-2 w-full sm:w-auto">
              <MdAdd className="text-xl" /> Add New Product
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
          <div className="bg-white p-4 sm:p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] border-l-4 border-black">
            <p className="text-[10px] font-[Manrope] font-bold tracking-widest uppercase text-[#7c839b]">Total Products</p>
            <h3 className="text-[20px] sm:text-[24px] font-serif font-semibold mt-2">{products.length}</h3>
          </div>
          <div className="bg-white p-4 sm:p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] border-l-4 border-[#006c49]">
            <p className="text-[10px] font-[Manrope] font-bold tracking-widest uppercase text-[#7c839b]">Categories</p>
            <h3 className="text-[20px] sm:text-[24px] font-serif font-semibold mt-2">
              {new Set(products.map(p => p.categoryId)).size}
            </h3>
          </div>
          <div className="bg-white p-4 sm:p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] border-l-4 border-slate-300">
            <p className="text-[10px] font-[Manrope] font-bold tracking-widest uppercase text-[#7c839b]">Avg. Price</p>
            <h3 className="text-[20px] sm:text-[24px] font-serif font-semibold mt-2">
              {products.length > 0
                ? `$${(products.reduce((s, p) => s + p.price, 0) / products.length).toFixed(2)}`
                : "—"}
            </h3>
          </div>
          <div className="bg-white p-4 sm:p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] border-l-4 border-amber-400">
            <p className="text-[10px] font-[Manrope] font-bold tracking-widest uppercase text-[#7c839b]">Low / Out of Stock</p>
            <h3 className="text-[20px] sm:text-[24px] font-serif font-semibold mt-2 text-amber-600">
              {products.filter(p => (p.stock ?? 0) <= 5).length}
            </h3>
          </div>
        </div>

        <div className="bg-white shadow-[0px_4px_20px_rgba(15,23,42,0.05)] overflow-x-auto">
          {isLoading ? (
            <div className="p-16 text-center text-[#7c839b] font-[Manrope]">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-[#7c839b] font-[Manrope] mb-4">No products yet.</p>
              <Link href="/products/new">
                <button className="bg-black text-white px-6 py-2 font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors">
                  Add First Product
                </button>
              </Link>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#eff4ff] border-b border-slate-100">
                  {["Product", "Category", "Price", "Stock", "Actions"].map((h) => (
                    <th key={h} className="px-4 sm:px-6 py-4 sm:py-6 font-[Manrope] font-bold text-[11px] text-[#7c839b] tracking-widest uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const stock = p.stock ?? 0;
                  const stockLabel = stock === 0 ? "Out of Stock" : stock <= 5 ? `Low (${stock})` : String(stock);
                  const stockCls = stock === 0
                    ? "text-[#ba1a1a] bg-[#ffdad6]"
                    : stock <= 5
                    ? "text-amber-700 bg-amber-50"
                    : "text-[#006c49] bg-[#e6f7f1]";
                  return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 sm:px-6 py-4 sm:py-6">
                      <Link href={`/products/edit?id=${p.id}`} className="flex items-center gap-4 group cursor-pointer no-underline">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 bg-slate-100 overflow-hidden flex-shrink-0 rounded-sm">
                          {p.imageUrl
                            ? <img className="h-full w-full object-cover group-hover:scale-105 transition-transform" src={p.imageUrl} alt={p.name} />
                            : <div className="h-full w-full flex items-center justify-center text-slate-300"><MdImage className="text-2xl" /></div>
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="font-[Manrope] font-semibold text-[#0b1c30] group-hover:text-[#006c49] transition-colors truncate">{p.name}</p>
                          <p className="text-[10px] text-[#7c839b] font-[Manrope] line-clamp-1 max-w-xs">{p.description}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-6 text-sm text-[#0b1c30]">{p.category?.name ?? "—"}</td>
                    <td className="px-4 sm:px-6 py-4 sm:py-6 font-semibold text-[#0b1c30]">${p.price.toFixed(2)}</td>
                    <td className="px-4 sm:px-6 py-4 sm:py-6">
                      <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-[Manrope] font-bold tracking-widest uppercase ${stockCls}`}>
                        {stockLabel}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-6">
                      <div className="flex items-center gap-3">
                        <Link href={`/products/edit?id=${p.id}`}>
                          <button className="text-[#006c49] hover:underline font-[Manrope] font-bold text-xs tracking-widest uppercase">Edit</button>
                        </Link>
                        {deleteConfirm === p.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => deleteMutation.mutate(p.id)}
                              disabled={deleteMutation.isPending}
                              className="text-[#ba1a1a] hover:underline font-[Manrope] font-bold text-xs tracking-widest uppercase"
                            >
                              {deleteMutation.isPending ? "Deleting..." : "Confirm"}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-slate-400 hover:text-slate-700 font-[Manrope] font-bold text-xs tracking-widest uppercase"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(p.id)}
                            className="text-slate-400 hover:text-[#ba1a1a] font-[Manrope] font-bold text-xs tracking-widest uppercase transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-[#7c839b] font-[Manrope]">Showing {products.length} product{products.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
