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
import type { CoffeeData } from "@/lib/types";

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

        return { production, client, orders, remaining };
      });
  }, [data]);

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
            Pick a job, export labels, keep the coffee moving.
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
      ) : cards.length ? (
        <div className="grid gap-2">
          {cards.map(({ production, client, orders, remaining }) => (
            <Link
              key={production.id}
              href={`/productions/${production.id}`}
              className="block rounded-xl border border-zinc-400 bg-white p-4 transition hover:border-black active:translate-y-px"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">{production.name}</h2>
                  <p className="truncate text-sm text-zinc-600">
                    {[client?.name, production.shoot_date].filter(Boolean).join(" · ") ||
                      "No client or date"}
                  </p>
                </div>
                <span className="shrink-0 rounded-md border border-zinc-500 px-2.5 py-1 text-sm font-black text-zinc-900">
                  {remaining ? `${remaining} left` : `${orders.length} done`}
                </span>
              </div>
            </Link>
          ))}
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
