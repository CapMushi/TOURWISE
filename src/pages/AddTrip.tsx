import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AddTrip() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    tripName: "",
    tripId: "",
    destination: "",
    tripType: "",
    duration: "",
    dates: "",
    suitability: "",
    physicalRating: "",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Save trip with "Pending Approval" status (in a real app, this would save to backend)
    toast.success("Trip submitted for admin approval");
    navigate("/agent/manage-trips");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-heading font-bold text-heading mb-8">Create a New Trip</h1>

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
                  placeholder="e.g., Weekend Mountain Hiking Retreat"
                  value={formData.tripName}
                  onChange={(e) => setFormData({ ...formData, tripName: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tripId">Trip ID</Label>
                <Input
                  id="tripId"
                  placeholder="e.g., TWH-24-001"
                  value={formData.tripId}
                  onChange={(e) => setFormData({ ...formData, tripId: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination">Destination(s)</Label>
                <Input
                  id="destination"
                  placeholder="e.g., Naran Valley, Kaghan"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tripType">Trip Type</Label>
                <Input
                  id="tripType"
                  placeholder="e.g., Adventure, Trekking"
                  value={formData.tripType}
                  onChange={(e) => setFormData({ ...formData, tripType: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration</Label>
                <Input
                  id="duration"
                  placeholder="e.g., 3 Days / 2 Nights"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dates">Trip Dates</Label>
                <Input
                  id="dates"
                  placeholder="e.g., October 25th - October 27th, 2025"
                  value={formData.dates}
                  onChange={(e) => setFormData({ ...formData, dates: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suitability">Suitability</Label>
                <Input
                  id="suitability"
                  placeholder="e.g., Families, Solo Travelers, Couples"
                  value={formData.suitability}
                  onChange={(e) => setFormData({ ...formData, suitability: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="physicalRating">Physical Rating</Label>
                <Select value={formData.physicalRating} onValueChange={(value) => setFormData({ ...formData, physicalRating: value })}>
                  <SelectTrigger className="glass-panel border-white/30">
                    <SelectValue placeholder="Select rating" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/30 bg-white/95 backdrop-blur-glass z-50">
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="challenging">Challenging</SelectItem>
                    <SelectItem value="strenuous">Strenuous</SelectItem>
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
              <Label htmlFor="basePrice">Base Price (per person)</Label>
              <Input
                id="basePrice"
                placeholder="e.g., $250"
                value={formData.basePrice}
                onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                className="glass-panel border-white/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inclusions">Inclusions (one per line)</Label>
              <Textarea
                id="inclusions"
                placeholder="e.g., Accommodation (Twin-share)&#10;Breakfast daily&#10;All guided tours"
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
                placeholder="e.g., Meals not listed&#10;Personal expenses&#10;Travel insurance"
                rows={5}
                value={formData.exclusions}
                onChange={(e) => setFormData({ ...formData, exclusions: e.target.value })}
                className="glass-panel border-white/30"
              />
            </div>
          </CardContent>
        </Card>

        {/* Transportation & Logistics */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Transportation & Logistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transportMode">Primary Transport Mode</Label>
                <Input
                  id="transportMode"
                  placeholder="e.g., Carpooling / Self-Drive"
                  value={formData.transportMode}
                  onChange={(e) => setFormData({ ...formData, transportMode: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meetingPoint">Meeting Point</Label>
                <Input
                  id="meetingPoint"
                  placeholder="e.g., Central Plaza, Lahore"
                  value={formData.meetingPoint}
                  onChange={(e) => setFormData({ ...formData, meetingPoint: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="departureTime">Departure/Return Time</Label>
                <Input
                  id="departureTime"
                  placeholder="e.g., Fri 6:00 AM / Sun 8:00 PM"
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
                  placeholder="e.g., Guesthouse"
                  value={formData.accommodationType}
                  onChange={(e) => setFormData({ ...formData, accommodationType: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accommodationName">Accommodation Name</Label>
                <Input
                  id="accommodationName"
                  placeholder="e.g., Mountain View Lodge"
                  value={formData.accommodationName}
                  onChange={(e) => setFormData({ ...formData, accommodationName: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roomingBasis">Rooming Basis</Label>
                <Input
                  id="roomingBasis"
                  placeholder="e.g., Twin-share basis"
                  value={formData.roomingBasis}
                  onChange={(e) => setFormData({ ...formData, roomingBasis: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mealPlan">Meal Plan</Label>
                <Input
                  id="mealPlan"
                  placeholder="e.g., Breakfast & Dinner included"
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
                placeholder="Day 1: Departure at 6 AM...&#10;Day 2: Morning hike...&#10;Day 3: Return travel..."
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
                  placeholder="e.g., 10"
                  value={formData.minGroupSize}
                  onChange={(e) => setFormData({ ...formData, minGroupSize: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxGroupSize">Max Group Size</Label>
                <Input
                  id="maxGroupSize"
                  type="number"
                  placeholder="e.g., 20"
                  value={formData.maxGroupSize}
                  onChange={(e) => setFormData({ ...formData, maxGroupSize: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bookingDeadline">Booking Deadline</Label>
                <Input
                  id="bookingDeadline"
                  placeholder="e.g., October 20, 2025"
                  value={formData.bookingDeadline}
                  onChange={(e) => setFormData({ ...formData, bookingDeadline: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContact">Emergency Contact</Label>
                <Input
                  id="emergencyContact"
                  placeholder="e.g., +92 300 1234567"
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                  className="glass-panel border-white/30"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="cancellationPolicy">Cancellation Policy</Label>
                <Textarea
                  id="cancellationPolicy"
                  placeholder="e.g., Full refund 14 days prior. 50% refund 7-13 days prior..."
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
                  placeholder="e.g., Hiking boots, warm jacket, water bottle..."
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
            <CardTitle className="font-heading text-2xl">Travel Logistics & PNR</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => navigate("/agent/resource-inventory")}
            >
              Import Flight/Hotel from Inventory
            </Button>
            <div className="p-4 glass-panel rounded-lg border-white/30">
              <p className="text-sm text-muted-foreground">
                No flights or hotels imported yet. Use the Resource Inventory to add travel logistics to your package.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Image Upload Section */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Trip Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="images">Upload Images</Label>
              <Input
                id="images"
                type="file"
                multiple
                accept="image/*"
                className="glass-panel border-white/30"
              />
              <p className="text-sm text-muted-foreground">Upload multiple images for your trip</p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" size="lg">
          Create Trip
        </Button>
      </form>
    </div>
  );
}
