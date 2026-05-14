import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { TripCardFlexible } from "@/components/TripCardFlexible";
import { getTrips, type TripSearchFilters } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TRIP_SORT_OPTIONS, type TripSortOption } from "@/lib/tripSort";

const PAGE_SIZE = 9;

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<TripSortOption>("recommended");

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
  const currentPageParam = Number(searchParams.get("page") || "1");
  const currentPage = Number.isFinite(currentPageParam) && currentPageParam > 0 ? currentPageParam : 1;

  const { data, isLoading, error } = useQuery({
    queryKey: ["trips", filters, sortBy, currentPage],
    queryFn: () =>
      getTrips(hasFilters ? filters : undefined, {
        sortBy,
        page: currentPage,
        pageSize: PAGE_SIZE,
      }),
  });

  const trips = data?.trips || [];
  const activeFilters = [
    destinationProvince ? `Province: ${destinationProvince}` : null,
    destinationCity ? `City: ${destinationCity}` : null,
    originCity ? `Origin: ${originCity}` : null,
    transportType && transportType.toLowerCase() !== "any" ? `Transport: ${transportType}` : null,
    priceFrom ? `Min ${priceFrom} PKR` : null,
    priceTo ? `Max ${priceTo} PKR` : null,
    travelers ? `${travelers} travelers` : null,
    suitability && suitability !== "Any" ? suitability : null,
  ].filter(Boolean) as string[];

  const updatePage = (nextPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextPage <= 1) {
      nextParams.delete("page");
    } else {
      nextParams.set("page", String(nextPage));
    }
    setSearchParams(nextParams);
  };

  const handleSortChange = (value: TripSortOption) => {
    setSortBy(value);
    updatePage(1);
  };

  const visibleCurrentPage = data?.page ?? currentPage;
  const totalPages = data?.total_pages ?? 1;
  const paginationWindow = 2;
  const startPage = Math.max(1, visibleCurrentPage - paginationWindow);
  const endPage = Math.min(totalPages, visibleCurrentPage + paginationWindow);
  const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, idx) => startPage + idx);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <h1 className="text-4xl font-heading font-bold text-heading mb-2">Search Results</h1>
          {isLoading ? (
            <p className="text-body-text">Searching...</p>
          ) : (
            <p className="text-body-text">
              {hasFilters
                ? `Found ${data?.total ?? 0} ${(data?.total ?? 0) === 1 ? "trip" : "trips"} matching your search`
                : `Showing ${(data?.total ?? 0)} ${(data?.total ?? 0) === 1 ? "trip" : "trips"} across all pages`}
            </p>
          )}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <Badge key={filter} variant="secondary" className="rounded-full">
                  {filter}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-[220px]">
            <p className="mb-2 text-sm font-medium text-heading">Sort trips</p>
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {TRIP_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            <SearchIcon className="h-4 w-4 mr-2" />
            New Search
          </Button>
        </div>
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
        <div className="space-y-8">
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

          {totalPages > 1 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-body-text">
                Page {visibleCurrentPage} of {totalPages}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => updatePage(visibleCurrentPage - 1)}
                  disabled={!data?.has_previous_page}
                >
                  Previous
                </Button>
                {pageNumbers.map((pageNumber) => (
                  <Button
                    key={pageNumber}
                    variant={pageNumber === visibleCurrentPage ? "default" : "outline"}
                    onClick={() => updatePage(pageNumber)}
                  >
                    {pageNumber}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  onClick={() => updatePage(visibleCurrentPage + 1)}
                  disabled={!data?.has_next_page}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

