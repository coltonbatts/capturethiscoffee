"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CaptureMark } from "@/components/capture-mark";
import { Field, inputClass, primaryButtonClass } from "@/components/ui";
import { isStaffUser, STAFF_ACCESS_MESSAGE } from "@/lib/auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center bg-zinc-950 px-4 py-8">
          <CaptureMark invert className="size-11 animate-pulse rounded-xl" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const staffDenied = searchParams.get("staff") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted || !data.session) return;

      if (!isStaffUser(data.session.user)) {
        await supabase.auth.signOut();
        if (mounted) setError(STAFF_ACCESS_MESSAGE);
        return;
      }

      router.replace(nextPath());
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

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    if (!isStaffUser(signInData.user)) {
      await supabase.auth.signOut();
      setError(STAFF_ACCESS_MESSAGE);
      setSubmitting(false);
      return;
    }

    router.replace(nextPath());
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-zinc-950 px-4 py-8 text-white">
      <section className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-700 bg-white text-black shadow-xl">
        <div className="flex items-center gap-3 border-b border-zinc-200 bg-black p-5 text-white">
          <CaptureMark invert className="size-11 rounded-xl" />
          <h1 className="text-xl font-semibold">Capture This</h1>
        </div>
        <form className="grid gap-4 p-5" onSubmit={signIn}>
          <Field label="Email">
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@studio.com"
              autoComplete="email"
              required={isSupabaseConfigured}
            />
          </Field>
          <Field label="Password">
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required={isSupabaseConfigured}
            />
          </Field>
          {staffDenied || error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
              {staffDenied ? STAFF_ACCESS_MESSAGE : error}
            </div>
          ) : null}
          <button
            type="submit"
            className={`${primaryButtonClass} mt-1`}
            disabled={submitting}
          >
            {isSupabaseConfigured
              ? submitting
                ? "Signing in…"
                : "Sign in"
              : "Continue"}
          </button>
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
