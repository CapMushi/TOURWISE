import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import heroImage from "@/assets/hero-tropical.jpg";
import { formatPkr } from "@/lib/currency";

export default function AdminTripView() {
  const navigate = useNavigate();
  const { tripId } = useParams();
  const [feedback, setFeedback] = useState("");

  const handleReject = () => {
    toast.error("Trip rejected and returned to agent");
    navigate("/admin/trip-approvals");
  };

  const handleApprove = () => {
    toast.success("Trip 'Weekend Mountain Hiking Retreat' is now Live");
    navigate("/admin/trip-approvals");
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Image Gallery */}
      <div className="w-full h-[400px] overflow-hidden">
        <img 
          src={heroImage} 
          alt="Trip destination" 
          className="w-full h-full object-cover"
        />
      </div>

      {/* Two Column Layout - Reusing TripDetails structure */}
      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-3 space-y-8">
          {/* Core Trip Details */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading text-2xl">Weekend Mountain Hiking Retreat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p><span className="font-medium">Trip ID:</span> TWH-24-001</p>
              <p><span className="font-medium">Destination(s):</span> Naran Valley, Kaghan</p>
              <p><span className="font-medium">Trip Type:</span> Adventure, Trekking</p>
              <p><span className="font-medium">Duration:</span> 3 Days / 2 Nights</p>
              <p><span className="font-medium">Trip Dates:</span> October 25th - October 27th, 2025</p>
              <p><span className="font-medium">Suitability:</span> Families, Solo Travelers, Couples</p>
              <p><span className="font-medium">Physical Rating:</span> Moderate</p>
            </CardContent>
          </Card>

          {/* Pricing and Inclusions */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">💰 Pricing and Inclusions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xl font-bold text-primary">{formatPkr(70_000)} per person</p>
              <p>
                <span className="font-medium">Single occupancy:</span> +{formatPkr(22_400)}
              </p>
              
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
                  <li>• Passenger option: {formatPkr(70_000)} (need a ride)</li>
                  <li>• Driver option: {formatPkr(61_600)} (drive and take passengers)</li>
                  <li>• Self-drive option: {formatPkr(65_800)} (drive alone)</li>
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
                <AccordionItem value="day1">
                  <AccordionTrigger>Day 1: Departure & Arrival</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 ml-4">
                      <li>• 6:00 AM - Depart from Central Plaza, Lahore</li>
                      <li>• 2:00 PM - Arrive at Naran Valley</li>
                      <li>• 3:00 PM - Check-in at guesthouse</li>
                      <li>• 7:00 PM - Welcome dinner & trip briefing</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="day2">
                  <AccordionTrigger>Day 2: Mountain Trek</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 ml-4">
                      <li>• 7:00 AM - Breakfast</li>
                      <li>• 8:00 AM - Guided morning hike to Saiful Malook Lake</li>
                      <li>• 1:00 PM - Lunch (own expense)</li>
                      <li>• 3:00 PM - Afternoon sightseeing in local markets</li>
                      <li>• 7:00 PM - Group dinner</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="day3">
                  <AccordionTrigger>Day 3: Leisure & Return</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 ml-4">
                      <li>• 7:00 AM - Breakfast</li>
                      <li>• 8:00 AM - Morning leisure time</li>
                      <li>• 11:00 AM - Check-out</li>
                      <li>• 12:00 PM - Begin return journey</li>
                      <li>• 8:00 PM - Arrive back at Lahore</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
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
      </div>

      {/* Sticky Admin Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-glass border-t border-border shadow-lg z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium mb-2">Reviewing submission from <span className="text-primary">TravelCo Adventures</span></p>
              <div className="space-y-2">
                <Label htmlFor="feedback" className="text-xs">Rejection Reason / Feedback (Optional)</Label>
                <Textarea
                  id="feedback"
                  placeholder="Provide feedback to the agent..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="glass-panel border-white/30 h-20"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={handleReject}
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                Reject Trip
              </Button>
              <Button
                size="lg"
                onClick={handleApprove}
                className="bg-accent hover:bg-accent/90"
              >
                Approve & Publish
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
