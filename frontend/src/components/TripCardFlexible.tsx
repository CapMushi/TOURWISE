import { MapPin, Calendar, Users, Bus, Plane, Train, Car, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { formatPkr } from "@/lib/currency";
import type { TripResponse } from "@/lib/api";

interface TripCardFlexibleProps {
  trip: TripResponse;
  variant?: "traveler" | "agent";
  onClick?: () => void;
  showAgentName?: boolean;
}

const transportIcons: Record<string, React.ReactNode> = {
  flight: <Plane className="h-4 w-4" />,
  bus: <Bus className="h-4 w-4" />,
  train: <Train className="h-4 w-4" />,
  "car_rental": <Car className="h-4 w-4" />,
  "private-car": <Car className="h-4 w-4" />,
  ship: <Ship className="h-4 w-4" />,
  tour: <Bus className="h-4 w-4" />,
  transport: <Bus className="h-4 w-4" />,
};

export function TripCardFlexible({
  trip,
  variant = "traveler",
  onClick,
  showAgentName = true,
}: TripCardFlexibleProps) {
  const departureDate = new Date(trip.departure_time);
  const arrivalDate = new Date(trip.arrival_time);
  const durationDays = Math.ceil(
    (arrivalDate.getTime() - departureDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const getStatusBadge = () => {
    if (trip.available_seats === 0) {
      return <Badge className="bg-red-500 text-white">Fully Booked</Badge>;
    }
    if (trip.available_seats < trip.total_seats * 0.2) {
      return <Badge className="bg-orange-500 text-white">Almost Full</Badge>;
    }
    return <Badge className="bg-green-500 text-white">Available</Badge>;
  };

  const transportIcon = transportIcons[trip.transport_type.toLowerCase()] || <Bus className="h-4 w-4" />;

  return (
    <div
      className="glass-card overflow-hidden cursor-pointer group hover:shadow-lg transition-all duration-300"
      onClick={onClick}
    >
      <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 relative overflow-hidden">
        {trip.image_url ? (
          <img
            src={trip.image_url}
            alt={`${trip.origin_city} to ${trip.destination_city}`}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-6xl opacity-20">{transportIcon}</div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute top-3 right-3">
          {variant === "agent" && getStatusBadge()}
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center gap-2 text-white bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm">
            {transportIcon}
            <span className="capitalize">{trip.transport_type.replace("_", " ")}</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Title */}
        <div>
          <h3 className="font-heading font-bold text-xl text-heading mb-2 line-clamp-2">
            {trip.origin_city} → {trip.destination_city}
          </h3>
          <p className="text-sm text-body-text">
            {trip.destination_province}
          </p>
        </div>

        {/* Details Grid */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-body-text">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span>
              {format(departureDate, "MMM dd, yyyy")} - {format(arrivalDate, "MMM dd, yyyy")}
            </span>
          </div>
          <div className="flex items-center gap-2 text-body-text">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span>{durationDays} {durationDays === 1 ? "day" : "days"}</span>
          </div>
          {showAgentName && trip.agent_name && (
            <div className="flex items-center gap-2 text-body-text">
              <span className="text-xs">by</span>
              <span className="font-medium text-heading">{trip.agent_name}</span>
            </div>
          )}
        </div>

        {/* Seats and Price */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2 text-sm text-body-text">
            <Users className="h-4 w-4" />
            <span>
              {trip.available_seats} / {trip.total_seats} seats
            </span>
          </div>
          <div className="text-right">
            <div className="text-2xl font-heading font-bold text-primary">
              {formatPkr(trip.price)}
            </div>
            <div className="text-xs text-body-text">per person (PKR)</div>
          </div>
        </div>

        {/* Action Button */}
        <Button
          className="w-full"
          variant={variant === "agent" ? "outline" : "default"}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          {variant === "agent" ? "Manage Details" : "View Details"}
        </Button>
      </div>
    </div>
  );
}

