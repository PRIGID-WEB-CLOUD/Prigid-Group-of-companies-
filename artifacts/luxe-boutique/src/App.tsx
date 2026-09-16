import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { extractTenantFromHost, validateTenantSlug } from "@workspace/tenant-routing";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import CustomerGuard from "@/components/CustomerGuard";
import { MetaPixelTracker } from "@/components/MetaPixelTracker";
import HomePage from "@/pages/HomePage";
import ProductsPage from "@/pages/ProductsPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import CartPage from "@/pages/CartPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import BlogPage from "@/pages/BlogPage";
import BlogPostPage from "@/pages/BlogPostPage";
import CheckoutPage from "@/pages/CheckoutPage";
import CheckoutVerifyPage from "@/pages/CheckoutVerifyPage";
import SearchPage from "@/pages/SearchPage";
import ContactPage from "@/pages/ContactPage";
import GlobalPresencePage from "@/pages/GlobalPresencePage";
import StatusPage from "@/pages/StatusPage";
import SustainabilityPage from "@/pages/SustainabilityPage";
import PrivacyPage from "@/pages/PrivacyPage";
import TermsPage from "@/pages/TermsPage";
import ShippingReturnsPage from "@/pages/ShippingReturnsPage";
import AccountPage from "@/pages/AccountPage";
import OrdersPage from "@/pages/OrdersPage";
import WishlistPage from "@/pages/WishlistPage";
import AccountSettingsPage from "@/pages/AccountSettingsPage";
import AccountAddressesPage from "@/pages/AccountAddressesPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
    </>
  );
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-grow pt-24">{children}</main>
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <StoreLayout><HomePage /></StoreLayout>} />
      <Route path="/boutique/:slug" component={() => <StoreLayout><HomePage /></StoreLayout>} />
      <Route path="/store/:slug" component={() => <StoreLayout><HomePage /></StoreLayout>} />
      <Route path="/products" component={() => <StoreLayout><ProductsPage /></StoreLayout>} />
      <Route path="/products/:id" component={() => <StoreLayout><div className="pt-24"><ProductDetailPage /></div></StoreLayout>} />
      <Route path="/cart" component={() => <StoreLayout><div className="pt-24"><CartPage /></div></StoreLayout>} />
      <Route path="/checkout/verify" component={() => <StoreLayout><div className="pt-24"><CheckoutVerifyPage /></div></StoreLayout>} />
      <Route path="/checkout" component={() => <StoreLayout><div className="pt-24"><CheckoutPage /></div></StoreLayout>} />
      <Route path="/blog" component={() => <StoreLayout><BlogPage /></StoreLayout>} />
      <Route path="/blog/:slug" component={() => <StoreLayout><div className="pt-0"><BlogPostPage /></div></StoreLayout>} />
      <Route path="/search" component={() => <StoreLayout><div className="pt-24"><SearchPage /></div></StoreLayout>} />
      <Route path="/contact" component={() => <StoreLayout><ContactPage /></StoreLayout>} />
      <Route path="/global-presence" component={() => <StoreLayout><GlobalPresencePage /></StoreLayout>} />
      <Route path="/status" component={() => <StoreLayout><StatusPage /></StoreLayout>} />
      <Route path="/sustainability" component={() => <StoreLayout><SustainabilityPage /></StoreLayout>} />
      <Route path="/privacy" component={() => <StoreLayout><PrivacyPage /></StoreLayout>} />
      <Route path="/terms" component={() => <StoreLayout><TermsPage /></StoreLayout>} />
      <Route path="/shipping-returns" component={() => <StoreLayout><ShippingReturnsPage /></StoreLayout>} />
      <Route path="/account" component={() => <StoreLayout><CustomerGuard><AccountPage /></CustomerGuard></StoreLayout>} />
      <Route path="/account/orders" component={() => <StoreLayout><CustomerGuard><OrdersPage /></CustomerGuard></StoreLayout>} />
      <Route path="/account/wishlist" component={() => <StoreLayout><CustomerGuard><WishlistPage /></CustomerGuard></StoreLayout>} />
      <Route path="/account/settings" component={() => <StoreLayout><CustomerGuard><AccountSettingsPage /></CustomerGuard></StoreLayout>} />
      <Route path="/account/addresses" component={() => <StoreLayout><CustomerGuard><AccountAddressesPage /></CustomerGuard></StoreLayout>} />
      <Route path="/login" component={() => <AuthLayout><LoginPage /></AuthLayout>} />
      <Route path="/forgot-password" component={() => <AuthLayout><ForgotPasswordPage /></AuthLayout>} />
      <Route path="/reset-password" component={() => <AuthLayout><ResetPasswordPage /></AuthLayout>} />
      <Route path="/register" component={() => <AuthLayout><RegisterPage /></AuthLayout>} />
      <Route component={NotFound} />
    </Switch>
  );
}

function getActiveStoreSlug(): string | null {
  if (typeof window === "undefined") return null;
  const hostInfo = extractTenantFromHost(window.location.host);
  if (hostInfo.type === "subdomain" && hostInfo.slug && validateTenantSlug(hostInfo.slug)) {
    return hostInfo.slug;
  }
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("store") && validateTenantSlug(urlParams.get("store")!)) {
    return urlParams.get("store");
  }
  const match = window.location.pathname.match(/^\/(?:boutique|store)\/([a-zA-Z0-9_-]+)/);
  if (match && match[1] && validateTenantSlug(match[1])) return match[1];
  return null;
}

function PublicationGuard({ children }: { children: React.ReactNode }) {
  const [pathname] = useState(() => window.location.pathname);
  const [pubState, setPubState] = useState<{ isPublished: boolean; isAdmin: boolean; loaded: boolean }>({
    isPublished: true,
    isAdmin: false,
    loaded: false,
  });

  useEffect(() => {
    const slug = getActiveStoreSlug();
    if (slug) {
      document.cookie = `prigid_store_slug=${slug}; path=/; max-age=86400; SameSite=Lax`;
    }
    const query = slug ? `?store=${encodeURIComponent(slug)}` : "";
    fetch(`/api/store/branding${query}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load store metadata");
        return res.json();
      })
      .then((data) => {
        setPubState({
          isPublished: data.isPublished !== false,
          isAdmin: data.isAdmin === true,
          loaded: true,
        });
      })
      .catch(() => {
        setPubState(prev => ({ ...prev, loaded: true }));
      });
  }, []);

  if (!pubState.loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500 font-sans tracking-wide">LOADING ATELIER...</p>
        </div>
      </div>
    );
  }

  const canView = pubState.isPublished || pubState.isAdmin;

  if (!canView) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-[#FAF9F6] text-slate-900 font-sans">
        <div className="flex-grow flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto">
          {/* Elegant Lock Icon */}
          <div className="mb-8 p-5 bg-white rounded-full border border-slate-100 shadow-sm">
            <svg className="w-8 h-8 text-slate-800" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>

          <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold mb-3">Private Atelier</p>
          <h1 className="text-3xl md:text-4xl font-serif font-light tracking-wide text-slate-900 mb-4">
            Collection Under Curation
          </h1>
          <p className="text-slate-500 font-light leading-relaxed mb-8 text-base">
            This boutique is currently configuring its digital showroom and private collection. Access is restricted until the grand opening.
          </p>

          <div className="w-full h-[1px] bg-slate-200 mb-8" />

          <p className="text-xs text-slate-400">
            Are you the merchant?{" "}
            <a href="/admin" className="text-slate-900 underline font-medium hover:text-slate-700">
              Log in to your SaaS dashboard
            </a>{" "}
            to customize and publish.
          </p>
        </div>

        <div className="py-6 text-center text-xs text-slate-400 tracking-wider">
          POWERED BY <span className="font-semibold text-slate-600">PRIGID COMMERCE</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {!pubState.isPublished && pubState.isAdmin && (
        <div className="bg-amber-500 text-white text-xs font-semibold px-4 py-2 text-center flex items-center justify-center gap-2 tracking-wide shadow-sm select-none z-50">
          <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          PRIVATE PREVIEW MODE — Only you can view this storefront before publication.
          <a href="/admin" className="underline hover:text-amber-100 ml-2">Return to Dashboard</a>
        </div>
      )}
      {children}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <CartProvider>
          <CurrencyProvider>
          <BrandingProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <div className="min-h-screen flex flex-col bg-white font-sans antialiased text-slate-900 selection:bg-slate-900 selection:text-white">
                <BrandingSynchronizer />
                <MetaPixelTracker />
                <PublicationGuard>
                  <Router />
                </PublicationGuard>
                <CookieBanner />
              </div>
            </WouterRouter>
            <Toaster />
          </BrandingProvider>
          </CurrencyProvider>
          </CartProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function BrandingSynchronizer() {
  useEffect(() => {
    const slug = getActiveStoreSlug();
    if (slug) {
      document.cookie = `prigid_store_slug=${slug}; path=/; max-age=86400; SameSite=Lax`;
    }
    const query = slug ? `?store=${encodeURIComponent(slug)}` : "";
    fetch(`/api/store/branding${query}`)
      .then(res => {
        if (!res.ok) throw new Error("Branding endpoint not available");
        return res.json();
      })
      .then(data => {
        if (data.store_name) {
          document.title = data.store_name;
        }
        if (data.brand_primary_color) {
          const hex = data.brand_primary_color;
          document.documentElement.style.setProperty("--color-primary", hex);
          try {
            const hsl = hexToHslSpace(hex);
            document.documentElement.style.setProperty("--primary", hsl);
          } catch (e) {
            console.error("Failed to parse branding HSL:", e);
          }
        }
        if (data.brand_typography) {
          document.documentElement.style.setProperty("--app-font-serif", data.brand_typography);
        }
      })
      .catch(err => {
        console.log("[Branding] Default styles fallback active.", err);
      });
  }, []);

  return null;
}

function hexToHslSpace(hex: string): string {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map(c => c + c).join("");
  }
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default App;
