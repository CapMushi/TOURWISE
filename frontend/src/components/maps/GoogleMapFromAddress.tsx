import { useEffect, useMemo, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };

type Marker = {
  position: LatLng;
  label?: string;
};

type GoogleMapFromAddressProps = {
  address?: string | null;
  label?: string;
  heightClassName?: string;
  zoom?: number;
  /** When interactive Maps JS API fails, render an iframe embed instead. */
  enableEmbedFallback?: boolean;
};

declare global {
  interface Window {
    google?: any;
  }
}

const MAP_SCRIPT_ID = "google-maps-js";
const GEO_CACHE_KEY = "tw_google_geocode_cache_v1";

function safeLoadGeoCache(): Record<string, LatLng> {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, LatLng>;
  } catch {
    return {};
  }
}

function safeSaveGeoCache(cache: Record<string, LatLng>) {
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota/security errors
  }
}

function getAddressKey(address: string) {
  // Normalize so cache hits are consistent.
  return address.trim().toLowerCase().replace(/\s+/g, " ");
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  // If already present, resolve immediately.
  if (window.google?.maps) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    // Idempotent: if script already injected, wait for it.
    const existing = document.getElementById(MAP_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps script.")));
      return;
    }

    const script = document.createElement("script");
    script.id = MAP_SCRIPT_ID;
    // NOTE: "v=weekly" keeps behavior consistent across Google updates.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps script."));

    document.head.appendChild(script);
  });
}

export function GoogleMapFromAddress({
  address,
  label,
  heightClassName = "h-72",
  zoom = 11,
  enableEmbedFallback = true,
}: GoogleMapFromAddressProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const normalizedAddress = useMemo(() => (address ? address.trim() : ""), [address]);
  const addressKey = useMemo(
    () => (normalizedAddress ? getAddressKey(normalizedAddress) : ""),
    [normalizedAddress]
  );

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [scriptStatus, setScriptStatus] = useState<"idle" | "loading" | "ready" | "error">(
    apiKey ? "idle" : "error"
  );
  const [scriptError, setScriptError] = useState<string | null>(null);

  const [marker, setMarker] = useState<Marker | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [geoError, setGeoError] = useState<string | null>(null);

  // Load script once.
  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    if (window.google?.maps) {
      setScriptStatus("ready");
      return;
    }

    setScriptStatus("loading");
    setScriptError(null);

    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (cancelled) return;
        setScriptStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setScriptStatus("error");
        setScriptError(e instanceof Error ? e.message : "Failed to load Google Maps.");
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // Geocode address -> lat/lng and create/update marker.
  useEffect(() => {
    if (scriptStatus !== "ready") return;
    if (!normalizedAddress) return;
    if (!window.google?.maps?.Geocoder) return;

    let cancelled = false;
    setGeoError(null);
    setGeoStatus("loading");

    const run = async () => {
      // Cache first.
      const cache = safeLoadGeoCache();
      const cached = cache[addressKey];
      if (cached) {
        if (cancelled) return;
        setMarker({ position: cached, label });
        setGeoStatus("ready");
        return;
      }

      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: normalizedAddress }, (results: any[], status: string) => {
        if (cancelled) return;

        if (status !== "OK" || !results || results.length === 0) {
          setGeoStatus("error");
          setGeoError("Could not find a location for this address.");
          return;
        }

        const loc = results[0]?.geometry?.location;
        const lat = typeof loc?.lat === "function" ? loc.lat() : loc?.lat;
        const lng = typeof loc?.lng === "function" ? loc.lng() : loc?.lng;

        if (typeof lat !== "number" || typeof lng !== "number") {
          setGeoStatus("error");
          setGeoError("Geocoding returned invalid coordinates.");
          return;
        }

        const coords: LatLng = { lat, lng };
        cache[addressKey] = coords;
        safeSaveGeoCache(cache);

        setMarker({ position: coords, label });
        setGeoStatus("ready");
      });
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [scriptStatus, normalizedAddress, addressKey, label]);

  // Create/update the map instance when marker is ready.
  useEffect(() => {
    if (scriptStatus !== "ready") return;
    if (!marker) return;
    if (!mapContainerRef.current) return;
    if (!window.google?.maps) return;

    const { position } = marker;

    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
        center: position,
        zoom,
      });
    } else {
      mapRef.current.setCenter(position);
      mapRef.current.setZoom(zoom);
    }

    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        position,
        map: mapRef.current,
        title: marker.label || "Destination",
      });
    } else {
      markerRef.current.setPosition(position);
      markerRef.current.setTitle(marker.label || "Destination");
    }
  }, [scriptStatus, marker, zoom]);

  if (!normalizedAddress) {
    return (
      <div className={`${heightClassName} rounded-lg border bg-muted/20 flex items-center justify-center`}>
        <span className="text-sm text-muted-foreground">No destination address available.</span>
      </div>
    );
  }

  if (scriptStatus === "error") {
    if (enableEmbedFallback) {
      const q = encodeURIComponent(normalizedAddress);
      const src = `https://www.google.com/maps?q=${q}&output=embed`;
      return (
        <div className={`${heightClassName} rounded-lg overflow-hidden border bg-background`}>
          <iframe
            title={label ? `${label} map` : "Map"}
            src={src}
            className="w-full h-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      );
    }
    return (
      <div className={`${heightClassName} rounded-lg border bg-muted/20 p-4`}>
        <div className="text-sm font-medium">Map unavailable</div>
        <div className="text-sm text-muted-foreground mt-1">
          {scriptError
            ? scriptError
            : "Missing Google Maps API key. Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env."}
        </div>
      </div>
    );
  }

  if (geoStatus === "loading" || !marker) {
    if (geoStatus === "error" && enableEmbedFallback) {
      const q = encodeURIComponent(normalizedAddress);
      const src = `https://www.google.com/maps?q=${q}&output=embed`;
      return (
        <div className={`${heightClassName} rounded-lg overflow-hidden border bg-background`}>
          <iframe
            title={label ? `${label} map` : "Map"}
            src={src}
            className="w-full h-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      );
    }
    return (
      <div className={`${heightClassName} rounded-lg border bg-muted/20 flex items-center justify-center`}>
        <span className="text-sm text-muted-foreground">Loading map...</span>
      </div>
    );
  }

  return (
    <div className={`${heightClassName} rounded-lg overflow-hidden border bg-background`}>
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}

