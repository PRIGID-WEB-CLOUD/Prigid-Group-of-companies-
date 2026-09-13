import { Link } from "wouter";
import { motion, AnimatePresence } from "motion/react";
import ProductCard from "@/components/ProductCard";
import FeaturedProductSlider from "@/components/FeaturedProductSlider";
import NewsletterForm from "@/components/NewsletterForm";
import { useEffect, useState } from "react";
import { ArrowRight, Play, X } from "lucide-react";
import { SEO } from "@/components/SEO";

export default function HomePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [filmOpen, setFilmOpen] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setProducts(d); })
      .catch(() => {});
    fetch("/api/posts")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPosts(d.slice(0, 2)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFilmOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="bg-white selection:bg-slate-900 selection:text-white">
      <SEO
        title="LUXE BOUTIQUE | Luxury Fashion & Haute Couture"
        description="Explore the latest luxury runway collections, designer apparel, handcrafted leather goods, and fine accessories at LUXE BOUTIQUE."
      />
      <section className="relative h-[72vh] w-full flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop" alt="Hero" className="w-full h-full object-cover object-center" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-black/25" />
        </div>
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="space-y-6">
              <span className="text-white text-[10px] md:text-xs font-bold tracking-[0.4em] uppercase block">The Summer Atelier 2024</span>
              <h1 className="text-white text-5xl md:text-7xl font-serif leading-[1.1] tracking-tight">Architectural <br /><span className="italic font-light">Elegance</span></h1>
              <p className="text-white/80 text-base md:text-lg leading-relaxed max-w-sm font-light">Discover our latest release: A study in precision tailoring and sustainable silk fabrics.</p>
              <div className="pt-4 flex flex-wrap gap-4">
                <Link href="/products" className="bg-white text-slate-900 px-10 py-5 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all duration-500">
                  Explore Collection
                </Link>
                <button onClick={() => setFilmOpen(true)} className="flex items-center gap-3 text-white group">
                  <div className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center group-hover:bg-white group-hover:text-slate-900 transition-all duration-500">
                    <Play size={14} fill="currentColor" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Watch Film</span>
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-white">
        <div className="flex justify-between items-end mb-12">
          <div>
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.4em] mb-2 block">Curation</span>
            <h2 className="text-4xl font-serif text-slate-900 leading-tight">The <span className="italic font-light">Collections</span></h2>
          </div>
          <Link href="/products" className="text-[10px] font-bold uppercase tracking-widest border-b border-slate-900 pb-1">View All</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 h-auto md:h-[700px]">
          <Link href="/products?category=Monochrome" className="md:col-span-8 relative group overflow-hidden bg-slate-100">
            <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop" alt="Ready to Wear" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors" />
            <div className="absolute bottom-10 left-10 text-white">
              <h3 className="text-3xl font-serif mb-2">Monochrome Essentials</h3>
              <span className="text-[10px] font-bold uppercase tracking-widest border-b border-white pb-1">Explore</span>
            </div>
          </Link>
          <div className="md:col-span-4 flex flex-col gap-8">
            <Link href="/products?category=Accessories" className="flex-1 relative group overflow-hidden bg-slate-100">
              <img src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=2072&auto=format&fit=crop" alt="Accessories" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors" />
              <div className="absolute bottom-8 left-8 text-white">
                <h3 className="text-xl font-serif mb-1">Accessories</h3>
                <span className="text-[10px] font-bold uppercase tracking-widest border-b border-white pb-1">Shop</span>
              </div>
            </Link>
            <Link href="/products?category=Footwear" className="flex-1 relative group overflow-hidden bg-slate-100">
              <img src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?q=80&w=1974&auto=format&fit=crop" alt="Footwear" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors" />
              <div className="absolute bottom-8 left-8 text-white">
                <h3 className="text-xl font-serif mb-1">Footwear</h3>
                <span className="text-[10px] font-bold uppercase tracking-widest border-b border-white pb-1">Shop</span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex justify-between items-end">
            <div className="space-y-4">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.4em]">New In</span>
              <h2 className="text-4xl font-serif text-slate-900">Latest Arrivals</h2>
            </div>
            <div className="flex gap-2">
              <button className="w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center hover:bg-white transition-colors group"><ArrowRight size={18} className="rotate-180 group-hover:-translate-x-1 transition-transform" /></button>
              <button className="w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center hover:bg-white transition-colors group"><ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></button>
            </div>
          </div>
          <div className="flex gap-4 sm:gap-8 overflow-x-auto pb-8 snap-x no-scrollbar">
            {products.length > 0 ? products.slice(0, 6).map((p: any) => (
              <div key={p.id} className="min-w-[200px] sm:min-w-[280px] md:min-w-[320px] snap-start">
                <ProductCard id={p.id} name={p.name} price={p.price} imageUrl={p.imageUrl} category={p.category?.name || "Boutique"} />
              </div>
            )) : [1,2,3,4].map(i => <div key={i} className="min-w-[200px] sm:min-w-[280px] aspect-[3/4] bg-slate-200 animate-pulse rounded-lg" />)}
          </div>
        </div>
      </section>

      <section className="py-24 sm:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center space-y-4">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.6em]">Most Wanted</span>
            <h2 className="text-4xl sm:text-5xl font-serif text-slate-900 leading-tight tracking-tight">Trending <span className="italic font-light text-slate-400 text-5xl sm:text-6xl">Now</span></h2>
            <p className="text-slate-500 text-sm font-light max-w-md mx-auto">The most coveted silhouettes and iconic essentials of the season, hand-selected by our atelier.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {products.length > 0 ? products.slice(0, 9).map((p: any) => (
              <ProductCard key={p.id} id={p.id} name={p.name} price={p.price} imageUrl={p.imageUrl} category={p.category?.name || "Collection"} />
            )) : Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="space-y-4 animate-pulse">
                <div className="aspect-[3/4] bg-slate-100 rounded-sm" />
                <div className="h-4 bg-slate-100 w-3/4 rounded-xs" />
              </div>
            ))}
          </div>
          <div className="text-center pt-2">
            <Link href="/products" className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-900 hover:text-slate-600 transition-colors border-b-2 border-slate-900 pb-1">
              <span>View All Boutique Pieces</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* Auto-slidable One Full Card Product Showcase Section */}
      <FeaturedProductSlider products={products} autoSlideInterval={5000} />

      <AnimatePresence>
        {filmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
            onClick={() => setFilmOpen(false)}
          >
            <button
              onClick={() => setFilmOpen(false)}
              className="absolute top-6 right-6 z-10 w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full max-w-5xl aspect-video mx-6 relative"
              onClick={e => e.stopPropagation()}
            >
              <iframe
                src={`${import.meta.env.BASE_URL}luxe-film/`.replace(/\/+/g, "/")}
                className="w-full h-full border-0"
                allow="autoplay"
                title="LUXE BOUTIQUE Film"
              />
            </motion.div>
            <p className="absolute bottom-6 text-white/30 text-[10px] font-bold uppercase tracking-widest">Press ESC to close</p>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="py-32 overflow-hidden bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-24 items-center">
          <div className="relative">
            <div className="aspect-[3/4] md:aspect-square relative overflow-hidden shadow-2xl">
              <img
                src={posts[0]?.imageUrl || "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=2070&auto=format&fit=crop"}
                alt={posts[0]?.title || "Atelier Narrative"}
                className="w-full h-full object-cover" referrerPolicy="no-referrer"
              />
            </div>
            <motion.div initial={{ x: 50, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} viewport={{ once: true }}
              className="absolute -bottom-12 -right-12 bg-slate-900 p-12 hidden lg:block max-w-sm shadow-2xl">
              <p className="text-white font-serif text-2xl italic leading-snug mb-6">&ldquo;Sustainability isn&apos;t a trend, it&apos;s our heritage and future.&rdquo;</p>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">— Elena Rossi, Creative Director</p>
            </motion.div>
          </div>
          <div className="space-y-10">
            <div className="space-y-4">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.5em]">The Journal</span>
              <h2 className="text-5xl font-serif text-slate-900 leading-[1.1] tracking-tight">{posts[0]?.title || "The Modern Heritage"}</h2>
            </div>
            <p className="text-slate-600 text-lg font-light leading-relaxed">
              {posts[0]?.excerpt || "Every garment tells a story of longevity. We source our textiles from heritage mills in Italy and Japan, ensuring each thread meets the highest standards of environmental stewardship and timeless design."}
            </p>
            <div className="pt-4">
              <Link href={posts[0] ? `/blog/${posts[0].id}` : "/blog"} className="inline-flex items-center gap-4 group">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] border-b border-slate-900 pb-2">Read Article</span>
                <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all duration-300"><ArrowRight size={14} /></div>
              </Link>
            </div>
            <div className="pt-12 border-t border-slate-100"><NewsletterForm /></div>
          </div>
        </div>
      </section>
    </div>
  );
}
