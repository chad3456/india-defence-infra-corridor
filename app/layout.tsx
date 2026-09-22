import type { Metadata } from "next";
import { Spectral, Archivo, IBM_Plex_Mono, Caveat } from "next/font/google";
import "./globals.css";
import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import ToastHost from "@/components/ui/ToastHost";

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
/*
  The annotating hand.
 
  Used only inside `.ink`, which is the walkthrough's register: a page whose
  argument is that a drawing of a contested event must not look like a
  photograph of one. A marginal note in someone's handwriting reads as a
  person's claim; the same words set in the body grotesque read as the site's
  finding. That difference is the whole point of the page, so it is carried by
  the typeface rather than explained in a caption.
 
  One weight, latin only, self-hosted like the rest.
*/
const hand = Caveat({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-hand-loaded",
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
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} ${hand.variable}`}>
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

        {/* Announces a recently added page once, to readers who have been here
            before. A first visit shows nothing — see lib/whats-new.ts. */}
        <ToastHost />
      </body>
    </html>
  );
}
