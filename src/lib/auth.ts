import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const STAFF_ACCESS_MESSAGE =
  "This account does not have staff access. Ask your admin to enable staff on your account.";

export function isStaffUser(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.app_metadata?.staff === true;
}

export async function requireFreshStaffSession(supabase: SupabaseClient) {
  const { data: refreshed, error: refreshError } =
    await supabase.auth.refreshSession();

  if (refreshError) {
    throw new Error(refreshError.message);
  }

  const user = refreshed.session?.user;
  if (!isStaffUser(user)) {
    throw new Error(STAFF_ACCESS_MESSAGE);
  }
}

export function normalizeSupabaseWriteError(message: string): Error {
  if (message.includes("violates row-level security policy")) {
    return new Error(
      `${STAFF_ACCESS_MESSAGE} Sign out and sign back in if staff access was just enabled.`,
    );
  }

  return new Error(message);
}

export { STAFF_ACCESS_MESSAGE };
