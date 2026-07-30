"use client";

import Link from "next/link";
import { LogIn, LogOut, Printer, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { CaptureMark } from "@/components/capture-mark";
import { useAppAuth } from "@/components/app-auth-provider";
import { isSupabaseConfigured, supabaseConfigError } from "@/lib/supabase";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type AppShellProps = {
  title: string;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  requireAuth?: boolean;
  children: ReactNode;
};

export function AppShell({
  title,
  actions,
  breadcrumbs = [],
  requireAuth = false,
  children,
}: AppShellProps) {
  const auth = useShellAuth(requireAuth);

  if (requireAuth && supabaseConfigError) {
    return (
      <main className="grid min-h-dvh place-items-center px-4 py-8">
        <section className="w-full max-w-lg rounded-xl border border-black/15 bg-[#fffdf8] p-6">
          <h1 className="text-xl font-semibold tracking-tight">
            Supabase configuration required
          </h1>
          <p className="mt-3 rounded-lg border border-red-700 p-3 text-sm font-bold text-red-700">
            {supabaseConfigError}
          </p>
        </section>
      </main>
    );
  }

  if (!auth.ready) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <CaptureMark className="size-12 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <a
        href="#app-content"
        className="fixed left-3 top-3 z-50 -translate-y-24 bg-black px-4 py-3 text-sm font-semibold text-white transition focus:translate-y-0"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-black/15 bg-[#f7f3ea]/95 text-black backdrop-blur-md no-print">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5">
            <CaptureMark className="size-9 rounded-full" priority />
            <span className="hidden min-w-0 sm:grid">
              <span className="truncate text-sm font-semibold leading-none tracking-[-0.02em] text-black">
                Capture This
              </span>
              <span className="mt-1 truncate text-[11px] font-medium leading-none text-zinc-500">
                {title}
              </span>
            </span>
          </Link>
          <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
            <Link
              href="/labels"
                className="hidden min-h-11 min-w-11 place-items-center rounded-full border border-black/15 bg-transparent text-black transition hover:border-black hover:bg-black hover:text-white sm:grid"
              aria-label="Open label printing"
            >
              <Printer size={18} aria-hidden="true" />
            </Link>
            {auth.email ? (
              <div
                className="hidden max-w-48 items-center gap-1.5 truncate text-xs text-zinc-500 md:flex"
                title={auth.email}
              >
                <UserRound size={15} aria-hidden="true" />
                <span className="truncate">{auth.email}</span>
              </div>
            ) : null}
            {actions ? <div className="min-w-0 shrink">{actions}</div> : null}
            {isSupabaseConfigured && auth.email ? (
              <button
                type="button"
                onClick={auth.signOut}
                className="grid min-h-11 min-w-11 place-items-center rounded-full border border-black/15 bg-transparent text-black transition hover:border-black hover:bg-black hover:text-white"
                aria-label="Sign out"
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            ) : isSupabaseConfigured ? (
              <Link
                href={`/login?next=${encodeURIComponent(pathnameForLogin())}`}
                className="flex min-h-11 items-center gap-1.5 rounded-lg border border-black bg-black px-3.5 text-sm font-semibold text-white transition hover:bg-transparent hover:text-black"
              >
                <LogIn size={16} aria-hidden="true" />
                Sign in
              </Link>
            ) : null}
          </div>
        </div>
        {breadcrumbs.length ? <ShellBreadcrumbs items={breadcrumbs} /> : null}
      </header>

      <main id="app-content" className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 md:py-10">
        {children}
      </main>
    </div>
  );
}

function ShellBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="border-t border-black/10 text-black">
      <ol className="mx-auto flex max-w-6xl items-center gap-1.5 overflow-x-auto px-4 py-2 text-[11px] font-medium leading-none text-black/55 sm:px-6 sm:text-xs">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <li
              key={`${item.href || item.label}-${index}`}
              className="flex min-w-0 shrink-0 items-center gap-1.5"
            >
              {index > 0 ? (
                <span className="text-black/35" aria-hidden="true">
                  /
                </span>
              ) : null}
              {item.href && !isCurrent ? (
                <Link
                  href={item.href}
                  className="rounded-sm text-black/55 underline-offset-4 transition hover:text-black hover:underline focus-visible:text-black"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isCurrent ? "page" : undefined}
                  className="max-w-[60vw] truncate text-black sm:max-w-xs"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function useShellAuth(requireAuth: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const { initialized, appUser, email, signOut } = useAppAuth();
  const ready =
    !isSupabaseConfigured ||
    (initialized && (!requireAuth || Boolean(appUser)));

  useEffect(() => {
    if (!requireAuth || !isSupabaseConfigured || !initialized) return;

    if (!appUser) {
      router.replace(
        `/login?next=${encodeURIComponent(pathname || "/productions")}`,
      );
    }
  }, [appUser, initialized, pathname, requireAuth, router]);

  return { ready, email, signOut };
}

function pathnameForLogin() {
  if (typeof window === "undefined") return "/productions";
  return `${window.location.pathname}${window.location.search}`;
}
