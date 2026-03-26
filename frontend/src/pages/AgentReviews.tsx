import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Star, AlertCircle } from "lucide-react";
import {
  getAgentReviews,
  getReviewableAgents,
  upsertAgentReview,
  type ReviewAgentItem,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

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
    return agents.filter((a) => a.name.toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q));
  }, [agents, search]);

  const selectedAgent: ReviewAgentItem | undefined = agents.find((a) => a.agent_id === selectedAgentId);

  const { data: reviews = [], isLoading: reviewsLoading, error: reviewsError } = useQuery({
    queryKey: ["agent-reviews", selectedAgentId],
    queryFn: () => getAgentReviews(selectedAgentId!),
    enabled: selectedAgentId !== null,
  });

  const saveMutation = useMutation({
    mutationFn: () => upsertAgentReview(selectedAgentId!, { rating, comment: comment.trim() || undefined }),
    onSuccess: () => {
      toast({ title: "Review saved", description: "Your rating has been submitted." });
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["agent-reviews", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["reviewable-agents"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save review",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-4xl font-heading font-bold text-heading">Agent Reviews</h1>
        <p className="text-body-text mt-2">Browse travel agents and leave your rating and feedback.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass-card border-0 lg:col-span-1">
          <CardHeader>
            <CardTitle>All Travel Agents</CardTitle>
            <CardDescription>Select an agent to view and submit reviews</CardDescription>
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
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.email || "No email"}</p>
                    <p className="text-xs mt-1">
                      {agent.rating ? `${Number(agent.rating).toFixed(1)}★` : "No rating yet"} (
                      {agent.numberofreviews ?? 0} reviews)
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>{selectedAgent ? `Reviews for ${selectedAgent.name}` : "Select an Agent"}</CardTitle>
            <CardDescription>
              {selectedAgent
                ? "See existing reviews and submit your own rating."
                : "Choose an agent from the list to continue."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedAgent && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rating">Your Rating (1-5)</Label>
                  <Input
                    id="rating"
                    type="number"
                    min={1}
                    max={5}
                    step={1}
                    value={rating}
                    onChange={(e) => setRating(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comment">Comment (optional)</Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your experience..."
                  />
                </div>
              </div>
            )}

            {selectedAgent && (
              <div className="flex justify-end">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !selectedAgentId}
                >
                  {saveMutation.isPending ? "Saving..." : "Submit Review"}
                </Button>
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <h3 className="font-semibold">Recent Reviews</h3>
              {!selectedAgent ? (
                <p className="text-sm text-muted-foreground">No agent selected.</p>
              ) : reviewsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : reviewsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {reviewsError instanceof Error ? reviewsError.message : "Failed to load reviews"}
                  </AlertDescription>
                </Alert>
              ) : reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet for this agent.</p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((r) => (
                    <div key={r.review_id} className="p-3 rounded-lg border bg-background/50">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{r.username || "Traveler"}</p>
                        <Badge variant="outline" className="gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {Number(r.rating).toFixed(1)}
                        </Badge>
                      </div>
                      {r.comment && <p className="text-sm mt-2 text-body-text">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
