import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L, { LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { getCityCoords, PAKISTAN_CENTER, type LatLng } from "@/lib/pakistanCities";

/**
 * One stop in a tour package, in travel order.
 * The component cares about origin/destination only — pricing and seats are
 * rendered by the parent.
 */
export type BundleStop = {
  origin_city: string;
  destination_city: string;
  /** Optional ISO date used inside the marker popup. */
  departure_time?: string;
};

type BundleRouteMapProps = {
  stops: BundleStop[];
  /** Tailwind classNames controlling the rendered map height. */
  heightClassName?: string;
  /** Show the "Continuous journey" banner inside the map. Defaults to true. */
  showBanner?: boolean;
};

type RoutePoint = {
  city: string;
  coords: LatLng;
  /** 1-indexed visit order in the tour. */
  order: number;
};

/**
 * Build the ordered list of geo points from the stops list.
 *
 * For a continuous chain of N stops we visit N+1 cities, but only the
 * first origin and each destination are placed as pins — repeated cities
 * (e.g. loop back to Karachi) are kept and given their own order number
 * so the user sees they are passing through twice.
 */
function buildRoute(stops: BundleStop[]): RoutePoint[] {
  if (stops.length === 0) return [];

  const ordered: RoutePoint[] = [];
  const firstCoords = getCityCoords(stops[0].origin_city);
  if (firstCoords) {
    ordered.push({ city: stops[0].origin_city, coords: firstCoords, order: 1 });
  }
  for (let i = 0; i < stops.length; i++) {
    const c = getCityCoords(stops[i].destination_city);
    if (c) {
      ordered.push({
        city: stops[i].destination_city,
        coords: c,
        order: ordered.length + 1,
      });
    }
  }
  return ordered;
}

/**
 * SVG-based numbered, gradient-filled pin used in place of leaflet's default
 * blue icon. Keeps the look on-brand and means we don't ship the default
 * marker assets.
 */
function buildNumberedIcon(order: number, total: number): L.DivIcon {
  const isStart = order === 1;
  const isEnd = order === total;
  const gradientId = `pin-${order}-${total}`;
  // Soft gradient: primary -> accent. Start = emerald, End = amber, middle = indigo.
  const stops = isStart
    ? ["#10b981", "#059669"] // emerald
    : isEnd
      ? ["#f59e0b", "#d97706"] // amber
      : ["#6366f1", "#4338ca"]; // indigo

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${stops[0]}" />
          <stop offset="100%" stop-color="${stops[1]}" />
        </linearGradient>
        <filter id="shadow-${gradientId}" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="rgba(0,0,0,0.35)" />
        </filter>
      </defs>
      <path filter="url(#shadow-${gradientId})"
        d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26s16-15.5 16-26C32 7.163 24.837 0 16 0z"
        fill="url(#${gradientId})" />
      <circle cx="16" cy="16" r="9" fill="#ffffff" opacity="0.95" />
      <text x="16" y="20" text-anchor="middle" font-family="Inter, system-ui, sans-serif"
            font-size="12" font-weight="700" fill="${stops[1]}">${order}</text>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: "bundle-route-pin",
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -34],
  });
}

/**
 * Refits the map's view to the route's bounds whenever the stops list changes.
 * Lives inside the MapContainer so it has access to the leaflet map instance.
 */
function FitBoundsToRoute({ points }: { points: RoutePoint[] }) {
  const map = useMap();
  const prevKey = useRef<string>("");

  useEffect(() => {
    const key = points.map((p) => p.city).join("|");
    if (key === prevKey.current) return;
    prevKey.current = key;

    if (points.length === 0) {
      map.setView([PAKISTAN_CENTER.lat, PAKISTAN_CENTER.lng], 5);
      return;
    }

    if (points.length === 1) {
      map.setView([points[0].coords.lat, points[0].coords.lng], 7);
      return;
    }

    const bounds: LatLngBoundsExpression = points.map((p) => [
      p.coords.lat,
      p.coords.lng,
    ]) as LatLngBoundsExpression;
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);

  return null;
}

/**
 * Beautiful map-style chain visualization for tour packages.
 * Drops a numbered, gradient pin at each city the traveler passes through
 * and joins them with a flowing dashed polyline (CSS animation in index.css).
 */
export default function BundleRouteMap({
  stops,
  heightClassName = "h-72 sm:h-96",
  showBanner = true,
}: BundleRouteMapProps) {
  const points = useMemo(() => buildRoute(stops), [stops]);

  const polylinePositions = useMemo(
    () => points.map((p) => [p.coords.lat, p.coords.lng] as [number, number]),
    [points],
  );

  const isReady = points.length >= 2;

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border bg-background/30 ${heightClassName}`}>
      <MapContainer
        center={[PAKISTAN_CENTER.lat, PAKISTAN_CENTER.lng]}
        zoom={5}
        scrollWheelZoom={false}
        zoomControl={false}
        className="h-full w-full"
        style={{ background: "rgb(243, 244, 246)" }}
      >
        {/* CARTO Voyager tiles — clean, brand-neutral, free, no API key. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />

        <FitBoundsToRoute points={points} />

        {/* Underlay: soft halo line so the dashed top-line glows over it */}
        {isReady && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: "#10b981",
              weight: 8,
              opacity: 0.18,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        )}

        {/* Animated dashed flowing line */}
        {isReady && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: "#10b981",
              weight: 4,
              opacity: 0.95,
              dashArray: "10 14",
              lineCap: "round",
              lineJoin: "round",
              className: "bundle-route-flowline",
            }}
          />
        )}

        {points.map((p, idx) => (
          <Marker
            key={`${p.city}-${idx}`}
            position={[p.coords.lat, p.coords.lng]}
            icon={buildNumberedIcon(p.order, points.length)}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold text-heading">
                  {p.order === 1 ? "Start · " : p.order === points.length ? "End · " : `Stop ${p.order} · `}
                  {p.city}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {showBanner && isReady && (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-white shadow-lg ring-1 ring-emerald-700/30 backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          Continuous journey
        </div>
      )}

      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <p className="px-6 text-center text-sm text-body-text">
            Add at least 2 stops to see the journey on the map.
          </p>
        </div>
      )}
    </div>
  );
}
