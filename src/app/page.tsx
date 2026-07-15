import Link from "next/link";
import { CaptureMark } from "@/components/capture-mark";
import { HomeAuthButton } from "@/components/home-auth-button";

const stations = [
  { href: "/productions", label: "Active day" },
  { href: "/people", label: "Setup" },
];

const stationClass =
  "home-rise grid min-h-16 place-items-center border-[3px] border-black bg-accent text-xl font-black uppercase tracking-tight text-black shadow-[5px_5px_0_#fff] transition-[background-color,color,transform,box-shadow] duration-100 hover:bg-white active:translate-x-[5px] active:translate-y-[5px] active:shadow-none";

export default function HomePage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-black px-6 py-16 text-white">
      <div
        className="pointer-events-none absolute -bottom-24 -left-20 size-72 rotate-12 bg-accent sm:size-96"
        aria-hidden="true"
      />
      <div className="absolute right-4 top-4">
        <HomeAuthButton />
      </div>
      <div className="w-full max-w-xs sm:max-w-sm">
        <div className="home-rise grid justify-items-center gap-5 text-center">
          <CaptureMark className="size-28 rounded-full sm:size-32" priority />
          <h1 className="text-4xl font-black uppercase leading-[0.85] tracking-tight sm:text-5xl">
            Capture This
            <span className="block">Coffee</span>
          </h1>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-accent">
            On-set coffee operations
          </p>
        </div>
        <div className="mt-6 border-b-[3px] border-double border-white" aria-hidden="true" />
        <nav aria-label="Stations" className="mt-9 grid gap-5">
          {stations.map((station, index) => (
            <Link
              key={station.href}
              href={station.href}
              className={stationClass}
              style={{ animationDelay: `${120 + index * 90}ms` }}
            >
              {station.label}
            </Link>
          ))}
          <Link
            href="/labels"
            className="home-rise grid min-h-11 place-items-center border-2 border-white bg-black text-sm font-black uppercase tracking-tight text-white transition-[background-color,color,transform] duration-100 hover:border-accent hover:bg-accent hover:text-black active:translate-y-[2px]"
            style={{ animationDelay: `${120 + stations.length * 90}ms` }}
          >
            Print labels
          </Link>
        </nav>
      </div>
    </main>
  );
}
