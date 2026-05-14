import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTripById,
  updateTrip,
  uploadTripImage,
  getCollaboratorInvites,
  createCollaboratorInvite,
  updateCollaboratorInvite,
  type CollaboratorInvite,
} from "@/lib/api";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Heart, UsersRound, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getTripResources,
  busPnr,
  hotelConfCode,
  totalImportedSeats,
  type TripResourcesPayload,
} from "@/lib/tripResourcesStorage";
import { formatPkr } from "@/lib/currency";

const TRIP_RESOURCES_EVENT = "tourwise-trip-resources-changed";

export default function ManageDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const tripIdNum = id ? parseInt(id, 10) : null;
  
  const { data: trip, isLoading, error } = useQuery({
    queryKey: ["trip", tripIdNum],
    queryFn: () => getTripById(tripIdNum!),
    enabled: !!tripIdNum,
  });

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [collaboratorInput, setCollaboratorInput] = useState("");
  const [collaboratorError, setCollaboratorError] = useState("");
  const [linkedResources, setLinkedResources] = useState<TripResourcesPayload>({
    buses: [],
    hotels: [],
  });

  const refreshLinkedResources = useCallback(() => {
    if (tripIdNum) setLinkedResources(getTripResources(tripIdNum));
  }, [tripIdNum]);

  useEffect(() => {
    refreshLinkedResources();
  }, [refreshLinkedResources]);

  useEffect(() => {
    const onResourcesChanged = () => refreshLinkedResources();
    window.addEventListener(TRIP_RESOURCES_EVENT, onResourcesChanged);
    return () => window.removeEventListener(TRIP_RESOURCES_EVENT, onResourcesChanged);
  }, [refreshLinkedResources]);

  // Show "add collaborators" hint when arriving from AddTrip
  useEffect(() => {
    if ((location.state as any)?.newTrip) {
      toast({ title: "Trip created!", description: "You can now add collaborators below." });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Collaborator invites for this trip
  const { data: collaboratorInvites, refetch: refetchInvites } = useQuery({
    queryKey: ["collab-invites", "sent", tripIdNum],
    queryFn: () => getCollaboratorInvites("sent", tripIdNum!),
    enabled: !!tripIdNum,
    retry: 1,
  });

  const addCollaboratorMutation = useMutation({
    mutationFn: (identifier: string) =>
      createCollaboratorInvite({ trip_id: tripIdNum!, collaborating_identifier: identifier }),
    onSuccess: () => {
      toast({ title: "Invite sent!", description: "The agent will see your invite in their notifications." });
      setCollaboratorInput("");
      setCollaboratorError("");
      refetchInvites();
    },
    onError: (err: any) => {
      setCollaboratorError(err.message || "Agent not found. Try their exact username or agent ID.");
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (inviteId: number) => updateCollaboratorInvite(inviteId, "cancelled"),
    onSuccess: () => { refetchInvites(); },
  });

  // Pre-populated with existing trip data
  const [formData, setFormData] = useState({
    tripName: "",
    tripId: "",
    destination: "",
    tripType: "",
    duration: "",
    dates: "",
    suitability: undefined as string | undefined,
    physicalRating: "moderate",
    basePrice: "",
    inclusions: "",
    exclusions: "",
    transportMode: "",
    meetingPoint: "",
    departureTime: "",
    accommodationType: "",
    accommodationName: "",
    roomingBasis: "",
    mealPlan: "",
    itinerary: "",
    minGroupSize: "",
    maxGroupSize: "",
    bookingDeadline: "",
    cancellationPolicy: "",
    whatToPack: "",
    emergencyContact: "",
  });

  // Ensure suitability is always a valid string for Select component
  const suitabilityValue = formData.suitability || "any";

  // Populate form when trip data is loaded
  useEffect(() => {
    if (trip) {
      setImagePreview(trip.image_url || null);
      const departureDate = new Date(trip.departure_time);
      const arrivalDate = new Date(trip.arrival_time);
      const durationDays = Math.ceil(
        (arrivalDate.getTime() - departureDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      setFormData({
        tripName: `${trip.origin_city} → ${trip.destination_city}`,
        tripId: trip.trip_id.toString(),
        destination: `${trip.destination_city}, ${trip.destination_province}`,
        tripType: trip.transport_type.replace("_", " "),
        duration: `${durationDays} ${durationDays === 1 ? "Day" : "Days"}`,
        dates: `${format(departureDate, "MMMM dd")} - ${format(arrivalDate, "MMMM dd, yyyy")}`,
        suitability: trip.suitability || undefined,
        physicalRating: "moderate",
        basePrice: parseFloat(trip.price.toString()).toFixed(2),
        inclusions: "",
        exclusions: "",
        transportMode: trip.transport_type.replace("_", " "),
        meetingPoint: trip.origin_city,
        departureTime: `${format(departureDate, "PPp")} - ${format(arrivalDate, "PPp")}`,
        accommodationType: "",
        accommodationName: "",
        roomingBasis: "",
        mealPlan: "",
        itinerary: "",
        minGroupSize: "",
        maxGroupSize: trip.total_seats.toString(),
        bookingDeadline: "",
        cancellationPolicy: "",
        whatToPack: "",
        emergencyContact: "",
      });
    }
  }, [trip]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tripIdNum) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Upload to Supabase Storage
      const imageUrl = await uploadTripImage(file, tripIdNum);
      
      // Update trip with image URL
      await updateTrip(tripIdNum, { image_url: imageUrl });
      
      // Update local state
      setImagePreview(imageUrl);
      
      // Refresh trip data
      queryClient.invalidateQueries({ queryKey: ["trip", tripIdNum] });
      queryClient.invalidateQueries({ queryKey: ["my-trips"] });
      
      toast({
        title: "Image uploaded successfully",
        description: "The trip image has been updated",
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Save updated trip (in a real app, this would save to backend)
    navigate("/agent/manage-trips");
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : "Trip not found"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-heading font-bold text-heading mb-8">
        Manage Details: {formData.tripName || `${trip.origin_city} → ${trip.destination_city}`}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Core Trip Details */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Core Trip Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tripName">Trip Name</Label>
                <Input
                  id="tripName"
                  value={formData.tripName}
                  onChange={(e) => setFormData({ ...formData, tripName: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tripId">Trip ID</Label>
                <Input
                  id="tripId"
                  value={formData.tripId}
                  onChange={(e) => setFormData({ ...formData, tripId: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination">Destination(s)</Label>
                <Input
                  id="destination"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tripType">Trip Type</Label>
                <Input
                  id="tripType"
                  value={formData.tripType}
                  onChange={(e) => setFormData({ ...formData, tripType: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration</Label>
                <Input
                  id="duration"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dates">Trip Dates</Label>
                <Input
                  id="dates"
                  value={formData.dates}
                  onChange={(e) => setFormData({ ...formData, dates: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="physicalRating">Physical Rating</Label>
                <Select value={formData.physicalRating} onValueChange={(value) => setFormData({ ...formData, physicalRating: value })}>
                  <SelectTrigger className="glass-panel border-white/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/30 bg-white/95 backdrop-blur-glass z-50">
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="challenging">Challenging</SelectItem>
                    <SelectItem value="strenuous">Strenuous</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="suitability" className="flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Suitability
                </Label>
                <Select 
                  value={suitabilityValue} 
                  onValueChange={(value) => setFormData({ ...formData, suitability: value === "any" ? undefined : value })}
                >
                  <SelectTrigger className="glass-panel border-white/30">
                    <SelectValue placeholder="Select suitability" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/30 bg-white/95 backdrop-blur-glass z-50">
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="Solo Travelers">Solo Travelers</SelectItem>
                    <SelectItem value="Families">Families</SelectItem>
                    <SelectItem value="Couples">Couples</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing and Inclusions */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Pricing and Inclusions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="basePrice">Base price per person (PKR)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rs</span>
                  <Input
                    id="basePrice"
                    type="number"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    className="glass-panel border-white/30 pl-12"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
            <div className="space-y-2">
              <Label htmlFor="inclusions">Inclusions (one per line)</Label>
              <Textarea
                id="inclusions"
                rows={5}
                value={formData.inclusions}
                onChange={(e) => setFormData({ ...formData, inclusions: e.target.value })}
                className="glass-panel border-white/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exclusions">Exclusions (one per line)</Label>
              <Textarea
                id="exclusions"
                rows={5}
                value={formData.exclusions}
                onChange={(e) => setFormData({ ...formData, exclusions: e.target.value })}
                className="glass-panel border-white/30"
              />
            </div>
          </CardContent>
        </Card>

        {/* Operations & optimization (from Resource Inventory) */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Operations &amp; optimization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-body-text">
              Imported bus capacity vs listing seats helps you avoid over-selling ground transport.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Trip seats</p>
                <p className="text-2xl font-heading font-bold text-heading">{trip.total_seats}</p>
                <p className="text-xs text-body-text mt-1">{trip.available_seats} available</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/10 border border-secondary/20">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Imported bus seats</p>
                <p className="text-2xl font-heading font-bold text-heading">
                  {totalImportedSeats(linkedResources)}
                </p>
                <p className="text-xs text-body-text mt-1">
                  {linkedResources.buses.length} service{linkedResources.buses.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Hotels linked</p>
                <p className="text-2xl font-heading font-bold text-heading">
                  {linkedResources.hotels.length}
                </p>
                <p className="text-xs text-body-text mt-1">From inventory</p>
              </div>
            </div>
            {linkedResources.buses.length > 0 &&
              totalImportedSeats(linkedResources) < trip.total_seats && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Imported bus seats are below total trip seats — add more bus services or adjust marketing.
                </p>
              )}
          </CardContent>
        </Card>

        {/* Transportation & Logistics */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Transportation & Logistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {linkedResources.buses.length > 0 && (
              <div className="p-4 rounded-lg border border-white/30 bg-white/5 space-y-2">
                <p className="text-sm font-medium text-heading">Ground transport (from inventory)</p>
                <ul className="space-y-2 text-sm text-body-text">
                  {linkedResources.buses.map((b) => (
                    <li key={b.id}>
                      <span className="font-medium text-heading">{b.operator}</span> {b.serviceNumber} —{" "}
                      {b.route} ({b.departure}–{b.arrival}, {b.duration}, {b.seats} seats)
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transportMode">Primary Transport Mode</Label>
                <Input
                  id="transportMode"
                  value={formData.transportMode}
                  onChange={(e) => setFormData({ ...formData, transportMode: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meetingPoint">Meeting Point</Label>
                <Input
                  id="meetingPoint"
                  value={formData.meetingPoint}
                  onChange={(e) => setFormData({ ...formData, meetingPoint: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="departureTime">Departure/Return Time</Label>
                <Input
                  id="departureTime"
                  value={formData.departureTime}
                  onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accommodation & Meals */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Accommodation & Meals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accommodationType">Accommodation Type</Label>
                <Input
                  id="accommodationType"
                  value={formData.accommodationType}
                  onChange={(e) => setFormData({ ...formData, accommodationType: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accommodationName">Accommodation Name</Label>
                <Input
                  id="accommodationName"
                  value={formData.accommodationName}
                  onChange={(e) => setFormData({ ...formData, accommodationName: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roomingBasis">Rooming Basis</Label>
                <Input
                  id="roomingBasis"
                  value={formData.roomingBasis}
                  onChange={(e) => setFormData({ ...formData, roomingBasis: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mealPlan">Meal Plan</Label>
                <Input
                  id="mealPlan"
                  value={formData.mealPlan}
                  onChange={(e) => setFormData({ ...formData, mealPlan: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Itinerary */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Detailed Itinerary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="itinerary">Day-by-Day Itinerary</Label>
              <Textarea
                id="itinerary"
                rows={8}
                value={formData.itinerary}
                onChange={(e) => setFormData({ ...formData, itinerary: e.target.value })}
                className="glass-panel border-white/30"
              />
            </div>
          </CardContent>
        </Card>

        {/* Booking & Policies */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Booking & Policies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minGroupSize">Min Group Size</Label>
                <Input
                  id="minGroupSize"
                  type="number"
                  value={formData.minGroupSize}
                  onChange={(e) => setFormData({ ...formData, minGroupSize: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxGroupSize">Max Group Size (Total Seats)</Label>
                <Input
                  id="maxGroupSize"
                  type="number"
                  value={formData.maxGroupSize}
                  onChange={(e) => setFormData({ ...formData, maxGroupSize: e.target.value })}
                  className="glass-panel border-white/30"
                  min="1"
                />
                <p className="text-xs text-muted-foreground">
                  Current: {trip.total_seats} total seats, {trip.available_seats} available
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bookingDeadline">Booking Deadline</Label>
                <Input
                  id="bookingDeadline"
                  value={formData.bookingDeadline}
                  onChange={(e) => setFormData({ ...formData, bookingDeadline: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContact">Emergency Contact</Label>
                <Input
                  id="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="cancellationPolicy">Cancellation Policy</Label>
                <Textarea
                  id="cancellationPolicy"
                  rows={3}
                  value={formData.cancellationPolicy}
                  onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="whatToPack">What to Pack</Label>
                <Textarea
                  id="whatToPack"
                  rows={3}
                  value={formData.whatToPack}
                  onChange={(e) => setFormData({ ...formData, whatToPack: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Travel Logistics & PNR */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Travel Logistics &amp; PNR</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" variant="secondary" onClick={() => navigate("/agent/resource-inventory")}>
              Import bus / hotel from inventory
            </Button>
            <p className="text-xs text-muted-foreground">
              PNR-style references are generated for resources you attach in Resource Inventory for this trip
              (#{trip.trip_id}).
            </p>
            {linkedResources.buses.length === 0 && linkedResources.hotels.length === 0 ? (
              <div className="p-6 rounded-lg border border-dashed border-white/30 text-center text-body-text text-sm">
                No resources linked yet. Choose your trip in Resource Inventory, add buses or hotels, then return
                here.
              </div>
            ) : (
              <div className="space-y-3">
                {linkedResources.buses.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 bg-primary/10 rounded-lg border border-primary/20 space-y-1"
                  >
                    <p className="text-sm font-semibold text-heading">
                      Bus — {b.operator} ({b.serviceNumber})
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">PNR / ref: {busPnr(b)}</p>
                    <p className="text-sm text-body-text">
                      {b.route} · {b.departure}–{b.arrival} · {b.coachClass} · {formatPkr(b.price)} indicative
                    </p>
                  </div>
                ))}
                {linkedResources.hotels.map((h) => (
                  <div
                    key={h.id}
                    className="p-4 bg-accent/10 rounded-lg border border-accent/20 space-y-1"
                  >
                    <p className="text-sm font-semibold text-heading">
                      Hotel — {h.name} ({h.stars}★, {h.roomType})
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Confirmation code: {hotelConfCode(h)}
                    </p>
                    <p className="text-sm text-body-text">
                      {h.address} · {formatPkr(h.pricePerNight)}/night
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Image Upload Section */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Trip Image</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {imagePreview && (
                <div className="relative w-full h-64 rounded-lg overflow-hidden border-2 border-primary/30">
                  <img 
                    src={imagePreview} 
                    alt="Trip preview" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="images">Upload Trip Image</Label>
                <Input
                  id="images"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                  className="glass-panel border-white/30"
                />
                {isUploading && (
                  <p className="text-sm text-muted-foreground">Uploading image...</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Upload an image to display on trip cards and details page (max 5MB)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collaborators */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-primary" />
              <CardTitle className="font-heading text-2xl">Collaborators</CardTitle>
            </div>
            <CardDescription>
              Invite other travel agents to collaborate on this trip. They will receive a notification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Current invites */}
            {collaboratorInvites && collaboratorInvites.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-heading">Current collaborators & invites</p>
                {collaboratorInvites.map((invite) => (
                  <div
                    key={invite.invite_id}
                    className="flex items-center justify-between p-3 rounded-lg border border-white/20 bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      {invite.status === "accepted" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {invite.status === "pending" && <Clock className="h-4 w-4 text-yellow-500" />}
                      {invite.status === "rejected" && <XCircle className="h-4 w-4 text-red-500" />}
                      {invite.status === "cancelled" && <XCircle className="h-4 w-4 text-gray-400" />}
                      <span className="text-sm font-medium">{invite.collaborating_agent_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          invite.status === "accepted"
                            ? "border-green-300 text-green-700"
                            : invite.status === "pending"
                            ? "border-yellow-300 text-yellow-700"
                            : "border-gray-300 text-gray-500"
                        }
                      >
                        {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                      </Badge>
                      {invite.status === "pending" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => cancelInviteMutation.mutate(invite.invite_id)}
                          disabled={cancelInviteMutation.isLoading}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-body-text">No collaborators yet.</p>
            )}

            {/* Add new collaborator */}
            <div className="space-y-2">
              <Label htmlFor="collaborator-input">Add collaborator (username or agent ID)</Label>
              <div className="flex gap-2">
                <Input
                  id="collaborator-input"
                  placeholder="e.g., johnsmith or 42"
                  value={collaboratorInput}
                  onChange={(e) => { setCollaboratorInput(e.target.value); setCollaboratorError(""); }}
                  className="glass-panel border-white/30"
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (!collaboratorInput.trim()) {
                      setCollaboratorError("Please enter a username or agent ID.");
                      return;
                    }
                    addCollaboratorMutation.mutate(collaboratorInput.trim());
                  }}
                  disabled={addCollaboratorMutation.isLoading}
                >
                  {addCollaboratorMutation.isLoading ? "Sending…" : "Invite"}
                </Button>
              </div>
              {collaboratorError && <p className="text-sm text-destructive">{collaboratorError}</p>}
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" size="lg">
          Save Changes
        </Button>
      </form>
    </div>
  );
}
