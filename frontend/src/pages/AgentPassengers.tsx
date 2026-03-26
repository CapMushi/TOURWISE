import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  User,
  Calendar,
  Bus,
  HeartPulse,
  Utensils,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getAgentTripPassengers, type TripWithPassengers, type PassengerDetail } from "@/lib/api";
import { formatPkr } from "@/lib/currency";
import { format } from "date-fns";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    confirmed: "bg-green-500 text-white",
    pending: "bg-yellow-500 text-white",
    cancelled: "bg-red-500 text-white",
    completed: "bg-blue-500 text-white",
  };
  return (
    <Badge className={map[status] ?? "bg-gray-400 text-white"}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function PassengerCard({ p }: { p: PassengerDetail }) {
  return (
    <div className="p-3 rounded-lg bg-background/60 border border-border/60 space-y-1 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <User className="h-4 w-4 text-primary" />
        {p.full_name}
        {p.age && <span className="text-muted-foreground font-normal">({p.age} yrs)</span>}
        {p.gender && <Badge variant="outline" className="text-xs">{p.gender}</Badge>}
      </div>
      {p.passport_number && (
        <div className="text-muted-foreground">Passport: {p.passport_number}</div>
      )}
      {(p.emergency_contact_name || p.emergency_contact_phone) && (
        <div className="text-muted-foreground">
          Emergency: {p.emergency_contact_name}
          {p.emergency_contact_phone && ` — ${p.emergency_contact_phone}`}
        </div>
      )}
      {p.dietary_restrictions && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Utensils className="h-3 w-3" />
          {p.dietary_restrictions}
        </div>
      )}
      {p.medical_conditions && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <HeartPulse className="h-3 w-3" />
          {p.medical_conditions}
        </div>
      )}
    </div>
  );
}

function TripRow({ trip }: { trip: TripWithPassengers }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <Bus className="h-5 w-5 text-primary" />
              {trip.origin_city} → {trip.destination_city}
            </CardTitle>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(trip.departure_time), "MMM dd, yyyy HH:mm")}
              </span>
              <span>{trip.transport_type}</span>
              <span>{formatPkr(trip.price)} / seat</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-sm font-semibold text-heading">
                {trip.total_booked_seats} / {trip.total_seats} booked
              </div>
              <div className="text-xs text-muted-foreground">
                {trip.bookings.length} booking{trip.bookings.length !== 1 ? "s" : ""}
              </div>
            </div>
            {expanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-6">
          {trip.bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No active bookings for this trip yet.
            </p>
          ) : (
            trip.bookings.map((booking) => (
              <div key={booking.booking_id} className="border border-border rounded-lg p-4 space-y-4">
                {/* Booking header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-heading">{booking.booking_reference}</span>
                    <span className="ml-3 text-sm text-muted-foreground">
                      {format(new Date(booking.booking_date), "MMM dd, yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(booking.status)}
                    <Badge variant="outline">{booking.number_of_seats} seat(s)</Badge>
                    <span className="text-sm font-medium">{formatPkr(booking.total_price)}</span>
                  </div>
                </div>

                {/* Contact info */}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {booking.contact_email}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {booking.contact_phone}
                  </span>
                  {booking.special_requests && (
                    <span className="text-amber-700">Note: {booking.special_requests}</span>
                  )}
                </div>

                {/* Passengers */}
                {booking.passengers.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Passengers ({booking.passengers.length})
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {booking.passengers.map((p, i) => (
                        <PassengerCard key={i} p={p} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function AgentPassengers() {
  const { data: trips = [], isLoading, error } = useQuery({
    queryKey: ["agent-trip-passengers"],
    queryFn: getAgentTripPassengers,
  });

  const totalBookings = trips.reduce((s, t) => s + t.bookings.length, 0);
  const totalPassengers = trips.reduce((s, t) => s + t.total_booked_seats, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-4xl font-heading font-bold text-heading flex items-center gap-3">
          <Users className="h-9 w-9 text-primary" />
          Passenger Information
        </h1>
        <p className="text-body-text mt-2">
          All travelers booked on your trips — expand a trip to see full passenger details.
        </p>
      </div>

      {/* Summary stats */}
      {!isLoading && !error && (
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card p-4 text-center">
            <div className="text-3xl font-bold text-heading">{trips.length}</div>
            <div className="text-sm text-muted-foreground mt-1">Trips with bookings</div>
          </div>
          <div className="glass-card p-4 text-center">
            <div className="text-3xl font-bold text-heading">{totalBookings}</div>
            <div className="text-sm text-muted-foreground mt-1">Total bookings</div>
          </div>
          <div className="glass-card p-4 text-center">
            <div className="text-3xl font-bold text-heading">{totalPassengers}</div>
            <div className="text-sm text-muted-foreground mt-1">Total passengers</div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {(error as Error).message ?? "Failed to load passenger data."}
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && trips.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">No bookings on your trips yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Passenger details will appear here once travelers book seats.
          </p>
        </div>
      )}

      {!isLoading && !error && trips.length > 0 && (
        <div className="space-y-4">
          {trips.map((trip) => (
            <TripRow key={trip.trip_id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}
