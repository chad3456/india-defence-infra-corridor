"use client";

import { langName } from "@/lib/france-riots-shared";

/**
 * Text that may have been published in another language. The English is a
 * machine translation and is labelled as one; the original is always shown
 * under it. Text not yet translated offers the reader a translation of their
 * own, made by their browser at Google Translate, which sends nothing from this
 * site.
 */
export const translateUrl = (text: string, lang: string) => `https://translate.google.com/?sl=${lang === "und" ? "auto" : lang === "nb" ? "no" : lang}&tl=en&text=${encodeURIComponent(text)}&op=translate`;

/** `inLink`: the text sits inside a link already, so the offer to translate is a label, not a second link. */
export function Translated({ text, en, lang, quote = false, className, inLink = false }: { text: string; en?: string; lang: string; quote?: boolean; className?: string; inLink?: boolean }) {
  const q = (t: string) => (quote ? <>&ldquo;{t}&rdquo;</> : t);
  if (!lang || lang === "en") return <span className={className}>{q(text)}</span>;
  if (en) {
    return (
      <span className={className}>
        {q(en)}
        <span className="mt-0.5 block text-[11px] font-normal italic leading-[1.45]" style={{ color: "var(--story-ink-3)" }}>
          <span className="not-italic font-semibold uppercase tracking-[0.06em] text-[9.5px]">Machine translation from {langName(lang)}</span> · original: {text}
        </span>
      </span>
    );
  }
  if (inLink) return <span className={className}>{q(text)} <span className="text-[10.5px] font-normal" style={{ color: "var(--story-ink-3)" }}>· {langName(lang)}, not yet translated</span></span>;
  return (
    <span className={className}>
      {q(text)}
      <a className="ml-1.5 whitespace-nowrap text-[10.5px] font-normal underline decoration-dotted" style={{ color: "var(--story-ink-3)" }} href={translateUrl(text, lang)} target="_blank" rel="noopener noreferrer">
        {langName(lang)} · translate ↗
      </a>
    </span>
  );
}
