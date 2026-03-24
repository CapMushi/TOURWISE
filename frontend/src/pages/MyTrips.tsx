import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, User, MapPin, HeartOff } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  getMyFavorites,
  getMyBookings,
  removeFavorite,
  type BookingResponse,
  type TripResponse,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function bookingIsPast(b: BookingResponse): boolean {
  if (b.status === "cancelled" || b.status === "completed") return true;
  const dep = b.trip?.departure_time;
  if (!dep) return false;
  return new Date(dep) < startOfToday();
}

function BookingTripCard({
  booking,
  onViewItinerary,
}: {
  booking: BookingResponse;
  onViewItinerary: () => void;
}) {
  const trip = booking.trip;
  const title = trip
    ? `${trip.origin_city} → ${trip.destination_city}`
    : `Booking ${booking.booking_reference}`;
  const destination = trip?.destination_city ?? "—";
  const dates =
    trip?.departure_time && trip?.arrival_time
      ? `${format(new Date(trip.departure_time), "MMM d, yyyy")} – ${format(
          new Date(trip.arrival_time),
          "MMM d, yyyy"
        )}`
      : "—";
  const agent = booking.agent_name || "Travel agent";

  return (
    <div className="glass-card overflow-hidden">
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20">
        <div className="absolute inset-0 flex items-center justify-center text-body-text text-sm">
          Your trip
        </div>
      </div>

      <div className="p-4 space-y-3">
        <h3 className="font-heading font-semibold text-lg text-heading">{title}</h3>

        <div className="flex items-center gap-2 text-body-text text-sm">
          <MapPin className="h-4 w-4 shrink-0" />
          <span>{destination}</span>
        </div>

        <div className="flex items-center gap-2 text-body-text text-sm">
          <Calendar className="h-4 w-4 shrink-0" />
          <span>{dates}</span>
        </div>

        <div className="flex items-center gap-2 text-body-text text-sm">
          <User className="h-4 w-4 shrink-0" />
          <span>Booked with {agent}</span>
        </div>

        <div className="pt-2 flex justify-end">
          <Button size="sm" onClick={onViewItinerary}>
            View itinerary
          </Button>
        </div>
      </div>
    </div>
  );
}

function WishlistTripCard({
  trip,
  onNavigateTrip,
  onRemove,
  removing,
}: {
  trip: TripResponse;
  onNavigateTrip: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <div className="glass-card overflow-hidden">
      <button type="button" className="w-full text-left" onClick={onNavigateTrip}>
        <div className="relative h-48 overflow-hidden">
          <img
            src={trip.image_url || "/placeholder.svg"}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      </button>

      <div className="p-4 space-y-3">
        <h3 className="font-heading font-semibold text-lg text-heading">
          {trip.origin_city} to {trip.destination_city}
        </h3>

        <div className="flex items-center gap-2 text-body-text text-sm">
          <MapPin className="h-4 w-4 shrink-0" />
          <span>
            {trip.destination_city}, {trip.destination_province}
          </span>
        </div>

        <div className="flex items-center gap-2 text-body-text text-sm">
          <Calendar className="h-4 w-4 shrink-0" />
          <span>
            {format(new Date(trip.departure_time), "MMM d, yyyy")} –{" "}
            {format(new Date(trip.arrival_time), "MMM d, yyyy")}
          </span>
        </div>

        <div className="flex items-center gap-2 text-body-text text-sm">
          <User className="h-4 w-4 shrink-0" />
          <span>Agent: {trip.agent_name || "Travel agent"}</span>
        </div>

        <div className="pt-2 flex flex-wrap gap-2 justify-end">
          <Button size="sm" variant="secondary" onClick={onNavigateTrip}>
            View trip
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            disabled={removing}
          >
            <HeartOff className="h-4 w-4" />
            Remove from wishlist
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  message,
  buttonText,
  onExplore,
}: {
  message: string;
  buttonText: string;
  onExplore: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <p className="text-body-text text-lg text-center max-w-md">{message}</p>
      <Button onClick={onExplore}>{buttonText}</Button>
    </div>
  );
}

export default function MyTrips() {
  const [activeTab, setActiveTab] = useState("upcoming");
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: favorites = [] } = useQuery({
    queryKey: ["my-favorites"],
    queryFn: getMyFavorites,
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["my-bookings", "all"],
    queryFn: () => getMyBookings(undefined),
  });

  const removeMutation = useMutation({
    mutationFn: removeFavorite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-favorites"] });
      toast({ title: "Removed from wishlist" });
    },
    onError: (e: Error) => {
      toast({ title: "Could not remove", description: e.message, variant: "destructive" });
    },
  });

  const { upcoming, past } = useMemo(() => {
    const upcomingList: BookingResponse[] = [];
    const pastList: BookingResponse[] = [];
    for (const b of bookings) {
      if (bookingIsPast(b)) pastList.push(b);
      else upcomingList.push(b);
    }
    return { upcoming: upcomingList, past: pastList };
  }, [bookings]);

  const goExplore = () => navigate("/explore");

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="font-heading text-4xl font-bold text-heading mb-8">My Trips</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="upcoming">Upcoming Trips</TabsTrigger>
          <TabsTrigger value="past">Past Trips</TabsTrigger>
          <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          {bookingsLoading ? (
            <p className="text-body-text py-12 text-center">Loading your trips…</p>
          ) : upcoming.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcoming.map((booking) => (
                <BookingTripCard
                  key={booking.booking_id}
                  booking={booking}
                  onViewItinerary={() => navigate(`/booking/${booking.booking_id}`)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              message="You have no upcoming trips!"
              buttonText="Explore trips"
              onExplore={goExplore}
            />
          )}
        </TabsContent>

        <TabsContent value="past">
          {bookingsLoading ? (
            <p className="text-body-text py-12 text-center">Loading your trips…</p>
          ) : past.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {past.map((booking) => (
                <BookingTripCard
                  key={booking.booking_id}
                  booking={booking}
                  onViewItinerary={() => navigate(`/booking/${booking.booking_id}`)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              message="You have no past trips!"
              buttonText="Explore trips"
              onExplore={goExplore}
            />
          )}
        </TabsContent>

        <TabsContent value="wishlist">
          {favorites.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favorites
                  .filter((item) => item.trip)
                  .map((item) => (
                    <WishlistTripCard
                      key={item.favorite_id}
                      trip={item.trip!}
                      onNavigateTrip={() => navigate(`/trip/${item.trip!.trip_id}`)}
                      onRemove={() => removeMutation.mutate(item.trip!.trip_id)}
                      removing={removeMutation.isPending}
                    />
                  ))}
              </div>
              <div className="mt-6 flex justify-end">
                <Button variant="outline" onClick={goExplore}>
                  Explore more trips
                </Button>
              </div>
            </>
          ) : (
            <EmptyState
              message="Your wishlist is empty!"
              buttonText="Explore trips"
              onExplore={goExplore}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
