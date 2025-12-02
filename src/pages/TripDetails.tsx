import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, X } from "lucide-react";
import heroImage from "@/assets/hero-tropical.jpg";

export default function TripDetails() {
  const navigate = useNavigate();
  const { tripId } = useParams();

  return (
    <div className="min-h-screen bg-background">
      {/* Image Gallery */}
      <div className="w-full h-[400px] overflow-hidden">
        <img 
          src={heroImage} 
          alt="Trip destination" 
          className="w-full h-full object-cover"
        />
      </div>

      {/* Two Column Layout */}
      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-8">
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
              <p className="text-xl font-bold text-primary">$250 per person</p>
              <p><span className="font-medium">Single Occupancy:</span> +$80</p>
              
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

          {/* Flight Itinerary */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">✈️ Flight Itinerary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 glass-panel rounded-lg border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-body-text">Airline</p>
                    <p className="font-bold text-lg">Pakistan International Airlines</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-bold text-lg">PK</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-body-text mb-1">Flight Number</p>
                    <p className="font-bold text-primary">PK701</p>
                  </div>
                  <div>
                    <p className="text-xs text-body-text mb-1">Route</p>
                    <p className="font-medium">LHE → DXB → MAN</p>
                  </div>
                  <div>
                    <p className="text-xs text-body-text mb-1">Duration</p>
                    <p className="font-medium">12h 30m</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                  <div>
                    <p className="text-xs text-body-text mb-1">Departure</p>
                    <p className="font-bold">06:00 AM</p>
                    <p className="text-xs text-body-text">Lahore (LHE)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-body-text mb-1">Arrival</p>
                    <p className="font-bold">06:30 PM</p>
                    <p className="text-xs text-body-text">Manchester (MAN)</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-body-text">
                    <span className="font-medium">Class:</span> Economy | 
                    <span className="font-medium ml-2">Stops:</span> 1 (Dubai) | 
                    <span className="font-medium ml-2">Status:</span> <span className="text-accent">Confirmed</span>
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
                  <li>• Passenger Option: $250 (need a ride)</li>
                  <li>• Driver Option: $220 (drive and take passengers)</li>
                  <li>• Self-Drive Option: $235 (drive alone)</li>
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

        {/* Right Column - Sticky Booking Card */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="font-heading">Book This Trip</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-body-text mb-1">Organized by</p>
                  <p className="font-medium">Adventure Trails Pakistan</p>
                  <p className="text-sm text-accent">★★★★★ 4.9 (127 reviews)</p>
                </div>
                
                <div className="border-t border-border pt-4">
                  <p className="text-3xl font-bold text-primary">$250</p>
                  <p className="text-sm text-body-text">per person</p>
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => navigate(`/booking/${tripId || 'TWH-24-001'}`)}
                >
                  Book Now
                </Button>

                <Button variant="secondary" className="w-full">
                  Add to Wishlist
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
