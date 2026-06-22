"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { OrderStatus, Person } from "@/lib/types";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

const statusStyles: Record<OrderStatus, string> = {
  not_asked: "bg-white text-zinc-700 border-zinc-400 border-dashed",
  confirmed: "bg-white text-black border-black",
  ordered: "bg-black text-white border-black",
  picked_up: "bg-zinc-800 text-white border-zinc-800",
  delivered: "bg-zinc-200 text-black border-zinc-500",
  no_order: "bg-white text-red-700 border-red-700",
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
      className={`inline-flex min-h-7 shrink-0 items-center rounded-md border px-2.5 text-xs font-black leading-none ${statusStyles[status]}`}
    >
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
      className={`rounded-xl border border-zinc-900 bg-white ${className}`}
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
  "min-h-11 w-full rounded-lg border border-zinc-500 bg-white px-3.5 text-base text-black outline-none transition placeholder:text-zinc-400 focus:border-black focus:ring-1 focus:ring-black";

export const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black leading-tight transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButtonClass = `${buttonClass} border border-black bg-black text-white hover:bg-zinc-800`;

export const secondaryButtonClass = `${buttonClass} border border-zinc-500 bg-white text-black hover:border-black hover:bg-zinc-100`;

export const dangerButtonClass = `${buttonClass} border border-red-700 bg-white text-red-700 hover:bg-red-50`;

export const cardClass =
  "block rounded-xl border border-zinc-400 bg-white p-4 transition hover:border-black active:translate-y-px";
