import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plane, Hotel } from "lucide-react";

// Dummy flight data
const dummyFlights = [
  {
    id: "F001",
    airline: "PIA",
    flightNumber: "PK701",
    route: "LHE-DXB-MAN",
    departure: "06:00",
    arrival: "18:30",
    duration: "12h 30m",
    stops: 1,
    seats: 9,
    price: 850,
    class: "Economy",
  },
  {
    id: "F002",
    airline: "Emirates",
    flightNumber: "EK623",
    route: "LHE-DXB-JFK",
    departure: "08:45",
    arrival: "21:15",
    duration: "16h 30m",
    stops: 1,
    seats: 5,
    price: 1250,
    class: "Economy",
  },
  {
    id: "F003",
    airline: "Turkish Airlines",
    flightNumber: "TK715",
    route: "LHE-IST-LHR",
    departure: "03:30",
    arrival: "14:20",
    duration: "10h 50m",
    stops: 1,
    seats: 12,
    price: 780,
    class: "Economy",
  },
  {
    id: "F004",
    airline: "Qatar Airways",
    flightNumber: "QR601",
    route: "LHE-DOH-CDG",
    departure: "23:50",
    arrival: "13:40+1",
    duration: "13h 50m",
    stops: 1,
    seats: 7,
    price: 920,
    class: "Economy",
  },
];

// Dummy hotel data
const dummyHotels = [
  {
    id: "H001",
    name: "Grand Serena Hotel",
    stars: 5,
    address: "Khayaban-e-Suhrawardy, Islamabad",
    pricePerNight: 180,
    roomType: "Deluxe",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400",
  },
  {
    id: "H002",
    name: "Pearl Continental",
    stars: 5,
    address: "The Mall, Lahore",
    pricePerNight: 150,
    roomType: "Standard",
    image: "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400",
  },
  {
    id: "H003",
    name: "Marriott Hotel",
    stars: 5,
    address: "Club Road, Karachi",
    pricePerNight: 200,
    roomType: "Deluxe",
    image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400",
  },
  {
    id: "H004",
    name: "Avari Towers",
    stars: 4,
    address: "Fatima Jinnah Road, Karachi",
    pricePerNight: 120,
    roomType: "Standard",
    image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=400",
  },
  {
    id: "H005",
    name: "Nishat Hotel",
    stars: 4,
    address: "Mall Road, Lahore",
    pricePerNight: 95,
    roomType: "Standard",
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400",
  },
  {
    id: "H006",
    name: "Mövenpick Hotel",
    stars: 5,
    address: "Kashmir Highway, Islamabad",
    pricePerNight: 165,
    roomType: "Deluxe",
    image: "https://images.unsplash.com/photo-1563911302283-d2bc129e7570?w=400",
  },
];

export default function ResourceInventory() {
  const [selectedFlights, setSelectedFlights] = useState<string[]>([]);
  
  // Flight search state
  const [flightSearch, setFlightSearch] = useState({
    tripType: "round-trip",
    origin: "",
    destination: "",
    departureDate: "",
    returnDate: "",
    class: "economy",
    adults: "1",
    children: "0",
    infants: "0",
  });

  // Hotel search state
  const [hotelSearch, setHotelSearch] = useState({
    location: "",
    checkIn: "",
    checkOut: "",
    rooms: "1",
    guests: "2",
    stars: "",
  });

  const handleFlightSelection = (flightId: string) => {
    setSelectedFlights((prev) =>
      prev.includes(flightId)
        ? prev.filter((id) => id !== flightId)
        : [...prev, flightId]
    );
  };

  const handleAddFlightsToTrip = () => {
    if (selectedFlights.length === 0) {
      toast.error("Please select at least one flight");
      return;
    }
    toast.success(`${selectedFlights.length} flight(s) added to draft`);
    setSelectedFlights([]);
  };

  const handleAddHotelToTrip = (hotelName: string) => {
    toast.success(`${hotelName} added to trip draft`);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-heading font-bold gradient-text mb-2">
            Resource Inventory
          </h1>
          <p className="text-body-text">Search and add flights and hotels to your trip packages</p>
        </div>

        <Tabs defaultValue="flights" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="flights" className="flex items-center gap-2">
              <Plane className="h-4 w-4" />
              Flight Search
            </TabsTrigger>
            <TabsTrigger value="hotels" className="flex items-center gap-2">
              <Hotel className="h-4 w-4" />
              Hotel Search
            </TabsTrigger>
          </TabsList>

          {/* FLIGHT SEARCH TAB */}
          <TabsContent value="flights" className="space-y-6">
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="font-heading">Flight Search</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="space-y-2">
                    <Label htmlFor="trip-type">Trip Type</Label>
                    <Select
                      value={flightSearch.tripType}
                      onValueChange={(value) =>
                        setFlightSearch({ ...flightSearch, tripType: value })
                      }
                    >
                      <SelectTrigger id="trip-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one-way">One-way</SelectItem>
                        <SelectItem value="round-trip">Round-trip</SelectItem>
                        <SelectItem value="multi-city">Multi-city</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="origin">Origin (Airport Code)</Label>
                    <Input
                      id="origin"
                      placeholder="e.g., LHE"
                      value={flightSearch.origin}
                      onChange={(e) =>
                        setFlightSearch({ ...flightSearch, origin: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="destination">Destination (Airport Code)</Label>
                    <Input
                      id="destination"
                      placeholder="e.g., JFK"
                      value={flightSearch.destination}
                      onChange={(e) =>
                        setFlightSearch({ ...flightSearch, destination: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="departure-date">Departure Date</Label>
                    <Input
                      id="departure-date"
                      type="date"
                      value={flightSearch.departureDate}
                      onChange={(e) =>
                        setFlightSearch({ ...flightSearch, departureDate: e.target.value })
                      }
                    />
                  </div>

                  {flightSearch.tripType === "round-trip" && (
                    <div className="space-y-2">
                      <Label htmlFor="return-date">Return Date</Label>
                      <Input
                        id="return-date"
                        type="date"
                        value={flightSearch.returnDate}
                        onChange={(e) =>
                          setFlightSearch({ ...flightSearch, returnDate: e.target.value })
                        }
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="class">Class</Label>
                    <Select
                      value={flightSearch.class}
                      onValueChange={(value) =>
                        setFlightSearch({ ...flightSearch, class: value })
                      }
                    >
                      <SelectTrigger id="class">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="economy">Economy</SelectItem>
                        <SelectItem value="premium">Premium Economy</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="first">First Class</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adults">Adults</Label>
                    <Input
                      id="adults"
                      type="number"
                      min="1"
                      value={flightSearch.adults}
                      onChange={(e) =>
                        setFlightSearch({ ...flightSearch, adults: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="children">Children (2-11)</Label>
                    <Input
                      id="children"
                      type="number"
                      min="0"
                      value={flightSearch.children}
                      onChange={(e) =>
                        setFlightSearch({ ...flightSearch, children: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="infants">Infants (Under 2)</Label>
                    <Input
                      id="infants"
                      type="number"
                      min="0"
                      value={flightSearch.infants}
                      onChange={(e) =>
                        setFlightSearch({ ...flightSearch, infants: e.target.value })
                      }
                    />
                  </div>
                </div>

                <Button className="w-full md:w-auto">Search Flights</Button>
              </CardContent>
            </Card>

            {/* Flight Results Table */}
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="font-heading">Available Flights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-medium">Select</th>
                        <th className="text-left p-3 font-medium">Airline</th>
                        <th className="text-left p-3 font-medium">Flight #</th>
                        <th className="text-left p-3 font-medium">Route</th>
                        <th className="text-left p-3 font-medium">Time (Dep/Arr)</th>
                        <th className="text-left p-3 font-medium">Duration</th>
                        <th className="text-left p-3 font-medium">Stops</th>
                        <th className="text-left p-3 font-medium">Availability</th>
                        <th className="text-right p-3 font-medium">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dummyFlights.map((flight) => (
                        <tr
                          key={flight.id}
                          className="border-b border-border hover:bg-muted/50 transition-colors"
                        >
                          <td className="p-3">
                            <Checkbox
                              checked={selectedFlights.includes(flight.id)}
                              onCheckedChange={() => handleFlightSelection(flight.id)}
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                {flight.airline.substring(0, 2)}
                              </div>
                              <span className="text-sm font-medium">{flight.airline}</span>
                            </div>
                          </td>
                          <td className="p-3 text-sm">{flight.flightNumber}</td>
                          <td className="p-3 text-sm font-medium">{flight.route}</td>
                          <td className="p-3 text-sm">
                            {flight.departure} - {flight.arrival}
                          </td>
                          <td className="p-3 text-sm">{flight.duration}</td>
                          <td className="p-3 text-sm">{flight.stops} stop{flight.stops !== 1 && 's'}</td>
                          <td className="p-3">
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                flight.seats < 5
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-accent/10 text-accent"
                              }`}
                            >
                              {flight.seats} seats left
                            </span>
                          </td>
                          <td className="p-3 text-right font-bold text-primary">
                            ${flight.price}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={handleAddFlightsToTrip}
                    disabled={selectedFlights.length === 0}
                  >
                    Add Selected Flights to Trip Draft ({selectedFlights.length})
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* HOTEL SEARCH TAB */}
          <TabsContent value="hotels" className="space-y-6">
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="font-heading">Hotel Search</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="City or landmark"
                      value={hotelSearch.location}
                      onChange={(e) =>
                        setHotelSearch({ ...hotelSearch, location: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="check-in">Check-in Date</Label>
                    <Input
                      id="check-in"
                      type="date"
                      value={hotelSearch.checkIn}
                      onChange={(e) =>
                        setHotelSearch({ ...hotelSearch, checkIn: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="check-out">Check-out Date</Label>
                    <Input
                      id="check-out"
                      type="date"
                      value={hotelSearch.checkOut}
                      onChange={(e) =>
                        setHotelSearch({ ...hotelSearch, checkOut: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rooms">Rooms</Label>
                    <Input
                      id="rooms"
                      type="number"
                      min="1"
                      value={hotelSearch.rooms}
                      onChange={(e) =>
                        setHotelSearch({ ...hotelSearch, rooms: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="guests">Guests</Label>
                    <Input
                      id="guests"
                      type="number"
                      min="1"
                      value={hotelSearch.guests}
                      onChange={(e) =>
                        setHotelSearch({ ...hotelSearch, guests: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stars">Star Rating</Label>
                    <Select
                      value={hotelSearch.stars}
                      onValueChange={(value) =>
                        setHotelSearch({ ...hotelSearch, stars: value })
                      }
                    >
                      <SelectTrigger id="stars">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="5">5 Stars</SelectItem>
                        <SelectItem value="4">4 Stars</SelectItem>
                        <SelectItem value="3">3 Stars</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button className="w-full md:w-auto">Search Hotels</Button>
              </CardContent>
            </Card>

            {/* Hotel Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dummyHotels.map((hotel) => (
                <Card key={hotel.id} className="glass-card border-0">
                  <CardContent className="p-0">
                    <img
                      src={hotel.image}
                      alt={hotel.name}
                      className="w-full h-48 object-cover rounded-t-xl"
                    />
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="font-heading font-bold text-lg mb-1">
                          {hotel.name}
                        </h3>
                        <div className="flex items-center gap-1 text-accent mb-2">
                          {Array.from({ length: hotel.stars }).map((_, i) => (
                            <span key={i}>★</span>
                          ))}
                        </div>
                        <p className="text-sm text-body-text">{hotel.address}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div>
                          <p className="text-xs text-body-text">Per night</p>
                          <p className="text-xl font-bold text-primary">
                            ${hotel.pricePerNight}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-body-text mb-1">{hotel.roomType}</p>
                          <Button
                            size="sm"
                            onClick={() => handleAddHotelToTrip(hotel.name)}
                          >
                            Add to Trip
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
