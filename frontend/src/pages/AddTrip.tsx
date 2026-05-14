import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createTrip, CreateTripRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Heart } from "lucide-react";

// Transport type options based on service_type_enum
const TRANSPORT_TYPES = [
  { value: "flight", label: "Flight" },
  { value: "bus", label: "Bus" },
  { value: "train", label: "Train" },
  { value: "car_rental", label: "Car Rental" },
  { value: "tour", label: "Tour" },
  { value: "transport", label: "Transport" },
];

export default function AddTrip() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateTripRequest>({
    origin_city: "",
    destination_province: "",
    destination_city: "",
    departure_time: "",
    arrival_time: "",
    price: 0,
    transport_type: "",
    total_seats: 0,
    available_seats: undefined, // Will default to total_seats on backend
    suitability: undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Ensure suitability is always a valid string for Select component
  const suitabilityValue = formData.suitability || "any";

  // Helper to convert datetime-local input to ISO string
  const toISOString = (localDateTime: string): string => {
    if (!localDateTime) return "";
    // datetime-local format: "YYYY-MM-DDTHH:mm"
    // Convert to ISO 8601: "YYYY-MM-DDTHH:mm:ss.sssZ"
    return new Date(localDateTime).toISOString();
  };

  // Validate form data
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.origin_city.trim()) {
      newErrors.origin_city = "Origin city is required";
    }

    if (!formData.destination_province.trim()) {
      newErrors.destination_province = "Destination province is required";
    }

    if (!formData.destination_city.trim()) {
      newErrors.destination_city = "Destination city is required";
    }

    if (!formData.departure_time) {
      newErrors.departure_time = "Departure time is required";
    }

    if (!formData.arrival_time) {
      newErrors.arrival_time = "Arrival time is required";
    }

    if (formData.departure_time && formData.arrival_time) {
      const departure = new Date(formData.departure_time);
      const arrival = new Date(formData.arrival_time);
      if (arrival <= departure) {
        newErrors.arrival_time = "Arrival time must be after departure time";
      }
    }

    if (formData.price <= 0) {
      newErrors.price = "Price must be greater than 0";
    }

    if (!formData.transport_type) {
      newErrors.transport_type = "Transport type is required";
    }

    if (formData.total_seats <= 0) {
      newErrors.total_seats = "Total seats must be greater than 0";
    }

    if (formData.available_seats !== undefined) {
      if (formData.available_seats < 0) {
        newErrors.available_seats = "Available seats cannot be negative";
      }
      if (formData.available_seats > formData.total_seats) {
        newErrors.available_seats = "Available seats cannot exceed total seats";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    setLoading(true);

    try {
      // Prepare request data with ISO datetime strings
      const requestData: CreateTripRequest = {
        ...formData,
        departure_time: toISOString(formData.departure_time),
        arrival_time: toISOString(formData.arrival_time),
        price: Number(formData.price),
        total_seats: Number(formData.total_seats),
        available_seats: formData.available_seats !== undefined ? Number(formData.available_seats) : undefined,
        suitability: formData.suitability || undefined, // Convert empty string to undefined
      };

      const response = await createTrip(requestData);

      toast.success("Trip created successfully! You can now add collaborators below.");
      navigate(`/agent/manage-details/${response.trip_id}`, { state: { newTrip: true } });
    } catch (error) {
      console.error("Error creating trip:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create trip. Please try again.";
      
      // Check if user is not registered as a travel agent
      if (errorMessage.includes("not a registered travel agent") || errorMessage.includes("agent verification")) {
        toast.error("You need to register as a travel agent first", {
          description: "Redirecting to registration...",
          duration: 5000,
        });
        // Give user option to quickly register and verify
        setTimeout(() => {
          if (user) {
            // If authenticated, redirect to agent verification to skip verification
            navigate("/agent-verification");
          } else {
            // If not authenticated, go to role selection
            navigate("/role-selection");
          }
        }, 2000);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-set available_seats when total_seats changes (if available_seats is not manually set)
  const handleTotalSeatsChange = (value: string) => {
    const totalSeats = Number(value);
    setFormData((prev) => ({
      ...prev,
      total_seats: totalSeats,
      // If available_seats is undefined or equals old total_seats, update it
      available_seats:
        prev.available_seats === undefined || prev.available_seats === prev.total_seats
          ? totalSeats
          : prev.available_seats,
    }));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-heading font-bold text-heading mb-8">Create a New Trip</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Location Details */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Location Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="origin_city">
                  Origin City <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="origin_city"
                  placeholder="e.g., Lahore"
                  value={formData.origin_city}
                  onChange={(e) => setFormData({ ...formData, origin_city: e.target.value })}
                  className="glass-panel border-white/30"
                  required
                />
                {errors.origin_city && <p className="text-sm text-red-500">{errors.origin_city}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination_province">
                  Destination Province <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="destination_province"
                  placeholder="e.g., Khyber Pakhtunkhwa"
                  value={formData.destination_province}
                  onChange={(e) => setFormData({ ...formData, destination_province: e.target.value })}
                  className="glass-panel border-white/30"
                  required
                />
                {errors.destination_province && <p className="text-sm text-red-500">{errors.destination_province}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination_city">
                  Destination City <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="destination_city"
                  placeholder="e.g., Naran"
                  value={formData.destination_city}
                  onChange={(e) => setFormData({ ...formData, destination_city: e.target.value })}
                  className="glass-panel border-white/30"
                  required
                />
                {errors.destination_city && <p className="text-sm text-red-500">{errors.destination_city}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="departure_time">
                  Departure Time <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="departure_time"
                  type="datetime-local"
                  value={formData.departure_time}
                  onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                  className="glass-panel border-white/30"
                  required
                />
                {errors.departure_time && <p className="text-sm text-red-500">{errors.departure_time}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="arrival_time">
                  Arrival Time <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="arrival_time"
                  type="datetime-local"
                  value={formData.arrival_time}
                  onChange={(e) => setFormData({ ...formData, arrival_time: e.target.value })}
                  className="glass-panel border-white/30"
                  required
                />
                {errors.arrival_time && <p className="text-sm text-red-500">{errors.arrival_time}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Transport */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Pricing & Transport</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">
                  Price per person (PKR) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g., 75000"
                  value={formData.price || ""}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  className="glass-panel border-white/30"
                  required
                />
                {errors.price && <p className="text-sm text-red-500">{errors.price}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="transport_type">
                  Transport Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.transport_type}
                  onValueChange={(value) => setFormData({ ...formData, transport_type: value })}
                >
                  <SelectTrigger className="glass-panel border-white/30">
                    <SelectValue placeholder="Select transport type" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/30 bg-white/95 backdrop-blur-glass z-50">
                    {TRANSPORT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.transport_type && <p className="text-sm text-red-500">{errors.transport_type}</p>}
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
                  <SelectContent>
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

        {/* Seating */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Seating Capacity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total_seats">
                  Total Seats <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="total_seats"
                  type="number"
                  min="1"
                  placeholder="e.g., 20"
                  value={formData.total_seats || ""}
                  onChange={(e) => handleTotalSeatsChange(e.target.value)}
                  className="glass-panel border-white/30"
                  required
                />
                {errors.total_seats && <p className="text-sm text-red-500">{errors.total_seats}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="available_seats">Available Seats (optional)</Label>
                <Input
                  id="available_seats"
                  type="number"
                  min="0"
                  max={formData.total_seats}
                  placeholder={`Defaults to ${formData.total_seats || "total seats"}`}
                  value={formData.available_seats !== undefined ? formData.available_seats : ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      available_seats: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  className="glass-panel border-white/30"
                />
                {errors.available_seats && <p className="text-sm text-red-500">{errors.available_seats}</p>}
                <p className="text-xs text-muted-foreground">
                  Leave empty to set equal to total seats
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/agent/manage-trips")}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button type="submit" className="flex-1" size="lg" disabled={loading}>
            {loading ? "Creating Trip..." : "Create Trip"}
          </Button>
        </div>
      </form>
    </div>
  );
}
