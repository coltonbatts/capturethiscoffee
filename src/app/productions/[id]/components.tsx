"use client";

import {
  Ban,
  Check,
  ChevronRight,
  Clipboard,
  Copy,
  PackageCheck,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CaptureAngle } from "@/components/capture-mark";
import { PersonPhotoField } from "@/components/person-photo-field";
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
  buildCoffeeLabels,
  defaultLabelFields,
  labelToText,
  labelsToText,
  type CoffeeLabel,
  type LabelContentStyle,
  type LabelFieldOptions,
} from "@/lib/label-copy";
import {
  byPersonSummary,
  formatDrink,
  groupedByDrinkSummary,
} from "@/lib/order-summary";
import { probeNiimbotBluetooth } from "@/lib/niimbot-web-bluetooth";
import {
  groupSuggestions,
  personTypeLabel,
  personTypes,
  type PersonForm,
} from "@/lib/people";
import type {
  Order,
  OrderStatus,
  Production,
  ProductionRoster,
  RosterOrder,
} from "@/lib/types";
import { groupLabelFor, type RosterStateFilter } from "./use-roster-view";

export const statuses = Object.keys(statusLabels) as OrderStatus[];
export const tabs = [
  "People",
  "Groups",
  "Drinks",
  "Status",
  "Summary",
  "Labels",
] as const;
export type Tab = (typeof tabs)[number];

/**
 * The next forward step in a runner's loop. A single primary tap walks an
 * order not_asked → confirmed → ordered → picked_up → delivered, so the two
 * middle states (which used to be reachable only through the Status-tab
 * dropdown) are now one thumb-tap away at the counter and at hand-off.
 */
const nextStep: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> =
  {
    not_asked: { status: "confirmed", label: "Confirm" },
    confirmed: { status: "ordered", label: "Mark ordered" },
    ordered: { status: "picked_up", label: "Mark picked up" },
    picked_up: { status: "delivered", label: "Mark delivered" },
  };

export function ErrorToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-3 md:bottom-4 no-print">
      <div className="flex w-full max-w-md items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800 shadow-lg shadow-black/10">
        <span className="min-w-0 flex-1">{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="grid size-6 shrink-0 place-items-center rounded-lg text-red-700 hover:bg-red-100"
          aria-label="Dismiss"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function RunnerHeader({
  detail,
  runnerName,
  progress,
  onEditDetails,
}: {
  detail: string;
  runnerName?: string;
  progress: { percent: number; responded: number; total: number };
  onEditDetails: () => void;
}) {
  return (
    <Panel className="mb-4 overflow-hidden no-print">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-sm text-zinc-600">{detail}</p>
          {runnerName ? (
            <p className="mt-1 text-sm text-zinc-500">Runner: {runnerName}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <button
            type="button"
            onClick={onEditDetails}
            className="grid size-11 place-items-center rounded-xl border border-zinc-300 bg-white text-black hover:bg-zinc-50"
            aria-label="Edit production details"
          >
            <Pencil size={18} aria-hidden="true" />
          </button>
          <div className="rounded-xl bg-black px-3 py-2 text-right text-sm font-medium text-white">
            <span className="block text-2xl leading-none">{progress.percent}%</span>
            <span className="text-xs text-zinc-300">
              {progress.responded}/{progress.total} asked
            </span>
          </div>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-b-2xl bg-zinc-200">
        <div
          className="h-full rounded-full bg-black transition-[width]"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </Panel>
  );
}

export function RunMetrics({
  total,
  delivered,
  offSet,
}: {
  total: number;
  delivered: number;
  offSet: number;
}) {
  return (
    <div className="mb-4 grid grid-cols-3 gap-2 no-print">
      <RunMetric label="On set" value={total} />
      <RunMetric label="Delivered" value={delivered} />
      <RunMetric label="Off set" value={offSet} />
    </div>
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

export function FilterBar({
  query,
  onQuery,
  rosterStateFilter,
  onRosterState,
  groupFilter,
  onGroup,
  statusFilter,
  onStatus,
  groups,
  tab,
  onTab,
}: {
  query: string;
  onQuery: (value: string) => void;
  rosterStateFilter: RosterStateFilter;
  onRosterState: (value: RosterStateFilter) => void;
  groupFilter: string;
  onGroup: (value: string) => void;
  statusFilter: OrderStatus | "all";
  onStatus: (value: OrderStatus | "all") => void;
  groups: string[];
  tab: Tab;
  onTab: (value: Tab) => void;
}) {
  return (
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
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search by name, role, drink"
          aria-label="Search roster"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <select
          className={inputClass}
          value={rosterStateFilter}
          onChange={(event) => onRosterState(event.target.value as RosterStateFilter)}
          aria-label="Filter by roster state"
        >
          <option value="on_set">On set only</option>
          <option value="off_set">Off set only</option>
          <option value="all">All roster</option>
        </select>
        <select
          className={inputClass}
          value={groupFilter}
          onChange={(event) => onGroup(event.target.value)}
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
      <select
        className={inputClass}
        value={statusFilter}
        onChange={(event) => onStatus(event.target.value as OrderStatus | "all")}
        aria-label="Filter by status"
      >
        <option value="all">All statuses</option>
        {statuses.map((status) => (
          <option key={status} value={status}>
            {statusLabels[status]}
          </option>
        ))}
      </select>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onTab(item)}
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
  );
}

export function PeopleTab({
  items,
  pendingOrders,
  onAdvance,
  onEdit,
  onEditRoster,
  onNoOrder,
  onDelivered,
}: {
  items: RosterOrder[];
  pendingOrders: ReadonlySet<string>;
  onAdvance: (order: Order, status: OrderStatus) => void;
  onEdit: (order: Order) => void;
  onEditRoster: (item: RosterOrder) => void;
  onNoOrder: (order: Order) => void;
  onDelivered: (order: Order) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 no-print">
      {!items.length ? (
        <EmptyState
          title="No matching people"
          description="Try another search or filter."
        />
      ) : null}
      {items.map((item) => (
        <RosterCard
          key={item.roster.id}
          item={item}
          pending={item.order ? pendingOrders.has(item.order.id) : false}
          onAdvance={onAdvance}
          onEdit={onEdit}
          onEditRoster={onEditRoster}
          onNoOrder={onNoOrder}
          onDelivered={onDelivered}
        />
      ))}
    </div>
  );
}

function RosterCard({
  item,
  pending,
  onAdvance,
  onEdit,
  onEditRoster,
  onNoOrder,
  onDelivered,
}: {
  item: RosterOrder;
  pending: boolean;
  onAdvance: (order: Order, status: OrderStatus) => void;
  onEdit: (order: Order) => void;
  onEditRoster: (item: RosterOrder) => void;
  onNoOrder: (order: Order) => void;
  onDelivered: (order: Order) => void;
}) {
  const { order, roster, person } = item;
  const onSet = roster.on_set_today;

  return (
    <article className={cardClass} aria-busy={pending}>
      <div className={`flex gap-3 ${pending ? "opacity-60" : ""}`}>
        <Avatar person={person} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{person.name}</h2>
              <p className="truncate text-sm text-zinc-600">
                {[person.role, roster.group_label || person.department]
                  .filter(Boolean)
                  .join(" / ")}
              </p>
            </div>
            <div className="grid shrink-0 justify-items-end gap-1">
              {order ? <StatusChip status={order.status} /> : null}
              {!onSet ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                  Off set
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-sm">
            <p className="rounded-xl bg-zinc-100 p-3 leading-5 text-zinc-700">
              <span className="block text-xs font-medium text-zinc-500">Usual</span>
              {person.usual_order || "—"}
            </p>
            <p className="rounded-xl border border-zinc-200 bg-white p-3 leading-5 text-zinc-800">
              <span className="block text-xs font-medium text-zinc-500">Today</span>
              {formatDrink(order)}
            </p>
          </div>
        </div>
      </div>

      {!order ? (
        // Partial data: roster row exists but its order never landed. Surface
        // it instead of silently rendering nothing (the old `return null`).
        <div className="mt-3 grid gap-2">
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
            No order record yet. Remove and re-add this person to rebuild it.
          </p>
          <button
            type="button"
            onClick={() => onEditRoster(item)}
            className={secondaryButtonClass}
          >
            <Pencil size={18} aria-hidden="true" />
            Edit roster
          </button>
        </div>
      ) : !onSet ? (
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
        <CardActions
          order={order}
          pending={pending}
          onAdvance={onAdvance}
          onEdit={onEdit}
          onEditRoster={() => onEditRoster(item)}
          onNoOrder={onNoOrder}
          onDelivered={onDelivered}
        />
      )}
    </article>
  );
}

function CardActions({
  order,
  pending,
  onAdvance,
  onEdit,
  onEditRoster,
  onNoOrder,
  onDelivered,
}: {
  order: Order;
  pending: boolean;
  onAdvance: (order: Order, status: OrderStatus) => void;
  onEdit: (order: Order) => void;
  onEditRoster: () => void;
  onNoOrder: (order: Order) => void;
  onDelivered: (order: Order) => void;
}) {
  const step = nextStep[order.status];
  const isTerminal = order.status === "delivered" || order.status === "no_order";

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {step ? (
        <button
          type="button"
          onClick={() => onAdvance(order, step.status)}
          disabled={pending}
          className={`${buttonClass} col-span-2 bg-black text-white`}
        >
          {order.status === "not_asked" ? (
            <Check size={18} aria-hidden="true" />
          ) : (
            <ChevronRight size={18} aria-hidden="true" />
          )}
          {step.label}
        </button>
      ) : (
        <div className="col-span-2 grid min-h-11 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-950">
          {statusLabels[order.status]}
        </div>
      )}

      {!isTerminal ? (
        <button
          type="button"
          onClick={() => onNoOrder(order)}
          disabled={pending}
          className={dangerButtonClass}
        >
          <Ban size={18} aria-hidden="true" />
          No order
        </button>
      ) : null}
      {!isTerminal && order.status !== "picked_up" ? (
        <button
          type="button"
          onClick={() => onDelivered(order)}
          disabled={pending}
          className={`${buttonClass} bg-zinc-800 text-white`}
        >
          <PackageCheck size={18} aria-hidden="true" />
          Delivered
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onEdit(order)}
        disabled={pending}
        className={secondaryButtonClass}
      >
        <Pencil size={18} aria-hidden="true" />
        Edit order
      </button>
      <button
        type="button"
        onClick={onEditRoster}
        className={`${secondaryButtonClass} ${
          isTerminal || order.status === "picked_up" ? "" : "col-span-2"
        }`}
      >
        <Pencil size={18} aria-hidden="true" />
        Edit roster
      </button>
    </div>
  );
}

export function GroupsTab({ items }: { items: RosterOrder[] }) {
  const groups = Array.from(
    items.reduce((map, item) => {
      const key = groupLabelFor(item);
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

export function DrinksTab({ items }: { items: RosterOrder[] }) {
  const drinks = groupedByDrinkSummary(items);

  return (
    <div className="grid gap-3 no-print">
      {!drinks.length ? (
        <EmptyState
          title="No drinks yet"
          description="Confirm orders to build the count."
        />
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

export function StatusTab({
  items,
  pendingOrders,
  onStatus,
}: {
  items: RosterOrder[];
  pendingOrders: ReadonlySet<string>;
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
                <div
                  key={item.roster.id}
                  className="grid gap-2 rounded-xl bg-zinc-100 p-3"
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
                      disabled={pendingOrders.has(item.order.id)}
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

export function SummaryTab({
  productionName,
  clientName,
  summary,
  items,
  copied,
  onCopy,
}: {
  productionName: string;
  clientName: string;
  summary: string;
  items: RosterOrder[];
  copied: boolean;
  onCopy: () => void;
}) {
  const byPerson = byPersonSummary(items);
  const [printerProbe, setPrinterProbe] = useState("");
  const [checkingPrinter, setCheckingPrinter] = useState(false);

  async function checkPrinter() {
    if (checkingPrinter) return;
    setCheckingPrinter(true);
    setPrinterProbe("");
    const result = await probeNiimbotBluetooth();
    setPrinterProbe(
      [
        result.ok ? "M2 check passed." : "M2 check did not complete.",
        result.deviceName ? `Device: ${result.deviceName}.` : "",
        result.characteristicUuid ? `Characteristic: ${result.characteristicUuid}.` : "",
        result.message,
      ]
        .filter(Boolean)
        .join(" "),
    );
    setCheckingPrinter(false);
  }

  return (
    <>
      <Panel className="grid gap-3 p-4 no-print">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Summary</h2>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={checkPrinter}
              className={secondaryButtonClass}
              disabled={checkingPrinter}
            >
              <Printer size={18} aria-hidden="true" />
              {checkingPrinter ? "Checking..." : "Experimental M2 check"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className={secondaryButtonClass}
            >
              <Printer size={18} aria-hidden="true" />
              Print labels
            </button>
          </div>
        </div>
        {printerProbe ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium leading-6 text-zinc-700">
            {printerProbe}
          </div>
        ) : null}
        <PrinterCalibrationChecklist />
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
            <article key={`${item.name}-${item.order}`} className="m2-label">
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

export function LabelsTab({
  productionName,
  clientName,
  items,
  onCopyError,
}: {
  productionName: string;
  clientName: string;
  items: RosterOrder[];
  onCopyError: (message: string) => void;
}) {
  const [style, setStyle] = useState<LabelContentStyle>("standard");
  const [fields, setFields] = useState<LabelFieldOptions>(defaultLabelFields);
  const [copiedLabelId, setCopiedLabelId] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);
  const options = useMemo(() => ({ style, fields }), [style, fields]);
  const labels = useMemo(
    () =>
      buildCoffeeLabels(
        { name: productionName },
        clientName ? { name: clientName } : undefined,
        items,
        options,
      ),
    [clientName, items, options, productionName],
  );

  function toggleField(field: keyof LabelFieldOptions) {
    setFields((current) => ({ ...current, [field]: !current[field] }));
  }

  async function copyLabel(label: CoffeeLabel) {
    try {
      await navigator.clipboard.writeText(labelToText(label, options));
      setCopiedLabelId(label.id);
      window.setTimeout(() => setCopiedLabelId(""), 1400);
    } catch {
      onCopyError("Couldn't copy automatically - select the label text to copy it.");
    }
  }

  async function copyAllLabels() {
    try {
      await navigator.clipboard.writeText(labelsToText(labels, options));
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1400);
    } catch {
      onCopyError("Couldn't copy automatically - select the label text to copy it.");
    }
  }

  return (
    <>
      <div className="grid gap-4 no-print">
        <Panel className="grid gap-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Labels</h2>
              <p className="mt-1 text-sm text-zinc-600">
                {labels.length} printable {labels.length === 1 ? "label" : "labels"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={copyAllLabels}
                className={secondaryButtonClass}
                disabled={!labels.length}
              >
                <Clipboard size={18} aria-hidden="true" />
                {copiedAll ? "Copied" : "Copy all"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className={secondaryButtonClass}
                disabled={!labels.length}
              >
                <Printer size={18} aria-hidden="true" />
                Print labels
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
            <Field label="Content style">
              <select
                className={inputClass}
                value={style}
                onChange={(event) =>
                  setStyle(event.target.value as LabelContentStyle)
                }
              >
                <option value="compact">Compact</option>
                <option value="standard">Standard</option>
                <option value="detailed">Detailed</option>
              </select>
            </Field>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium text-zinc-600">
                Fields on label
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <LabelFieldToggle
                  label="Name"
                  checked={fields.personName}
                  onChange={() => toggleField("personName")}
                />
                <LabelFieldToggle
                  label="Drink"
                  checked={fields.drink}
                  onChange={() => toggleField("drink")}
                />
                <LabelFieldToggle
                  label="Group"
                  checked={fields.group}
                  onChange={() => toggleField("group")}
                />
                <LabelFieldToggle
                  label="Production"
                  checked={fields.productionClient}
                  onChange={() => toggleField("productionClient")}
                />
                <LabelFieldToggle
                  label="Notes/status"
                  checked={fields.notesStatus}
                  onChange={() => toggleField("notesStatus")}
                />
              </div>
            </fieldset>
          </div>
        </Panel>

        <PrinterCalibrationChecklist />

        {!labels.length ? (
          <EmptyState
            title="No labels ready"
            description="Labels appear for on-set people whose order is not marked No order."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {labels.map((label) => (
              <LabelPreviewCard
                key={label.id}
                label={label}
                copied={copiedLabelId === label.id}
                onCopy={() => copyLabel(label)}
              />
            ))}
          </div>
        )}
      </div>

      <section className="print-only hidden">
        <div className="m2-label-sheet">
          {labels.map((label) => (
            <PrintableLabel key={label.id} label={label} />
          ))}
        </div>
      </section>
    </>
  );
}

function PrinterCalibrationChecklist() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium leading-6 text-zinc-700">
      <p className="font-bold text-black">Browser print setup</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>Label stock: 50mm x 30mm.</li>
        <li>Orientation: landscape if the driver asks.</li>
        <li>Scale: 100%, not fit to page.</li>
        <li>Margins: none; default only if none clips.</li>
        <li>Increase density if text is faint; adjust driver alignment if shifted.</li>
      </ul>
      <p className="mt-2 text-xs font-semibold uppercase tracking-normal text-zinc-500">
        NIIMBOT Bluetooth is an experimental check only.
      </p>
    </div>
  );
}

function LabelFieldToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 accent-black"
      />
      <span className="min-w-0 truncate">{label}</span>
    </label>
  );
}

function LabelPreviewCard({
  label,
  copied,
  onCopy,
}: {
  label: CoffeeLabel;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <article className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{label.personName}</h3>
          <p className="truncate text-sm text-zinc-600">{label.group}</p>
        </div>
        <button type="button" onClick={onCopy} className={secondaryButtonClass}>
          <Copy size={18} aria-hidden="true" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl bg-zinc-100 p-3">
        <div className="grid aspect-[5/3] w-[260px] grid-cols-[42px_1fr] grid-rows-[auto_1fr_auto] gap-x-2 overflow-hidden border-2 border-black bg-white p-3 font-sans text-black shadow-sm">
          <div className="row-span-2 grid size-9 place-items-center border-2 border-black p-1">
            <CaptureAngle />
          </div>
          <h4 className="truncate text-lg font-black leading-none">
            {label.title || label.personName}
          </h4>
          <p className="mt-1 overflow-hidden text-sm font-bold leading-tight">
            {label.bodyLines.join(" / ") || label.drink}
          </p>
          <div className="col-span-2 flex items-end justify-between gap-2 border-t border-black pt-2 text-[11px] font-bold leading-none">
            <span className="min-w-0 truncate">
              {label.footerStart}
            </span>
            <span className="min-w-0 truncate">{label.footerEnd}</span>
          </div>
        </div>
      </div>

      <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-3 font-mono text-xs leading-5 text-zinc-700">
        {label.lines.join("\n")}
      </pre>
    </article>
  );
}

function PrintableLabel({ label }: { label: CoffeeLabel }) {
  const main = label.title || label.personName;
  const body = label.bodyLines.join(" / ") || label.drink;

  return (
    <article className="m2-label">
      <div className="m2-label-mark">
        <CaptureAngle />
      </div>
      <h2>{main}</h2>
      <p className="m2-label-order">{body}</p>
      <div className="m2-label-footer">
        <span>{label.footerStart}</span>
        <span>{label.footerEnd}</span>
      </div>
    </article>
  );
}

export function AddToRoster({
  people,
  value,
  onChange,
  onAdd,
  onNewGuest,
  saving,
}: {
  people: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  onNewGuest: () => void;
  saving: boolean;
}) {
  return (
    <Panel className="mt-4 p-4 no-print">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Add to roster</h2>
        <button type="button" onClick={onNewGuest} className={secondaryButtonClass}>
          <Plus size={18} aria-hidden="true" />
          New guest
        </button>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <select
          className={inputClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Add person to production roster"
        >
          <option value="">Choose person</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onAdd}
          className={primaryButtonClass}
          disabled={!value || saving}
          aria-label="Add selected person"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
    </Panel>
  );
}

function Sheet({
  label,
  children,
  asForm,
  onSubmit,
}: {
  label: string;
  children: ReactNode;
  asForm?: boolean;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const className =
    "mx-auto grid max-h-[90dvh] w-full max-w-xl gap-3 overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-5 shadow-2xl";

  return (
    <div className="fixed inset-0 z-50 grid items-end bg-black/55 p-3 no-print">
      {asForm ? (
        <form
          onSubmit={onSubmit}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className={className}
        >
          {children}
        </form>
      ) : (
        <section
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className={className}
        >
          {children}
        </section>
      )}
    </div>
  );
}

export function OrderEditor({
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
    <Sheet label="Edit order">
      <h2 className="text-lg font-semibold">Edit order</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Drink">
          <input
            className={inputClass}
            value={draft.drink_type || ""}
            onChange={(event) => onChange({ ...draft, drink_type: event.target.value })}
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
            onChange={(event) => onChange({ ...draft, temperature: event.target.value })}
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
            onChange={(event) => onChange({ ...draft, milk_type: event.target.value })}
            placeholder="Oat, almond, whole"
          />
        </Field>
        <Field label="Sweetener">
          <input
            className={inputClass}
            value={draft.sweetener || ""}
            onChange={(event) => onChange({ ...draft, sweetener: event.target.value })}
            placeholder="Half sweet, vanilla"
          />
        </Field>
        <Field label="Caffeine">
          <select
            className={inputClass}
            value={draft.caffeine || "Regular"}
            onChange={(event) => onChange({ ...draft, caffeine: event.target.value })}
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
          onChange={(event) => onChange({ ...draft, special_notes: event.target.value })}
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
          <span className="text-zinc-600">Leave off for a one-day exception.</span>
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
    </Sheet>
  );
}

export function ProductionDetailsEditor({
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  draft: Pick<
    Production,
    "name" | "shoot_date" | "location" | "runner_name" | "notes"
  >;
  onChange: (
    draft: Pick<
      Production,
      "name" | "shoot_date" | "location" | "runner_name" | "notes"
    >,
  ) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Sheet label="Edit production details">
      <h2 className="text-lg font-semibold">Edit production</h2>
      <Field label="Production name">
        <input
          className={inputClass}
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          autoFocus
          required
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Shoot date">
          <input
            className={inputClass}
            type="date"
            value={draft.shoot_date}
            onChange={(event) =>
              onChange({ ...draft, shoot_date: event.target.value })
            }
          />
        </Field>
        <Field label="Runner">
          <input
            className={inputClass}
            value={draft.runner_name}
            onChange={(event) =>
              onChange({ ...draft, runner_name: event.target.value })
            }
            placeholder="Runner name"
          />
        </Field>
      </div>
      <Field label="Location">
        <input
          className={inputClass}
          value={draft.location}
          onChange={(event) => onChange({ ...draft, location: event.target.value })}
          placeholder="Studio or address"
        />
      </Field>
      <Field label="Notes">
        <textarea
          className={`${inputClass} min-h-24 py-3`}
          value={draft.notes}
          onChange={(event) => onChange({ ...draft, notes: event.target.value })}
          placeholder="Call time, coffee shop, handoff"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className={primaryButtonClass}
          disabled={saving || !draft.name.trim()}
        >
          {saving ? "Saving..." : "Save production"}
        </button>
      </div>
    </Sheet>
  );
}

export function RosterEditor({
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
    <Sheet label="Edit roster">
      <h2 className="text-lg font-semibold">Edit roster</h2>
      <Field label="Production group">
        <input
          className={inputClass}
          list="roster-group-suggestions"
          value={draft.group_label || ""}
          onChange={(event) => onChange({ ...draft, group_label: event.target.value })}
          placeholder="Client, Camera, HMU"
          autoFocus
        />
      </Field>
      <label className="flex min-h-11 items-start gap-3 rounded-xl border border-zinc-300 p-3 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={draft.on_set_today ?? true}
          onChange={(event) => onChange({ ...draft, on_set_today: event.target.checked })}
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
    </Sheet>
  );
}

export function QuickAddPersonSheet({
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
    <Sheet label="Quick add person" asForm onSubmit={onSubmit}>
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
            onChange={(event) => onChange({ ...form, department: event.target.value })}
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
      <PersonPhotoField
        value={form.photo_url}
        personName={form.name}
        onChange={(photo_url) => onChange({ ...form, photo_url })}
      />
      <Field label="Usual order">
        <input
          className={inputClass}
          value={form.usual_order}
          onChange={(event) => onChange({ ...form, usual_order: event.target.value })}
          placeholder="Iced oat latte, medium"
        />
      </Field>
      <Field label="Dietary notes">
        <input
          className={inputClass}
          value={form.dietary_notes}
          onChange={(event) => onChange({ ...form, dietary_notes: event.target.value })}
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
            <span className="block font-semibold text-black">Link to {clientName}</span>
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
    </Sheet>
  );
}
