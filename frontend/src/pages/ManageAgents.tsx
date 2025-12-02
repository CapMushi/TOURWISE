import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Ban } from "lucide-react";
import { toast } from "sonner";

const pendingAgents = [
  { id: 1, name: "Sarah Williams", email: "sarah@travelco.com", dateApplied: "2025-11-25" },
  { id: 2, name: "Michael Chen", email: "michael@wanderlust.com", dateApplied: "2025-11-26" },
  { id: 3, name: "Emma Thompson", email: "emma@globetreks.com", dateApplied: "2025-11-27" },
];

const activeAgents = [
  { id: 1, name: "TravelCo Adventures", totalTrips: 15, rating: 4.8, status: "Active" },
  { id: 2, name: "Wanderlust Travels", totalTrips: 22, rating: 4.9, status: "Active" },
  { id: 3, name: "Globe Treks", totalTrips: 8, rating: 4.5, status: "Active" },
  { id: 4, name: "Journey Makers", totalTrips: 31, rating: 4.7, status: "Active" },
];

export default function ManageAgents() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(pendingAgents);
  const [active, setActive] = useState(activeAgents);

  const handleApprove = (id: number) => {
    setPending(pending.filter(agent => agent.id !== id));
    toast.success("Agent approved successfully");
  };

  const handleReject = (id: number) => {
    setPending(pending.filter(agent => agent.id !== id));
    toast.success("Agent application rejected");
  };

  const handleSuspend = (id: number) => {
    setActive(active.map(agent => 
      agent.id === id ? { ...agent, status: "Suspended" } : agent
    ));
    toast.success("Agent suspended");
  };

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
                    {pending.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No pending applications
                        </TableCell>
                      </TableRow>
                    ) : (
                      pending.map((agent) => (
                        <TableRow key={agent.id}>
                          <TableCell className="font-medium">{agent.name}</TableCell>
                          <TableCell>{agent.email}</TableCell>
                          <TableCell>{agent.dateApplied}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApprove(agent.id)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(agent.id)}
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
                  {active.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell 
                          className="font-medium text-primary hover:underline cursor-pointer"
                          onClick={() => navigate(`/admin/agent-profile/${agent.id}`)}
                        >
                          {agent.name}
                        </TableCell>
                        <TableCell>{agent.totalTrips}</TableCell>
                        <TableCell>{agent.rating} ⭐</TableCell>
                        <TableCell>
                          <span className={agent.status === "Active" ? "text-green-600" : "text-red-600"}>
                            {agent.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {agent.status === "Active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSuspend(agent.id)}
                            >
                              <Ban className="h-4 w-4 mr-1" />
                              Suspend
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
