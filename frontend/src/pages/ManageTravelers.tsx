import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Ban, ShieldOff, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BanDialog } from "@/components/admin/BanDialog";
import {
  banTraveler,
  getAdminTravelers,
  unbanTraveler,
  type AdminTraveler,
  type BanDuration,
} from "@/lib/api";

// Resolve 'infinity' / future timestamps to a user-friendly label.
function describeBan(banned_until?: string | null): { permanent: boolean; label: string } | null {
  if (!banned_until) return null;
  if (banned_until.toLowerCase() === "infinity" || banned_until.toLowerCase() === "+infinity") {
    return { permanent: true, label: "Banned permanently" };
  }
  try {
    const date = new Date(banned_until);
    if (Number.isNaN(date.getTime())) return null;
    if (date <= new Date()) return null; // lazy-expired ban
    return { permanent: false, label: `Banned until ${format(date, "MMM d, yyyy")}` };
  } catch {
    return null;
  }
}

function formatJoinDate(value?: string | null): string {
  if (!value) return "Unknown";
  try {
    return format(new Date(value), "MMM d, yyyy");
  } catch {
    return value;
  }
}

export default function ManageTravelers() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [banSubject, setBanSubject] = useState<AdminTraveler | null>(null);

  // Debounce search input by ~300ms so we don't hammer the backend on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(searchQuery.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["admin-travelers", debouncedQ],
    queryFn: () => getAdminTravelers({ q: debouncedQ || undefined, limit: 100 }),
    refetchInterval: 60_000,
  });

  const banMutation = useMutation({
    mutationFn: ({ userId, duration, reason }: { userId: string; duration: BanDuration; reason: string }) =>
      banTraveler(userId, { duration, reason }),
    onSuccess: (response) => {
      toast.success(response.message);
      void queryClient.invalidateQueries({ queryKey: ["admin-travelers"] });
      setBanSubject(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to ban traveler");
    },
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: string) => unbanTraveler(userId),
    onSuccess: (response) => {
      toast.success(response.message);
      void queryClient.invalidateQueries({ queryKey: ["admin-travelers"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to unban traveler");
    },
  });

  const travelers = useMemo<AdminTraveler[]>(() => data?.travelers ?? [], [data?.travelers]);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-heading mb-2">Manage Travelers</h1>
        <p className="text-body-text">View and moderate the traveler user base</p>
        {!isLoading && !isError && data != null && (
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            {data.total} account{data.total === 1 ? "" : "s"} (admins excluded). Travel agents appear
            here too; agent-only actions stay under Manage Agents.
            {data.total > travelers.length
              ? ` Showing ${travelers.length} of ${data.total}; increase limit or add pagination if needed.`
              : ""}
          </p>
        )}
      </div>

      <Card className="glass-panel border-0">
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search travelers by name or email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Traveler</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Loading travelers...
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-destructive py-8">
                      {error instanceof Error ? error.message : "Failed to load travelers"}
                    </TableCell>
                  </TableRow>
                ) : travelers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {debouncedQ ? "No travelers match this search." : "No travelers found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  travelers.map((traveler) => {
                    const banInfo = describeBan(traveler.banned_until);
                    // Trust the server's is_banned flag (it handles 'infinity').
                    const showBanned = traveler.is_banned || banInfo !== null;
                    return (
                      <TableRow key={traveler.user_id}>
                        <TableCell className="font-medium">
                          {traveler.username || (
                            <span className="text-muted-foreground italic">(no username)</span>
                          )}
                        </TableCell>
                        <TableCell>{traveler.email ?? <span className="text-muted-foreground">No email</span>}</TableCell>
                        <TableCell>{formatJoinDate(traveler.created_at)}</TableCell>
                        <TableCell>
                          {showBanned ? (
                            <Badge variant="destructive" className="font-normal">
                              <ShieldOff className="h-3 w-3 mr-1" />
                              {banInfo?.label ?? "Banned"}
                            </Badge>
                          ) : (
                            <span className="inline-flex items-center text-emerald-600 text-sm">
                              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                              Active
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {showBanned ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => unbanMutation.mutate(traveler.user_id)}
                                disabled={unbanMutation.isPending}
                              >
                                <ShieldCheck className="h-4 w-4 mr-1" />
                                Unban
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setBanSubject(traveler)}
                                disabled={banMutation.isPending}
                              >
                                <Ban className="h-4 w-4 mr-1" />
                                Ban
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <BanDialog
        open={banSubject !== null}
        onOpenChange={(next) => !next && setBanSubject(null)}
        subject={
          banSubject
            ? { kind: "traveler", displayName: banSubject.username || banSubject.email || "this traveler" }
            : null
        }
        busy={banMutation.isPending}
        onSubmit={async ({ duration, reason }) => {
          if (!banSubject || !duration) return;
          await banMutation.mutateAsync({ userId: banSubject.user_id, duration, reason });
        }}
      />
    </div>
  );
}
