import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/lib/api";

type ProtectedRouteProps = {
  children: ReactNode;
  requiredRole?: Extract<AppRole, "agent" | "admin">;
};

const APPROVED_AGENT_STATUSES = new Set(["approved"]);

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, loading, isAdmin, isAgent, agentVerificationStatus } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredRole === "admin" && !isAdmin) {
    return <Navigate to="/login" replace state={{ adminAccessDenied: true }} />;
  }

  if (requiredRole === "agent") {
    if (!isAgent) {
      return <Navigate to="/agent-verification" replace />;
    }

    if (!APPROVED_AGENT_STATUSES.has(agentVerificationStatus ?? "")) {
      return <Navigate to="/agent-verification" replace />;
    }
  }

  return <>{children}</>;
};


