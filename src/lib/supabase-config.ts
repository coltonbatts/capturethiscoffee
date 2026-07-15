export const SUPABASE_PUBLIC_CONFIG_MESSAGE =
  "Supabase is required. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart the app.";

export type SupabasePublicConfig =
  | {
      status: "configured";
      url: string;
      anonKey: string;
      error: "";
    }
  | {
      status: "error";
      error: string;
    };

export type SupabaseServiceConfig =
  | {
      status: "configured";
      url: string;
      serviceRoleKey: string;
      error: "";
    }
  | {
      status: "error";
      error: string;
    };

export function resolveSupabasePublicConfig(
  rawUrl: string | undefined,
  rawAnonKey: string | undefined,
): SupabasePublicConfig {
  const url = rawUrl?.trim() || "";
  const anonKey = rawAnonKey?.trim() || "";

  if (!url || !anonKey) {
    return { status: "error", error: SUPABASE_PUBLIC_CONFIG_MESSAGE };
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }
  } catch {
    return {
      status: "error",
      error:
        "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP(S) URL. Update .env.local, then restart the app.",
    };
  }

  return { status: "configured", url, anonKey, error: "" };
}

export function resolveSupabaseServiceConfig(
  rawUrl: string | undefined,
  rawServiceRoleKey: string | undefined,
): SupabaseServiceConfig {
  const url = rawUrl?.trim() || "";
  const serviceRoleKey = rawServiceRoleKey?.trim() || "";

  if (!url || !serviceRoleKey) {
    return {
      status: "error",
      error:
        "Token-scoped runner and printer APIs require NEXT_PUBLIC_SUPABASE_URL and the server-only SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }
  } catch {
    return {
      status: "error",
      error:
        "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP(S) URL for trusted server Supabase operations.",
    };
  }

  return { status: "configured", url, serviceRoleKey, error: "" };
}
