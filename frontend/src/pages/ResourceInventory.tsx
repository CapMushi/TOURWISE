import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  ArrowDown,
  ArrowUp,
  AlertCircle,
  Check,
  Plus,
  Trash2,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { createBundle, getMyTrips, type TripResponse } from "@/lib/api";
import { formatPkr } from "@/lib/currency";
import { toast } from "sonner";
import BundleRouteMap from "@/components/BundleRouteMap";

type ValidationResult = {
  ok: boolean;
  errors: string[];
};

/**
 * Run the chain validation rules from .cursor/rules/trip-bundles-plan.mdc
 * client-side so the agent gets instant feedback as stops are added/reordered.
 * The backend re-enforces the same rules in `POST /api/trips/bundle`.
 *
 * Continuity (`dest[i] == origin[i+1]`) is required — gaps are not allowed.
 */
function validateChain(stops: TripResponse[]): ValidationResult {
  const errors: string[] = [];

  if (stops.length < 2) {
    errors.push("Add at least 2 stops to build a tour package.");
    return { ok: false, errors };
  }

  const seenEdges = new Set<string>();
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];

    if ((stop.available_seats ?? 0) <= 0) {
      errors.push(`${stop.origin_city} → ${stop.destination_city} has no available seats.`);
    }

    if ((stop.member_trip_ids?.length ?? 0) > 0) {
      errors.push(`${stop.origin_city} → ${stop.destination_city} is itself a tour package; nesting is not allowed.`);
    }

    const edge = `${stop.origin_city.toLowerCase().trim()}→${stop.destination_city.toLowerCase().trim()}`;
    if (seenEdges.has(edge)) {
      errors.push(`The route ${stop.origin_city} → ${stop.destination_city} appears more than once.`);
    }
    seenEdges.add(edge);

    if (i === 0) continue;
    const prev = stops[i - 1];
    if (prev.destination_city.trim().toLowerCase() !== stop.origin_city.trim().toLowerCase()) {
      errors.push(
        `Stop ${i + 1} doesn't follow stop ${i}: the previous stop ends in ${prev.destination_city} but this one starts in ${stop.origin_city}.`,
      );
    }
    const prevArrival = new Date(prev.arrival_time).getTime();
    const thisDeparture = new Date(stop.departure_time).getTime();
    if (thisDeparture < prevArrival) {
      errors.push(`Stop ${i + 1} starts before stop ${i} arrives — adjust the schedule.`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function friendlyTime(iso: string) {
  return format(new Date(iso), "EEE, MMM d · h:mm a");
}

export default function ResourceInventory() {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  const { data: myTripsData, isLoading } = useQuery({
    queryKey: ["my-trips-for-bundle"],
    queryFn: getMyTrips,
  });

  const allMyTrips: TripResponse[] = useMemo(() => myTripsData?.trips ?? [], [myTripsData]);

  const tripsById = useMemo(() => {
    const map = new Map<number, TripResponse>();
    for (const t of allMyTrips) map.set(t.trip_id, t);
    return map;
  }, [allMyTrips]);

  const orderedStops = useMemo(
    () => selectedIds.map((id) => tripsById.get(id)).filter((t): t is TripResponse => !!t),
    [selectedIds, tripsById],
  );

  // Eligible trips: not already selected, not a bundle anchor, has at least one available seat.
  const eligibleTrips = useMemo(() => {
    const lower = search.trim().toLowerCase();
    return allMyTrips.filter((t) => {
      if (selectedIds.includes(t.trip_id)) return false;
      if ((t.member_trip_ids?.length ?? 0) > 0) return false;
      if ((t.available_seats ?? 0) <= 0) return false;
      if (lower.length === 0) return true;
      return (
        t.origin_city.toLowerCase().includes(lower) ||
        t.destination_city.toLowerCase().includes(lower) ||
        t.destination_province.toLowerCase().includes(lower)
      );
    });
  }, [allMyTrips, selectedIds, search]);

  const validation = useMemo(() => validateChain(orderedStops), [orderedStops]);

  const aggregateSummary = useMemo(() => {
    if (orderedStops.length === 0) return null;
    const totalPrice = orderedStops.reduce((sum, stop) => sum + Number(stop.price), 0);
    const minSeats = orderedStops.reduce(
      (acc, stop) => Math.min(acc, stop.available_seats ?? 0),
      Number.POSITIVE_INFINITY,
    );
    const route = [orderedStops[0].origin_city, ...orderedStops.map((s) => s.destination_city)].join(" → ");
    return { totalPrice, minSeats: minSeats === Number.POSITIVE_INFINITY ? 0 : minSeats, route };
  }, [orderedStops]);

  const createMutation = useMutation({
    mutationFn: () => createBundle(selectedIds),
    onSuccess: (anchor) => {
      toast.success("Tour package published", {
        description: `Travelers can now book ${anchor.origin_city} → ${anchor.destination_city} as a single trip.`,
      });
      navigate(`/trip/${anchor.trip_id}`);
    },
    onError: (err: Error) => {
      toast.error("Couldn't publish tour package", {
        description: err.message || "Please review the chain and try again.",
      });
    },
  });

  const addStop = (id: number) => setSelectedIds((prev) => [...prev, id]);
  const removeAt = (idx: number) =>
    setSelectedIds((prev) => prev.filter((_, i) => i !== idx));
  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setSelectedIds((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };
  const moveDown = (idx: number) => {
    setSelectedIds((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-heading font-bold text-heading sm:text-4xl">
            <Sparkles className="h-7 w-7 text-amber-500" />
            Tour Packages
          </h1>
          <p className="mt-1 text-sm text-body-text">
            Combine several of your trips into one continuous journey travelers can book in a
            single tap. Each stop must continue where the previous one ended.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/agent/manage-trips")}>
          Back to Manage Trips
        </Button>
      </div>

      <Card className="glass-card border-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="font-heading">Journey map</CardTitle>
          <CardDescription>
            Stops appear here as you add them. A continuous route is highlighted with a
            flowing trail across the country.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BundleRouteMap
            stops={orderedStops.map((s) => ({
              origin_city: s.origin_city,
              destination_city: s.destination_city,
              departure_time: s.departure_time,
            }))}
            showBanner={validation.ok && orderedStops.length >= 2}
            heightClassName="h-80 sm:h-96"
          />
        </CardContent>
      </Card>

      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="font-heading">How tour packages work</CardTitle>
          <CardDescription>
            The chain check below will guide you if anything doesn't line up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 gap-2 text-sm text-body-text sm:grid-cols-2">
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-accent" />At least 2 stops.</li>
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-accent" />Every stop must be one of your own trips.</li>
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-accent" />Each stop continues from where the previous one ended.</li>
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-accent" />The same route can appear only once in the package.</li>
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-accent" />Each stop starts on or after the previous stop arrives.</li>
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-accent" />Every stop must have seats available.</li>
          </ul>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT — eligible trips */}
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="font-heading">Your trips</CardTitle>
            <CardDescription>
              Pick the trips that make up the journey, in travel order.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search by city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}
            {!isLoading && eligibleTrips.length === 0 && (
              <p className="text-sm text-body-text">
                You have no trips that can be added right now. Create regular trips under
                Manage Trips first, then come back here to combine them.
              </p>
            )}
            <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
              {eligibleTrips.map((trip) => (
                <div
                  key={trip.trip_id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-heading">
                      {trip.origin_city} → {trip.destination_city}
                    </p>
                    <p className="text-xs text-body-text">
                      {friendlyTime(trip.departure_time)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{formatPkr(trip.price)}</Badge>
                      <Badge variant="outline">
                        {trip.available_seats}/{trip.total_seats} seats
                      </Badge>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => addStop(trip.trip_id)}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT — ordered stops */}
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="font-heading">
              The journey · {orderedStops.length} stop{orderedStops.length === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription>
              Reorder with the arrows. Pricing and seats update live.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {orderedStops.length === 0 && (
              <p className="text-sm text-body-text">
                Pick at least 2 trips from the left to start the journey.
              </p>
            )}

            <div className="space-y-2">
              {orderedStops.map((stop, idx) => (
                <div
                  key={`${stop.trip_id}-${idx}`}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-heading">
                      Stop {idx + 1}: {stop.origin_city} → {stop.destination_city}
                    </p>
                    <p className="text-xs text-body-text">
                      {friendlyTime(stop.departure_time)}
                    </p>
                    <p className="text-xs text-body-text">
                      {formatPkr(stop.price)} · {stop.available_seats}/{stop.total_seats} seats
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      aria-label="Move stop earlier"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => moveDown(idx)}
                      disabled={idx === orderedStops.length - 1}
                      aria-label="Move stop later"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeAt(idx)}
                      aria-label="Remove stop"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {aggregateSummary && (
              <div className="rounded-xl border border-border bg-background/40 p-4">
                <p className="text-sm font-medium text-heading">Package preview</p>
                <p className="mt-1 text-sm text-body-text">{aggregateSummary.route}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge>{formatPkr(aggregateSummary.totalPrice)} total</Badge>
                  <Badge variant="outline">
                    {aggregateSummary.minSeats} seat{aggregateSummary.minSeats === 1 ? "" : "s"} available
                  </Badge>
                </div>
              </div>
            )}

            {validation.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>The journey isn't valid yet</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-5">
                    {validation.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validation.ok && orderedStops.length >= 2 && (
              <Alert className="border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200">
                <Check className="h-4 w-4" />
                <AlertTitle>Continuous journey · ready to publish</AlertTitle>
                <AlertDescription>
                  Every stop continues from the previous one. Travelers will see this as one
                  seamless tour.
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full"
              disabled={!validation.ok || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Publishing..." : "Publish tour package"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
