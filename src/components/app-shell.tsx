"use client";

import Link from "next/link";
import {
  BadgePlus,
  ContactRound,
  FolderKanban,
  LogOut,
  UserRound,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { CaptureMark } from "@/components/capture-mark";
import { isStaffUser } from "@/lib/auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

type AppShellProps = {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({ title, actions, children }: AppShellProps) {
  const auth = useShellAuth();

  if (!auth.ready) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <CaptureMark className="size-12 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-24 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-black text-white backdrop-blur no-print">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <CaptureMark invert className="size-10 rounded-xl shadow-sm" />
            <span className="block truncate text-lg font-semibold leading-tight">
              {title}
            </span>
          </Link>
          <nav className="hidden items-center gap-1 rounded-2xl border border-zinc-700 bg-zinc-950 p-1 md:flex">
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
            {auth.email ? (
              <div
                className="hidden max-w-48 items-center gap-1.5 truncate rounded-xl border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-300 sm:flex"
                title={auth.email}
              >
                <UserRound size={15} aria-hidden="true" />
                <span className="truncate">{auth.email}</span>
              </div>
            ) : null}
            {actions ? <div className="shrink-0">{actions}</div> : null}
            {isSupabaseConfigured ? (
              <button
                type="button"
                onClick={auth.signOut}
                className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
                aria-label="Sign out"
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 md:py-7">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-black/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur md:hidden no-print">
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

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;

      if (!data.session) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/productions")}`);
        return;
      }

      if (!isStaffUser(data.session.user)) {
        await supabase.auth.signOut();
        router.replace("/login?staff=1");
        return;
      }

      setEmail(data.session.user.email || "");
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (!session) {
        setReady(false);
        router.replace("/login");
        return;
      }

      if (!isStaffUser(session.user)) {
        await supabase.auth.signOut();
        router.replace("/login?staff=1");
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
  { href: "/", icon: <BadgePlus size={18} />, label: "Labels" },
  { href: "/productions", icon: <FolderKanban size={18} />, label: "Shoots" },
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
    href === "/"
      ? pathname === href
      : href === "/productions"
      ? pathname === href ||
        (pathname.startsWith("/productions/") && pathname !== "/productions/new")
      : pathname === href;

  return (
    <Link
      href={href}
      className={
        compact
          ? `inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium ${
              active
                ? "bg-white text-black"
                : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`
          : `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium ${
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
