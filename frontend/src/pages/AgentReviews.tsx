import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Star,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Shield,
  Bus,
  Calendar,
  Info,
} from "lucide-react";
import {
  getAgentReviews,
  getReviewableAgents,
  upsertAgentReview,
  getAgentPublicTrips,
  getMyReviewForAgent,
  type ReviewAgentItem,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatPkr } from "@/lib/currency";
import { format } from "date-fns";

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange?: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="focus:outline-none"
          onClick={() => onChange?.(star)}
          onMouseEnter={() => onChange && setHover(star)}
          onMouseLeave={() => onChange && setHover(0)}
        >
          <Star
            className={`h-7 w-7 transition-colors ${
              star <= (hover || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function verificationBadge(status?: string | null) {
  switch (status) {
    case "approved":
    case "active":
    case "verified":
      return (
        <Badge className="bg-green-500 text-white gap-1">
          <Shield className="h-3 w-3" /> Verified
        </Badge>
      );
    case "pending":
      return <Badge variant="secondary">Pending</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return null;
  }
}

export default function AgentReviews() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState("");

  const { data: agents = [], isLoading: agentsLoading, error: agentsError } = useQuery({
    queryKey: ["reviewable-agents"],
    queryFn: getReviewableAgents,
  });

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q)
    );
  }, [agents, search]);

  const selectedAgent: ReviewAgentItem | undefined = agents.find(
    (a) => a.agent_id === selectedAgentId
  );

  const { data: reviews = [], isLoading: reviewsLoading, error: reviewsError } = useQuery({
    queryKey: ["agent-reviews", selectedAgentId],
    queryFn: () => getAgentReviews(selectedAgentId!),
    enabled: selectedAgentId !== null,
  });

  const { data: agentTrips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["agent-public-trips", selectedAgentId],
    queryFn: () => getAgentPublicTrips(selectedAgentId!),
    enabled: selectedAgentId !== null,
  });

  const { data: myReview } = useQuery({
    queryKey: ["my-review-for-agent", selectedAgentId],
    queryFn: () => getMyReviewForAgent(selectedAgentId!),
    enabled: selectedAgentId !== null,
  });

  // Pre-fill form when the user's existing review loads
  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating);
      setComment(myReview.comment ?? "");
    } else {
      setRating(5);
      setComment("");
    }
  }, [myReview, selectedAgentId]);

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertAgentReview(selectedAgentId!, { rating, comment: comment.trim() || undefined }),
    onSuccess: () => {
      toast({ title: "Review saved", description: "Your rating has been submitted." });
      queryClient.invalidateQueries({ queryKey: ["agent-reviews", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["reviewable-agents"] });
      queryClient.invalidateQueries({ queryKey: ["my-review-for-agent", selectedAgentId] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to save review",
        description: (error as Error)?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-4xl font-heading font-bold text-heading">Travel Agents</h1>
        <p className="text-body-text mt-2">
          Browse agents, view their trips and profile, and leave your rating.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: agent list */}
        <Card className="glass-card border-0 lg:col-span-1">
          <CardHeader>
            <CardTitle>All Travel Agents</CardTitle>
            <CardDescription>Select an agent to view details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
                  {agentsError instanceof Error ? agentsError.message : "Failed to load agents"}
                </AlertDescription>
              </Alert>
            ) : filteredAgents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agents found.</p>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {filteredAgents.map((agent) => (
                  <button
                    key={agent.agent_id}
                    type="button"
                    onClick={() => setSelectedAgentId(agent.agent_id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedAgentId === agent.agent_id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">{agent.email || "No email"}</p>
                      </div>
                      {verificationBadge(agent.verification_status)}
                    </div>
                    <p className="text-xs mt-1">
                      {agent.rating
                        ? `${Number(agent.rating).toFixed(1)}★`
                        : "No rating yet"}{" "}
                      ({agent.numberofreviews ?? 0} reviews)
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: details */}
        <Card className="glass-card border-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedAgent ? selectedAgent.name : "Select an Agent"}
            </CardTitle>
            <CardDescription>
              {selectedAgent
                ? "View profile, trips, and submit a review."
                : "Choose an agent from the list to continue."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedAgent ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <Info className="h-10 w-10" />
                <p>Select a travel agent from the list on the left.</p>
              </div>
            ) : (
              <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="info">Info &amp; Trips</TabsTrigger>
                  <TabsTrigger value="reviews">Reviews &amp; Rate</TabsTrigger>
                </TabsList>

                {/* ── Info & Trips tab ── */}
                <TabsContent value="info" className="space-y-6 pt-4">
                  {/* Agent profile card */}
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="font-heading font-semibold text-lg text-heading">
                          {selectedAgent.name}
                        </h3>
                        {selectedAgent.rating != null && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-medium">
                              {Number(selectedAgent.rating).toFixed(1)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              ({selectedAgent.numberofreviews ?? 0} reviews)
                            </span>
                          </div>
                        )}
                      </div>
                      {verificationBadge(selectedAgent.verification_status)}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      {selectedAgent.email && (
                        <span className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {selectedAgent.email}
                        </span>
                      )}
                      {(selectedAgent.contact_info?.phone as string) && (
                        <span className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {selectedAgent.contact_info?.phone as string}
                        </span>
                      )}
                      {(selectedAgent.contact_info?.address as string) && (
                        <span className="flex items-center gap-2 sm:col-span-2">
                          <MapPin className="h-4 w-4" />
                          {selectedAgent.contact_info?.address as string}
                        </span>
                      )}
                    </div>

                    {(selectedAgent.profile_details?.bio as string) && (
                      <p className="text-sm leading-relaxed text-body-text border-t pt-3">
                        {selectedAgent.profile_details?.bio as string}
                      </p>
                    )}
                  </div>

                  {/* Agent's trips */}
                  <div>
                    <h3 className="font-heading font-semibold text-heading mb-3 flex items-center gap-2">
                      <Bus className="h-4 w-4" />
                      Available Trips
                    </h3>
                    {tripsLoading ? (
                      <div className="space-y-2">
                        {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                      </div>
                    ) : agentTrips.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        This agent has no available trips at the moment.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {agentTrips.map((trip) => (
                          <div
                            key={trip.trip_id}
                            className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 text-sm"
                          >
                            <div>
                              <span className="font-medium">
                                {trip.origin_city} → {trip.destination_city}
                              </span>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(trip.departure_time), "MMM dd, yyyy")}
                                </span>
                                <span>{trip.transport_type}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-medium">{formatPkr(trip.price)}</div>
                              <div className="text-xs text-muted-foreground">
                                {trip.available_seats} seats left
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ── Reviews & Rate tab ── */}
                <TabsContent value="reviews" className="space-y-6 pt-4">
                  {/* Submit / update review */}
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <h3 className="font-heading font-semibold text-heading">
                      {myReview ? "Update Your Review" : "Leave a Review"}
                    </h3>
                    {myReview && (
                      <p className="text-xs text-muted-foreground">
                        You reviewed this agent on{" "}
                        {format(new Date(myReview.created_at), "MMM dd, yyyy")}. Your rating
                        below will replace it.
                      </p>
                    )}

                    <div className="space-y-1">
                      <Label>Your Rating</Label>
                      <StarRating value={rating} onChange={setRating} />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="comment">Comment (optional)</Label>
                      <Textarea
                        id="comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Share your experience…"
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}
                      >
                        {saveMutation.isPending
                          ? "Saving…"
                          : myReview
                          ? "Update Review"
                          : "Submit Review"}
                      </Button>
                    </div>
                  </div>

                  {/* Existing reviews */}
                  <div>
                    <h3 className="font-heading font-semibold text-heading mb-3">
                      All Reviews ({reviews.length})
                    </h3>
                    {reviewsLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
                      </div>
                    ) : reviewsError ? (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {reviewsError instanceof Error
                            ? reviewsError.message
                            : "Failed to load reviews"}
                        </AlertDescription>
                      </Alert>
                    ) : reviews.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No reviews yet. Be the first!
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {reviews.map((r) => (
                          <div
                            key={r.review_id}
                            className="p-3 rounded-lg border bg-background/50"
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{r.username || "Traveler"}</p>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: Math.round(Number(r.rating)) }).map(
                                  (_, i) => (
                                    <Star
                                      key={i}
                                      className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400"
                                    />
                                  )
                                )}
                                <span className="text-xs text-muted-foreground ml-1">
                                  {Number(r.rating).toFixed(1)}
                                </span>
                              </div>
                            </div>
                            {r.comment && (
                              <p className="text-sm mt-1.5 text-body-text">{r.comment}</p>
                            )}
                            {r.created_at && (
                              <p className="text-xs text-muted-foreground mt-1.5">
                                {format(new Date(r.created_at), "MMM dd, yyyy")}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
