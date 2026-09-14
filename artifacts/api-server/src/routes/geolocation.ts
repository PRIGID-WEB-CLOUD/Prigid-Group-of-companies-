import { Router, type IRouter, type Response } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { and, inArray } from "drizzle-orm";
import { type TenantRequest } from "../middleware/tenantContext";

const router: IRouter = Router();

async function getGoogleMapsApiKey(storeId?: string): Promise<string> {
  if (process.env.GOOGLE_MAPS_API_KEY?.trim()) {
    return process.env.GOOGLE_MAPS_API_KEY.trim();
  }
  if (process.env.GOOGLE_MAPS_KEY?.trim()) {
    return process.env.GOOGLE_MAPS_KEY.trim();
  }
  if (process.env.VITE_GOOGLE_MAPS_API_KEY?.trim()) {
    return process.env.VITE_GOOGLE_MAPS_API_KEY.trim();
  }
  try {
    const query = db
      .select()
      .from(appSettingsTable);
    
    const conditions = [inArray(appSettingsTable.key, ["google_maps_api_key", "google_maps_key"])];
    if (storeId) {
      conditions.push(inArray(appSettingsTable.storeId, [storeId, "global"]));
    }
    
    const rows = await query.where(and(...conditions));
    const match = rows.find((r) => r.value && r.value.trim().length > 0);
    if (match) return match.value.trim();
  } catch (err) {
    console.warn("Could not query appSettingsTable for google maps key", err);
  }
  return "";
}

export interface AddressBreakdown {
  formattedAddress: string;
  street: string;
  apartment: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  source: "google_maps" | "osm_nominatim";
}

/**
 * Helper to extract postal codes from full address string if missing from attributes
 */
function extractPostalCodeFromString(text: string, countryCode?: string): string {
  if (!text) return "";

  // UK Postcode pattern: e.g. SW1A 1AA, EC1A 1BB, W1K 7AA, M1 1AE
  const ukMatch = text.match(/\b([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})\b/i);
  if (ukMatch && (!countryCode || countryCode.toUpperCase() === "GB" || countryCode.toUpperCase() === "UK")) {
    return ukMatch[1].toUpperCase();
  }

  // US ZIP or ZIP+4 pattern: e.g. 90210 or 90210-1234
  const usMatch = text.match(/\b(\d{5}(?:-\d{4})?)\b/);
  if (usMatch && (!countryCode || countryCode.toUpperCase() === "US")) {
    return usMatch[1];
  }

  // Canadian Postal Code: e.g. K1A 0B1
  const caMatch = text.match(/\b([A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/i);
  if (caMatch && (!countryCode || countryCode.toUpperCase() === "CA")) {
    return caMatch[1].toUpperCase();
  }

  // European 4 to 6 digit postal codes (e.g. France, Germany, Spain, Italy, Australia, etc.)
  const generalMatch = text.match(/\b([0-9]{4,6})\b/);
  if (generalMatch) {
    return generalMatch[1];
  }

  return "";
}

/**
 * Reverse Geocode Coordinates (lat, lng) to Address
 */
router.get("/geolocation/reverse-geocode", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId;
  const latStr = req.query.lat as string;
  const lngStr = req.query.lng as string;

  if (!latStr || !lngStr) {
    return res.status(400).json({ error: "Missing latitude or longitude parameters (lat, lng)." });
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: "Invalid latitude or longitude coordinate values." });
  }

  const apiKey = await getGoogleMapsApiKey(storeId);

  // 1. Try Google Maps Geocoding API if key is present
  if (apiKey) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&utm_campaign=gmp_mcp_codeassist_v1_aistudio`;
      const gRes = await fetch(gUrl, { headers: { Accept: "application/json" } });
      if (gRes.ok) {
        const gData = (await gRes.json()) as any;
        if (gData.status === "OK" && Array.isArray(gData.results) && gData.results.length > 0) {
          let streetNumber = "";
          let route = "";
          let apartment = "";
          let city = "";
          let state = "";
          let postalCode = "";
          let country = "";
          let countryCode = "";

          // Inspect all result levels (rooftop -> street -> neighborhood -> postal area)
          for (const result of gData.results) {
            const components = result.address_components || [];
            for (const c of components) {
              const types: string[] = c.types || [];
              if (!streetNumber && types.includes("street_number")) streetNumber = c.long_name;
              if (!route && types.includes("route")) route = c.long_name;
              if (!apartment && (types.includes("subpremise") || types.includes("room") || types.includes("floor"))) {
                apartment = c.long_name;
              }
              if (!apartment && types.includes("premise") && !route) {
                apartment = c.long_name;
              }
              if (!city && (types.includes("locality") || types.includes("sublocality") || types.includes("sublocality_level_1") || types.includes("postal_town"))) {
                city = c.long_name;
              }
              if (!state && types.includes("administrative_area_level_1")) {
                state = c.short_name || c.long_name;
              }
              if (!postalCode && (types.includes("postal_code") || types.includes("postal_code_prefix"))) {
                postalCode = c.long_name;
              }
              if (!country && types.includes("country")) {
                country = c.long_name;
                countryCode = c.short_name;
              }
            }
          }

          const street = [streetNumber, route].filter(Boolean).join(" ");
          const firstFormatted = gData.results[0]?.formatted_address || "";

          // If postal code was not found in components, try extracting from formatted text
          if (!postalCode) {
            postalCode = extractPostalCodeFromString(firstFormatted, countryCode);
          }

          const addressParts = [
            street,
            apartment ? `Apt/Suite ${apartment}` : "",
            city,
            state,
            postalCode,
            country,
          ].filter(Boolean);

          const formattedAddress = firstFormatted || addressParts.join(", ");

          const result: AddressBreakdown = {
            formattedAddress,
            street,
            apartment,
            city,
            state,
            postalCode,
            country,
            countryCode,
            lat,
            lng,
            source: "google_maps",
          };

          return res.json({ success: true, data: result });
        }
      }
    } catch (gErr) {
      console.warn("Google Maps geocoding error, falling back to Nominatim:", gErr);
    }
  }

  // 2. High-precision fallback via OpenStreetMap Nominatim
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const osmRes = await fetch(osmUrl, {
      headers: {
        "User-Agent": "LuxeBoutiqueApp/1.0 (Customer Checkout Geolocation; contact@luxe-boutique.com)",
        Accept: "application/json",
      },
    });

    if (osmRes.ok) {
      const osmData = (await osmRes.json()) as any;
      const addr = osmData.address || {};

      // Extract apartment/unit/suite/flat
      const apartment =
        addr.flat ||
        addr.unit ||
        addr.suite ||
        addr.apartment ||
        addr.subpremise ||
        addr.room ||
        addr.floor ||
        addr.flats ||
        "";

      const street = [
        addr.house_number,
        addr.road || addr.street || addr.pedestrian || addr.residential || addr.footway || addr.suburb || addr.neighbourhood,
      ]
        .filter(Boolean)
        .join(" ");

      const city =
        addr.city ||
        addr.town ||
        addr.municipality ||
        addr.village ||
        addr.hamlet ||
        addr.county ||
        addr.suburb ||
        addr.city_district ||
        "";

      const state = addr.state || addr.region || addr.province || addr.state_district || "";
      
      let postalCode =
        addr.postcode ||
        addr.postal_code ||
        addr.zip ||
        addr.postalcode ||
        addr.postal ||
        addr.post_code ||
        "";

      const country = addr.country || "";
      const countryCode = (addr.country_code || "").toUpperCase();

      // If postal code is missing at zoom=18, attempt regex extraction from display_name
      if (!postalCode && osmData.display_name) {
        postalCode = extractPostalCodeFromString(osmData.display_name, countryCode);
      }

      // If postal code is still missing, query slightly zoomed-out level (zoom=14) for regional postal code
      if (!postalCode) {
        try {
          const osmAreaUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
          const areaRes = await fetch(osmAreaUrl, {
            headers: {
              "User-Agent": "LuxeBoutiqueApp/1.0 (Customer Checkout Geolocation; contact@luxe-boutique.com)",
              Accept: "application/json",
            },
          });
          if (areaRes.ok) {
            const areaData = (await areaRes.json()) as any;
            const areaAddr = areaData.address || {};
            postalCode =
              areaAddr.postcode ||
              areaAddr.postal_code ||
              areaAddr.zip ||
              extractPostalCodeFromString(areaData.display_name || "", countryCode) ||
              "";
          }
        } catch {
          // continue with what we have
        }
      }

      const parts = [
        street,
        apartment ? `Apt/Suite ${apartment}` : "",
        addr.suburb && addr.suburb !== street ? addr.suburb : "",
        city,
        state,
        postalCode,
        country,
      ].filter(Boolean);

      const formattedAddress = parts.join(", ") || osmData.display_name || "";

      const result: AddressBreakdown = {
        formattedAddress,
        street,
        apartment,
        city,
        state,
        postalCode,
        country,
        countryCode,
        lat,
        lng,
        source: "osm_nominatim",
      };

      return res.json({ success: true, data: result });
    }
  } catch (osmErr) {
    console.error("Nominatim reverse geocode failure:", osmErr);
  }

  // 3. Fallback coordinates formatted address if external geocoders are unreachable
  const fallbackFormatted = `Latitude ${lat.toFixed(5)}, Longitude ${lng.toFixed(5)}`;
  return res.json({
    success: true,
    data: {
      formattedAddress: fallbackFormatted,
      street: "",
      apartment: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      countryCode: "",
      lat,
      lng,
      source: "osm_nominatim",
    },
  });
});

/**
 * Address Search & Forward Geocoding
 */
router.get("/geolocation/search", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId;
  const query = (req.query.q as string)?.trim();
  if (!query || query.length < 2) {
    return res.json({ success: true, data: [] });
  }

  const apiKey = await getGoogleMapsApiKey(storeId);

  if (apiKey) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        query
      )}&key=${apiKey}&utm_campaign=gmp_mcp_codeassist_v1_aistudio`;
      const gRes = await fetch(gUrl, { headers: { Accept: "application/json" } });
      if (gRes.ok) {
        const gData = (await gRes.json()) as any;
        if (gData.status === "OK" && gData.results) {
          const items = gData.results.slice(0, 5).map((r: any) => ({
            displayName: r.formatted_address,
            lat: r.geometry.location.lat,
            lng: r.geometry.location.lng,
          }));
          return res.json({ success: true, data: items });
        }
      }
    } catch (err) {
      console.warn("Google forward geocoding query error:", err);
    }
  }

  try {
    const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
    const osmRes = await fetch(osmUrl, {
      headers: {
        "User-Agent": "LuxeBoutiqueApp/1.0 (Customer Checkout Geolocation; contact@luxe-boutique.com)",
        Accept: "application/json",
      },
    });

    if (osmRes.ok) {
      const osmData = (await osmRes.json()) as any[];
      const items = (osmData || []).map((item) => ({
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }));
      return res.json({ success: true, data: items });
    }
  } catch (err) {
    console.error("Forward geocode search error:", err);
  }

  return res.json({ success: true, data: [] });
});

/**
 * Public Geolocation Configuration Status
 */
router.get("/geolocation/config", async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId;
  const key = await getGoogleMapsApiKey(storeId);
  return res.json({
    googleMapsConfigured: Boolean(key),
    hasKey: Boolean(key),
  });
});

export default router;
