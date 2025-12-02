import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const agentData = {
  businessName: "TravelCo Adventures",
  agentName: "Sarah Williams",
  email: "sarah@travelco.com",
  phone: "+1 (555) 123-4567",
  verificationStatus: "Verified",
  totalRevenue: "$45,000",
  totalTripsHosted: 15,
  averageRating: 4.8,
  activeTrips: [
    { name: "Mountain Hiking Retreat", price: "$250", status: "Active" },
    { name: "Coastal Beach Getaway", price: "$180", status: "Active" },
    { name: "City Food Tour", price: "$95", status: "Draft" },
  ],
};

export default function AgentProfileDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const handleSuspend = () => {
    toast.error("Agent account suspended");
    navigate(-1);
  };

  return (
    <div className="p-8 space-y-8">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Manage Users
      </Button>

      <div>
        <h1 className="text-3xl font-heading font-bold text-heading mb-2">Agent Profile</h1>
        <p className="text-body-text">Comprehensive business overview and performance metrics</p>
      </div>

      {/* Header Section */}
      <Card className="glass-panel border-0">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">{agentData.businessName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Agent Name</p>
              <p className="font-medium">{agentData.agentName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{agentData.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{agentData.phone}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Verification Status</p>
              <Badge variant="default">{agentData.verificationStatus}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-panel border-0">
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-primary">{agentData.totalRevenue}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Revenue Generated</p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-0">
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-accent">{agentData.totalTripsHosted}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Trips Hosted</p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-0">
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-heading">{agentData.averageRating} ⭐</p>
            <p className="text-sm text-muted-foreground mt-1">Average Rating</p>
          </CardContent>
        </Card>
      </div>

      {/* Listing Overview */}
      <Card className="glass-panel border-0">
        <CardHeader>
          <CardTitle className="font-heading">Current Listings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {agentData.activeTrips.map((trip, idx) => (
              <div key={idx} className="glass-panel p-4 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-medium">{trip.name}</p>
                  <p className="text-sm text-muted-foreground">{trip.price} per person</p>
                </div>
                <Badge variant={trip.status === "Active" ? "default" : "secondary"}>
                  {trip.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="glass-panel border-2 border-destructive/50">
        <CardHeader>
          <CardTitle className="font-heading text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Suspending this account will immediately revoke access and hide all their listings from the platform.
          </p>
          <Button variant="destructive" onClick={handleSuspend}>
            Suspend Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
