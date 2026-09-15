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

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { speakText } from "@/components/language/language-shared";
import { useTutor } from "@/components/language/tutor/tutor-provider";
import { VerbHover } from "@/components/language/verb-hover";
import { listVerbs } from "@/lib/api/language";

const TAG_RE = /\[\[(fr-slow|fr|ref|activity|vocab|new):([^\]|\n]+?)(?:\|([^\]\n]*))?\]\]/g;

type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Turn untagged known infinitives in text nodes into tutor verb links. */
function knownVerbsPlugin(infinitives: string[]) {
  const alternatives = infinitives.filter(Boolean).sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
  const pattern = alternatives ? new RegExp(`(^|[^\\p{L}\\p{M}-])(${alternatives})(?=$|[^\\p{L}\\p{M}-])`, "giu") : null;
  return () => (tree: MarkdownNode) => {
    if (!pattern) return;
    const walk = (node: MarkdownNode, blocked = false) => {
      const nextBlocked = blocked || node.type === "link" || node.type === "code" || node.type === "inlineCode";
      if (!node.children || nextBlocked) return;
      const next: MarkdownNode[] = [];
      for (const child of node.children) {
        if (child.type !== "text" || !child.value) {
          walk(child, false);
          next.push(child);
          continue;
        }
        let cursor = 0;
        pattern.lastIndex = 0;
        for (const match of child.value.matchAll(pattern)) {
          const boundary = match[1] ?? "";
          const verb = match[2];
          const start = (match.index ?? 0) + boundary.length;
          if (start > cursor) next.push({ type: "text", value: child.value.slice(cursor, start) });
          next.push({ type: "link", url: `tutor://verb/${encodeURIComponent(verb)}`, children: [{ type: "text", value: verb }] });
          cursor = start + verb.length;
        }
        if (cursor < child.value.length) next.push({ type: "text", value: child.value.slice(cursor) });
      }
      node.children = next;
    };
    walk(tree);
  };
}

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
  const spoken = (
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
  return <VerbHover verb={text}>{spoken}</VerbHover>;
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
    case "verb":
      return (
        <FrSpan text={id} slow={false}>
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
        <VerbHover verb={id}>
          <span className="tutor-vocab" title="en tu vocabulario">
            {children}
          </span>
        </VerbHover>
      );
    case "new":
      return (
        <VerbHover verb={id}>
          <span className="tutor-new" title="todavía no está en tu vocabulario">
            {children}
          </span>
        </VerbHover>
      );
    default:
      return <span>{children}</span>;
  }
}

export function TutorMarkdown({ content }: { content: string }) {
  const verbs = useQuery({ queryKey: ["language", "verbs", "fr"], queryFn: () => listVerbs("fr"), staleTime: Infinity });
  const autoTagVerbs = useMemo(() => knownVerbsPlugin((verbs.data ?? []).map((verb) => verb.infinitive)), [verbs.data]);
  return (
    <div className="tutor-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, autoTagVerbs]}
        urlTransform={(url) => url}
        components={{ a: ({ href, children }) => <TagLink href={href}>{children}</TagLink> }}
      >
        {tagsToLinks(content)}
      </ReactMarkdown>
    </div>
  );
}
