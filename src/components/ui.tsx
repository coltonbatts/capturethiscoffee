import Image from "next/image";
import type { ReactNode } from "react";
import type { OrderStatus, Person } from "@/lib/types";

const statusStyles: Record<OrderStatus, string> = {
  not_asked: "bg-stone-100 text-stone-700 border-stone-300",
  confirmed: "bg-teal-50 text-teal-900 border-teal-200",
  ordered: "bg-indigo-50 text-indigo-900 border-indigo-200",
  picked_up: "bg-amber-50 text-amber-950 border-amber-200",
  delivered: "bg-emerald-100 text-emerald-950 border-emerald-300",
  no_order: "bg-zinc-100 text-zinc-700 border-zinc-300",
};

export const statusLabels: Record<OrderStatus, string> = {
  not_asked: "Not asked",
  confirmed: "Confirmed",
  ordered: "Ordered",
  picked_up: "Picked up",
  delivered: "Delivered",
  no_order: "No order",
};

export function StatusChip({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex min-h-7 shrink-0 items-center rounded-full border px-2.5 text-xs font-bold leading-none ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

export function Avatar({ person }: { person: Person }) {
  if (person.photo_url) {
    return (
      <Image
        src={person.photo_url}
        alt=""
        width={48}
        height={48}
        className="size-12 rounded-lg object-cover"
      />
    );
  }

  return (
    <div className="grid size-12 place-items-center rounded-lg bg-stone-900 text-sm font-black text-stone-50 ring-1 ring-stone-700/20">
      {person.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
      {label}
      {children}
    </label>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-stone-200 bg-white/90 shadow-[0_1px_0_rgba(28,25,23,0.05)] ${className}`}
    >
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Panel className="grid gap-3 p-5 text-center">
      <div>
        <h2 className="text-base font-black text-stone-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p>
      </div>
      {action ? <div className="flex justify-center">{action}</div> : null}
    </Panel>
  );
}

export const inputClass =
  "min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10";

export const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-bold leading-tight transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButtonClass = `${buttonClass} bg-stone-950 text-white shadow-sm hover:bg-stone-800`;

export const secondaryButtonClass = `${buttonClass} border border-stone-300 bg-white text-stone-900 hover:bg-stone-50`;

export const dangerButtonClass = `${buttonClass} border border-red-200 bg-red-50 text-red-800 hover:bg-red-100`;
