"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ImageDown, Plus, RotateCcw } from "lucide-react";
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
import type { CoffeeData, OrderStatus, Production } from "@/lib/types";

type ProductionCard = {
  production: Production;
  client?: { name: string };
  orders: { status: OrderStatus }[];
  remaining: number;
  activeLabels: number;
  responded: number;
  progress: number;
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
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((production) => {
        const client = data.clients.find((item) => item.id === production.client_id);
        const orders = data.orders.filter(
          (order) => order.production_id === production.id,
        );
        const remaining = orders.filter((order) => order.status === "not_asked").length;

        const activeLabels = orders.filter((order) => order.status !== "no_order").length;
        const responded = orders.filter((order) => order.status !== "not_asked").length;
        const progress = orders.length ? Math.round((responded / orders.length) * 100) : 0;

        return {
          production,
          client,
          orders,
          remaining,
          activeLabels,
          responded,
          progress,
        };
      });
  }, [data]);

  const featuredCard = useMemo(() => chooseFeaturedCard(cards), [cards]);
  const otherCards = useMemo(
    () => cards.filter((card) => card.production.id !== featuredCard?.production.id),
    [cards, featuredCard],
  );

  async function resetDemoData() {
    const next = await resetDemoCoffeeData();
    setData(next);
  }

  return (
    <AppShell
      title="Jobs"
      actions={
        isAdmin ? (
          <Link href="/productions/new" className={primaryButtonClass}>
            <Plus size={18} aria-hidden="true" />
            New
          </Link>
        ) : null
      }
    >
      <section className="mb-4 grid gap-3 border-y border-black bg-white py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <h1 className="text-2xl font-black leading-tight tracking-normal text-black">Orders</h1>
          <p className="mt-1 text-sm font-medium leading-6 text-zinc-600">
            Review the active coffee run, update order status, and export labels.
          </p>
        </div>
        <div className="grid gap-2 md:w-[220px]">
          <Link href="/labels" className={`${primaryButtonClass} min-h-14 text-base`}>
            <ImageDown size={19} aria-hidden="true" />
            Open labels
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
      ) : featuredCard ? (
        <div className="grid gap-4">
          <Link
            href={`/productions/${featuredCard.production.id}`}
            className="group block rounded-xl border border-black bg-black p-4 text-white transition active:translate-y-px md:p-5"
          >
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-white/30 px-2.5 py-1 text-xs font-black text-white">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  Client review path
                </div>
                <h2 className="text-2xl font-black leading-tight">
                  {featuredCard.production.name}
                </h2>
                <p className="mt-1 text-sm font-medium leading-6 text-zinc-300">
                  {productionDetail(featuredCard)}
                </p>
              </div>
              <div className="grid gap-2 text-sm md:min-w-64">
                <MetricRow label="Asked" value={`${featuredCard.progress}%`} />
                <MetricRow label="Orders" value={`${featuredCard.responded}/${featuredCard.orders.length}`} />
                <MetricRow label="Labels" value={`${featuredCard.activeLabels} active`} />
              </div>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden rounded-sm bg-white/20">
              <div
                className="h-full bg-white transition-[width]"
                style={{ width: `${featuredCard.progress}%` }}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-sm font-black">
              <span>{featuredCard.remaining ? `${featuredCard.remaining} left to ask` : "Ready for handoff review"}</span>
              <span className="inline-flex items-center gap-1">
                Open run
                <ArrowRight size={16} aria-hidden="true" className="transition group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>

          {otherCards.length ? (
            <section className="grid gap-2">
              <div className="grid gap-1 sm:flex sm:items-center sm:justify-between sm:gap-3">
                <h2 className="text-sm font-black uppercase tracking-normal text-zinc-600">
                  Other jobs
                </h2>
                <span className="text-sm font-medium text-zinc-500">
                  Keep these out of the client walkthrough unless needed.
                </span>
              </div>
              {otherCards.map((card) => (
                <ProductionListItem key={card.production.id} card={card} />
              ))}
            </section>
          ) : null}
        </div>
      ) : (
        <EmptyState
          title="No jobs yet"
          description="Create a production to start confirming orders."
          action={
            isAdmin ? (
              <Link href="/productions/new" className={primaryButtonClass}>
                <Plus size={18} aria-hidden="true" />
                New job
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
        <span className="shrink-0 rounded-md border border-zinc-500 px-2.5 py-1 text-sm font-black text-zinc-900">
          {card.remaining ? `${card.remaining} left` : `${card.orders.length} done`}
        </span>
      </div>
    </Link>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/20 px-3 py-2">
      <span className="text-zinc-300">{label}</span>
      <span className="font-black text-white">{value}</span>
    </div>
  );
}

function chooseFeaturedCard(cards: ProductionCard[]) {
  return cards
    .slice()
    .sort((a, b) => reviewScore(b) - reviewScore(a))[0];
}

function reviewScore(card: ProductionCard) {
  const placeholderPenalty = /\b(test|cool guys?|demo)\b/i.test(card.production.name) ? -20 : 0;
  const statusScore = card.production.status === "active" ? 30 : card.production.status === "planning" ? 15 : 0;
  return statusScore + card.orders.length * 3 + card.activeLabels * 2 + card.progress / 10 + placeholderPenalty;
}

function productionDetail(card: ProductionCard) {
  return (
    [card.client?.name, card.production.shoot_date, card.production.location]
      .filter(Boolean)
      .join(" · ") || "No client or date"
  );
}
