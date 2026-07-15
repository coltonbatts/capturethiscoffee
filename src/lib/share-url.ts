/**
 * Canonical capability URL consumed by the runner board and CTC Printer.
 * This helper intentionally has no operator-auth or Supabase client dependency.
 */
export function buildProductionShareUrl(
  origin: string,
  productionId: string,
  token: string,
) {
  const base = origin.replace(/\/+$/, "");
  return `${base}/run/${encodeURIComponent(productionId)}?token=${encodeURIComponent(token)}`;
}
