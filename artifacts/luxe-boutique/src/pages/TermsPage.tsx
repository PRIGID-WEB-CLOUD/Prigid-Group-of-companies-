import { motion } from "motion/react";

const terms = [
  { title: "Service Paradigm", content: "Luxe Boutique provides a curated digital atelier for the acquisition of premium apparel. By engaging with our platform, you acknowledge your intent to interact with a high-fidelity commerce environment governed by architectural precision." },
  { title: "Intellectual Integrity", content: "All visual elements, silhouettes, and textual narratives displayed within this digital storefront are the exclusive property of Luxe Boutique. Reproduction or unauthorized digital extraction for commercial repurposing is strictly prohibited." },
  { title: "Purchase Governance", content: "Transactions are finalized upon receipt of payment confirmation from our secure processing partners. We reserve the right to decline order fulfillment in instances of anomalous inventory shifts or suspected identity discrepancy." },
  { title: "Liability & Limitations", content: "While we strive for absolute accuracy in digital representation, minor variations in material texture or pigment may occur. Our liability is restricted solely to the total transaction value of the acquired garment." },
  { title: "Governing Law", content: "These conditions are governed by the laws of the United Kingdom. Any legal discourse arising from the use of this atelier shall be addressed within the jurisdiction of London courts." },
];

export default function TermsPage() {
  return (
    <div className="bg-white min-h-screen">
      <section className="bg-slate-50 py-32 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400 block">Legal</span>
            <h1 className="text-5xl font-serif text-slate-900">Terms of <span className="italic font-light">Service</span></h1>
          </motion.div>
        </div>
      </section>
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {terms.map((term, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-4 border-b border-slate-100 pb-12 last:border-0">
              <h2 className="text-2xl font-serif text-slate-900">{term.title}</h2>
              <p className="text-slate-600 leading-relaxed">{term.content}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
