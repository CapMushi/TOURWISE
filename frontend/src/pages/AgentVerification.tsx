import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { registerAsAgent } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function AgentVerification() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, session, loading, isAgent, agentVerificationStatus } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      console.log("[AgentVerification] No user found, redirecting to login");
      navigate("/login", { state: { from: { pathname: "/agent-verification" } } });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (agentVerificationStatus === "approved") {
      navigate("/agent", { replace: true });
    }
    if (isAgent && agentVerificationStatus === "pending") {
      setRequestSubmitted(true);
    }
  }, [agentVerificationStatus, isAgent, navigate]);

  const handleRequestVerification = async () => {
    // Double-check authentication before proceeding
    if (!user || !session) {
      toast({
        title: "Not Authenticated",
        description: "Please log in to request verification.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    setIsProcessing(true);
    try {
      await registerAsAgent();
      setRequestSubmitted(true);
      toast({
        title: "Verification Request Submitted",
        description: "Your travel agent request is now pending admin approval.",
      });
      setRequestSubmitted(true);
    } catch (error) {
      console.error("Error requesting verification:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit verification request",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="glass-panel max-w-md w-full border-0 text-center">
          <CardContent className="p-6">
            <p className="text-body-text">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect in useEffect)
  if (!user || !session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="glass-panel max-w-md w-full border-0 text-center">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Agent Verification Pending</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-body-text">
            Travel agent access is reviewed manually. Submit your request and an admin will approve it before you can manage trips.
          </p>
          {isAgent && agentVerificationStatus === "pending" && (
            <p className="text-sm text-muted-foreground">
              Your verification request has already been submitted and is waiting for admin review.
            </p>
          )}
          <Button
            onClick={handleRequestVerification}
            disabled={isProcessing || !user || !session || requestSubmitted}
            className="w-full"
          >
            {isProcessing
              ? "Submitting..."
              : requestSubmitted
                ? "Request Submitted"
                : "Request Agent Verification"}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
            Back to home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
