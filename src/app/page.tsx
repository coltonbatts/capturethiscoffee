import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CaptureMark } from "@/components/capture-mark";
import { HomeAuthButton } from "@/components/home-auth-button";
import styles from "./page.module.css";

const secondaryLinks = [
  { href: "/productions", label: "Productions" },
  { href: "/people", label: "People" },
  { href: "/labels", label: "Print labels" },
];

export const metadata: Metadata = {
  description: "Coffee orders for production days.",
};

export const viewport: Viewport = {
  themeColor: "#f7f3ea",
};

export default function HomePage() {
  return (
    <main className={styles.page}>
      <a href="#home-content" className={styles.skipLink}>
        Skip to content
      </a>

      <header className={styles.header}>
        <p className={styles.utilityLabel}>Coffee for production days</p>
        <HomeAuthButton />
      </header>

      <section id="home-content" className={styles.hero}>
        <div className={styles.markStage}>
          <CaptureMark
            className={styles.mark}
            priority
            sizes="(max-width: 859px) 68vw, 42vw"
            title="Capture This smiley"
          />
        </div>

        <div className={styles.copy}>
          <h1 className={styles.title}>
            <span>Capture This</span>
            <span>Coffee</span>
          </h1>

          <p className={styles.supporting}>
            Good coffee. Even on a 5 AM call.
          </p>

          <Link href="/productions" className={styles.primaryAction}>
            <span>Open productions</span>
            <ArrowRight size={19} strokeWidth={2.2} aria-hidden="true" />
          </Link>

          <nav aria-label="Coffee operations" className={styles.secondaryNav}>
            <span className={styles.navLabel}>Go to</span>
            <div className={styles.navLinks}>
              {secondaryLinks.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </section>
    </main>
  );
}
