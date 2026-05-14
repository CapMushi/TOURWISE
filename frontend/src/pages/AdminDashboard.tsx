import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Briefcase } from "lucide-react";
import { getAdminDashboard } from "@/lib/api";

export default function AdminDashboard() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: getAdminDashboard,
    refetchInterval: 30_000,
  });

  const stats = data?.stats;
  const recentActivity = data?.recent_activity ?? [];

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
            <div className="text-3xl font-bold text-heading">
              {isLoading ? "..." : stats?.total_users ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Live count from registered profiles</p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-body-text">Pending Verifications</CardTitle>
            <UserCheck className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-heading">
              {isLoading ? "..." : stats?.pending_verifications ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Agent applications waiting</p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-body-text">Active Trips</CardTitle>
            <Briefcase className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-heading">
              {isLoading ? "..." : stats?.active_trips ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Trips with seats currently available</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="glass-panel border-0">
        <CardHeader>
          <CardTitle className="text-heading font-heading">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load dashboard activity."}
            </p>
          ) : recentActivity.length === 0 && !isLoading ? (
            <p className="text-sm text-muted-foreground">No recent admin activity yet.</p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm text-body-text">{activity.text}</p>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">{activity.time}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
