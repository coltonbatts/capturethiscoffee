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
  const [redirectingToGoogle, setRedirectingToGoogle] = useState(false);

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

  async function signInWithGoogle() {
    if (supabaseConfigError) {
      setError(supabaseConfigError);
      return;
    }

    const supabase = isSupabaseConfigured ? getSupabaseBrowserClient() : null;
    if (!supabase || submitting || redirectingToGoogle) return;

    setRedirectingToGoogle(true);
    setError("");

    // Come back to this page so the existing session effect finishes the
    // redirect to the requested destination once the OAuth code is exchanged.
    const redirectTo = new URL("/login", window.location.origin);
    const next = new URLSearchParams(window.location.search).get("next");
    if (next?.startsWith("/")) {
      redirectTo.searchParams.set("next", next);
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });

    if (oauthError) {
      setError(oauthError.message);
      setRedirectingToGoogle(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-zinc-950 px-4 py-8 text-white">
      <section className="w-full max-w-md overflow-hidden rounded-xl border border-black bg-white text-black">
        <div className="flex items-center gap-3 border-b border-black bg-black p-5 text-white">
          <CaptureMark invert className="size-11 rounded-xl" />
          <h1 className="text-xl font-semibold">Capture This</h1>
        </div>
        <div className="grid gap-4 p-5">
          {isSupabaseConfigured ? (
            <>
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className={secondaryButtonClass}
                disabled={submitting || redirectingToGoogle}
              >
                <GoogleMark />
                {redirectingToGoogle
                  ? "Opening Google…"
                  : "Continue with Google"}
              </button>
              <div className="flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-zinc-300" />
                <span className="text-xs font-bold uppercase text-zinc-500">
                  or
                </span>
                <span className="h-px flex-1 bg-zinc-300" />
              </div>
            </>
          ) : null}
          <form className="grid gap-4" onSubmit={signIn}>
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
              <div className="rounded-lg border border-red-700 bg-white p-3 text-sm font-bold text-red-700">
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
        </div>
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
      <section className="w-full max-w-md overflow-hidden rounded-xl border border-black bg-white text-black">
        <div className="flex items-center gap-3 border-b border-black bg-black p-5 text-white">
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

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.44 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29a7.21 7.21 0 0 1 0-4.58V6.62H1.27a12 12 0 0 0 0 10.76l4.01-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.59 1.79l3.44-3.44A11.98 11.98 0 0 0 1.27 6.62l4.01 3.09C6.22 6.87 8.87 4.77 12 4.77Z"
      />
    </svg>
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
