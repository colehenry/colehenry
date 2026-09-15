"use client";

import { useCallback, useEffect, useId, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";

import { getVerb, listVerbs } from "@/lib/api/language";
import { speakText } from "@/components/language/language-shared";
import { spokenConjugation, verbPreviewLabel } from "@/lib/conjugation";
import { CLOSED_VERB_CARD, reduceVerbCard } from "@/lib/verb-card";

export type VerbPreviewForm = { person: string; form: string };

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
  const [card, dispatch] = useReducer(reduceVerbCard, CLOSED_VERB_CARD);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLSpanElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const cardId = useId();
  const infinitive = verb.trim().toLowerCase();
  const verbs = useQuery({
    queryKey: ["language", "verbs", "fr"],
    queryFn: () => listVerbs("fr"),
    enabled: card.active && !forms,
    staleTime: Infinity,
  });
  const match = verbs.data?.find((item) => item.infinitive.toLowerCase() === infinitive);
  const detail = useQuery({
    queryKey: ["language", "verb", match?.id],
    queryFn: () => getVerb(match!.id),
    enabled: card.active && !forms && match != null,
    staleTime: Infinity,
  });
  const preview =
    forms ??
    detail.data?.conjugations
      .filter((row) => row.mood === "indicatif" && row.tense === "présent")
      .slice(0, 6)
      .map((row) => ({ person: row.person, form: row.form }));
  const confirmedVerb = knownVerb || Boolean(forms) || Boolean(match);

  const positionCard = useCallback(() => {
    const trigger = triggerRef.current;
    const box = trigger?.getBoundingClientRect();
    const languageRoot = trigger?.closest<HTMLElement>('[data-section="language"]');
    setPortalRoot(languageRoot ?? document.body);
    if (!box) return;
    const cardWidth = Math.min(CARD_WIDTH, window.innerWidth - 16);
    setPosition({
      left: Math.max(8, Math.min(box.left, window.innerWidth - cardWidth - 8)),
      top: window.innerHeight - box.bottom < 190 ? Math.max(8, box.top - 180) : box.bottom + 5,
    });
  }, []);

  useEffect(
    () => () => {
      if (openTimer.current != null) window.clearTimeout(openTimer.current);
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!card.active) return;
    const reposition = () => positionCard();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [card.active, positionCard]);

  useEffect(() => {
    if (!card.active) return;
    const dismiss = (event: KeyboardEvent | PointerEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
      } else {
        const target = event.target as Node | null;
        if (target && (triggerRef.current?.contains(target) || cardRef.current?.contains(target))) return;
      }
      dispatch({ type: "dismiss" });
    };
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", dismiss);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [card.active]);

  useEffect(() => {
    if (card.active && !confirmedVerb && verbs.isSuccess) dispatch({ type: "dismiss" });
  }, [card.active, confirmedVerb, verbs.isSuccess]);

  const open = () => {
    positionCard();
    dispatch({ type: "show" });
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
    closeTimer.current = window.setTimeout(() => dispatch({ type: "hide_transient" }), 120);
  };

  const togglePinned = () => {
    if (openTimer.current != null) window.clearTimeout(openTimer.current);
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
    positionCard();
    dispatch({ type: "toggle_pin" });
  };

  return (
    <span
      ref={triggerRef}
      className={`verb-hover ${confirmedVerb ? "is-verb" : ""}`}
      tabIndex={confirmedVerb ? 0 : undefined}
      aria-expanded={confirmedVerb ? card.active : undefined}
      aria-controls={confirmedVerb && card.active ? cardId : undefined}
      aria-haspopup={confirmedVerb ? "dialog" : undefined}
      onMouseEnter={openSoon}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
      onClickCapture={(event) => {
        const target = event.target as Node;
        if (cardRef.current?.contains(target)) return;
        togglePinned();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        togglePinned();
      }}
    >
      {children}
      {card.active && confirmedVerb && portalRoot && createPortal(
        <span
          ref={cardRef}
          id={cardId}
          className="verb-hover-card"
          role="dialog"
          aria-label={`${verb}, conjugaison au présent`}
          style={{ left: position.left, top: position.top }}
          onMouseEnter={cancelClose}
          onMouseLeave={close}
          onFocus={cancelClose}
        >
          <b>{verb}</b>
          <span className="verb-hover-tense">présent</span>
          {preview?.length ? (
            <span className="verb-hover-grid">
              {preview.map((row) => (
                <span key={`${row.person}-${row.form}`}>
                  <button
                    type="button"
                    className="xp-link verb-hover-form"
                    aria-label={`Écouter ${spokenConjugation(row.person, row.form, "indicatif")}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void speakText("fr", spokenConjugation(row.person, row.form, "indicatif"));
                    }}
                  >
                    {verbPreviewLabel(row.person, row.form)}
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
