import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signUp({ email, password });
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

  const value: AuthContextValue = {
    user,
    session,
    loading,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};


