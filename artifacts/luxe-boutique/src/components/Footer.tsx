import { Link } from "wouter";
import NewsletterForm from "./NewsletterForm";
import { useBranding } from "@/contexts/BrandingContext";

export default function Footer() {
  const { branding } = useBranding();

  return (
    <footer className="bg-slate-50 border-t border-slate-100 pt-32 pb-16 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-16 md:gap-8 pb-20 border-b border-slate-200">
          <div className="md:col-span-4 space-y-8">
            <h2 className="text-2xl font-serif tracking-[0.4em] uppercase text-slate-900">
              {branding.brand_logo_text || "LUXE"}
            </h2>
            <p className="text-sm text-slate-500 font-light leading-relaxed max-w-xs uppercase tracking-[0.1em]">
              {branding.brand_tagline || "Defining the landscape of modern luxury through conscious design, impeccable quality, and architectural precision."}
            </p>
            <div className="py-2"><NewsletterForm /></div>
            <div className="flex gap-6">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors">Instagram</a>
              <a href="https://pinterest.com" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors">Pinterest</a>
              <Link href="/blog" className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors">Journal</Link>
            </div>
          </div>
          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="space-y-8">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-900">Collections</h4>
              <ul className="space-y-4 text-[10px] text-slate-500 font-medium uppercase tracking-widest">
                <li><Link href="/products?category=Monochrome" className="hover:text-slate-900 transition-colors">Monochrome</Link></li>
                <li><Link href="/products?category=Accessories" className="hover:text-slate-900 transition-colors">Accessories</Link></li>
                <li><Link href="/products?category=Footwear" className="hover:text-slate-900 transition-colors">Footwear</Link></li>
                <li><Link href="/products" className="hover:text-slate-900 transition-colors">All Arrivals</Link></li>
              </ul>
            </div>
            <div className="space-y-8">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-900">Customer Care</h4>
              <ul className="space-y-4 text-[10px] text-slate-500 font-medium uppercase tracking-widest">
                <li><Link href="/shipping-returns" className="hover:text-slate-900 transition-colors">Shipping & Returns</Link></li>
                <li><Link href="/contact" className="hover:text-slate-900 transition-colors">Contact Us</Link></li>
                <li><Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-slate-900 transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
            <div className="space-y-8">
              <div className="h-[15px] hidden sm:block" /> {/* Visual spacer to align with adjacent headers */}
              <ul className="space-y-4 text-[10px] text-slate-500 font-medium uppercase tracking-widest">
                <li><Link href="/global-presence" className="hover:text-slate-900 transition-colors text-slate-900 font-bold">Global Presence</Link></li>
                <li><Link href="/sustainability" className="hover:text-slate-900 transition-colors">Sustainability</Link></li>
                <li><Link href="/blog" className="hover:text-slate-900 transition-colors">Editorial Journal</Link></li>
                <li><Link href="/contact" className="hover:text-slate-900 transition-colors">Private Appointments</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="pt-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-wrap items-center gap-8 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
            <span>© 2026 {branding.store_name || "LUXE BOUTIQUE"}</span>
            <span>All Rights Reserved</span>
            <span className="text-blue-600 tracking-[0.2em]">Powered by PRIGID GROUP</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/status" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600">All Systems Operational</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
