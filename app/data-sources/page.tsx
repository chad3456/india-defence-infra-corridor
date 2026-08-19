import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import Markdown from "@/components/ui/Markdown";
import { outline, parseDoc } from "@/lib/markdown";

/**
 * The source catalogue, rendered from `docs/data-sources.mdx` itself rather
 * than restated. One file, two audiences: a developer reading the repository
 * and a reader checking where a number came from. The alternative — a
 * hand-maintained copy of the same catalogue — drifts, and a data site whose
 * own source list is out of date has no business grading anyone else.
 */

export const dynamic = "force-static";

const DOC_PATH = join(process.cwd(), "docs/data-sources.mdx");

export const metadata = {
  title: "Data sources",
  description:
    "Every publisher, feed and dataset behind Bharat Tracker — coverage, grading, refresh cadence and known limits.",
};

export default function DataSourcesPage() {
  const doc = parseDoc(readFileSync(DOC_PATH, "utf8"));
  const sections = outline(doc);

  return (
    <div className="max-w-[820px]">
      <section className="border-b pb-5">
        <p className="eyebrow">data sources</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight">
          {doc.frontmatter.title ?? "Data sources"}
        </h1>
        {doc.frontmatter.description && (
          <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
            {doc.frontmatter.description}
          </p>
        )}
        <p className="mt-3 text-[11px] text-[color:var(--text-muted)]">
          Rendered from <span className="mono text-[10px]">docs/data-sources.mdx</span> in the
          repository, so this page and the file developers read can never disagree. For the
          per-figure register, see{" "}
          <Link href="/sources" className="link-underline">
            the source list
          </Link>
          ; for how the numbers were built,{" "}
          <Link href="/methodology" className="link-underline">
            methodology
          </Link>
          .
        </p>
      </section>

      {sections.length > 0 && (
        <nav className="border-b py-4">
          <p className="eyebrow">on this page</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-[12px] text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
                >
                  {s.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <article className="pb-10">
        <Markdown blocks={doc.blocks} />
      </article>
    </div>
  );
}
