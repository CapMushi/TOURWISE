import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addFavorite,
  getBundleLegs,
  getFavoriteStatus,
  getMyReviewForTrip,
  getTripById,
  getTripReviews,
  removeFavorite,
  upsertTripReview,
} from "@/lib/api";
import { format } from "date-fns";
import { formatPkr } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle, Check, MapPin, Calendar, Users, Banknote, Heart, ChevronLeft, ChevronRight, Star } from "lucide-react";
import heroImage from "@/assets/hero-tropical.jpg";
import { useToast } from "@/hooks/use-toast";
import { GoogleMapFromAddress } from "@/components/maps/GoogleMapFromAddress";
import BundleRouteMap from "@/components/BundleRouteMap";

export default function TripDetails() {
  const navigate = useNavigate();
  const { tripId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [tripRating, setTripRating] = useState(5);
  const [tripComment, setTripComment] = useState("");
  
  const tripIdNum = tripId ? parseInt(tripId, 10) : null;
  
  const { data: trip, isLoading, error } = useQuery({
    queryKey: ["trip", tripIdNum],
    queryFn: () => getTripById(tripIdNum!),
    enabled: !!tripIdNum,
  });

  const { data: favoriteStatus, refetch: refetchFavoriteStatus } = useQuery({
    queryKey: ["favorite-status", tripIdNum],
    queryFn: () => getFavoriteStatus(tripIdNum!),
    enabled: !!tripIdNum,
  });

  const { data: tripReviews = [] } = useQuery({
    queryKey: ["trip-reviews", tripIdNum],
    queryFn: () => getTripReviews(tripIdNum!),
    enabled: !!tripIdNum && !!trip && trip.source !== "external",
  });

  const { data: myTripReview } = useQuery({
    queryKey: ["my-trip-review", tripIdNum],
    queryFn: () => getMyReviewForTrip(tripIdNum!),
    enabled: !!tripIdNum && !!trip && trip.source !== "external",
  });

  const memberTripIds = trip?.member_trip_ids ?? [];
  const isBundleAnchor = memberTripIds.length >= 2;

  const { data: bundleLegs = [] } = useQuery({
    queryKey: ["trip-legs", tripIdNum],
    queryFn: () => getBundleLegs(tripIdNum!),
    enabled: !!tripIdNum && isBundleAnchor,
  });

  const averageTripRating = useMemo(() => {
    if (tripReviews.length === 0) return null;
    const total = tripReviews.reduce((sum, review) => sum + Number(review.rating), 0);
    return total / tripReviews.length;
  }, [tripReviews]);

  useEffect(() => {
    if (myTripReview) {
      setTripRating(Number(myTripReview.rating));
      setTripComment(myTripReview.comment ?? "");
    }
  }, [myTripReview]);

  const saveTripReviewMutation = useMutation({
    mutationFn: () =>
      upsertTripReview(tripIdNum!, {
        rating: tripRating,
        comment: tripComment.trim() || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Review saved", description: "Thanks for sharing your trip feedback." });
      queryClient.invalidateQueries({ queryKey: ["trip-reviews", tripIdNum] });
      queryClient.invalidateQueries({ queryKey: ["my-trip-review", tripIdNum] });
    },
    onError: (error: Error) => {
      toast({
        title: "Review failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="w-full h-[400px]" />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const departureDate = new Date(trip.departure_time);
  const arrivalDate = new Date(trip.arrival_time);
  const gallery = (trip.image_gallery && trip.image_gallery.length > 0)
    ? trip.image_gallery
    : [trip.image_url || heroImage];
  const heroSrc = gallery[selectedImage] || gallery[0] || heroImage;
  const durationDays = Math.ceil(
    (arrivalDate.getTime() - departureDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isExternal = trip.source === "external";
  const isAlmostFull =
    trip.available_seats > 0 &&
    trip.available_seats <= Math.max(3, Math.ceil(trip.total_seats * 0.2));
  const suitabilityLabel =
    trip.suitability && trip.suitability !== "Any" ? trip.suitability : null;
  const organizerLabel = trip.agent_name ?? (isExternal ? "External partner" : "TourWise travel agent");

  const showPreviousImage = () => {
    setSelectedImage((prev) => (prev === 0 ? gallery.length - 1 : prev - 1));
  };

  const showNextImage = () => {
    setSelectedImage((prev) => (prev === gallery.length - 1 ? 0 : prev + 1));
  };

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : "Trip not found"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleFavoriteToggle = async () => {
    if (!tripIdNum) return;
    if (trip?.source === "external") {
      toast({
        variant: "destructive",
        title: "Not available",
        description: "Wishlist is not available for external partner trips.",
      });
      return;
    }
    try {
      if (favoriteStatus?.is_favorited) {
        await removeFavorite(tripIdNum);
        toast({ title: "Removed from wishlist" });
      } else {
        await addFavorite(tripIdNum);
        toast({ title: "Added to wishlist" });
      }
      await refetchFavoriteStatus();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to update wishlist",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Image Gallery */}
      <div className="w-full h-[280px] overflow-hidden sm:h-[360px] lg:h-[400px]">
        <button className="h-full w-full" type="button" onClick={() => setLightboxOpen(true)}>
          <img 
            src={heroSrc}
            alt={`${trip.origin_city} to ${trip.destination_city}`}
            className="w-full h-full object-cover"
          />
        </button>
      </div>
      {gallery.length > 1 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="flex gap-3 overflow-x-auto">
            {gallery.map((img, idx) => (
              <button
                key={`${img}-${idx}`}
                onClick={() => setSelectedImage(idx)}
                type="button"
                className={`h-20 w-28 rounded-md overflow-hidden border-2 shrink-0 ${
                  selectedImage === idx ? "border-primary" : "border-transparent"
                }`}
              >
                <img src={img} alt={`Trip image ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Core Trip Details */}
          <Card className="glass-card border-0">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="font-heading text-2xl">
                  {trip.origin_city} → {trip.destination_city}
                </CardTitle>
                {isExternal && <Badge className="bg-sky-600 text-white">Partner Trip</Badge>}
                {isAlmostFull && <Badge className="bg-orange-500 text-white">Only {trip.available_seats} seats left</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">Trip ID:</span>
                <span>{trip.trip_id}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="font-medium">Destination:</span>
                <span>{trip.destination_city}, {trip.destination_province}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="font-medium">Origin:</span>
                <span>{trip.origin_city}</span>
              </div>
              <div>
                <span className="font-medium">Transport Type:</span>
                <span className="ml-2 capitalize">{trip.transport_type.replace("_", " ")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">Duration:</span>
                <span>{durationDays} {durationDays === 1 ? "Day" : "Days"}</span>
              </div>
              <div>
                <span className="font-medium">Trip Dates:</span>
                <span className="ml-2">{format(departureDate, "MMMM dd")} - {format(arrivalDate, "MMMM dd, yyyy")}</span>
              </div>
              <div>
                <span className="font-medium">Departure:</span>
                <span className="ml-2">{format(departureDate, "PPp")}</span>
              </div>
              <div>
                <span className="font-medium">Arrival:</span>
                <span className="ml-2">{format(arrivalDate, "PPp")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="font-medium">Available Seats:</span>
                <span>{trip.available_seats} / {trip.total_seats}</span>
              </div>
            </CardContent>
          </Card>

          {/* Itinerary (bundle anchors only) — traveler view */}
          {isBundleAnchor && (
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500" />
                  Your journey · {memberTripIds.length} stops
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-body-text">
                  One booking secures your seat on every stop below — confirmed end-to-end.
                </p>
                <div className="mb-5">
                  <BundleRouteMap
                    stops={bundleLegs.map((leg) => ({
                      origin_city: leg.origin_city,
                      destination_city: leg.destination_city,
                      departure_time: leg.departure_time,
                    }))}
                    heightClassName="h-72 sm:h-80"
                  />
                </div>
                <Accordion type="single" collapsible className="space-y-2">
                  {bundleLegs.map((leg, idx) => (
                    <AccordionItem
                      key={leg.trip_id}
                      value={`stop-${leg.trip_id}`}
                      className="rounded-lg border border-border bg-background/40 px-3"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex w-full flex-wrap items-center justify-between gap-2 pr-2 text-left">
                          <div>
                            <p className="text-sm font-semibold text-heading">
                              Stop {idx + 1} · {leg.origin_city} → {leg.destination_city}
                            </p>
                            <p className="text-xs text-body-text">
                              {format(new Date(leg.departure_time), "EEE, MMM d · h:mm a")}
                            </p>
                          </div>
                          <Badge variant="outline">{formatPkr(leg.price)}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-1.5 pb-2 text-sm text-body-text">
                          <p>
                            <span className="font-medium text-heading">Travel by:</span>{" "}
                            <span className="capitalize">{leg.transport_type.replace("_", " ")}</span>
                          </p>
                          <p>
                            <span className="font-medium text-heading">Departs:</span>{" "}
                            {format(new Date(leg.departure_time), "EEE, MMM d · h:mm a")}
                          </p>
                          <p>
                            <span className="font-medium text-heading">Arrives:</span>{" "}
                            {format(new Date(leg.arrival_time), "EEE, MMM d · h:mm a")}
                          </p>
                          {leg.agent_name && (
                            <p>
                              <span className="font-medium text-heading">Travel partner:</span>{" "}
                              {leg.agent_name}
                            </p>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}

          {/* Booking Snapshot */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">Booking Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" />
                <p className="text-xl font-bold text-primary">
                  {formatPkr(trip.price)} per traveler
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{trip.available_seats} seats open</Badge>
                <Badge variant="outline">Organized by {organizerLabel}</Badge>
                {suitabilityLabel && <Badge variant="outline">Best for {suitabilityLabel}</Badge>}
                <Badge variant="outline">{isExternal ? "Partner fulfillment" : "Booked in TourWise"}</Badge>
              </div>
              <div className="rounded-xl border border-border bg-background/40 p-4">
                <h4 className="mb-2 font-medium">What this listing confirms right now</h4>
                <ul className="space-y-2 text-sm text-body-text">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-accent" />
                    <span>
                      Your confirmed basics are the route, schedule, transport type, current price, and
                      live seat availability shown on this page.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-accent" />
                    <span>
                      Traveler reviews and the organizer profile are available so you can judge confidence
                      before you book.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-accent" />
                    <span>
                      Extra items like room setup, meals, pickup point, and baggage details may vary by
                      listing and should be confirmed if they matter for your trip.
                    </span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Timing Overview */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">Trip Timing Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 glass-panel rounded-lg border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-body-text">Transport Type</p>
                    <p className="font-bold text-lg capitalize">{trip.transport_type.replace("_", " ")}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-bold text-lg">TW</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-body-text mb-1">Route</p>
                    <p className="font-bold text-primary">{trip.origin_city} → {trip.destination_city}</p>
                  </div>
                  <div>
                    <p className="text-xs text-body-text mb-1">Duration</p>
                    <p className="font-medium">{durationDays} {durationDays === 1 ? "Day" : "Days"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                  <div>
                    <p className="text-xs text-body-text mb-1">Departure</p>
                    <p className="font-bold">{format(departureDate, "h:mm a")}</p>
                    <p className="text-xs text-body-text">{trip.origin_city}</p>
                    <p className="text-xs text-body-text">{format(departureDate, "MMM dd, yyyy")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-body-text mb-1">Arrival</p>
                    <p className="font-bold">{format(arrivalDate, "h:mm a")}</p>
                    <p className="text-xs text-body-text">{trip.destination_city}</p>
                    <p className="text-xs text-body-text">{format(arrivalDate, "MMM dd, yyyy")}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-body-text leading-relaxed">
                    Treat this as your route and timing summary. Stop-by-stop activities or lodging details
                    are not guaranteed unless the organizer explicitly provides them.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-8 md:grid-cols-2">
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="font-heading">What To Confirm Before You Book</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-body-text">
                <p>Meeting point and check-in instructions for your departure day.</p>
                <p>What luggage, gear, or transport-specific limits apply to this trip.</p>
                <p>Whether accommodation, meals, or guided activities are part of the price.</p>
                <p>Any traveler requirements that matter for families, couples, or solo travelers.</p>
              </CardContent>
            </Card>

            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="font-heading">Why Travelers Can Judge Faster</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-body-text">
                <p>
                  This page shows real departure timing, live seat counts, and organizer details instead of
                  a generic package description.
                </p>
                <p>
                  You can review the agent profile, compare similar listings, and read traveler reviews
                  before committing.
                </p>
                <p>
                  If something important is not shown here yet, it is better to clarify it before checkout
                  than assume it is included.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Itinerary */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">🗓️ Detailed Itinerary</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {Array.from({ length: durationDays }, (_, index) => {
                  const dayNumber = index + 1;
                  const currentDate = new Date(departureDate);
                  currentDate.setDate(departureDate.getDate() + index);
                  
                  let dayTitle = "";
                  if (dayNumber === 1) {
                    dayTitle = `Day ${dayNumber}: Departure & Arrival`;
                  } else if (dayNumber === durationDays) {
                    dayTitle = `Day ${dayNumber}: Leisure & Return`;
                  } else {
                    dayTitle = `Day ${dayNumber}: ${format(currentDate, "MMMM dd")}`;
                  }
                  
                  return (
                    <AccordionItem key={dayNumber} value={`day${dayNumber}`}>
                      <AccordionTrigger>{dayTitle}</AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-2 ml-4">
                          {dayNumber === 1 && (
                            <>
                              <li>• {format(departureDate, "h:mm a")} - Depart from {trip.origin_city}</li>
                              <li>• Travel toward {trip.destination_city} using the listed {trip.transport_type.replace("_", " ")}</li>
                              <li>• Arrive by {format(arrivalDate, "h:mm a")} and review organizer instructions for the rest of the day</li>
                            </>
                          )}
                          {dayNumber > 1 && dayNumber < durationDays && (
                            <>
                              <li>• Keep this day flexible for the activities or stops confirmed by the organizer</li>
                              <li>• Recheck transport timing, meeting locations, and any lodging details for this leg</li>
                              <li>• Use your booking details and organizer profile if you need to confirm logistics</li>
                            </>
                          )}
                          {dayNumber === durationDays && (
                            <>
                              <li>• Finalize your return timing with the organizer if there are multiple stops</li>
                              <li>• Make your way back toward {trip.origin_city}</li>
                              <li>• {format(arrivalDate, "h:mm a")} - Arrive back at {trip.origin_city}</li>
                            </>
                          )}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>

          {/* Booking & Policies */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">Booking Confidence Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-body-text">
              <p>
                Seat availability is live at the moment you open this page, but final confirmation still
                depends on those seats remaining when you submit your booking.
              </p>
              <p>
                TourWise collects passenger details and special requests during checkout so the organizer has
                the information needed to fulfill your booking.
              </p>
              <p>
                If you are booking a partner trip, payment and booking still happen in TourWise while trip
                fulfillment is handled by the external provider.
              </p>
              <p>
                If plans change, manage the booking from your bookings area and review the latest status there
                instead of assuming a fixed refund rule.
              </p>
            </CardContent>
          </Card>

          {!isExternal && (
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="font-heading flex flex-wrap items-center gap-3">
                  Traveler Reviews
                  {averageTripRating != null && (
                    <span className="text-sm font-normal text-body-text">
                      {averageTripRating.toFixed(1)} / 5 from {tripReviews.length} review{tripReviews.length === 1 ? "" : "s"}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-xl border border-border bg-background/40 p-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Rate this trip</Label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Button
                          key={value}
                          type="button"
                          variant={tripRating === value ? "default" : "outline"}
                          onClick={() => setTripRating(value)}
                        >
                          {value}
                          <Star className="ml-2 h-4 w-4" />
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trip-review">Share your experience</Label>
                    <Textarea
                      id="trip-review"
                      value={tripComment}
                      onChange={(e) => setTripComment(e.target.value)}
                      rows={4}
                      placeholder="What stood out about the trip, logistics, and overall experience?"
                    />
                  </div>
                  <Button
                    onClick={() => saveTripReviewMutation.mutate()}
                    disabled={saveTripReviewMutation.isPending}
                  >
                    {saveTripReviewMutation.isPending
                      ? "Saving..."
                      : myTripReview
                        ? "Update Trip Review"
                        : "Submit Trip Review"}
                  </Button>
                </div>

                {tripReviews.length === 0 ? (
                  <div className="rounded-xl border border-border bg-background/40 p-6 text-center text-body-text">
                    No reviews yet. Be the first traveler to review this trip.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tripReviews.map((review) => (
                      <div key={review.review_id} className="rounded-xl border border-border bg-background/40 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium text-heading">{review.username || "Traveler"}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(review.created_at), "MMM dd, yyyy")}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            {Number(review.rating).toFixed(1)} / 5
                          </div>
                        </div>
                        {review.comment && (
                          <p className="mt-3 text-sm leading-relaxed text-body-text">{review.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Sticky Booking Card */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="font-heading">Reserve Your Seats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {trip.available_seats === 0 ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      This trip is currently fully booked.
                    </AlertDescription>
                  </Alert>
                ) : isAlmostFull ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Seats are going fast. Only {trip.available_seats} of {trip.total_seats} remain.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {isExternal && (
                  <Alert>
                    <AlertDescription>
                      This is a partner-provided trip. Booking still happens inside TourWise, but fulfillment is handled by the external provider.
                    </AlertDescription>
                  </Alert>
                )}

                {trip.agent_name && (
                  <div>
                    <p className="text-sm text-body-text mb-1">Organized by</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-medium">{trip.agent_name}</p>
                      {trip.agent_id > 0 && (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0"
                          onClick={() => navigate(`/agents/${trip.agent_id}`)}
                        >
                          View agent profile
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {!isExternal && (
                  <div className="rounded-xl border border-border bg-background/40 p-3 text-sm text-body-text">
                    Booking stays inside TourWise, and you can review the organizer profile before checkout.
                  </div>
                )}
                
                <div className="border-t border-border pt-4">
                  <p className="text-3xl font-bold text-primary">
                    {formatPkr(trip.price)}
                  </p>
                  <p className="text-sm text-body-text">per person (PKR)</p>
                  <p className="mt-2 text-xs text-body-text">
                    {trip.available_seats} of {trip.total_seats} seats currently open
                    {tripReviews.length > 0 ? ` • ${tripReviews.length} traveler review${tripReviews.length === 1 ? "" : "s"}` : ""}
                  </p>
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => navigate(`/booking/${trip.trip_id}`)}
                  disabled={trip.available_seats === 0}
                >
                  {trip.available_seats === 0 ? "Fully Booked" : "Book Now"}
                </Button>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleFavoriteToggle}
                  disabled={trip.source === "external"}
                >
                  <Heart className={`h-4 w-4 mr-2 ${favoriteStatus?.is_favorited ? "fill-current" : ""}`} />
                  {trip.source === "external"
                    ? "Wishlist (external trips)"
                    : favoriteStatus?.is_favorited
                      ? "Remove from Wishlist"
                      : "Add to Wishlist"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-5xl border-0 bg-black/95 p-3 sm:p-6">
          <div className="relative flex items-center justify-center">
            {gallery.length > 1 && (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2"
                onClick={showPreviousImage}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <img
              src={heroSrc}
              alt={`${trip.origin_city} to ${trip.destination_city}`}
              className="max-h-[75vh] w-full rounded-lg object-contain"
            />
            {gallery.length > 1 && (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2"
                onClick={showNextImage}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-4 flex gap-3 overflow-x-auto">
              {gallery.map((img, idx) => (
                <button
                  key={`${img}-lightbox-${idx}`}
                  type="button"
                  onClick={() => setSelectedImage(idx)}
                  className={`h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 ${
                    selectedImage === idx ? "border-primary" : "border-transparent"
                  }`}
                >
                  <img src={img} alt={`Gallery ${idx + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

