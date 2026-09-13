// Source: Google Maps Platform Code Assist
import { useState, useEffect, useRef, useCallback } from "react";
import {
  MapPin,
  Navigation,
  Loader2,
  Search,
  Check,
  Compass,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertCircle,
  Building,
  Layers,
  Sparkles,
} from "lucide-react";
import L from "leaflet";

export interface AddressBreakdownData {
  formattedAddress: string;
  street: string;
  apartment?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  source?: string;
}

interface AddressMapPickerProps {
  currentAddress: string;
  onAddressSelect: (address: string, breakdown?: AddressBreakdownData) => void;
  className?: string;
}

export default function AddressMapPicker({
  currentAddress,
  onAddressSelect,
  className = "",
}: AddressMapPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ displayName: string; lat: number; lng: number }>>([]);
  const [searching, setSearching] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [googleMapsConfigured, setGoogleMapsConfigured] = useState(false);

  // Default coordinate (London luxury district / Mayfair fallback, will be replaced by user's real GPS)
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 51.5074,
    lng: -0.1278,
  });

  const [addressDetails, setAddressDetails] = useState<AddressBreakdownData>({
    formattedAddress: currentAddress || "",
    street: "",
    apartment: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const searchTimeoutRef = useRef<any>(null);

  // Check Google Maps config status
  useEffect(() => {
    fetch("/api/geolocation/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.googleMapsConfigured) {
          setGoogleMapsConfigured(true);
        }
      })
      .catch(() => {});
  }, []);

  // Load Leaflet CSS dynamically if not present
  useEffect(() => {
    if (!document.getElementById("leaflet-css-bundle")) {
      const link = document.createElement("link");
      link.id = "leaflet-css-bundle";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }, []);

  // Fetch address details via coordinates
  const reverseGeocode = useCallback(
    async (lat: number, lng: number, accuracy?: number) => {
      setGeocoding(true);
      setLocationError(null);
      try {
        const res = await fetch(`/api/geolocation/reverse-geocode?lat=${lat}&lng=${lng}`);
        const data = await res.json();
        if (data.success && data.data) {
          const resData = data.data;
          const updated: AddressBreakdownData = {
            formattedAddress: resData.formattedAddress,
            street: resData.street || "",
            apartment: resData.apartment || addressDetails.apartment || "",
            city: resData.city || "",
            state: resData.state || "",
            postalCode: resData.postalCode || "",
            country: resData.country || "",
            countryCode: resData.countryCode || "",
            lat,
            lng,
            accuracy: accuracy || gpsAccuracy || undefined,
            source: resData.source,
          };
          setAddressDetails(updated);
          onAddressSelect(resData.formattedAddress, updated);
        }
      } catch (err) {
        console.error("Reverse geocoding failed", err);
        setLocationError("Could not translate coordinates to street name. Please verify address text.");
      } finally {
        setGeocoding(false);
      }
    },
    [addressDetails.apartment, gpsAccuracy, onAddressSelect]
  );

  // Request device location
  const handleGetDeviceLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser or device.");
      return;
    }

    setLocating(true);
    setLocationError(null);
    setIsOpen(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCoords({ lat: latitude, lng: longitude });
        setGpsAccuracy(Math.round(accuracy));
        setLocating(false);

        // Update map position
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 17);
          markerRef.current.setLatLng([latitude, longitude]);

          if (accuracyCircleRef.current) {
            accuracyCircleRef.current.setLatLng([latitude, longitude]);
            accuracyCircleRef.current.setRadius(accuracy);
          } else {
            accuracyCircleRef.current = L.circle([latitude, longitude], {
              radius: accuracy,
              color: "#006c49",
              fillColor: "#10b981",
              fillOpacity: 0.15,
              weight: 1,
            }).addTo(mapInstanceRef.current);
          }
        }

        reverseGeocode(latitude, longitude, accuracy);
      },
      (error) => {
        setLocating(false);
        let errorMsg = "Unable to retrieve your location.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "Location permission was denied. Please allow location access in your browser or search your address.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = "Device location information is currently unavailable.";
        } else if (error.code === error.TIMEOUT) {
          errorMsg = "Location request timed out. Please try again or pin your address manually on the map.";
        }
        setLocationError(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  // Initialize or re-render Map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const customPinHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full bg-slate-900 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-bold ring-4 ring-slate-900/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div class="absolute -bottom-1 w-2 h-2 bg-slate-900 rotate-45"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: "custom-map-pin",
        html: customPinHtml,
        iconSize: [32, 38],
        iconAnchor: [16, 38],
      });

      const map = L.map(mapContainerRef.current, {
        center: [coords.lat, coords.lng],
        zoom: 16,
        zoomControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      const marker = L.marker([coords.lat, coords.lng], {
        draggable: true,
        icon: customIcon,
      }).addTo(map);

      marker.on("dragend", () => {
        const position = marker.getLatLng();
        setCoords({ lat: position.lat, lng: position.lng });
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.setLatLng(position);
        }
        reverseGeocode(position.lat, position.lng);
      });

      map.on("click", (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        setCoords({ lat, lng });
        marker.setLatLng([lat, lng]);
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.setLatLng([lat, lng]);
        }
        reverseGeocode(lat, lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    } else {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    }
  }, [isOpen, coords.lat, coords.lng, reverseGeocode]);

  // Handle Search Input
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!val.trim() || val.length < 3) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geolocation/search?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setSearchResults(data.data);
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleSelectSearchResult = (result: { displayName: string; lat: number; lng: number }) => {
    setSearchQuery("");
    setSearchResults([]);
    setCoords({ lat: result.lat, lng: result.lng });

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([result.lat, result.lng], 17);
      markerRef.current.setLatLng([result.lat, result.lng]);
    }
    reverseGeocode(result.lat, result.lng);
  };

  const handleFieldChange = (field: keyof AddressBreakdownData, val: string) => {
    const updated = { ...addressDetails, [field]: val };
    const parts = [
      updated.street,
      updated.apartment ? `Apt/Suite ${updated.apartment}` : "",
      updated.city,
      updated.state,
      updated.postalCode,
      updated.country,
    ].filter(Boolean);

    const formatted = parts.join(", ");
    updated.formattedAddress = formatted;
    setAddressDetails(updated);
    onAddressSelect(formatted, updated);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl text-white shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
            <Compass size={18} className={locating ? "animate-spin text-emerald-300" : ""} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider font-[Manrope]">
                Google Maps & Device GPS
              </span>
              <span className="text-[10px] bg-emerald-500/30 text-emerald-300 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                <Sparkles size={10} />
                Live Geocoding
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Pinpoint your exact delivery location automatically
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleGetDeviceLocation}
            disabled={locating}
            className="flex-1 sm:flex-initial px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {locating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Locating…</span>
              </>
            ) : (
              <>
                <Navigation size={14} />
                <span>Use Device Location</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <MapPin size={14} />
            <span>{isOpen ? "Hide Map" : "Open Map"}</span>
          </button>
        </div>
      </div>

      {/* Location Error Notification */}
      {locationError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{locationError}</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Tip: You can still search for your street or manually drag the pin on the map.
            </p>
          </div>
        </div>
      )}

      {/* Interactive Map & Geolocation Drawer */}
      {isOpen && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-md space-y-4 animate-in fade-in duration-200">
          {/* Search bar inside map */}
          <div className="relative">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900 transition-all">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search street, building, landmark, or postal code…"
                className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none"
              />
              {searching && <Loader2 size={14} className="animate-spin text-slate-400" />}
            </div>

            {/* Autocomplete Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {searchResults.map((res, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors text-xs text-slate-700 flex items-start gap-2 cursor-pointer"
                  >
                    <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{res.displayName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Map Canvas Container */}
          <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-inner">
            <div
              ref={mapContainerRef}
              className={`w-full transition-all duration-300 ${isExpanded ? "h-[380px]" : "h-[220px]"}`}
            />

            {/* Geocoding Loading Overlay */}
            {geocoding && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-400">
                <div className="bg-slate-900 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg">
                  <Loader2 size={14} className="animate-spin text-emerald-400" />
                  <span>Fetching address details…</span>
                </div>
              </div>
            )}

            {/* Map Top-Right Controls */}
            <div className="absolute top-3 right-3 z-400 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="w-8 h-8 bg-white/90 hover:bg-white text-slate-700 rounded-lg shadow-md border border-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                title={isExpanded ? "Collapse map" : "Expand map"}
              >
                {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView([coords.lat, coords.lng], 17);
                  }
                }}
                className="w-8 h-8 bg-white/90 hover:bg-white text-slate-700 rounded-lg shadow-md border border-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                title="Recenter pin"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {/* Bottom Map Info Overlay */}
            <div className="absolute bottom-2 left-2 z-400 bg-white/90 backdrop-blur-xs border border-slate-200/80 rounded-lg px-2.5 py-1 text-[11px] font-[Manrope] text-slate-700 shadow-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Drag pin or click map to adjust exact drop-off spot</span>
              {gpsAccuracy && (
                <span className="text-[10px] text-slate-500 font-mono">
                  (GPS accuracy: ±{gpsAccuracy}m)
                </span>
              )}
            </div>
          </div>

          {/* Structured Address Breakdown Editor */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Building size={14} className="text-slate-400" />
                <span>Verified Address Breakdown</span>
              </h4>
              <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                Source: {addressDetails.source === "google_maps" ? "Google Maps Platform" : "Live Geocoder"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Street Address & Number
                </label>
                <input
                  type="text"
                  value={addressDetails.street}
                  onChange={(e) => handleFieldChange("street", e.target.value)}
                  placeholder="e.g. 10 Downing Street, Suite 400"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Apartment, Suite, Unit (Optional)
                </label>
                <input
                  type="text"
                  value={addressDetails.apartment}
                  onChange={(e) => handleFieldChange("apartment", e.target.value)}
                  placeholder="e.g. Penthouse 8B"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  City / Locality
                </label>
                <input
                  type="text"
                  value={addressDetails.city}
                  onChange={(e) => handleFieldChange("city", e.target.value)}
                  placeholder="e.g. London"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  State / County / Province
                </label>
                <input
                  type="text"
                  value={addressDetails.state}
                  onChange={(e) => handleFieldChange("state", e.target.value)}
                  placeholder="e.g. Greater London"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Postal Code / Postcode
                </label>
                <input
                  type="text"
                  value={addressDetails.postalCode}
                  onChange={(e) => handleFieldChange("postalCode", e.target.value)}
                  placeholder="e.g. SW1A 2AA"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Country
                </label>
                <input
                  type="text"
                  value={addressDetails.country}
                  onChange={(e) => handleFieldChange("country", e.target.value)}
                  placeholder="e.g. United Kingdom"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                <Check size={14} />
                <span>Address updated in checkout order form</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                Confirm & Close Map
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
