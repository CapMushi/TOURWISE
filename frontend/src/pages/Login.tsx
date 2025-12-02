import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plane, Shield } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [role, setRole] = useState<"traveler" | "agent">("traveler");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isAdminView) {
      // Admin login
      navigate("/admin");
    } else if (isSignup) {
      // Redirect to role selection after signup
      navigate("/role-selection");
    } else {
      // Handle login - redirect based on role
      if (role === "agent") {
        navigate("/agent");
      } else {
        navigate("/");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md p-8 space-y-6 animate-scale-in">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            {isAdminView ? (
              <Shield className="h-8 w-8 text-primary" />
            ) : (
              <Plane className="h-8 w-8 text-primary" />
            )}
            <h1 className="text-3xl font-heading font-bold gradient-text">TourWise</h1>
          </div>
          <h2 className="text-2xl font-heading font-semibold text-heading">
            {isAdminView ? "Admin Console" : isSignup ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-body-text">
            {isAdminView ? "Administrator access only" : isSignup ? "Join the travel community" : "Login to continue your journey"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && !isAdminView && (
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" type="text" placeholder="John Doe" required />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" required />
          </div>

          {!isSignup && !isAdminView && (
            <div className="space-y-2">
              <Label htmlFor="role">I'm a...</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "traveler" | "agent")}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-panel bg-white/95 backdrop-blur-lg z-50">
                  <SelectItem value="traveler">Traveler</SelectItem>
                  <SelectItem value="agent">Travel Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" className="w-full">
            {isAdminView ? "Admin Login" : isSignup ? "Sign Up" : "Login"}
          </Button>

          {!isAdminView && (
            <div className="text-center text-sm space-y-2">
              <button
                type="button"
                onClick={() => setIsSignup(!isSignup)}
                className="text-primary hover:text-primary-hover transition-colors block w-full"
              >
                {isSignup ? "Already have an account? Login" : "Don't have an account? Sign Up"}
              </button>
              {!isSignup && (
                <button
                  type="button"
                  onClick={() => setIsAdminView(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors text-xs"
                >
                  Admin Access
                </button>
              )}
            </div>
          )}

          {isAdminView && (
            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => setIsAdminView(false)}
                className="text-primary hover:text-primary-hover transition-colors"
              >
                Back to User Login
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
