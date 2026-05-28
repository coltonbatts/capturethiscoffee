import Image from "next/image";
import type { OrderStatus, Person } from "@/lib/types";

const statusStyles: Record<OrderStatus, string> = {
  not_asked: "bg-stone-200 text-stone-700 border-stone-300",
  confirmed: "bg-emerald-100 text-emerald-900 border-emerald-200",
  ordered: "bg-blue-100 text-blue-900 border-blue-200",
  picked_up: "bg-amber-100 text-amber-950 border-amber-200",
  delivered: "bg-green-200 text-green-950 border-green-300",
  no_order: "bg-zinc-200 text-zinc-700 border-zinc-300",
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
      className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-bold ${statusStyles[status]}`}
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
        className="size-12 rounded-xl object-cover"
      />
    );
  }

  return (
    <div className="grid size-12 place-items-center rounded-xl bg-stone-800 text-sm font-bold text-stone-50">
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

export const inputClass =
  "min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-950 outline-none transition focus:border-stone-800 focus:ring-2 focus:ring-stone-800/10";

export const buttonClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButtonClass = `${buttonClass} bg-stone-950 text-white hover:bg-stone-800`;

export const secondaryButtonClass = `${buttonClass} border border-stone-300 bg-white text-stone-900 hover:bg-stone-50`;

export const dangerButtonClass = `${buttonClass} border border-red-200 bg-red-50 text-red-800`;
