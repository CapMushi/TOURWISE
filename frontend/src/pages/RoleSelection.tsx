import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RoleSelection() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="glass-panel max-w-2xl w-full border-0">
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-3xl mb-2">
            How will you be using TourWise?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full h-auto p-6 flex flex-col items-start gap-2 hover:border-primary hover:bg-primary/5"
            onClick={() => navigate("/questionnaire")}
          >
            <h3 className="font-heading text-xl font-bold">Sign up as a Traveler</h3>
            <p className="text-sm text-body-text">Discover and book unique trips.</p>
          </Button>

          <Button
            variant="outline"
            className="w-full h-auto p-6 flex flex-col items-start gap-2 hover:border-primary hover:bg-primary/5"
            onClick={() => navigate("/agent-verification")}
          >
            <h3 className="font-heading text-xl font-bold">Sign up as a Travel Agent</h3>
            <p className="text-sm text-body-text">Manage listings and connect with clients.</p>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
