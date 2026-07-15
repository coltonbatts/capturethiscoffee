const networkErrorPattern =
  /failed to fetch|network ?error|load failed|network request failed|fetch failed|err_internet_disconnected/i;

/** Converts transport failures into day-of copy without coupling to a backend. */
export function describeDataError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  if (message && networkErrorPattern.test(message)) {
    return "No connection — check Wi-Fi or signal, then try again.";
  }
  return message || fallback;
}
