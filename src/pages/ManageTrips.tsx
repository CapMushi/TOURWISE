import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const trips = [
  {
    id: 1,
    name: "Weekend Mountain Hiking Retreat",
    image: "/placeholder.svg",
    dates: "Oct 25-27, 2025",
    status: "Active",
  },
  {
    id: 2,
    name: "Coastal Beach Getaway",
    image: "/placeholder.svg",
    dates: "Nov 10-15, 2025",
    status: "Active",
  },
  {
    id: 3,
    name: "Cultural Heritage Tour",
    image: "/placeholder.svg",
    dates: "Dec 1-5, 2025",
    status: "Draft",
  },
  {
    id: 4,
    name: "Desert Safari Adventure",
    image: "/placeholder.svg",
    dates: "Jan 15-20, 2026",
    status: "Fully Booked",
  },
];

export default function ManageTrips() {
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-accent text-accent-foreground";
      case "Draft":
        return "bg-muted text-muted-foreground";
      case "Fully Booked":
        return "bg-primary text-primary-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-4xl font-heading font-bold text-heading">Manage Trips</h1>

      {/* Add New Trip Card */}
      <div
        onClick={() => navigate("/agent/add-trip")}
        className="glass-card p-12 flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-all duration-300 border-2 border-dashed border-primary/30 hover:border-primary"
      >
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Plus className="h-10 w-10 text-primary" />
        </div>
        <p className="text-lg font-heading font-semibold text-heading">Add New Trip</p>
      </div>

      {/* Trip List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trips.map((trip) => (
          <div key={trip.id} className="glass-card overflow-hidden group">
            <div className="aspect-video bg-muted relative overflow-hidden">
              <img
                src={trip.image}
                alt={trip.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-heading font-bold text-xl text-heading mb-2">{trip.name}</h3>
                <p className="text-sm text-body-text">{trip.dates}</p>
              </div>
              <Badge className={getStatusColor(trip.status)}>{trip.status}</Badge>
              <Button
                className="w-full"
                onClick={() => navigate(`/agent/manage-details/${trip.id}`)}
              >
                Manage Details
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
