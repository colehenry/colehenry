"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";

import { getVerb, listVerbs } from "@/lib/api/language";
import { joinSubject, speakText } from "@/components/language/language-shared";

export type VerbPreviewForm = { person: string; form: string };

const PERSON_LABELS: Record<string, string> = {
  "1s": "je",
  "2s": "tu",
  "3s": "il / elle / on",
  "1p": "nous",
  "2p": "vous",
  "3p": "ils / elles",
};

const CARD_WIDTH = 300;

/** Delayed, compact present-tense preview for an already-visible infinitive. */
export function VerbHover({
  verb,
  children,
  forms,
  knownVerb = false,
}: {
  verb: string;
  children: React.ReactNode;
  forms?: VerbPreviewForm[];
  knownVerb?: boolean;
}) {
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const infinitive = verb.trim().toLowerCase();
  const verbs = useQuery({
    queryKey: ["language", "verbs", "fr"],
    queryFn: () => listVerbs("fr"),
    enabled: active && !forms,
    staleTime: Infinity,
  });
  const match = verbs.data?.find((item) => item.infinitive.toLowerCase() === infinitive);
  const detail = useQuery({
    queryKey: ["language", "verb", match?.id],
    queryFn: () => getVerb(match!.id),
    enabled: active && !forms && match != null,
    staleTime: Infinity,
  });
  const preview =
    forms ??
    detail.data?.conjugations
      .filter((row) => row.mood === "indicatif" && row.tense === "présent")
      .slice(0, 6)
      .map((row) => ({ person: row.person, form: row.form }));
  const confirmedVerb = knownVerb || Boolean(forms) || Boolean(match);

  useEffect(
    () => () => {
      if (openTimer.current != null) window.clearTimeout(openTimer.current);
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  const open = () => {
    const box = triggerRef.current?.getBoundingClientRect();
    const languageRoot = triggerRef.current?.closest<HTMLElement>('[data-section="language"]');
    setPortalRoot(languageRoot ?? document.body);
    if (box) {
      const cardWidth = Math.min(CARD_WIDTH, window.innerWidth - 16);
      setPosition({
        left: Math.max(8, Math.min(box.left, window.innerWidth - cardWidth - 8)),
        top: window.innerHeight - box.bottom < 190 ? Math.max(8, box.top - 180) : box.bottom + 5,
      });
    }
    setActive(true);
  };
  const cancelClose = () => {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const openSoon = () => {
    cancelClose();
    if (openTimer.current != null) window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(open, 350);
  };
  const close = () => {
    if (openTimer.current != null) window.clearTimeout(openTimer.current);
    openTimer.current = null;
    closeTimer.current = window.setTimeout(() => setActive(false), 120);
  };

  return (
    <span
      ref={triggerRef}
      className={`verb-hover ${confirmedVerb ? "is-verb" : ""}`}
      tabIndex={confirmedVerb ? 0 : undefined}
      onMouseEnter={openSoon}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
    >
      {children}
      {active && confirmedVerb && portalRoot && createPortal(
        <span
          className="verb-hover-card"
          role="tooltip"
          style={{ left: position.left, top: position.top }}
          onMouseEnter={cancelClose}
          onMouseLeave={close}
        >
          <b>{verb}</b>
          <span className="verb-hover-tense">présent</span>
          {preview?.length ? (
            <span className="verb-hover-grid">
              {preview.map((row) => (
                <span key={`${row.person}-${row.form}`}>
                  <i>{PERSON_LABELS[row.person] ?? row.person}</i>
                  <button
                    type="button"
                    className="xp-link verb-hover-form"
                    title={`► ${joinSubject(row.person, row.form)}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void speakText("fr", joinSubject(row.person, row.form));
                    }}
                  >
                    {row.form}
                  </button>
                </span>
              ))}
            </span>
          ) : (
            <span className="xp-muted">chargement…</span>
          )}
          <a className="xp-link" href={`#wiki/conjugation/${encodeURIComponent(verb)}`}>
            full conjugation →
          </a>
        </span>,
        portalRoot,
      )}
    </span>
  );
}
