import Link from "next/link";
import { Coffee } from "lucide-react";

export default function LoginPage() {
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
        <form className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
            Email
            <input
              className="min-h-12 rounded-xl border border-stone-300 bg-white px-3 text-base outline-none focus:border-stone-800"
              type="email"
              placeholder="runner@capturethis.com"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
            Password
            <input
              className="min-h-12 rounded-xl border border-stone-300 bg-white px-3 text-base outline-none focus:border-stone-800"
              type="password"
              placeholder="••••••••"
            />
          </label>
          <Link
            href="/productions"
            className="mt-2 inline-flex min-h-12 items-center justify-center rounded-xl bg-stone-950 px-4 text-sm font-bold text-white"
          >
            Continue to productions
          </Link>
        </form>
        <p className="mt-4 text-xs leading-5 text-stone-500">
          Supabase Auth wiring is scaffolded; this MVP keeps login as a staff
          entry point while workflow screens are built.
        </p>
      </section>
    </main>
  );
}
