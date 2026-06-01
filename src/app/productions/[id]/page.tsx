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
  Trash2,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CaptureAngle } from "@/components/capture-mark";
import {
  Avatar,
  EmptyState,
  Field,
  Panel,
  StatusChip,
  buttonClass,
  cardClass,
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
  createPersonAndAddToRoster,
  loadCoffeeData,
  removeRosterRecord,
  saveOrderDraft,
  updateOrderRecord,
  updateRosterRecord,
} from "@/lib/data";
import {
  emptyPersonForm,
  groupSuggestions,
  personTypeLabel,
  personTypes,
  type PersonForm,
} from "@/lib/people";
import type {
  CoffeeData,
  Order,
  OrderStatus,
  ProductionRoster,
  RosterOrder,
} from "@/lib/types";

const statuses = Object.keys(statusLabels) as OrderStatus[];
const tabs = ["People", "Groups", "Drinks", "Status", "Summary"] as const;
type Tab = (typeof tabs)[number];
type RosterStateFilter = "on_set" | "all" | "off_set";

export default function ProductionDashboardPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<CoffeeData | null>(null);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [tab, setTab] = useState<Tab>("People");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Order>>({});
  const [updateUsualOrder, setUpdateUsualOrder] = useState(false);
  const [editingRosterId, setEditingRosterId] = useState<string | null>(null);
  const [rosterDraft, setRosterDraft] = useState<Partial<ProductionRoster>>({});
  const [rosterStateFilter, setRosterStateFilter] =
    useState<RosterStateFilter>("on_set");
  const [personToAdd, setPersonToAdd] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState<PersonForm>(
    emptyPersonForm("guest"),
  );
  const [linkQuickAddToClient, setLinkQuickAddToClient] = useState(false);
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
          items
            .filter((item) => item.roster.on_set_today)
            .map((item) => item.roster.group_label || item.person.department || "Set"),
        ),
      ).sort(),
    [items],
  );

  const activeItems = useMemo(
    () => items.filter((item) => item.roster.on_set_today),
    [items],
  );

  const visibleRosterItems = useMemo(() => {
    if (rosterStateFilter === "all") return items;
    if (rosterStateFilter === "off_set") {
      return items.filter((item) => !item.roster.on_set_today);
    }
    return activeItems;
  }, [activeItems, items, rosterStateFilter]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return visibleRosterItems.filter((item) => {
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
  }, [groupFilter, query, statusFilter, visibleRosterItems]);

  const progress = useMemo(() => {
    const done = activeItems.filter((item) => item.order?.status !== "not_asked").length;
    return {
      done,
      total: activeItems.length,
      percent: activeItems.length ? Math.round((done / activeItems.length) * 100) : 0,
    };
  }, [activeItems]);

  const peopleNotOnRoster = useMemo(() => {
    if (!data) return [];
    const rostered = new Set(items.map((item) => item.person.id));
    return data.people.filter((person) => !rostered.has(person.id) && person.active);
  }, [data, items]);

  if (!data || !production) {
    return (
      <AppShell title="Production">
        {!data ? (
          <Panel className="h-40 animate-pulse bg-white/70 p-4" />
        ) : (
          <EmptyState title="Production not found" />
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
    setUpdateUsualOrder(false);
  }

  function editRoster(item: RosterOrder) {
    setEditingRosterId(item.roster.id);
    setRosterDraft(item.roster);
  }

  async function saveDraft() {
    if (!data || !editingId || saving) return;

    setSaving(true);
    setError("");
    try {
      const next = await saveOrderDraft(data, editingId, {
        ...draft,
        status: (draft.status || "confirmed") as OrderStatus,
      }, { updateUsualOrder });
      setData(next);
      setEditingId(null);
      setDraft({});
      setUpdateUsualOrder(false);
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

  async function saveRoster() {
    if (!data || !production || !editingRosterId || saving) return;

    setSaving(true);
    setError("");
    try {
      const next = await updateRosterRecord(
        data,
        activeProduction.id,
        editingRosterId,
        {
          group_label: rosterDraft.group_label || "",
          on_set_today: rosterDraft.on_set_today ?? true,
        },
      );
      setData(next);
      setEditingRosterId(null);
      setRosterDraft({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update roster.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRoster() {
    if (!data || !production || !editingRosterId || saving) return;

    setSaving(true);
    setError("");
    try {
      const next = await removeRosterRecord(
        data,
        activeProduction.id,
        editingRosterId,
      );
      setData(next);
      setEditingRosterId(null);
      setRosterDraft({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove roster member.");
    } finally {
      setSaving(false);
    }
  }

  async function quickAddPerson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !production || !quickAddForm.name.trim() || saving) return;

    setSaving(true);
    setError("");
    try {
      const next = await createPersonAndAddToRoster(
        data,
        activeProduction.id,
        quickAddForm,
        {
          linkToClientId: linkQuickAddToClient ? activeProduction.client_id : undefined,
        },
      );
      setData(next);
      setQuickAddForm(emptyPersonForm("guest"));
      setLinkQuickAddToClient(false);
      setQuickAddOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not quick add person.");
    } finally {
      setSaving(false);
    }
  }

  async function copySummary() {
    const text = plainTextCoffeeSummary(activeProduction, activeClient, activeItems);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <AppShell title={activeProduction.name}>
      <Panel className="mb-4 overflow-hidden no-print">
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate text-sm text-zinc-600">
              {[activeClient?.name, activeProduction.shoot_date, activeProduction.location]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {activeProduction.runner_name ? (
              <p className="mt-1 text-sm text-zinc-500">
                Runner: {activeProduction.runner_name}
              </p>
            ) : null}
          </div>
          <div className="rounded-xl bg-black px-3 py-2 text-right text-sm font-medium text-white">
            <span className="block text-2xl leading-none">{progress.percent}%</span>
            <span className="text-xs text-zinc-300">
              {progress.done}/{progress.total}
            </span>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-b-2xl bg-zinc-200">
          <div
            className="h-full rounded-full bg-black transition-[width]"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </Panel>

      <div className="mb-4 grid grid-cols-3 gap-2 no-print">
        <RunMetric label="On set" value={progress.total} />
        <RunMetric
          label="Confirmed"
          value={activeItems.filter((item) => item.order?.status === "confirmed").length}
        />
        <RunMetric
          label="Off set"
          value={items.filter((item) => !item.roster.on_set_today).length}
        />
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
            value={rosterStateFilter}
            onChange={(event) =>
              setRosterStateFilter(event.target.value as RosterStateFilter)
            }
            aria-label="Filter by roster state"
          >
            <option value="on_set">On set only</option>
            <option value="off_set">Off set only</option>
            <option value="all">All roster</option>
          </select>
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
        </div>
        <div className="grid grid-cols-1 gap-2">
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
              className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-medium ${
                tab === item
                  ? "bg-black text-white"
                  : "border border-zinc-300 bg-white text-zinc-700"
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
          onEditRoster={editRoster}
          onNoOrder={(order) => updateOrder(order.id, { status: "no_order" })}
          onDelivered={(order) => updateOrder(order.id, { status: "delivered" })}
        />
      ) : null}

      {tab === "Groups" ? <GroupsTab items={activeItems} /> : null}
      {tab === "Drinks" ? <DrinksTab items={activeItems} /> : null}
      {tab === "Status" ? (
        <StatusTab items={activeItems} onStatus={updateOrder} />
      ) : null}
      {tab === "Summary" ? (
        <SummaryTab
          productionName={activeProduction.name}
          clientName={activeClient?.name || ""}
          items={activeItems}
          summary={plainTextCoffeeSummary(activeProduction, activeClient, activeItems)}
          copied={copied}
          onCopy={copySummary}
        />
      ) : null}

      <Panel className="mt-4 p-4 no-print">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Add to roster</h2>
          <button
            type="button"
            onClick={() => {
              setQuickAddForm(emptyPersonForm("guest"));
              setLinkQuickAddToClient(false);
              setQuickAddOpen(true);
            }}
            className={secondaryButtonClass}
          >
            <Plus size={18} aria-hidden="true" />
            New guest
          </button>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
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
          updateUsualOrder={updateUsualOrder}
          onChange={setDraft}
          onUpdateUsualOrder={setUpdateUsualOrder}
          onCancel={() => {
            setEditingId(null);
            setDraft({});
            setUpdateUsualOrder(false);
          }}
          onSave={saveDraft}
          saving={saving}
        />
      ) : null}

      {editingRosterId ? (
        <RosterEditor
          draft={rosterDraft}
          onChange={setRosterDraft}
          onCancel={() => {
            setEditingRosterId(null);
            setRosterDraft({});
          }}
          onRemove={removeRoster}
          onSave={saveRoster}
          saving={saving}
        />
      ) : null}

      {quickAddOpen ? (
        <QuickAddPersonSheet
          form={quickAddForm}
          clientName={activeClient?.name || "this client"}
          linkToClient={linkQuickAddToClient}
          onChange={setQuickAddForm}
          onLinkToClientChange={setLinkQuickAddToClient}
          onCancel={() => {
            setQuickAddOpen(false);
            setQuickAddForm(emptyPersonForm("guest"));
            setLinkQuickAddToClient(false);
          }}
          onSubmit={quickAddPerson}
          saving={saving}
        />
      ) : null}
    </AppShell>
  );
}

function RunMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm shadow-black/5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-none text-black">{value}</p>
    </div>
  );
}

function PeopleTab({
  items,
  onConfirm,
  onEdit,
  onEditRoster,
  onNoOrder,
  onDelivered,
}: {
  items: RosterOrder[];
  onConfirm: (item: RosterOrder) => void;
  onEdit: (order: Order) => void;
  onEditRoster: (item: RosterOrder) => void;
  onNoOrder: (order: Order) => void;
  onDelivered: (order: Order) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 no-print">
      {!items.length ? (
        <EmptyState title="No matching people" description="Try another search or filter." />
      ) : null}
      {items.map((item) => {
        if (!item.order) return null;

        return (
          <article key={item.roster.id} className={cardClass}>
            <div className="flex gap-3">
              <Avatar person={item.person} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">{item.person.name}</h2>
                    <p className="truncate text-sm text-zinc-600">
                      {[item.person.role, item.roster.group_label || item.person.department]
                        .filter(Boolean)
                        .join(" / ")}
                    </p>
                  </div>
                  <div className="grid shrink-0 justify-items-end gap-1">
                    <StatusChip status={item.order.status} />
                    {!item.roster.on_set_today ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                        Off set
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm">
                  <p className="rounded-xl bg-zinc-100 p-3 leading-5 text-zinc-700">
                    <span className="block text-xs font-medium text-zinc-500">Usual</span>
                    {item.person.usual_order || "—"}
                  </p>
                  <p className="rounded-xl border border-zinc-200 bg-white p-3 leading-5 text-zinc-800">
                    <span className="block text-xs font-medium text-zinc-500">Today</span>
                    {formatDrink(item.order)}
                  </p>
                </div>
              </div>
            </div>
            {!item.roster.on_set_today ? (
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => onEditRoster(item)}
                  className={secondaryButtonClass}
                >
                  <Pencil size={18} aria-hidden="true" />
                  Edit roster
                </button>
              </div>
            ) : (
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
                <button
                  type="button"
                  onClick={() => onEditRoster(item)}
                  className={`${secondaryButtonClass} col-span-2`}
                >
                  <Pencil size={18} aria-hidden="true" />
                  Edit roster
                </button>
              </div>
            )}
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
        <section key={group} className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{group}</h2>
            <span className="text-sm text-zinc-500">{groupItems.length}</span>
          </div>
          <div className="mt-3 grid gap-2">
            {groupItems.map((item) => (
              <div
                key={item.roster.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-zinc-100 p-3"
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
        <EmptyState title="No drinks yet" description="Confirm orders to build the count." />
      ) : null}
      {drinks.map((drink) => (
        <article key={drink.order} className={cardClass}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold leading-6">{drink.order}</h2>
            <span className="rounded-full bg-black px-3 py-1 text-sm font-medium text-white">
              {drink.count}×
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
          <section key={status} className={cardClass}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{statusLabels[status]}</h2>
              <span className="text-sm text-zinc-500">{statusItems.length}</span>
            </div>
            <div className="mt-3 grid gap-2">
              {statusItems.map((item) => (
                <div key={item.roster.id} className="grid gap-2 rounded-xl bg-zinc-100 p-3">
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
          <h2 className="text-lg font-semibold">Summary</h2>
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
              <div className="m2-label-mark">
                <CaptureAngle />
              </div>
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
  updateUsualOrder,
  onChange,
  onUpdateUsualOrder,
  onCancel,
  onSave,
  saving,
}: {
  draft: Partial<Order>;
  updateUsualOrder: boolean;
  onChange: (draft: Partial<Order>) => void;
  onUpdateUsualOrder: (value: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid items-end bg-black/55 p-3 no-print">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Edit order"
        className="mx-auto grid max-h-[90dvh] w-full max-w-xl gap-3 overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-5 shadow-2xl"
      >
        <h2 className="text-lg font-semibold">Edit order</h2>
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
        <label className="flex min-h-11 items-start gap-3 rounded-xl border border-zinc-300 p-3 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={updateUsualOrder}
            onChange={(event) => onUpdateUsualOrder(event.target.checked)}
            className="mt-0.5 size-4 accent-black"
          />
          <span>
            <span className="block font-semibold text-black">Save as usual order</span>
            <span className="text-zinc-600">
              Leave off for a one-day exception.
            </span>
          </span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className={primaryButtonClass}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save order"}
          </button>
        </div>
      </section>
    </div>
  );
}

function RosterEditor({
  draft,
  onChange,
  onCancel,
  onRemove,
  onSave,
  saving,
}: {
  draft: Partial<ProductionRoster>;
  onChange: (draft: Partial<ProductionRoster>) => void;
  onCancel: () => void;
  onRemove: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid items-end bg-black/55 p-3 no-print">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Edit roster"
        className="mx-auto grid max-h-[90dvh] w-full max-w-xl gap-3 overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-5 shadow-2xl"
      >
        <h2 className="text-lg font-semibold">Edit roster</h2>
        <Field label="Production group">
          <input
            className={inputClass}
            list="roster-group-suggestions"
            value={draft.group_label || ""}
            onChange={(event) =>
              onChange({ ...draft, group_label: event.target.value })
            }
            placeholder="Client, Camera, HMU"
            autoFocus
          />
        </Field>
        <label className="flex min-h-11 items-start gap-3 rounded-xl border border-zinc-300 p-3 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={draft.on_set_today ?? true}
            onChange={(event) =>
              onChange({ ...draft, on_set_today: event.target.checked })
            }
            className="mt-0.5 size-4 accent-black"
          />
          <span>
            <span className="block font-semibold text-black">On set today</span>
            <span className="text-zinc-600">
              Turn off to keep them out of coffee ordering and summaries.
            </span>
          </span>
        </label>
        <button
          type="button"
          onClick={onRemove}
          className={dangerButtonClass}
          disabled={saving}
        >
          <Trash2 size={18} aria-hidden="true" />
          Remove from this production
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className={primaryButtonClass}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save roster"}
          </button>
        </div>
        <datalist id="roster-group-suggestions">
          {groupSuggestions.map((group) => (
            <option key={group} value={group} />
          ))}
        </datalist>
      </section>
    </div>
  );
}

function QuickAddPersonSheet({
  form,
  clientName,
  linkToClient,
  onChange,
  onLinkToClientChange,
  onCancel,
  onSubmit,
  saving,
}: {
  form: PersonForm;
  clientName: string;
  linkToClient: boolean;
  onChange: (form: PersonForm) => void;
  onLinkToClientChange: (value: boolean) => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  const canLinkToClient = form.type === "client_contact" || form.type === "agency";

  return (
    <div className="fixed inset-0 z-50 grid items-end bg-black/55 p-3 no-print">
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="Quick add person"
        className="mx-auto grid max-h-[90dvh] w-full max-w-xl gap-3 overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-5 shadow-2xl"
      >
        <h2 className="text-lg font-semibold">Quick add person</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              placeholder="Name"
              autoFocus
            />
          </Field>
          <Field label="Type">
            <select
              className={inputClass}
              value={form.type}
              onChange={(event) => {
                const type = event.target.value as PersonForm["type"];
                onChange({ ...form, type });
                onLinkToClientChange(type === "client_contact" || type === "agency");
              }}
            >
              {personTypes.map((type) => (
                <option key={type} value={type}>
                  {personTypeLabel(type)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Role">
            <input
              className={inputClass}
              value={form.role}
              onChange={(event) => onChange({ ...form, role: event.target.value })}
              placeholder="Producer, talent"
            />
          </Field>
          <Field label="Department/group">
            <input
              className={inputClass}
              list="quick-add-group-suggestions"
              value={form.department}
              onChange={(event) =>
                onChange({ ...form, department: event.target.value })
              }
              placeholder="Client, Camera"
            />
          </Field>
        </div>
        <Field label="Company">
          <input
            className={inputClass}
            value={form.company}
            onChange={(event) => onChange({ ...form, company: event.target.value })}
            placeholder="Company"
          />
        </Field>
        <Field label="Photo URL">
          <input
            className={inputClass}
            value={form.photo_url}
            onChange={(event) =>
              onChange({ ...form, photo_url: event.target.value })
            }
            placeholder="https://..."
          />
        </Field>
        <Field label="Usual order">
          <input
            className={inputClass}
            value={form.usual_order}
            onChange={(event) =>
              onChange({ ...form, usual_order: event.target.value })
            }
            placeholder="Iced oat latte, medium"
          />
        </Field>
        <Field label="Dietary notes">
          <input
            className={inputClass}
            value={form.dietary_notes}
            onChange={(event) =>
              onChange({ ...form, dietary_notes: event.target.value })
            }
            placeholder="Oat milk, no dairy"
          />
        </Field>
        <Field label="Notes">
          <textarea
            className={`${inputClass} min-h-20 py-3`}
            value={form.notes}
            onChange={(event) => onChange({ ...form, notes: event.target.value })}
            placeholder="Where to find them or identifying details"
          />
        </Field>
        {canLinkToClient ? (
          <label className="flex min-h-11 items-start gap-3 rounded-xl border border-zinc-300 p-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={linkToClient}
              onChange={(event) => onLinkToClientChange(event.target.checked)}
              className="mt-0.5 size-4 accent-black"
            />
            <span>
              <span className="block font-semibold text-black">
                Link to {clientName}
              </span>
              <span className="text-zinc-600">
                Include them automatically on future productions for this client.
              </span>
            </span>
          </label>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={saving || !form.name.trim()}
          >
            {saving ? "Saving…" : "Add to production"}
          </button>
        </div>
        <datalist id="quick-add-group-suggestions">
          {groupSuggestions.map((group) => (
            <option key={group} value={group} />
          ))}
        </datalist>
      </form>
    </div>
  );
}
