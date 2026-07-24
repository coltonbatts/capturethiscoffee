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
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { PersonPhotoField } from "@/components/person-photo-field";
import {
  Avatar,
  CountBadge,
  Field,
  Panel,
  Sheet,
  alertErrorClass,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
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
  ProductionBoardOrderDTO,
  ProductionBoardRosterDTO,
} from "@/lib/production-board";
import type { Production, ProductionRoster } from "@/lib/types";

const customPrimaryBtn = primaryButtonClass;
const customSecondaryBtn = secondaryButtonClass;

export function ErrorToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-3 md:bottom-4 no-print">
      <div className={`flex w-full max-w-md items-start gap-3 ${alertErrorClass}`} role="alert">
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
    <section className="mb-6 border-b border-black/15 pb-6 no-print">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-balance text-3xl font-semibold leading-none tracking-[-0.055em] text-black sm:text-4xl">
            {productionName}
          </h1>
          <p className="mt-1 text-sm font-semibold leading-normal text-zinc-600">
            {detail || "Coffee orders"}
          </p>
          {runnerName && (
            <p className="mt-1 text-xs font-medium text-zinc-500">
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/15 bg-transparent text-black transition hover:border-black hover:bg-white active:translate-y-px disabled:opacity-50"
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/15 bg-transparent text-black transition hover:border-black hover:bg-white active:translate-y-px"
              aria-label="Edit production details"
            >
              <Pencil size={16} />
            </button>
          )}

          <div className="text-right leading-none ml-2">
            <span className="block text-3xl font-semibold tabular-nums tracking-[-0.04em] text-black">
              {progress.captured}
              <span className="text-lg text-zinc-500">/{progress.total}</span>
            </span>
            <span className="mt-1 block text-[10px] font-medium text-zinc-500">
              drinks in
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10">
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800/25 bg-emerald-50 px-2.5 py-1 text-xs font-semibold leading-none text-emerald-900">
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
    `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition active:translate-y-px ${
      active
        ? "border-black bg-black text-white"
        : "border-black/15 bg-transparent text-black hover:border-black hover:bg-white"
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
          className={`${inputClass} pl-10 text-base`}
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
  items: ProductionBoardRosterDTO[];
  pendingOrders: ReadonlySet<string>;
  canManageSetup: boolean;
  onTakeOrder: (order: ProductionBoardOrderDTO) => void;
  onNoDrink: (order: ProductionBoardOrderDTO) => void;
  onEditRoster: (item: ProductionBoardRosterDTO) => void;
}) {
  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <RosterCard
          key={item.roster_id}
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
  item: ProductionBoardRosterDTO;
  pending: boolean;
  canManageSetup: boolean;
  onTakeOrder: (order: ProductionBoardOrderDTO) => void;
  onNoDrink: (order: ProductionBoardOrderDTO) => void;
  onEditRoster: (item: ProductionBoardRosterDTO) => void;
}) {
  const { order, person } = item;
  const captured = isOrderCaptured(order);
  const skipped = isOrderSkipped(order);
  const railColor = captured
    ? "bg-black"
    : skipped
      ? "bg-zinc-400"
      : "bg-amber-400";
  const roleLine = [person.role, item.group_label || person.department]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className="relative w-full min-w-0 overflow-hidden rounded-xl border border-black/15 bg-[#fffdf8] p-4 transition-[border-color,background-color] hover:border-black/35 hover:bg-white sm:p-5"
      aria-busy={pending}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1.5 ${railColor}`}
        aria-hidden="true"
      />
      <div
        className={`grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 gap-y-3 pl-2.5 sm:grid-cols-[3.25rem_minmax(0,1fr)] ${
          pending ? "opacity-60" : ""
        }`}
      >
        <div className="pt-0.5">
          <Avatar person={person} />
        </div>
        <div className="min-w-0">
          <h2 className="text-balance text-[1.35rem] font-semibold leading-[1.03] tracking-[-0.035em] text-black sm:text-2xl">
            {person.name}
          </h2>
          {roleLine ? (
            <p className="mt-1 text-xs font-medium leading-snug text-zinc-500">
              {roleLine}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {captured && order?.label_printed ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-800/25 bg-emerald-50 px-2 py-1 text-[0.68rem] font-semibold leading-none text-emerald-900">
                <Printer size={12} aria-hidden="true" />
                Printed
              </span>
            ) : null}
            {skipped ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-black/[0.04] px-2 py-1 text-[0.68rem] font-semibold leading-none text-zinc-700">
                <CircleSlash size={12} aria-hidden="true" />
                No drink
              </span>
            ) : null}
          </div>
        </div>
        <div className="col-span-2 rounded-lg border border-black/10 bg-black/[0.025] px-3 py-2.5 text-[0.95rem] leading-snug">
          {captured ? (
            <p className="font-semibold text-black">{formatDrink(order)}</p>
          ) : skipped ? (
            <p className="font-bold text-zinc-600">
              Doesn&apos;t want a drink today.
            </p>
          ) : (
            <p className="font-semibold text-zinc-700">
              <span className="text-xs font-medium text-zinc-500">
                Usual:{" "}
              </span>
              {person.usual_order || "—"}
            </p>
          )}
        </div>
      </div>

      {!order ? (
        <div className="mt-3 grid gap-2 pl-2.5">
          <p className="rounded-lg border border-black/15 bg-black/[0.025] p-3 text-sm font-medium text-zinc-800">
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
  order: ProductionBoardOrderDTO;
  captured: boolean;
  skipped: boolean;
  pending: boolean;
  canManageSetup: boolean;
  onTakeOrder: (order: ProductionBoardOrderDTO) => void;
  onNoDrink: (order: ProductionBoardOrderDTO) => void;
  onEditRoster: () => void;
}) {
  const compactButtonClass =
    "flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-black/15 bg-transparent px-2 text-center text-[0.72rem] font-semibold leading-none text-black transition hover:border-black hover:bg-white active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-12 sm:text-xs";

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
          <span className="whitespace-nowrap">
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
        <span className="whitespace-nowrap">No drink</span>
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
          <span className="whitespace-nowrap">Edit order</span>
        </button>
      ) : (
        <div className={`grid gap-2 ${skipped ? "" : "grid-cols-2"}`}>
          <button
            type="button"
            onClick={() => onTakeOrder(order)}
            disabled={pending}
            className={customPrimaryBtn + " w-full"}
          >
            <Plus size={16} aria-hidden="true" />
            <span className="whitespace-nowrap">Take order</span>
          </button>
          {!skipped ? (
            <button
              type="button"
              onClick={() => onNoDrink(order)}
              disabled={pending}
              className={customSecondaryBtn + " w-full"}
            >
              <CircleSlash size={16} aria-hidden="true" />
              <span className="whitespace-nowrap">No drink</span>
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
    <Panel className="mt-6 p-5 no-print">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold leading-tight tracking-[-0.025em] text-black">
          Add to roster
        </h2>
        <button
          type="button"
          onClick={onNewGuest}
          className={`${customSecondaryBtn} min-h-10 whitespace-nowrap px-3 py-0 text-xs`}
        >
          <Plus size={16} aria-hidden="true" />
          <span>New guest</span>
        </button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <select
          className={`${inputClass} text-base`}
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

export function RunnerLinkSheet({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const canShare = useSyncExternalStore(
    subscribeToWebShareCapability,
    getWebShareSnapshot,
    getServerWebShareSnapshot,
  );

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
    <Sheet
      title="Runner link"
      onClose={onClose}
      footer={
        <div className={`grid gap-2 ${canShare ? "grid-cols-2" : ""}`}>
          <button
            type="button"
            onClick={() => void copy()}
            className={copied ? customPrimaryBtn : canShare ? customSecondaryBtn : customPrimaryBtn}
          >
            {copied ? <Check size={16} /> : <Link2 size={16} />}
            <span>{copied ? "Copied" : "Copy link"}</span>
          </button>
          {canShare ? (
            <button type="button" onClick={() => void share()} className={customPrimaryBtn}>
              <Printer size={16} />
              <span>Share link</span>
            </button>
          ) : null}
        </div>
      }
    >
      <p className="text-sm font-semibold leading-relaxed text-zinc-600">
        Anyone with this link can take drink orders for today. Paste this link into CTC Printer to sync the printing queue.
      </p>
      <input
        readOnly
        value={url}
        className={`${inputClass} font-mono text-sm bg-zinc-50`}
        onFocus={(event) => event.currentTarget.select()}
        aria-label="Runner link URL"
      />
    </Sheet>
  );
}

function subscribeToWebShareCapability() {
  return () => {};
}

function getWebShareSnapshot() {
  return typeof navigator.share === "function";
}

function getServerWebShareSnapshot() {
  return false;
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
  draft: Partial<ProductionBoardOrderDTO>;
  updateUsualOrder: boolean;
  canUpdateUsualOrder?: boolean;
  onChange: (draft: Partial<ProductionBoardOrderDTO>) => void;
  onUpdateUsualOrder: (value: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Sheet
      title={title}
      onClose={onCancel}
      footer={
        <div className="grid grid-cols-2 gap-2">
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
      }
    >
      <div className="grid grid-cols-2 gap-2.5">
        <div className="col-span-2">
          <Field label="Drink">
            <input
              className={inputClass}
              value={draft.drink_type || ""}
              onChange={(event) => onChange({ ...draft, drink_type: event.target.value })}
              placeholder="Latte, cold brew, drip"
              autoFocus
            />
          </Field>
        </div>
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
            placeholder="Oat, whole"
          />
        </Field>
        <Field label="Sweetener">
          <input
            className={inputClass}
            value={draft.sweetener || ""}
            onChange={(event) => onChange({ ...draft, sweetener: event.target.value })}
            placeholder="Vanilla"
          />
        </Field>
        <div className="col-span-2">
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
      </div>
      <Field label="Special notes">
        <textarea
          className={`${inputClass} min-h-16 py-2.5`}
          value={draft.special_notes || ""}
          onChange={(event) => onChange({ ...draft, special_notes: event.target.value })}
          placeholder="No room, extra hot, separate cup"
        />
      </Field>
      {canUpdateUsualOrder && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-black/20 bg-[#fffdf8] px-3 py-2.5 text-sm font-medium text-black">
          <input
            type="checkbox"
            checked={updateUsualOrder}
            onChange={(event) => onUpdateUsualOrder(event.target.checked)}
            className="size-4 shrink-0 accent-black"
          />
          <span>
            <span className="block text-xs font-semibold text-black">Save as usual order</span>
            <span className="text-[10px] text-zinc-500 font-semibold block leading-tight">Leave off for a one-day exception.</span>
          </span>
        </label>
      )}
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
    <Sheet
      title="Edit production"
      onClose={onCancel}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className={customSecondaryBtn}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className={customPrimaryBtn}
            disabled={saving || !draft.name.trim()}
          >
            {saving ? "Saving…" : "Save details"}
          </button>
        </div>
      }
    >
      <Field label="Production name">
        <input
          className={inputClass}
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          autoFocus
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
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
          className={`${inputClass} min-h-16 py-2.5`}
          value={draft.notes}
          onChange={(event) => onChange({ ...draft, notes: event.target.value })}
          placeholder="Call time, coffee shop, handoff"
        />
      </Field>
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
    <Sheet
      title="Edit roster"
      onClose={onCancel}
      footer={
        <div className="grid grid-cols-2 gap-2">
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
      }
    >
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
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-black/20 bg-[#fffdf8] px-3 py-2.5 text-sm font-medium text-black">
        <input
          type="checkbox"
          checked={draft.on_set_today ?? true}
          onChange={(event) => onChange({ ...draft, on_set_today: event.target.checked })}
          className="size-4 shrink-0 accent-black"
        />
        <span>
          <span className="block text-xs font-semibold text-black">On set today</span>
          <span className="text-[10px] text-zinc-500 font-semibold block leading-tight">
            Turn off to keep them out of coffee ordering and labels.
          </span>
        </span>
      </label>
      <button
        type="button"
        onClick={onRemove}
        className={`${dangerButtonClass} w-full`}
        disabled={saving}
      >
        <Trash2 size={16} aria-hidden="true" />
        <span>Remove from Day</span>
      </button>
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
    <Sheet
      title="Quick add person"
      onClose={onCancel}
      asForm
      onSubmit={onSubmit}
      footer={
        <div className="grid grid-cols-2 gap-2">
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
      }
    >
      <Field label="Name">
        <input
          className={inputClass}
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          placeholder="Name"
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
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
        <Field label="Company">
          <input
            className={inputClass}
            value={form.company}
            onChange={(event) => onChange({ ...form, company: event.target.value })}
            placeholder="Company"
          />
        </Field>
      </div>
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
      <PersonPhotoField
        value={form.photo_url}
        personName={form.name}
        onChange={(photo_url) => onChange({ ...form, photo_url })}
      />
      <Field label="Notes">
        <textarea
          className={`${inputClass} min-h-16 py-2.5`}
          value={form.notes}
          onChange={(event) => onChange({ ...form, notes: event.target.value })}
          placeholder="Where to find them or identifying details"
        />
      </Field>
      {canLinkToClient && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-black/20 bg-[#fffdf8] px-3 py-2.5 text-sm font-medium text-black">
          <input
            type="checkbox"
            checked={linkToClient}
            onChange={(event) => onLinkToClientChange(event.target.checked)}
            className="size-4 shrink-0 accent-black"
          />
          <span>
            <span className="block text-xs font-semibold text-black">Link to {clientName}</span>
            <span className="text-[10px] text-zinc-500 font-semibold block leading-tight">
              Include them automatically on future productions for this client.
            </span>
          </span>
        </label>
      )}
      <datalist id="quick-add-group-suggestions">
        {groupSuggestions.map((group) => (
          <option key={group} value={group} />
        ))}
      </datalist>
    </Sheet>
  );
}
