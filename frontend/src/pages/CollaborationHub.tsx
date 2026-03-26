import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Users,
  MessageSquare,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Bus,
  User,
  Star,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  getOtherAgents,
  getOtherAgentsTrips,
  getMatchingTrips,
  createBusPoolingRequest,
  getBusPoolingRequests,
  updateBusPoolingRequest,
  getMessages,
  sendMessage,
  getUnreadMessageCount,
  markAgentConversationRead,
  getMyTrips,
  type CollaborationTripFilters,
  type BusPoolingRequestCreate,
  type BusPoolingRequestUpdate,
  type AgentMessageCreate,
} from "@/lib/api";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatPkr } from "@/lib/currency";

// Safe date formatter helper
const formatDate = (dateString: string | undefined | null, formatStr: string = "MMM dd, yyyy HH:mm"): string => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return format(date, formatStr);
  } catch (error) {
    console.error("Error formatting date:", error, dateString);
    return "Invalid Date";
  }
};

export default function CollaborationHub() {
  const [activeTab, setActiveTab] = useState("browse");
    const [filters, setFilters] = useState<CollaborationTripFilters>({});
    const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
    const [poolingDialogOpen, setPoolingDialogOpen] = useState(false);
    const [selectedTripForPooling, setSelectedTripForPooling] = useState<any>(null);
    const [messageDialogOpen, setMessageDialogOpen] = useState(false);
    const [selectedAgentForMessage, setSelectedAgentForMessage] = useState<number | null>(null);
    const [approveDialogOpen, setApproveDialogOpen] = useState(false);
    const [selectedRequestForApproval, setSelectedRequestForApproval] = useState<any>(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();

  // Fetch data
  const { data: agents, isLoading: agentsLoading, error: agentsError } = useQuery({
    queryKey: ["other-agents"],
    queryFn: getOtherAgents,
    retry: 1,
    onError: (error) => {
      console.error("Error fetching agents:", error);
    },
  });

  // Build effective filters (only include non-empty values)
  const effectiveFilters: CollaborationTripFilters = {};
  if (filters.destination_city?.trim()) effectiveFilters.destination_city = filters.destination_city.trim();
  if (filters.origin_city?.trim()) effectiveFilters.origin_city = filters.origin_city.trim();
  if (filters.departure_date?.trim()) effectiveFilters.departure_date = filters.departure_date.trim();
  if (filters.suitability && filters.suitability !== "any") effectiveFilters.suitability = filters.suitability;

  const { data: otherTrips, isLoading: tripsLoading, error: tripsError } = useQuery({
    queryKey: ["other-agents-trips", effectiveFilters],
    queryFn: () => getOtherAgentsTrips(Object.keys(effectiveFilters).length > 0 ? effectiveFilters : undefined),
    retry: 1,
    onError: (error) => {
      console.error("Error fetching trips:", error);
    },
  });

  const { data: matchingTrips, isLoading: matchingLoading, error: matchingError } = useQuery({
    queryKey: ["matching-trips"],
    queryFn: getMatchingTrips,
    retry: 1,
    onError: (error) => {
      console.error("Error fetching matching trips:", error);
    },
  });

  const { data: myTrips, error: myTripsError } = useQuery({
    queryKey: ["my-trips"],
    queryFn: getMyTrips,
    retry: 1,
    onError: (error) => {
      console.error("Error fetching my trips:", error);
    },
  });

  const { data: sentRequests, error: sentRequestsError } = useQuery({
    queryKey: ["pooling-requests", "sent"],
    queryFn: () => getBusPoolingRequests("sent"),
    retry: 1,
    onError: (error) => {
      console.error("Error fetching sent requests:", error);
    },
  });

  const { data: receivedRequests, error: receivedRequestsError } = useQuery({
    queryKey: ["pooling-requests", "received"],
    queryFn: () => getBusPoolingRequests("received"),
    retry: 1,
    onError: (error) => {
      console.error("Error fetching received requests:", error);
    },
  });

  const { data: messages, error: messagesError } = useQuery({
    queryKey: ["messages", selectedAgent],
    queryFn: () => getMessages(selectedAgent!),
    retry: 1,
    enabled: selectedAgent !== null,
    onError: (error) => {
      console.error("Error fetching messages:", error);
    },
  });

  const { data: unreadCount, error: unreadCountError } = useQuery({
    queryKey: ["unread-count"],
    queryFn: getUnreadMessageCount,
    retry: 1,
    onError: (error) => {
      console.error("Error fetching unread count:", error);
    },
  });

  useEffect(() => {
    if (selectedAgent === null) return;
    let cancelled = false;
    markAgentConversationRead(selectedAgent)
      .then(() => {
        if (cancelled) return;
        queryClient.invalidateQueries({ queryKey: ["unread-count"] });
        queryClient.invalidateQueries({ queryKey: ["messages", selectedAgent] });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedAgent, queryClient]);

  const pendingReceivedCount =
    receivedRequests?.filter((r) => r && r.status === "pending").length ?? 0;

  // Mutations
  const createPoolingMutation = useMutation({
    mutationFn: createBusPoolingRequest,
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Bus pooling request sent successfully!",
      });
      setPoolingDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["pooling-requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send pooling request",
        variant: "destructive",
      });
    },
  });

  const updatePoolingMutation = useMutation({
    mutationFn: ({ requestId, data }: { requestId: number; data: BusPoolingRequestUpdate }) =>
      updateBusPoolingRequest(requestId, data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Pooling request updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["pooling-requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update pooling request",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Message sent successfully!",
      });
      setMessageDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Search is now automatic - queries refetch when filters change
  // No need for manual search button, but keeping it for user feedback
  const handleSearch = () => {
    // Filters are already reactive, this just provides visual feedback
    queryClient.invalidateQueries({ queryKey: ["other-agents-trips"] });
  };

  const handleRequestPooling = (trip: any) => {
    setSelectedTripForPooling(trip);
    setPoolingDialogOpen(true);
  };

  const handleSendMessage = (agentId: number) => {
    setSelectedAgentForMessage(agentId);
    setMessageDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      approved: "default",
      rejected: "destructive",
      active: "default",
      completed: "outline",
      cancelled: "destructive",
    };

    const icons: Record<string, any> = {
      pending: Clock,
      approved: CheckCircle2,
      rejected: XCircle,
      active: CheckCircle2,
      completed: CheckCircle2,
      cancelled: XCircle,
    };

    const Icon = icons[status] || AlertCircle;

    return (
      <Badge variant={variants[status] || "default"}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-heading font-bold text-heading">Collaboration Hub</h1>
          <p className="text-body-text mt-2">Connect with other travel agents and pool buses</p>
        </div>
        {unreadCount && unreadCount.count > 0 && (
          <Badge variant="destructive" className="text-lg px-4 py-2">
            {unreadCount.count} unread {unreadCount.count === 1 ? "message" : "messages"}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Pooling</CardTitle>
            <CardDescription>Incoming requests needing your response</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-heading">{pendingReceivedCount}</p>
            <p className="text-xs text-body-text mt-1">Open &quot;My Requests&quot; to approve or decline</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Messages</CardTitle>
            <CardDescription>Unread from other agents</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-heading">{unreadCount?.count ?? 0}</p>
            <p className="text-xs text-body-text mt-1">Opens a conversation marks it read</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Matching</CardTitle>
            <CardDescription>Same origin &amp; destination city</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-heading">{matchingTrips?.length ?? 0}</p>
            <p className="text-xs text-body-text mt-1">Use the Matching Trips tab to request pooling</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="browse">Browse Agents & Trips</TabsTrigger>
          <TabsTrigger value="matching">Matching Trips</TabsTrigger>
          <TabsTrigger value="requests">
            My Requests
            {receivedRequests && Array.isArray(receivedRequests) && receivedRequests.filter((r) => r && r.status === "pending").length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {receivedRequests.filter((r) => r && r.status === "pending").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="messages">
            Messages
            {unreadCount && unreadCount.count && unreadCount.count > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount.count}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Browse Agents & Trips Tab */}
        <TabsContent value="browse" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Search & Filter</CardTitle>
              <CardDescription>Find trips from other agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Origin City</Label>
                  <Input
                    placeholder="e.g., New York"
                    value={filters.origin_city || ""}
                    onChange={(e) => setFilters({ ...filters, origin_city: e.target.value || undefined })}
                  />
                </div>
                <div>
                  <Label>Destination City</Label>
                  <Input
                    placeholder="e.g., Los Angeles"
                    value={filters.destination_city || ""}
                    onChange={(e) => setFilters({ ...filters, destination_city: e.target.value || undefined })}
                  />
                </div>
                <div>
                  <Label>Departure Date</Label>
                  <Input
                    type="date"
                    value={filters.departure_date || ""}
                    onChange={(e) => setFilters({ ...filters, departure_date: e.target.value || undefined })}
                  />
                </div>
                <div>
                  <Label>Suitability</Label>
                  <Select
                    value={filters.suitability || "any"}
                    onValueChange={(value) => setFilters({ ...filters, suitability: value === "any" ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="Solo Travelers">Solo Travelers</SelectItem>
                      <SelectItem value="Families">Families</SelectItem>
                      <SelectItem value="Couples">Couples</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSearch} className="mt-4" type="button">
                <Search className="h-4 w-4 mr-2" />
                Refresh Results
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                {Object.keys(effectiveFilters).length === 0 
                  ? "Showing all available trips from other agents" 
                  : `Filtering by ${Object.keys(effectiveFilters).length} criteria`}
              </p>
            </CardContent>
          </Card>

          {tripsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-96 w-full" />
              ))}
            </div>
          ) : tripsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Error loading trips: {tripsError instanceof Error ? tripsError.message : "Unknown error"}
              </AlertDescription>
            </Alert>
          ) : otherTrips && Array.isArray(otherTrips) && otherTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherTrips
                .filter((trip) => trip && trip.trip_id)
                .map((trip) => (
                  <Card key={trip.trip_id} className="overflow-hidden">
                    {trip.image_url && (
                      <div className="relative h-48 overflow-hidden">
                        <img 
                          src={trip.image_url} 
                          alt={trip.destination_city || "Trip"} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {trip.origin_city || "N/A"} → {trip.destination_city || "N/A"}
                      </CardTitle>
                      <CardDescription>
                        by {trip.agent_name || `Agent #${trip.agent_id || "Unknown"}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2 text-sm">
                        <div>
                          <strong>Departure:</strong> {formatDate(trip.departure_time, "MMM dd, yyyy HH:mm")}
                        </div>
                        <div>
                          <strong>Arrival:</strong> {formatDate(trip.arrival_time, "MMM dd, yyyy HH:mm")}
                        </div>
                        <div>
                          <strong>Price:</strong> {formatPkr(trip.price ?? 0)}
                        </div>
                        <div>
                          <strong>Available Seats:</strong> {trip.available_seats || 0}
                        </div>
                        {trip.suitability && (
                          <div>
                            <strong>Suitability:</strong> {trip.suitability}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => trip && trip.trip_id && handleRequestPooling(trip)}
                          className="flex-1"
                          disabled={!trip || !trip.trip_id}
                        >
                          <Bus className="h-4 w-4 mr-2" />
                          Request Pooling
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => trip && trip.agent_id && handleSendMessage(trip.agent_id)}
                          disabled={!trip || !trip.agent_id}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No trips found matching your filters.</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Matching Trips Tab */}
        <TabsContent value="matching" className="space-y-6">
          {matchingLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : matchingError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Error loading matching trips: {matchingError instanceof Error ? matchingError.message : "Unknown error"}
              </AlertDescription>
            </Alert>
          ) : matchingTrips && Array.isArray(matchingTrips) && matchingTrips.length > 0 ? (
            <div className="space-y-6">
              {matchingTrips
                .filter((match) => match && match.trip && match.my_trip)
                .map((match, index) => (
                <Card key={index} className="border-2 border-primary/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>
                        {match.match_score >= 0.9
                          ? "Excellent Match!"
                          : match.match_score >= 0.6
                          ? "Good Match"
                          : "Potential Match"}
                      </CardTitle>
                      <Badge
                        variant="default"
                        className={
                          match.match_score >= 0.9
                            ? "bg-green-500"
                            : match.match_score >= 0.6
                            ? "bg-yellow-500"
                            : "bg-blue-400"
                        }
                      >
                        Match Score: {(match.match_score * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <CardDescription>
                      Your trip matches with {match.trip.agent_name || `Agent #${match.trip.agent_id}`}'s trip
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm text-body-text">Your Trip</h4>
                        <div className="glass-card p-4 space-y-2 text-sm">
                          <div>
                            <strong>Route:</strong> {match.my_trip.origin_city} → {match.my_trip.destination_city}
                          </div>
                          <div>
                            <strong>Date:</strong> {formatDate(match.my_trip.departure_time, "MMM dd, yyyy")}
                          </div>
                          <div>
                            <strong>Seats:</strong> {match.my_trip.available_seats}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm text-body-text">Their Trip</h4>
                        <div className="glass-card p-4 space-y-2 text-sm">
                          <div>
                            <strong>Route:</strong> {match.trip.origin_city} → {match.trip.destination_city}
                          </div>
                          <div>
                            <strong>Date:</strong> {formatDate(match.trip.departure_time, "MMM dd, yyyy")}
                          </div>
                          <div>
                            <strong>Seats:</strong> {match.trip.available_seats}
                          </div>
                          <div>
                            <strong>Agent:</strong> {match.trip.agent_name || `Agent #${match.trip.agent_id}`}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        onClick={() => handleRequestPooling(match.trip)}
                        className="flex-1"
                      >
                        <Bus className="h-4 w-4 mr-2" />
                        Request Bus Pooling
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleSendMessage(match.trip.agent_id)}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Message Agent
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No matching trips found. Make sure you have trips with available seats that match other agents' trips.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* My Requests Tab */}
        <TabsContent value="requests" className="space-y-6">
          <Tabs defaultValue="received" className="w-full">
            <TabsList>
              <TabsTrigger value="received">
                Received
                {receivedRequests && receivedRequests.filter((r) => r.status === "pending").length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {receivedRequests.filter((r) => r.status === "pending").length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
            </TabsList>

            <TabsContent value="received" className="space-y-4">
              {receivedRequestsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Error loading received requests: {receivedRequestsError instanceof Error ? receivedRequestsError.message : "Unknown error"}
                  </AlertDescription>
                </Alert>
              ) : receivedRequests && Array.isArray(receivedRequests) && receivedRequests.length > 0 ? (
                receivedRequests
                  .filter((request) => request && request.request_id)
                  .map((request) => (
                  <Card key={request.request_id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Pooling Request from {request.requester_agent_name}</CardTitle>
                        {getStatusBadge(request.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {request.message && (
                        <div className="glass-card p-4">
                          <strong>Message:</strong> {request.message}
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold mb-2">Their Trip</h4>
                          <div className="glass-card p-4 space-y-1 text-sm">
                            <div>{request.requester_trip.origin_city} → {request.requester_trip.destination_city}</div>
                            <div>{formatDate(request.requester_trip.departure_time, "MMM dd, yyyy HH:mm")}</div>
                            <div>Seats: {request.requester_trip.available_seats}</div>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Your Trip</h4>
                          <div className="glass-card p-4 space-y-1 text-sm">
                            <div>{request.target_trip.origin_city} → {request.target_trip.destination_city}</div>
                            <div>{formatDate(request.target_trip.departure_time, "MMM dd, yyyy HH:mm")}</div>
                            <div>Seats: {request.target_trip.available_seats}</div>
                          </div>
                        </div>
                      </div>
                      {request.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setSelectedRequestForApproval(request);
                              setApproveDialogOpen(true);
                            }}
                            variant="default"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            onClick={() =>
                              updatePoolingMutation.mutate({
                                requestId: request.request_id,
                                data: { status: "rejected" },
                              })
                            }
                            variant="destructive"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleSendMessage(request.requester_agent_id)}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Message
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>No received requests yet.</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="sent" className="space-y-4">
              {sentRequestsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Error loading sent requests: {sentRequestsError instanceof Error ? sentRequestsError.message : "Unknown error"}
                  </AlertDescription>
                </Alert>
              ) : sentRequests && Array.isArray(sentRequests) && sentRequests.length > 0 ? (
                sentRequests
                  .filter((request) => request && request.request_id)
                  .map((request) => (
                  <Card key={request.request_id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Request to {request.target_agent_name}</CardTitle>
                        {getStatusBadge(request.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {request.message && (
                        <div className="glass-card p-4">
                          <strong>Your Message:</strong> {request.message}
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold mb-2">Your Trip</h4>
                          <div className="glass-card p-4 space-y-1 text-sm">
                            <div>{request.requester_trip.origin_city} → {request.requester_trip.destination_city}</div>
                            <div>{formatDate(request.requester_trip.departure_time, "MMM dd, yyyy HH:mm")}</div>
                            <div>Seats: {request.requester_trip.available_seats}</div>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Their Trip</h4>
                          <div className="glass-card p-4 space-y-1 text-sm">
                            <div>{request.target_trip.origin_city} → {request.target_trip.destination_city}</div>
                            <div>{formatDate(request.target_trip.departure_time, "MMM dd, yyyy HH:mm")}</div>
                            <div>Seats: {request.target_trip.available_seats}</div>
                          </div>
                        </div>
                      </div>
                      {request.status === "pending" && (
                        <Button
                          variant="destructive"
                          onClick={() =>
                            updatePoolingMutation.mutate({
                              requestId: request.request_id,
                              data: { status: "cancelled" },
                            })
                          }
                        >
                          Cancel Request
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>No sent requests yet.</AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Conversations</CardTitle>
              </CardHeader>
              <CardContent>
                {agentsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : agentsError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Error loading agents: {agentsError instanceof Error ? agentsError.message : "Unknown error"}
                    </AlertDescription>
                  </Alert>
                ) : agents && Array.isArray(agents) && agents.length > 0 ? (
                  <div className="space-y-2">
                    {agents
                      .filter((agent) => agent && agent.agent_id)
                      .map((agent) => (
                      <div
                        key={agent.agent_id}
                        className={`glass-card p-3 cursor-pointer hover:bg-primary/10 transition-colors ${
                          selectedAgent === agent.agent_id ? "border-2 border-primary" : ""
                        }`}
                        onClick={() => setSelectedAgent(agent.agent_id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{agent.agent_name || `Agent #${agent.agent_id}`}</div>
                            {agent.rating && (
                              <div className="flex items-center gap-1 text-sm text-body-text">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                {typeof agent.rating === 'number' ? agent.rating.toFixed(1) : Number(agent.rating || 0).toFixed(1)} ({agent.numberofreviews || 0})
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendMessage(agent.agent_id);
                            }}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>No other agents found.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedAgent
                    ? `Messages with ${agents?.find((a) => a.agent_id === selectedAgent)?.agent_name || `Agent #${selectedAgent}`}`
                    : "Select an agent to view messages"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedAgent ? (
                  messagesError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Error loading messages: {messagesError instanceof Error ? messagesError.message : "Unknown error"}
                      </AlertDescription>
                    </Alert>
                  ) : messages && Array.isArray(messages) && messages.length > 0 ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {messages
                        .filter((message) => message && message.message_id)
                        .map((message) => (
                        <div
                          key={message.message_id}
                          className={`glass-card p-4 ${
                            message.sender_agent_id === selectedAgent ? "ml-8" : "mr-8"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold text-sm">
                              {message.sender_agent_name || `Agent #${message.sender_agent_id}`}
                            </div>
                            <div className="text-xs text-body-text">
                              {formatDate(message.created_at, "MMM dd, yyyy HH:mm")}
                            </div>
                          </div>
                          {message.subject && (
                            <div className="font-medium text-sm mb-1">{message.subject}</div>
                          )}
                          <div className="text-sm">{message.content}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>No messages yet. Start a conversation!</AlertDescription>
                    </Alert>
                  )
                ) : (
                  <div className="text-center text-body-text py-12">
                    Select an agent from the list to view messages
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bus Pooling Request Dialog */}
      <Dialog open={poolingDialogOpen} onOpenChange={setPoolingDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request Bus Pooling</DialogTitle>
            <DialogDescription>
              Send a bus pooling request to {selectedTripForPooling?.agent_name || "the agent"}
            </DialogDescription>
          </DialogHeader>
          {selectedTripForPooling && myTrips && (
            <PoolingRequestForm
              targetTrip={selectedTripForPooling}
              myTrips={myTrips.trips}
              onSubmit={(data) => {
                createPoolingMutation.mutate(data);
              }}
              onCancel={() => setPoolingDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Send Message Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Message</DialogTitle>
            <DialogDescription>
              Send a message to {agents?.find((a) => a.agent_id === selectedAgentForMessage)?.agent_name || "the agent"}
            </DialogDescription>
          </DialogHeader>
          {selectedAgentForMessage && (
            <MessageForm
              receiverAgentId={selectedAgentForMessage}
              onSubmit={(data) => {
                sendMessageMutation.mutate(data);
              }}
              onCancel={() => setMessageDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Pooling Request Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Bus Pooling Request</DialogTitle>
            <DialogDescription>
              Select which agent's bus should be used for the pooled trip
            </DialogDescription>
          </DialogHeader>
          {selectedRequestForApproval && (
            <ApprovePoolingForm
              request={selectedRequestForApproval}
              onSubmit={(selectedBusAgentId) => {
                updatePoolingMutation.mutate({
                  requestId: selectedRequestForApproval.request_id,
                  data: { status: "approved", selected_bus_agent_id: selectedBusAgentId },
                });
                setApproveDialogOpen(false);
              }}
              onCancel={() => setApproveDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Pooling Request Form Component
function PoolingRequestForm({
  targetTrip,
  myTrips,
  onSubmit,
  onCancel,
}: {
  targetTrip: any;
  myTrips: any[];
  onSubmit: (data: BusPoolingRequestCreate) => void;
  onCancel: () => void;
}) {
  const [selectedMyTrip, setSelectedMyTrip] = useState<number | null>(null);
  const [seatManagement, setSeatManagement] = useState<"combined" | "separate">("separate");
  const [selectedBusAgent, setSelectedBusAgent] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  // Filter: same origin city AND same destination city (required criteria for pooling)
  const matchingMyTrips = myTrips.filter((trip) => {
    const myOrig = (trip.origin_city || "").trim().toLowerCase();
    const targetOrig = (targetTrip.origin_city || "").trim().toLowerCase();
    if (!myOrig || myOrig !== targetOrig) return false;
    const myDest = (trip.destination_city || "").trim().toLowerCase();
    const targetDest = (targetTrip.destination_city || "").trim().toLowerCase();
    if (!myDest || myDest !== targetDest) return false;
    return trip.available_seats > 0;
  });

  const handleSubmit = () => {
    if (!selectedMyTrip || !selectedBusAgent) {
      alert("Please select your trip and which bus to use");
      return;
    }
    onSubmit({
      target_trip_id: targetTrip.trip_id,
      requester_trip_id: selectedMyTrip,
      message: message || undefined,
      seat_management: seatManagement,
      selected_bus_agent_id: selectedBusAgent,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Select Your Matching Trip</Label>
        <Select
          value={selectedMyTrip?.toString() || ""}
          onValueChange={(value) => {
            setSelectedMyTrip(parseInt(value));
            const trip = matchingMyTrips.find((t) => t.trip_id === parseInt(value));
            if (trip) {
              setSelectedBusAgent(trip.agent_id);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select your trip" />
          </SelectTrigger>
          <SelectContent>
            {matchingMyTrips.map((trip) => (
              <SelectItem key={trip.trip_id} value={trip.trip_id.toString()}>
                {trip.origin_city} → {trip.destination_city} ({formatDate(trip.departure_time, "MMM dd, yyyy")})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {matchingMyTrips.length === 0 && (
          <p className="text-sm text-destructive mt-1">
            No matching trips found. You need a trip with the same origin and destination city.
          </p>
        )}
      </div>

      <div>
        <Label>Seat Management</Label>
        <Select value={seatManagement} onValueChange={(value: "combined" | "separate") => setSeatManagement(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="separate">Manage Separately</SelectItem>
            <SelectItem value="combined">Combine Seats</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Which Agent's Bus Should Be Used?</Label>
        <Select
          value={selectedBusAgent?.toString() || ""}
          onValueChange={(value) => setSelectedBusAgent(parseInt(value))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select bus" />
          </SelectTrigger>
          <SelectContent>
            {selectedMyTrip && (
              <>
                <SelectItem value={matchingMyTrips.find((t) => t.trip_id === selectedMyTrip)?.agent_id.toString() || ""}>
                  Your Bus
                </SelectItem>
                <SelectItem value={targetTrip.agent_id.toString()}>
                  {targetTrip.agent_name || `Agent #${targetTrip.agent_id}`}'s Bus
                </SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Message (Optional)</Label>
        <Textarea
          placeholder="Add a message to the agent..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!selectedMyTrip || !selectedBusAgent || matchingMyTrips.length === 0}>
          Send Request
        </Button>
      </DialogFooter>
    </div>
  );
}

// Message Form Component
function MessageForm({
  receiverAgentId,
  onSubmit,
  onCancel,
}: {
  receiverAgentId: number;
  onSubmit: (data: AgentMessageCreate) => void;
  onCancel: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    if (!content.trim()) {
      alert("Please enter a message");
      return;
    }
    onSubmit({
      receiver_agent_id: receiverAgentId,
      subject: subject || undefined,
      content: content,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Subject (Optional)</Label>
        <Input
          placeholder="Message subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      <div>
        <Label>Message</Label>
        <Textarea
          placeholder="Type your message..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          required
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!content.trim()}>
          Send Message
        </Button>
      </DialogFooter>
    </div>
  );
}

// Approve Pooling Form Component
function ApprovePoolingForm({
  request,
  onSubmit,
  onCancel,
}: {
  request: any;
  onSubmit: (selectedBusAgentId: number) => void;
  onCancel: () => void;
}) {
  const [selectedBusAgentId, setSelectedBusAgentId] = useState<number | null>(null);

  const handleSubmit = () => {
    if (!selectedBusAgentId) {
      alert("Please select which bus to use");
      return;
    }
    onSubmit(selectedBusAgentId);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Select Which Agent's Bus Should Be Used</Label>
        <Select
          value={selectedBusAgentId?.toString() || ""}
          onValueChange={(value) => setSelectedBusAgentId(parseInt(value))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select bus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={request.requester_agent_id.toString()}>
              {request.requester_agent_name || `Agent #${request.requester_agent_id}`}'s Bus
            </SelectItem>
            <SelectItem value={request.target_agent_id.toString()}>
              Your Bus (You are {request.target_agent_name || `Agent #${request.target_agent_id}`})
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!selectedBusAgentId}>
          Approve Request
        </Button>
      </DialogFooter>
    </div>
  );
}

