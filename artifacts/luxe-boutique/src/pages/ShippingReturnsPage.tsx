import { motion } from "motion/react";

const sections = [
  { title: "Complimentary Shipping", content: "Luxe Boutique offers complimentary express shipping on all orders over $500. For orders below this threshold, a flat rate of $25 applies for standard delivery and $45 for priority express." },
  { title: "Global Distribution", content: "We deliver to over 150 countries worldwide. Our logistics partners include DHL Express and FedEx Priority to ensure your purchase arrives in perfect architectural condition." },
  { title: "Concierge Returns", content: "If your selection does not perfectly align with your expectations, we offer a 14-day return period. Items must be in original, unworn condition with all security tags intact." },
  { title: "Exchanges", content: "To facilitate a seamless experience, we offer one complimentary exchange per order for size or color variations within the same silhouette." },
];

export default function ShippingReturnsPage() {
  return (
    <div className="bg-white min-h-screen">
      <section className="bg-slate-50 py-32 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl space-y-6">
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400 block">Customer Care</span>
            <h1 className="text-5xl font-serif text-slate-900">Shipping & <span className="italic font-light">Returns</span></h1>
          </motion.div>
        </div>
      </section>
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {sections.map((section, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-4 border-b border-slate-100 pb-12 last:border-0">
              <h2 className="text-2xl font-serif text-slate-900">{section.title}</h2>
              <p className="text-slate-600 leading-relaxed">{section.content}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
