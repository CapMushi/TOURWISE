import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Compass, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TripCardFlexible } from "@/components/TripCardFlexible";
import { getTrips } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Footer } from "@/components/layout/Footer";
import heroImage from "@/assets/hero-tropical.jpg";

export default function ExploreTrips() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["explore-trips"],
    queryFn: () => getTrips(),
  });

  const trips = data?.trips ?? [];

  return (
    <div className="min-h-screen">
      <section className="relative h-[320px] overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-background" />
        </div>
        <div className="relative h-full flex flex-col items-center justify-center px-4 text-center">
          <Compass className="h-12 w-12 text-white mb-4 opacity-90" />
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-white mb-3">
            Explore trips
          </h1>
          <p className="text-white/90 max-w-xl mb-6">
            Browse every published listing from our travel agents. Refine results with search when you
            know exactly where you want to go.
          </p>
          <Button
            size="lg"
            className="gap-2"
            onClick={() => navigate("/search")}
          >
            <Search className="h-4 w-4" />
            Open search
          </Button>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-[420px] w-full" />
            ))}
          </div>
        )}

        {!isLoading && trips.length === 0 && (
          <div className="glass-card p-12 text-center text-body-text">
            No trips are available yet. Try again later or become a travel agent to add listings.
          </div>
        )}

        {!isLoading && trips.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <TripCardFlexible
                key={trip.trip_id}
                trip={trip}
                onClick={() => navigate(`/trip/${trip.trip_id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
