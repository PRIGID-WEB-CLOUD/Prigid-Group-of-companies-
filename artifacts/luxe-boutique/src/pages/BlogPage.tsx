import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

type Post = {
  id: string; title: string; slug: string; excerpt: string;
  coverImage: string | null; category: string; author: string;
  status: string; publishedAt: string | null;
};

const CATEGORIES = ["All", "Editorial", "Heritage", "Sustainability", "Culture", "Craft", "Travel", "Style"];

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (res.ok) { setStatus("success"); setMessage(data.message || "Thank you!"); setEmail(""); }
      else { setStatus("error"); setMessage(data.error || "Failed"); }
    } catch { setStatus("error"); setMessage("An error occurred."); }
  };
  return (
    <div className="max-w-md mx-auto pt-4">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
        <input type="email" placeholder="EMAIL ADDRESS" value={email} onChange={e => setEmail(e.target.value)}
          disabled={status === "loading" || status === "success"}
          className="flex-1 bg-white border border-slate-100 rounded-full px-8 py-5 text-[10px] font-bold tracking-widest focus:ring-1 focus:ring-slate-900 transition-all outline-none disabled:opacity-50" required />
        <button type="submit" disabled={status === "loading" || status === "success"}
          className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-[0.3em] px-10 py-5 rounded-full hover:bg-slate-800 transition-all disabled:opacity-50">
          {status === "loading" ? "..." : "Join"}
        </button>
      </form>
      {message && <p className={`mt-4 text-[10px] font-bold uppercase tracking-widest ${status === "success" ? "text-emerald-600" : "text-rose-600"}`}>{message}</p>}
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row gap-16 items-center animate-pulse">
      <div className="w-full lg:w-1/2 aspect-[16/10] bg-slate-100 rounded-[2.5rem]" />
      <div className="w-full lg:w-1/2 space-y-6">
        <div className="flex gap-6"><div className="h-3 bg-slate-100 rounded w-20" /><div className="h-3 bg-slate-100 rounded w-24" /></div>
        <div className="h-10 bg-slate-100 rounded w-4/5" />
        <div className="space-y-2"><div className="h-4 bg-slate-100 rounded w-full" /><div className="h-4 bg-slate-100 rounded w-3/4" /></div>
      </div>
    </div>
  );
}

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState("All");

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["blog-posts"],
    queryFn: async () => {
      const res = await fetch("/api/posts");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const filtered = activeCategory === "All"
    ? posts
    : posts.filter(p => p.category === activeCategory);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="bg-white min-h-screen">
      {/* Hero */}
      <section className="bg-slate-50 py-32 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400 block mb-6">The Journal</span>
            <h1 className="text-5xl md:text-7xl font-serif text-slate-900 leading-tight mb-8 italic">
              Editorial <br /><span className="not-italic font-light">Perspectives</span>
            </h1>
            <p className="text-slate-500 font-medium max-w-xl text-xs leading-relaxed uppercase tracking-[0.3em] mx-auto">
              A CURATED DIARY OF STYLE, ARCHITECTURE, AND THE ART OF LIVING WELL.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Category filter */}
      <section className="border-b border-slate-100 sticky top-16 bg-white/95 backdrop-blur-md z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-none">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-5 py-4 text-[10px] font-bold uppercase tracking-[0.3em] whitespace-nowrap border-b-2 transition-all ${
                  activeCategory === cat
                    ? "text-slate-900 border-slate-900"
                    : "text-slate-400 border-transparent hover:text-slate-700 hover:border-slate-300"
                }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="space-y-32">
              <PostSkeleton />
              <PostSkeleton />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-32">
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-300 block mb-6">The Journal</span>
              <h2 className="text-3xl font-serif text-slate-400 italic mb-4">No posts yet</h2>
              <p className="text-slate-400 text-xs uppercase tracking-widest">
                {activeCategory !== "All" ? `No posts in ${activeCategory} — try another category.` : "Check back soon for editorial content."}
              </p>
            </div>
          ) : (
            <div className="space-y-32">
              {/* Featured (first post) — large */}
              {featured && (
                <motion.article
                  key={featured.id}
                  initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  className="flex flex-col lg:flex-row gap-16 items-center">
                  <div className="w-full lg:w-1/2">
                    <Link href={`/blog/${featured.slug}`}>
                      <div className="relative aspect-[16/10] overflow-hidden rounded-[2.5rem] shadow-2xl group cursor-pointer">
                        {featured.coverImage ? (
                          <img src={featured.coverImage} alt={featured.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-out"
                            referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                            <span className="text-slate-300 text-6xl font-serif italic">{featured.category}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  </div>
                  <div className="w-full lg:w-1/2 space-y-8">
                    <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                      <span>{featured.category}</span>
                      <span className="h-px w-8 bg-slate-200" />
                      <span>{fmtDate(featured.publishedAt)}</span>
                    </div>
                    <Link href={`/blog/${featured.slug}`}>
                      <h2 className="text-3xl md:text-4xl font-serif text-slate-900 leading-tight hover:text-emerald-800 transition-colors cursor-pointer">
                        {featured.title}
                      </h2>
                    </Link>
                    <p className="text-slate-500 text-sm leading-relaxed font-light max-w-lg">{featured.excerpt}</p>
                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                      <span>{featured.author}</span>
                    </div>
                    <div className="pt-4">
                      <Link href={`/blog/${featured.slug}`}>
                        <button className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-900 flex items-center gap-4 group">
                          Read Full Narrative
                          <div className="h-10 w-10 border border-slate-200 rounded-full flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all">
                            <ArrowRight size={14} />
                          </div>
                        </button>
                      </Link>
                    </div>
                  </div>
                </motion.article>
              )}

              {/* Remaining posts — alternating layout */}
              {rest.map((post, idx) => (
                <motion.article key={post.id}
                  initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  className={`flex flex-col ${idx % 2 === 0 ? "lg:flex-row-reverse" : "lg:flex-row"} gap-16 items-center`}>
                  <div className="w-full lg:w-1/2">
                    <Link href={`/blog/${post.slug}`}>
                      <div className="relative aspect-[16/10] overflow-hidden rounded-[2.5rem] shadow-xl group cursor-pointer">
                        {post.coverImage ? (
                          <img src={post.coverImage} alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-out"
                            referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                            <span className="text-slate-300 text-4xl font-serif italic">{post.category}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  </div>
                  <div className="w-full lg:w-1/2 space-y-6">
                    <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                      <span>{post.category}</span><span className="h-px w-8 bg-slate-200" /><span>{fmtDate(post.publishedAt)}</span>
                    </div>
                    <Link href={`/blog/${post.slug}`}>
                      <h2 className="text-2xl md:text-3xl font-serif text-slate-900 leading-tight hover:text-emerald-800 transition-colors cursor-pointer">
                        {post.title}
                      </h2>
                    </Link>
                    <p className="text-slate-500 text-sm leading-relaxed font-light max-w-lg">{post.excerpt}</p>
                    <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">{post.author}</div>
                    <Link href={`/blog/${post.slug}`}>
                      <button className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-900 flex items-center gap-4 group">
                        Read Full Narrative
                        <div className="h-10 w-10 border border-slate-200 rounded-full flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all">
                          <ArrowRight size={14} />
                        </div>
                      </button>
                    </Link>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Newsletter */}
      <section className="bg-slate-50 py-24 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-2xl mx-auto space-y-8">
            <h3 className="text-2xl font-serif text-slate-900">Subscribe for Priority <span className="italic">Insights</span></h3>
            <p className="text-slate-500 text-xs uppercase tracking-widest leading-loose">
              JOIN OUR PRIVATE LIST FOR EXCLUSIVE EDITORIAL CONTENT AND EARLY ACCESS TO NEW ARRIVALS.
            </p>
            <NewsletterSignup />
          </div>
        </div>
      </section>
    </div>
  );
}
