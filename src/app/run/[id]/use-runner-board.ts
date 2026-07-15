"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeDataError } from "@/lib/data-errors";
import {
  reconcileProductionBoard,
  replaceProductionBoardOrder,
  toProductionBoardOrder,
  type ProductionBoardDTO,
  type ProductionBoardOrderDTO,
} from "@/lib/production-board";
import type { Order } from "@/lib/types";

export type RunnerOrderPatch = Partial<
  Pick<
    ProductionBoardOrderDTO,
    | "drink_type"
    | "size"
    | "temperature"
    | "milk_type"
    | "sweetener"
    | "caffeine"
    | "special_notes"
    | "vendor"
    | "status"
    | "label_printed"
  >
>;

const pollIntervalMs = 10_000;

async function fetchProductionBoard(productionId: string, token: string) {
  const response = await fetch(
    `/api/public/productions/${encodeURIComponent(productionId)}?token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  const body = (await response.json().catch(() => ({}))) as {
    data?: ProductionBoardDTO;
    error?: string;
  };

  if (!response.ok || !body.data) {
    throw new Error(body.error || "Could not refresh this production.");
  }
  return body.data;
}
async function patchRunnerOrder(
  productionId: string,
  token: string,
  orderId: string,
  patch: RunnerOrderPatch,
) {
  const response = await fetch(
    `/api/public/orders/${encodeURIComponent(orderId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productionId, token, patch }),
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    order?: Order;
    error?: string;
  };

  if (!response.ok || !body.order) {
    throw new Error(body.error || "Could not update order.");
  }
  return toProductionBoardOrder(body.order);
}

export function useRunnerBoard(options: {
  initialBoard: ProductionBoardDTO;
  token: string;
}) {
  const { initialBoard, token } = options;
  const productionId = initialBoard.production.id;
  const [board, setBoard] = useState(initialBoard);
  const [error, setError] = useState("");
  const [pendingOrders, setPendingOrders] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const boardRef = useRef(board);
  const pendingOrdersRef = useRef<ReadonlySet<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const markPending = useCallback((orderId: string, pending: boolean) => {
    setPendingOrders((current) => {
      const next = new Set(current);
      if (pending) next.add(orderId);
      else next.delete(orderId);
      pendingOrdersRef.current = next;
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const incoming = await fetchProductionBoard(productionId, token);
      if (!mountedRef.current) return;
      setBoard((current) =>
        reconcileProductionBoard(current, incoming, pendingOrdersRef.current),
      );
    } catch {
      // A polling failure leaves the last usable board on screen. Mutations
      // surface their own errors because those require runner action.
    }
  }, [productionId, token]);

  useEffect(() => {
    mountedRef.current = true;
    let inFlight = false;

    const poll = () => {
      if (inFlight) return;
      inFlight = true;
      void refresh().finally(() => {
        inFlight = false;
      });
    };

    const timer = window.setInterval(poll, pollIntervalMs);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  const patchOrder = useCallback(
    async (orderId: string, patch: RunnerOrderPatch) => {
      const current = boardRef.current;
      const original = current.roster.find(
        (item) => item.order?.id === orderId,
      )?.order;
      if (!original || pendingOrdersRef.current.has(orderId)) return false;

      const optimistic = {
        ...original,
        ...patch,
        updated_at: new Date().toISOString(),
      };
      setError("");
      markPending(orderId, true);
      setBoard((value) =>
        replaceProductionBoardOrder(value, orderId, optimistic),
      );

      try {
        const saved = await patchRunnerOrder(
          productionId,
          token,
          orderId,
          patch,
        );
        if (mountedRef.current) {
          setBoard((value) =>
            replaceProductionBoardOrder(value, orderId, saved),
          );
        }
        return true;
      } catch (err) {
        if (mountedRef.current) {
          setBoard((value) =>
            replaceProductionBoardOrder(value, orderId, original),
          );
          setError(
            describeDataError(err, "Couldn't save that change — reverted."),
          );
        }
        return false;
      } finally {
        if (mountedRef.current) markPending(orderId, false);
      }
    },
    [markPending, productionId, token],
  );

  return { board, error, setError, pendingOrders, patchOrder };
}
