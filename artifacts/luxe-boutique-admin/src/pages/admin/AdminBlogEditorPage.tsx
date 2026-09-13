import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useSearch, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "./AdminLayout";

type Post = {
  id: string; title: string; slug: string; excerpt: string; content: string;
  coverImage: string | null; category: string; author: string; status: string;
  tags: string | null; seoTitle: string | null; seoDescription: string | null;
  publishedAt: string | null; updatedAt: string;
};

const CATEGORIES = ["Editorial", "Heritage", "Sustainability", "Culture", "Craft", "Travel", "Style"];
const STATUS_OPTS = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  PUBLISHED: { label: "Published", cls: "text-[#00714d] bg-[#6cf8bb]/30" },
  DRAFT:     { label: "Draft",     cls: "text-[#45464d] bg-[#e5eeff]"    },
  ARCHIVED:  { label: "Archived",  cls: "text-[#ba1a1a] bg-[#ffdad6]"   },
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function fmtSaved(d: Date) {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  return `${mins} min ago`;
}

export default function AdminBlogEditorPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const search = useSearch();
  const routeParams = useParams<{ id?: string }>();

  const searchParams = new URLSearchParams(search || (typeof window !== "undefined" ? window.location.search : ""));
  const postId = routeParams?.id || searchParams.get("id");
  const isEdit = !!postId;

  const [form, setForm] = useState({
    title: "", slug: "", excerpt: "", content: "", coverImage: "",
    category: "Editorial", author: "Admin", status: "DRAFT",
    tags: [] as string[], tagInput: "",
    seoTitle: "", seoDescription: "", publishedAt: "",
  });
  const [slugLocked, setSlugLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSeo, setShowSeo] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const excerptRef = useRef<HTMLTextAreaElement>(null);

  const { data: existing } = useQuery<Post>({
    queryKey: ["blog-post", postId],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${postId}`);
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      let tags: string[] = [];
      try { tags = existing.tags ? JSON.parse(existing.tags) : []; } catch { tags = []; }
      setForm({
        title: existing.title,
        slug: existing.slug,
        excerpt: existing.excerpt,
        content: existing.content,
        coverImage: existing.coverImage ?? "",
        category: existing.category,
        author: existing.author,
        status: existing.status,
        tags,
        tagInput: "",
        seoTitle: existing.seoTitle ?? "",
        seoDescription: existing.seoDescription ?? "",
        publishedAt: existing.publishedAt ? existing.publishedAt.slice(0, 16) : "",
      });
      setSlugLocked(true);
    }
  }, [existing]);

  // Auto-generate slug from title if not locked
  useEffect(() => {
    if (!slugLocked && form.title) {
      setForm(f => ({ ...f, slug: slugify(f.title) }));
    }
  }, [form.title, slugLocked]);

  const insertFormat = (pre: string, post: string, ref: React.RefObject<HTMLTextAreaElement | null>, field: "content" | "excerpt") => {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const selected = value.slice(s, e);
    const newVal = value.slice(0, s) + pre + selected + post + value.slice(e);
    setForm(f => ({ ...f, [field]: newVal }));
    setTimeout(() => { ta.setSelectionRange(s + pre.length, e + pre.length); ta.focus(); }, 0);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const url = isEdit ? `/api/posts/${postId}` : "/api/posts";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          slug: form.slug,
          excerpt: form.excerpt,
          content: form.content,
          coverImage: form.coverImage || null,
          category: form.category,
          author: form.author,
          status: form.status,
          tags: form.tags,
          seoTitle: form.seoTitle || null,
          seoDescription: form.seoDescription || null,
          publishedAt: form.publishedAt || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to save"); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
      setLastSaved(new Date());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (!isEdit) setLocation(`/blog/edit?id=${data.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!form.title || !form.slug) { setError("Title and slug are required."); return; }
    mutation.mutate();
  };

  const addTag = () => {
    const t = form.tagInput.trim();
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t], tagInput: "" }));
  };

  const stCfg = STATUS_CFG[form.status] ?? STATUS_CFG.DRAFT;
  const seoTitle = form.seoTitle || (form.title ? `${form.title} | Luxe Boutique` : "Post | Luxe Boutique");
  const seoSlug = form.slug || slugify(form.title || "post");
  const seoDesc = form.seoDescription || form.excerpt.slice(0, 120);
  const wordCount = form.content.trim() ? form.content.trim().split(/\s+/).length : 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <AdminLayout sidebar="main">
      <div className="p-4 sm:p-8 bg-[#f8f9ff] min-h-screen">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap sm:flex-nowrap">
              <Link href="/blog"
                className="text-[#7c839b] hover:text-black transition-colors text-sm font-[Manrope] flex items-center gap-1 no-underline shrink-0">
                <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Journal
              </Link>
              <span className="text-[#c6c6cd]">·</span>
              <span className={`text-[11px] font-[Manrope] font-bold tracking-widest uppercase px-2 py-0.5 rounded shrink-0 ${stCfg.cls}`}>
                {stCfg.label}
              </span>
              {lastSaved && (
                <span className="text-[11px] font-[Manrope] text-[#7c839b] shrink-0">Last saved {fmtSaved(lastSaved)}</span>
              )}
              {wordCount > 0 && (
                <span className="text-[11px] font-[Manrope] text-[#7c839b] shrink-0">· {wordCount} words · {readTime} min read</span>
              )}
            </div>
            <h1 className="text-3xl sm:text-[48px] font-serif font-bold leading-tight text-black">
              {form.title || (isEdit ? "Edit Post" : "New Post")}
            </h1>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link href="/blog" className="flex-1 sm:flex-none">
              <button type="button" className="w-full px-6 py-2 border border-[#c6c6cd] font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#eff4ff] transition-all">
                Discard
              </button>
            </Link>
            {form.status === "DRAFT" && (
              <button type="button"
                onClick={() => { setForm(f => ({ ...f, status: "PUBLISHED" })); setTimeout(() => mutation.mutate(), 0); }}
                className="flex-1 sm:flex-none px-6 py-2 border border-[#006c49] text-[#006c49] font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] hover:text-white transition-all">
                Publish Now
              </button>
            )}
            <button onClick={() => handleSubmit()} disabled={mutation.isPending}
              className="flex-1 sm:flex-none px-8 py-2.5 bg-black text-white font-[Manrope] font-bold text-xs tracking-widest uppercase hover:bg-[#006c49] transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2">
              {mutation.isPending && <span className="material-symbols-outlined text-sm animate-spin">autorenew</span>}
              {mutation.isPending ? "Saving…" : saved ? "Saved!" : isEdit ? "Save Changes" : "Create Post"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-[#ffdad6] text-[#93000a] text-sm font-[Manrope] rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-12 gap-6">

            {/* ── Left column ── */}
            <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">

              {/* General Info */}
              <section className="bg-white p-6 rounded-lg shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
                <h3 className="text-[24px] font-serif font-semibold text-black mb-6">Post Details</h3>
                <div className="space-y-6">
                  <div>
                    <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">
                      Title <span className="text-[#ba1a1a]">*</span>
                    </label>
                    <input
                      className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg focus:border-black px-4 py-3 font-[Manrope] text-lg outline-none transition-colors"
                      type="text" value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Your editorial headline…"
                    />
                  </div>

                  {/* Slug */}
                  <div>
                    <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">
                      URL Slug <span className="text-[#ba1a1a]">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-[Manrope] text-[#7c839b] shrink-0">/blog/</span>
                      <input
                        className="flex-1 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg focus:border-black px-4 py-2 font-[Manrope] text-sm outline-none transition-colors"
                        value={form.slug}
                        onChange={e => { setSlugLocked(true); setForm(f => ({ ...f, slug: slugify(e.target.value) })); }}
                        placeholder="url-friendly-slug"
                      />
                      {slugLocked && (
                        <button type="button" onClick={() => setSlugLocked(false)}
                          className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b] hover:text-black transition-colors shrink-0 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">autorenew</span> Auto
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Excerpt */}
                  <div>
                    <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">
                      Excerpt <span className="text-[10px] font-normal normal-case tracking-normal text-[#7c839b]">(shown on blog listing)</span>
                    </label>
                    <div className="border border-[#c6c6cd] rounded-lg overflow-hidden focus-within:border-black transition-colors">
                      <div className="bg-[#eff4ff] px-4 py-2 border-b border-[#c6c6cd] flex items-center gap-4">
                        {[
                          { icon: "format_bold",   action: () => insertFormat("**", "**", excerptRef, "excerpt") },
                          { icon: "format_italic",  action: () => insertFormat("_", "_",   excerptRef, "excerpt") },
                        ].map(({ icon, action }) => (
                          <button key={icon} type="button" onClick={action} className="text-[#45464d] hover:text-black transition-colors">
                            <span className="material-symbols-outlined text-lg">{icon}</span>
                          </button>
                        ))}
                        <span className="ml-auto text-[10px] font-[Manrope] text-[#7c839b]">{form.excerpt.length}/200</span>
                      </div>
                      <textarea ref={excerptRef}
                        className="w-full bg-[#f8f9ff] border-none focus:ring-0 px-4 py-3 font-[Manrope] text-[#0b1c30] outline-none resize-none"
                        rows={3} value={form.excerpt}
                        onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
                        placeholder="A compelling teaser that draws the reader in…"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Cover Image */}
              <section className="bg-white p-6 rounded-lg shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
                <h3 className="text-[24px] font-serif font-semibold text-black mb-6">Cover Image</h3>
                <div className="flex gap-3 mb-4">
                  <input
                    className="flex-1 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-4 py-2 text-sm font-[Manrope] outline-none focus:border-black transition-colors"
                    placeholder="Paste cover image URL…"
                    value={form.coverImage}
                    onChange={e => setForm(f => ({ ...f, coverImage: e.target.value }))}
                  />
                  {form.coverImage && (
                    <button type="button" onClick={() => setForm(f => ({ ...f, coverImage: "" }))}
                      className="px-4 py-2 border border-[#ffdad6] text-[#ba1a1a] text-[10px] font-bold uppercase tracking-widest hover:bg-[#ffdad6] transition-colors rounded-lg">
                      Remove
                    </button>
                  )}
                </div>
                {form.coverImage ? (
                  <div className="relative group overflow-hidden rounded-lg aspect-[16/7]">
                    <img src={form.coverImage} alt="Cover preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                    <div className="absolute bottom-4 left-4 pointer-events-none">
                      <span className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-white/70 bg-black/40 px-2 py-1 rounded">Cover Image</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, coverImage: "" }))}
                      title="Remove cover image"
                      className="absolute top-3 right-3 w-7 h-7 bg-white/90 hover:bg-[#ffdad6] rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <span className="material-symbols-outlined text-[#ba1a1a] text-base leading-none">close</span>
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-[#c6c6cd] rounded-lg flex flex-col items-center justify-center gap-3 py-16 text-[#7c839b] hover:bg-[#eff4ff] transition-colors">
                    <span className="material-symbols-outlined text-4xl text-[#c6c6cd]">image</span>
                    <p className="text-sm font-[Manrope] font-bold">No cover image</p>
                    <p className="text-xs font-[Manrope]">Paste an image URL above</p>
                  </div>
                )}
              </section>

              {/* Content */}
              <section className="bg-white p-6 rounded-lg shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[24px] font-serif font-semibold text-black">Content</h3>
                  <span className="text-[11px] font-[Manrope] text-[#7c839b]">{wordCount} words · ~{readTime} min read</span>
                </div>
                <div className="border border-[#c6c6cd] rounded-lg overflow-hidden focus-within:border-black transition-colors">
                  <div className="bg-[#eff4ff] px-4 py-2 border-b border-[#c6c6cd] flex items-center gap-4 flex-wrap">
                    {[
                      { icon: "format_h1",      label: "H1",  action: () => insertFormat("# ",    "",        contentRef, "content") },
                      { icon: "format_h2",      label: "H2",  action: () => insertFormat("## ",   "",        contentRef, "content") },
                      { icon: "format_bold",    label: "B",   action: () => insertFormat("**",    "**",      contentRef, "content") },
                      { icon: "format_italic",  label: "I",   action: () => insertFormat("_",     "_",       contentRef, "content") },
                      { icon: "format_quote",   label: "\"",  action: () => insertFormat("\n> ",  "",        contentRef, "content") },
                      { icon: "list",           label: "UL",  action: () => insertFormat("\n- ",  "",        contentRef, "content") },
                      { icon: "format_list_numbered", label: "OL", action: () => insertFormat("\n1. ", "",   contentRef, "content") },
                      { icon: "link",           label: "Link",action: () => insertFormat("[",     "](url)",  contentRef, "content") },
                      { icon: "code",           label: "Code",action: () => insertFormat("`",     "`",       contentRef, "content") },
                      { icon: "horizontal_rule",label: "HR",  action: () => insertFormat("\n---\n","",       contentRef, "content") },
                    ].map(({ icon, action }) => (
                      <button key={icon} type="button" onClick={action} title={icon}
                        className="text-[#45464d] hover:text-black transition-colors">
                        <span className="material-symbols-outlined text-lg">{icon}</span>
                      </button>
                    ))}
                  </div>
                  <textarea ref={contentRef}
                    className="w-full bg-[#f8f9ff] border-none focus:ring-0 px-4 py-4 font-[Manrope] text-[#0b1c30] outline-none resize-none leading-relaxed"
                    rows={20} value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    placeholder={"Start writing your editorial...\n\nUse the toolbar above for formatting:\n# Heading 1\n## Heading 2\n**bold** and _italic_ text\n> blockquotes\n- bullet lists"}
                  />
                </div>
                <p className="mt-2 text-[10px] font-[Manrope] text-[#7c839b]">Supports markdown formatting</p>
              </section>
            </div>

            {/* ── Right column ── */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">

              {/* Publication */}
              <section className="bg-white p-6 rounded-lg shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
                <h3 className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] mb-6">Publication</h3>
                <div className="space-y-5">
                  <div>
                    <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">Status</label>
                    <select className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg focus:border-black px-4 py-2 font-[Manrope] outline-none"
                      value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_CFG[s]?.label ?? s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">Category</label>
                    <select className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg focus:border-black px-4 py-2 font-[Manrope] outline-none"
                      value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">Author</label>
                    <input className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg focus:border-black px-4 py-2 font-[Manrope] text-sm outline-none"
                      value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                      placeholder="Author name" />
                  </div>
                  <div>
                    <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">Publish Date</label>
                    <input type="datetime-local"
                      className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg focus:border-black px-4 py-2 font-[Manrope] text-sm outline-none"
                      value={form.publishedAt}
                      onChange={e => setForm(f => ({ ...f, publishedAt: e.target.value }))} />
                    <p className="text-[10px] font-[Manrope] text-[#7c839b] mt-1">Leave blank to use save time</p>
                  </div>
                  <div>
                    <label className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] block mb-2">Tags</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {form.tags.map(tag => (
                        <span key={tag} className="bg-[#e5eeff] text-[#0b1c30] px-2 py-0.5 text-xs font-[Manrope] font-medium rounded-full flex items-center gap-1">
                          {tag}
                          <button type="button" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))}>
                            <span className="material-symbols-outlined text-[12px] leading-none">close</span>
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input className="flex-1 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-3 py-1.5 text-sm font-[Manrope] outline-none focus:border-black"
                        placeholder="Add tag…" value={form.tagInput}
                        onChange={e => setForm(f => ({ ...f, tagInput: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
                      <button type="button" onClick={addTag}
                        className="px-3 py-1.5 bg-[#eff4ff] text-black text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors rounded-lg">
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* SEO Preview */}
              <section className="bg-white p-6 rounded-lg shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
                <h3 className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] mb-6">Search Engine Preview</h3>
                <div className="p-4 bg-white border border-[#c6c6cd] rounded-lg">
                  <p className="text-[#1a0dab] text-base hover:underline cursor-pointer font-medium truncate">{seoTitle}</p>
                  <p className="text-[#006621] text-xs mb-1">https://luxeboutique.com/blog/{seoSlug}</p>
                  <p className="text-[#45464d] text-xs line-clamp-2">{seoDesc || "No description yet…"}</p>
                </div>
                <button type="button" onClick={() => setShowSeo(v => !v)}
                  className="mt-4 text-[11px] font-[Manrope] font-bold uppercase tracking-widest text-black border-b border-black pb-0.5 hover:text-[#006c49] hover:border-[#006c49] transition-colors">
                  {showSeo ? "Hide SEO Fields" : "Edit SEO Meta"}
                </button>
                {showSeo && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1">SEO Title</label>
                      <input className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-3 py-2 text-sm font-[Manrope] outline-none focus:border-black"
                        placeholder={`${form.title} | Luxe Boutique`}
                        value={form.seoTitle} onChange={e => setForm(f => ({ ...f, seoTitle: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#45464d] block mb-1">SEO Description</label>
                      <textarea className="w-full bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg px-3 py-2 text-sm font-[Manrope] outline-none focus:border-black resize-none"
                        rows={3} placeholder="Brief description for search engines…"
                        value={form.seoDescription} onChange={e => setForm(f => ({ ...f, seoDescription: e.target.value }))} />
                      <p className="text-[10px] font-[Manrope] text-[#7c839b] mt-1">{form.seoDescription.length}/160</p>
                    </div>
                  </div>
                )}
              </section>

              {/* Reading stats */}
              <section className="bg-white p-6 rounded-lg shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
                <h3 className="text-[11px] font-[Manrope] font-bold tracking-widest uppercase text-[#45464d] mb-4">Writing Stats</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Words", value: wordCount.toLocaleString() },
                    { label: "Read time", value: `~${readTime} min` },
                    { label: "Excerpt",  value: `${form.excerpt.length}/200` },
                    { label: "Tags", value: String(form.tags.length) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-[#f8f9ff] rounded-lg p-3">
                      <p className="text-[10px] font-[Manrope] font-bold uppercase tracking-widest text-[#7c839b]">{label}</p>
                      <p className="text-lg font-serif font-semibold text-[#0b1c30] mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
