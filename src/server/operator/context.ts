import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { AUTH_ACCESS_MESSAGE, getVerifiedAppUser } from "@/lib/auth";
import type { Database } from "@/lib/supabase";
import { resolveSupabasePublicConfig } from "@/lib/supabase-config";
import { OperatorDataError } from "./errors";

export type OperatorContext = {
  supabase: SupabaseClient<Database>;
  user: User;
};

/** Creates one anon-key client bound to the current request's auth cookies. */
export async function requireOperatorContext(): Promise<OperatorContext> {
  const config = resolveSupabasePublicConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (config.status === "error") {
    throw new OperatorDataError(config.error, "configuration");
  }

  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component renders cannot write response cookies. Proxy
          // performs refresh writes; actions can write them when permitted.
        }
      },
    },
  });

  const user = await getVerifiedAppUser(supabase);
  if (!user) {
    throw new OperatorDataError(AUTH_ACCESS_MESSAGE, "unauthorized");
  }

  return { supabase, user };
}
