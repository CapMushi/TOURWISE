import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Banknote, Calendar, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPkr } from "@/lib/currency";
import { getAgentDashboard } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

function bookingStatusClasses(status: string) {
  switch (status.toLowerCase()) {
    case "confirmed":
      return "bg-accent/20 text-accent";
    case "pending":
      return "bg-secondary/20 text-secondary";
    case "completed":
      return "bg-primary/15 text-primary";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function AgentDashboard() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["agent-dashboard"],
    queryFn: getAgentDashboard,
  });

  const stats = data?.stats;
  const chartData = data?.bookings_by_month ?? [];
  const recentBookings = data?.recent_bookings ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-heading font-bold text-heading">Dashboard</h1>
        <Button className="gap-2" onClick={() => navigate("/agent/add-trip")}>
          <Plus className="h-4 w-4" />
          Create New Listing
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-body-text">Total revenue (PKR)</span>
            <Banknote className="h-5 w-5 text-primary" />
          </div>
          {isLoading ? (
            <Skeleton className="h-10 w-36" />
          ) : (
            <div className="text-3xl font-heading font-bold text-heading">
              {formatPkr(stats?.total_revenue ?? 0)}
            </div>
          )}
          <div className="text-sm text-body-text">Revenue from non-cancelled bookings</div>
        </div>

        <div className="glass-card p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-body-text">Total bookings</span>
            <Calendar className="h-5 w-5 text-secondary" />
          </div>
          {isLoading ? (
            <Skeleton className="h-10 w-24" />
          ) : (
            <div className="text-3xl font-heading font-bold text-heading">
              {stats?.total_bookings ?? 0}
            </div>
          )}
          <div className="text-sm text-body-text">
            Across {stats?.active_listings ?? 0} active {stats?.active_listings === 1 ? "listing" : "listings"}
          </div>
        </div>

        <div className="glass-card p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-body-text">Pending inquiries</span>
            <MessageSquare className="h-5 w-5 text-accent" />
          </div>
          {isLoading ? (
            <Skeleton className="h-10 w-20" />
          ) : (
            <div className="text-3xl font-heading font-bold text-heading">
              {stats?.pending_inquiries ?? 0}
            </div>
          )}
          <div className="text-sm text-body-text">Unread messages and pending pooling requests</div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {(error as Error).message || "Failed to load dashboard data."}
          </AlertDescription>
        </Alert>
      )}

      <div className="glass-card p-6">
        <h2 className="text-2xl font-heading font-semibold text-heading mb-6">Bookings per Month</h2>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="bookings" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="glass-card p-6">
        <h2 className="text-2xl font-heading font-semibold text-heading mb-6">5 Most Recent Bookings</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-12 w-full" />
            ))}
          </div>
        ) : recentBookings.length === 0 ? (
          <p className="text-body-text text-center py-12">
            New bookings will appear here as travelers reserve your trips.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left py-3 px-4 font-heading font-semibold text-heading">Trip</th>
                  <th className="text-left py-3 px-4 font-heading font-semibold text-heading">Traveler</th>
                  <th className="text-left py-3 px-4 font-heading font-semibold text-heading">Date</th>
                  <th className="text-left py-3 px-4 font-heading font-semibold text-heading">Amount</th>
                  <th className="text-left py-3 px-4 font-heading font-semibold text-heading">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((booking) => (
                  <tr
                    key={booking.booking_id}
                    className="border-b border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4 text-body-text">{booking.trip_label}</td>
                    <td className="py-3 px-4 text-body-text">{booking.traveler_name}</td>
                    <td className="py-3 px-4 text-body-text">
                      {format(new Date(booking.booking_date), "MMM d, yyyy")}
                    </td>
                    <td className="py-3 px-4 text-body-text">{formatPkr(booking.total_price)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${bookingStatusClasses(
                          booking.status
                        )}`}
                      >
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
