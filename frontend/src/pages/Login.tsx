import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plane, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, user, loading } = useAuth();

  const [isSignup, setIsSignup] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"traveler" | "agent" | null>(null);
  const [role, setRole] = useState<"traveler" | "agent">("traveler");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isAdminView) {
      // TODO: wire real admin auth later
      navigate("/admin");
      return;
    }

    setSubmitting(true);

    try {
      if (isSignup) {
        const { error: signupError } = await signUpWithEmail(email, password);
        if (signupError) {
          setError(signupError);
          return;
        }
        // After signup, go to role selection to finish onboarding
        navigate("/role-selection");
      } else {
        const { error: loginError } = await signInWithEmail(email, password);
        if (loginError) {
          setError(loginError);
          return;
        }

        // Redirect to previous location if available, otherwise based on role selection
        const state = location.state as { from?: Location } | undefined;
        if (state?.from) {
          navigate(state.from.pathname, { replace: true });
        } else if (role === "agent") {
          navigate("/agent");
        } else {
          navigate("/");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    // Save role to localStorage before OAuth redirect
    const roleToSave = selectedRole || role;
    localStorage.setItem('pendingOAuthRole', roleToSave);
    localStorage.setItem('isOAuthLogin', 'true');
    await signInWithGoogle();
  };

  // Handle OAuth callback redirect
  useEffect(() => {
    if (!loading && user) {
      const oauthPending = localStorage.getItem('isOAuthLogin');
      const pendingRole = localStorage.getItem('pendingOAuthRole');
      
      if (oauthPending === 'true') {
        // Check if this is a new user (created within last 30 seconds for reliability)
        const userCreatedAt = new Date(user.created_at);
        const now = new Date();
        const timeDiff = now.getTime() - userCreatedAt.getTime();
        const isNewUser = timeDiff < 30000; // 30 seconds window
        
        // Clear OAuth flag
        localStorage.removeItem('isOAuthLogin');
        
        if (isNewUser) {
          // New user - always redirect to role selection (same as email signup)
          localStorage.removeItem('pendingOAuthRole');
          navigate('/role-selection', { replace: true });
        } else {
          // Returning user - redirect based on role
          const state = location.state as { from?: Location } | undefined;
          if (state?.from) {
            navigate(state.from.pathname, { replace: true });
          } else if (pendingRole === 'agent') {
            navigate('/agent', { replace: true });
            localStorage.removeItem('pendingOAuthRole');
          } else {
            navigate('/', { replace: true });
            localStorage.removeItem('pendingOAuthRole');
          }
        }
      }
    }
  }, [user, loading, navigate, location]);

  // Show role selection cards for login (not signup, not admin)
  if (!selectedRole && !isSignup && !isAdminView) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-4">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Plane className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-heading font-bold gradient-text">TourWise</h1>
            </div>
            <h2 className="text-2xl font-heading font-semibold text-heading mb-2">
              Welcome Back
            </h2>
            <p className="text-body-text">
              Select how you want to continue
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card 
              className="glass-panel cursor-pointer hover:border-primary transition-colors"
              onClick={() => {
                setSelectedRole("traveler");
                setRole("traveler");
              }}
            >
              <CardContent className="p-6 flex flex-col gap-2">
                <h3 className="font-heading text-xl font-bold">Welcome Back Traveler</h3>
                <p className="text-sm text-body-text">Discover and book unique trips</p>
              </CardContent>
            </Card>

            <Card 
              className="glass-panel cursor-pointer hover:border-primary transition-colors"
              onClick={() => {
                setSelectedRole("agent");
                setRole("agent");
              }}
            >
              <CardContent className="p-6 flex flex-col gap-2">
                <h3 className="font-heading text-xl font-bold">Welcome Back Travel Agent</h3>
                <p className="text-sm text-body-text">Manage listings and connect with clients</p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center text-sm space-y-2">
            <button
              type="button"
              onClick={() => setIsSignup(true)}
              className="text-primary hover:text-primary-hover transition-colors block w-full"
            >
              Don't have an account? Sign Up
            </button>
            <button
              type="button"
              onClick={() => setIsAdminView(true)}
              className="text-muted-foreground hover:text-foreground transition-colors text-xs"
            >
              Admin Access
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            {isAdminView ? "Admin Console" : isSignup ? "Create Account" : selectedRole === "agent" ? "Welcome Back Travel Agent" : "Welcome Back Traveler"}
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
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting
              ? "Please wait..."
              : isAdminView
                ? "Admin Login"
                : isSignup
                  ? "Sign Up"
                  : "Login"}
          </Button>

          {!isAdminView && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
            >
              Continue with Google
            </Button>
          )}

          {!isAdminView && (
            <div className="text-center text-sm space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup);
                  if (!isSignup) {
                    setSelectedRole(null);
                  }
                }}
                className="text-primary hover:text-primary-hover transition-colors block w-full"
              >
                {isSignup ? "Already have an account? Login" : "Don't have an account? Sign Up"}
              </button>
              {!isSignup && selectedRole && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole(null);
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors text-xs"
                >
                  Back to Role Selection
                </button>
              )}
              {!isSignup && !selectedRole && (
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
