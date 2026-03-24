import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Banknote, Calendar, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPkr } from "@/lib/currency";

const chartData = [
  { month: "Jan", bookings: 12 },
  { month: "Feb", bookings: 19 },
  { month: "Mar", bookings: 15 },
  { month: "Apr", bookings: 25 },
  { month: "May", bookings: 22 },
  { month: "Jun", bookings: 30 },
];

const recentBookings = [
  { trip: "Romantic Paris Getaway", customer: "Alice Johnson", date: "2024-12-15", status: "Confirmed" },
  { trip: "Machu Picchu Adventure", customer: "Bob Smith", date: "2024-12-10", status: "Pending" },
  { trip: "Cultural Japan Experience", customer: "Carol White", date: "2024-12-08", status: "Confirmed" },
  { trip: "African Safari Expedition", customer: "David Brown", date: "2024-12-05", status: "Confirmed" },
  { trip: "Romantic Paris Getaway", customer: "Eve Davis", date: "2024-12-01", status: "Completed" },
];

export default function AgentDashboard() {
  const navigate = useNavigate();

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
          <div className="text-3xl font-heading font-bold text-heading">{formatPkr(12_678_400)}</div>
          <div className="text-sm text-accent">+12% from last month</div>
        </div>

        <div className="glass-card p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-body-text">New Bookings</span>
            <Calendar className="h-5 w-5 text-secondary" />
          </div>
          <div className="text-3xl font-heading font-bold text-heading">28</div>
          <div className="text-sm text-accent">+8% from last month</div>
        </div>

        <div className="glass-card p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-body-text">Pending Inquiries</span>
            <MessageSquare className="h-5 w-5 text-accent" />
          </div>
          <div className="text-3xl font-heading font-bold text-heading">7</div>
          <div className="text-sm text-body-text">Awaiting response</div>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-2xl font-heading font-semibold text-heading mb-6">Bookings per Month</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" />
            <YAxis />
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
      </div>

      <div className="glass-card p-6">
        <h2 className="text-2xl font-heading font-semibold text-heading mb-6">5 Most Recent Bookings</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left py-3 px-4 font-heading font-semibold text-heading">Trip Name</th>
                <th className="text-left py-3 px-4 font-heading font-semibold text-heading">Customer</th>
                <th className="text-left py-3 px-4 font-heading font-semibold text-heading">Date</th>
                <th className="text-left py-3 px-4 font-heading font-semibold text-heading">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((booking, idx) => (
                <tr key={idx} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 text-body-text">{booking.trip}</td>
                  <td className="py-3 px-4 text-body-text">{booking.customer}</td>
                  <td className="py-3 px-4 text-body-text">{booking.date}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        booking.status === "Confirmed"
                          ? "bg-accent/20 text-accent"
                          : booking.status === "Pending"
                            ? "bg-secondary/20 text-secondary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
