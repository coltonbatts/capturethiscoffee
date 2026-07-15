export type ProductionLoadState = "loading" | "ready" | "error";

export type ProductionRefreshResolution<T> = {
  data: T | null;
  state: ProductionLoadState;
  error: string;
};

/** Resolves a completed Server Component refresh without discarding usable UI. */
export function resolveProductionRefresh<T>(
  currentData: T | null,
  incomingData: T | null,
  incomingError: string,
): ProductionRefreshResolution<T> {
  if (incomingData) {
    return { data: incomingData, state: "ready", error: "" };
  }
  if (currentData) {
    return { data: currentData, state: "ready", error: incomingError };
  }
  if (incomingError) {
    return { data: null, state: "error", error: incomingError };
  }
  return { data: null, state: "loading", error: "" };
}
