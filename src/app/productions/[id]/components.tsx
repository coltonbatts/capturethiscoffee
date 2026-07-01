"use client";

import {
  Check,
  ChevronRight,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PersonPhotoField } from "@/components/person-photo-field";
import {
  Avatar,
  CountBadge,
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
  statusRailStyles,
} from "@/components/ui";
import { formatDrink } from "@/lib/order-summary";
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

export const statuses = Object.keys(statusLabels) as OrderStatus[];

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

const previousStep: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> =
  {
    confirmed: { status: "not_asked", label: "Back to not asked" },
    ordered: { status: "confirmed", label: "Back to confirmed" },
    picked_up: { status: "ordered", label: "Back to ordered" },
    delivered: { status: "picked_up", label: "Reopen delivery" },
    no_order: { status: "confirmed", label: "Reopen order" },
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
      <div className="flex w-full max-w-md items-start gap-3 rounded-lg border border-red-700 bg-white p-3 text-sm font-bold text-red-700">
        <span className="min-w-0 flex-1">{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="grid size-6 shrink-0 place-items-center rounded-lg text-red-700 hover:bg-red-50"
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
  statusCounts,
  onEditDetails,
}: {
  detail: string;
  runnerName?: string;
  progress: { percent: number; responded: number; total: number };
  statusCounts?: Partial<Record<OrderStatus, number>>;
  onEditDetails?: () => void;
}) {
  return (
    <section className="rule-double mb-4 pb-4 no-print">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-normal text-zinc-500">
            Live board
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-zinc-700">
            {detail || "Coffee orders"}
          </p>
          {runnerName ? (
            <p className="mt-0.5 text-sm text-zinc-500">Runner: {runnerName}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {onEditDetails ? (
            <button
              type="button"
              onClick={onEditDetails}
              className="grid size-11 place-items-center rounded-lg border border-zinc-500 bg-white text-black hover:border-black hover:bg-zinc-100"
              aria-label="Edit production details"
            >
              <Pencil size={18} aria-hidden="true" />
            </button>
          ) : null}
          <div className="text-right leading-none">
            <span className="block text-3xl font-black tabular-nums text-black">
              {progress.percent}
              <span className="text-lg">%</span>
            </span>
            <span className="mt-1 block text-xs font-bold uppercase tracking-normal text-zinc-500">
              {progress.responded}/{progress.total} asked
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-sm bg-zinc-200">
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      {statusCounts ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {statuses.map((status) =>
            statusCounts[status] ? (
              <CountBadge
                key={status}
                label={statusLabels[status]}
                count={statusCounts[status]!}
                accent={status === "ordered"}
              />
            ) : null,
          )}
        </div>
      ) : null}
    </section>
  );
}

export function SearchRoster({
  query,
  onQuery,
  count,
  total,
}: {
  query: string;
  onQuery: (value: string) => void;
  count: number;
  total: number;
}) {
  return (
    <div className="mb-4 grid gap-2 no-print">
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
          placeholder="Search people"
          aria-label="Search roster"
        />
      </label>
      <div className="text-sm text-zinc-600">
        {query.trim() ? `${count} of ${total} people` : `${total} people on set`}
      </div>
    </div>
  );
}

export function PeopleTab({
  items,
  pendingOrders,
  canManageSetup,
  onAdvance,
  onEdit,
  onEditRoster,
}: {
  items: RosterOrder[];
  pendingOrders: ReadonlySet<string>;
  canManageSetup: boolean;
  onAdvance: (order: Order, status: OrderStatus) => void;
  onEdit: (order: Order) => void;
  onEditRoster: (item: RosterOrder) => void;
}) {
  return (
    <div className="grid gap-2 no-print">
      {!items.length ? (
        <EmptyState
          title="No matching people"
          description="Clear the search to see everyone on set."
        />
      ) : null}
      {items.map((item) => (
        <RosterCard
          key={item.roster.id}
          item={item}
          pending={item.order ? pendingOrders.has(item.order.id) : false}
          canManageSetup={canManageSetup}
          onAdvance={onAdvance}
          onEdit={onEdit}
          onEditRoster={onEditRoster}
        />
      ))}
    </div>
  );
}

function RosterCard({
  item,
  pending,
  canManageSetup,
  onAdvance,
  onEdit,
  onEditRoster,
}: {
  item: RosterOrder;
  pending: boolean;
  canManageSetup: boolean;
  onAdvance: (order: Order, status: OrderStatus) => void;
  onEdit: (order: Order) => void;
  onEditRoster: (item: RosterOrder) => void;
}) {
  const { order, roster, person } = item;
  const onSet = roster.on_set_today;
  const railColor = order ? statusRailStyles[order.status] : "bg-zinc-200";

  return (
    <article
      className="relative w-full min-w-0 overflow-hidden rounded-xl border border-zinc-400 bg-white py-3 pr-3 pl-4"
      aria-busy={pending}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1.5 ${railColor}`}
        aria-hidden="true"
      />
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
                <span className="rounded-md border border-zinc-500 bg-white px-2.5 py-1 text-xs font-black text-zinc-700">
                  Off set
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-3 grid gap-1 text-sm leading-5">
            <p className="text-zinc-600">
              <span className="font-medium text-zinc-500">Usual: </span>
              {person.usual_order || "—"}
            </p>
            <p className="font-medium text-zinc-900">
              <span className="font-medium text-zinc-500">Today: </span>
              {formatDrink(order)}
            </p>
          </div>
        </div>
      </div>

      {!order ? (
        // Partial data: roster row exists but its order never landed. Surface
        // it instead of silently rendering nothing (the old `return null`).
        <div className="mt-3 grid gap-2">
          <p className="rounded-lg border border-zinc-500 bg-white p-3 text-sm font-bold text-zinc-800">
            No order record yet. Remove and re-add this person to rebuild it.
          </p>
          {canManageSetup ? (
            <button
              type="button"
              onClick={() => onEditRoster(item)}
              className={secondaryButtonClass}
            >
              <Pencil size={18} aria-hidden="true" />
              Edit roster
            </button>
          ) : null}
        </div>
      ) : !onSet ? (
        <div className="mt-3 grid gap-2">
          {canManageSetup ? (
            <button
              type="button"
              onClick={() => onEditRoster(item)}
              className={secondaryButtonClass}
            >
              <Pencil size={18} aria-hidden="true" />
              Edit roster
            </button>
          ) : null}
        </div>
      ) : (
        <CardActions
          order={order}
          pending={pending}
          canManageSetup={canManageSetup}
          onAdvance={onAdvance}
          onEdit={onEdit}
          onEditRoster={() => onEditRoster(item)}
        />
      )}
    </article>
  );
}

function CardActions({
  order,
  pending,
  canManageSetup,
  onAdvance,
  onEdit,
  onEditRoster,
}: {
  order: Order;
  pending: boolean;
  canManageSetup: boolean;
  onAdvance: (order: Order, status: OrderStatus) => void;
  onEdit: (order: Order) => void;
  onEditRoster: () => void;
}) {
  const step = nextStep[order.status];
  const previous = previousStep[order.status];
  const compactButtonClass =
    "flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-lg border border-zinc-400 bg-white text-black transition active:translate-y-px hover:border-black hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="mt-3 grid gap-2">
      {step ? (
        <button
          type="button"
          onClick={() => onAdvance(order, step.status)}
          disabled={pending}
          className={`${buttonClass} min-h-12 bg-black text-base text-white disabled:opacity-40`}
        >
          {order.status === "not_asked" ? (
            <Check size={19} aria-hidden="true" />
          ) : (
            <ChevronRight size={19} aria-hidden="true" />
          )}
          {step.label}
        </button>
      ) : (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid min-h-11 place-items-center rounded-lg border border-zinc-500 bg-zinc-200 px-3 text-sm font-black text-black">
            {statusLabels[order.status]}
          </div>
          {previous ? (
            <button
              type="button"
              onClick={() => onAdvance(order, previous.status)}
              disabled={pending}
              className={secondaryButtonClass}
            >
              <RotateCcw size={18} aria-hidden="true" />
              {previous.label}
            </button>
          ) : null}
        </div>
      )}

      <div
        className={`grid gap-1.5 ${canManageSetup ? "grid-cols-3" : "grid-cols-2"}`}
      >
        <Link
          href={`/labels?order=${encodeURIComponent(order.id)}`}
          className={compactButtonClass}
        >
          <Printer size={16} aria-hidden="true" />
          <span className="text-[11px] font-bold">Label</span>
        </Link>
        <button
          type="button"
          onClick={() => onEdit(order)}
          disabled={pending}
          className={compactButtonClass}
        >
          <Pencil size={16} aria-hidden="true" />
          <span className="text-[11px] font-bold">Edit</span>
        </button>
        {canManageSetup ? (
          <button type="button" onClick={onEditRoster} className={compactButtonClass}>
            <Pencil size={16} aria-hidden="true" />
            <span className="text-[11px] font-bold">Roster</span>
          </button>
        ) : null}
      </div>
    </div>
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
    "mx-auto grid max-h-[90dvh] w-full max-w-xl gap-3 overflow-y-auto rounded-t-xl border border-black bg-white p-5";

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
  canUpdateUsualOrder = true,
  onChange,
  onUpdateUsualOrder,
  onCancel,
  onSave,
  saving,
}: {
  draft: Partial<Order>;
  updateUsualOrder: boolean;
  canUpdateUsualOrder?: boolean;
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
      {canUpdateUsualOrder ? (
        <label className="flex min-h-11 items-start gap-3 rounded-lg border border-zinc-500 p-3 text-sm text-zinc-700">
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
      ) : null}
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
      <label className="flex min-h-11 items-start gap-3 rounded-lg border border-zinc-500 p-3 text-sm text-zinc-700">
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
        <label className="flex min-h-11 items-start gap-3 rounded-lg border border-zinc-500 p-3 text-sm text-zinc-700">
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
