import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getMyBookingNotifications,
  markAllBookingNotificationsRead,
  markBookingNotificationRead,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

export default function TravelerNotifications() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["traveler-notifications", currentPage],
    queryFn: () => getMyBookingNotifications(currentPage, PAGE_SIZE),
  });

  const markReadMutation = useMutation({
    mutationFn: markBookingNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traveler-notifications"] });
    },
    onError: (e: Error) => {
      toast({ title: "Could not update", description: e.message, variant: "destructive" });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllBookingNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traveler-notifications"] });
      toast({ title: "All caught up", description: "Notifications marked as read." });
    },
    onError: (e: Error) => {
      toast({ title: "Could not update", description: e.message, variant: "destructive" });
    },
  });

  const items = data?.notifications ?? [];
  const unreadCount = data?.unread_count ?? 0;
  const visibleCurrentPage = data?.page ?? currentPage;
  const totalPages = data?.total_pages ?? 1;
  const startPage = Math.max(1, visibleCurrentPage - 2);
  const endPage = Math.min(totalPages, visibleCurrentPage + 2);
  const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, idx) => startPage + idx);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-4xl font-heading font-bold text-heading">Notifications</h1>
            <p className="text-sm text-body-text">Updates about your bookings</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            className="gap-2 shrink-0"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="glass-card p-6 space-y-2">
        {!isLoading && !error && (
          <div className="mb-4 rounded-xl border border-border/60 bg-background/40 p-4">
            <p className="text-sm text-body-text">
              {unreadCount > 0
                ? `You have ${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"}.`
                : "You're all caught up. New booking updates will show up here."}
            </p>
            {(data?.total ?? 0) > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Showing {items.length} of {data?.total} notifications.
              </p>
            )}
          </div>
        )}

        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {error && (
          <p className="text-destructive text-sm">
            {(error as Error).message || "Failed to load notifications"}
          </p>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="py-12 text-center">
            <Bell className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-body-text">
              No notifications yet. When you book or cancel a trip, updates will appear here.
            </p>
          </div>
        )}

        {!isLoading &&
          items.map((n) => (
            <div
              key={n.notification_id}
              className={`flex flex-col sm:flex-row sm:items-start gap-3 p-4 rounded-lg border border-transparent hover:bg-white/30 transition-colors ${
                !n.is_read ? "bg-primary/5 border-primary/20" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-heading">{n.title}</p>
                <p className="text-body-text text-sm mt-1">{n.message}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
              <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/booking/${n.booking_id}`)}
                >
                  View booking
                </Button>
                {!n.is_read && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => markReadMutation.mutate(n.notification_id)}
                    disabled={markReadMutation.isPending}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </div>
          ))}

        {totalPages > 1 && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-body-text">
              Page {visibleCurrentPage} of {totalPages}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(visibleCurrentPage - 1)}
                disabled={!data?.has_previous_page}
              >
                Previous
              </Button>
              {pageNumbers.map((pageNumber) => (
                <Button
                  key={pageNumber}
                  variant={pageNumber === visibleCurrentPage ? "default" : "outline"}
                  onClick={() => setCurrentPage(pageNumber)}
                >
                  {pageNumber}
                </Button>
              ))}
              <Button
                variant="outline"
                onClick={() => setCurrentPage(visibleCurrentPage + 1)}
                disabled={!data?.has_next_page}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
