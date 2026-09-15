"use client";

/** Renders tutor Markdown, its inline application tags, and known verbs. */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { speakText } from "@/components/language/language-shared";
import { useTutor } from "@/components/language/tutor/tutor-provider";
import { VerbHover } from "@/components/language/verb-hover";
import { listVerbs } from "@/lib/api/language";
import { knownVerbsPlugin, tagsToLinks } from "@/lib/tutor-markdown";

export { tagsToLinks } from "@/lib/tutor-markdown";

function FrSpan({ text, slow, children }: { text: string; slow: boolean; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const spoken = (
    <span
      role="button"
      tabIndex={-1}
      className={`tutor-fr ${slow ? "is-slow" : ""} ${busy ? "is-busy" : ""}`}
      aria-label={slow ? `Écouter lentement ${text}` : `Écouter ${text}`}
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
      return <FrSpan text={id} slow={kind === "fr-slow"}>{children}</FrSpan>;
    case "verb":
      return <FrSpan text={id} slow={false}>{children}</FrSpan>;
    case "ref":
      return (
        <button type="button" className="xp-link tutor-ref" aria-label={`Abrir referencia ${id}`} onClick={() => tutor?.onOpenRef?.(id)}>
          [{children}]
        </button>
      );
    case "activity":
      return (
        <button type="button" className="xp-link tutor-activity" aria-label={`Abrir actividad ${id}`} onClick={() => tutor?.onOpenActivity?.(id)}>
          [▶ {children}]
        </button>
      );
    case "vocab":
      return <VerbHover verb={id}><span className="tutor-vocab">{children}</span></VerbHover>;
    case "new":
      return <VerbHover verb={id}><span className="tutor-new">{children}</span></VerbHover>;
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
