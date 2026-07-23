import { createHash } from "node:crypto";

export class PublicApiGuardError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const windowMs = 60_000;
const maximumBuckets = 5_000;
const buckets = new Map<string, { window: number; count: number }>();

export function enforcePublicApiRateLimit({
  request,
  scope,
  limit = 120,
  now = Date.now(),
}: {
  request: Request;
  scope: string;
  limit?: number;
  now?: number;
}) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";
  const clientAddress = forwarded.split(",", 1)[0]?.trim() || "unknown";
  const window = Math.floor(now / windowMs);
  // A token is attacker-controlled until validation; including it here lets
  // one client rotate fake tokens to bypass the limiter and grow the map.
  const key = createHash("sha256")
    .update(`${scope}\0${clientAddress}`)
    .digest("hex");
  const existing = buckets.get(key);
  const count = existing?.window === window ? existing.count + 1 : 1;
  buckets.set(key, { window, count });

  if (buckets.size > maximumBuckets) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.window < window) buckets.delete(bucketKey);
      if (buckets.size <= maximumBuckets) break;
    }
    while (buckets.size > maximumBuckets) {
      const oldest = buckets.keys().next();
      if (oldest.done) break;
      buckets.delete(oldest.value);
    }
  }

  if (count > limit) {
    throw new PublicApiGuardError(
      "Too many requests. Wait a minute and try again.",
      429,
    );
  }
}

export function rejectOversizedJsonRequest(
  request: Request,
  maximumBytes = 8_192,
) {
  const rawLength = request.headers.get("content-length");
  if (!rawLength) return;
  const contentLength = Number(rawLength);
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new PublicApiGuardError("Request body is too large.", 413);
  }
}

export async function readLimitedJsonRequest(
  request: Request,
  maximumBytes = 8_192,
): Promise<unknown> {
  rejectOversizedJsonRequest(request, maximumBytes);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new PublicApiGuardError("Request body is too large.", 413);
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
