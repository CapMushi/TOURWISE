/**
 * Lat/Lng dictionary for Pakistani cities used across TourWise.
 * Covers all currently-supported destinations plus a generous list of
 * popular tour stops. Lookup is case- and whitespace-insensitive.
 */

export type LatLng = { lat: number; lng: number };

const RAW_CITIES: Record<string, LatLng> = {
  // Major metros
  Karachi: { lat: 24.8607, lng: 67.0011 },
  Lahore: { lat: 31.5204, lng: 74.3587 },
  Islamabad: { lat: 33.6844, lng: 73.0479 },
  Rawalpindi: { lat: 33.5651, lng: 73.0169 },
  Faisalabad: { lat: 31.4504, lng: 73.135 },
  Multan: { lat: 30.1575, lng: 71.5249 },
  Peshawar: { lat: 34.0151, lng: 71.5249 },
  Quetta: { lat: 30.1798, lng: 66.9749 },
  Hyderabad: { lat: 25.3924, lng: 68.3737 },
  Sukkur: { lat: 27.7052, lng: 68.8574 },
  Gujranwala: { lat: 32.1877, lng: 74.1945 },
  Sialkot: { lat: 32.4945, lng: 74.5229 },
  Bahawalpur: { lat: 29.3956, lng: 71.6722 },
  Sargodha: { lat: 32.0836, lng: 72.6711 },

  // Northern Pakistan / tourist favorites
  Murree: { lat: 33.9062, lng: 73.3903 },
  Abbottabad: { lat: 34.149, lng: 73.2215 },
  Mansehra: { lat: 34.3306, lng: 73.1969 },
  Naran: { lat: 34.9069, lng: 73.6533 },
  Kaghan: { lat: 34.7783, lng: 73.5247 },
  Balakot: { lat: 34.5469, lng: 73.3492 },
  Swat: { lat: 35.2227, lng: 72.4258 },
  Mingora: { lat: 34.7795, lng: 72.3614 },
  Kalam: { lat: 35.4892, lng: 72.5811 },
  Malam: { lat: 35.5408, lng: 72.5689 },
  "Malam Jabba": { lat: 34.8128, lng: 72.5717 },
  Gilgit: { lat: 35.9208, lng: 74.3144 },
  Hunza: { lat: 36.3167, lng: 74.65 },
  Karimabad: { lat: 36.3253, lng: 74.6614 },
  Skardu: { lat: 35.288, lng: 75.6361 },
  Khaplu: { lat: 35.1517, lng: 76.3344 },
  Chitral: { lat: 35.8511, lng: 71.7864 },
  Shigar: { lat: 35.4252, lng: 75.7406 },
  Astore: { lat: 35.3667, lng: 74.85 },
  Chilas: { lat: 35.4197, lng: 74.0944 },
  Gulmit: { lat: 36.3947, lng: 74.8758 },
  Passu: { lat: 36.4544, lng: 74.8728 },
  Sost: { lat: 36.6803, lng: 74.8447 },
  Khunjerab: { lat: 36.8511, lng: 75.4239 },

  // Punjab / South Punjab / Sindh / Balochistan extras
  Sahiwal: { lat: 30.6707, lng: 73.1064 },
  Okara: { lat: 30.8138, lng: 73.4534 },
  Kasur: { lat: 31.1156, lng: 74.4467 },
  Sheikhupura: { lat: 31.7131, lng: 73.985 },
  Rahim_Yar_Khan: { lat: 28.4202, lng: 70.2952 },
  "Rahim Yar Khan": { lat: 28.4202, lng: 70.2952 },
  Mirpur: { lat: 33.1483, lng: 73.7517 },
  Muzaffarabad: { lat: 34.3559, lng: 73.4731 },
  "Mirpur Khas": { lat: 25.5269, lng: 69.0142 },
  Larkana: { lat: 27.5589, lng: 68.2123 },
  Nawabshah: { lat: 26.2442, lng: 68.41 },
  Thatta: { lat: 24.7475, lng: 67.9239 },
  Gwadar: { lat: 25.1216, lng: 62.3254 },
  Turbat: { lat: 26.0031, lng: 63.0544 },

  // KP extras
  Mardan: { lat: 34.1989, lng: 72.0508 },
  Kohat: { lat: 33.5817, lng: 71.4422 },
  Bannu: { lat: 32.985, lng: 70.6053 },
  "Dera Ismail Khan": { lat: 31.83, lng: 70.9019 },
  Mingora_KP: { lat: 34.7795, lng: 72.3614 },

  // Misc historic
  Taxila: { lat: 33.7376, lng: 72.7929 },
  Harappa: { lat: 30.6309, lng: 72.8625 },
  Mohenjodaro: { lat: 27.3236, lng: 68.1356 },
  "Mohenjo Daro": { lat: 27.3236, lng: 68.1356 },
};

const LOOKUP: Map<string, LatLng> = (() => {
  const m = new Map<string, LatLng>();
  for (const [k, v] of Object.entries(RAW_CITIES)) {
    m.set(k.trim().toLowerCase(), v);
  }
  return m;
})();

/** Centroid-ish point used when fitBounds has fewer than 2 known cities. */
export const PAKISTAN_CENTER: LatLng = { lat: 30.3753, lng: 69.3451 };

/**
 * Look up a city's coordinates. Returns null when the city isn't in the
 * dictionary so callers can fall back gracefully (e.g. skip the pin or
 * geocode separately).
 */
export function getCityCoords(cityName: string | undefined | null): LatLng | null {
  if (!cityName) return null;
  return LOOKUP.get(cityName.trim().toLowerCase()) ?? null;
}
