"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { updateOrderAction } from "@/app/operator-actions";
import { describeDataError } from "@/lib/data-errors";
import { unwrapOperatorAction } from "@/lib/operator-inputs";
import { mergeProductionCoffeeData } from "@/lib/operator-production-reconciliation";
import {
  resolveProductionRefresh,
  type ProductionLoadState,
} from "@/lib/operator-production-load-state";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type { CoffeeData, Order } from "@/lib/types";

const syncPollIntervalMs = 10_000;

function errorMessage(err: unknown, fallback: string) {
  return describeDataError(err, fallback);
}

/**
 * Owns the production dashboard's data: the initial load, a centralized error
 * channel, and the operator dashboard's two mutation paths.
 *
 * `patchOrder` is the fast path — every status tap. It updates local state
 * immediately (optimistic), then reconciles with the server's authoritative
 * row, touching only the one order. Because the optimistic write lands
 * synchronously, a second tap reads the already-updated state, so concurrent
 * in-flight taps on different cards can't clobber each other (the bug in the
 * old `setData(await mutate(data))` pattern, which built every write off the
 * render-time `data` closure).
 *
 * `run` is the slow path — roster/people edits that happen inside a modal,
 * single-flighted by `saving`. They replace the whole blob, built off the
 * freshest snapshot via `dataRef`.
 */
export function useCoffeeStore(options: {
  productionId: string;
  initialData: CoffeeData | null;
  initialError?: string;
  refreshKey: string;
}) {
  const { productionId, initialData, initialError = "", refreshKey } = options;
  const router = useRouter();
  const [data, setData] = useState<CoffeeData | null>(initialData);
  const [state, setState] = useState<ProductionLoadState>(
    initialData ? "ready" : initialError ? "error" : "loading",
  );
  const [error, setError] = useState(initialError);
  const [saving, setSaving] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Always-fresh snapshot so async commits never read a stale closure.
  const dataRef = useRef<CoffeeData | null>(initialData);
  const pendingOrdersRef = useRef<ReadonlySet<string>>(new Set());
  const mounted = useRef(true);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Retry path — on shoot day a single dropped request must never leave the
  // dashboard permanently stuck on an error screen.
  const reload = useCallback(() => {
    setState("loading");
    setError("");
    router.refresh();
  }, [router]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A Server Component refresh supplies the authoritative scoped snapshot.
  // Reconcile it around any optimistic orders that are still in flight.
  useEffect(() => {
    const resolution = resolveProductionRefresh(
      dataRef.current,
      initialData,
      initialError,
    );
    if (initialData) {
      setData((current) =>
        current
          ? mergeProductionCoffeeData(
              current,
              initialData,
              productionId,
              pendingOrdersRef.current,
            )
          : initialData,
      );
    }
    setError(resolution.error);
    setState(resolution.state);
  }, [initialData, initialError, productionId, refreshKey]);

  useEffect(() => {
    if (state !== "ready" || !productionId || !isSupabaseConfigured) return;

    let pollTimer: number | null = null;

    const refresh = () => {
      router.refresh();
    };

    pollTimer = window.setInterval(refresh, syncPollIntervalMs);

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`production-orders:${productionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `production_id=eq.${productionId}`,
        },
        refresh,
      )
      .subscribe();

    return () => {
      if (pollTimer) window.clearInterval(pollTimer);
      void supabase.removeChannel(channel);
    };
  }, [productionId, router, state]);

  const markPending = useCallback((id: string, on: boolean) => {
    setPendingOrders((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      pendingOrdersRef.current = next;
      return next;
    });
  }, []);

  const patchOrder = useCallback(
    async (orderId: string, patch: Partial<Order>) => {
      const base = dataRef.current;
      if (!base) return;
      const original = base.orders.find((order) => order.id === orderId);
      if (!original) return;

      const optimisticAt = new Date().toISOString();
      setError("");
      markPending(orderId, true);
      setData((prev) =>
        prev
          ? {
              ...prev,
              orders: prev.orders.map((order) =>
                order.id === orderId
                  ? { ...order, ...patch, updated_at: optimisticAt }
                  : order,
              ),
            }
          : prev,
      );

      try {
        const serverOrder = unwrapOperatorAction(
          await updateOrderAction(orderId, patch),
        );
        if (mounted.current) {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  orders: prev.orders.map((order) =>
                    order.id === orderId ? serverOrder : order,
                  ),
                }
              : prev,
          );
        }
      } catch (err) {
        if (mounted.current) {
          // Roll back just this order; leave every other optimistic edit intact.
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  orders: prev.orders.map((order) =>
                    order.id === orderId ? original : order,
                  ),
                }
              : prev,
          );
          setError(errorMessage(err, "Couldn't save that change — reverted."));
        }
      } finally {
        if (mounted.current) {
          markPending(orderId, false);
          router.refresh();
        }
      }
    },
    [markPending, router],
  );

  const run = useCallback(
    async (
      commit: (base: CoffeeData) => Promise<CoffeeData>,
      fallback: string,
    ): Promise<boolean> => {
      const base = dataRef.current;
      if (!base || saving) return false;

      setSaving(true);
      setError("");
      try {
        const next = await commit(base);
        if (mounted.current) {
          setData(next);
          router.refresh();
        }
        return true;
      } catch (err) {
        if (mounted.current) setError(errorMessage(err, fallback));
        return false;
      } finally {
        if (mounted.current) setSaving(false);
      }
    },
    [router, saving],
  );

  return {
    data,
    state,
    error,
    setError,
    saving,
    pendingOrders,
    patchOrder,
    run,
    reload,
  };
}
