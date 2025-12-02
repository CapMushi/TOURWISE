import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ManageDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  // Pre-populated with existing trip data
  const [formData, setFormData] = useState({
    tripName: "Weekend Mountain Hiking Retreat",
    tripId: "TWH-24-001",
    destination: "Naran Valley, Kaghan",
    tripType: "Adventure, Trekking",
    duration: "3 Days / 2 Nights",
    dates: "October 25th - October 27th, 2025",
    suitability: "Families, Solo Travelers, Couples",
    physicalRating: "moderate",
    basePrice: "$250",
    inclusions: "Accommodation (Twin-share)\nBreakfast daily, 2 Dinners\nAll listed guided tours\nPark entry fees\nLocal transportation",
    exclusions: "Meals not listed\nPersonal expenses\nTravel insurance\nTips",
    transportMode: "Carpooling / Self-Drive",
    meetingPoint: "Central Plaza, Lahore",
    departureTime: "Fri 6:00 AM / Sun 8:00 PM",
    accommodationType: "Guesthouse",
    accommodationName: "Mountain View Lodge",
    roomingBasis: "Twin-share basis",
    mealPlan: "Breakfast & Dinner included",
    itinerary: "Day 1: Departure at 6 AM, travel to Naran Valley, check-in at guesthouse, evening activity.\nDay 2: Morning hike to Saif-ul-Malook Lake, afternoon sightseeing, group dinner.\nDay 3: Morning leisure, check-out at 12 PM, return travel to Lahore.",
    minGroupSize: "10",
    maxGroupSize: "20",
    bookingDeadline: "October 20, 2025",
    cancellationPolicy: "Full refund 14 days prior. 50% refund 7-13 days prior. No refund within 7 days.",
    whatToPack: "Hiking boots, warm jacket, water bottle, sunscreen, camera",
    emergencyContact: "+92 300 1234567",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Save updated trip (in a real app, this would save to backend)
    navigate("/agent/manage-trips");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-heading font-bold text-heading mb-8">
        Manage Details: {formData.tripName}
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
                <Label htmlFor="suitability">Suitability</Label>
                <Input
                  id="suitability"
                  value={formData.suitability}
                  onChange={(e) => setFormData({ ...formData, suitability: e.target.value })}
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
                value={formData.basePrice}
                onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                className="glass-panel border-white/30"
              />
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
                <Label htmlFor="maxGroupSize">Max Group Size</Label>
                <Input
                  id="maxGroupSize"
                  type="number"
                  value={formData.maxGroupSize}
                  onChange={(e) => setFormData({ ...formData, maxGroupSize: e.target.value })}
                  className="glass-panel border-white/30"
                />
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
            <div className="p-4 glass-panel rounded-lg border-white/30 mt-4">
              <p className="text-sm font-medium mb-2">Imported Resources:</p>
              <div className="space-y-2">
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-sm"><strong>Flight:</strong> PK701 - Lahore to Manchester - Included in Price</p>
                  <p className="text-xs text-muted-foreground mt-1">Departure: 06:00 | Arrival: 18:30 | 1 Stop</p>
                </div>
                <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                  <p className="text-sm"><strong>Hotel:</strong> Grand Serena Hotel - 5★ Deluxe Room</p>
                  <p className="text-xs text-muted-foreground mt-1">$180 per night</p>
                </div>
              </div>
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
              <Label htmlFor="images">Upload New Images</Label>
              <Input
                id="images"
                type="file"
                multiple
                accept="image/*"
                className="glass-panel border-white/30"
              />
              <p className="text-sm text-muted-foreground">Upload new images to replace existing ones</p>
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
