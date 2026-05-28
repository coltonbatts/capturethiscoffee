"use client";

import Link from "next/link";
import { Coffee, ContactRound, FolderKanban, Plus } from "lucide-react";
import type { ReactNode } from "react";

type AppShellProps = {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({ title, eyebrow, actions, children }: AppShellProps) {
  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-30 border-b border-stone-300/80 bg-stone-100/95 backdrop-blur no-print">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/productions" className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-stone-950 text-stone-50">
              <Coffee size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              {eyebrow ? (
                <span className="block truncate text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {eyebrow}
                </span>
              ) : null}
              <span className="block truncate text-lg font-bold leading-tight">
                {title}
              </span>
            </span>
          </Link>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-300 bg-stone-50/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(28,25,23,0.08)] backdrop-blur no-print">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
          <NavItem href="/productions" icon={<FolderKanban size={19} />} label="Shoots" />
          <NavItem href="/productions/new" icon={<Plus size={19} />} label="New" />
          <NavItem href="/people" icon={<ContactRound size={19} />} label="People" />
          <NavItem href="/clients" icon={<Coffee size={19} />} label="Clients" />
        </div>
      </nav>
    </div>
  );
}

function NavItem({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold text-stone-600 active:bg-stone-200"
    >
      {icon}
      {label}
    </Link>
  );
}
