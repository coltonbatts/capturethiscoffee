"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadCoffeeData,
  loadProductionCoffeeData,
  updateOrderRecord,
} from "@/lib/data";
import { describeDataError } from "@/lib/data-errors";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type { CoffeeData, Order } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";
type FetchMode = "replace" | "merge";

const syncPollIntervalMs = 10_000;

function errorMessage(err: unknown, fallback: string) {
  return describeDataError(err, fallback);
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  if (!incoming.length) return current;

  const nextById = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) nextById.set(item.id, item);
  return Array.from(nextById.values());
}

function mergeProductionOrders(
  current: Order[],
  incoming: Order[],
  productionId: string,
  pendingOrderIds: ReadonlySet<string>,
) {
  const currentById = new Map(current.map((order) => [order.id, order]));
  const incomingProductionOrders = incoming.filter(
    (order) => order.production_id === productionId,
  );
  const incomingIds = new Set(
    incomingProductionOrders.map((order) => order.id),
  );
  const pendingOnlyLocal = current.filter(
    (order) =>
      order.production_id === productionId &&
      pendingOrderIds.has(order.id) &&
      !incomingIds.has(order.id),
  );

  return [
    ...current.filter((order) => order.production_id !== productionId),
    ...incomingProductionOrders.map((order) =>
      pendingOrderIds.has(order.id)
        ? currentById.get(order.id) || order
        : order,
    ),
    ...pendingOnlyLocal,
  ];
}

function mergeProductionCoffeeData(
  current: CoffeeData,
  incoming: CoffeeData,
  productionId: string,
  pendingOrderIds: ReadonlySet<string>,
): CoffeeData {
  return {
    clients: mergeById(current.clients, incoming.clients),
    people: mergeById(current.people, incoming.people),
    client_people: current.client_people,
    productions: mergeById(current.productions, incoming.productions),
    production_roster: [
      ...current.production_roster.filter(
        (item) => item.production_id !== productionId,
      ),
      ...incoming.production_roster.filter(
        (item) => item.production_id === productionId,
      ),
    ],
    orders: mergeProductionOrders(
      current.orders,
      incoming.orders,
      productionId,
      pendingOrderIds,
    ),
  };
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
export function useCoffeeStore(options: { productionId: string }) {
  const { productionId } = options;
  const [data, setData] = useState<CoffeeData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Always-fresh snapshot so async commits never read a stale closure.
  const dataRef = useRef<CoffeeData | null>(null);
  const pendingOrdersRef = useRef<ReadonlySet<string>>(new Set());
  const mounted = useRef(true);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const fetchData = useCallback(
    (mode: FetchMode = "replace") => {
      const load =
        mode === "merge" && productionId
          ? loadProductionCoffeeData(productionId)
          : loadCoffeeData();

      return load
        .then((next) => {
          if (!mounted.current) return;
          setData((current) =>
            mode === "merge" && current
              ? mergeProductionCoffeeData(
                  current,
                  next,
                  productionId,
                  pendingOrdersRef.current,
                )
              : next,
          );
          setState("ready");
        })
        .catch((err: unknown) => {
          if (!mounted.current) return;
          if (mode === "merge") return;
          setError(errorMessage(err, "Could not load this production."));
          setState("error");
        });
    },
    [productionId],
  );

  // Retry path — on shoot day a single dropped request must never leave the
  // dashboard permanently stuck on an error screen.
  const reload = useCallback(() => {
    setState("loading");
    setError("");
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    mounted.current = true;
    fetchData();

    return () => {
      mounted.current = false;
    };
  }, [fetchData]);

  useEffect(() => {
    if (state !== "ready" || !productionId || !isSupabaseConfigured) return;

    let inFlight = false;
    let queued = false;
    let pollTimer: number | null = null;

    const refresh = () => {
      if (inFlight) {
        queued = true;
        return;
      }

      inFlight = true;
      void fetchData("merge").finally(() => {
        inFlight = false;
        if (queued && mounted.current) {
          queued = false;
          refresh();
        }
      });
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
  }, [fetchData, productionId, state]);

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
        const result = await updateOrderRecord(base, orderId, patch);
        const serverOrder = result.orders.find((order) => order.id === orderId);
        if (serverOrder && mounted.current) {
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
        if (mounted.current) markPending(orderId, false);
      }
    },
    [markPending],
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
        if (mounted.current) setData(next);
        return true;
      } catch (err) {
        if (mounted.current) setError(errorMessage(err, fallback));
        return false;
      } finally {
        if (mounted.current) setSaving(false);
      }
    },
    [saving],
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
