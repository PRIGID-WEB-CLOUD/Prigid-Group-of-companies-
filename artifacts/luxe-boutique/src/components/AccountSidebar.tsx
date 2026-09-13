import { Link, useLocation } from "wouter";
import { User, Package, MapPin, Heart, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { name: "Overview", href: "/account", icon: User },
  { name: "Orders", href: "/account/orders", icon: Package },
  { name: "Wishlist", href: "/account/wishlist", icon: Heart },
  { name: "Addresses", href: "/account/addresses", icon: MapPin },
  { name: "Settings", href: "/account/settings", icon: Settings },
];

export default function AccountSidebar() {
  const [pathname] = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside className="lg:col-span-1">
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 sticky top-28">
        <div className="px-4 py-6 mb-4 border-b border-slate-50">
          <h2 className="text-xl font-serif text-slate-900 leading-tight">Account Overview</h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-1">Premium Member</p>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 ${isActive ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
                <Icon size={18} />
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 pt-4 border-t border-slate-50">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-50 transition-all font-medium text-sm">
            <LogOut size={18} /><span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
