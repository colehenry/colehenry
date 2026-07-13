"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Note } from "@/lib/api/brain";

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;
const WIKILINK_HREF = "wikilink:";

/** Rewrite `[[target|alias]]` / `[[target#heading]]` into markdown links with a
 *  custom `wikilink:` scheme, resolved to a click handler below. */
function preprocess(md: string): string {
  return md.replace(WIKILINK_RE, (_m, inner: string) => {
    const [rawTarget, alias] = inner.split("|");
    const target = rawTarget.split("#")[0].trim();
    const label = (alias ?? rawTarget).trim();
    return `[${label}](${WIKILINK_HREF}${encodeURIComponent(target)})`;
  });
}

export function NoteReader({
  note,
  resolve,
  onOpen,
}: {
  note: Note;
  /** basename/path target -> real note path, or null if it doesn't exist */
  resolve: (target: string) => string | null;
  onOpen: (path: string) => void;
}) {
  const source = useMemo(() => preprocess(note.body_md), [note.body_md]);

  return (
    <article>
      <header className="mb-4 border-b pb-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {note.title}
        </h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{note.path}</p>
      </header>
      <div className="brain-prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a({ href, children }) {
              // A wikilink ([[…]], rewritten above) or a relative markdown link
              // to another note ([label](path.md)) — both open in-app.
              const internalTarget = (() => {
                if (!href) return null;
                if (href.startsWith(WIKILINK_HREF)) {
                  return decodeURIComponent(href.slice(WIKILINK_HREF.length));
                }
                if (/^https?:\/\//i.test(href) || href.startsWith("mailto:") || href.startsWith("#")) {
                  return null;
                }
                return decodeURIComponent(href.replace(/^\.\//, "").split("#")[0]);
              })();

              if (internalTarget !== null) {
                const path = resolve(internalTarget);
                if (path) {
                  return (
                    <button
                      type="button"
                      className="text-brand underline underline-offset-[3px] hover:opacity-80"
                      onClick={() => onOpen(path)}
                    >
                      {children}
                    </button>
                  );
                }
                // Unresolved note reference — show as a dead link, never a 404.
                if (internalTarget.endsWith(".md") || href?.startsWith(WIKILINK_HREF)) {
                  return <span className="brain-wikilink-dead">{children}</span>;
                }
              }
              return (
                <a href={href} target="_blank" rel="noreferrer">
                  {children}
                </a>
              );
            },
          }}
        >
          {source}
        </ReactMarkdown>
      </div>
    </article>
  );
}
