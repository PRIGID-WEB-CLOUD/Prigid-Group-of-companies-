import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <CartProvider>
          <CurrencyProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <div className="min-h-screen flex flex-col bg-white font-sans antialiased text-slate-900 selection:bg-slate-900 selection:text-white">
                <BrandingSynchronizer />
                <MetaPixelTracker />
                <Router />
                <CookieBanner />
              </div>
            </WouterRouter>
            <Toaster />
          </CurrencyProvider>
          </CartProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function BrandingSynchronizer() {
  useEffect(() => {
    fetch("/api/store/branding")
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
