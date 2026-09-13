import { useState, useEffect, useCallback, useRef } from "react";
import AdminLayout from "./AdminLayout";
import { 
  MdLocationOn, 
  MdPhone, 
  MdEmail, 
  MdSchedule, 
  MdAdd, 
  MdEdit, 
  MdDelete, 
  MdClose, 
  MdCloudUpload,
  MdCheckCircle,
  MdCancel,
  MdRefresh,
  MdImage,
  MdLink,
  MdRestartAlt
} from "react-icons/md";

const API = "/api";

interface ShowroomLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  hours: string;
  imageUrl: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const EMPTY_FORM = {
  name: "",
  address: "",
  city: "",
  country: "",
  phone: "",
  email: "",
  hours: "",
  imageUrl: "",
  active: true,
};

export default function AdminShowroomsPage() {
  const [locations, setLocations] = useState<ShowroomLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<ShowroomLocation | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Local File Upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageTab, setImageTab] = useState<"upload" | "url">("upload");
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/admin/showroom-locations`);
      if (!res.ok) {
        throw new Error("Failed to load showroom locations");
      }
      const data = await res.json();
      setLocations(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleOpenAdd = () => {
    setEditingLoc(null);
    setFormData(EMPTY_FORM);
    setSubmitError(null);
    setImageUploadError(null);
    setImageTab("upload");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (loc: ShowroomLocation) => {
    setEditingLoc(loc);
    setFormData({
      name: loc.name,
      address: loc.address,
      city: loc.city,
      country: loc.country,
      phone: loc.phone || "",
      email: loc.email || "",
      hours: loc.hours || "",
      imageUrl: loc.imageUrl || "",
      active: loc.active,
    });
    setSubmitError(null);
    setImageUploadError(null);
    setImageTab(loc.imageUrl && loc.imageUrl.startsWith("http") && !loc.imageUrl.includes("/api/uploads") ? "url" : "upload");
    setIsModalOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setImageUploadError("Please select a valid image file (JPG, PNG, WEBP, GIF, SVG, AVIF).");
      return;
    }
    setIsUploadingImage(true);
    setImageUploadError(null);
    const bodyFormData = new FormData();
    bodyFormData.append("file", file);

    try {
      const res = await fetch(`${API}/upload`, {
        method: "POST",
        body: bodyFormData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload image.");
      }
      const uploadedUrl = data.url || data.urls?.[0];
      if (uploadedUrl) {
        setFormData(prev => ({ ...prev, imageUrl: uploadedUrl }));
      }
    } catch (err: any) {
      setImageUploadError(err.message || "Failed to upload file to local storage.");
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this showroom location?")) return;
    try {
      const res = await fetch(`${API}/admin/showroom-locations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete location");
      setLocations(prev => prev.filter(loc => loc.id !== id));
    } catch (err: any) {
      alert(err.message || "Error deleting location");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const endpoint = editingLoc 
      ? `${API}/admin/showroom-locations/${editingLoc.id}` 
      : `${API}/admin/showroom-locations`;
    const method = editingLoc ? "PUT" : "POST";

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save showroom location");
      }

      await fetchLocations();
      setIsModalOpen(false);
      setFormData(EMPTY_FORM);
      setEditingLoc(null);
    } catch (err: any) {
      setSubmitError(err.message || "Error saving location");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 p-1">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold tracking-[0.3em] text-[#006c49] uppercase">Global Network Management</span>
            <h1 className="text-3xl font-serif text-slate-900 mt-1">Showrooms & Ateliers</h1>
            <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
              Add, edit, or toggle visibility of your international boutiques, luxury salons, and fitting residences.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={fetchLocations}
              className="p-2.5 text-slate-500 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              title="Refresh Locations"
            >
              <MdRefresh className="text-xl" />
            </button>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold tracking-wider text-white bg-[#006c49] hover:bg-[#005237] rounded-xl transition-all shadow-sm uppercase"
            >
              <MdAdd className="text-base" /> Add Showroom
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Showrooms</span>
            <div className="text-3xl font-serif text-slate-900 mt-2">{locations.length}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Active Salons</span>
            <div className="text-3xl font-serif text-emerald-900 mt-2">
              {locations.filter(l => l.active).length}
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Archived / Inactive</span>
            <div className="text-3xl font-serif text-amber-900 mt-2">
              {locations.filter(l => !l.active).length}
            </div>
          </div>
        </div>

        {/* Showrooms Grid / Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#006c49] border-t-transparent" />
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-4">Loading Locations...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-red-50 rounded-2xl border border-red-100 text-red-800">
            <p className="text-sm font-medium">{error}</p>
            <button 
              onClick={fetchLocations}
              className="mt-4 px-4 py-2 bg-white text-red-800 border border-red-200 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors uppercase tracking-wider"
            >
              Try Again
            </button>
          </div>
        ) : locations.length === 0 ? (
          <div className="text-center py-24 bg-slate-50 rounded-2xl border border-slate-100">
            <MdLocationOn className="text-5xl text-slate-300 mx-auto" />
            <h3 className="text-lg font-serif text-slate-900 mt-4">No Showrooms Discovered</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
              Start expanding your luxurious international network by creating your first flagship showroom location.
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-6 px-5 py-2.5 bg-[#006c49] hover:bg-[#005237] text-white text-xs font-bold tracking-wider rounded-xl transition-all uppercase"
            >
              Add First Showroom
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {locations.map((loc) => (
              <div 
                key={loc.id} 
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between hover:border-slate-200 transition-all duration-300 group"
              >
                {/* Visual Cover */}
                <div className="relative h-44 bg-slate-100 overflow-hidden">
                  {loc.imageUrl ? (
                    <img 
                      src={loc.imageUrl} 
                      alt={loc.name} 
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-400">
                      <MdLocationOn className="text-4xl" />
                    </div>
                  )}
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest text-slate-800 shadow-sm">
                    {loc.city}
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-sm border ${
                      loc.active 
                        ? "bg-[#f0faf6] text-[#006c49] border-[#c3eed8]" 
                        : "bg-slate-100/90 text-slate-500 border-slate-200/50"
                    }`}>
                      {loc.active ? "Active" : "Archived"}
                    </span>
                  </div>
                </div>

                {/* Info and Actions */}
                <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="text-lg font-serif text-slate-900 leading-snug">{loc.name}</h3>
                    
                    <div className="space-y-2.5 text-xs text-slate-500 font-medium leading-relaxed">
                      <div className="flex items-start gap-2.5">
                        <MdLocationOn className="text-slate-400 text-base shrink-0 mt-0.5" />
                        <span>{loc.address}, {loc.city}, {loc.country}</span>
                      </div>
                      {loc.hours && (
                        <div className="flex items-start gap-2.5">
                          <MdSchedule className="text-slate-400 text-base shrink-0 mt-0.5" />
                          <span>{loc.hours}</span>
                        </div>
                      )}
                      {loc.phone && (
                        <div className="flex items-center gap-2.5">
                          <MdPhone className="text-slate-400 text-base shrink-0" />
                          <span>{loc.phone}</span>
                        </div>
                      )}
                      {loc.email && (
                        <div className="flex items-center gap-2.5">
                          <MdEmail className="text-slate-400 text-base shrink-0" />
                          <span>{loc.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 border-t border-slate-50 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenEdit(loc)}
                      className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all border border-slate-100"
                      title="Edit Showroom"
                    >
                      <MdEdit className="text-lg" />
                    </button>
                    <button
                      onClick={() => handleDelete(loc.id)}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all border border-slate-100"
                      title="Delete Showroom"
                    >
                      <MdDelete className="text-lg" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden flex flex-col justify-between">
              
              {/* Modal Header */}
              <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-lg font-serif text-slate-900">
                  {editingLoc ? "Refine Showroom Details" : "Establish New Showroom"}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <MdClose className="text-xl" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="p-8 space-y-5">
                {submitError && (
                  <div className="p-4 bg-red-50 border border-red-100 text-red-800 text-xs font-semibold rounded-xl">
                    {submitError}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Atelier Name *</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. The Paris Salon"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-slate-900 focus:outline-none bg-slate-50/50"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Street Address *</label>
                    <input 
                      type="text" 
                      required
                      value={formData.address}
                      onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                      placeholder="e.g. 18 Place Vendôme"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-slate-900 focus:outline-none bg-slate-50/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">City *</label>
                      <input 
                        type="text" 
                        required
                        value={formData.city}
                        onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                        placeholder="e.g. Paris"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-slate-900 focus:outline-none bg-slate-50/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Country *</label>
                      <input 
                        type="text" 
                        required
                        value={formData.country}
                        onChange={e => setFormData(p => ({ ...p, country: e.target.value }))}
                        placeholder="e.g. France"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-slate-900 focus:outline-none bg-slate-50/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Phone Line</label>
                      <input 
                        type="text" 
                        value={formData.phone}
                        onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                        placeholder="e.g. +33 1 42 68 55 00"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-slate-900 focus:outline-none bg-slate-50/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Atelier Email</label>
                      <input 
                        type="email" 
                        value={formData.email}
                        onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                        placeholder="e.g. paris@luxe-boutique.com"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-slate-900 focus:outline-none bg-slate-50/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Operational Hours</label>
                    <input 
                      type="text" 
                      value={formData.hours}
                      onChange={e => setFormData(p => ({ ...p, hours: e.target.value }))}
                      placeholder="e.g. Monday – Saturday: 10:30 AM – 7:30 PM | Sunday: Closed"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-slate-900 focus:outline-none bg-slate-50/50"
                    />
                  </div>

                  {/* Showroom Cover Image with Local File Upload */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Salon Cover Image
                      </label>
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-semibold">
                        <button
                          type="button"
                          onClick={() => setImageTab("upload")}
                          className={`px-2.5 py-1 rounded-md transition-all ${
                            imageTab === "upload" 
                              ? "bg-white text-slate-900 shadow-xs font-bold" 
                              : "text-slate-500 hover:text-slate-900"
                          }`}
                        >
                          Upload Local File
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageTab("url")}
                          className={`px-2.5 py-1 rounded-md transition-all ${
                            imageTab === "url" 
                              ? "bg-white text-slate-900 shadow-xs font-bold" 
                              : "text-slate-500 hover:text-slate-900"
                          }`}
                        >
                          Image URL
                        </button>
                      </div>
                    </div>

                    {imageTab === "upload" ? (
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
                          className="hidden"
                          onChange={e => {
                            if (e.target.files && e.target.files[0]) {
                              handleImageUpload(e.target.files[0]);
                            }
                          }}
                        />

                        {formData.imageUrl ? (
                          <div className="relative rounded-2xl overflow-hidden border border-slate-200 group bg-slate-50">
                            <div className="h-40 w-full overflow-hidden bg-slate-100 flex items-center justify-center">
                              <img 
                                src={formData.imageUrl} 
                                alt="Cover Preview" 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                            </div>
                            <div className="p-3 bg-white flex items-center justify-between border-t border-slate-100">
                              <div className="flex items-center gap-2 truncate text-xs text-slate-600 font-medium">
                                <MdCheckCircle className="text-[#006c49] text-base shrink-0" />
                                <span className="truncate max-w-[220px] font-mono text-[11px]">{formData.imageUrl}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={isUploadingImage}
                                  className="px-2.5 py-1 text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors uppercase tracking-wider"
                                >
                                  Replace
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFormData(p => ({ ...p, imageUrl: "" }))}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                                  title="Remove Image"
                                >
                                  <MdClose className="text-base" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                              isDragging 
                                ? "border-[#006c49] bg-[#f0faf6]" 
                                : "border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50"
                            }`}
                          >
                            {isUploadingImage ? (
                              <div className="flex flex-col items-center justify-center py-2 space-y-2">
                                <div className="animate-spin rounded-full h-7 w-7 border-2 border-[#006c49] border-t-transparent" />
                                <span className="text-xs font-semibold text-slate-600">Uploading to local storage...</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center space-y-2">
                                <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-100 flex items-center justify-center text-[#006c49]">
                                  <MdCloudUpload className="text-2xl" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-800">
                                    Click to browse local files or drag & drop here
                                  </p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    JPG, PNG, WEBP, GIF, SVG (up to 20MB)
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {imageUploadError && (
                          <p className="text-[11px] font-semibold text-rose-600 mt-1.5 flex items-center gap-1">
                            <span>⚠️</span> {imageUploadError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <input 
                          type="url" 
                          value={formData.imageUrl}
                          onChange={e => setFormData(p => ({ ...p, imageUrl: e.target.value }))}
                          placeholder="https://images.unsplash.com/..."
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-slate-900 focus:outline-none bg-slate-50/50"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Paste a direct image URL from Unsplash or CDN.</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 pt-2">
                    <input 
                      type="checkbox" 
                      id="loc-active"
                      checked={formData.active}
                      onChange={e => setFormData(p => ({ ...p, active: e.target.checked }))}
                      className="rounded text-[#006c49] focus:ring-[#006c49] h-4 w-4 border-slate-300"
                    />
                    <label htmlFor="loc-active" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">
                      Publish location globally (Active)
                    </label>
                  </div>
                </div>

                {/* Modal Footer / Submit Button */}
                <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-[#006c49] hover:bg-[#005237] disabled:bg-slate-200 text-white text-xs font-bold tracking-wider rounded-xl transition-all shadow-sm uppercase inline-flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" /> Saving...
                      </>
                    ) : (
                      "Save Location"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
