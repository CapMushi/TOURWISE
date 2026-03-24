import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Bell, Bus, CalendarDays, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getAgentNotificationFeed, type AgentNotificationFeedItem } from "@/lib/api";

function categoryIcon(category: string) {
  switch (category) {
    case "pooling":
      return Bus;
    case "booking":
      return CalendarDays;
    case "message":
      return MessageSquare;
    default:
      return Bell;
  }
}

export default function AgentNotifications() {
  const navigate = useNavigate();
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ["agent-notification-feed"],
    queryFn: () => getAgentNotificationFeed(40),
  });

  const openCollaboration = (item: AgentNotificationFeedItem) => {
    if (item.category === "pooling" || item.category === "message") {
      navigate("/agent/collaboration");
    } else {
      navigate("/agent/manage-trips");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Bell className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-4xl font-heading font-bold text-heading">Notifications</h1>
          <p className="text-sm text-body-text mt-1">
            Pooling requests, new bookings on your trips, and unread messages
          </p>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {(error as Error).message || "Could not load notifications"}
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && items.length === 0 && (
          <p className="text-body-text text-center py-12">
            You&apos;re all caught up. New booking activity and pooling requests will show here.
          </p>
        )}

        {!isLoading &&
          items.map((notification) => {
            const Icon = categoryIcon(notification.category);
            return (
              <div
                key={notification.notification_id}
                className="flex flex-col sm:flex-row sm:items-start gap-4 p-4 rounded-lg hover:bg-white/30 transition-colors border border-transparent hover:border-white/20"
              >
                <div className="mt-1">
                  <Icon className="h-5 w-5 text-primary shrink-0" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-semibold text-heading">{notification.title}</p>
                  <p className="text-body-text text-sm mt-1">{notification.body}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => openCollaboration(notification)}
                >
                  {notification.category === "booking" ? "Manage trips" : "Open hub"}
                </Button>
              </div>
            );
          })}
      </div>
    </div>
  );
}
