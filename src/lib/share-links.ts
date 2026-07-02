import {
  getSupabaseBrowserClient,
  isAuthDisabled,
  isSupabaseConfigured,
} from "./supabase";

/**
 * Builds the runner share URL that both the runner board and the CTC Printer
 * iOS app consume. Keep the shape in sync with
 * `mobile/lib/production_session.dart` (`parseProductionShareUrl`).
 */
export function buildProductionShareUrl(
  origin: string,
  productionId: string,
  token: string,
) {
  const base = origin.replace(/\/+$/, "");
  return `${base}/productions/${encodeURIComponent(productionId)}?token=${encodeURIComponent(token)}`;
}

/**
 * Mints a new share token via the admin-gated Postgres RPC and returns the
 * full runner URL. Browser-only (uses the session-bound Supabase client).
 * Each call creates a fresh token; old tokens keep working until revoked.
 */
export async function mintProductionShareLink(
  productionId: string,
  options: { origin?: string; label?: string } = {},
): Promise<string> {
  if (isAuthDisabled || !isSupabaseConfigured) {
    throw new Error(
      "Runner links need the Supabase-backed app. Local demo mode can't mint share tokens.",
    );
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase client unavailable. Check the app configuration.");
  }

  const { data, error } = await supabase.rpc("create_production_share_token", {
    p_production_id: productionId,
    p_label: options.label ?? "runner-link",
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Token service returned no token.");

  const origin =
    options.origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (!origin) throw new Error("Could not determine the app origin.");

  return buildProductionShareUrl(origin, productionId, data);
}

/**
 * Copies async-produced text to the clipboard. iOS Safari only honors
 * clipboard writes that start inside the user-gesture task, so when
 * ClipboardItem accepts promises we hand it the pending value directly;
 * otherwise we await and use writeText (Chrome, Android, desktop).
 */
export async function copyTextToClipboard(textPromise: Promise<string>) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("Clipboard is unavailable in this browser.");
  }

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
    const item = new ClipboardItem({
      "text/plain": textPromise.then(
        (text) => new Blob([text], { type: "text/plain" }),
      ),
    });
    await navigator.clipboard.write([item]);
    return;
  }

  await navigator.clipboard.writeText(await textPromise);
}
