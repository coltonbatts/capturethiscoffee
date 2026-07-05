"use client";

import {
  Check,
  CircleSlash,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PersonPhotoField } from "@/components/person-photo-field";
import {
  Avatar,
  CountBadge,
  Field,
  Panel,
  inputClass,
} from "@/components/ui";
import type { CaptureProgress } from "@/lib/order-progress";
import { isOrderCaptured, isOrderSkipped } from "@/lib/order-progress";
import { formatDrink } from "@/lib/order-summary";
import {
  groupSuggestions,
  personTypeLabel,
  personTypes,
  type PersonForm,
} from "@/lib/people";
import type {
  Order,
  Production,
  ProductionRoster,
  RosterOrder,
} from "@/lib/types";

// Custom premium buttons matching our Capture This Coffee neo-brutalist / studio aesthetic
const customPrimaryBtn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-[3px] border-black bg-black text-white font-black text-sm uppercase tracking-wider hover:bg-zinc-800 transition active:translate-y-px disabled:opacity-50";

const customSecondaryBtn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-[3px] border-black bg-white text-black font-black text-sm uppercase tracking-wider hover:bg-zinc-100 transition active:translate-y-px disabled:opacity-50";

export function ErrorToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-3 md:bottom-4 no-print">
      <div className="flex w-full max-w-md items-start gap-3 rounded-lg border-[3px] border-red-700 bg-white p-3 text-sm font-bold text-red-700 shadow-[4px_4px_0_#b91c1c]">
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

/**
 * Top of the day board. Answers: what day is this, how many people are on
 * the roster, how many drinks are captured, and what to do next — collect
 * the missing drinks or print the labels.
 */
export function DayHeader({
  productionName,
  detail,
  runnerName,
  progress,
  printHref,
  onEditDetails,
  onCopyRunnerLink,
  copyLinkState = "idle",
}: {
  productionName: string;
  detail: string;
  runnerName?: string;
  progress: CaptureProgress;
  printHref?: string;
  onEditDetails?: () => void;
  onCopyRunnerLink?: () => void;
  copyLinkState?: "idle" | "working" | "copied";
}) {
  return (
    <section className="mb-6 rounded-xl border-[3px] border-black bg-white p-5 shadow-[4px_4px_0_#000] no-print">
      {/* Breadcrumb Trail */}
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs font-black uppercase tracking-tight text-zinc-500">
        <Link href="/productions" className="hover:text-black transition">
          Days
        </Link>
        <span className="text-zinc-400">/</span>
        <span className="text-black truncate max-w-40">{productionName}</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black uppercase tracking-tight text-black truncate">
            {productionName}
          </h1>
          <p className="mt-1 text-sm font-semibold leading-normal text-zinc-600 truncate">
            {detail || "Coffee orders"}
          </p>
          {runnerName && (
            <p className="mt-0.5 text-xs font-black uppercase text-zinc-400">
              Runner: {runnerName}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onCopyRunnerLink && (
            <button
              type="button"
              onClick={onCopyRunnerLink}
              disabled={copyLinkState === "working"}
              className="flex h-11 w-11 items-center justify-center rounded-lg border-[3px] border-black bg-white text-black hover:bg-zinc-100 transition active:translate-y-px disabled:opacity-50 shrink-0"
              aria-label={
                copyLinkState === "copied"
                  ? "Runner link copied"
                  : "Copy runner link"
              }
            >
              {copyLinkState === "working" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : copyLinkState === "copied" ? (
                <Check size={16} />
              ) : (
                <Link2 size={16} />
              )}
            </button>
          )}
          {onEditDetails && (
            <button
              type="button"
              onClick={onEditDetails}
              className="flex h-11 w-11 items-center justify-center rounded-lg border-[3px] border-black bg-white text-black hover:bg-zinc-100 transition active:translate-y-px shrink-0"
              aria-label="Edit production details"
            >
              <Pencil size={16} />
            </button>
          )}

          <div className="text-right leading-none ml-2">
            <span className="block text-3xl font-black tabular-nums text-black">
              {progress.captured}
              <span className="text-lg text-zinc-500">/{progress.total}</span>
            </span>
            <span className="mt-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
              drinks in
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-md border-2 border-black bg-zinc-100">
        <div
          className="h-full bg-black transition-[width] duration-300"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {progress.needed ? (
          <CountBadge
            label={progress.needed === 1 ? "needs order" : "need orders"}
            count={progress.needed}
            accent
          />
        ) : null}
        {progress.skipped ? (
          <CountBadge label="no drink" count={progress.skipped} />
        ) : null}
        {progress.printed ? (
          <CountBadge label="printed" count={progress.printed} />
        ) : null}
        {progress.captured && !progress.needed ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-emerald-700 bg-emerald-50 px-2 py-0.5 text-2xs font-bold leading-none uppercase text-emerald-800">
            <Check size={12} strokeWidth={3} aria-hidden="true" />
            All drinks captured
          </span>
        ) : null}
      </div>

      {printHref && progress.captured ? (
        <Link
          href={printHref}
          className={`${customPrimaryBtn} mt-4 w-full h-11 min-h-11 py-0`}
        >
          <Printer size={16} aria-hidden="true" />
          <span>Print labels ({progress.captured})</span>
        </Link>
      ) : null}
    </section>
  );
}

export function SearchRoster({
  query,
  onQuery,
  needsOnly,
  onNeedsOnly,
  neededCount,
  count,
  total,
}: {
  query: string;
  onQuery: (value: string) => void;
  needsOnly: boolean;
  onNeedsOnly: (value: boolean) => void;
  neededCount: number;
  count: number;
  total: number;
}) {
  const chipClass = (active: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-lg border-[3px] border-black px-3.5 text-xs font-black uppercase tracking-wider transition active:translate-y-px ${
      active
        ? "border-black bg-black text-white"
        : "border-black bg-white text-black hover:bg-zinc-100"
    }`;

  return (
    <div className="mb-4 grid gap-2 no-print">
      <label className="relative block">
        <Search
          size={19}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          aria-hidden="true"
        />
        <input
          className={`${inputClass} pl-10 rounded-lg border-[3px] border-black text-base font-semibold`}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search people"
          aria-label="Search roster"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5" role="group" aria-label="Filter roster">
          <button
            type="button"
            onClick={() => onNeedsOnly(false)}
            className={chipClass(!needsOnly)}
            aria-pressed={!needsOnly}
          >
            Everyone ({total})
          </button>
          <button
            type="button"
            onClick={() => onNeedsOnly(true)}
            className={chipClass(needsOnly)}
            aria-pressed={needsOnly}
          >
            Needs order ({neededCount})
          </button>
        </div>
        {query.trim() ? (
          <span className="text-sm font-bold text-zinc-600">
            {count} of {total} people
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function RosterList({
  items,
  pendingOrders,
  canManageSetup,
  onTakeOrder,
  onNoDrink,
  onEditRoster,
}: {
  items: RosterOrder[];
  pendingOrders: ReadonlySet<string>;
  canManageSetup: boolean;
  onTakeOrder: (order: Order) => void;
  onNoDrink: (order: Order) => void;
  onEditRoster: (item: RosterOrder) => void;
}) {
  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <RosterCard
          key={item.roster.id}
          item={item}
          pending={pendingOrders.has(item.order?.id || "")}
          canManageSetup={canManageSetup}
          onTakeOrder={onTakeOrder}
          onNoDrink={onNoDrink}
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
  onTakeOrder,
  onNoDrink,
  onEditRoster,
}: {
  item: RosterOrder;
  pending: boolean;
  canManageSetup: boolean;
  onTakeOrder: (order: Order) => void;
  onNoDrink: (order: Order) => void;
  onEditRoster: (item: RosterOrder) => void;
}) {
  const { order, roster, person } = item;
  const captured = isOrderCaptured(order);
  const skipped = isOrderSkipped(order);
  const railColor = captured
    ? "bg-black"
    : skipped
      ? "bg-zinc-400"
      : "bg-amber-400";

  return (
    <article
      className="relative w-full min-w-0 overflow-hidden rounded-xl border-[3px] border-black bg-white p-5 shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] transition-[transform,box-shadow] duration-100 min-w-0"
      aria-busy={pending}
    >
      <span
        className={`absolute inset-y-0 left-0 w-2.5 ${railColor} border-r-[3px] border-black`}
        aria-hidden="true"
      />
      <div className={`flex gap-3 pl-2.5 ${pending ? "opacity-60" : ""}`}>
        <Avatar person={person} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black uppercase tracking-tight text-black">{person.name}</h2>
              <p className="truncate text-xs font-bold uppercase text-zinc-500 mt-0.5">
                {[person.role, roster.group_label || person.department]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="grid shrink-0 justify-items-end gap-1">
              {captured && order?.label_printed ? (
                <span className="inline-flex items-center gap-1 rounded-md border-2 border-emerald-700 bg-emerald-50 px-1.5 py-0.5 text-2xs font-bold uppercase text-emerald-800">
                  <Printer size={12} aria-hidden="true" />
                  Printed
                </span>
              ) : null}
              {skipped ? (
                <span className="inline-flex items-center gap-1 rounded-md border-2 border-black bg-zinc-100 px-1.5 py-0.5 text-2xs font-bold uppercase text-zinc-700">
                  <CircleSlash size={12} aria-hidden="true" />
                  No drink
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-2 text-sm leading-normal">
            {captured ? (
              <p className="font-bold text-black">{formatDrink(order)}</p>
            ) : skipped ? (
              <p className="text-zinc-500 font-semibold">Doesn&apos;t want a drink today.</p>
            ) : (
              <p className="text-zinc-600 font-semibold">
                <span className="font-bold text-zinc-400 uppercase text-xs">Usual: </span>
                {person.usual_order || "—"}
              </p>
            )}
          </div>
        </div>
      </div>

      {!order ? (
        <div className="mt-3 grid gap-2 pl-2.5">
          <p className="rounded-lg border-[3px] border-black bg-white p-3 text-sm font-bold text-zinc-800">
            No order record yet. Remove and re-add this person to rebuild it.
          </p>
          {canManageSetup ? (
            <button
              type="button"
              onClick={() => onEditRoster(item)}
              className={customSecondaryBtn}
            >
              <Pencil size={16} aria-hidden="true" />
              <span>Edit roster</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div className="pl-2.5">
          <CardActions
            order={order}
            captured={captured}
            skipped={skipped}
            pending={pending}
            canManageSetup={canManageSetup}
            onTakeOrder={onTakeOrder}
            onNoDrink={onNoDrink}
            onEditRoster={() => onEditRoster(item)}
          />
        </div>
      )}
    </article>
  );
}

function CardActions({
  order,
  captured,
  skipped,
  pending,
  canManageSetup,
  onTakeOrder,
  onNoDrink,
  onEditRoster,
}: {
  order: Order;
  captured: boolean;
  skipped: boolean;
  pending: boolean;
  canManageSetup: boolean;
  onTakeOrder: (order: Order) => void;
  onNoDrink: (order: Order) => void;
  onEditRoster: () => void;
}) {
  const compactButtonClass =
    "flex min-h-12 items-center justify-center gap-1.5 rounded-lg border-[3px] border-black bg-white text-black font-black text-xs uppercase tracking-wider hover:bg-zinc-100 transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";

  const compactActions: ReactNode[] = [];
  if (captured) {
    if (canManageSetup) {
      compactActions.push(
        <Link
          key="label"
          href={`/labels?order=${encodeURIComponent(order.id)}`}
          className={compactButtonClass}
        >
          <Printer size={14} aria-hidden="true" />
          <span>
            {order.label_printed ? "Reprint" : "Label"}
          </span>
        </Link>,
      );
    }
    compactActions.push(
      <button
        key="no-drink"
        type="button"
        onClick={() => onNoDrink(order)}
        disabled={pending}
        className={compactButtonClass}
      >
        <CircleSlash size={14} aria-hidden="true" />
        <span>No drink</span>
      </button>,
    );
  }
  if (canManageSetup) {
    compactActions.push(
      <button
        key="roster"
        type="button"
        onClick={onEditRoster}
        className={compactButtonClass}
      >
        <Pencil size={14} aria-hidden="true" />
        <span>Roster</span>
      </button>,
    );
  }

  return (
    <div className="mt-4 grid gap-2">
      {captured ? (
        <button
          type="button"
          onClick={() => onTakeOrder(order)}
          disabled={pending}
          className={customSecondaryBtn + " w-full"}
        >
          <Pencil size={16} aria-hidden="true" />
          <span>Edit order</span>
        </button>
      ) : (
        <div
          className={`grid gap-2 ${skipped ? "" : "grid-cols-2"}`}
        >
          <button
            type="button"
            onClick={() => onTakeOrder(order)}
            disabled={pending}
            className={customPrimaryBtn + " w-full"}
          >
            <Plus size={16} aria-hidden="true" />
            <span>Take order</span>
          </button>
          {!skipped ? (
            <button
              type="button"
              onClick={() => onNoDrink(order)}
              disabled={pending}
              className={customSecondaryBtn + " w-full"}
            >
              <CircleSlash size={16} aria-hidden="true" />
              <span>No drink</span>
            </button>
          ) : null}
        </div>
      )}

      {compactActions.length ? (
        <div
          className={`grid gap-2 ${
            compactActions.length === 3
              ? "grid-cols-3"
              : compactActions.length === 2
                ? "grid-cols-2"
                : "grid-cols-1"
          }`}
        >
          {compactActions}
        </div>
      ) : null}
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
    <Panel className="mt-6 p-5 border-[3px] border-black bg-white shadow-[4px_4px_0_#000] no-print">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black uppercase tracking-tight text-black">Add to roster</h2>
        <button
          type="button"
          onClick={onNewGuest}
          className={`${customSecondaryBtn} min-h-10 py-0 px-3.5 text-xs`}
        >
          <Plus size={16} aria-hidden="true" />
          <span>New guest</span>
        </button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <select
          className={`${inputClass} border-[3px] border-black text-base`}
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
          className={`${customPrimaryBtn} min-h-11 h-11 w-11 px-0`}
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
    "mx-auto grid max-h-[85dvh] w-full max-w-md min-w-0 gap-4 overflow-y-auto rounded-xl border-[3px] border-black bg-white p-5 shadow-[6px_6px_0_#000]";

  return (
    <div className="fixed inset-0 z-50 grid items-end bg-black/55 p-4 no-print sm:items-center">
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

export function RunnerLinkSheet({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: leave the field selected so a long-press works.
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: "Runner Link",
        text: "Access this Day coffee ordering page.",
        url,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  return (
    <Sheet label="Runner link">
      <h2 className="text-lg font-black uppercase tracking-tight text-black">Runner link</h2>
      <p className="text-sm font-semibold leading-relaxed text-zinc-600">
        Anyone with this link can take drink orders for today. Paste this link into CTC Printer to sync the printing queue.
      </p>
      <div className="grid gap-2">
        <input
          readOnly
          value={url}
          className={`${inputClass} font-mono text-sm bg-zinc-50`}
          onFocus={(event) => event.currentTarget.select()}
        />
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          <button
            type="button"
            onClick={() => void copy()}
            className={copied ? customPrimaryBtn : customSecondaryBtn}
          >
            {copied ? <Check size={16} /> : <Link2 size={16} />}
            <span>{copied ? "Copied" : "Copy Link"}</span>
          </button>
          {canShare ? (
            <button type="button" onClick={() => void share()} className={customPrimaryBtn}>
              <Printer size={16} />
              <span>Share link</span>
            </button>
          ) : null}
        </div>
      </div>
      <button type="button" onClick={onClose} className={`${customSecondaryBtn} w-full mt-2`}>
        Done
      </button>
    </Sheet>
  );
}

export function OrderEditor({
  title,
  draft,
  updateUsualOrder,
  canUpdateUsualOrder = true,
  onChange,
  onUpdateUsualOrder,
  onCancel,
  onSave,
  saving,
}: {
  title: string;
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
    <Sheet label={title}>
      <h2 className="text-lg font-black uppercase tracking-tight text-black">{title}</h2>
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
          className={`${inputClass} min-h-20 py-3`}
          value={draft.special_notes || ""}
          onChange={(event) => onChange({ ...draft, special_notes: event.target.value })}
          placeholder="No room, extra hot, separate cup"
        />
      </Field>
      {canUpdateUsualOrder && (
        <label className="flex min-h-11 items-center gap-3 rounded-lg border-[3px] border-black bg-white p-3 text-sm font-bold text-black cursor-pointer">
          <input
            type="checkbox"
            checked={updateUsualOrder}
            onChange={(event) => onUpdateUsualOrder(event.target.checked)}
            className="size-4 accent-black"
          />
          <span>
            <span className="block font-black text-xs uppercase tracking-tight text-black">Save as usual order</span>
            <span className="text-[10px] text-zinc-500 font-semibold block leading-tight">Leave off for a one-day exception.</span>
          </span>
        </label>
      )}
      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 pt-2">
        <button type="button" onClick={onCancel} className={customSecondaryBtn}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className={customPrimaryBtn}
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
      <h2 className="text-lg font-black uppercase tracking-tight text-black">Edit production</h2>
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
          className={`${inputClass} min-h-20 py-3`}
          value={draft.notes}
          onChange={(event) => onChange({ ...draft, notes: event.target.value })}
          placeholder="Call time, coffee shop, handoff"
        />
      </Field>
      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 pt-2">
        <button type="button" onClick={onCancel} className={customSecondaryBtn}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className={customPrimaryBtn}
          disabled={saving || !draft.name.trim()}
        >
          {saving ? "Saving..." : "Save details"}
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
      <h2 className="text-lg font-black uppercase tracking-tight text-black">Edit roster</h2>
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
      <label className="flex min-h-11 items-center gap-3 rounded-lg border-[3px] border-black bg-white p-3 text-sm font-bold text-black cursor-pointer">
        <input
          type="checkbox"
          checked={draft.on_set_today ?? true}
          onChange={(event) => onChange({ ...draft, on_set_today: event.target.checked })}
          className="size-4 accent-black"
        />
        <span>
          <span className="block font-black text-xs uppercase tracking-tight text-black">On set today</span>
          <span className="text-[10px] text-zinc-500 font-semibold block leading-tight">
            Turn off to keep them out of coffee ordering and labels.
          </span>
        </span>
      </label>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-[3px] border-red-700 bg-red-50 text-red-700 font-black text-sm uppercase tracking-wider hover:bg-red-100 transition active:translate-y-px disabled:opacity-50 w-full"
        disabled={saving}
      >
        <Trash2 size={16} aria-hidden="true" />
        <span>Remove from Day</span>
      </button>
      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 pt-2">
        <button type="button" onClick={onCancel} className={customSecondaryBtn}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className={customPrimaryBtn}
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
      <h2 className="text-lg font-black uppercase tracking-tight text-black">Quick add person</h2>
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
      {canLinkToClient && (
        <label className="flex min-h-11 items-center gap-3 rounded-lg border-[3px] border-black bg-white p-3 text-sm font-bold text-black cursor-pointer">
          <input
            type="checkbox"
            checked={linkToClient}
            onChange={(event) => onLinkToClientChange(event.target.checked)}
            className="size-4 accent-black"
          />
          <span>
            <span className="block font-black text-xs uppercase tracking-tight text-black">Link to {clientName}</span>
            <span className="text-[10px] text-zinc-500 font-semibold block leading-tight">
              Include them automatically on future productions for this client.
            </span>
          </span>
        </label>
      )}
      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 pt-2">
        <button type="button" onClick={onCancel} className={customSecondaryBtn}>
          Cancel
        </button>
        <button
          type="submit"
          className={customPrimaryBtn}
          disabled={saving || !form.name.trim()}
        >
          {saving ? "Saving…" : "Add to roster"}
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
