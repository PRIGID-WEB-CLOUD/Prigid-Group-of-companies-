import { Link, useLocation } from "wouter";
import { ShoppingBag, User, Search, Menu, X, Globe, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useBranding } from "@/contexts/BrandingContext";

export default function Header() {
  const { user } = useAuth();
  const { cartCount } = useCart();
  const { currencyCode, setCurrency, currencies } = useCurrency();
  const { branding, activeSlug } = useBranding();
  const [location, navigate] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);

  const activeCurrency = currencies.find(c => c.code === currencyCode) || currencies[0];
  const homeHref = "/";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearchOpen(false);
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery("");
    }
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(event.target as Node)) {
        setIsCurrencyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className={`fixed top-0 w-full z-50 transition-all duration-500 ${isScrolled ? "bg-white/80 backdrop-blur-xl border-b border-slate-100 py-4" : "bg-transparent py-8"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <Link href={homeHref} className={`text-xl md:text-2xl font-serif tracking-[0.3em] uppercase transition-colors duration-500 ${isScrolled ? "text-slate-900" : "text-white"}`}>
          {branding.brand_logo_text || "LUXE"}
        </Link>

        <nav className="hidden md:flex items-center space-x-12">
          {[
            { label: "Collections", href: "/products" },
            { label: "New Arrivals", href: "/products?new=true" },
            { label: "Journal", href: "/blog" },
            { label: "Heritage", href: "/sustainability" }
          ].map((item) => (
            <Link key={item.label} href={item.href}
              className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-500 hover:opacity-50 ${isScrolled ? "text-slate-900" : "text-white"}`}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={`flex items-center space-x-6 md:space-x-8 transition-colors duration-500 ${isScrolled ? "text-slate-900" : "text-white"}`}>
          {/* Currency Selector */}
          <div className="relative" ref={currencyDropdownRef}>
            <button
              onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
              className="flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider hover:opacity-75 transition-opacity"
              title="Change currency"
            >
              <span>{activeCurrency.flag}</span>
              <span>{activeCurrency.code}</span>
              <ChevronDown size={12} className={`transition-transform duration-200 ${isCurrencyDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {isCurrencyDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-8 w-48 bg-white border border-slate-100 shadow-xl rounded-md overflow-hidden py-1 z-50 text-slate-900"
                >
                  <div className="px-3 py-1.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-50">
                    Select Currency
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1">
                    {currencies.map((curr) => (
                      <button
                        key={curr.code}
                        onClick={() => {
                          setCurrency(curr.code);
                          setIsCurrencyDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors ${
                          curr.code === currencyCode ? "bg-slate-50 font-semibold text-slate-900" : "text-slate-600"
                        }`}
                      >
                        <span className="flex items-center space-x-2">
                          <span>{curr.flag}</span>
                          <span>{curr.code}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{curr.symbol}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {location !== "/" && location !== "" && (
            <div className="relative">
              <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="hover:opacity-50 transition-opacity">
                <Search size={18} strokeWidth={1.5} />
              </button>
              <AnimatePresence>
                {isSearchOpen && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 top-10 w-64 bg-white p-2 rounded shadow-lg border border-slate-100">
                    <form onSubmit={handleSearch} className="flex items-center">
                      <input type="text" placeholder="Search collections..." autoFocus
                        className="w-full text-xs p-2 outline-none text-slate-900 placeholder:text-slate-400"
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                      <button type="submit" className="text-slate-400 hover:text-slate-900 px-2"><Search size={14} /></button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          <Link href="/cart" className="relative group">
            <ShoppingBag size={18} strokeWidth={1.5} />
            <span className="absolute -top-2 -right-2 text-[8px] bg-slate-900 text-white w-4 h-4 rounded-full flex items-center justify-center font-bold">{cartCount}</span>
          </Link>
          <Link href={user ? "/account" : "/login"} className="hidden sm:block hover:opacity-50 transition-opacity">
            <User size={18} strokeWidth={1.5} />
          </Link>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden">
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-slate-100 overflow-hidden">
            <div className="px-8 py-12 flex flex-col space-y-8">
              {[
                { label: "Collections", href: "/products" },
                { label: "New Arrivals", href: "/products?new=true" },
                { label: "Journal", href: "/blog" },
                { label: "Heritage", href: "/sustainability" }
              ].map((item) => (
                <Link key={item.label} href={item.href} onClick={() => setIsMobileMenuOpen(false)}
                  className="text-sm font-bold uppercase tracking-[0.3em] text-slate-900 border-b border-slate-50 pb-4">
                  {item.label}
                </Link>
              ))}

              {/* Mobile Currency Selector */}
              <div className="pt-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Display Currency</label>
                <div className="grid grid-cols-4 gap-2">
                  {currencies.map((curr) => (
                    <button
                      key={curr.code}
                      onClick={() => {
                        setCurrency(curr.code);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`py-2 px-1 text-center rounded text-xs border transition-colors flex flex-col items-center space-y-0.5 ${
                        curr.code === currencyCode ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"
                      }`}
                    >
                      <span className="text-sm">{curr.flag}</span>
                      <span className="font-bold text-[10px]">{curr.code}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex space-x-8 pt-4 border-t border-slate-100">
                <Link href={user ? "/account" : "/login"} onClick={() => setIsMobileMenuOpen(false)} className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Account</Link>
                <Link href="/cart" onClick={() => setIsMobileMenuOpen(false)} className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Bag</Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

