import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { AUTH_ACCESS_MESSAGE, isAuthenticatedAppUser } from "./auth";
import {
  isAuthDisabled,
  supabaseConfigError,
  type Database,
} from "./supabase";

type AuthenticatedRouteContext = {
  supabase: SupabaseClient<Database>;
  user: User;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function requireAuthenticatedBearerToken(
  request: Request,
): Promise<AuthenticatedRouteContext> {
  if (isAuthDisabled) {
    throw new ApiError("Print job APIs require Supabase auth.", 501);
  }

  const token = bearerTokenFromRequest(request);
  if (!token) throw new ApiError("Missing bearer token.", 401);

  const supabase = getSupabaseRouteClient(token);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) throw new ApiError("Invalid bearer token.", 401);
  if (!isAuthenticatedAppUser(user)) throw new ApiError(AUTH_ACCESS_MESSAGE, 403);

  return { supabase, user };
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Unexpected API error.";
  return Response.json({ error: message }, { status: 500 });
}

export function parsePositiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function bearerTokenFromRequest(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function getSupabaseRouteClient(token: string) {
  if (supabaseConfigError) throw new ApiError(supabaseConfigError, 500);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new ApiError("Supabase is not configured.", 500);
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
