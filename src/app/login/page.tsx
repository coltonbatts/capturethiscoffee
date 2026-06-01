"use client";

import { Coffee, LockKeyhole } from "lucide-react";
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
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <section className="w-full max-w-md overflow-hidden rounded-lg border border-stone-200 bg-white shadow-[0_18px_60px_rgba(28,25,23,0.12)]">
        <div className="border-b border-stone-200 bg-stone-950 p-5 text-white">
          <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-lg bg-white text-stone-950">
            <Coffee size={21} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-black">Capture This Coffee</h1>
            <p className="text-sm text-stone-300">Staff runner entry</p>
          </div>
          </div>
        </div>
        <form className="grid gap-3 p-5" onSubmit={signIn}>
          <div className="mb-1 flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm font-semibold text-stone-700">
            <LockKeyhole size={17} aria-hidden="true" />
            Internal shoot-day coffee workflow
          </div>
          <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
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
          <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
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
          <p className="text-xs leading-5 text-stone-500">
            {isSupabaseConfigured
              ? "Use a Supabase Auth staff account for this demo."
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
