import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const AUTH_ACCESS_MESSAGE = "Sign in to continue.";

type AppMetadata = {
  admin?: unknown;
  staff?: unknown;
  role?: unknown;
  roles?: unknown;
};

export function isAuthenticatedAppUser(user: User | null | undefined): boolean {
  return Boolean(user);
}

export function isAdminAppUser(user: User | null | undefined): boolean {
  if (!user) return false;

  const metadata = user.app_metadata as AppMetadata;
  const roles = Array.isArray(metadata.roles) ? metadata.roles : [];

  return (
    metadata.admin === true ||
    metadata.staff === true ||
    metadata.role === "admin" ||
    metadata.role === "staff" ||
    roles.includes("admin") ||
    roles.includes("staff")
  );
}

export async function getVerifiedAppUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !isAuthenticatedAppUser(user)) {
    return null;
  }

  return user;
}

export async function requireFreshAppSession(supabase: SupabaseClient) {
  const user = await getVerifiedAppUser(supabase);
  if (!user) {
    throw new Error(AUTH_ACCESS_MESSAGE);
  }

  if (!isAdminAppUser(user)) {
    throw new Error("Admin access required.");
  }
}

export async function getAppAccessToken(supabase: SupabaseClient) {
  await requireFreshAppSession(supabase);

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw new Error(error.message);
  if (!session?.access_token) {
    throw new Error("Sign in again to continue.");
  }

  return session.access_token;
}

export function normalizeSupabaseWriteError(message: string): Error {
  if (message.includes("violates row-level security policy")) {
    return new Error(
      `${AUTH_ACCESS_MESSAGE} If you are already signed in, sign out and sign back in.`,
    );
  }

  return new Error(message);
}

export { AUTH_ACCESS_MESSAGE };
