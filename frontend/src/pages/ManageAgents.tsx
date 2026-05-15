import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Ban, CheckCircle, Eye, ShieldCheck, ShieldOff, XCircle } from "lucide-react";
import { toast } from "sonner";
import { BanDialog } from "@/components/admin/BanDialog";
import {
  banAgent,
  getAdminAgents,
  reviewAgentVerification,
  unbanAgent,
  type AdminManagedAgent,
} from "@/lib/api";

// Same helper as ManageTravelers — kept inline to avoid coupling pages.
function describeAgentBan(banned_until?: string | null): { permanent: boolean; label: string } | null {
  if (!banned_until) return null;
  if (banned_until.toLowerCase() === "infinity" || banned_until.toLowerCase() === "+infinity") {
    return { permanent: true, label: "Banned" };
  }
  try {
    const date = new Date(banned_until);
    if (Number.isNaN(date.getTime())) return null;
    if (date <= new Date()) return null;
    return { permanent: false, label: `Banned until ${format(date, "MMM d, yyyy")}` };
  } catch {
    return null;
  }
}

export default function ManageAgents() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [banSubject, setBanSubject] = useState<AdminManagedAgent | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-agents"],
    queryFn: getAdminAgents,
    refetchInterval: 30_000,
  });

  const decisionMutation = useMutation({
    mutationFn: ({ agentId, decision }: { agentId: number; decision: "approved" | "rejected" }) =>
      reviewAgentVerification(agentId, decision),
    onSuccess: (response) => {
      toast.success(response.message);
      void queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (mutationError) => {
      toast.error(mutationError instanceof Error ? mutationError.message : "Failed to update agent status");
    },
  });

  const banMutation = useMutation({
    mutationFn: ({ agentId, reason }: { agentId: number; reason: string }) =>
      banAgent(agentId, { reason }),
    onSuccess: (response) => {
      toast.success(response.message);
      void queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-agent-detail"] });
      setBanSubject(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to ban agent");
    },
  });

  const unbanMutation = useMutation({
    mutationFn: (agentId: number) => unbanAgent(agentId),
    onSuccess: (response) => {
      toast.success(response.message);
      void queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-agent-detail"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to unban agent");
    },
  });

  const pendingAgents = useMemo<AdminManagedAgent[]>(() => {
    const list = data?.pending ?? [];
    // Newest submission first; legacy rows without submitted_at fall back to created_at.
    return [...list].sort((a, b) => {
      const aKey = a.submitted_at || a.created_at || "";
      const bKey = b.submitted_at || b.created_at || "";
      return bKey.localeCompare(aKey);
    });
  }, [data?.pending]);
  const activeAgents = data?.active ?? [];

  const formatDateApplied = (value?: string | null) =>
    value ? format(new Date(value), "MMM d, yyyy") : "Unknown";

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-heading mb-2">Manage Agents</h1>
        <p className="text-body-text">Review applications and manage travel agents</p>
      </div>

      <Card className="glass-panel border-0">
        <CardContent className="pt-6">
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
              <TabsTrigger value="pending">Pending Requests</TabsTrigger>
              <TabsTrigger value="active">Active Agents</TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <div className="rounded-md border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Loading pending applications...
                        </TableCell>
                      </TableRow>
                    ) : isError ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-destructive py-8">
                          {error instanceof Error ? error.message : "Failed to load pending applications"}
                        </TableCell>
                      </TableRow>
                    ) : pendingAgents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No pending applications
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingAgents.map((agent) => (
                        <TableRow key={agent.agent_id}>
                          <TableCell className="font-medium">
                            {agent.business_name || (
                              <span className="text-muted-foreground italic">Not provided</span>
                            )}
                          </TableCell>
                          <TableCell>{agent.name}</TableCell>
                          <TableCell>{agent.email ?? "No email"}</TableCell>
                          <TableCell>
                            {agent.phone || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>{formatDateApplied(agent.submitted_at ?? agent.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  navigate(`/admin/agent-profile/${agent.agent_id}?from=pending`)
                                }
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                onClick={() =>
                                  decisionMutation.mutate({ agentId: agent.agent_id, decision: "approved" })
                                }
                                disabled={decisionMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  decisionMutation.mutate({ agentId: agent.agent_id, decision: "rejected" })
                                }
                                disabled={decisionMutation.isPending}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="active">
              <div className="rounded-md border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>CNIC</TableHead>
                      <TableHead>Trips</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Loading active agents...
                        </TableCell>
                      </TableRow>
                    ) : isError ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-destructive py-8">
                          {error instanceof Error ? error.message : "Failed to load active agents"}
                        </TableCell>
                      </TableRow>
                    ) : activeAgents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No approved agents yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      activeAgents.map((agent) => {
                        const banInfo = describeAgentBan(agent.banned_until);
                        const showBanned = agent.is_banned || banInfo !== null;
                        return (
                          <TableRow key={agent.agent_id}>
                            <TableCell
                              className="font-medium text-primary hover:underline cursor-pointer"
                              onClick={() => navigate(`/admin/agent-profile/${agent.agent_id}`)}
                            >
                              {agent.business_name || agent.name}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {agent.cnic_number || <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>{agent.total_trips}</TableCell>
                            <TableCell>
                              {agent.rating != null ? `${agent.rating.toFixed(1)} ⭐` : "No rating"}
                            </TableCell>
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
                                    onClick={() => unbanMutation.mutate(agent.agent_id)}
                                    disabled={unbanMutation.isPending}
                                  >
                                    <ShieldCheck className="h-4 w-4 mr-1" />
                                    Unban
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setBanSubject(agent)}
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <BanDialog
        open={banSubject !== null}
        onOpenChange={(next) => !next && setBanSubject(null)}
        subject={
          banSubject
            ? {
                kind: "agent",
                displayName: banSubject.business_name || banSubject.name || "this agent",
                cnicNumber: banSubject.cnic_number,
              }
            : null
        }
        busy={banMutation.isPending}
        onSubmit={async ({ reason }) => {
          if (!banSubject) return;
          await banMutation.mutateAsync({ agentId: banSubject.agent_id, reason });
        }}
      />
    </div>
  );
}
