import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { skipAgentVerification } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function AgentVerification() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, session, loading } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      console.log("[AgentVerification] No user found, redirecting to login");
      navigate("/login", { state: { from: { pathname: "/agent-verification" } } });
    }
  }, [user, loading, navigate]);

  const handleSkipVerification = async () => {
    // Double-check authentication before proceeding
    if (!user || !session) {
      toast({
        title: "Not Authenticated",
        description: "Please log in to skip verification.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    setIsProcessing(true);
    try {
      console.log("[AgentVerification] Attempting to skip verification");
      console.log("[AgentVerification] User ID:", user.id);
      console.log("[AgentVerification] Has session:", !!session);
      
      await skipAgentVerification();
      toast({
        title: "Verification Skipped",
        description: "You have been verified as a travel agent. Redirecting to dashboard...",
      });
      // Redirect to agent dashboard after a short delay
      setTimeout(() => {
        navigate("/agent");
      }, 1500);
    } catch (error) {
      console.error("Error skipping verification:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to skip verification",
        variant: "destructive",
      });
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
            We will contact you via email to complete your agent verification process.
          </p>
          <Button
            onClick={handleSkipVerification}
            disabled={isProcessing || !user || !session}
            variant="outline"
            className="w-full"
          >
            {isProcessing ? "Processing..." : "Skip Verification (Testing Only)"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
