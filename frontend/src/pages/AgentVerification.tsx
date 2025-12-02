import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AgentVerification() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="glass-panel max-w-md w-full border-0 text-center">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Agent Verification Pending</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-body-text">
            We will contact you via email to complete your agent verification process.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
