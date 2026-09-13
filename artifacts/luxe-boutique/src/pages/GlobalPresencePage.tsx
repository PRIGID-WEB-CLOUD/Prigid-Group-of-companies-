import { motion } from "motion/react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { MdLocationOn, MdSchedule, MdPhone, MdEmail, MdCheckCircleOutline } from "react-icons/md";

const STATIC_LOCATIONS = [
  {
    city: "London",
    title: "Mayfair Flagship Atelier",
    address: "124 Savile Row, Mayfair, London, W1S 3PR",
    hours: "Monday – Saturday: 10:00 AM – 7:00 PM | Sunday: By Appointment Only",
    phone: "+44 (0) 20 7946 0912",
    email: "mayfair@luxeboutique.com",
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200&auto=format&fit=crop",
    features: ["Private Bespoke Tailoring", "VIP Champagne Lounge", "Same-Day Courier Delivery", "Archival Collection Viewing"]
  },
  {
    city: "Paris",
    title: "Place Vendôme Showroom",
    address: "18 Place Vendôme, 75001 Paris, France",
    hours: "Monday – Saturday: 10:30 AM – 7:30 PM | Sunday: Closed",
    phone: "+33 1 42 68 55 00",
    email: "vendome@luxeboutique.com",
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1200&auto=format&fit=crop",
    features: ["Haute Joaillerie Salon", "Bespoke Fitting Suites", "Private Concierge Services", "Tax-Free Shopping Lounge"]
  },
  {
    city: "Milan",
    title: "Via Monte Napoleone Suite",
    address: "Via Monte Napoleone 8, 20121 Milano MI, Italy",
    hours: "Monday – Saturday: 10:00 AM – 7:00 PM | Sunday: Closed",
    phone: "+39 02 7600 1234",
    email: "milano@luxeboutique.com",
    image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=1200&auto=format&fit=crop",
    features: ["Leather Goods Personalization", "Private Style Consultation", "Seasonal Runway Preview", "Bespoke Monogramming"]
  },
  {
    city: "New York",
    title: "Madison Avenue Residence",
    address: "740 Madison Avenue, New York, NY 10065",
    hours: "Monday – Saturday: 10:00 AM – 6:30 PM | Sunday: 12:00 PM – 5:00 PM",
    phone: "+1 (212) 555-0198",
    email: "madison@luxeboutique.com",
    image: "https://images.unsplash.com/photo-1534430480872-3498386e7856?q=80&w=1200&auto=format&fit=crop",
    features: ["Penthouse Viewing Suite", "White-Glove Home Delivery", "Private Wardrobe Curator", "Collectors Club Lounge"]
  }
];

export default function GlobalPresencePage() {
  const [locations, setLocations] = useState<any[]>(STATIC_LOCATIONS);
  const [selectedLocation, setSelectedLocation] = useState(STATIC_LOCATIONS[0].city);
  const [bookingSubmitted, setBookingSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    location: STATIC_LOCATIONS[0].city,
    date: "",
    service: "Private Styling & Fitting",
    notes: ""
  });

  useEffect(() => {
    async function fetchLocations() {
      try {
        const res = await fetch("/api/showroom-locations");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const mapped = data.map((loc: any) => ({
              city: loc.city,
              title: loc.name,
              address: `${loc.address}, ${loc.city}, ${loc.country}`,
              hours: loc.hours || "Monday – Saturday: 10:00 AM – 7:00 PM | Sunday: By Appointment Only",
              phone: loc.phone || "+44 (0) 20 7946 0912",
              email: loc.email || "mayfair@luxeboutique.com",
              image: loc.imageUrl || "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?q=80&w=600&auto=format&fit=crop",
              features: [
                "Private Bespoke Tailoring",
                "VIP Champagne Lounge",
                "Same-Day Courier Delivery",
                "Archival Collection Viewing"
              ]
            }));
            setLocations(mapped);
            setSelectedLocation(mapped[0].city);
            setFormData(prev => ({ ...prev, location: mapped[0].city }));
          }
        }
      } catch (err) {
        console.warn("Failed to fetch locations, using pre-rendered fallback:", err);
      }
    }
    fetchLocations();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit booking request");
      }
      setBookingSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error reserving session. Please try again.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Hero Banner */}
      <section className="relative h-[65vh] w-full flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2000&auto=format&fit=crop"
            alt="LUXE Global Presence"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px]" />
        </div>
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl mx-auto text-white space-y-6"
          >
            <span className="text-[10px] font-bold tracking-[0.6em] uppercase block text-slate-300">
              International Ateliers & Showrooms
            </span>
            <h1 className="text-5xl md:text-7xl font-serif leading-tight">
              Global <span className="italic font-light">Presence</span>
            </h1>
            <p className="text-slate-300 text-xs uppercase tracking-[0.25em] font-medium max-w-xl mx-auto leading-relaxed">
              Experience the pinnacle of sartorial craftsmanship across our international private showrooms and flagship ateliers.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Locations Grid */}
      <section className="py-28 bg-slate-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400">Our Showrooms</span>
            <h2 className="text-3xl md:text-4xl font-serif text-slate-900">Flagship Destinations</h2>
            <p className="text-slate-500 text-sm font-light leading-relaxed">
              Every LUXE boutique is an architectural sanctuary designed to provide an intimate, personalized luxury shopping experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {locations.map((loc, idx) => (
              <motion.div
                key={loc.city}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white rounded-3xl overflow-hidden border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={loc.image}
                    alt={loc.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-full text-white text-[10px] font-bold uppercase tracking-widest">
                    {loc.city}
                  </div>
                </div>

                <div className="p-8 space-y-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="text-2xl font-serif text-slate-900">{loc.title}</h3>
                    
                    <div className="space-y-2.5 text-xs text-slate-600 font-medium leading-relaxed">
                      <div className="flex items-start gap-2.5">
                        <MdLocationOn className="text-slate-400 text-base shrink-0 mt-0.5" />
                        <span>{loc.address}</span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <MdSchedule className="text-slate-400 text-base shrink-0 mt-0.5" />
                        <span>{loc.hours}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <MdPhone className="text-slate-400 text-base shrink-0" />
                        <a href={`tel:${loc.phone}`} className="hover:text-slate-900 transition-colors">{loc.phone}</a>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <MdEmail className="text-slate-400 text-base shrink-0" />
                        <a href={`mailto:${loc.email}`} className="hover:text-slate-900 transition-colors">{loc.email}</a>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Atelier Services</h4>
                    <div className="flex flex-wrap gap-2">
                      {loc.features.map((feat: string) => (
                        <span
                          key={feat}
                          className="px-3 py-1 bg-slate-100 text-slate-700 text-[10px] font-semibold tracking-wider rounded-full uppercase"
                        >
                          {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Appointment Booking Section */}
      <section className="py-28 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400">Concierge Service</span>
            <h2 className="text-3xl md:text-4xl font-serif text-slate-900">Request a Private Appointment</h2>
            <p className="text-slate-500 text-sm font-light max-w-lg mx-auto leading-relaxed">
              Reserve an exclusive suite with our senior stylists and master tailors for a personalized fitting session.
            </p>
          </div>

          {bookingSubmitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-emerald-50 border border-emerald-200 rounded-3xl p-12 text-center space-y-4"
            >
              <MdCheckCircleOutline className="text-5xl text-emerald-600 mx-auto" />
              <h3 className="text-2xl font-serif text-emerald-950">Appointment Request Received</h3>
              <p className="text-emerald-800 text-sm max-w-md mx-auto leading-relaxed">
                Thank you, {formData.name || "valued guest"}. Our private concierge in {formData.location} will contact you shortly to confirm your scheduled time and prepare your private suite.
              </p>
              <div className="pt-4">
                <button
                  onClick={() => setBookingSubmitted(false)}
                  className="px-6 py-2.5 bg-emerald-900 text-white text-xs font-bold uppercase tracking-widest rounded-full hover:bg-emerald-950 transition-colors"
                >
                  Book Another Session
                </button>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-slate-50 p-8 sm:p-12 rounded-3xl border border-slate-200/80 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Lady / Lord / Mr / Ms..."
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-700 mb-2">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="client@luxury.com"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-700 mb-2">Phone / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+44 7911 123456"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-700 mb-2">Showroom Location *</label>
                  <select
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900 transition-colors"
                  >
                    {locations.map((loc) => (
                      <option key={loc.city} value={loc.city}>
                        {loc.city} ({loc.title})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-700 mb-2">Preferred Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-700 mb-2">Service Requested</label>
                <select
                  value={formData.service}
                  onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900 transition-colors"
                >
                  <option value="Private Styling & Fitting">Private Styling & Fitting</option>
                  <option value="Bespoke Tailoring Consultation">Bespoke Tailoring Consultation</option>
                  <option value="Haute Joaillerie Viewing">Haute Joaillerie Viewing</option>
                  <option value="Archival & Runway Collection Preview">Archival & Runway Collection Preview</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-700 mb-2">Special Requests / Notes</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Specific pieces of interest, dietary preferences for lounge service, or timing considerations..."
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900 transition-colors"
                />
              </div>

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                  {submitError}
                </div>
              )}

              <div className="pt-2 text-center">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-10 py-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-full text-xs font-bold uppercase tracking-[0.25em] transition-all shadow-md hover:shadow-lg cursor-pointer disabled:cursor-not-allowed"
                >
                  {submitting ? "Confirming with Concierge..." : "Request Private Appointment"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
