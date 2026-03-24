import type { TripResponse } from "@/lib/api";

/** Trending = newest by `created_at`. Recommendations = soonest departure among bookable trips, avoiding overlap with trending. */
export function splitHomeTrips(trips: TripResponse[]): {
  recommendations: TripResponse[];
  trending: TripResponse[];
} {
  if (!trips.length) return { recommendations: [], trending: [] };
  const byNew = [...trips].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const trending = byNew.slice(0, 4);
  const used = new Set(trending.map((t) => t.trip_id));
  const bookable = trips.filter((t) => t.available_seats > 0);
  const recPool = bookable.filter((t) => !used.has(t.trip_id));
  let recommendations = [...recPool].sort(
    (a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime()
  );
  recommendations = recommendations.slice(0, 4);
  if (recommendations.length < 4) {
    const need = 4 - recommendations.length;
    const have = new Set(recommendations.map((t) => t.trip_id));
    const extra = trips.filter((t) => !used.has(t.trip_id) && !have.has(t.trip_id)).slice(0, need);
    recommendations = [...recommendations, ...extra];
  }
  return { recommendations, trending };
}
