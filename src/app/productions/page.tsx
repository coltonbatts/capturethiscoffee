"use client";

import Link from "next/link";
import { ImageDown, Plus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAppAuth } from "@/components/app-auth-provider";
import {
  EmptyState,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import {
  isSupabaseBacked,
  loadCoffeeData,
  resetDemoCoffeeData,
} from "@/lib/data";
import { isOrderCaptured } from "@/lib/order-progress";
import type { CoffeeData, Production } from "@/lib/types";

type ProductionCard = {
  production: Production;
  client?: { name: string };
  captured: number;
  remaining: number;
};

const statusRank: Record<Production["status"], number> = {
  active: 0,
  planning: 1,
  complete: 2,
};

export default function ProductionsPage() {
  const { isAdmin } = useAppAuth();
  const [data, setData] = useState<CoffeeData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    loadCoffeeData()
      .then((next) => {
        if (mounted) setData(next);
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const cards = useMemo(() => {
    if (!data) return [];

    return data.productions
      .slice()
      .sort((a, b) => {
        const rank = statusRank[a.status] - statusRank[b.status];
        if (rank !== 0) return rank;
        const dateA = a.shoot_date || a.created_at;
        const dateB = b.shoot_date || b.created_at;
        return dateB.localeCompare(dateA);
      })
      .map((production) => {
        const client = data.clients.find((item) => item.id === production.client_id);
        const orders = data.orders.filter(
          (order) => order.production_id === production.id,
        );
        const captured = orders.filter((order) => isOrderCaptured(order)).length;
        const remaining = orders.filter((order) => order.status === "not_asked").length;

        return { production, client, captured, remaining };
      });
  }, [data]);

  async function resetDemoData() {
    const next = await resetDemoCoffeeData();
    setData(next);
  }

  return (
    <AppShell
      title="Days"
      actions={
        isAdmin ? (
          <Link
            href="/productions/new"
            className={`${primaryButtonClass} min-w-11 px-0 sm:px-4`}
            aria-label="New shoot day"
          >
            <Plus size={18} aria-hidden="true" />
            <span className="hidden sm:inline">New</span>
          </Link>
        ) : null
      }
    >
      <section className="mb-4 grid gap-3 border-y border-black bg-white py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <h1 className="text-2xl font-black leading-tight tracking-normal text-black">Shoot days</h1>
          <p className="mt-1 text-sm font-medium leading-6 text-zinc-600">
            Put today&apos;s people on the roster, collect their drinks, print
            their labels.
          </p>
        </div>
        <div className="grid gap-2 md:w-[220px]">
          <Link href="/labels" className={`${secondaryButtonClass} min-h-14 text-base`}>
            <ImageDown size={19} aria-hidden="true" />
            Print labels
          </Link>
        </div>
      </section>

      {!isSupabaseBacked ? (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={resetDemoData}
            className={`${secondaryButtonClass} min-w-11 px-3`}
            aria-label="Reset demo data"
          >
            <RotateCcw size={18} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-lg border border-red-700 bg-white p-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {!data ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <Panel key={item} className="h-32 animate-pulse bg-zinc-100 p-4" />
          ))}
        </div>
      ) : cards.length ? (
        <div className="grid gap-2">
          {cards.map((card) => (
            <ProductionListItem key={card.production.id} card={card} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No days yet"
          description="Create a shoot day to start confirming orders."
          action={
            isAdmin ? (
              <Link href="/productions/new" className={primaryButtonClass}>
                <Plus size={18} aria-hidden="true" />
                New day
              </Link>
            ) : undefined
          }
        />
      )}
    </AppShell>
  );
}

function ProductionListItem({ card }: { card: ProductionCard }) {
  return (
    <Link
      href={`/productions/${card.production.id}`}
      className="block rounded-xl border border-zinc-400 bg-white p-4 transition hover:border-black active:translate-y-px"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{card.production.name}</h2>
          <p className="truncate text-sm text-zinc-600">{productionDetail(card)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {card.production.status !== "complete" ? (
            <span className="rounded-md border border-black bg-black px-2.5 py-1 text-xs font-black uppercase text-white">
              {card.production.status === "active" ? "Active" : "Planning"}
            </span>
          ) : null}
          <span className="rounded-md border border-zinc-500 px-2.5 py-1 text-sm font-black text-zinc-900">
            {card.remaining
              ? `${card.remaining} ${card.remaining === 1 ? "drink" : "drinks"} needed`
              : `${card.captured} ${card.captured === 1 ? "drink" : "drinks"} in`}
          </span>
        </div>
      </div>
    </Link>
  );
}

function productionDetail(card: ProductionCard) {
  return (
    [card.client?.name, card.production.shoot_date, card.production.location]
      .filter(Boolean)
      .join(" · ") || "No client or date"
  );
}
