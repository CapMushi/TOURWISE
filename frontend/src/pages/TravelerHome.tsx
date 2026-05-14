import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRecommendations, getTopAgents, getTrips } from "@/lib/api";
import { splitHomeTrips } from "@/lib/tripSections";
import { Search, Calendar as CalendarIcon, MapPin, Banknote, Bus, Users, Heart, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { TripCardFlexible } from "@/components/TripCardFlexible";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/layout/Footer";
import { PRICE_INPUT_PREFIX_LABEL } from "@/lib/currency";
import { Skeleton } from "@/components/ui/skeleton";
import heroImage from "@/assets/hero-tropical.jpg";
import fairyMeadowsHero from "@/assets/traveler-hero-fairy-meadows.png";
import mohenjoDaroHero from "@/assets/traveler-hero-mohenjo-daro.png";
import saifUlMalookHero from "@/assets/traveler-hero-saif-ul-malook.png";

const HERO_SLIDE_INTERVAL_MS = 5000;

const heroSlides = [
  { src: heroImage, alt: "Beautiful tropical paradise" },
  { src: fairyMeadowsHero, alt: "Fairy Meadows with snow-covered mountains" },
  { src: saifUlMalookHero, alt: "Saif-ul-Malook lake surrounded by green mountains" },
  { src: mohenjoDaroHero, alt: "Historic ruins at Mohenjo-daro" },
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
  const [suitability, setSuitability] = useState("Any");
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);

  const { data: topAgentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ["top-agents"],
    queryFn: () => getTopAgents(4),
  });

  const { data: tripsData, isLoading: tripsLoading } = useQuery({
    queryKey: ["home-trips"],
    queryFn: () => getTrips(),
  });

  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery({
    queryKey: ["home-recommendations"],
    queryFn: () => getRecommendations(4),
  });

  const { recommendations: fallbackRecommendations, trending } = splitHomeTrips(tripsData?.trips ?? []);
  const recommendations =
    recommendationsData?.trips && recommendationsData.trips.length > 0
      ? recommendationsData.trips
      : fallbackRecommendations;
  const liveTripCount = tripsData?.total ?? tripsData?.trips.length ?? 0;
  const destinationCount = new Set(
    (tripsData?.trips ?? []).map((trip) => `${trip.destination_city}-${trip.destination_province}`)
  ).size;
  const ratedAgentCount = topAgentsData?.agents.length ?? 0;

  useEffect(() => {
    if (heroSlides.length < 2) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveHeroIndex((currentIndex) => (currentIndex + 1) % heroSlides.length);
    }, HERO_SLIDE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Build search params - only include non-empty values
    const params = new URLSearchParams();
    
    if (province && province.trim()) {
      params.set("province", province.trim());
    }
    if (city && city.trim()) {
      params.set("city", city.trim());
    }
    if (departureDate) {
      params.set("departureDate", departureDate.toISOString());
    }
    if (arrivalDate) {
      params.set("arrivalDate", arrivalDate.toISOString());
    }
    if (priceFrom && priceFrom.trim() && parseFloat(priceFrom) > 0) {
      params.set("priceFrom", priceFrom.trim());
    }
    if (priceTo && priceTo.trim() && parseFloat(priceTo) > 0) {
      params.set("priceTo", priceTo.trim());
    }
    if (transportType && transportType !== "Any") {
      params.set("transport", transportType);
    }
    if (travelers && travelers.trim() && parseInt(travelers) > 0) {
      params.set("travelers", travelers.trim());
    }
    if (suitability && suitability !== "Any") {
      params.set("suitability", suitability);
    }
    
    // Navigate to search page with params (even if empty, it will show all trips)
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[600px] overflow-hidden">
        <div className="absolute inset-0">
          {heroSlides.map((slide, index) => (
            <img
              key={`${slide.alt}-${index}`}
              src={slide.src}
              alt={slide.alt}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out",
                index === activeHeroIndex ? "opacity-100" : "opacity-0"
              )}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-transparent" />
        </div>
        
        <div className="relative h-full flex flex-col items-center justify-center px-4">
          <h1 className="text-5xl md:text-6xl font-heading font-bold text-white text-center mb-8 animate-fade-in">
            Where to next?
          </h1>
          <p className="mb-8 max-w-3xl text-center text-lg text-white/90">
            Compare live listings, review travel agent profiles, and book with clearer expectations before
            you commit.
          </p>

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
                  <Banknote className="h-4 w-4" />
                  Price range from (PKR)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {PRICE_INPUT_PREFIX_LABEL}
                  </span>
                  <Input
                    type="number"
                    placeholder="0"
                    value={priceFrom}
                    onChange={(e) => setPriceFrom(e.target.value)}
                    className="bg-white/80 pl-12"
                    min="0"
                    step="1"
                  />
                </div>
              </div>

              {/* Price Range To */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-heading flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Price range to (PKR)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {PRICE_INPUT_PREFIX_LABEL}
                  </span>
                  <Input
                    type="number"
                    placeholder="500000"
                    value={priceTo}
                    onChange={(e) => setPriceTo(e.target.value)}
                    className="bg-white/80 pl-12"
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

              {/* Suitability */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-heading flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Suitability
                </Label>
                <Select value={suitability} onValueChange={setSuitability}>
                  <SelectTrigger className="bg-white/80">
                    <SelectValue placeholder="Select suitability" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Any">Any</SelectItem>
                    <SelectItem value="Solo Travelers">Solo Travelers</SelectItem>
                    <SelectItem value="Families">Families</SelectItem>
                    <SelectItem value="Couples">Couples</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg">
              Search Trips
            </Button>
          </form>

          {heroSlides.length > 1 && (
            <div className="mt-6 flex items-center gap-2">
              {heroSlides.map((_, index) => (
                <button
                  key={`hero-slide-dot-${index}`}
                  type="button"
                  aria-label={`Show traveler hero slide ${index + 1}`}
                  onClick={() => setActiveHeroIndex(index)}
                  className={cn(
                    "h-2.5 rounded-full transition-all duration-300",
                    index === activeHeroIndex ? "w-8 bg-white" : "w-2.5 bg-white/50 hover:bg-white/75"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-12 space-y-16">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="glass-card p-6">
            <div className="mb-3 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <p className="font-heading font-semibold text-heading">Live listings</p>
            </div>
            <p className="text-3xl font-heading font-bold text-heading">{liveTripCount}</p>
            <p className="mt-2 text-sm text-body-text">
              Search results now load page by page, so you can browse faster without pulling the full catalog
              at once.
            </p>
          </div>
          <div className="glass-card p-6">
            <div className="mb-3 flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" />
              <p className="font-heading font-semibold text-heading">Destinations to compare</p>
            </div>
            <p className="text-3xl font-heading font-bold text-heading">{destinationCount}</p>
            <p className="mt-2 text-sm text-body-text">
              Browse different routes, departure windows, and suitability tags before narrowing to one trip.
            </p>
          </div>
          <div className="glass-card p-6">
            <div className="mb-3 flex items-center gap-3">
              <Star className="h-5 w-5 text-primary" />
              <p className="font-heading font-semibold text-heading">Rated travel agents</p>
            </div>
            <p className="text-3xl font-heading font-bold text-heading">{ratedAgentCount}</p>
            <p className="mt-2 text-sm text-body-text">
              Check agent profiles, review counts, and active listings before you decide who to book with.
            </p>
          </div>
        </section>

        {/* AI Recommendations (live trips: soonest departures with availability) */}
        <section>
          <h2 className="text-3xl font-heading font-bold text-heading mb-6">
            AI-Powered Recommendations For You
          </h2>
          <p className="mb-4 max-w-3xl text-sm text-body-text">
            These suggestions are built from live trip availability and ranking logic, then shown with the
            same listing details you can verify yourself.
          </p>
          {recommendationsData?.summary && (
            <div className="glass-card p-4 mb-4 text-sm text-body-text">
              {recommendationsData.summary}
            </div>
          )}
          {tripsLoading || recommendationsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[420px] w-full" />
              ))}
            </div>
          ) : recommendations.length === 0 ? (
            <div className="glass-card p-8 text-center text-body-text">
              No trips to recommend yet. Try a search or check back when agents publish new listings.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {recommendations.map((trip) => (
                <TripCardFlexible
                  key={trip.trip_id}
                  trip={trip}
                  onClick={() => navigate(`/trip/${trip.trip_id}`)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Trending Destinations (newest listings) */}
        <section>
          <h2 className="text-3xl font-heading font-bold text-heading mb-6">
            Trending Destinations
          </h2>
          <p className="mb-4 max-w-3xl text-sm text-body-text">
            Fresh listings travelers are likely to compare right now, based on recently published inventory.
          </p>
          {tripsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[420px] w-full" />
              ))}
            </div>
          ) : trending.length === 0 ? (
            <div className="glass-card p-8 text-center text-body-text">
              No trending trips yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {trending.map((trip) => (
                <TripCardFlexible
                  key={trip.trip_id}
                  trip={trip}
                  onClick={() => navigate(`/trip/${trip.trip_id}`)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Top Rated Agents */}
        <section>
          <h2 className="text-3xl font-heading font-bold text-heading mb-6">
            Top Rated Travel Agents
          </h2>
          <p className="mb-4 max-w-3xl text-sm text-body-text">
            Open an agent profile to review their ratings, recent feedback, and live trips before you book.
          </p>
          {agentsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : topAgentsData && topAgentsData.agents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {topAgentsData.agents.map((agent) => (
                <div key={agent.agent_id} className="glass-card p-6 text-center space-y-3">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-2xl font-heading font-bold text-white">
                    {agent.name
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("") || "TW"}
                  </div>
                  <h3 className="font-heading font-semibold text-heading">{agent.name}</h3>
                  <div className="flex items-center justify-center gap-1 text-sm">
                    <span className="text-2xl">⭐</span>
                    <span className="font-medium">
                      {agent.rating ? agent.rating.toFixed(1) : "N/A"}
                    </span>
                    {agent.numberofreviews !== undefined && agent.numberofreviews > 0 && (
                      <span className="text-muted-foreground">
                        ({agent.numberofreviews} {agent.numberofreviews === 1 ? "review" : "reviews"})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-body-text">
                    Browse profile details, traveler reviews, and current listings before booking.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/agents/${agent.agent_id}`)}
                  >
                    View Profile
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <p className="text-body-text">No rated agents available at the moment.</p>
            </div>
          )}
        </section>
      </div>

      <Footer />
    </div>
  );
}
