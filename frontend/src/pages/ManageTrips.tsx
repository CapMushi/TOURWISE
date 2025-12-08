import { Plus, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TripCardFlexible } from "@/components/TripCardFlexible";
import { getMyTrips } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ManageTrips() {
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-trips"],
    queryFn: getMyTrips,
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-4xl font-heading font-bold text-heading">Manage Trips</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-96 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-4xl font-heading font-bold text-heading">Manage Trips</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load trips. Please try again.
            <Button variant="outline" size="sm" className="ml-4" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const trips = data?.trips || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-heading font-bold text-heading">Manage Trips</h1>
        {trips.length > 0 && (
          <p className="text-body-text">
            {trips.length} {trips.length === 1 ? "trip" : "trips"} total
          </p>
        )}
      </div>

      {/* Add New Trip Card */}
      <div
        onClick={() => navigate("/agent/add-trip")}
        className="glass-card p-12 flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-all duration-300 border-2 border-dashed border-primary/30 hover:border-primary"
      >
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Plus className="h-10 w-10 text-primary" />
        </div>
        <p className="text-lg font-heading font-semibold text-heading">Add New Trip</p>
      </div>

      {/* Trip List Grid */}
      {trips.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-body-text text-lg mb-4">You haven't created any trips yet.</p>
          <Button onClick={() => navigate("/agent/add-trip")}>Create Your First Trip</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((trip) => (
            <TripCardFlexible
              key={trip.trip_id}
              trip={trip}
              variant="agent"
              showAgentName={false}
              onClick={() => navigate(`/agent/manage-details/${trip.trip_id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
