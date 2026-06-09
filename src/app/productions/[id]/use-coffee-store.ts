"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeDataError, loadCoffeeData, updateOrderRecord } from "@/lib/data";
import type { CoffeeData, Order } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

function errorMessage(err: unknown, fallback: string) {
  return describeDataError(err, fallback);
}

/**
 * Owns the production dashboard's data: the initial load, a centralized error
 * channel, and the two mutation paths a runner uses on set.
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
export function useCoffeeStore() {
  const [data, setData] = useState<CoffeeData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Always-fresh snapshot so async commits never read a stale closure.
  const dataRef = useRef<CoffeeData | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const fetchData = useCallback(() => {
    loadCoffeeData()
      .then((next) => {
        if (!mounted.current) return;
        setData(next);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (!mounted.current) return;
        setError(errorMessage(err, "Could not load this production."));
        setState("error");
      });
  }, []);

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

  const markPending = useCallback((id: string, on: boolean) => {
    setPendingOrders((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
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
