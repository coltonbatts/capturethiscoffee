import { getSupabaseBrowserClient } from "./supabase";
import { buildProductionShareUrl } from "./share-url";

export { buildProductionShareUrl } from "./share-url";

/**
 * Mints a new share token via the admin-gated Postgres RPC and returns the
 * full runner URL. Browser-only (uses the session-bound Supabase client).
 * Each call creates a fresh token; old tokens keep working until revoked.
 */
export async function mintProductionShareLink(
  productionId: string,
  options: { origin?: string; label?: string } = {},
): Promise<string> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase.rpc("create_production_share_token", {
    p_production_id: productionId,
    p_label: options.label ?? "runner-link",
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Token service returned no token.");

  const origin =
    options.origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  if (!origin) throw new Error("Could not determine the app origin.");

  return buildProductionShareUrl(origin, productionId, data);
}
