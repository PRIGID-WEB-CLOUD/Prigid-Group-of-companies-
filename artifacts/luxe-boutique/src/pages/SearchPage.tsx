import { useEffect, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { trackMetaEvent } from "@/components/MetaPixelTracker";

export default function SearchPage() {
  const params = new URLSearchParams(window.location.search);
  const query = params.get("q") || "";
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/products?search=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then(data => {
        setProducts(Array.isArray(data) ? data : []);
        setLoading(false);
        
        // Track Search
        trackMetaEvent("Search", {
          search_string: query
        });
      })
      .catch(() => setLoading(false));
  }, [query]);

  return (
    <div className="bg-slate-50 min-h-[80vh] py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-16 text-center space-y-4">
          <h1 className="text-4xl font-serif text-slate-900 tracking-tight">Search Results</h1>
          {query ? <p className="text-slate-500 font-medium tracking-wide">Showing results for <span className="text-slate-900 font-bold italic">&quot;{query}&quot;</span></p>
            : <p className="text-slate-500 font-medium tracking-wide">Enter a search term to find products.</p>}
        </header>
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-slate-900"></div></div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-8">
            {products.map((p: any) => <ProductCard key={p.id} id={p.id} name={p.name} price={p.price} imageUrl={p.imageUrl} category={p.category?.name || "Boutique"} />)}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-slate-500 uppercase tracking-widest">No products found{query ? ` for "${query}"` : ""}.</p>
          </div>
        )}
      </div>
    </div>
  );
}
