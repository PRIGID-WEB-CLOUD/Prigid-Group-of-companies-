import { motion } from "motion/react";

const policies = [
  { title: "Data Stewardship", content: "Luxe Boutique respects the sanctity of your private data. We collect information only as necessary to provide our bespoke services, including transaction processing, personalized styling invitations, and order logistics." },
  { title: "Security Infrastructure", content: "All sensitive data is protected via 256-bit SSL encryption. Payment information is processed through PCI DSS compliant gateways, ensuring that full credit card details are never stored on our operational servers." },
  { title: "Cookies & Experience", content: "We utilize precise cryptographic identifiers to maintain your preferences, bag persistence, and secure session management. You retain absolute control over these identifiers through your browser configuration." },
  { title: "Third-Party Disclosure", content: "We do not engage in the commercial exchange of user datasets. Information is only shared with trusted logistics and payment partners strictly for the facilitation of your purchase completion." },
  { title: "Your Rights", content: "In alignment with global privacy standards, you maintain the right to access, rectify, or request the erasure of your personal records from our database at any moment through your account dashboard." },
];

export default function PrivacyPage() {
  return (
    <div className="bg-white min-h-screen">
      <section className="bg-slate-50 py-32 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400 block">Privacy Policy</span>
            <h1 className="text-5xl font-serif text-slate-900">Data <span className="italic font-light">Stewardship</span></h1>
          </motion.div>
        </div>
      </section>
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {policies.map((policy, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-4 border-b border-slate-100 pb-12 last:border-0">
              <h2 className="text-2xl font-serif text-slate-900">{policy.title}</h2>
              <p className="text-slate-600 leading-relaxed">{policy.content}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
