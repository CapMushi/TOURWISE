import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  MapPin,
  Users,
  Banknote,
  FileText,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getMyBookings, cancelBooking, type BookingResponse } from "@/lib/api";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatPkr } from "@/lib/currency";

// Safe date formatter
const formatDate = (dateString: string | undefined | null, formatStr: string = "MMM dd, yyyy HH:mm"): string => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return format(date, formatStr);
  } catch (error) {
    return "Invalid Date";
  }
};

export default function MyBookings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingResponse | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  const { data: bookings, isLoading, error } = useQuery({
    queryKey: ["my-bookings", statusFilter],
    queryFn: () => getMyBookings(statusFilter === "all" ? undefined : statusFilter),
  });

  const cancelMutation = useMutation({
    mutationFn: (data: { bookingId: number; reason?: string }) =>
      cancelBooking(data.bookingId, data.reason),
    onSuccess: () => {
      toast({
        title: "Booking Cancelled",
        description: "Your booking has been cancelled and refund will be processed.",
      });
      setCancelDialogOpen(false);
      setSelectedBooking(null);
      setCancellationReason("");
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["trip"] });
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel booking. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCancelClick = (booking: BookingResponse) => {
    if (booking.status === "cancelled") {
      toast({
        title: "Already Cancelled",
        description: "This booking is already cancelled.",
        variant: "destructive",
      });
      return;
    }
    setSelectedBooking(booking);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = () => {
    if (!selectedBooking) return;
    cancelMutation.mutate({
      bookingId: selectedBooking.booking_id,
      reason: cancellationReason || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      confirmed: "default",
      cancelled: "destructive",
      completed: "outline",
      refunded: "destructive",
      expired: "secondary",
    };

    const icons: Record<string, any> = {
      pending: Clock,
      confirmed: CheckCircle2,
      cancelled: XCircle,
      completed: CheckCircle2,
      refunded: XCircle,
      expired: Clock,
    };

    const Icon = icons[status] || AlertCircle;

    return (
      <Badge variant={variants[status] || "default"}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-4xl font-heading font-bold text-heading">My Bookings</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error loading bookings: {error instanceof Error ? error.message : "Unknown error"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const filteredBookings = bookings || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-heading font-bold text-heading">My Bookings</h1>
        {filteredBookings.length > 0 && (
          <p className="text-body-text">
            {filteredBookings.length} {filteredBookings.length === 1 ? "booking" : "bookings"}
          </p>
        )}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          onClick={() => setStatusFilter("all")}
        >
          All
        </Button>
        <Button
          variant={statusFilter === "confirmed" ? "default" : "outline"}
          onClick={() => setStatusFilter("confirmed")}
        >
          Confirmed
        </Button>
        <Button
          variant={statusFilter === "completed" ? "default" : "outline"}
          onClick={() => setStatusFilter("completed")}
        >
          Completed
        </Button>
        <Button
          variant={statusFilter === "cancelled" ? "default" : "outline"}
          onClick={() => setStatusFilter("cancelled")}
        >
          Cancelled
        </Button>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <Card className="glass-card border-0">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-body-text" />
            <p className="text-lg text-body-text mb-4">No bookings found</p>
            <Button onClick={() => navigate("/")}>Browse Trips</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <Card
              key={`${booking.booking_source ?? "local"}-${booking.booking_id}`}
              className="glass-card border-0"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      {booking.trip?.origin_city || "N/A"} → {booking.trip?.destination_city || "N/A"}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Booking Reference: <span className="font-mono font-semibold">{booking.booking_reference}</span>
                      {booking.booking_source === "external" && (
                        <Badge variant="outline" className="ml-2">
                          Partner trip
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                  {getStatusBadge(booking.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-body-text" />
                    <div>
                      <p className="text-sm text-body-text">Booking Date</p>
                      <p className="font-medium">{formatDate(booking.booking_date, "MMM dd, yyyy")}</p>
                    </div>
                  </div>
                  {booking.trip && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-body-text" />
                      <div>
                        <p className="text-sm text-body-text">Trip Date</p>
                        <p className="font-medium">{formatDate(booking.trip.departure_time, "MMM dd, yyyy")}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-body-text" />
                    <div>
                      <p className="text-sm text-body-text">Seats</p>
                      <p className="font-medium">{booking.number_of_seats}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-body-text" />
                    <div>
                      <p className="text-sm text-body-text">Total Price</p>
                      <p className="font-medium">{formatPkr(booking.total_price)}</p>
                    </div>
                  </div>
                </div>

                {booking.trip && (
                  <div className="flex items-center gap-2 text-sm text-body-text">
                    <MapPin className="h-4 w-4" />
                    <span>
                      Departure: {formatDate(booking.trip.departure_time, "MMM dd, yyyy HH:mm")} | Arrival:{" "}
                      {formatDate(booking.trip.arrival_time, "MMM dd, yyyy HH:mm")}
                    </span>
                  </div>
                )}

                {booking.agent_name && (
                  <div className="text-sm text-body-text">
                    Organized by: <span className="font-medium">{booking.agent_name}</span>
                  </div>
                )}

                {booking.passenger_names && booking.passenger_names.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Passengers:</p>
                    <div className="flex flex-wrap gap-2">
                      {booking.passenger_names.map((name, idx) => (
                        <Badge key={idx} variant="outline">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {booking.special_requests && (
                  <div>
                    <p className="text-sm font-medium mb-1">Special Requests:</p>
                    <p className="text-sm text-body-text">{booking.special_requests}</p>
                  </div>
                )}

                {booking.cancelled_at && booking.cancellation_reason && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Cancelled:</strong> {booking.cancellation_reason}
                      {booking.refund_amount && (
                        <span className="block mt-1">Refund Amount: {formatPkr(booking.refund_amount)}</span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/trip/${booking.trip_id}`)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Trip Details
                  </Button>
                  {booking.status !== "cancelled" && booking.status !== "completed" && (
                    <Button
                      variant="destructive"
                      onClick={() => handleCancelClick(booking)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel Booking
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cancel Booking Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel booking {selectedBooking?.booking_reference}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedBooking && (
              <div className="p-4 glass-panel rounded-lg space-y-2">
                <p className="font-medium">{selectedBooking.trip?.origin_city} → {selectedBooking.trip?.destination_city}</p>
                <p className="text-sm text-body-text">
                  Total: {formatPkr(selectedBooking.total_price)} | Seats: {selectedBooking.number_of_seats}
                </p>
                <p className="text-sm text-body-text">
                  Refund Amount:{" "}
                  <span className="font-semibold text-primary">
                    {formatPkr(selectedBooking.refund_amount ?? selectedBooking.total_price)}
                  </span>
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="cancellation_reason">Cancellation Reason (Optional)</Label>
              <Textarea
                id="cancellation_reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Please provide a reason for cancellation..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

