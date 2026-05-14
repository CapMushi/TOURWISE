import type { TripResponse } from "./api";

export type TripSortOption =
  | "recommended"
  | "departure-soonest"
  | "price-low-high"
  | "price-high-low"
  | "availability";

export const TRIP_SORT_OPTIONS: Array<{ value: TripSortOption; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "departure-soonest", label: "Departure soonest" },
  { value: "price-low-high", label: "Price: low to high" },
  { value: "price-high-low", label: "Price: high to low" },
  { value: "availability", label: "Most seats available" },
];

export function sortTrips(trips: TripResponse[], sortBy: TripSortOption): TripResponse[] {
  const sorted = [...trips];

  switch (sortBy) {
    case "price-low-high":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-high-low":
      return sorted.sort((a, b) => b.price - a.price);
    case "availability":
      return sorted.sort((a, b) => b.available_seats - a.available_seats);
    case "departure-soonest":
      return sorted.sort(
        (a, b) =>
          new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime()
      );
    case "recommended":
    default:
      return sorted.sort((a, b) => {
        const aExternalPenalty = a.source === "external" ? 0 : 1;
        const bExternalPenalty = b.source === "external" ? 0 : 1;

        if (aExternalPenalty !== bExternalPenalty) {
          return bExternalPenalty - aExternalPenalty;
        }

        if (a.available_seats !== b.available_seats) {
          return b.available_seats - a.available_seats;
        }

        return new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime();
      });
  }
}
