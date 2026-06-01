"use client";

import Link from "next/link";
import {
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
        <div className="flex items-center gap-3 border border-zinc-300 bg-white p-4 shadow-sm">
          <span className="ct-mark size-10 shrink-0 rounded-sm" aria-hidden="true" />
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-black">Checking staff session</p>
            <p className="text-xs text-zinc-600">Redirecting to login if needed.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-24 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-black bg-black text-white backdrop-blur no-print">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/productions" className="flex min-w-0 items-center gap-3">
            <span className="ct-mark ct-mark-invert size-10 shrink-0 rounded-sm bg-white text-black shadow-sm" aria-hidden="true" />
            <span className="min-w-0">
              {eyebrow ? (
                <span className="production-kicker block truncate text-zinc-400">
                  {eyebrow}
                </span>
              ) : null}
              <span className="block truncate text-lg font-black uppercase leading-tight tracking-wider">
                {title}
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 border border-zinc-700 bg-zinc-950 p-1 md:flex">
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
            <div className="flex max-w-48 items-center gap-1.5 truncate border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs font-black uppercase tracking-wide text-zinc-300">
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
                className="grid min-h-11 min-w-11 place-items-center rounded-sm border border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
                aria-label="Sign out"
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-4 md:py-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black bg-black/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.18)] backdrop-blur md:hidden no-print">
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
  { href: "/clients", icon: <UserRound size={18} />, label: "Clients" },
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
                ? "bg-white text-black"
                : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`
          : `flex min-h-14 flex-col items-center justify-center gap-1 rounded-sm text-xs font-black uppercase tracking-wide ${
              active
                ? "bg-white text-black shadow-sm"
                : "text-zinc-300 active:bg-zinc-800"
            }`
      }
      aria-current={active ? "page" : undefined}
    >
      {icon}
      {label}
    </Link>
  );
}
