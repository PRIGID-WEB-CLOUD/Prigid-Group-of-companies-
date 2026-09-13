import { motion } from "motion/react";

const pillars = [
  { title: "Material Integrity", content: "We source exclusively from certified organic or recycled fibers. Our silk is GOTS certified, and our leather is a byproduct of ethical agricultural practices, treated with vegetable tanning processes to eliminate toxic chromium runoff." },
  { title: "Radical Transparency", content: "Every garment in our collection is traceable. From the cooperative farms in Italy to our solar-powered atelier in London, we maintain strict oversight of social and environmental conditions." },
  { title: "Circular Longevity", content: "Design for eternity. Our architectural approach to construction ensures that every piece is built to withstand generations. We offer a lifetime repair service to extend the lifecycle of your investment pieces." },
];

export default function SustainabilityPage() {
  return (
    <div className="bg-white min-h-screen">
      <section className="relative h-[60vh] w-full flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=2013&auto=format&fit=crop" alt="Sustainability" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" />
        </div>
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-3xl mx-auto text-white">
            <span className="text-[10px] font-bold tracking-[0.6em] uppercase block mb-8">The Slow Movement</span>
            <h1 className="text-6xl md:text-8xl font-serif leading-tight mb-8">Conscious <br /><span className="italic font-light">Heritage</span></h1>
          </motion.div>
        </div>
      </section>
      <section className="py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-32 space-y-8">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400">Our Manifesto</h2>
            <p className="text-xl md:text-2xl font-serif text-slate-900 leading-relaxed italic">&quot;We do not inherit the earth from our ancestors; we borrow it from our children. Luxury is the ultimate expression of care for the world we inhabit.&quot;</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            {pillars.map((pillar, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }} className="space-y-6 border-t-2 border-slate-900 pt-8">
                <h3 className="text-xl font-serif text-slate-900">{pillar.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{pillar.content}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
