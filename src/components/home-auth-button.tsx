"use client";

import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";
import { useAppAuth } from "@/components/app-auth-provider";
import { isSupabaseConfigured } from "@/lib/supabase";

const cornerButtonClass =
  "flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-transparent px-4 text-sm font-semibold tracking-[-0.01em] text-black transition-[background-color,border-color,color,transform] duration-200 hover:border-black hover:bg-black hover:text-white active:scale-[0.98]";

export function HomeAuthButton() {
  const { initialized, email, signOut } = useAppAuth();

  if (!isSupabaseConfigured || !initialized) return null;

  if (!email) {
    return (
      <Link href="/login" className={cornerButtonClass}>
        <LogIn size={16} aria-hidden="true" />
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <span
        className="hidden max-w-44 truncate text-xs font-medium text-zinc-500 sm:block"
        title={email}
      >
        {email}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className={cornerButtonClass}
      >
        <LogOut size={16} aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}
