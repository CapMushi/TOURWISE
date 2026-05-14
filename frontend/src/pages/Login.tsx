import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plane, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { updateUserProfile } from "@/lib/api";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, user, loading, isAdmin } = useAuth();

  const [isSignup, setIsSignup] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"traveler" | "agent" | null>(null);
  const [role, setRole] = useState<"traveler" | "agent">("traveler");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const getPostLoginPath = () => {
    const state = location.state as { from?: Location } | undefined;
    if (state?.from?.pathname) {
      return state.from.pathname;
    }
    if (isAdminView) {
      return "/admin";
    }
    return role === "agent" ? "/agent" : "/";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    setSubmitting(true);

    try {
      if (isSignup) {
        const u = username.trim();
        if (u.length < 2) {
          setError("Please choose a username (at least 2 characters).");
          return;
        }
        const { error: signupError } = await signUpWithEmail(email, password, { username: u });
        if (signupError) {
          setError(signupError);
          return;
        }
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          try {
            await updateUserProfile({ username: u });
          } catch {
            // Row may be created on first GET /api/profile if JWT is not ready yet
          }
        }
        navigate("/role-selection");
      } else {
        const { error: loginError } = await signInWithEmail(email, password);
        if (loginError) {
          setError(loginError);
          return;
        }

        navigate(getPostLoginPath(), { replace: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    const roleToSave = selectedRole || role;
    const targetPath = getPostLoginPath();

    localStorage.setItem("pendingOAuthRole", roleToSave);
    localStorage.setItem('isOAuthLogin', 'true');
    localStorage.setItem("pendingOAuthTargetPath", targetPath);
    localStorage.setItem("pendingOAuthMode", isAdminView ? "admin" : roleToSave);
    await signInWithGoogle();
  };

  // Handle OAuth callback redirect
  useEffect(() => {
    if (!loading && user) {
      const oauthPending = localStorage.getItem('isOAuthLogin');
      const pendingRole = localStorage.getItem('pendingOAuthRole');
      const pendingTargetPath = localStorage.getItem("pendingOAuthTargetPath");
      const pendingMode = localStorage.getItem("pendingOAuthMode");
      
      if (oauthPending === 'true') {
        const handleOAuthRedirect = async () => {
          // Check if this is a new user (created within last 30 seconds for reliability)
          const userCreatedAt = new Date(user.created_at);
          const now = new Date();
          const timeDiff = now.getTime() - userCreatedAt.getTime();
          const isNewUser = timeDiff < 30000;

          localStorage.removeItem("isOAuthLogin");
          localStorage.removeItem("pendingOAuthRole");
          localStorage.removeItem("pendingOAuthTargetPath");
          localStorage.removeItem("pendingOAuthMode");

          if (pendingMode === "admin") {
            if (!isAdmin) {
              await signOut();
              setIsAdminView(true);
              setSelectedRole(null);
              setError("This Google account does not have admin access.");
              return;
            }

            navigate(pendingTargetPath || "/admin", { replace: true });
            return;
          }

          if (isNewUser) {
            navigate('/role-selection', { replace: true });
            return;
          }

          if (pendingTargetPath) {
            navigate(pendingTargetPath, { replace: true });
          } else if (pendingRole === 'agent') {
            navigate('/agent', { replace: true });
          } else {
            navigate('/', { replace: true });
          }
        };

        void handleOAuthRedirect();
      }
    }
  }, [user, loading, navigate, location, isAdmin, signOut]);

  // Show role selection cards for login (not signup, not admin)
  if (!selectedRole && !isSignup && !isAdminView) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
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
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
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
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="How you'll appear on TourWise"
                required
                minLength={2}
                maxLength={80}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
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

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
          >
            {isAdminView ? "Continue with Google Admin Account" : "Continue with Google"}
          </Button>

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
