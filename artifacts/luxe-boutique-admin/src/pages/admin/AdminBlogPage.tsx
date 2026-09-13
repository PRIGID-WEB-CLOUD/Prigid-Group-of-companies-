import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MdNoteAdd,
  MdSearch,
  MdArticle,
  MdImage,
  MdEdit,
  MdOpenInNew,
  MdDelete,
  MdDeleteForever
} from "react-icons/md";
import AdminLayout from "./AdminLayout";

type Post = {
  id: string; title: string; slug: string; excerpt: string;
  coverImage: string | null; category: string; author: string;
  status: string; publishedAt: string | null; updatedAt: string;
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  PUBLISHED: { label: "Published", cls: "text-[#00714d] bg-[#6cf8bb]/30" },
  DRAFT:     { label: "Draft",     cls: "text-[#45464d] bg-[#e5eeff]"    },
  ARCHIVED:  { label: "Archived",  cls: "text-[#ba1a1a] bg-[#ffdad6]"   },
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminBlogPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["admin-posts"],
    queryFn: async () => {
      const res = await fetch("/api/posts");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      setDeleteId(null);
    },
  });

  const filtered = posts.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      p.author.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = { ALL: posts.length, PUBLISHED: posts.filter(p => p.status === "PUBLISHED").length, DRAFT: posts.filter(p => p.status === "DRAFT").length, ARCHIVED: posts.filter(p => p.status === "ARCHIVED").length };

  return (
    <AdminLayout sidebar="main">
      <div className="p-4 sm:p-8 bg-[#f8f9ff] min-h-screen">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-[11px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mb-1">Content Management</p>
            <h1 className="text-3xl sm:text-[48px] font-serif font-bold leading-tight text-black">The Journal</h1>
          </div>
          <Link href="/blog/new">
            <button className="flex items-center gap-2 px-6 py-2.5 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-all shadow-md">
              <MdNoteAdd className="text-sm" /> New Post
            </button>
          </Link>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {(["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`p-4 rounded-lg border text-left transition-all ${filterStatus === s ? "bg-white border-black shadow-md" : "bg-white border-[#e5eeff] hover:border-[#c6c6cd]"}`}>
              <p className="text-[28px] font-serif font-bold text-black">{counts[s]}</p>
              <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] mt-0.5">
                {s === "ALL" ? "Total Posts" : STATUS_CFG[s]?.label ?? s}
              </p>
            </button>
          ))}
        </div>

        {/* Search + filter */}
        <div className="bg-white rounded-lg border border-[#e5eeff] shadow-[0px_4px_20px_rgba(15,23,42,0.04)] mb-1">
          <div className="flex items-center gap-4 px-6 py-4 border-b border-[#f0f4ff]">
            <div className="flex items-center gap-2 flex-1 bg-[#f8f9ff] rounded-full px-4 py-2 border border-[#e5eeff]">
              <MdSearch className="text-[#7c839b] text-sm" />
              <input className="bg-transparent border-none outline-none text-sm font-[Manrope] w-full placeholder-[#7c839b]"
                placeholder="Search posts…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="py-20 text-center text-[#7c839b] font-[Manrope] text-sm">Loading posts…</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <MdArticle className="text-4xl text-[#c6c6cd] block mb-3 mx-auto" />
              <p className="font-serif text-lg text-[#45464d]">No posts found</p>
              <p className="text-sm font-[Manrope] text-[#7c839b] mt-1">
                {search ? "Try a different search term" : "Create your first journal post"}
              </p>
              {!search && (
                <Link href="/blog/new">
                  <button className="mt-6 px-6 py-2 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-colors">
                    Write First Post
                  </button>
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#f0f4ff]">
                  {["Post", "Category", "Author", "Status", "Published", "Updated", ""].map(h => (
                    <th key={h} className="px-6 py-3 text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f4ff]">
                {filtered.map(post => {
                  const sc = STATUS_CFG[post.status] ?? STATUS_CFG.DRAFT;
                  return (
                    <tr key={post.id} className="hover:bg-[#f8f9ff] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {post.coverImage ? (
                            <img src={post.coverImage} alt="" className="w-12 h-10 object-cover rounded shrink-0" />
                          ) : (
                            <div className="w-12 h-10 bg-[#e5eeff] rounded shrink-0 flex items-center justify-center">
                              <MdImage className="text-[#7c839b] text-sm" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-serif font-semibold text-sm text-[#0b1c30] truncate max-w-[220px]">{post.title}</p>
                            <p className="text-[11px] font-[Manrope] text-[#7c839b] truncate max-w-[220px] mt-0.5">{post.excerpt}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-[Manrope] font-bold text-[#45464d] bg-[#f0f4ff] px-2 py-0.5 rounded-full">{post.category}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-[Manrope] text-[#45464d]">{post.author}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-[Manrope] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${sc.cls}`}>{sc.label}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-[Manrope] text-[#7c839b]">{fmtDate(post.publishedAt)}</td>
                      <td className="px-6 py-4 text-sm font-[Manrope] text-[#7c839b]">{fmtDate(post.updatedAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/blog/edit?id=${post.id}`}>
                            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#e5eeff] transition-colors" title="Edit">
                              <MdEdit className="text-[#45464d] text-base" />
                            </button>
                          </Link>
                          <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer">
                            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#e5eeff] transition-colors" title="View post">
                              <MdOpenInNew className="text-[#45464d] text-base" />
                            </button>
                          </a>
                          <button onClick={() => setDeleteId(post.id)}
                            className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#ffdad6] transition-colors" title="Delete">
                            <MdDelete className="text-[#ba1a1a] text-base" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Delete modal */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full">
              <div className="w-12 h-12 bg-[#ffdad6] rounded-full flex items-center justify-center mb-4">
                <MdDeleteForever className="text-[#ba1a1a] text-2xl" />
              </div>
              <h3 className="font-serif text-xl font-semibold mb-2">Delete Post?</h3>
              <p className="text-sm font-[Manrope] text-[#7c839b] mb-6">This action is permanent and cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)}
                  className="flex-1 py-2 border border-[#c6c6cd] text-xs font-[Manrope] font-bold uppercase tracking-widest hover:bg-[#f8f9ff] transition-colors">
                  Cancel
                </button>
                <button onClick={() => deleteMutation.mutate(deleteId)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-2 bg-[#ba1a1a] text-white text-xs font-[Manrope] font-bold uppercase tracking-widest hover:bg-[#93000a] transition-colors disabled:opacity-60">
                  {deleteMutation.isPending ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
