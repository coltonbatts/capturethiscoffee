"use client";

import Link from "next/link";
import { CalendarDays, MapPin, Plus, RotateCcw, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Panel, StatusChip } from "@/components/ui";
import {
  isSupabaseBacked,
  loadCoffeeData,
  resetDemoCoffeeData,
} from "@/lib/data";
import type { CoffeeData } from "@/lib/types";

export default function ProductionsPage() {
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
        const done = orders.filter((order) => order.status !== "not_asked").length;
        const progress = orders.length ? Math.round((done / orders.length) * 100) : 0;
        const openStatus =
          orders.find((order) => order.status === "not_asked")?.status ||
          orders.find((order) => order.status === "confirmed")?.status ||
          orders[0]?.status ||
          "not_asked";

        return { production, client, orders, done, progress, openStatus };
      });
  }, [data]);

  async function resetDemoData() {
    const next = await resetDemoCoffeeData();
    setData(next);
  }

  return (
    <AppShell
      title="Productions"
      eyebrow="Capture This ops"
      actions={
        <Link
          href="/productions/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-black px-3 text-sm font-black uppercase tracking-wide text-white shadow-sm"
        >
          <Plus size={18} aria-hidden="true" />
          New
        </Link>
      }
    >
      <Panel className="mb-4 flex items-center justify-between gap-3 p-4">
        <div>
          <p className="production-kicker text-zinc-500">Shoot board</p>
          <h1 className="text-2xl font-black uppercase tracking-wider">Coffee runs</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Confirm orders, group drinks, and keep the set moving.
          </p>
        </div>
        {!isSupabaseBacked ? (
          <button
            type="button"
            onClick={resetDemoData}
            className="grid min-h-11 min-w-11 place-items-center rounded-sm border border-zinc-400 bg-white text-zinc-700 hover:bg-zinc-100"
            aria-label="Reset demo data"
          >
            <RotateCcw size={18} aria-hidden="true" />
          </button>
        ) : null}
      </Panel>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      ) : null}

      {!data ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <Panel key={item} className="h-48 animate-pulse bg-white/70 p-4" />
          ))}
        </div>
      ) : cards.length ? (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ production, client, orders, done, progress, openStatus }) => (
          <Link
            key={production.id}
            href={`/productions/${production.id}`}
            className="border border-zinc-300 bg-white/95 p-4 shadow-[0_1px_0_rgba(0,0,0,0.08)] transition hover:border-black hover:shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-black uppercase tracking-wide">{production.name}</h2>
                <p className="truncate text-sm font-semibold text-zinc-600">
                  {client?.name || "No client"}
                </p>
              </div>
              <StatusChip status={openStatus} />
            </div>
            <div className="mt-4 grid gap-2 text-sm text-zinc-700">
              <span className="flex items-center gap-2">
                <CalendarDays size={16} aria-hidden="true" />
                {production.shoot_date || "No shoot date"}
              </span>
              <span className="flex items-center gap-2">
                <MapPin size={16} aria-hidden="true" />
                {production.location || "Location TBD"}
              </span>
              <span className="flex items-center gap-2">
                <UserRound size={16} aria-hidden="true" />
                Runner: {production.runner_name || "Unassigned"}
              </span>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs font-black uppercase tracking-wider text-zinc-500">
                <span>Run progress</span>
                <span>
                  {done}/{orders.length}
                </span>
              </div>
              <div className="h-2 overflow-hidden bg-zinc-200">
                <div
                  className="h-full bg-black"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </Link>
        ))}
      </div>
      ) : (
        <EmptyState
          title="No productions yet"
          description="Create the first shoot run to seed a roster and start confirming orders."
          action={
            <Link
              href="/productions/new"
              className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-black px-3 text-sm font-black uppercase tracking-wide text-white"
            >
              <Plus size={18} aria-hidden="true" />
              New production
            </Link>
          }
        />
      )}
    </AppShell>
  );
}
