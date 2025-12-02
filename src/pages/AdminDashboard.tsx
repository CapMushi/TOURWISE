import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Briefcase } from "lucide-react";

const recentActivity = [
  { id: 1, text: "New user signup: John Doe", time: "2 minutes ago" },
  { id: 2, text: "Agent 'TravelCo' added a new trip", time: "15 minutes ago" },
  { id: 3, text: "Agent verification request: Jane Smith", time: "1 hour ago" },
  { id: 4, text: "New user signup: Sarah Johnson", time: "2 hours ago" },
  { id: 5, text: "Trip 'Mountain Retreat' fully booked", time: "3 hours ago" },
];

export default function AdminDashboard() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-heading mb-2">Admin Dashboard</h1>
        <p className="text-body-text">Monitor platform health and activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass-panel border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-body-text">Total Users</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-heading">2,847</div>
            <p className="text-xs text-muted-foreground mt-1">Travelers & Agents combined</p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-body-text">Pending Verifications</CardTitle>
            <UserCheck className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-heading">12</div>
            <p className="text-xs text-muted-foreground mt-1">Agent applications waiting</p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-body-text">Active Trips</CardTitle>
            <Briefcase className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-heading">156</div>
            <p className="text-xs text-muted-foreground mt-1">Currently available on platform</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="glass-panel border-0">
        <CardHeader>
          <CardTitle className="text-heading font-heading">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                <p className="text-sm text-body-text">{activity.text}</p>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
