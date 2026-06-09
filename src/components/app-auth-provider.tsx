"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getVerifiedAppUser, isAdminAppUser } from "@/lib/auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

type AppAuthContextValue = {
  initialized: boolean;
  appUser: User | null;
  isAdmin: boolean;
  email: string;
  applyAppUser: (user: User | null) => void;
  signOut: () => Promise<void>;
  refreshAppSession: () => Promise<User | null>;
};

const AppAuthContext = createContext<AppAuthContextValue | null>(null);

async function syncAppSessionFromClient(supabase: SupabaseClient) {
  return getVerifiedAppUser(supabase);
}

export function AppAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [initialized, setInitialized] = useState(!isSupabaseConfigured);
  const [appUser, setAppUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");

  const applyAppUser = useCallback((user: User | null) => {
    setAppUser(user);
    setEmail(user?.email || "");
    setInitialized(true);
  }, []);

  const refreshAppSession = useCallback(async () => {
    if (!isSupabaseConfigured) {
      return null;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return null;
    }

    const user = await syncAppSessionFromClient(supabase);
    applyAppUser(user);
    return user;
  }, [applyAppUser]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const initialClient = getSupabaseBrowserClient();
    if (!initialClient) return;

    const authClient: SupabaseClient = initialClient;
    let mounted = true;

    async function bootstrap() {
      const user = await syncAppSessionFromClient(authClient);
      if (!mounted) return;
      applyAppUser(user);
    }

    void bootstrap();

    const {
      data: { subscription },
    } = authClient.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        applyAppUser(null);
        return;
      }

      applyAppUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applyAppUser]);

  const signOut = useCallback(async () => {
    applyAppUser(null);

    if (!isSupabaseConfigured) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }, [applyAppUser, router]);

  const value = useMemo(
    () => ({
      initialized,
      appUser,
      isAdmin: isAdminAppUser(appUser),
      email,
      applyAppUser,
      signOut,
      refreshAppSession,
    }),
    [appUser, applyAppUser, email, initialized, refreshAppSession, signOut],
  );

  return (
    <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>
  );
}

export function useAppAuth() {
  const context = useContext(AppAuthContext);
  if (!context) {
    throw new Error("useAppAuth must be used within AppAuthProvider.");
  }
  return context;
}
