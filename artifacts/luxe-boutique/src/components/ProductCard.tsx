import { Link } from "wouter";
import { motion } from "motion/react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  category: string;
}

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=800&auto=format&fit=crop";

export default function ProductCard({ id, name, price, imageUrl, category }: ProductCardProps) {
  const { formatPrice } = useCurrency();
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -5 }} className="group cursor-pointer w-full overflow-hidden">
      <Link href={`/products/${id}`} className="block w-full overflow-hidden space-y-2 sm:space-y-3">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-white shadow-xs ring-1 ring-slate-100/80 rounded-xs">
          <img
            src={imageUrl || FALLBACK_IMAGE}
            alt={name}
            className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src !== FALLBACK_IMAGE) target.src = FALLBACK_IMAGE;
            }}
          />
          {/* Category Badge on Image Card */}
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-white/95 backdrop-blur-xs px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-slate-900 border border-slate-200/80 shadow-xs max-w-[85%] truncate z-10">
            {category || "Boutique"}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-1.5 sm:p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-500 bg-slate-900/90 text-white text-center">
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest">Discover More</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-0.5 sm:gap-2 w-full overflow-hidden min-w-0">
          <h3 className="text-[9px] sm:text-[11px] font-medium text-slate-900 group-hover:text-slate-600 transition-colors uppercase tracking-wider truncate min-w-0 flex-1">{name}</h3>
          <span className="text-[9px] sm:text-[11px] font-bold text-slate-900 whitespace-nowrap shrink-0">{formatPrice(price)}</span>
        </div>
      </Link>
    </motion.div>
  );
}
