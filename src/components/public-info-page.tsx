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
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <article className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#000]">
        <header className="border-b-[3px] border-black bg-black px-5 py-6 text-white sm:px-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <CaptureMark className="size-12 rounded-full" priority />
            <span className="grid">
              <span className="text-lg font-black uppercase leading-none tracking-tight">
                Capture This
              </span>
              <span className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-accent">
                Coffee
              </span>
            </span>
          </Link>
          <h1 className="mt-8 text-3xl font-black tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
            {summary}
          </p>
        </header>
        <div className="public-info-content grid gap-7 px-5 py-7 text-[15px] leading-7 sm:px-8 sm:py-9">
          {children}
        </div>
        <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t-[3px] border-black bg-accent px-5 py-4 text-sm font-black sm:px-8">
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy
          </Link>
          <Link href="/support" className="underline underline-offset-4">
            Support
          </Link>
          <Link href="/" className="underline underline-offset-4">
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
      <h2 className="text-xl font-black tracking-tight">{title}</h2>
      <div className="mt-2 grid gap-3">{children}</div>
    </section>
  );
}
