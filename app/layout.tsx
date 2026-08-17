import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";

export const metadata: Metadata = {
  title: {
    default: "Bharat Tracker — India defence & infrastructure data",
    template: "%s · Bharat Tracker",
  },
  description:
    "Source-cited data on Indian defence, infrastructure, trade and manufacturing since 2001. Every number traceable to a named source, with an honest assessment against global benchmarks.",
  openGraph: {
    title: "Bharat Tracker",
    description:
      "Source-cited data on Indian defence, infrastructure, trade and manufacturing since 2001.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-[var(--surface-1)] focus:px-3 focus:py-1.5 focus:text-[12px]"
        >
          Skip to content
        </a>
        <Nav />
        <main id="main" className="mx-auto max-w-[1180px] px-4 pb-20 pt-6 sm:px-6">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
