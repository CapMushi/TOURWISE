import { useSearchParams, useNavigate } from "react-router-dom";
import { TripCardFlexible } from "@/components/TripCardFlexible";
import { getTrips, type TripSearchFilters } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract search parameters from URL
  const filters: TripSearchFilters = {};
  
  const destinationProvince = searchParams.get("province");
  const destinationCity = searchParams.get("city");
  const originCity = searchParams.get("origin");
  const transportType = searchParams.get("transport");
  const priceFrom = searchParams.get("priceFrom");
  const priceTo = searchParams.get("priceTo");
  const departureDate = searchParams.get("departureDate");
  const arrivalDate = searchParams.get("arrivalDate");
  const travelers = searchParams.get("travelers");
  const suitability = searchParams.get("suitability");

  // Only add filters if they have values
  if (destinationProvince && destinationProvince.trim()) {
    filters.destination_province = destinationProvince.trim();
  }
  if (destinationCity && destinationCity.trim()) {
    filters.destination_city = destinationCity.trim();
  }
  if (originCity && originCity.trim()) {
    filters.origin_city = originCity.trim();
  }
  if (transportType && transportType !== "Any" && transportType.toLowerCase() !== "any") {
    filters.transport_type = transportType.toLowerCase();
  }
  if (priceFrom && priceFrom.trim()) {
    const price = parseFloat(priceFrom);
    if (!isNaN(price) && price > 0) {
      filters.price_min = price;
    }
  }
  if (priceTo && priceTo.trim()) {
    const price = parseFloat(priceTo);
    if (!isNaN(price) && price > 0) {
      filters.price_max = price;
    }
  }
  if (departureDate) {
    try {
      const date = new Date(departureDate);
      if (!isNaN(date.getTime())) {
        date.setHours(0, 0, 0, 0);
        filters.departure_date_from = date.toISOString();
      }
    } catch (e) {
      console.error("Invalid departure date:", e);
    }
  }
  if (arrivalDate) {
    try {
      const date = new Date(arrivalDate);
      if (!isNaN(date.getTime())) {
        date.setHours(23, 59, 59, 999);
        filters.departure_date_to = date.toISOString();
      }
    } catch (e) {
      console.error("Invalid arrival date:", e);
    }
  }
  if (travelers && travelers.trim()) {
    const numTravelers = parseInt(travelers);
    if (!isNaN(numTravelers) && numTravelers > 0) {
      filters.min_available_seats = numTravelers;
    }
  }
  if (suitability && suitability.trim() && suitability !== "Any") {
    filters.suitability = suitability.trim();
  }

  // Check if we have any active filters
  const hasFilters = Object.keys(filters).length > 0;

  const { data, isLoading, error } = useQuery({
    queryKey: ["trips", filters],
    queryFn: () => getTrips(hasFilters ? filters : undefined),
  });

  const trips = data?.trips || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-heading font-bold text-heading mb-2">Search Results</h1>
          {isLoading ? (
            <p className="text-body-text">Searching...</p>
          ) : (
            <p className="text-body-text">
              {hasFilters
                ? `Found ${trips.length} ${trips.length === 1 ? "trip" : "trips"} matching your search`
                : `Showing all ${trips.length} ${trips.length === 1 ? "trip" : "trips"} (ordered by trip ID)`}
            </p>
          )}
        </div>
        <Button variant="outline" onClick={() => navigate("/")}>
          <SearchIcon className="h-4 w-4 mr-2" />
          New Search
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-96 w-full" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load trips. Please try again later.
          </AlertDescription>
        </Alert>
      ) : trips.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <SearchIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-heading font-bold text-heading mb-2">No trips found</h2>
          <p className="text-body-text mb-6">
            {hasFilters
              ? "Try adjusting your search filters to find more trips."
              : "No trips are available at the moment. Please check back later."}
          </p>
          <Button onClick={() => navigate("/")}>Search Trips</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((trip) => (
            <TripCardFlexible
              key={trip.trip_id}
              trip={trip}
              variant="traveler"
              showAgentName={true}
              onClick={() => navigate(`/trip/${trip.trip_id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

