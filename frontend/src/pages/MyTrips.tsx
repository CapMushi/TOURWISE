import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, User, MapPin } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getMyFavorites } from "@/lib/api";

interface Trip {
  id: string;
  image: string;
  title: string;
  destination: string;
  dates: string;
  agent: string;
}

const upcomingTrips: Trip[] = [
  {
    id: "1",
    image: "/placeholder.svg",
    title: "Himalayan Mountain Trek",
    destination: "Nepal",
    dates: "Oct 20, 2025 - Oct 27, 2025",
    agent: "AdventureCo Tours"
  },
  {
    id: "2",
    image: "/placeholder.svg",
    title: "Mediterranean Cruise Experience",
    destination: "Greece & Italy",
    dates: "Nov 5, 2025 - Nov 15, 2025",
    agent: "Coastal Voyages"
  },
  {
    id: "3",
    image: "/placeholder.svg",
    title: "Safari Adventure",
    destination: "Tanzania",
    dates: "Dec 1, 2025 - Dec 10, 2025",
    agent: "Wild Expeditions"
  }
];

const pastTrips: Trip[] = [];

function TripCard({ trip }: { trip: Trip }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="relative h-48 overflow-hidden">
        <img
          src={trip.image}
          alt={trip.title}
          className="w-full h-full object-cover"
        />
      </div>
      
      <div className="p-4 space-y-3">
        <h3 className="font-heading font-semibold text-lg text-heading">
          {trip.title}
        </h3>

        <div className="flex items-center gap-2 text-body-text text-sm">
          <MapPin className="h-4 w-4" />
          <span>{trip.destination}</span>
        </div>

        <div className="flex items-center gap-2 text-body-text text-sm">
          <Calendar className="h-4 w-4" />
          <span>{trip.dates}</span>
        </div>

        <div className="flex items-center gap-2 text-body-text text-sm">
          <User className="h-4 w-4" />
          <span>Booked with {trip.agent}</span>
        </div>

        <div className="pt-2 flex justify-end">
          <Button size="sm">View Itinerary</Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message, buttonText }: { message: string; buttonText: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <p className="text-body-text text-lg">{message}</p>
      <Button variant="secondary">{buttonText}</Button>
    </div>
  );
}

export default function MyTrips() {
  const [activeTab, setActiveTab] = useState("upcoming");
  const navigate = useNavigate();
  const { data: favorites = [] } = useQuery({
    queryKey: ["my-favorites"],
    queryFn: getMyFavorites,
  });
  const favoriteTripCards = favorites
    .filter((item) => item.trip)
    .map((item) => {
      const trip = item.trip!;
      return (
        <TripCard
          key={item.favorite_id}
          trip={{
            id: String(trip.trip_id),
            image: trip.image_url || "/placeholder.svg",
            title: `${trip.origin_city} to ${trip.destination_city}`,
            destination: `${trip.destination_city}, ${trip.destination_province}`,
            dates: `${new Date(trip.departure_time).toLocaleDateString()} - ${new Date(trip.arrival_time).toLocaleDateString()}`,
            agent: trip.agent_name || "Travel Agent",
          }}
        />
      );
    });

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
          {upcomingTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          ) : (
            <EmptyState message="You have no upcoming trips!" buttonText="Explore Trips" />
          )}
        </TabsContent>

        <TabsContent value="past">
          {pastTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          ) : (
            <EmptyState message="You have no past trips!" buttonText="Explore Trips" />
          )}
        </TabsContent>

        <TabsContent value="wishlist">
          {favorites.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favoriteTripCards}
            </div>
          ) : (
            <EmptyState message="Your wishlist is empty!" buttonText="Explore Trips" />
          )}
          {favorites.length > 0 && (
            <div className="mt-6 flex justify-end">
              <Button onClick={() => navigate("/search")}>Explore More Trips</Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
