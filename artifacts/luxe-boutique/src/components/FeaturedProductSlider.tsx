import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight, ShoppingBag, Sparkles, Check, Pause, Play } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/contexts/CartContext";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=600&auto=format&fit=crop";

export interface FeaturedProduct {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  description?: string;
  category?: { name: string } | string;
  stock?: number;
  rating?: number;
  featured?: boolean;
}

interface FeaturedProductSliderProps {
  products: FeaturedProduct[];
  autoSlideInterval?: number; // ms
}

export default function FeaturedProductSlider({ products, autoSlideInterval = 5000 }: FeaturedProductSliderProps) {
  const { formatPrice } = useCurrency();
  const { refreshCart } = useCart();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Take top products for spotlight slider
  const items = products.length > 0 ? products.slice(0, 6) : [];
  const activeProduct = items[currentIndex] || null;

  // Auto slide timer & progress bar
  useEffect(() => {
    if (items.length <= 1 || isPaused || isHovered) {
      return;
    }

    const intervalStep = 50; // update progress every 50ms
    const totalSteps = autoSlideInterval / intervalStep;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      setProgress((currentStep / totalSteps) * 100);

      if (currentStep >= totalSteps) {
        currentStep = 0;
        setProgress(0);
        setCurrentIndex((prev) => (prev + 1) % items.length);
      }
    }, intervalStep);

    progressTimerRef.current = interval;

    return () => {
      clearInterval(interval);
    };
  }, [items.length, currentIndex, isPaused, isHovered, autoSlideInterval]);

  const handleNext = () => {
    setProgress(0);
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const handlePrev = () => {
    setProgress(0);
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleSelectIndex = (idx: number) => {
    setProgress(0);
    setCurrentIndex(idx);
  };

  const handleQuickAdd = async (product: FeaturedProduct) => {
    if (!product || addingId) return;
    setAddingId(product.id);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      if (res.ok) {
        await refreshCart();
        setAddedId(product.id);
        setTimeout(() => setAddedId(null), 2000);
      }
    } catch {
      // ignore
    } finally {
      setAddingId(null);
    }
  };

  if (!items.length || !activeProduct) {
    return null;
  }

  const categoryName = typeof activeProduct.category === "string"
    ? activeProduct.category
    : activeProduct.category?.name || "Boutique";

  return (
    <section
      id="spotlight-product-slider"
      className="py-6 sm:py-8 bg-slate-50/70 border-b border-slate-200/60 selection:bg-slate-900 selection:text-white"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="max-w-2xl mx-auto px-4">
        {/* Sleek Compact Header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 text-white rounded text-[9px] font-bold uppercase tracking-wider font-[Manrope]">
              <Sparkles size={10} className="text-amber-300" />
              Spotlight
            </span>
            <span className="text-[11px] font-serif text-slate-500 italic">
              Auto-Showcase
            </span>
          </div>

          {/* Compact Navigation Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsPaused((prev) => !prev)}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              title={isPaused ? "Resume auto slide" : "Pause auto slide"}
              aria-label={isPaused ? "Resume auto-sliding" : "Pause auto-sliding"}
            >
              {isPaused ? <Play size={11} className="fill-current text-amber-500" /> : <Pause size={11} />}
            </button>

            <div className="flex items-center bg-white border border-slate-200 rounded-full px-1 py-0.5 shadow-2xs">
              <button
                onClick={handlePrev}
                className="w-5 h-5 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-all"
                aria-label="Previous"
              >
                <ChevronLeft size={12} />
              </button>
              <span className="text-[10px] font-mono px-1 text-slate-400">
                {currentIndex + 1}/{items.length}
              </span>
              <button
                onClick={handleNext}
                className="w-5 h-5 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-all"
                aria-label="Next"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Petite Landscape Single Product Card */}
        <div className="relative bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-sm transition-shadow">
          {/* Subtle Progress Bar */}
          <div className="h-[2px] w-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-slate-900 transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeProduct.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex items-center p-3 sm:p-4 gap-3.5 sm:gap-4"
            >
              {/* Product Visual - Petite Thumbnail */}
              <Link
                href={`/products/${activeProduct.id}`}
                className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-lg bg-slate-100 shrink-0 overflow-hidden group border border-slate-100"
              >
                <img
                  src={activeProduct.imageUrl || FALLBACK_IMAGE}
                  alt={activeProduct.name}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== FALLBACK_IMAGE) target.src = FALLBACK_IMAGE;
                  }}
                />
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/75 backdrop-blur-xs text-white text-[8px] font-bold uppercase tracking-wider rounded-xs pointer-events-none">
                  {categoryName}
                </span>
              </Link>

              {/* Product Details & Actions */}
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 space-y-1.5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/products/${activeProduct.id}`}
                      className="font-serif text-sm sm:text-base font-semibold text-slate-900 hover:text-slate-600 transition-colors truncate block"
                    >
                      {activeProduct.name}
                    </Link>
                    <span className="text-sm font-serif font-bold text-slate-900 shrink-0">
                      {formatPrice(activeProduct.price)}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 font-light line-clamp-1 leading-snug mt-0.5">
                    {activeProduct.description || "Artisanal signature silhouette tailored for effortless boutique luxury."}
                  </p>
                </div>

                {/* Bottom Actions Row */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/products/${activeProduct.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-white hover:bg-slate-800 text-[10px] font-bold uppercase tracking-wider rounded transition-colors font-[Manrope]"
                    >
                      <span>View</span>
                      <ArrowRight size={10} />
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleQuickAdd(activeProduct)}
                      disabled={addingId === activeProduct.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 hover:border-slate-300 text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded transition-colors font-[Manrope] bg-white"
                    >
                      {addedId === activeProduct.id ? (
                        <>
                          <Check size={11} className="text-emerald-600" />
                          <span className="text-emerald-700">Added</span>
                        </>
                      ) : addingId === activeProduct.id ? (
                        <span>Adding...</span>
                      ) : (
                        <>
                          <ShoppingBag size={11} />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Dot Indicators */}
                  <div className="flex items-center gap-1">
                    {items.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectIndex(idx)}
                        className={`h-1 rounded-full transition-all ${
                          idx === currentIndex
                            ? "w-3.5 bg-slate-900"
                            : "w-1 bg-slate-200 hover:bg-slate-400"
                        }`}
                        aria-label={`Slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
