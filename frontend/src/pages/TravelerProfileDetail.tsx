import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const travelerData = {
  name: "John Doe",
  email: "john@example.com",
  joinDate: "2025-10-15",
  status: "Active",
  bookingHistory: [
    { tripName: "Mountain Hiking Retreat", date: "2025-10-25", agentName: "TravelCo Adventures", paymentStatus: "Paid" },
    { tripName: "Paris Culinary Tour", date: "2025-09-15", agentName: "Wanderlust Travels", paymentStatus: "Paid" },
    { tripName: "Safari Kenya Adventure", date: "2025-08-10", agentName: "Globe Treks", paymentStatus: "Refunded" },
  ],
};

export default function TravelerProfileDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="p-8 space-y-8">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Manage Users
      </Button>

      <div>
        <h1 className="text-3xl font-heading font-bold text-heading mb-2">Traveler Profile</h1>
        <p className="text-body-text">Detailed information and booking history</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Card A: User Identity */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading">User Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl">JD</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-heading font-bold">{travelerData.name}</h3>
                <p className="text-body-text">{travelerData.email}</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Registration Date</p>
                <p className="font-medium">{travelerData.joinDate}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Account Status</p>
                <Badge variant={travelerData.status === "Active" ? "default" : "destructive"}>
                  {travelerData.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card B: Quick Stats */}
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading">Activity Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-panel p-4 rounded-lg">
                <p className="text-2xl font-bold text-primary">3</p>
                <p className="text-sm text-muted-foreground">Total Bookings</p>
              </div>
              <div className="glass-panel p-4 rounded-lg">
                <p className="text-2xl font-bold text-accent">$1,850</p>
                <p className="text-sm text-muted-foreground">Total Spent</p>
              </div>
            </div>
            <div className="glass-panel p-4 rounded-lg">
              <p className="text-lg font-medium">Last Activity</p>
              <p className="text-sm text-muted-foreground">Booked "Mountain Hiking Retreat" on Oct 15, 2025</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Booking History */}
      <Card className="glass-panel border-0">
        <CardHeader>
          <CardTitle className="font-heading">Booking History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Agent Name</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {travelerData.bookingHistory.map((booking, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{booking.tripName}</TableCell>
                    <TableCell>{booking.date}</TableCell>
                    <TableCell>{booking.agentName}</TableCell>
                    <TableCell>
                      <Badge variant={booking.paymentStatus === "Paid" ? "default" : "secondary"}>
                        {booking.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
