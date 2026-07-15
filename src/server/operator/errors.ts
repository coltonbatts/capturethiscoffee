import "server-only";

import { AUTH_ACCESS_MESSAGE } from "@/lib/auth";
import { OperatorInputError } from "@/lib/operator-validation";

export class OperatorDataError extends Error {
  constructor(message: string, public readonly code = "operator_error") {
    super(message);
  }
}

export function throwOperatorDatabaseError(
  error: { message: string } | null,
  fallback: string,
): void {
  if (!error) return;
  const lower = error.message.toLowerCase();
  if (lower.includes("row-level security") || lower.includes("jwt")) {
    throw new OperatorDataError(
      `${AUTH_ACCESS_MESSAGE} If you are already signed in, sign out and sign back in.`,
      "unauthorized",
    );
  }
  if (
    lower.includes("fetch") ||
    lower.includes("network") ||
    lower.includes("timeout")
  ) {
    throw new OperatorDataError(
      "No connection — check Wi-Fi or signal, then try again.",
      "network",
    );
  }
  throw new OperatorDataError(fallback, "database");
}

export function sanitizedOperatorError(
  error: unknown,
  fallback = "Could not complete that request.",
): string {
  if (error instanceof OperatorDataError || error instanceof OperatorInputError) {
    return error.message;
  }
  return fallback;
}

export function requireOperatorRow<T>(data: T | null, message: string): T {
  if (!data) throw new OperatorDataError(message, "not_found");
  return data;
}
