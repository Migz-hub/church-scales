import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/services/authService";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function hydrate(userId: string, fallbackEmail: string): Promise<User> {
  const { data } = await supabase
    .from("profiles")
    .select("name, email, created_at")
    .eq("id", userId)
    .maybeSingle();
  return {
    id: userId,
    name: data?.name ?? fallbackEmail.split("@")[0] ?? "",
    email: data?.email ?? fallbackEmail,
    createdAt: data?.created_at ?? new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      if (!u) {
        setUser(null);
        return;
      }
      // Defer profile fetch to avoid running supabase calls inside the callback
      setTimeout(() => {
        hydrate(u.id, u.email ?? "").then(setUser).catch(() => {
          setUser({ id: u.id, name: "", email: u.email ?? "", createdAt: new Date().toISOString() });
        });
      }, 0);
    });

    // 2. THEN check existing session
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (u) {
        hydrate(u.id, u.email ?? "").then(setUser).finally(() => setLoading(false));
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await authService.signIn({ email, password });
    setUser(u);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const u = await authService.signUp({ name, email, password });
    setUser(u);
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setUser(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await authService.requestPasswordReset(email);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, requestPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
