"use client";

import { X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import type { Person } from "@/lib/types";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

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
    <label className="grid min-w-0 gap-1 text-xs font-black uppercase tracking-normal text-zinc-600">
      {label}
      {children}
    </label>
  );
}

/**
 * Modal edit sheet: flush bottom sheet on phones, centered dialog on larger
 * screens. Header (title + close) and footer (actions) stay pinned so the
 * primary action is always reachable; only the fields scroll.
 */
export function Sheet({
  title,
  onClose,
  footer,
  children,
  asForm,
  onSubmit,
}: {
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
  asForm?: boolean;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const titleId = useId();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const panelClass =
    "mx-auto flex max-h-[92dvh] w-full max-w-md min-w-0 flex-col overflow-hidden rounded-t-2xl border-[3px] border-b-0 border-black bg-white sm:max-h-[85dvh] sm:rounded-xl sm:border-b-[3px] sm:shadow-[6px_6px_0_#000]";

  const inner = (
    <>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b-[3px] border-black px-4 py-2.5">
        <h2
          id={titleId}
          className="min-w-0 truncate text-lg font-black uppercase leading-tight tracking-tight text-black"
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="grid size-11 shrink-0 place-items-center rounded-lg border-2 border-black bg-white text-black transition hover:bg-zinc-100 active:translate-y-px"
          aria-label="Close"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto overscroll-contain p-4">
        {children}
      </div>
      <footer className="shrink-0 border-t-[3px] border-black p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
        {footer}
      </footer>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 grid items-end bg-black/55 pt-10 no-print sm:items-center sm:p-4">
      {asForm ? (
        <form
          onSubmit={onSubmit}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={panelClass}
        >
          {inner}
        </form>
      ) : (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={panelClass}
        >
          {inner}
        </section>
      )}
    </div>
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
