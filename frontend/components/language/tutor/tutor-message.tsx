"use client";

/**
 * Renders one tutor reply: markdown plus the inline tags from the output
 * contract (context/tutor_plan.md):
 *   [[fr:…]] / [[fr-slow:…]]  French with a play button (slow = 0.7× TTS)
 *   [[ref:sheet#section]]     link into the reference library
 *   [[activity:id]]           link into practice
 *   [[vocab:mot]]             curriculum word chip
 *   [[new:mot]]               word outside the learner's set
 * Tags are rewritten to `tutor://kind/…` links before markdown so they stream
 * naturally and survive bold/lists; the link renderer does the rest.
 */

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { speakText } from "@/components/language/language-shared";
import { useTutor } from "@/components/language/tutor/tutor-provider";

const TAG_RE = /\[\[(fr-slow|fr|ref|activity|vocab|new):([^\]|\n]+?)(?:\|([^\]\n]*))?\]\]/g;

function prettyRef(id: string) {
  const [sheet, section] = id.split("#");
  return section ? `${sheet.replace(/-/g, " ")} · ${section.replace(/-/g, " ")}` : sheet.replace(/-/g, " ");
}

/** `[[kind:id|label]]` → `[label](tutor://kind/<encoded id>)`. */
export function tagsToLinks(markdown: string): string {
  return markdown.replace(TAG_RE, (_m, kind: string, id: string, label?: string) => {
    const text = (label && label.trim()) || (kind === "ref" ? prettyRef(id.trim()) : id.trim());
    const safe = text.replace(/[[\]]/g, "");
    return `[${safe}](tutor://${kind}/${encodeURIComponent(id.trim())})`;
  });
}

function FrSpan({ text, slow, children }: { text: string; slow: boolean; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <span
      role="button"
      tabIndex={-1}
      className={`tutor-fr ${slow ? "is-slow" : ""} ${busy ? "is-busy" : ""}`}
      title={slow ? "► écouter lentement" : "► écouter"}
      onClick={async (event) => {
        event.stopPropagation();
        if (busy) return;
        setBusy(true);
        try {
          await speakText("fr", text, undefined, slow ? 0.7 : 1);
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="tutor-fr-text">{children}</span>
      <span className="tutor-fr-play" aria-hidden>
        {slow ? "🐢" : "►"}
      </span>
    </span>
  );
}

function TagLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  const tutor = useTutor();
  if (!href?.startsWith("tutor://")) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="xp-link">
        {children}
      </a>
    );
  }
  const rest = href.slice("tutor://".length);
  const slash = rest.indexOf("/");
  const kind = slash === -1 ? rest : rest.slice(0, slash);
  const id = slash === -1 ? "" : decodeURIComponent(rest.slice(slash + 1));
  switch (kind) {
    case "fr":
    case "fr-slow":
      return (
        <FrSpan text={id} slow={kind === "fr-slow"}>
          {children}
        </FrSpan>
      );
    case "ref":
      return (
        <button type="button" className="xp-link tutor-ref" title={id} onClick={() => tutor?.onOpenRef?.(id)}>
          [{children}]
        </button>
      );
    case "activity":
      return (
        <button type="button" className="xp-link tutor-activity" title={id} onClick={() => tutor?.onOpenActivity?.(id)}>
          [▶ {children}]
        </button>
      );
    case "vocab":
      return (
        <span className="tutor-vocab" title="en tu vocabulario">
          {children}
        </span>
      );
    case "new":
      return (
        <span className="tutor-new" title="todavía no está en tu vocabulario">
          {children}
        </span>
      );
    default:
      return <span>{children}</span>;
  }
}

export function TutorMarkdown({ content }: { content: string }) {
  return (
    <div className="tutor-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => url}
        components={{ a: ({ href, children }) => <TagLink href={href}>{children}</TagLink> }}
      >
        {tagsToLinks(content)}
      </ReactMarkdown>
    </div>
  );
}
