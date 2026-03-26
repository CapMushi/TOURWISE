import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { addFavorite, getFavoriteStatus, getTripById, removeFavorite } from "@/lib/api";
import { format } from "date-fns";
import { formatPkr } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Check, X, MapPin, Calendar, Users, Banknote, Heart } from "lucide-react";
import heroImage from "@/assets/hero-tropical.jpg";
import { useToast } from "@/hooks/use-toast";

export default function TripDetails() {
  const navigate = useNavigate();
  const { tripId } = useParams();
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState(0);
  
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

  const departureDate = new Date(trip.departure_time);
  const arrivalDate = new Date(trip.arrival_time);
  const gallery = (trip.image_gallery && trip.image_gallery.length > 0)
    ? trip.image_gallery
    : [trip.image_url || heroImage];
  const heroSrc = gallery[selectedImage] || gallery[0] || heroImage;
  const durationDays = Math.ceil(
    (arrivalDate.getTime() - departureDate.getTime()) / (1000 * 60 * 60 * 24)
  );

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
      <div className="w-full h-[400px] overflow-hidden">
        <img 
          src={heroSrc}
          alt={`${trip.origin_city} to ${trip.destination_city}`}
          className="w-full h-full object-cover"
        />
      </div>
      {gallery.length > 1 && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="flex gap-3 overflow-x-auto">
            {gallery.map((img, idx) => (
              <button
                key={`${img}-${idx}`}
                onClick={() => setSelectedImage(idx)}
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
      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Core Trip Details */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading text-2xl">
                {trip.origin_city} → {trip.destination_city}
              </CardTitle>
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

          {/* Pricing and Inclusions */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">💰 Pricing and Inclusions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" />
                <p className="text-xl font-bold text-primary">
                  {formatPkr(trip.price)} per person (PKR)
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Inclusions:</h4>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-accent" />
                    <span>Accommodation (Twin-share)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-accent" />
                    <span>Breakfast daily, 2 Dinners</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-accent" />
                    <span>All listed guided tours</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-accent" />
                    <span>Park entry fees</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-accent" />
                    <span>Local transportation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-accent" />
                    <span className="flex items-center gap-1">
                      <span className="px-2 py-0.5 bg-primary/20 text-primary rounded-full text-xs font-medium">Flight Included</span>
                      International flight coverage
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Exclusions:</h4>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2">
                    <X className="h-4 w-4 text-destructive" />
                    <span>Meals not listed</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <X className="h-4 w-4 text-destructive" />
                    <span>Personal expenses</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <X className="h-4 w-4 text-destructive" />
                    <span>Travel insurance</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <X className="h-4 w-4 text-destructive" />
                    <span>Tips</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Bus Itinerary */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">🚌 Bus Itinerary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 glass-panel rounded-lg border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-body-text">Transport Type</p>
                    <p className="font-bold text-lg capitalize">{trip.transport_type.replace("_", " ")}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-bold text-lg">🚌</span>
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
                  <p className="text-xs text-body-text">
                    <span className="font-medium">Available Seats:</span> {trip.available_seats} / {trip.total_seats} | 
                    <span className="font-medium ml-2">Status:</span> <span className="text-accent">
                      {trip.available_seats > 0 ? "Available" : "Fully Booked"}
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transportation & Logistics */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">🚗 Transportation & Logistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p><span className="font-medium">Primary Transport Mode:</span> Carpooling / Self-Drive</p>
              <p><span className="font-medium">Meeting Point:</span> Central Plaza, Lahore</p>
              <p><span className="font-medium">Departure/Return Time:</span> Fri 6:00 AM / Sun 8:00 PM</p>
              
              <div>
                <h4 className="font-medium mb-2">Carpooling Options:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• Passenger Option: {formatPkr(69500)} (need a ride)</li>
                  <li>• Driver Option: {formatPkr(61200)} (drive and take passengers)</li>
                  <li>• Self-Drive Option: {formatPkr(65300)} (drive alone)</li>
                </ul>
              </div>
              
              <p className="text-sm text-body-text">Agent will coordinate via WhatsApp group 2 days prior.</p>
            </CardContent>
          </Card>

          {/* Accommodation & Meals */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">🏨 Accommodation & Meals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p><span className="font-medium">Accommodation Type:</span> Guesthouse</p>
              <p><span className="font-medium">Rooming Basis:</span> Twin-share basis</p>
              <p><span className="font-medium">Meal Plan:</span> Breakfast & Dinner included</p>
              <p className="text-sm text-body-text">Please specify any dietary restrictions at booking.</p>
            </CardContent>
          </Card>

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
                              <li>• Check-in at accommodation</li>
                              <li>• Welcome dinner & trip briefing</li>
                            </>
                          )}
                          {dayNumber > 1 && dayNumber < durationDays && (
                            <>
                              <li>• 7:00 AM - Breakfast</li>
                              <li>• Morning activities and sightseeing</li>
                              <li>• 1:00 PM - Lunch</li>
                              <li>• Afternoon activities</li>
                              <li>• 7:00 PM - Group dinner</li>
                            </>
                          )}
                          {dayNumber === durationDays && (
                            <>
                              <li>• 7:00 AM - Breakfast</li>
                              <li>• Morning leisure time</li>
                              <li>• Check-out from accommodation</li>
                              <li>• Begin return journey</li>
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
              <CardTitle className="font-heading">🔒 Booking & Policies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p><span className="font-medium">Group Size:</span> Min 10, Max 20</p>
              <p><span className="font-medium">Booking Deadline:</span> October 20, 2025</p>
              <p><span className="font-medium">Cancellation Policy:</span> Full refund 14 days prior. 50% refund 7-13 days prior. No refund within 7 days.</p>
              <p><span className="font-medium">What to Pack:</span> Hiking boots, warm jacket, water bottle</p>
              <p><span className="font-medium">Emergency Contact:</span> +92 300 1234567</p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sticky Booking Card */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="font-heading">Book This Trip</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {trip.agent_name && (
                  <div>
                    <p className="text-sm text-body-text mb-1">Organized by</p>
                    <p className="font-medium">{trip.agent_name}</p>
                  </div>
                )}
                
                <div className="border-t border-border pt-4">
                  <p className="text-3xl font-bold text-primary">
                    {formatPkr(trip.price)}
                  </p>
                  <p className="text-sm text-body-text">per person (PKR)</p>
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
    </div>
  );
}

