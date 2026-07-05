"use client";

import Link from "next/link";
import { LogIn, LogOut, Printer, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { CaptureMark } from "@/components/capture-mark";
import { useAppAuth } from "@/components/app-auth-provider";
import { isSupabaseConfigured } from "@/lib/supabase";

type AppShellProps = {
  title: string;
  actions?: ReactNode;
  requireAuth?: boolean;
  children: ReactNode;
};

export function AppShell({ title, actions, requireAuth = false, children }: AppShellProps) {
  const auth = useShellAuth(requireAuth);

  if (!auth.ready) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <CaptureMark className="size-12 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-black bg-white no-print">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:px-6">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-3">
            <CaptureMark className="size-9 rounded-lg" priority />
            <span className="hidden truncate text-lg font-black leading-tight sm:block">
              {title}
            </span>
          </Link>
          <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
            <Link
              href="/labels"
              className="hidden sm:grid min-h-11 min-w-11 place-items-center rounded-lg border border-zinc-300 bg-white text-zinc-600 hover:border-black hover:bg-zinc-100 hover:text-black"
              aria-label="Open label printing"
            >
              <Printer size={18} aria-hidden="true" />
            </Link>
            {auth.email ? (
              <div
                className="hidden max-w-48 items-center gap-1.5 truncate text-xs text-zinc-500 sm:flex"
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
                className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-zinc-500 bg-white text-black hover:border-black hover:bg-zinc-100"
                aria-label="Sign out"
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            ) : isSupabaseConfigured ? (
              <Link
                href={`/login?next=${encodeURIComponent(pathnameForLogin())}`}
                className="flex min-h-11 items-center gap-1.5 rounded-lg border border-black bg-black px-3.5 text-sm font-black text-white hover:bg-zinc-800"
              >
                <LogIn size={16} aria-hidden="true" />
                Sign in
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 md:py-7">{children}</main>
    </div>
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
      router.replace(`/login?next=${encodeURIComponent(pathname || "/productions")}`);
    }
  }, [appUser, initialized, pathname, requireAuth, router]);

  return { ready, email, signOut };
}

function pathnameForLogin() {
  if (typeof window === "undefined") return "/productions";
  return `${window.location.pathname}${window.location.search}`;
}
