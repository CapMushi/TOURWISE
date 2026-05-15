import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { getCurrentUserContextWithToken, type AppRole } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  appRole: AppRole;
  isAdmin: boolean;
  isAgent: boolean;
  agentId: number | null;
  agentVerificationStatus: string | null;
  signUpWithEmail: (
    email: string,
    password: string,
    options?: { username?: string }
  ) => Promise<{ error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshAgentVerificationStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [appRole, setAppRole] = useState<AppRole>("traveler");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAgent, setIsAgent] = useState(false);
  const [agentId, setAgentId] = useState<number | null>(null);
  const [agentVerificationStatus, setAgentVerificationStatus] = useState<string | null>(null);

  const resetRoleState = useCallback(() => {
    setAppRole("traveler");
    setIsAdmin(false);
    setIsAgent(false);
    setAgentId(null);
    setAgentVerificationStatus(null);
  }, []);

  const loadUserContext = useCallback(async (nextSession: Session | null) => {
    if (!nextSession) {
      resetRoleState();
      return;
    }

    try {
      const context = await getCurrentUserContextWithToken(nextSession.access_token);
      setAppRole(context.app_role);
      setIsAdmin(context.is_admin);
      setIsAgent(context.is_agent);
      setAgentId(context.agent_id ?? null);
      setAgentVerificationStatus(context.agent_verification_status ?? null);
    } catch (error) {
      console.error("[Auth] Failed to load user context", error);
      resetRoleState();
    }
  }, [resetRoleState]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error) {
        console.error("[Auth] getSession error", error);
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);
      await loadUserContext(data.session);
      if (!isMounted) return;
      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      await loadUserContext(newSession);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, options?: { username?: string }) => {
      const username = options?.username?.trim();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: username
          ? { data: { username } }
          : undefined,
      });
      if (error) {
        console.error("[Auth] signUp error", error);
        return { error: error.message };
      }
      return {};
    },
    []
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error("[Auth] signIn error", error);
        return { error: error.message };
      }
      return {};
    },
    []
  );

  /**
   * Sign in with Google OAuth.
   * 
   * IMPORTANT: The redirect URL is automatically set to `${window.location.origin}/login`.
   * This means if you access the app via:
   * - http://localhost:8080 → redirects to http://localhost:8080/login
   * - http://192.168.1.8:8080 → redirects to http://192.168.1.8:8080/login
   * 
   * All possible redirect URLs MUST be whitelisted in Supabase Dashboard:
   * Authentication → URL Configuration → Redirect URLs
   * 
   * Add both localhost and network IP URLs if accessing from different origins.
   * Also ensure the Site URL in Supabase matches your primary access method or is set flexibly.
   */
  const signInWithGoogle = useCallback(async () => {
    const currentOrigin = window.location.origin;
    const redirectTo = `${currentOrigin}/login`;
    
    console.log("[Auth] Current origin:", currentOrigin);
    console.log("[Auth] Google OAuth redirect URL:", redirectTo);
    
    // Warn if using network IP and provide configuration guidance
    if (currentOrigin.includes("192.168.") || currentOrigin.includes("10.") || currentOrigin.includes("172.")) {
      console.warn(
        "[Auth] Network IP detected. Ensure the following is configured in Supabase:\n" +
        "1. Go to Supabase Dashboard → Authentication → URL Configuration\n" +
        `2. Add this URL to Redirect URLs: ${redirectTo}\n` +
        "3. Update Site URL if needed (or leave it flexible)"
      );
    }
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { 
          redirectTo,
        },
      });
      
      if (error) {
        console.error("[Auth] Google sign-in error:", error);
        console.error("[Auth] Error details:", JSON.stringify(error, null, 2));
        throw error;
      }
      
      if (data?.url) {
        console.log("[Auth] OAuth URL generated:", data.url);
        // Check if the URL contains the correct redirect
        if (data.url.includes(redirectTo)) {
          console.log("[Auth] ✓ Redirect URL confirmed in OAuth URL");
        } else {
          console.warn("[Auth] ⚠ Redirect URL may not match in OAuth URL");
          console.warn("[Auth] This might indicate a Supabase configuration issue");
          console.warn("[Auth] Check Supabase Dashboard → Authentication → URL Configuration");
        }
      }
    } catch (error) {
      console.error("[Auth] Failed to initiate Google OAuth:", error);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[Auth] signOut error", error);
    }
  }, []);

  const refreshAgentVerificationStatus = useCallback(async () => {
    await loadUserContext(session);
  }, [loadUserContext, session]);

  // Global suspension handler: api.ts dispatches `tourwise:account-suspended`
  // whenever a request comes back with a 403 ACCOUNT_SUSPENDED sentinel.
  // We sign out the current Supabase session, surface a toast, and bounce
  // to /login. `suspendedAtRef` debounces back-to-back triggers when many
  // queries fail simultaneously (e.g. a dashboard with parallel queries).
  const suspendedAtRef = useRef<number>(0);
  useEffect(() => {
    const handleSuspension = (event: Event) => {
      const now = Date.now();
      if (now - suspendedAtRef.current < 2000) return;
      suspendedAtRef.current = now;

      const detail = (event as CustomEvent<{ reason?: string } | undefined>).detail;
      console.warn("[Auth] Account suspended event received", detail);
      toast.error("Your account has been suspended. Please contact support.", {
        duration: 6000,
      });

      void supabase.auth.signOut().catch((err) => {
        console.error("[Auth] signOut after suspension failed", err);
      });

      // Use a hard navigation so any in-flight queries and cached state are
      // dropped. AuthProvider sits above the router so useNavigate is not
      // available here.
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    };

    window.addEventListener("tourwise:account-suspended", handleSuspension as EventListener);
    return () => {
      window.removeEventListener("tourwise:account-suspended", handleSuspension as EventListener);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      appRole,
      isAdmin,
      isAgent,
      agentId,
      agentVerificationStatus,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      refreshAgentVerificationStatus,
    }),
    [
      user,
      session,
      loading,
      appRole,
      isAdmin,
      isAgent,
      agentId,
      agentVerificationStatus,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      refreshAgentVerificationStatus,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};


