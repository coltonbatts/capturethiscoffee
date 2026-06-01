"use client";

import { Coffee } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
      <section className="w-full max-w-sm rounded-2xl border border-stone-300 bg-stone-50 p-5 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-stone-950 text-stone-50">
            <Coffee size={21} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold">Capture This Coffee</h1>
            <p className="text-sm text-stone-600">Staff runner login</p>
          </div>
        </div>
        <form className="grid gap-3" onSubmit={signIn}>
          <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
            Email
            <input
              className="min-h-12 rounded-xl border border-stone-300 bg-white px-3 text-base outline-none focus:border-stone-800"
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
              className="min-h-12 rounded-xl border border-stone-300 bg-white px-3 text-base outline-none focus:border-stone-800"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required={isSupabaseConfigured}
            />
          </label>
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            className="mt-2 inline-flex min-h-12 items-center justify-center rounded-xl bg-stone-950 px-4 text-sm font-bold text-white"
            disabled={submitting}
          >
            {isSupabaseConfigured
              ? submitting
                ? "Signing in"
                : "Sign in"
              : "Continue in demo mode"}
          </button>
        </form>
        <p className="mt-4 text-xs leading-5 text-stone-500">
          {isSupabaseConfigured
            ? "Use a Supabase Auth demo staff account created for this client-side walkthrough."
            : "Supabase env vars are missing, so this local run uses seeded demo data in this browser only."}
        </p>
      </section>
    </main>
  );
}

function nextPath() {
  if (typeof window === "undefined") return "/productions";

  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") ? next : "/productions";
}
