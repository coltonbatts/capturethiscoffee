"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Ban, Check, CheckCheck, Circle, Package, Timer } from "lucide-react";
import type { OrderStatus, Person } from "@/lib/types";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

const statusStyles: Record<OrderStatus, string> = {
  not_asked: "bg-white text-zinc-600 border-zinc-400 border-dashed",
  confirmed: "bg-white text-black border-black",
  ordered: "bg-accent text-white border-accent",
  picked_up: "bg-black text-white border-black",
  delivered: "bg-zinc-900/5 text-zinc-800 border-zinc-500",
  no_order: "bg-white text-red-700 border-red-700",
};

const statusIcons: Record<OrderStatus, typeof Circle> = {
  not_asked: Circle,
  confirmed: Check,
  ordered: Timer,
  picked_up: Package,
  delivered: CheckCheck,
  no_order: Ban,
};

/** Left-edge rail color per status, used on roster cards for at-a-glance scanning. */
export const statusRailStyles: Record<OrderStatus, string> = {
  not_asked: "bg-zinc-300",
  confirmed: "bg-black",
  ordered: "bg-accent",
  picked_up: "bg-black",
  delivered: "bg-zinc-400",
  no_order: "bg-red-700",
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
  const Icon = statusIcons[status];
  return (
    <span
      className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-black leading-none ${statusStyles[status]}`}
    >
      <Icon size={12} strokeWidth={3} aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}

export function Avatar({ person }: { person: Person }) {
  const [signedPhotoUrl, setSignedPhotoUrl] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const storagePath = storagePathFromPersonPhotoUrl(person.photo_url);

  useEffect(() => {
    let cancelled = false;

    async function signPersonPhoto() {
      setSignedPhotoUrl(null);
      setPhotoFailed(false);

      if (!storagePath || !isSupabaseConfigured) return;

      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;

      const { data } = await supabase.storage
        .from("person-photos")
        .createSignedUrl(storagePath, 60 * 60);

      if (!cancelled) setSignedPhotoUrl(data?.signedUrl || null);
    }

    void signPersonPhoto();

    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (person.photo_url && !photoFailed) {
    const src = storagePath ? signedPhotoUrl : person.photo_url;
    if (!src) return <AvatarFallback person={person} />;

    return (
      // eslint-disable-next-line @next/next/no-img-element -- User-entered photo URLs can be from any host.
      <img
        src={src}
        alt=""
        className="size-12 rounded-lg object-cover ring-1 ring-black"
        loading="lazy"
        referrerPolicy="no-referrer"
        // Missing or unreachable photos degrade to initials instead of a
        // broken-image icon on the runner dashboard.
        onError={() => setPhotoFailed(true)}
      />
    );
  }

  return <AvatarFallback person={person} />;
}

function AvatarFallback({ person }: { person: Person }) {
  return (
    <div className="grid size-12 place-items-center rounded-lg bg-black text-sm font-semibold text-white ring-1 ring-black">
      {person.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)}
    </div>
  );
}

function storagePathFromPersonPhotoUrl(photoUrl: string | undefined) {
  if (!photoUrl) return "";

  try {
    const url = new URL(photoUrl);
    const marker = "/storage/v1/object/public/person-photos/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return "";
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return "";
  }
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-black uppercase tracking-normal text-zinc-600">
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
      className={`min-w-0 rounded-xl border border-zinc-900 bg-white ${className}`}
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
  "min-h-11 min-w-0 w-full rounded-lg border border-zinc-500 bg-white px-3.5 text-base text-black outline-none transition placeholder:text-zinc-400 focus:border-black focus:ring-1 focus:ring-black";

export const buttonClass =
  "inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-center text-sm font-black leading-tight whitespace-normal transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 sm:px-4";

export const primaryButtonClass = `${buttonClass} border border-black bg-black text-white hover:bg-zinc-800`;

export const secondaryButtonClass = `${buttonClass} border border-zinc-500 bg-white text-black hover:border-black hover:bg-zinc-100`;

export const dangerButtonClass = `${buttonClass} border border-red-700 bg-white text-red-700 hover:bg-red-50`;

export const cardClass =
  "block min-w-0 rounded-xl border border-zinc-400 bg-white p-4 transition hover:border-black active:translate-y-px";

export function RosterCardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden rounded-xl border border-zinc-300 bg-white p-3">
      <div className="skeleton size-12 shrink-0 rounded-lg" />
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="skeleton h-4 w-2/5 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton mt-2 h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function RosterListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="grid gap-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <RosterCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function CountBadge({
  label,
  count,
  accent = false,
}: {
  label: string;
  count: number;
  accent?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-black leading-none whitespace-nowrap ${
        accent
          ? "border-accent bg-accent/10 text-accent-ink"
          : "border-zinc-300 bg-white text-zinc-700"
      }`}
    >
      <span className={accent ? "text-accent" : "text-black"}>{count}</span>
      {label}
    </span>
  );
}
