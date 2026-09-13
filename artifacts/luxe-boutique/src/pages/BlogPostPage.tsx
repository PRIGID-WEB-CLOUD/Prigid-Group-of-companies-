import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";

type Post = {
  id: string; title: string; slug: string; excerpt: string; content: string;
  coverImage: string | null; category: string; author: string;
  status: string; tags: string | null; seoTitle: string | null;
  seoDescription: string | null; publishedAt: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase();
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// Minimal markdown renderer — handles the formatting toolbar's output
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  const inlineFormat = (s: string) => {
    // Bold, italic, code, links
    return s
      .replace(/\*\*(.+?)\*\*/g, (_, m) => `<strong>${m}</strong>`)
      .replace(/_(.+?)_/g, (_, m) => `<em>${m}</em>`)
      .replace(/`(.+?)`/g, (_, m) => `<code class="bg-slate-100 px-1 rounded text-sm font-mono">${m}</code>`)
      .replace(/\[(.+?)\]\((.+?)\)/g, (_, t, u) => `<a href="${u}" class="underline text-emerald-700 hover:text-emerald-900">${t}</a>`);
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-4xl font-serif font-bold text-slate-900 mt-10 mb-4 leading-tight">{line.slice(2)}</h1>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-2xl font-serif font-semibold text-slate-900 mt-8 mb-3">{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-xl font-serif font-semibold text-slate-800 mt-6 mb-2">{line.slice(4)}</h3>);
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="border-l-4 border-slate-900 pl-6 my-6 italic text-slate-600 text-lg font-serif">
          {line.slice(2)}
        </blockquote>
      );
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} className="my-10 border-slate-200" />);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [line.slice(2)];
      while (i + 1 < lines.length && (lines[i + 1].startsWith("- ") || lines[i + 1].startsWith("* "))) {
        i++;
        items.push(lines[i].slice(2));
      }
      elements.push(
        <ul key={i} className="list-disc list-inside space-y-1.5 my-4 text-slate-700">
          {items.map((item, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
          ))}
        </ul>
      );
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [line.replace(/^\d+\. /, "")];
      while (i + 1 < lines.length && /^\d+\. /.test(lines[i + 1])) {
        i++;
        items.push(lines[i].replace(/^\d+\. /, ""));
      }
      elements.push(
        <ol key={i} className="list-decimal list-inside space-y-1.5 my-4 text-slate-700">
          {items.map((item, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
          ))}
        </ol>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-4" />);
    } else {
      elements.push(
        <p key={i} className="text-slate-700 leading-relaxed text-[17px]"
          dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
      );
    }
    i++;
  }
  return elements;
}

export default function BlogPostPage() {
  const slug = typeof window !== "undefined" ? window.location.pathname.split("/blog/")[1] : "";

  const { data: post, isLoading, isError } = useQuery<Post>({
    queryKey: ["blog-post-public", slug],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${slug}`);
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const { data: allPosts = [] } = useQuery<Post[]>({
    queryKey: ["blog-posts"],
    queryFn: async () => {
      const res = await fetch("/api/posts");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const related = allPosts.filter(p => p.slug !== slug && p.category === post?.category).slice(0, 2);

  if (isLoading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="animate-pulse text-slate-300 font-serif text-2xl italic">Loading narrative…</div>
    </div>
  );

  if (isError || !post) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-serif text-slate-300 italic">Post not found</h1>
      <Link href="/blog">
        <button className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-900 hover:text-emerald-700 transition-colors">
          <ArrowLeft size={14} /> Back to Journal
        </button>
      </Link>
    </div>
  );

  const tags = (() => { try { return post.tags ? JSON.parse(post.tags) : []; } catch { return []; } })();
  const wc = wordCount(post.content);
  const readTime = Math.max(1, Math.ceil(wc / 200));

  return (
    <div className="bg-white min-h-screen">
      {/* Cover */}
      {post.coverImage && (
        <div className="relative w-full aspect-video md:aspect-[21/9] overflow-hidden">
          <img src={post.coverImage} alt={post.title}
            className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </div>
      )}

      {/* Article */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Back */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-10">
          <Link href="/blog">
            <button className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 hover:text-slate-900 transition-colors">
              <ArrowLeft size={12} /> The Journal
            </button>
          </Link>
        </motion.div>

        {/* Meta */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
              {post.category}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">{fmtDate(post.publishedAt)}</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">· {readTime} min read</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-slate-900 leading-tight mb-6">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="text-xl text-slate-500 font-light leading-relaxed mb-8 border-l-4 border-slate-100 pl-6">
              {post.excerpt}
            </p>
          )}

          <div className="flex items-center gap-4 pb-10 border-b border-slate-100">
            <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {post.author?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-900">{post.author}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Contributing Editor</p>
            </div>
          </div>
        </motion.div>

        {/* Body */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="mt-10 space-y-2">
          {post.content
            ? renderMarkdown(post.content)
            : <p className="text-slate-400 italic text-center py-16">No content yet.</p>
          }
        </motion.div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-12 pt-8 border-t border-slate-100 flex flex-wrap gap-2">
            {tags.map((tag: string) => (
              <span key={tag} className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 border border-slate-200 px-3 py-1.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Share */}
        <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Share This Story</p>
          <div className="flex items-center gap-3">
            {["Twitter / X", "Copy Link"].map(platform => (
              <button key={platform}
                onClick={() => {
                  if (platform === "Copy Link") navigator.clipboard.writeText(window.location.href);
                }}
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 border border-slate-200 px-4 py-2 rounded-full hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all">
                {platform}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="bg-slate-50 py-20 border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400 mb-10 text-center">More From The Journal</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {related.map(p => (
                <Link key={p.id} href={`/blog/${p.slug}`}>
                  <motion.article whileHover={{ y: -4 }} className="group cursor-pointer">
                    <div className="aspect-[16/9] overflow-hidden rounded-2xl mb-5">
                      {p.coverImage ? (
                        <img src={p.coverImage} alt={p.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                          <span className="text-slate-400 font-serif italic">{p.category}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                      <span>{p.category}</span><span className="h-px w-6 bg-slate-200" /><span>{fmtDate(p.publishedAt)}</span>
                    </div>
                    <h3 className="text-xl font-serif text-slate-900 leading-tight group-hover:text-emerald-800 transition-colors">{p.title}</h3>
                    <p className="mt-2 text-slate-500 text-sm font-light line-clamp-2">{p.excerpt}</p>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-900">
                      Read More <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </motion.article>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
