import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getVerifiedAppUser } from "@/lib/auth";
import type { Database } from "@/lib/supabase";
import { resolveSupabasePublicConfig } from "@/lib/supabase-config";

/** Performs the secure request-time user check used by operator routes. */
export async function getServerOperatorUser() {
  const publicConfig = resolveSupabasePublicConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (publicConfig.status === "error") throw new Error(publicConfig.error);

  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    publicConfig.url,
    publicConfig.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // Proxy owns token refresh and response cookie writes. Server Component
        // rendering can read request cookies but cannot set response cookies.
        setAll() {},
      },
    },
  );

  return getVerifiedAppUser(supabase);
}

export async function requireServerOperatorUser(nextPath: string) {
  let user = null;

  try {
    user = await getServerOperatorUser();
  } catch {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return user;
}
