import type { Metadata } from "next";
import { Spectral, Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";

/*
  Three faces, one job each.

  The site ran on system-ui for everything, which is why it read as a tool
  rather than as a publication. A record of what a country built deserves the
  typography of a record.

  Spectral carries the headlines: a serif drawn for screens, low enough in
  contrast to hold at 15px and sharp enough to mean something at 64px.
  Archivo does the work — a grotesque with a tall x-height that stays legible
  in a dense table, which is most of this site. Plex Mono takes every figure,
  eyebrow and source line, because in a publication about measurement the
  numbers should look measured.

  Loaded through next/font so they are self-hosted, subset, and preloaded with
  a matched fallback — no layout shift and no third-party request at runtime.
*/
const display = Spectral({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display-loaded",
  display: "swap",
});
const sans = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans-loaded",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-loaded",
  display: "swap",
});

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
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
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
