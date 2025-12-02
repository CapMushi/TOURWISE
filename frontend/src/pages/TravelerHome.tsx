import { useState } from "react";
import { Search, Calendar as CalendarIcon, MapPin, DollarSign, Bus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { TripCard } from "@/components/TripCard";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/layout/Footer";
import heroImage from "@/assets/hero-tropical.jpg";
import parisImage from "@/assets/trip-paris.jpg";
import peruImage from "@/assets/trip-peru.jpg";
import japanImage from "@/assets/trip-japan.jpg";
import safariImage from "@/assets/trip-safari.jpg";

const aiRecommendations = [
  {
    id: 1,
    image: parisImage,
    title: "Romantic Paris Getaway",
    destination: "Paris, France",
    agent: "Sophie Laurent",
    price: 2499,
    rating: 4.9,
    duration: "7 days"
  },
  {
    id: 2,
    image: peruImage,
    title: "Machu Picchu Adventure",
    destination: "Cusco, Peru",
    agent: "Carlos Rodriguez",
    price: 1899,
    rating: 4.8,
    duration: "10 days"
  },
  {
    id: 3,
    image: japanImage,
    title: "Cultural Japan Experience",
    destination: "Tokyo & Kyoto",
    agent: "Yuki Tanaka",
    price: 3299,
    rating: 5.0,
    duration: "14 days"
  },
  {
    id: 4,
    image: safariImage,
    title: "African Safari Expedition",
    destination: "Serengeti, Tanzania",
    agent: "David Mbeki",
    price: 4199,
    rating: 4.9,
    duration: "12 days"
  },
];

export default function TravelerHome() {
  const navigate = useNavigate();
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [departureDate, setDepartureDate] = useState<Date>();
  const [arrivalDate, setArrivalDate] = useState<Date>();
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [transportType, setTransportType] = useState("Any");
  const [travelers, setTravelers] = useState("2");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/search");
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[600px] overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={heroImage} 
            alt="Beautiful tropical paradise" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-transparent" />
        </div>
        
        <div className="relative h-full flex flex-col items-center justify-center px-4">
          <h1 className="text-5xl md:text-6xl font-heading font-bold text-white text-center mb-8 animate-fade-in">
            Where to next?
          </h1>

          <form onSubmit={handleSearch} className="glass-panel p-6 w-full max-w-6xl animate-scale-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Destination Province/District */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-heading flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Destination Province/District
                </Label>
                <Input
                  placeholder="e.g., Khyber-Pakhtunkhwa"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="bg-white/80"
                  pattern="[A-Za-z0-9\s\-]+"
                />
              </div>

              {/* Destination City */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-heading flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Destination City
                </Label>
                <Input
                  placeholder="e.g., New York"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="bg-white/80"
                  pattern="[A-Za-z0-9\s\-]+"
                />
              </div>

              {/* Date of Departure */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-heading flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Date of Departure
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-white/80",
                        !departureDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {departureDate ? format(departureDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={departureDate}
                      onSelect={setDepartureDate}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (date < today) return true;
                        if (arrivalDate && date > arrivalDate) return true;
                        return false;
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date of Arrival */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-heading flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Date of Arrival
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-white/80",
                        !arrivalDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {arrivalDate ? format(arrivalDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={arrivalDate}
                      onSelect={setArrivalDate}
                      disabled={(date) => {
                        if (departureDate && date < departureDate) return true;
                        return false;
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Price Range From */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-heading flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Price Range From
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    placeholder="0"
                    value={priceFrom}
                    onChange={(e) => setPriceFrom(e.target.value)}
                    className="bg-white/80 pl-7"
                    min="0"
                    step="1"
                  />
                </div>
              </div>

              {/* Price Range To */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-heading flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Price Range To
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    placeholder="10000"
                    value={priceTo}
                    onChange={(e) => setPriceTo(e.target.value)}
                    className="bg-white/80 pl-7"
                    min={priceFrom || "0"}
                    step="1"
                  />
                </div>
              </div>

              {/* Transport Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-heading flex items-center gap-2">
                  <Bus className="h-4 w-4" />
                  Transport Type
                </Label>
                <Select value={transportType} onValueChange={setTransportType}>
                  <SelectTrigger className="bg-white/80">
                    <SelectValue placeholder="Select transport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="flight">Flight</SelectItem>
                    <SelectItem value="bus">Bus</SelectItem>
                    <SelectItem value="train">Train</SelectItem>
                    <SelectItem value="private-car">Private Car</SelectItem>
                    <SelectItem value="ship">Ship</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Travelers */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-heading flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Travelers
                </Label>
                <Input
                  type="number"
                  placeholder="2"
                  value={travelers}
                  onChange={(e) => setTravelers(e.target.value)}
                  className="bg-white/80"
                  min="1"
                  step="1"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg">
              Search Trips
            </Button>
          </form>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-12 space-y-16">
        {/* AI Recommendations */}
        <section>
          <h2 className="text-3xl font-heading font-bold text-heading mb-6">
            AI-Powered Recommendations For You
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {aiRecommendations.map((trip) => (
              <TripCard key={trip.id} {...trip} onClick={() => navigate(`/trip/${trip.id}`)} />
            ))}
          </div>
        </section>

        {/* Trending Destinations */}
        <section>
          <h2 className="text-3xl font-heading font-bold text-heading mb-6">
            Trending Destinations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {aiRecommendations.slice(0, 4).map((trip) => (
              <TripCard key={trip.id} {...trip} onClick={() => navigate(`/trip/${trip.id}`)} />
            ))}
          </div>
        </section>

        {/* Top Rated Agents */}
        <section>
          <h2 className="text-3xl font-heading font-bold text-heading mb-6">
            Top Rated Travel Agents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {["Sophie Laurent", "Carlos Rodriguez", "Yuki Tanaka", "David Mbeki"].map((agent, idx) => (
              <div key={idx} className="glass-card p-6 text-center space-y-3">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-secondary" />
                <h3 className="font-heading font-semibold text-heading">{agent}</h3>
                <div className="flex items-center justify-center gap-1 text-sm">
                  <span className="text-2xl">⭐</span>
                  <span className="font-medium">4.9</span>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  View Profile
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
