import "server-only";

import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseServiceConfig } from "./supabase-config";
import type { Database } from "./supabase";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function jsonError(error: unknown) {
  const status = getErrorStatus(error);
  if (status >= 500) {
    console.error("[public-api] request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      status,
    });
  }
  const message =
    status >= 500
      ? "The Capture This service is temporarily unavailable."
      : error instanceof Error
        ? error.message
        : "Invalid request.";
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status >= 500 ? { "Retry-After": "5" } : {}),
        ...(status === 429 ? { "Retry-After": "60" } : {}),
      },
    },
  );
}

function getErrorStatus(error: unknown) {
  if (error instanceof ApiError) return error.status;
  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number" &&
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status <= 599
  ) {
    return error.status;
  }
  return 500;
}

const serviceRequestTimeoutMs = 10_000;

const fetchWithServiceTimeout: typeof fetch = (input, init = {}) => {
  const timeoutSignal = AbortSignal.timeout(serviceRequestTimeoutMs);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;
  return fetch(input, { ...init, signal });
};

export function getSupabaseServiceRoleClient() {
  const config = resolveSupabaseServiceConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  if (config.status === "error") throw new ApiError(config.error, 500);

  return createClient<Database>(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: fetchWithServiceTimeout,
    },
  });
}
