import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "motion/react";
import ProductCard from "@/components/ProductCard";
import { SEO } from "@/components/SEO";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [newOnly, setNewOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const categoryParam = params.get("category");
    const newParam = params.get("new");
    if (newParam === "true") setNewOnly(true);

    const fetchData = async () => {
      const productsUrl = newParam === "true" ? "/api/products?new=true" : "/api/products";
      const [resP, resC] = await Promise.all([fetch(productsUrl), fetch("/api/categories")]);
      const productsData = await resP.json();
      const categoriesData = await resC.json();
      setProducts(Array.isArray(productsData) ? productsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      if (categoryParam) {
        const found = categoriesData.find((c: any) => c.id === categoryParam || c.name.toLowerCase() === categoryParam.toLowerCase());
        if (found) setSelectedCategory(found.id);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const filteredProducts = selectedCategory === "all" ? products : products.filter((p: any) => p.categoryId === selectedCategory);

  return (
    <div className="bg-white min-h-screen">
      <SEO
        title={selectedCategory !== "all" ? `${categories.find(c => c.id === selectedCategory)?.name || "Collections"} — LUXE BOUTIQUE` : "Haute Couture Collections — LUXE BOUTIQUE"}
        description="Browse our complete catalog of designer clothing, luxury shoes, handcrafted accessories, and seasonal runway pieces."
      />
      <section className="relative h-[45vh] w-full flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop" alt="Collection Hero" className="w-full h-full object-cover object-center" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-black/40" />
        </div>
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-center text-white">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <span className="text-[10px] font-bold tracking-[0.5em] uppercase mb-6 block opacity-70">The Atelier</span>
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-serif leading-tight">The Collections</h1>
          </motion.div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {newOnly && (
          <div className="mb-8 text-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest">
              <span>✦</span> New Arrivals
            </span>
          </div>
        )}
        <div className="flex sm:flex-wrap gap-3 mb-12 justify-start sm:justify-center overflow-x-auto sm:overflow-visible pb-4 sm:pb-0 scrollbar-hide no-scrollbar">
          <button onClick={() => setSelectedCategory("all")} className={`px-6 py-3 text-[10px] font-bold uppercase tracking-widest border transition-all whitespace-nowrap ${selectedCategory === "all" ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:border-slate-900"}`}>
            All
          </button>
          {categories.map((c: any) => (
            <button key={c.id} onClick={() => setSelectedCategory(c.id)} className={`px-6 py-3 text-[10px] font-bold uppercase tracking-widest border transition-all whitespace-nowrap ${selectedCategory === c.id ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:border-slate-900"}`}>
              {c.name}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-8">
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="aspect-[3/4] bg-slate-100 animate-pulse" />)}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-8">
            {filteredProducts.map((p: any) => (
              <ProductCard key={p.id} id={p.id} name={p.name} price={p.price} imageUrl={p.imageUrl} category={p.category?.name || "Boutique"} />
            ))}
          </div>
        ) : (
          <div className="text-center py-32">
            <p className="text-slate-500 uppercase tracking-widest font-bold">No products found in this category.</p>
          </div>
        )}
      </section>
    </div>
  );
}
