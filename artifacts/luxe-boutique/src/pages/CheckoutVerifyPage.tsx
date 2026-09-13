import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { trackMetaEvent } from "@/components/MetaPixelTracker";
import { useCart } from "@/contexts/CartContext";

export default function CheckoutVerifyPage() {
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const { refreshCart } = useCart();

  useEffect(() => {
    const params         = new URLSearchParams(window.location.search);
    const reference      = params.get("reference") || params.get("trxref") || params.get("session_id") || params.get("tx_ref");
    const provider       = params.get("provider") || "";

    if (!reference) { setStatus("failed"); return; }

    const run = async () => {
      try {
        // The server verifies the gateway response and atomically creates the paid order.
        const verifyRes  = await fetch(`/api/payments/verify/${encodeURIComponent(reference)}?${params.toString()}`);
        const verifyData = await verifyRes.json();

        if (!verifyRes.ok || !verifyData.status || !verifyData.order) { setStatus("failed"); return; }
        setOrderRef(verifyData.order.id?.slice(0, 8).toUpperCase() ?? null);
        
        // Track Purchase
        if (verifyData.order) {
          trackMetaEvent("Purchase", {
            content_ids: verifyData.order.items?.map((i: any) => i.productId),
            content_type: "product",
            value: Number(verifyData.order.total),
            currency: "EUR",
            num_items: verifyData.order.items?.length,
            transaction_id: verifyData.order.id
          }, {
            email: verifyData.order.customerEmail
          });
        }

        await fetch("/api/cart", { method: "DELETE" });
        await refreshCart();

        // Clear checkout-only client state after the server confirms the order.
        sessionStorage.removeItem("checkout_shipping");
        sessionStorage.removeItem("checkout_coupon");
        sessionStorage.removeItem("checkout_discount");
        sessionStorage.removeItem("checkout_email");

        setStatus("success");
      } catch {
        setStatus("failed");
      }
    };

    run();
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto text-slate-400 animate-spin" size={40} />
          <p className="text-xs tracking-widest uppercase text-slate-400 font-bold">Verifying your payment…</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-emerald-600" size={44} />
          </div>
          <h1 className="font-serif text-4xl text-slate-900 mb-3">Order Confirmed</h1>
          {orderRef && (
            <p className="text-xs tracking-widest uppercase text-slate-400 mb-2">
              Order #{orderRef}
            </p>
          )}
          <p className="text-slate-500 mb-2">
            Thank you for your purchase. Your order has been received and is being prepared with the utmost care.
          </p>
          <p className="text-xs tracking-widest uppercase text-slate-400 mb-10">
            A confirmation will be sent to your email shortly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/account/orders">
              <button className="px-8 py-4 bg-slate-900 text-white text-xs tracking-widest uppercase font-bold hover:bg-emerald-700 transition-colors">
                View Orders
              </button>
            </Link>
            <Link href="/products">
              <button className="px-8 py-4 border border-slate-200 text-xs tracking-widest uppercase font-bold hover:bg-slate-50 transition-colors">
                Continue Shopping
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
          <XCircle className="text-red-500" size={44} />
        </div>
        <h1 className="font-serif text-4xl text-slate-900 mb-3">Payment Failed</h1>
        <p className="text-slate-500 mb-10">
          We could not verify your payment. No charge has been made. Please try again or contact our support team.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/checkout">
            <button className="px-8 py-4 bg-slate-900 text-white text-xs tracking-widest uppercase font-bold hover:bg-emerald-700 transition-colors">
              Try Again
            </button>
          </Link>
          <Link href="/contact">
            <button className="px-8 py-4 border border-slate-200 text-xs tracking-widest uppercase font-bold hover:bg-slate-50 transition-colors">
              Contact Support
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
