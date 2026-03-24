import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getTripById, createBooking, type CreateBookingRequest, type PassengerInfo } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatPkr } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";

export default function Booking() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tripId = id ? parseInt(id, 10) : null;

  const [seats, setSeats] = useState(1);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [passengers, setPassengers] = useState<PassengerInfo[]>([
    { full_name: "", age: undefined, gender: undefined },
  ]);

  // Fetch trip data
  const { data: trip, isLoading, error } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => getTripById(tripId!),
    enabled: !!tripId,
  });

  // Pre-fill contact email from user
  useEffect(() => {
    if (user?.email) {
      setContactEmail(user.email);
    }
  }, [user]);

  // Update passengers array when seats change
  useEffect(() => {
    if (seats > passengers.length) {
      // Add new passenger forms
      const newPassengers = [...passengers];
      for (let i = passengers.length; i < seats; i++) {
        newPassengers.push({ full_name: "", age: undefined, gender: undefined });
      }
      setPassengers(newPassengers);
    } else if (seats < passengers.length) {
      // Remove extra passenger forms
      setPassengers(passengers.slice(0, seats));
    }
  }, [seats]);

  const incrementSeats = () => {
    if (trip && seats < trip.available_seats) {
      setSeats(seats + 1);
    }
  };

  const decrementSeats = () => {
    if (seats > 1) {
      setSeats(seats - 1);
    }
  };

  const updatePassenger = (index: number, field: keyof PassengerInfo, value: any) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };

  const bookingMutation = useMutation({
    mutationFn: createBooking,
    onSuccess: (data) => {
      toast({
        title: "Booking Confirmed!",
        description: `Your booking ${data.booking_reference} has been confirmed.`,
      });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      navigate(`/my-bookings`);
    },
    onError: (error: any) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tripId || !trip) return;

    // Validate required fields
    if (!contactEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter your contact email",
        variant: "destructive",
      });
      return;
    }

    if (!contactPhone.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter your contact phone",
        variant: "destructive",
      });
      return;
    }

    // Validate all passengers have names
    const invalidPassengers = passengers.filter((p) => !p.full_name.trim());
    if (invalidPassengers.length > 0) {
      toast({
        title: "Validation Error",
        description: "Please enter full name for all passengers",
        variant: "destructive",
      });
      return;
    }

    // Validate number of passengers matches seats
    if (passengers.length !== seats) {
      toast({
        title: "Validation Error",
        description: "Number of passengers must match number of seats",
        variant: "destructive",
      });
      return;
    }

    const bookingData: CreateBookingRequest = {
      trip_id: tripId,
      number_of_seats: seats,
      contact_email: contactEmail.trim(),
      contact_phone: contactPhone.trim(),
      special_requests: specialRequests.trim() || undefined,
      passengers: passengers.map((p) => ({
        full_name: p.full_name.trim(),
        age: p.age || undefined,
        gender: p.gender || undefined,
        passport_number: p.passport_number?.trim() || undefined,
        emergency_contact_name: p.emergency_contact_name?.trim() || undefined,
        emergency_contact_phone: p.emergency_contact_phone?.trim() || undefined,
        dietary_restrictions: p.dietary_restrictions?.trim() || undefined,
        medical_conditions: p.medical_conditions?.trim() || undefined,
      })),
    };

    bookingMutation.mutate(bookingData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="glass-card border-0 max-w-2xl w-full">
          <CardHeader>
            <Skeleton className="h-8 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : "Trip not found"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const availableSeats = trip.available_seats || 0;
  const pricePerSeat = parseFloat(trip.price.toString());
  const totalPrice = seats * pricePerSeat;

  if (availableSeats === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="glass-card border-0 max-w-md w-full">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Trip Fully Booked</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This trip is fully booked. No seats are available.
              </AlertDescription>
            </Alert>
            <Button className="w-full mt-4" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-heading font-bold text-heading mb-2">Book Your Trip</h1>
          <p className="text-body-text">
            {trip.origin_city} → {trip.destination_city}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Trip Summary */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading text-xl">Trip Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-body-text">Route:</span>
                <span className="font-medium">{trip.origin_city} → {trip.destination_city}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-body-text">Price per person (PKR):</span>
                <span className="font-medium">{formatPkr(pricePerSeat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-body-text">Available Seats:</span>
                <span className="font-medium text-accent">{availableSeats} Seats</span>
              </div>
            </CardContent>
          </Card>

          {/* Seat Selection */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading text-xl">Select Number of Seats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={decrementSeats}
                  disabled={seats <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-2xl font-bold w-12 text-center">{seats}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={incrementSeats}
                  disabled={seats >= availableSeats}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-sm text-body-text mb-1">Total (PKR):</p>
                <p className="text-3xl font-bold text-primary">{formatPkr(totalPrice)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading text-xl">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="contact_email">Email *</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="glass-panel border-white/30"
                  required
                />
              </div>
              <div>
                <Label htmlFor="contact_phone">Phone Number *</Label>
                <Input
                  id="contact_phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="glass-panel border-white/30"
                  required
                />
              </div>
              <div>
                <Label htmlFor="special_requests">Special Requests (Optional)</Label>
                <Textarea
                  id="special_requests"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  className="glass-panel border-white/30"
                  rows={3}
                  placeholder="Any special requests or notes..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Passenger Information */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading text-xl">Passenger Information</CardTitle>
              <p className="text-sm text-body-text">Please provide details for all {seats} passenger{seats > 1 ? "s" : ""}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {passengers.map((passenger, index) => (
                <div key={index} className="space-y-4 p-4 glass-panel rounded-lg border border-white/10">
                  <h3 className="font-semibold text-heading">Passenger {index + 1}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`passenger_${index}_name`}>Full Name *</Label>
                      <Input
                        id={`passenger_${index}_name`}
                        value={passenger.full_name}
                        onChange={(e) => updatePassenger(index, "full_name", e.target.value)}
                        className="glass-panel border-white/30"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`passenger_${index}_age`}>Age</Label>
                      <Input
                        id={`passenger_${index}_age`}
                        type="number"
                        min="0"
                        max="150"
                        value={passenger.age || ""}
                        onChange={(e) => updatePassenger(index, "age", e.target.value ? parseInt(e.target.value) : undefined)}
                        className="glass-panel border-white/30"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`passenger_${index}_gender`}>Gender</Label>
                      <Input
                        id={`passenger_${index}_gender`}
                        value={passenger.gender || ""}
                        onChange={(e) => updatePassenger(index, "gender", e.target.value)}
                        className="glass-panel border-white/30"
                        placeholder="male, female, other"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`passenger_${index}_passport`}>Passport Number</Label>
                      <Input
                        id={`passenger_${index}_passport`}
                        value={passenger.passport_number || ""}
                        onChange={(e) => updatePassenger(index, "passport_number", e.target.value)}
                        className="glass-panel border-white/30"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`passenger_${index}_emergency_name`}>Emergency Contact Name</Label>
                      <Input
                        id={`passenger_${index}_emergency_name`}
                        value={passenger.emergency_contact_name || ""}
                        onChange={(e) => updatePassenger(index, "emergency_contact_name", e.target.value)}
                        className="glass-panel border-white/30"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`passenger_${index}_emergency_phone`}>Emergency Contact Phone</Label>
                      <Input
                        id={`passenger_${index}_emergency_phone`}
                        type="tel"
                        value={passenger.emergency_contact_phone || ""}
                        onChange={(e) => updatePassenger(index, "emergency_contact_phone", e.target.value)}
                        className="glass-panel border-white/30"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`passenger_${index}_dietary`}>Dietary Restrictions</Label>
                      <Input
                        id={`passenger_${index}_dietary`}
                        value={passenger.dietary_restrictions || ""}
                        onChange={(e) => updatePassenger(index, "dietary_restrictions", e.target.value)}
                        className="glass-panel border-white/30"
                        placeholder="e.g., vegetarian, allergies..."
                      />
                    </div>
                    <div>
                      <Label htmlFor={`passenger_${index}_medical`}>Medical Conditions</Label>
                      <Input
                        id={`passenger_${index}_medical`}
                        value={passenger.medical_conditions || ""}
                        onChange={(e) => updatePassenger(index, "medical_conditions", e.target.value)}
                        className="glass-panel border-white/30"
                        placeholder="Any medical conditions..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading text-xl">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-body-text">Price per seat (PKR):</span>
                <span>{formatPkr(pricePerSeat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-body-text">Number of seats:</span>
                <span>{seats}</span>
              </div>
              <div className="border-t border-border pt-4 flex justify-between">
                <span className="text-lg font-semibold">Total:</span>
                <span className="text-2xl font-bold text-primary">{formatPkr(totalPrice)}</span>
              </div>
              <p className="text-sm text-body-text">
                Payment will be processed automatically upon confirmation.
              </p>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              disabled={bookingMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              size="lg"
              disabled={bookingMutation.isPending || availableSeats === 0}
            >
              {bookingMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Pay Now & Confirm Booking"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
