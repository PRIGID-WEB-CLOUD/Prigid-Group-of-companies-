import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import AccountSidebar from "@/components/AccountSidebar";
import { MapPin } from "lucide-react";

export default function AccountAddressesPage() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const isCustomer = Boolean(user) && (!user?.role || ["CUSTOMER", "ADMIN", "SUPER_ADMIN"].includes(user.role.toUpperCase()));

  useEffect(() => {
    if (!loading && !user) navigate("/login");
    else if (!loading && user && !isCustomer) navigate("/");
  }, [user, loading, navigate, isCustomer]);

  if (loading || !user || !isCustomer) return null;

  return (
    <div className="pt-24 pb-16 px-4 max-w-7xl mx-auto">
      <div className="flex gap-12">
        <AccountSidebar />
        <div className="flex-1">
          <h1 className="font-serif text-3xl text-slate-900 mb-2">Saved Addresses</h1>
          <p className="text-slate-500 mb-8 text-sm">Manage your shipping destinations.</p>

          <div className="border border-dashed border-slate-200 rounded-lg py-16 text-center">
            <MapPin className="mx-auto text-slate-300 mb-4" size={40} />
            <p className="text-slate-500 text-sm mb-1">No saved addresses yet.</p>
            <p className="text-slate-400 text-xs">Addresses are saved automatically when you complete an order.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
