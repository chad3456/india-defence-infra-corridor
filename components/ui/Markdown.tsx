import type { Block, Inline } from "@/lib/markdown";

/**
 * Renders the blocks produced by `lib/markdown.ts` in the site's own type
 * scale. Deliberately not a generic Markdown component: it renders what the
 * docs actually contain, and nothing speculative.
 */

function Spans({ content }: { content: Inline[] }) {
  return (
    <>
      {content.map((node, i) => {
        switch (node.kind) {
          case "code":
            return (
              <code key={i} className="mono text-[11px] text-[color:var(--text-primary)]">
                {node.text}
              </code>
            );
          case "strong":
            return (
              <strong key={i} className="font-semibold text-[color:var(--text-primary)]">
                <Spans content={node.content} />
              </strong>
            );
          case "em":
            return (
              <em key={i}>
                <Spans content={node.content} />
              </em>
            );
          case "link": {
            const external = /^https?:/.test(node.href);
            return (
              <a
                key={i}
                href={node.href}
                className="link-underline"
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                <Spans content={node.content} />
              </a>
            );
          }
          default:
            return <span key={i}>{node.text}</span>;
        }
      })}
    </>
  );
}

export default function Markdown({ blocks }: { blocks: Block[] }) {
  return (
    <div className="text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "rule":
            return <hr key={i} className="my-7 border-0 border-t" />;

          case "heading":
            return b.level === 2 ? (
              <h2
                key={i}
                id={b.id}
                className="mt-9 scroll-mt-16 text-[15px] font-semibold tracking-tight text-[color:var(--text-primary)]"
              >
                {b.text}
              </h2>
            ) : (
              <h3
                key={i}
                id={b.id}
                className="mt-6 scroll-mt-16 text-[13px] font-semibold tracking-tight text-[color:var(--text-primary)]"
              >
                {b.text}
              </h3>
            );

          case "paragraph":
            return (
              <p key={i} className="mt-3">
                <Spans content={b.content} />
              </p>
            );

          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag
                key={i}
                className={`mt-3 space-y-1.5 pl-5 ${b.ordered ? "list-decimal" : "list-disc"}`}
              >
                {b.items.map((item, j) => (
                  <li key={j} className="pl-1">
                    <Spans content={item} />
                  </li>
                ))}
              </Tag>
            );
          }

          case "code":
            return (
              <pre
                key={i}
                className="mono mt-3 overflow-x-auto rounded-lg border bg-[var(--plane)] p-3 text-[11px] leading-relaxed text-[color:var(--text-primary)]"
              >
                {b.text}
              </pre>
            );

          case "table":
            return (
              // Wide tables scroll inside their own box rather than pushing
              // the page sideways on a phone.
              <div key={i} className="mt-4 overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[520px] border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b bg-[var(--plane)]">
                      {b.head.map((h, j) => (
                        <th
                          key={j}
                          className={`px-3 py-2 font-medium text-[color:var(--text-primary)] ${
                            b.align[j] === "right" ? "text-right tnum" : "text-left"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {b.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td
                            key={k}
                            className={`px-3 py-2 align-top ${
                              b.align[k] === "right" ? "text-right tnum" : "text-left"
                            }`}
                          >
                            <Spans content={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
