"use client";

import Link from "next/link";
import {
  Coffee,
  ContactRound,
  FolderKanban,
  LogOut,
  Plus,
  UserRound,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

type AppShellProps = {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({ title, eyebrow, actions, children }: AppShellProps) {
  const auth = useShellAuth();

  if (!auth.ready) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-stone-950 text-stone-50">
            <Coffee size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-stone-950">Checking staff session</p>
            <p className="text-xs text-stone-600">Redirecting to login if needed.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-24 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-[rgba(250,248,242,0.92)] backdrop-blur no-print">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/productions" className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-stone-950 text-stone-50 shadow-sm">
              <Coffee size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              {eyebrow ? (
                <span className="block truncate text-[11px] font-bold uppercase text-stone-500">
                  {eyebrow}
                </span>
              ) : null}
              <span className="block truncate text-lg font-black leading-tight">
                {title}
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 rounded-lg border border-stone-200 bg-white/80 p-1 md:flex">
            {navItems.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                compact
              />
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex max-w-48 items-center gap-1.5 truncate rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs font-bold text-stone-700">
              <UserRound size={15} aria-hidden="true" />
              <span className="hidden truncate sm:inline">
                {auth.email || (isSupabaseConfigured ? "Signed in" : "Demo mode")}
              </span>
              <span className="sm:hidden">
                {isSupabaseConfigured ? "Staff" : "Demo"}
              </span>
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
            {isSupabaseConfigured ? (
              <button
                type="button"
                onClick={auth.signOut}
                className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                aria-label="Sign out"
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-4 md:py-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(28,25,23,0.08)] backdrop-blur md:hidden no-print">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
            />
          ))}
        </div>
      </nav>
    </div>
  );
}

function useShellAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      if (!data.session) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/productions")}`);
        return;
      }

      setEmail(data.session.user.email || "");
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      if (!session) {
        setReady(false);
        router.replace("/login");
        return;
      }

      setEmail(session.user.email || "");
      setReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return { ready, email, signOut };
}

const navItems = [
  { href: "/productions", icon: <FolderKanban size={18} />, label: "Shoots" },
  { href: "/productions/new", icon: <Plus size={18} />, label: "New" },
  { href: "/people", icon: <ContactRound size={18} />, label: "People" },
  { href: "/clients", icon: <Coffee size={18} />, label: "Clients" },
];

function NavItem({
  href,
  icon,
  label,
  compact = false,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const active =
    href === "/productions"
      ? pathname === href ||
        (pathname.startsWith("/productions/") && pathname !== "/productions/new")
      : pathname === href;

  return (
    <Link
      href={href}
      className={
        compact
          ? `inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-bold ${
              active
                ? "bg-stone-950 text-white"
                : "text-stone-600 hover:bg-stone-100"
            }`
          : `flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs font-bold ${
              active
                ? "bg-stone-950 text-white shadow-sm"
                : "text-stone-600 active:bg-stone-100"
            }`
      }
      aria-current={active ? "page" : undefined}
    >
      {icon}
      {label}
    </Link>
  );
}
