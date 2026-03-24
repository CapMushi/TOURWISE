import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Bus, Hotel } from "lucide-react";
import { getMyTrips } from "@/lib/api";
import { addBusesToTrip, addHotelsToTrip } from "@/lib/tripResourcesStorage";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPkr } from "@/lib/currency";

const TRIP_RESOURCES_EVENT = "tourwise-trip-resources-changed";

const dummyBuses = [
  {
    id: "B001",
    operator: "Greyhound Lines",
    serviceNumber: "GH-1842",
    route: "New York, NY → Philadelphia, PA",
    departure: "07:30",
    arrival: "11:45",
    duration: "4h 15m",
    stops: 0,
    seats: 52,
    price: 11_700,
    coachClass: "Standard",
  },
  {
    id: "B002",
    operator: "Megabus",
    serviceNumber: "MGB-9021",
    route: "Chicago, IL → Detroit, MI",
    departure: "09:15",
    arrival: "14:00",
    duration: "4h 45m",
    stops: 0,
    seats: 81,
    price: 8_700,
    coachClass: "Economy",
  },
  {
    id: "B003",
    operator: "FlixBus",
    serviceNumber: "FX-5510",
    route: "Los Angeles, CA → Las Vegas, NV",
    departure: "22:00",
    arrival: "05:30+1",
    duration: "7h 30m",
    stops: 1,
    seats: 56,
    price: 13_200,
    coachClass: "Standard",
  },
  {
    id: "B004",
    operator: "National Express",
    serviceNumber: "NX-220",
    route: "London → Birmingham",
    departure: "06:00",
    arrival: "09:20",
    duration: "3h 20m",
    stops: 0,
    seats: 49,
    price: 10_500,
    coachClass: "Standard",
  },
  {
    id: "B005",
    operator: "Trailways of New York",
    serviceNumber: "TW-771",
    route: "Buffalo, NY → New York, NY",
    departure: "08:00",
    arrival: "18:30",
    duration: "10h 30m",
    stops: 2,
    seats: 45,
    price: 18_600,
    coachClass: "Standard",
  },
  {
    id: "B006",
    operator: "Peter Pan Bus Lines",
    serviceNumber: "PP-330",
    route: "Boston, MA → Washington, DC",
    departure: "07:45",
    arrival: "16:15",
    duration: "8h 30m",
    stops: 1,
    seats: 50,
    price: 16_500,
    coachClass: "Standard",
  },
  {
    id: "B007",
    operator: "Jefferson Lines",
    serviceNumber: "JL-412",
    route: "Minneapolis, MN → Sioux Falls, SD",
    departure: "10:30",
    arrival: "16:00",
    duration: "5h 30m",
    stops: 1,
    seats: 44,
    price: 14_400,
    coachClass: "Standard",
  },
  {
    id: "B008",
    operator: "RedCoach",
    serviceNumber: "RC-88",
    route: "Miami, FL → Orlando, FL",
    departure: "14:00",
    arrival: "17:45",
    duration: "3h 45m",
    stops: 0,
    seats: 36,
    price: 12_600,
    coachClass: "Premium",
  },
];

const dummyHotels = [
  {
    id: "H001",
    name: "Grand Serena Hotel",
    stars: 5,
    address: "Khayaban-e-Suhrawardy, Islamabad",
    pricePerNight: 52_000,
    roomType: "Deluxe",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400",
  },
  {
    id: "H002",
    name: "Pearl Continental",
    stars: 5,
    address: "The Mall, Lahore",
    pricePerNight: 43_000,
    roomType: "Standard",
    image: "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400",
  },
  {
    id: "H003",
    name: "Marriott Hotel",
    stars: 5,
    address: "Club Road, Karachi",
    pricePerNight: 58_000,
    roomType: "Deluxe",
    image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400",
  },
  {
    id: "H004",
    name: "Avari Towers",
    stars: 4,
    address: "Fatima Jinnah Road, Karachi",
    pricePerNight: 35_000,
    roomType: "Standard",
    image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=400",
  },
  {
    id: "H005",
    name: "Nishat Hotel",
    stars: 4,
    address: "Mall Road, Lahore",
    pricePerNight: 27_500,
    roomType: "Standard",
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400",
  },
  {
    id: "H006",
    name: "Mövenpick Hotel",
    stars: 5,
    address: "Kashmir Highway, Islamabad",
    pricePerNight: 48_000,
    roomType: "Deluxe",
    image: "https://images.unsplash.com/photo-1563911302283-d2bc129e7570?w=400",
  },
];

export default function ResourceInventory() {
  const [selectedBuses, setSelectedBuses] = useState<string[]>([]);
  const [targetTripId, setTargetTripId] = useState<string>("");

  const [busSearch, setBusSearch] = useState({
    tripType: "one-way",
    origin: "",
    destination: "",
    travelDate: "",
    coachClass: "standard",
  });

  const [hotelSearch, setHotelSearch] = useState({
    location: "",
    checkIn: "",
    checkOut: "",
    rooms: "1",
    guests: "2",
    stars: "",
  });

  const { data: myTripsData, isLoading: tripsLoading } = useQuery({
    queryKey: ["my-trips"],
    queryFn: getMyTrips,
  });

  const trips = myTripsData?.trips ?? [];

  const handleBusToggle = (busId: string) => {
    setSelectedBuses((prev) =>
      prev.includes(busId) ? prev.filter((id) => id !== busId) : [...prev, busId]
    );
  };

  const handleAddBusesToTrip = () => {
    const tid = parseInt(targetTripId, 10);
    if (!tid || Number.isNaN(tid)) {
      toast.error("Select a trip to attach these resources to");
      return;
    }
    if (selectedBuses.length === 0) {
      toast.error("Select at least one bus service");
      return;
    }
    const rows = dummyBuses.filter((b) => selectedBuses.includes(b.id));
    addBusesToTrip(
      tid,
      rows.map((b) => ({
        operator: b.operator,
        serviceNumber: b.serviceNumber,
        route: b.route,
        departure: b.departure,
        arrival: b.arrival,
        duration: b.duration,
        stops: b.stops,
        seats: b.seats,
        price: b.price,
        coachClass: b.coachClass,
      }))
    );
    window.dispatchEvent(new Event(TRIP_RESOURCES_EVENT));
    toast.success(`${rows.length} bus service(s) saved for trip #${tid}`);
    setSelectedBuses([]);
  };

  const handleAddHotelToTrip = (hotel: (typeof dummyHotels)[0]) => {
    const tid = parseInt(targetTripId, 10);
    if (!tid || Number.isNaN(tid)) {
      toast.error("Select a trip first");
      return;
    }
    addHotelsToTrip(tid, [
      {
        name: hotel.name,
        stars: hotel.stars,
        address: hotel.address,
        pricePerNight: hotel.pricePerNight,
        roomType: hotel.roomType,
      },
    ]);
    window.dispatchEvent(new Event(TRIP_RESOURCES_EVENT));
    toast.success(`${hotel.name} added to trip #${tid}`);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-heading font-bold gradient-text mb-2">Resource Inventory</h1>
          <p className="text-body-text">
            Search intercity bus operators and hotels, then attach them to one of your listings for use in
            Manage Details (logistics &amp; PNR).
          </p>
        </div>

        <Card className="glass-card border-0 mb-8">
          <CardHeader>
            <CardTitle className="font-heading">Assign resources to a trip</CardTitle>
          </CardHeader>
          <CardContent className="max-w-md">
            <Label>Your trip listing</Label>
            {tripsLoading ? (
              <Skeleton className="h-10 w-full mt-2" />
            ) : trips.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-2">
                Create a trip under Manage Trips first.
              </p>
            ) : (
              <Select value={targetTripId} onValueChange={setTargetTripId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select trip…" />
                </SelectTrigger>
                <SelectContent>
                  {trips.map((t) => (
                    <SelectItem key={t.trip_id} value={String(t.trip_id)}>
                      #{t.trip_id} — {t.origin_city} → {t.destination_city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="buses" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="buses" className="flex items-center gap-2">
              <Bus className="h-4 w-4" />
              Bus search
            </TabsTrigger>
            <TabsTrigger value="hotels" className="flex items-center gap-2">
              <Hotel className="h-4 w-4" />
              Hotel search
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buses" className="space-y-6">
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="font-heading">Bus search</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="space-y-2">
                    <Label>Trip type</Label>
                    <Select
                      value={busSearch.tripType}
                      onValueChange={(value) => setBusSearch({ ...busSearch, tripType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one-way">One-way</SelectItem>
                        <SelectItem value="round-trip">Round-trip</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Origin (city)</Label>
                    <Input
                      placeholder="e.g., New York"
                      value={busSearch.origin}
                      onChange={(e) => setBusSearch({ ...busSearch, origin: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Destination (city)</Label>
                    <Input
                      placeholder="e.g., Philadelphia"
                      value={busSearch.destination}
                      onChange={(e) => setBusSearch({ ...busSearch, destination: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Travel date</Label>
                    <Input
                      type="date"
                      value={busSearch.travelDate}
                      onChange={(e) => setBusSearch({ ...busSearch, travelDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Coach class</Label>
                    <Select
                      value={busSearch.coachClass}
                      onValueChange={(value) => setBusSearch({ ...busSearch, coachClass: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="economy">Economy</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  type="button"
                  className="w-full md:w-auto"
                  onClick={() => toast.message("Sample results below — select services and assign to your trip.")}
                >
                  Search buses
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="font-heading">Available bus services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-medium">Select</th>
                        <th className="text-left p-3 font-medium">Operator</th>
                        <th className="text-left p-3 font-medium">Service #</th>
                        <th className="text-left p-3 font-medium">Route</th>
                        <th className="text-left p-3 font-medium">Dep / Arr</th>
                        <th className="text-left p-3 font-medium">Duration</th>
                        <th className="text-left p-3 font-medium">Stops</th>
                        <th className="text-left p-3 font-medium">Seats</th>
                        <th className="text-right p-3 font-medium">From</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dummyBuses.map((bus) => (
                        <tr key={bus.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                          <td className="p-3">
                            <Checkbox
                              checked={selectedBuses.includes(bus.id)}
                              onCheckedChange={() => handleBusToggle(bus.id)}
                            />
                          </td>
                          <td className="p-3 text-sm font-medium">{bus.operator}</td>
                          <td className="p-3 text-sm">{bus.serviceNumber}</td>
                          <td className="p-3 text-sm">{bus.route}</td>
                          <td className="p-3 text-sm">
                            {bus.departure} – {bus.arrival}
                          </td>
                          <td className="p-3 text-sm">{bus.duration}</td>
                          <td className="p-3 text-sm">{bus.stops}</td>
                          <td className="p-3 text-sm">{bus.seats}</td>
                          <td className="p-3 text-right font-bold text-primary">{formatPkr(bus.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button onClick={handleAddBusesToTrip} disabled={selectedBuses.length === 0}>
                    Add selected buses to trip ({selectedBuses.length})
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hotels" className="space-y-6">
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="font-heading">Hotel search</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input
                      placeholder="City or landmark"
                      value={hotelSearch.location}
                      onChange={(e) => setHotelSearch({ ...hotelSearch, location: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Check-in</Label>
                    <Input
                      type="date"
                      value={hotelSearch.checkIn}
                      onChange={(e) => setHotelSearch({ ...hotelSearch, checkIn: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Check-out</Label>
                    <Input
                      type="date"
                      value={hotelSearch.checkOut}
                      onChange={(e) => setHotelSearch({ ...hotelSearch, checkOut: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rooms</Label>
                    <Input
                      type="number"
                      min={1}
                      value={hotelSearch.rooms}
                      onChange={(e) => setHotelSearch({ ...hotelSearch, rooms: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Guests</Label>
                    <Input
                      type="number"
                      min={1}
                      value={hotelSearch.guests}
                      onChange={(e) => setHotelSearch({ ...hotelSearch, guests: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Star rating</Label>
                    <Select
                      value={hotelSearch.stars}
                      onValueChange={(value) => setHotelSearch({ ...hotelSearch, stars: value })}
                    >
                      <SelectTrigger>
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
                <Button
                  type="button"
                  className="w-full md:w-auto"
                  onClick={() => toast.message("Sample hotels below — add to your selected trip.")}
                >
                  Search hotels
                </Button>
              </CardContent>
            </Card>

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
                        <h3 className="font-heading font-bold text-lg mb-1">{hotel.name}</h3>
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
                          <p className="text-xl font-bold text-primary">{formatPkr(hotel.pricePerNight)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-body-text mb-1">{hotel.roomType}</p>
                          <Button size="sm" onClick={() => handleAddHotelToTrip(hotel)}>
                            Add to trip
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
