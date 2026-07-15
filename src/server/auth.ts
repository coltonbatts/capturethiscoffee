import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getVerifiedAppUser } from "@/lib/auth";
import {
  isAuthDisabled,
  supabaseConfigError,
  type Database,
} from "@/lib/supabase";

/** Performs the secure request-time user check used by operator routes. */
export async function getServerOperatorUser() {
  if (isAuthDisabled) return { id: "local-demo" };
  if (supabaseConfigError) throw new Error(supabaseConfigError);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      // Proxy owns token refresh and response cookie writes. Server Component
      // rendering can read request cookies but cannot set response cookies.
      setAll() {},
    },
  });

  return getVerifiedAppUser(supabase);
}
