import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mail, MapPin, Phone, Shield, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getAgentPublicTrips,
  getAgentReviews,
  getMyReviewForAgent,
  getReviewableAgents,
  upsertAgentReview,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatPkr } from "@/lib/currency";
import { format } from "date-fns";

function verificationBadge(status?: string | null) {
  switch (status) {
    case "approved":
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

function initialsFromName(name?: string | null) {
  if (!name) return "TW";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function PublicAgentProfile() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const parsedAgentId = Number(agentId);

  const { data: agents = [], isLoading: isAgentLoading, error: agentError } = useQuery({
    queryKey: ["reviewable-agents"],
    queryFn: getReviewableAgents,
  });

  const agent = useMemo(
    () => agents.find((item) => item.agent_id === parsedAgentId),
    [agents, parsedAgentId]
  );

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["agent-public-trips", parsedAgentId],
    queryFn: () => getAgentPublicTrips(parsedAgentId),
    enabled: Number.isFinite(parsedAgentId),
  });

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["agent-reviews", parsedAgentId],
    queryFn: () => getAgentReviews(parsedAgentId),
    enabled: Number.isFinite(parsedAgentId),
  });

  const { data: myReview } = useQuery({
    queryKey: ["my-review-for-agent", parsedAgentId],
    queryFn: () => getMyReviewForAgent(parsedAgentId),
    enabled: Number.isFinite(parsedAgentId),
  });

  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating);
      setComment(myReview.comment ?? "");
    }
  }, [myReview]);

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertAgentReview(parsedAgentId, {
        rating,
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Review saved", description: "Thanks for rating this travel agent." });
      queryClient.invalidateQueries({ queryKey: ["agent-reviews", parsedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["reviewable-agents"] });
      queryClient.invalidateQueries({ queryKey: ["my-review-for-agent", parsedAgentId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Review failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isAgentLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (agentError || !agent) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Alert variant="destructive">
          <AlertDescription>
            {agentError instanceof Error ? agentError.message : "Agent profile could not be loaded."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const avatarUrl = (agent.profile_details?.avatar_url as string) || undefined;
  const phone = (agent.contact_info?.phone as string) || null;
  const address = (agent.contact_info?.address as string) || null;
  const bio = (agent.profile_details?.bio as string) || null;
  const activeTripCount = trips.length;
  const totalOpenSeats = trips.reduce((sum, trip) => sum + trip.available_seats, 0);
  const startingPrice = trips.length > 0 ? Math.min(...trips.map((trip) => trip.price)) : null;
  const nextDeparture = trips.length > 0
    ? [...trips].sort(
        (a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime()
      )[0]
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <Card className="glass-card border-0">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar className="h-24 w-24 border border-border">
                <AvatarImage src={avatarUrl} alt={agent.name} />
                <AvatarFallback className="text-2xl font-heading">
                  {initialsFromName(agent.name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-heading font-bold text-heading">{agent.name}</h1>
                  {verificationBadge(agent.verification_status)}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {agent.rating != null && (
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      {Number(agent.rating).toFixed(1)} ({agent.numberofreviews ?? 0} reviews)
                    </span>
                  )}
                  {agent.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {agent.email}
                    </span>
                  )}
                  {phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {phone}
                    </span>
                  )}
                </div>
                {address && (
                  <p className="flex items-center gap-2 text-sm text-body-text">
                    <MapPin className="h-4 w-4" />
                    {address}
                  </p>
                )}
                {bio && <p className="max-w-2xl text-sm leading-relaxed text-body-text">{bio}</p>}
                <p className="max-w-2xl text-sm text-body-text">
                  Review this profile, check live listings, and read traveler feedback before making a booking.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="glass-card border-0">
          <CardContent className="p-5">
            <p className="text-sm text-body-text">Active trips</p>
            <p className="mt-2 text-2xl font-heading font-bold text-heading">{activeTripCount}</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0">
          <CardContent className="p-5">
            <p className="text-sm text-body-text">Open seats</p>
            <p className="mt-2 text-2xl font-heading font-bold text-heading">{totalOpenSeats}</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0">
          <CardContent className="p-5">
            <p className="text-sm text-body-text">Starting from</p>
            <p className="mt-2 text-2xl font-heading font-bold text-heading">
              {startingPrice != null ? formatPkr(startingPrice) : "N/A"}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card border-0">
          <CardContent className="p-5">
            <p className="text-sm text-body-text">Next departure</p>
            <p className="mt-2 text-lg font-heading font-bold text-heading">
              {nextDeparture ? format(new Date(nextDeparture.departure_time), "MMM dd") : "No trips"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.3fr,0.9fr]">
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle>Available Trips</CardTitle>
            <CardDescription>
              Browse active listings from this travel agent and compare timing, price, and seat availability.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tripsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-24 w-full" />
                ))}
              </div>
            ) : trips.length === 0 ? (
              <div className="rounded-xl border border-border/60 p-8 text-center text-body-text">
                No active trips are available from this agent right now.
              </div>
            ) : (
              <div className="space-y-3">
                {trips.map((trip) => (
                  <button
                    key={trip.trip_id}
                    type="button"
                    onClick={() => navigate(`/trip/${trip.trip_id}`)}
                    className="w-full rounded-xl border border-border bg-background/50 p-4 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-heading">
                          {trip.origin_city} → {trip.destination_city}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {format(new Date(trip.departure_time), "MMM dd, yyyy")} | {trip.transport_type}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-semibold text-primary">{formatPkr(trip.price)}</p>
                        <p className="text-xs text-muted-foreground">{trip.available_seats} seats left</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle>{myReview ? "Update Your Review" : "Rate This Agent"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border bg-background/50 p-4 text-sm text-body-text">
                Share what helped or hurt your experience so future travelers can book with better context.
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={rating === value ? "default" : "outline"}
                    onClick={() => setRating(value)}
                  >
                    {value} <Star className="ml-2 h-4 w-4" />
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-comment">Share your experience</Label>
                <Textarea
                  id="agent-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  placeholder="Was the agent helpful, professional, and responsive?"
                />
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : myReview ? "Update Review" : "Submit Review"}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle>Recent Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              {reviewsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((item) => (
                    <Skeleton key={item} className="h-24 w-full" />
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <p className="text-sm text-body-text">No reviews yet. Be the first to leave one.</p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <div key={review.review_id} className="rounded-xl border border-border bg-background/50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-heading">{review.username || "Traveler"}</p>
                        <span className="text-sm text-muted-foreground">
                          {Number(review.rating).toFixed(1)} / 5
                        </span>
                      </div>
                      {review.comment && (
                        <p className="mt-2 text-sm leading-relaxed text-body-text">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
