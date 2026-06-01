"use client";

import {
  Ban,
  Check,
  Clipboard,
  PackageCheck,
  Pencil,
  Plus,
  Printer,
  Search,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  Avatar,
  EmptyState,
  Field,
  Panel,
  StatusChip,
  buttonClass,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  statusLabels,
} from "@/components/ui";
import {
  byPersonSummary,
  formatDrink,
  groupedByDrinkSummary,
  plainTextCoffeeSummary,
} from "@/lib/order-summary";
import {
  addRosterPerson,
  loadCoffeeData,
  saveOrderDraft,
  updateOrderRecord,
} from "@/lib/data";
import type { CoffeeData, Order, OrderStatus, RosterOrder } from "@/lib/types";

const statuses = Object.keys(statusLabels) as OrderStatus[];
const tabs = ["People", "Groups", "Drinks", "Status", "Summary"] as const;
type Tab = (typeof tabs)[number];

export default function ProductionDashboardPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<CoffeeData | null>(null);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [tab, setTab] = useState<Tab>("People");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Order>>({});
  const [personToAdd, setPersonToAdd] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
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

  const production = data?.productions.find((item) => item.id === params.id);
  const client = data?.clients.find((item) => item.id === production?.client_id);

  const items = useMemo<RosterOrder[]>(() => {
    if (!data || !production) return [];

    return data.production_roster
      .filter((roster) => roster.production_id === production.id)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((roster) => ({
        roster,
        person: data.people.find((person) => person.id === roster.person_id)!,
        order: data.orders.find((order) => order.roster_id === roster.id),
      }))
      .filter((item) => item.person);
  }, [data, production]);

  const groups = useMemo(
    () =>
      Array.from(
        new Set(
          items.map((item) => item.roster.group_label || item.person.department || "Set"),
        ),
      ).sort(),
    [items],
  );

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return items.filter((item) => {
      const group = item.roster.group_label || item.person.department || "Set";
      const haystack = [
        item.person.name,
        item.person.role,
        item.person.department,
        item.person.usual_order,
        formatDrink(item.order),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!needle || haystack.includes(needle)) &&
        (groupFilter === "all" || group === groupFilter) &&
        (statusFilter === "all" || item.order?.status === statusFilter)
      );
    });
  }, [groupFilter, items, query, statusFilter]);

  const progress = useMemo(() => {
    const done = items.filter((item) => item.order?.status !== "not_asked").length;
    return {
      done,
      total: items.length,
      percent: items.length ? Math.round((done / items.length) * 100) : 0,
    };
  }, [items]);

  const peopleNotOnRoster = useMemo(() => {
    if (!data) return [];
    const rostered = new Set(items.map((item) => item.person.id));
    return data.people.filter((person) => !rostered.has(person.id) && person.active);
  }, [data, items]);

  if (!data || !production) {
    return (
      <AppShell title="Production" eyebrow="Loading">
        {!data ? (
          <Panel className="h-40 animate-pulse bg-white/70 p-4" />
        ) : (
          <EmptyState
            title="Production not found"
            description="This run is not available in the current coffee dataset."
          />
        )}
      </AppShell>
    );
  }

  const activeProduction = production;
  const activeClient = client;

  async function updateOrder(orderId: string, patch: Partial<Order>) {
    if (!data) return;
    setError("");
    try {
      const next = await updateOrderRecord(data, orderId, patch);
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update order.");
    }
  }

  function confirmUsual(item: RosterOrder) {
    if (!item.order) return;
    updateOrder(item.order.id, { status: "confirmed" });
  }

  function editOrder(order: Order) {
    setEditingId(order.id);
    setDraft(order);
  }

  async function saveDraft() {
    if (!data || !editingId || saving) return;

    setSaving(true);
    setError("");
    try {
      const next = await saveOrderDraft(data, editingId, {
        ...draft,
        status: (draft.status || "confirmed") as OrderStatus,
      });
      setData(next);
      setEditingId(null);
      setDraft({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save order.");
    } finally {
      setSaving(false);
    }
  }

  async function addPersonToRoster() {
    if (!data || !production || !personToAdd || saving) return;

    setSaving(true);
    setError("");
    try {
      const next = await addRosterPerson(data, activeProduction.id, personToAdd);
      setData(next);
      setPersonToAdd("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add roster member.");
    } finally {
      setSaving(false);
    }
  }

  async function copySummary() {
    const text = plainTextCoffeeSummary(activeProduction, activeClient, items);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <AppShell title={activeProduction.name} eyebrow={activeClient?.name || "Production"}>
      <Panel className="mb-4 overflow-hidden no-print">
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="production-kicker text-zinc-500">Active run</p>
            <h1 className="break-words text-2xl font-black uppercase tracking-wider md:text-3xl">
              {activeProduction.name}
            </h1>
            <p className="mt-1 truncate text-sm font-semibold text-zinc-600">
              {[activeClient?.name, activeProduction.shoot_date, activeProduction.location]
                .filter(Boolean)
                .join(" / ")}
            </p>
            {activeProduction.runner_name ? (
              <p className="mt-1 text-xs font-black uppercase tracking-wider text-zinc-500">
                Runner: {activeProduction.runner_name}
              </p>
            ) : null}
          </div>
          <div className="border border-black bg-black px-3 py-2 text-right text-sm font-black text-white">
            <span className="block text-2xl leading-none">{progress.percent}%</span>
            <span className="text-xs uppercase tracking-wider text-zinc-300">
              {progress.done}/{progress.total} touched
            </span>
          </div>
        </div>
        <div className="h-2 overflow-hidden bg-zinc-200">
          <div
            className="h-full bg-black"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </Panel>

      <div className="mb-4 grid grid-cols-3 gap-2 no-print">
        <RunMetric label="Roster" value={progress.total} />
        <RunMetric label="Confirmed" value={items.filter((item) => item.order?.status === "confirmed").length} />
        <RunMetric label="Delivered" value={items.filter((item) => item.order?.status === "delivered").length} />
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800 no-print">
          {error}
        </div>
      ) : null}

      <Panel className="mb-4 grid gap-3 p-3 no-print">
        <label className="relative block">
          <Search
            size={19}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            aria-hidden="true"
          />
          <input
            className={`${inputClass} pl-10`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, role, drink"
            aria-label="Search roster"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <select
            className={inputClass}
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
            aria-label="Filter by group"
          >
            <option value="all">All groups</option>
            {groups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as OrderStatus | "all")
            }
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`min-h-11 shrink-0 rounded-sm px-4 text-sm font-black uppercase tracking-wide ${
                tab === item
                  ? "bg-black text-white"
                  : "border border-zinc-400 bg-white text-zinc-700"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </Panel>

      {tab === "People" ? (
        <PeopleTab
          items={filteredItems}
          onConfirm={confirmUsual}
          onEdit={editOrder}
          onNoOrder={(order) => updateOrder(order.id, { status: "no_order" })}
          onDelivered={(order) => updateOrder(order.id, { status: "delivered" })}
        />
      ) : null}

      {tab === "Groups" ? <GroupsTab items={items} /> : null}
      {tab === "Drinks" ? <DrinksTab items={items} /> : null}
      {tab === "Status" ? <StatusTab items={items} onStatus={updateOrder} /> : null}
      {tab === "Summary" ? (
        <SummaryTab
          productionName={activeProduction.name}
          clientName={activeClient?.name || ""}
          items={items}
          summary={plainTextCoffeeSummary(activeProduction, activeClient, items)}
          copied={copied}
          onCopy={copySummary}
        />
      ) : null}

      <Panel className="mt-4 p-4 no-print">
        <p className="production-kicker text-zinc-500">Roster control</p>
        <h2 className="text-lg font-black uppercase tracking-wide">Add to roster</h2>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <select
            className={inputClass}
            value={personToAdd}
            onChange={(event) => setPersonToAdd(event.target.value)}
            aria-label="Add person to production roster"
          >
            <option value="">Choose person</option>
            {peopleNotOnRoster.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} - {person.department || person.type}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addPersonToRoster}
            className={primaryButtonClass}
            disabled={!personToAdd || saving}
            aria-label="Add selected person"
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
      </Panel>

      {editingId ? (
        <OrderEditor
          draft={draft}
          onChange={setDraft}
          onCancel={() => {
            setEditingId(null);
            setDraft({});
          }}
          onSave={saveDraft}
        />
      ) : null}
    </AppShell>
  );
}

function RunMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-zinc-300 bg-white/95 p-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-black leading-none text-black">{value}</p>
    </div>
  );
}

function PeopleTab({
  items,
  onConfirm,
  onEdit,
  onNoOrder,
  onDelivered,
}: {
  items: RosterOrder[];
  onConfirm: (item: RosterOrder) => void;
  onEdit: (order: Order) => void;
  onNoOrder: (order: Order) => void;
  onDelivered: (order: Order) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 no-print">
      {!items.length ? (
        <EmptyState
          title="No matching people"
          description="Adjust the search or filters to bring roster cards back."
        />
      ) : null}
      {items.map((item) => {
        if (!item.order) return null;

        return (
          <article
            key={item.roster.id}
            className="border border-zinc-300 bg-white/95 p-4 shadow-[0_1px_0_rgba(0,0,0,0.08)]"
          >
            <div className="flex gap-3">
              <Avatar person={item.person} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black uppercase tracking-wide">{item.person.name}</h2>
                    <p className="truncate text-sm font-semibold text-zinc-600">
                      {[item.person.role, item.roster.group_label || item.person.department]
                        .filter(Boolean)
                        .join(" / ")}
                    </p>
                  </div>
                  <StatusChip status={item.order.status} />
                </div>
                <div className="mt-3 grid gap-2 text-sm">
                  <p className="bg-zinc-100 p-3 leading-5 text-zinc-700">
                    <span className="block text-xs font-black uppercase tracking-wider text-zinc-500">
                      Usual
                    </span>
                    {item.person.usual_order || "No usual order saved"}
                  </p>
                  <p className="border border-zinc-300 bg-white p-3 leading-5 text-zinc-800">
                    <span className="block text-xs font-black uppercase tracking-wider text-zinc-500">
                      Today
                    </span>
                    {formatDrink(item.order)}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onConfirm(item)}
                className={`${buttonClass} bg-black text-white`}
              >
                <Check size={18} aria-hidden="true" />
                Confirm
              </button>
              <button
                type="button"
                onClick={() => onEdit(item.order!)}
                className={secondaryButtonClass}
              >
                <Pencil size={18} aria-hidden="true" />
                Edit order
              </button>
              <button
                type="button"
                onClick={() => onNoOrder(item.order!)}
                className={dangerButtonClass}
              >
                <Ban size={18} aria-hidden="true" />
                No order
              </button>
              <button
                type="button"
                onClick={() => onDelivered(item.order!)}
                className={`${buttonClass} bg-zinc-800 text-white`}
              >
                <PackageCheck size={18} aria-hidden="true" />
                Delivered
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function GroupsTab({ items }: { items: RosterOrder[] }) {
  const groups = Array.from(
    items.reduce((map, item) => {
      const key = item.roster.group_label || item.person.department || "Set";
      const current = map.get(key) || [];
      current.push(item);
      map.set(key, current);
      return map;
    }, new Map<string, RosterOrder[]>()),
  );

  return (
    <div className="grid gap-3 no-print">
      {groups.map(([group, groupItems]) => (
        <section
          key={group}
          className="border border-zinc-300 bg-white/95 p-4 shadow-[0_1px_0_rgba(0,0,0,0.08)]"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black uppercase tracking-wide">{group}</h2>
            <span className="text-sm font-black uppercase tracking-wider text-zinc-500">
              {groupItems.length} people
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            {groupItems.map((item) => (
              <div
                key={item.roster.id}
                className="flex items-center justify-between gap-3 border border-zinc-300 bg-zinc-100 p-3"
              >
                <span className="min-w-0 truncate text-sm font-bold">
                  {item.person.name}
                </span>
                {item.order ? <StatusChip status={item.order.status} /> : null}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DrinksTab({ items }: { items: RosterOrder[] }) {
  const drinks = groupedByDrinkSummary(items);

  return (
    <div className="grid gap-3 no-print">
      {!drinks.length ? (
        <EmptyState
          title="No drink summary yet"
          description="Confirm or edit orders to build a coffee shop count."
        />
      ) : null}
      {drinks.map((drink) => (
        <article
          key={drink.order}
          className="border border-zinc-300 bg-white/95 p-4 shadow-[0_1px_0_rgba(0,0,0,0.08)]"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-black uppercase leading-6 tracking-wide">{drink.order}</h2>
            <span className="bg-black px-3 py-1 text-sm font-black text-white">
              {drink.count}x
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            {drink.people.join(", ")}
          </p>
        </article>
      ))}
    </div>
  );
}

function StatusTab({
  items,
  onStatus,
}: {
  items: RosterOrder[];
  onStatus: (orderId: string, patch: Partial<Order>) => void;
}) {
  return (
    <div className="grid gap-3 no-print">
      {statuses.map((status) => {
        const statusItems = items.filter((item) => item.order?.status === status);
        if (!statusItems.length) return null;

        return (
          <section
            key={status}
            className="border border-zinc-300 bg-white/95 p-4 shadow-[0_1px_0_rgba(0,0,0,0.08)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-wide">{statusLabels[status]}</h2>
              <span className="text-sm font-black uppercase tracking-wider text-zinc-500">
                {statusItems.length}
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              {statusItems.map((item) => (
                <div
                  key={item.roster.id}
                  className="grid gap-2 border border-zinc-300 bg-zinc-100 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold">{item.person.name}</span>
                    <span className="text-sm text-zinc-600">
                      {item.roster.group_label}
                    </span>
                  </div>
                  {item.order ? (
                    <select
                      className={inputClass}
                      value={item.order.status}
                      onChange={(event) =>
                        onStatus(item.order!.id, {
                          status: event.target.value as OrderStatus,
                        })
                      }
                      aria-label={`Change status for ${item.person.name}`}
                    >
                      {statuses.map((nextStatus) => (
                        <option key={nextStatus} value={nextStatus}>
                          {statusLabels[nextStatus]}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SummaryTab({
  productionName,
  clientName,
  items,
  summary,
  copied,
  onCopy,
}: {
  productionName: string;
  clientName: string;
  items: RosterOrder[];
  summary: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const byPerson = byPersonSummary(items);

  function printLabels() {
    window.print();
  }

  return (
    <>
      <Panel className="grid gap-3 p-4 no-print">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black uppercase tracking-wide">Coffee shop summary</h2>
            <p className="text-sm text-zinc-600">
              Plain text for ordering and handoff.
            </p>
          </div>
          <button type="button" onClick={printLabels} className={secondaryButtonClass}>
            <Printer size={18} aria-hidden="true" />
            Print M2 labels
          </button>
        </div>
        <textarea
          className={`${inputClass} min-h-80 whitespace-pre-wrap py-3 font-mono text-sm`}
          value={summary}
          readOnly
          aria-label="Coffee shop summary"
        />
        <button type="button" onClick={onCopy} className={primaryButtonClass}>
          <Clipboard size={18} aria-hidden="true" />
          {copied ? "Copied" : "Copy summary"}
        </button>
      </Panel>

      <section className="print-only hidden">
        <div className="m2-label-sheet">
          {byPerson.map((item) => (
            <article
              key={`${item.name}-${item.order}`}
              className="m2-label"
            >
              <div className="m2-label-mark">CT</div>
              <h2>{item.name}</h2>
              <p className="m2-label-order">{item.order}</p>
              <div className="m2-label-footer">
                <span>{item.group}</span>
                <span>{[productionName, clientName].filter(Boolean).join(" / ")}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function OrderEditor({
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Partial<Order>;
  onChange: (draft: Partial<Order>) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid items-end bg-black/55 p-3 no-print">
      <section className="mx-auto grid max-h-[90dvh] w-full max-w-xl gap-3 overflow-y-auto border border-zinc-300 bg-white p-4 shadow-2xl">
        <div>
          <p className="production-kicker text-zinc-500">Order card</p>
          <h2 className="text-xl font-black uppercase tracking-wide">Edit order</h2>
          <p className="text-sm text-zinc-600">
            Changes update today&apos;s order and save as the usual order.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Drink">
            <input
              className={inputClass}
              value={draft.drink_type || ""}
              onChange={(event) =>
                onChange({ ...draft, drink_type: event.target.value })
              }
              placeholder="Latte, cold brew, drip"
            />
          </Field>
          <Field label="Size">
            <select
              className={inputClass}
              value={draft.size || ""}
              onChange={(event) => onChange({ ...draft, size: event.target.value })}
            >
              <option value="">Choose</option>
              <option>Small</option>
              <option>Medium</option>
              <option>Large</option>
            </select>
          </Field>
          <Field label="Temperature">
            <select
              className={inputClass}
              value={draft.temperature || ""}
              onChange={(event) =>
                onChange({ ...draft, temperature: event.target.value })
              }
            >
              <option value="">Choose</option>
              <option>Hot</option>
              <option>Iced</option>
            </select>
          </Field>
          <Field label="Milk">
            <input
              className={inputClass}
              value={draft.milk_type || ""}
              onChange={(event) =>
                onChange({ ...draft, milk_type: event.target.value })
              }
              placeholder="Oat, almond, whole"
            />
          </Field>
          <Field label="Sweetener">
            <input
              className={inputClass}
              value={draft.sweetener || ""}
              onChange={(event) =>
                onChange({ ...draft, sweetener: event.target.value })
              }
              placeholder="Half sweet, vanilla"
            />
          </Field>
          <Field label="Caffeine">
            <select
              className={inputClass}
              value={draft.caffeine || "Regular"}
              onChange={(event) =>
                onChange({ ...draft, caffeine: event.target.value })
              }
            >
              <option>Regular</option>
              <option>Decaf</option>
              <option>Half-caf</option>
              <option>No caffeine</option>
            </select>
          </Field>
        </div>
        <Field label="Special notes">
          <textarea
            className={`${inputClass} min-h-24 py-3`}
            value={draft.special_notes || ""}
            onChange={(event) =>
              onChange({ ...draft, special_notes: event.target.value })
            }
            placeholder="No room, extra hot, separate cup"
          />
        </Field>
        <Field label="Status">
          <select
            className={inputClass}
            value={draft.status || "confirmed"}
            onChange={(event) =>
              onChange({ ...draft, status: event.target.value as OrderStatus })
            }
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="button" onClick={onSave} className={primaryButtonClass}>
            Save order
          </button>
        </div>
      </section>
    </div>
  );
}
