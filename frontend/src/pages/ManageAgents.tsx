import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getAdminAgents, reviewAgentVerification } from "@/lib/api";

export default function ManageAgents() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  const pendingAgents = data?.pending ?? [];
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
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Date Applied</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Loading pending applications...
                        </TableCell>
                      </TableRow>
                    ) : isError ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-destructive py-8">
                          {error instanceof Error ? error.message : "Failed to load pending applications"}
                        </TableCell>
                      </TableRow>
                    ) : pendingAgents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No pending applications
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingAgents.map((agent) => (
                        <TableRow key={agent.agent_id}>
                          <TableCell className="font-medium">{agent.name}</TableCell>
                          <TableCell>{agent.email ?? "No email"}</TableCell>
                          <TableCell>{formatDateApplied(agent.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
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
                      <TableHead>Agent Name</TableHead>
                      <TableHead>Total Trips Hosted</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Loading active agents...
                        </TableCell>
                      </TableRow>
                    ) : isError ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-destructive py-8">
                          {error instanceof Error ? error.message : "Failed to load active agents"}
                        </TableCell>
                      </TableRow>
                    ) : activeAgents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No approved agents yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      activeAgents.map((agent) => (
                      <TableRow key={agent.agent_id}>
                        <TableCell 
                          className="font-medium text-primary hover:underline cursor-pointer"
                          onClick={() => navigate(`/admin/agent-profile/${agent.agent_id}`)}
                        >
                          {agent.name}
                        </TableCell>
                        <TableCell>{agent.totalTrips}</TableCell>
                        <TableCell>{agent.rating != null ? `${agent.rating.toFixed(1)} ⭐` : "No rating"}</TableCell>
                        <TableCell>
                          <span className="text-green-600 capitalize">
                            {agent.verification_status ?? "approved"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          Admin-approved
                        </TableCell>
                      </TableRow>
                    )))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
