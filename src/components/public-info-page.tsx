import Link from "next/link";
import type { ReactNode } from "react";
import { CaptureMark } from "@/components/capture-mark";

export function PublicInfoPage({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-background px-4 py-7 text-foreground sm:px-6 sm:py-12">
      <article className="mx-auto w-full max-w-3xl">
        <header className="border-b border-black/15 pb-8">
          <Link href="/" className="inline-flex min-h-11 items-center gap-3">
            <CaptureMark className="size-10 rounded-full" priority />
            <span className="grid">
              <span className="text-sm font-semibold leading-none tracking-[-0.02em]">
                Capture This Coffee
              </span>
              <span className="mt-1 text-[11px] font-medium text-zinc-500">Production-day coffee</span>
            </span>
          </Link>
          <h1 className="mt-14 text-4xl font-semibold leading-none tracking-[-0.055em] sm:text-6xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
            {summary}
          </p>
        </header>
        <div className="public-info-content grid gap-9 py-9 text-[15px] leading-7 sm:py-12">
          {children}
        </div>
        <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t border-black/15 py-6 text-sm font-semibold">
          <Link href="/privacy" className="inline-flex min-h-11 items-center underline underline-offset-4">
            Privacy
          </Link>
          <Link href="/support" className="inline-flex min-h-11 items-center underline underline-offset-4">
            Support
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center underline underline-offset-4">
            Capture This Coffee
          </Link>
        </footer>
      </article>
    </main>
  );
}

export function PublicInfoSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-[-0.025em]">{title}</h2>
      <div className="mt-2 grid gap-3">{children}</div>
    </section>
  );
}
