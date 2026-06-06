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
import { getVerifiedStaffUser } from "@/lib/auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

type StaffAuthContextValue = {
  initialized: boolean;
  staffUser: User | null;
  email: string;
  signOut: () => Promise<void>;
  refreshStaffSession: () => Promise<User | null>;
};

const StaffAuthContext = createContext<StaffAuthContextValue | null>(null);

async function syncStaffSessionFromClient(supabase: SupabaseClient) {
  return getVerifiedStaffUser(supabase);
}

export function StaffAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [initialized, setInitialized] = useState(!isSupabaseConfigured);
  const [staffUser, setStaffUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");

  const applyStaffUser = useCallback((user: User | null) => {
    setStaffUser(user);
    setEmail(user?.email || "");
    setInitialized(true);
  }, []);

  const refreshStaffSession = useCallback(async () => {
    if (!isSupabaseConfigured) {
      return null;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return null;
    }

    const user = await syncStaffSessionFromClient(supabase);
    applyStaffUser(user);
    return user;
  }, [applyStaffUser]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const initialClient = getSupabaseBrowserClient();
    if (!initialClient) return;

    const authClient: SupabaseClient = initialClient;
    let mounted = true;

    async function bootstrap() {
      const user = await syncStaffSessionFromClient(authClient);
      if (!mounted) return;
      applyStaffUser(user);
    }

    void bootstrap();

    const {
      data: { subscription },
    } = authClient.auth.onAuthStateChange((event) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        applyStaffUser(null);
        return;
      }

      void bootstrap();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applyStaffUser]);

  const signOut = useCallback(async () => {
    applyStaffUser(null);

    if (!isSupabaseConfigured) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }, [applyStaffUser, router]);

  const value = useMemo(
    () => ({
      initialized,
      staffUser,
      email,
      signOut,
      refreshStaffSession,
    }),
    [email, initialized, refreshStaffSession, signOut, staffUser],
  );

  return (
    <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>
  );
}

export function useStaffAuth() {
  const context = useContext(StaffAuthContext);
  if (!context) {
    throw new Error("useStaffAuth must be used within StaffAuthProvider.");
  }
  return context;
}
