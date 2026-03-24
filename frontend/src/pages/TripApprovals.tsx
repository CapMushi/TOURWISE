import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye } from "lucide-react";
import { formatPkr } from "@/lib/currency";

const pendingTrips = [
  { id: 1, tripName: "Himalayan Sunrise Trek", agentName: "TravelCo Adventures", submissionDate: "2025-11-20", pricePkr: 98_000 },
  { id: 2, tripName: "Paris Culinary Experience", agentName: "Wanderlust Travels", submissionDate: "2025-11-22", pricePkr: 336_000 },
  { id: 3, tripName: "Safari Adventure Kenya", agentName: "Globe Treks", submissionDate: "2025-11-25", pricePkr: 700_000 },
  { id: 4, tripName: "Tokyo Night Tours", agentName: "Journey Makers", submissionDate: "2025-11-27", pricePkr: 126_000 },
];

export default function TripApprovals() {
  const navigate = useNavigate();
  const [trips] = useState(pendingTrips);

  const handleReview = (tripId: number) => {
    navigate(`/admin/trip-review/${tripId}`);
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-heading mb-2">Trip Approvals</h1>
        <p className="text-body-text">Review and approve travel agent submissions</p>
      </div>

      <Card className="glass-panel border-0">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Pending Trip Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip Name</TableHead>
                  <TableHead>Agent Name</TableHead>
                  <TableHead>Submission Date</TableHead>
                  <TableHead>Price (PKR)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No pending trip submissions
                    </TableCell>
                  </TableRow>
                ) : (
                  trips.map((trip) => (
                    <TableRow key={trip.id}>
                      <TableCell className="font-medium">{trip.tripName}</TableCell>
                      <TableCell>{trip.agentName}</TableCell>
                      <TableCell>{trip.submissionDate}</TableCell>
                      <TableCell>{formatPkr(trip.pricePkr)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReview(trip.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
