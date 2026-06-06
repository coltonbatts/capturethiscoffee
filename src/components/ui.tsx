import type { ReactNode } from "react";
import type { OrderStatus, Person } from "@/lib/types";

const statusStyles: Record<OrderStatus, string> = {
  not_asked: "bg-zinc-100 text-zinc-700 border-zinc-200",
  confirmed: "bg-white text-black border-zinc-300",
  ordered: "bg-black text-white border-black",
  picked_up: "bg-zinc-800 text-white border-zinc-800",
  delivered: "bg-emerald-50 text-emerald-950 border-emerald-200",
  no_order: "bg-red-50 text-red-800 border-red-200",
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
      className={`inline-flex min-h-7 shrink-0 items-center rounded-full border px-2.5 text-xs font-medium leading-none ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

export function Avatar({ person }: { person: Person }) {
  if (person.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- User-entered photo URLs can be from any host.
      <img
        src={person.photo_url}
        alt=""
        className="size-12 rounded-full object-cover ring-1 ring-zinc-200"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className="grid size-12 place-items-center rounded-full bg-black text-sm font-semibold text-white ring-1 ring-black/10">
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
    <label className="grid gap-1.5 text-sm font-medium text-zinc-600">
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
      className={`rounded-2xl border border-zinc-200 bg-white shadow-sm shadow-black/5 ${className}`}
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
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Panel className="grid gap-3 p-6 text-center">
      <div>
        <h2 className="text-base font-semibold text-black">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-zinc-600">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex justify-center">{action}</div> : null}
    </Panel>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-base text-black outline-none transition placeholder:text-zinc-400 focus:border-black focus:ring-2 focus:ring-black/10";

export const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium leading-tight transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButtonClass = `${buttonClass} bg-black text-white shadow-sm hover:bg-zinc-800`;

export const secondaryButtonClass = `${buttonClass} border border-zinc-300 bg-white text-black hover:bg-zinc-50`;

export const dangerButtonClass = `${buttonClass} border border-red-200 bg-red-50 text-red-800 hover:bg-red-100`;

export const cardClass =
  "block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-black/5 transition hover:border-zinc-400 active:scale-[0.99]";
