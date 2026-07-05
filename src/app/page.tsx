import Link from "next/link";
import { CaptureMark } from "@/components/capture-mark";
import { HomeAuthButton } from "@/components/home-auth-button";

const stations = [
  { href: "/productions", label: "Active day" },
  { href: "/people", label: "Setup" },
];

const stationClass =
  "home-rise grid min-h-16 place-items-center border-[3px] border-black bg-white text-xl font-black uppercase tracking-tight text-black shadow-[5px_5px_0_#000] transition-[background-color,color,transform,box-shadow] duration-100 hover:bg-black hover:text-white active:translate-x-[5px] active:translate-y-[5px] active:shadow-none";

export default function HomePage() {
  return (
    <main className="relative grid min-h-dvh place-items-center px-6 py-12">
      <div className="absolute right-4 top-4">
        <HomeAuthButton />
      </div>
      <div className="w-full max-w-xs sm:max-w-sm">
        <div className="home-rise grid justify-items-center gap-5 text-center">
          <CaptureMark className="size-28 sm:size-32" priority />
          <h1 className="text-4xl font-black uppercase leading-[0.85] tracking-tight sm:text-5xl">
            Capture This
            <span className="block">Coffee</span>
          </h1>
        </div>
        <div className="rule-double mt-6" aria-hidden="true" />
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
            className="home-rise grid min-h-11 place-items-center border-[3px] border-black bg-white text-sm font-black uppercase tracking-tight text-black shadow-[3px_3px_0_#000] transition-[background-color,color,transform,box-shadow] duration-100 hover:bg-black hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            style={{ animationDelay: `${120 + stations.length * 90}ms` }}
          >
            Print labels
          </Link>
        </nav>
      </div>
    </main>
  );
}
