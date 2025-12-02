import { Bell, MessageSquare, Eye } from "lucide-react";

const notifications = [
  {
    id: 1,
    icon: MessageSquare,
    message: "Jane Doe has booked 'Weekend Mountain Hiking Retreat'.",
    time: "2 hours ago",
  },
  {
    id: 2,
    icon: MessageSquare,
    message: "You have 3 new messages in the Collaboration Hub.",
    time: "5 hours ago",
  },
  {
    id: 3,
    icon: Eye,
    message: "Your listing 'Coastal Getaway' has 5 new views.",
    time: "1 day ago",
  },
  {
    id: 4,
    icon: MessageSquare,
    message: "Bob Smith requested more details about 'Safari Adventure'.",
    time: "2 days ago",
  },
];

export default function AgentNotifications() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Bell className="h-8 w-8 text-primary" />
        <h1 className="text-4xl font-heading font-bold text-heading">Notifications</h1>
      </div>

      <div className="glass-card p-6 space-y-4">
        {notifications.map((notification) => {
          const Icon = notification.icon;
          return (
            <div
              key={notification.id}
              className="flex items-start gap-4 p-4 rounded-lg hover:bg-white/30 transition-colors"
            >
              <div className="mt-1">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-body-text">{notification.message}</p>
                <p className="text-sm text-muted-foreground mt-1">{notification.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
