"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CaptureMark } from "@/components/capture-mark";
import {
  Field,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { useAppAuth } from "@/components/app-auth-provider";
import { AUTH_ACCESS_MESSAGE } from "@/lib/auth";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  supabaseConfigError,
} from "@/lib/supabase";

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
  const { initialized, appUser, isAdmin, signOut, applyAppUser } = useAppAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(supabaseConfigError);
  const [submitting, setSubmitting] = useState(false);

  const needsAdmin = isSupabaseConfigured && initialized && Boolean(appUser) && !isAdmin;

  useEffect(() => {
    if (supabaseConfigError) {
      return;
    }

    if (!isSupabaseConfigured) {
      router.replace(nextPath());
      return;
    }

    if (!initialized || !appUser) return;

    // A signed-in account without admin metadata can't use the setup tools.
    // Keep them on this page to explain why rather than redirecting into a
    // route the proxy will just bounce back.
    if (!isAdmin) return;

    router.replace(nextPath());
    router.refresh();
  }, [appUser, initialized, isAdmin, router]);

  if (needsAdmin) {
    return <NeedsAdminNotice email={appUser?.email || ""} onSignOut={signOut} />;
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (supabaseConfigError) {
      setError(supabaseConfigError);
      return;
    }

    if (!isSupabaseConfigured) {
      router.replace("/productions");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const { data, error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        }),
        "Sign-in is taking too long. Check your connection and try again.",
      );

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (!data.user || !data.session?.access_token) {
        await supabase.auth.signOut();
        setError(AUTH_ACCESS_MESSAGE);
        return;
      }

      applyAppUser(data.user);
      router.replace(nextPath());
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
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
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
              {error}
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

function NeedsAdminNotice({
  email,
  onSignOut,
}: {
  email: string;
  onSignOut: () => Promise<void>;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-zinc-950 px-4 py-8 text-white">
      <section className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-700 bg-white text-black shadow-xl">
        <div className="flex items-center gap-3 border-b border-zinc-200 bg-black p-5 text-white">
          <CaptureMark invert className="size-11 rounded-xl" />
          <h1 className="text-xl font-semibold">Capture This</h1>
        </div>
        <div className="grid gap-4 p-5">
          <div className="grid gap-2">
            <h2 className="text-lg font-bold text-black">
              This account needs admin access
            </h2>
            <p className="text-sm font-medium leading-6 text-zinc-600">
              {email ? (
                <>
                  You&apos;re signed in as{" "}
                  <span className="font-semibold text-black">{email}</span>, but
                  this account can&apos;t manage clients, people, or productions
                  yet.
                </>
              ) : (
                "You're signed in, but this account can't manage clients, people, or productions yet."
              )}
            </p>
            <p className="text-sm font-medium leading-6 text-zinc-600">
              Ask an admin to turn on admin access for your account, then sign
              out and back in.
            </p>
          </div>
          <Link href="/productions" className={primaryButtonClass}>
            Go to today&apos;s jobs
          </Link>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className={secondaryButtonClass}
          >
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}

function nextPath() {
  if (typeof window === "undefined") return "/productions";

  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") ? next : "/productions";
}

function withTimeout<T>(promise: Promise<T>, message: string, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}
