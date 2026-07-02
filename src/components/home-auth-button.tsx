"use client";

import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";
import { useAppAuth } from "@/components/app-auth-provider";
import { isSupabaseConfigured } from "@/lib/supabase";

const cornerButtonClass =
  "flex min-h-11 items-center gap-2 border-[3px] border-black bg-white px-4 text-sm font-black uppercase tracking-tight text-black shadow-[4px_4px_0_#000] transition-[background-color,color,transform,box-shadow] duration-100 hover:bg-black hover:text-white active:translate-x-[4px] active:translate-y-[4px] active:shadow-none";

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
        className="hidden max-w-44 truncate text-xs font-bold text-zinc-600 sm:block"
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
