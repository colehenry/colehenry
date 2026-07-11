"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getStudyQueue,
  listVerbSets,
  reviewCard,
  type Deck,
  type LanguageCode,
} from "@/lib/api/language";
import { cardSpeechText, genderLabel, Speak, speakText } from "./language-shared";

const GRADES: [number, string][] = [
  [1, "Again"],
  [2, "Hard"],
  [3, "Good"],
  [4, "Easy"],
];

export function StudyView({
  decks,
  readOnly = false,
  initialLanguage,
  initialDeckId,
  initialVerbSetId,
}: {
  decks: Deck[];
  readOnly?: boolean;
  initialLanguage?: LanguageCode;
  initialDeckId?: number | null;
  initialVerbSetId?: number | null;
}) {
  const queryClient = useQueryClient();
  const [language, setLanguage] = useState<LanguageCode | "all">(
    initialLanguage ?? "all",
  );
  const [deckId, setDeckId] = useState<number | "all">(initialDeckId ?? "all");
  const [verbSetId, setVerbSetId] = useState<number | "all">(
    initialVerbSetId ?? "all",
  );
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const queue = useQuery({
    queryKey: ["language", "study", language, deckId, verbSetId],
    queryFn: () =>
      getStudyQueue({
        language: language === "all" ? undefined : language,
        deckId: deckId === "all" ? undefined : deckId,
        verbSetId: verbSetId === "all" ? undefined : verbSetId,
        newLimit: 12,
      }),
  });
  const verbSets = useQuery({
    queryKey: ["language", "verb-sets", language],
    queryFn: () =>
      listVerbSets(language === "all" ? undefined : language),
  });

  const advance = useCallback(() => {
    const cards = queue.data?.cards ?? [];
    if (index + 1 < cards.length) {
      setIndex((current) => current + 1);
      setRevealed(false);
    } else {
      setIndex(0);
      setRevealed(false);
      queue.refetch();
    }
  }, [index, queue]);

  const reviewMutation = useMutation({
    mutationFn: ({ cardId, rating }: { cardId: number; rating: number }) =>
      reviewCard(cardId, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["language", "decks"] });
      advance();
    },
  });

  const cards = queue.data?.cards ?? [];
  const safeIndex = cards.length ? Math.min(index, cards.length - 1) : 0;
  const card = cards[safeIndex];
  const cardLanguage =
    decks.find((deck) => deck.id === card?.deck_id)?.language ?? "fr";

  const grade = useCallback(
    (rating: number) => {
      if (!card) return;
      // The preview flips through the queue without writing review history.
      if (readOnly) {
        advance();
        return;
      }
      if (reviewMutation.isPending) return;
      reviewMutation.mutate({ cardId: card.id, rating });
    },
    [card, readOnly, advance, reviewMutation],
  );

  useEffect(() => {
    // Production-card audio is the answer, so never autoplay it. The public
    // preview never autoplays — audio only on an explicit button press.
    if (!card || card.direction === "production" || readOnly) return;
    void speakText(
      cardLanguage,
      cardSpeechText(card),
      card.audio_url || undefined,
    );
  }, [card, cardLanguage, readOnly]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!card) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key.toLowerCase() === "p") {
        if (card.direction === "production" && !revealed) return;
        event.preventDefault();
        void speakText(
          cardLanguage,
          cardSpeechText(card),
          card.audio_url || undefined,
        );
        return;
      }
      if (!revealed) {
        if (event.key === " ") {
          event.preventDefault();
          setRevealed(true);
        }
        return;
      }
      if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        grade(Number(event.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, cardLanguage, grade, revealed]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="xp-label mb-0" htmlFor="study-language">
          Language:
        </label>
        <select
          id="study-language"
          className="xp-select"
          value={language}
          onChange={(event) => {
            setLanguage(event.target.value as LanguageCode | "all");
            setIndex(0);
            setRevealed(false);
          }}
        >
          <option value="all">All</option>
          <option value="fr">French</option>
          <option value="es">Spanish</option>
        </select>
        <label className="xp-label mb-0" htmlFor="study-verb-set">
          Verb set:
        </label>
        <select
          id="study-verb-set"
          className="xp-select"
          value={verbSetId}
          onChange={(event) => {
            setVerbSetId(
              event.target.value === "all"
                ? "all"
                : Number(event.target.value),
            );
            setIndex(0);
            setRevealed(false);
          }}
        >
          <option value="all">All verbs</option>
          {(verbSets.data ?? []).map((set) => (
            <option key={set.id} value={set.id}>
              {set.name}
            </option>
          ))}
        </select>
        <label className="xp-label mb-0" htmlFor="study-deck">
          Deck:
        </label>
        <select
          id="study-deck"
          className="xp-select"
          value={deckId}
          onChange={(event) => {
            setDeckId(
              event.target.value === "all" ? "all" : Number(event.target.value),
            );
            setIndex(0);
            setRevealed(false);
          }}
        >
          <option value="all">All decks</option>
          {decks.map((deck) => (
            <option key={deck.id} value={deck.id}>
              {deck.name}
            </option>
          ))}
        </select>
        <span className="xp-muted ml-auto">
          {queue.data
            ? `${queue.data.due_count} due, ${queue.data.new_count} new`
            : "…"}
        </span>
        <button type="button" className="xp-link" onClick={() => queue.refetch()}>
          refresh
        </button>
      </div>

      {queue.isLoading && (
        <div className="xp-well flex h-72 items-center justify-center">
          <span className="xp-muted">Loading queue…</span>
        </div>
      )}
      {queue.isError && (
        <div className="xp-well flex h-72 flex-col items-center justify-center gap-3">
          <p>The study queue could not be loaded.</p>
          <button type="button" className="xp-btn" onClick={() => queue.refetch()}>
            Retry
          </button>
        </div>
      )}
      {!queue.isLoading && !queue.isError && !card && (
        <div className="xp-well flex h-72 flex-col items-center justify-center gap-1 text-center">
          <p style={{ fontWeight: 700 }}>No cards are due.</p>
          <p className="xp-muted">
            Cards return on their schedule. Change the filters to drill a deck
            early.
          </p>
        </div>
      )}

      {card && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="xp-muted">
              {card.card_type} · {card.direction}
              {card.is_false_friend ? " · faux ami" : ""}
            </span>
            <span className="xp-muted ml-auto">
              Card {safeIndex + 1} of {cards.length}
            </span>
          </div>

          <div className="xp-well xp-doc text-center">
            {card.card_type === "audio" ? (
              <Speak
                language={cardLanguage}
                text={cardSpeechText(card)}
                url={card.audio_url || undefined}
                label="Play audio (P)"
                className="xp-btn text-base"
              />
            ) : (
              <>
                <p style={{ fontSize: "30px", lineHeight: 1.3 }}>{card.front}</p>
                {/* A production card's audio is the answer. */}
                {(card.direction !== "production" || revealed) && (
                  <div className="mt-5 flex justify-center">
                    <Speak
                      language={cardLanguage}
                      text={cardSpeechText(card)}
                      url={card.audio_url || undefined}
                      label="Play audio (P)"
                      className="xp-btn text-base"
                    />
                  </div>
                )}
              </>
            )}

            {revealed && (
              <div
                className="mt-4 border-t border-dotted pt-4 text-left"
                style={{ borderColor: "var(--xp-well-border)" }}
              >
                <p style={{ fontSize: "20px" }}>
                  {card.back}
                  {card.gender && (
                    <span className="xp-muted" style={{ fontSize: "13px" }}>
                      {" "}
                      · {genderLabel(card.gender)}
                    </span>
                  )}
                </p>
                {card.example && (
                  <p className="xp-muted mt-2" style={{ fontSize: "14px" }}>
                    {card.example}
                  </p>
                )}
                {card.cognate_note && (
                  <p
                    className="mt-2"
                    style={{
                      fontFamily: "var(--xp-font)",
                      fontSize: "11px",
                      background: "var(--xp-tooltip-bg)",
                      color: "var(--xp-tooltip-text)",
                      border: "1px solid #000",
                      padding: "4px 7px",
                      display: "inline-block",
                      lineHeight: 1.5,
                    }}
                  >
                    ES: {card.cognate_note}
                  </p>
                )}
              </div>
            )}
          </div>

          {revealed ? (
            readOnly ? (
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  className="xp-btn is-default"
                  onClick={advance}
                >
                  Next card
                </button>
                <p className="xp-muted">
                  Read-only preview — reviews aren&apos;t saved.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                {GRADES.map(([rating, label]) => (
                  <button
                    key={rating}
                    type="button"
                    className={`xp-btn ${rating === 3 ? "is-default" : ""}`}
                    disabled={reviewMutation.isPending}
                    onClick={() => grade(rating)}
                  >
                    {label} ({rating})
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                className="xp-btn is-default"
                onClick={() => setRevealed(true)}
              >
                Reveal (Space)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
