"use client";

import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { inputClass, primaryButtonClass } from "@/components/ui";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) router.replace(nextPath());
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      router.replace("/productions");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase || submitting) return;

    setSubmitting(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    router.replace(nextPath());
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-black px-4 py-8 text-white">
      <section className="w-full max-w-md overflow-hidden border border-zinc-700 bg-white text-black shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
        <div className="border-b border-zinc-800 bg-black p-5 text-white">
          <div className="flex items-center gap-3">
            <span className="ct-mark ct-mark-invert size-11 rounded-sm bg-white text-black" aria-hidden="true" />
            <div>
              <p className="production-kicker text-zinc-400">Production ops</p>
              <h1 className="text-xl font-black uppercase tracking-wider">Capture This</h1>
            </div>
          </div>
        </div>
        <form className="grid gap-3 p-5" onSubmit={signIn}>
          <div className="mb-1 flex items-center gap-2 border border-zinc-300 bg-zinc-100 p-3 text-sm font-black uppercase tracking-wide text-zinc-700">
            <LockKeyhole size={17} aria-hidden="true" />
            Staff entry / shoot-day coffee
          </div>
          <label className="grid gap-1.5 text-xs font-black uppercase tracking-wider text-zinc-600">
            Email
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="runner@capturethis.com"
              autoComplete="email"
              required={isSupabaseConfigured}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-black uppercase tracking-wider text-zinc-600">
            Password
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required={isSupabaseConfigured}
            />
          </label>
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            className={`${primaryButtonClass} mt-2`}
            disabled={submitting}
          >
            {isSupabaseConfigured
              ? submitting
                ? "Signing in"
                : "Sign in"
              : "Continue in demo mode"}
          </button>
          <p className="text-xs leading-5 text-zinc-500">
            {isSupabaseConfigured
              ? "Use a Supabase Auth staff account for production-day access."
              : "Supabase env vars are missing, so this browser uses seeded local demo data."}
          </p>
        </form>
      </section>
    </main>
  );
}

function nextPath() {
  if (typeof window === "undefined") return "/productions";

  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") ? next : "/productions";
}
