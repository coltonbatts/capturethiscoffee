"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
type AvatarPerson = { name: string; photo_url?: string };
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export function Avatar({ person }: { person: AvatarPerson }) {
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
        className="size-12 rounded-full object-cover ring-1 ring-black/15"
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

function AvatarFallback({ person }: { person: AvatarPerson }) {
  return (
    <div className="grid size-12 place-items-center rounded-full bg-black text-sm font-semibold text-white">
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
    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-zinc-600">
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
  const dialogRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );

  useEffect(() => {
    const trigger = triggerRef.current;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);

      if (!first || !last) {
        event.preventDefault();
        dialogRef.current.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialogRef.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) {
      dialog
        .querySelector<HTMLElement>(
          'input[autofocus], button, input, select, textarea, a[href]',
        )
        ?.focus();
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [onClose]);

  const panelClass =
    "mx-auto flex max-h-[92dvh] w-full max-w-md min-w-0 flex-col overflow-hidden rounded-t-2xl border border-b-0 border-black/20 bg-[#fffdf8] sm:max-h-[85dvh] sm:rounded-xl sm:border-b";

  const inner = (
    <>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-black/15 px-5 py-3">
        <h2
          id={titleId}
          className="min-w-0 truncate text-lg font-semibold leading-tight tracking-[-0.025em] text-black"
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-black/15 bg-transparent text-black transition hover:border-black hover:bg-black hover:text-white active:translate-y-px"
          aria-label="Close"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain p-5">
        {children}
      </div>
      <footer className="shrink-0 border-t border-black/15 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {footer}
      </footer>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 grid items-end bg-black/45 pt-10 backdrop-blur-[2px] no-print sm:items-center sm:p-4">
      {asForm ? (
        <form
          ref={(node) => {
            dialogRef.current = node;
          }}
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
          ref={(node) => {
            dialogRef.current = node;
          }}
          tabIndex={-1}
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
      className={`min-w-0 rounded-xl border border-black/15 bg-[#fffdf8] ${className}`}
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
    <Panel className="grid justify-items-center gap-4 px-6 py-10 text-center">
      <span
        className="grid size-9 place-items-center rounded-full bg-accent text-lg font-semibold text-black"
        aria-hidden="true"
      >
        :)
      </span>
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.025em] text-black">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-zinc-600">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex justify-center">{action}</div> : null}
    </Panel>
  );
}

export const inputClass =
  "min-h-11 min-w-0 w-full rounded-lg border border-black/25 bg-[#fffdf8] px-3.5 text-base text-black outline-none transition-[border-color,box-shadow,background-color] placeholder:text-zinc-400 hover:border-black/45 focus:border-black focus:bg-white focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:bg-black/[0.04] disabled:text-zinc-500";

export const buttonClass =
  "inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-center text-sm font-semibold leading-tight tracking-[-0.01em] whitespace-normal transition-[background-color,border-color,color,transform] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 sm:px-4";

export const primaryButtonClass = `${buttonClass} border border-black bg-black text-white hover:bg-transparent hover:text-black`;

export const secondaryButtonClass = `${buttonClass} border border-black/20 bg-transparent text-black hover:border-black hover:bg-white`;

export const dangerButtonClass = `${buttonClass} border border-red-800/45 bg-transparent text-red-800 hover:border-red-800 hover:bg-red-50`;

export const cardClass =
  "block min-w-0 rounded-xl border border-black/15 bg-[#fffdf8] p-4 transition-[border-color,background-color,transform] hover:border-black/40 hover:bg-white active:translate-y-px";

export const pageHeaderClass =
  "mb-7 min-w-0 border-b border-black/15 pb-6";

export const pageTitleClass =
  "text-3xl font-semibold leading-none tracking-[-0.055em] text-black sm:text-4xl";

export const pageIntroClass =
  "mt-2 max-w-2xl text-sm font-normal leading-6 text-zinc-600 sm:text-base";

export const alertErrorClass =
  "rounded-lg border border-red-800/35 bg-red-50/60 px-4 py-3 text-sm font-medium text-red-900";

export const alertStatusClass =
  "rounded-lg border border-black/15 bg-[#fffdf8] px-4 py-3 text-sm font-medium text-black";

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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap ${
        accent
          ? "border-black/10 bg-accent text-accent-ink"
          : "border-black/15 bg-transparent text-zinc-700"
      }`}
    >
      <span className={accent ? "text-accent" : "text-black"}>{count}</span>
      {label}
    </span>
  );
}
