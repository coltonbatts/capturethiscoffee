"use client";

import Link from "next/link";
import {
  ImageDown,
  Plus,
  RotateCcw,
  Sliders,
  ChevronUp,
  ChevronDown,
  Settings,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAppAuth } from "@/components/app-auth-provider";
import {
  EmptyState,
  Panel,
  Field,
  inputClass,
} from "@/components/ui";
import {
  isSupabaseBacked,
  loadCoffeeData,
  resetDemoCoffeeData,
  removeProductionRecord,
  updateProductionRecord,
} from "@/lib/data";
import { isOrderCaptured } from "@/lib/order-progress";
import type { CoffeeData, Production } from "@/lib/types";

type ProductionCard = {
  production: Production;
  client?: { name: string };
  captured: number;
  remaining: number;
};

type EditDraft = {
  id: string;
  name: string;
  new_client_name: string;
  shoot_date: string;
  location: string;
  runner_name: string;
  notes: string;
  status: Production["status"];
};

const statusRank: Record<Production["status"], number> = {
  active: 0,
  planning: 1,
  complete: 2,
};

// Premium custom buttons using our neo-brutalist studio aesthetic (thick borders, thick hover shadows)
const customPrimaryBtn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-[3px] border-black bg-black text-white font-black text-sm uppercase tracking-wider hover:bg-zinc-800 transition active:translate-y-px disabled:opacity-50";

const customSecondaryBtn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-[3px] border-black bg-white text-black font-black text-sm uppercase tracking-wider hover:bg-zinc-100 transition active:translate-y-px disabled:opacity-50";

export default function ProductionsPage() {
  const { isAdmin } = useAppAuth();
  const [data, setData] = useState<CoffeeData | null>(null);
  const [error, setError] = useState("");
  const [customOrder, setCustomOrder] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("capture-this-coffee-production-order");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fallback
        }
      }
    }
    return [];
  });
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [editingProduction, setEditingProduction] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);

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

    const sortedProductions = data.productions.slice();
    if (customOrder.length > 0) {
      const validIds = new Set(data.productions.map((p) => p.id));
      const filteredOrder = customOrder.filter((id) => validIds.has(id));
      const missingIds = data.productions
        .filter((p) => !filteredOrder.includes(p.id))
        .map((p) => p.id);
      const finalOrder = [...filteredOrder, ...missingIds];

      sortedProductions.sort((a, b) => {
        return finalOrder.indexOf(a.id) - finalOrder.indexOf(b.id);
      });
    } else {
      sortedProductions.sort((a, b) => {
        const rank = statusRank[a.status] - statusRank[b.status];
        if (rank !== 0) return rank;
        const dateA = a.shoot_date || a.created_at;
        const dateB = b.shoot_date || b.created_at;
        return dateB.localeCompare(dateA);
      });
    }

    return sortedProductions.map((production) => {
      const client = data.clients.find((item) => item.id === production.client_id);
      const orders = data.orders.filter(
        (order) => order.production_id === production.id,
      );
      const captured = orders.filter((order) => isOrderCaptured(order)).length;
      const remaining = orders.filter((order) => order.status === "not_asked").length;

      return { production, client, captured, remaining };
    });
  }, [data, customOrder]);

  async function resetDemoData() {
    const next = await resetDemoCoffeeData();
    setData(next);
    localStorage.removeItem("capture-this-coffee-production-order");
    setCustomOrder([]);
  }

  function moveProduction(productionId: string, direction: "up" | "down") {
    const ids = cards.map((c) => c.production.id);
    const index = ids.indexOf(productionId);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= ids.length) return;

    const nextIds = [...ids];
    const temp = nextIds[index];
    nextIds[index] = nextIds[newIndex];
    nextIds[newIndex] = temp;

    localStorage.setItem("capture-this-coffee-production-order", JSON.stringify(nextIds));
    setCustomOrder(nextIds);
  }

  function openProductionEditor(production: Production, clientName = "") {
    setEditingProduction({
      id: production.id,
      name: production.name,
      new_client_name: clientName,
      shoot_date: production.shoot_date,
      location: production.location || "",
      runner_name: production.runner_name || "",
      notes: production.notes || "",
      status: production.status,
    });
  }

  async function saveProductionEdit() {
    if (!editingProduction || !data) return;
    setSaving(true);
    setError("");
    try {
      const next = await updateProductionRecord(data, editingProduction.id, {
        name: editingProduction.name,
        new_client_name: editingProduction.new_client_name,
        shoot_date: editingProduction.shoot_date,
        location: editingProduction.location,
        runner_name: editingProduction.runner_name,
        notes: editingProduction.notes,
        status: editingProduction.status,
      });
      setData(next);
      setEditingProduction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save details.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productionId: string, name: string) {
    if (
      !window.confirm(
        `Are you sure you want to delete "${name}"? This will delete all orders and members linked to this day.`,
      )
    ) {
      return;
    }
    setError("");
    try {
      const next = await removeProductionRecord(data!, productionId);
      setData(next);
      const nextOrder = customOrder.filter((id) => id !== productionId);
      localStorage.setItem("capture-this-coffee-production-order", JSON.stringify(nextOrder));
      setCustomOrder(nextOrder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete day.");
    }
  }

  return (
    <AppShell
      title="Days"
      breadcrumbs={[{ label: "Days" }]}
      actions={
        isAdmin ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCustomizing(!isCustomizing)}
              className={`${customSecondaryBtn} hidden sm:flex items-center gap-1.5 min-h-11 py-0 px-3 text-xs`}
              aria-label="Customize list order and settings"
            >
              <Sliders size={15} aria-hidden="true" />
              <span>{isCustomizing ? "Done" : "Customize"}</span>
            </button>
            <Link
              href="/productions/new"
              className={`${customPrimaryBtn} hidden sm:flex items-center gap-1.5 min-h-11 py-0 px-4 text-xs`}
              aria-label="New day"
            >
              <Plus size={15} aria-hidden="true" />
              <span>New</span>
            </Link>
          </div>
        ) : null
      }
    >
      {/* Center Layout Container for a Clean Studio Vibe */}
      <div className="mx-auto w-full max-w-md px-1 sm:max-w-xl sm:px-0 md:max-w-3xl">
        <section className="mb-6 rounded-xl border-[3px] border-black bg-white p-5 shadow-[4px_4px_0_#000] min-w-0 w-full">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black uppercase tracking-tight text-black">Days</h1>
              <p className="mt-1 text-sm font-medium leading-relaxed text-zinc-600">
                Put today&apos;s people on the roster, collect their drinks, print
                their labels.
              </p>
            </div>
            <div className="shrink-0 sm:w-[180px]">
              <Link href="/labels" className={`${customSecondaryBtn} w-full text-center`}>
                <ImageDown size={18} aria-hidden="true" />
                Print labels
              </Link>
            </div>
          </div>
        </section>

        {!isSupabaseBacked ? (
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={resetDemoData}
              className={`${customSecondaryBtn} min-w-11 px-3 min-h-11`}
              aria-label="Reset demo data"
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-lg border border-red-700 bg-white p-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        {!data ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <Panel key={item} className="h-32 animate-pulse bg-zinc-100 p-4 border-[3px] border-black shadow-[4px_4px_0_#000]" />
            ))}
          </div>
        ) : cards.length ? (
          <div className="grid gap-3">
            {cards.map((card, idx) => (
              <ProductionListItem
                key={card.production.id}
                card={card}
                isCustomizing={isCustomizing}
                canDelete={isAdmin}
                onMoveUp={() => moveProduction(card.production.id, "up")}
                onMoveDown={() => moveProduction(card.production.id, "down")}
                onEdit={() => openProductionEditor(card.production, card.client?.name || "")}
                onDelete={() => handleDelete(card.production.id, card.production.name)}
                isFirst={idx === 0}
                isLast={idx === cards.length - 1}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No days yet"
            description="Create a day to start confirming orders."
            action={
              isAdmin ? (
                <Link href="/productions/new" className={customPrimaryBtn}>
                  <Plus size={18} aria-hidden="true" />
                  New day
                </Link>
              ) : undefined
            }
          />
        )}
      </div>

      {/* Add spacing at the bottom on mobile to account for the sticky bottom nav bar */}
      <div className="h-24 sm:hidden" />

      {/* Mobile Sticky Bottom Nav Bar (Thumb Zone) */}
      {isAdmin && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t-[3px] border-black bg-white/95 p-4 backdrop-blur-sm sm:hidden no-print shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3">
            <Link href="/productions/new" className={customPrimaryBtn + " flex-1"}>
              <Plus size={18} aria-hidden="true" />
              New Day
            </Link>
            <Link href="/labels" className={customSecondaryBtn + " flex-1"}>
              <ImageDown size={18} aria-hidden="true" />
              Labels
            </Link>
            <button
              type="button"
              onClick={() => setIsCustomizing(!isCustomizing)}
              className={`${
                isCustomizing ? customPrimaryBtn : customSecondaryBtn
              } flex-1`}
            >
              <Sliders size={18} aria-hidden="true" />
              {isCustomizing ? "Done" : "Sort"}
            </button>
          </div>
        </div>
      )}

      {/* Edit Production Details Modal */}
      {editingProduction && (
        <div className="fixed inset-0 z-50 grid items-end bg-black/55 p-4 no-print sm:items-center">
          <div className="mx-auto grid max-h-[85dvh] w-full max-w-md min-w-0 gap-4 overflow-y-auto rounded-xl border-[3px] border-black bg-white p-5 shadow-[6px_6px_0_#000]">
            <h2 className="text-lg font-black uppercase tracking-tight text-black">Edit Day Details</h2>
            <Field label="Day name">
              <input
                className={inputClass}
                value={editingProduction.name}
                onChange={(event) =>
                  setEditingProduction({ ...editingProduction, name: event.target.value })
                }
                required
                autoFocus
              />
            </Field>
            <Field label="Client / brand (optional, shows on labels)">
              <input
                className={inputClass}
                value={editingProduction.new_client_name}
                onChange={(event) =>
                  setEditingProduction({ ...editingProduction, new_client_name: event.target.value })
                }
                placeholder="Client or brand name"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Shoot date">
                <input
                  className={inputClass}
                  type="date"
                  value={editingProduction.shoot_date}
                  onChange={(event) =>
                    setEditingProduction({ ...editingProduction, shoot_date: event.target.value })
                  }
                />
              </Field>
              <Field label="Runner">
                <input
                  className={inputClass}
                  value={editingProduction.runner_name}
                  onChange={(event) =>
                    setEditingProduction({ ...editingProduction, runner_name: event.target.value })
                  }
                  placeholder="Runner name"
                />
              </Field>
            </div>
            <Field label="Location">
              <input
                className={inputClass}
                value={editingProduction.location}
                onChange={(event) =>
                  setEditingProduction({ ...editingProduction, location: event.target.value })
                }
                placeholder="Studio or address"
              />
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={editingProduction.status}
                onChange={(event) =>
                  setEditingProduction({
                    ...editingProduction,
                    status: event.target.value as Production["status"],
                  })
                }
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="complete">Complete</option>
              </select>
            </Field>
            <Field label="Notes">
              <textarea
                className={`${inputClass} min-h-20 py-3`}
                value={editingProduction.notes}
                onChange={(event) =>
                  setEditingProduction({ ...editingProduction, notes: event.target.value })
                }
                placeholder="Call time, coffee shop, handoff"
              />
            </Field>
            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingProduction(null)}
                className={customSecondaryBtn}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProductionEdit}
                disabled={saving || !editingProduction.name.trim()}
                className={customPrimaryBtn}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function ProductionListItem({
  card,
  isCustomizing,
  canDelete,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  isFirst,
  isLast,
}: {
  card: ProductionCard;
  isCustomizing: boolean;
  canDelete: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const content = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 w-full min-w-0">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-black uppercase tracking-tight text-black truncate">
          {card.production.name}
        </h2>
        <p className="mt-0.5 text-sm text-zinc-600 truncate">{productionDetail(card)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {card.production.status !== "complete" ? (
          <span className="rounded-md border-[2px] border-black bg-black px-2 py-0.5 text-xs font-black uppercase text-white">
            {card.production.status === "active" ? "Active" : "Planning"}
          </span>
        ) : (
          <span className="rounded-md border-[2px] border-zinc-400 bg-zinc-100 px-2 py-0.5 text-xs font-bold uppercase text-zinc-500">
            Complete
          </span>
        )}
        <span className="rounded-md border-[2px] border-black bg-white px-2 py-0.5 text-sm font-black text-black">
          {card.remaining
            ? `${card.remaining} ${card.remaining === 1 ? "drink" : "drinks"} needed`
            : `${card.captured} ${card.captured === 1 ? "drink" : "drinks"} in`}
        </span>
      </div>

      {isCustomizing && (
        <div className="mt-3 flex items-center justify-end gap-2 border-t-[3px] border-black pt-3 sm:mt-0 sm:border-t-0 sm:pt-0">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMoveUp?.();
            }}
            disabled={isFirst}
            className="flex h-10 w-10 items-center justify-center rounded-lg border-[3px] border-black bg-white text-black hover:bg-zinc-100 active:translate-y-px disabled:opacity-30 disabled:pointer-events-none transition"
            aria-label="Move Up"
          >
            <ChevronUp size={18} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMoveDown?.();
            }}
            disabled={isLast}
            className="flex h-10 w-10 items-center justify-center rounded-lg border-[3px] border-black bg-white text-black hover:bg-zinc-100 active:translate-y-px disabled:opacity-30 disabled:pointer-events-none transition"
            aria-label="Move Down"
          >
            <ChevronDown size={18} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit?.();
            }}
            className="flex h-10 px-3 items-center justify-center gap-1.5 rounded-lg border-[3px] border-black bg-white text-black hover:bg-zinc-100 active:translate-y-px transition"
            aria-label="Edit Day"
          >
            <Settings size={16} />
            <span className="text-xs font-black uppercase">Edit</span>
          </button>
        </div>
      )}
    </div>
  );

  const deleteButton =
    canDelete && onDelete ? (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-[3px] border-red-700 bg-white text-red-700 transition hover:bg-red-50 active:translate-y-px"
        aria-label={`Delete ${card.production.name}`}
        title="Delete day"
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    ) : null;

  const cardStyle =
    "block w-full min-w-0 rounded-xl border-[3px] border-black bg-white p-5 shadow-[4px_4px_0_#000] transition-[transform,box-shadow,border-color] duration-100 hover:shadow-[6px_6px_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#000]";

  const customizingCardStyle =
    "block w-full min-w-0 rounded-xl border-[3px] border-black bg-white p-5 shadow-[4px_4px_0_#000]";

  if (isCustomizing) {
    return (
      <div className={customizingCardStyle}>
        <div className="flex min-w-0 items-start gap-3">
          <div className="min-w-0 flex-1">{content}</div>
          {deleteButton}
        </div>
      </div>
    );
  }

  return (
    <div className={cardStyle}>
      <div className="flex min-w-0 items-start gap-3">
        <Link href={`/productions/${card.production.id}`} className="min-w-0 flex-1">
          {content}
        </Link>
        {deleteButton}
      </div>
    </div>
  );
}

function productionDetail(card: ProductionCard) {
  return (
    [card.client?.name, card.production.shoot_date, card.production.location]
      .filter(Boolean)
      .join(" · ") || "No client or date"
  );
}
