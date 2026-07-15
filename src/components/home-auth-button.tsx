"use client";

import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";
import { useAppAuth } from "@/components/app-auth-provider";
import { isSupabaseConfigured } from "@/lib/supabase";

const cornerButtonClass =
  "flex min-h-11 items-center gap-2 border-2 border-white bg-black px-4 text-sm font-black uppercase tracking-tight text-white transition-[background-color,color,transform] duration-100 hover:border-accent hover:bg-accent hover:text-black active:translate-y-[2px]";

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
        className="hidden max-w-44 truncate text-xs font-bold text-zinc-300 sm:block"
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
