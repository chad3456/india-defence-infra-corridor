/**
 * A very small Markdown reader.
 *
 * It exists so `docs/data-sources.mdx` can be one file that is both the
 * document a developer reads in the repository and the page a reader sees on
 * the site. Rendering the file rather than restating it is the whole point: a
 * second, hand-written copy of the source catalogue would drift from the first
 * within a week, and this project's credibility rests on not doing that.
 *
 * It covers exactly the subset the docs use — frontmatter, headings, rules,
 * paragraphs, lists, tables, fenced code, and inline code / bold / italic /
 * links. Anything else is passed through as plain text rather than half
 * rendered. Adding a Markdown dependency to render one file would be a poor
 * trade for a site that ships no runtime JavaScript for its charts.
 */

export interface Frontmatter {
  title?: string;
  description?: string;
}

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; content: Inline[] }
  | { kind: "em"; content: Inline[] }
  | { kind: "link"; content: Inline[]; href: string };

export type Block =
  | { kind: "heading"; level: 2 | 3; text: string; id: string }
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "table"; head: string[]; align: Array<"left" | "right">; rows: Inline[][][] }
  | { kind: "code"; text: string }
  | { kind: "rule" };

export interface ParsedDoc {
  frontmatter: Frontmatter;
  blocks: Block[];
}

/** Stable anchor for a heading, so section links survive edits to the prose. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function splitFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  if (!raw.startsWith("---\n")) return { frontmatter: {}, body: raw };
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) return { frontmatter: {}, body: raw };
  const frontmatter: Frontmatter = {};
  for (const line of raw.slice(4, end).split("\n")) {
    const at = line.indexOf(":");
    if (at === -1) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    if (key === "title" || key === "description") frontmatter[key] = value;
  }
  return { frontmatter, body: raw.slice(end + 5) };
}

/**
 * Inline parsing runs code spans first, so `**` inside backticks stays
 * literal — the docs contain plenty of it. Bold and italic recurse, because
 * the docs also do the reverse: a code span inside a bold run is common in the
 * rules lists, and rendering its backticks as text was a real bug.
 */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: "code", text: m[1] });
    else if (m[2] !== undefined && m[3] !== undefined)
      out.push({ kind: "link", content: parseInline(m[2]), href: m[3] });
    else if (m[4] !== undefined) out.push({ kind: "strong", content: parseInline(m[4]) });
    else if (m[5] !== undefined) out.push({ kind: "em", content: parseInline(m[5]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

const isTableRow = (line: string) => line.startsWith("|") && line.endsWith("|");
const isDivider = (line: string) => /^\|[\s:|-]+\|$/.test(line) && line.includes("-");

export function parseDoc(raw: string): ParsedDoc {
  const { frontmatter, body } = splitFrontmatter(raw);
  const lines = body.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    if (trimmed === "---") {
      blocks.push({ kind: "rule" });
      i++;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        buf.push(lines[i] ?? "");
        i++;
      }
      i++; // closing fence
      blocks.push({ kind: "code", text: buf.join("\n") });
      continue;
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(trimmed);
    if (heading && heading[1] && heading[2]) {
      const text = heading[2];
      blocks.push({
        kind: "heading",
        level: heading[1].length === 2 ? 2 : 3,
        text,
        id: slugify(text),
      });
      i++;
      continue;
    }

    // Table: a header row, an alignment divider, then body rows.
    if (isTableRow(trimmed) && isDivider((lines[i + 1] ?? "").trim())) {
      const head = splitRow(trimmed);
      const align = splitRow((lines[i + 1] ?? "").trim()).map<"left" | "right">((c) =>
        c.endsWith(":") && !c.startsWith(":") ? "right" : "left",
      );
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && isTableRow((lines[i] ?? "").trim())) {
        rows.push(splitRow((lines[i] ?? "").trim()).map(parseInline));
        i++;
      }
      blocks.push({ kind: "table", head, align, rows });
      continue;
    }

    const bullet = /^([-*]|\d+\.)\s+(.*)$/.exec(trimmed);
    if (bullet && bullet[1] && bullet[2] !== undefined) {
      const ordered = /\d/.test(bullet[1]);
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i] ?? "";
        const next = /^([-*]|\d+\.)\s+(.*)$/.exec(cur.trim());
        if (next && next[2] !== undefined && /\d/.test(next[1] ?? "") === ordered) {
          items.push(next[2]);
          i++;
          continue;
        }
        // An indented line continues the item above it.
        if (cur.startsWith("  ") && cur.trim() !== "" && items.length > 0) {
          items[items.length - 1] = `${items[items.length - 1]} ${cur.trim()}`;
          i++;
          continue;
        }
        break;
      }
      blocks.push({ kind: "list", ordered, items: items.map(parseInline) });
      continue;
    }

    // Paragraph: run to the next blank line or block opener.
    const buf: string[] = [];
    while (i < lines.length) {
      const cur = (lines[i] ?? "").trim();
      if (
        cur === "" ||
        cur === "---" ||
        cur.startsWith("```") ||
        /^#{2,3}\s/.test(cur) ||
        isTableRow(cur) ||
        /^([-*]|\d+\.)\s/.test(cur)
      )
        break;
      buf.push(cur);
      i++;
    }
    if (buf.length > 0) blocks.push({ kind: "paragraph", content: parseInline(buf.join(" ")) });
  }

  return { frontmatter, blocks };
}

/** The plain text of a run of inline nodes, with all markup dropped. */
export function inlineText(content: Inline[]): string {
  return content
    .map((n) => ("content" in n ? inlineText(n.content) : n.text))
    .join("");
}

/** Every h2, for building an on-page table of contents. */
export function outline(doc: ParsedDoc): Array<{ id: string; text: string }> {
  return doc.blocks
    .filter((b): b is Extract<Block, { kind: "heading" }> => b.kind === "heading" && b.level === 2)
    .map((b) => ({ id: b.id, text: b.text }));
}
