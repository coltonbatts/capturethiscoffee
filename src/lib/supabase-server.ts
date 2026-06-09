import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { AUTH_ACCESS_MESSAGE, isAuthenticatedAppUser } from "./auth";
import {
  isAuthDisabled,
  supabaseConfigError,
  type Database,
} from "./supabase";

type AuthenticatedRouteContext = {
  supabase: SupabaseClient<Database>;
  user: Pick<User, "id">;
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

export async function requirePrintStationAccess(
  request: Request,
): Promise<AuthenticatedRouteContext> {
  if (!isPrintStationYoloEnabled()) {
    return requireAuthenticatedBearerToken(request);
  }

  const supabase = getSupabaseServiceRoleClient();
  const userId =
    process.env.PRINT_STATION_USER_ID?.trim() || (await firstSupabaseUserId(supabase));

  if (!userId) {
    throw new ApiError(
      "PRINT_STATION_YOLO requires PRINT_STATION_USER_ID or at least one Supabase Auth user.",
      500,
    );
  }

  return { supabase, user: { id: userId } };
}

export async function getTrustedLabelQueueContext(): Promise<AuthenticatedRouteContext> {
  const supabase = getSupabaseServiceRoleClient();
  const userId =
    process.env.PRINT_QUEUE_USER_ID?.trim() ||
    process.env.PRINT_STATION_USER_ID?.trim() ||
    (await firstSupabaseUserId(supabase));

  if (!userId) {
    throw new ApiError(
      "Label queue creation requires PRINT_QUEUE_USER_ID, PRINT_STATION_USER_ID, or at least one Supabase Auth user.",
      500,
    );
  }

  return { supabase, user: { id: userId } };
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

function getSupabaseServiceRoleClient() {
  if (supabaseConfigError) throw new ApiError(supabaseConfigError, 500);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new ApiError(
      "Trusted server Supabase operations require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      500,
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function firstSupabaseUserId(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw new ApiError(error.message, 500);
  return data.users[0]?.id || "";
}

export function isPrintStationYoloEnabled() {
  return process.env.PRINT_STATION_YOLO === "true";
}
