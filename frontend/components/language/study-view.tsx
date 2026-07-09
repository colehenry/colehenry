"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getStudyQueue,
  reviewCard,
  type Deck,
  type LanguageCode,
} from "@/lib/api/language";
import { cardSpeechText, genderLabel, Speak } from "./language-shared";

const GRADES: [number, string, string][] = [
  [1, "Again", "←"],
  [2, "Hard", "↓"],
  [3, "Good", "→"],
  [4, "Easy", "↑"],
];

const ARROW_GRADES: Record<string, number> = {
  ArrowLeft: 1,
  ArrowDown: 2,
  ArrowRight: 3,
  ArrowUp: 4,
};

export function StudyView({
  decks,
  initialLanguage,
  initialDeckId,
}: {
  decks: Deck[];
  initialLanguage?: LanguageCode;
  initialDeckId?: number | null;
}) {
  const queryClient = useQueryClient();
  const [language, setLanguage] = useState<LanguageCode | "all">(
    initialLanguage ?? "all",
  );
  const [deckId, setDeckId] = useState<number | "all">(initialDeckId ?? "all");
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const queue = useQuery({
    queryKey: ["language", "study", language, deckId],
    queryFn: () =>
      getStudyQueue({
        language: language === "all" ? undefined : language,
        deckId: deckId === "all" ? undefined : deckId,
        newLimit: 12,
      }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ cardId, rating }: { cardId: number; rating: number }) =>
      reviewCard(cardId, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["language", "decks"] });
      const cards = queue.data?.cards ?? [];
      if (index + 1 < cards.length) {
        setIndex((current) => current + 1);
        setRevealed(false);
      } else {
        setIndex(0);
        setRevealed(false);
        queue.refetch();
      }
    },
  });

  const cards = queue.data?.cards ?? [];
  const safeIndex = cards.length ? Math.min(index, cards.length - 1) : 0;
  const card = cards[safeIndex];
  const cardLanguage =
    decks.find((deck) => deck.id === card?.deck_id)?.language ?? "fr";

  const grade = useCallback(
    (rating: number) => {
      if (!card || reviewMutation.isPending) return;
      reviewMutation.mutate({ cardId: card.id, rating });
    },
    [card, reviewMutation],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!card) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (!revealed) {
        // Space or any arrow flips the card.
        if (event.key === " " || event.key in ARROW_GRADES) {
          event.preventDefault();
          setRevealed(true);
        }
        return;
      }
      if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        grade(Number(event.key));
      }
      if (event.key in ARROW_GRADES) {
        event.preventDefault();
        grade(ARROW_GRADES[event.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, grade, revealed]);

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
                label="► Play audio"
                className="xp-btn"
              />
            ) : (
              <>
                <p style={{ fontSize: "30px", lineHeight: 1.3 }}>{card.front}</p>
                {card.ipa && (
                  <p className="xp-ipa xp-muted mt-1" style={{ fontSize: "14px" }}>
                    {card.ipa}
                  </p>
                )}
                {/* Production cards would leak the answer — listen after reveal. */}
                {(card.direction !== "production" || revealed) && (
                  <div className="mt-2">
                    <Speak
                      language={cardLanguage}
                      text={cardSpeechText(card)}
                      url={card.audio_url || undefined}
                      label="► listen"
                      className="xp-link"
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
            <div className="flex flex-wrap justify-center gap-2">
              {GRADES.map(([rating, label, arrow]) => (
                <button
                  key={rating}
                  type="button"
                  className={`xp-btn ${rating === 3 ? "is-default" : ""}`}
                  disabled={reviewMutation.isPending}
                  onClick={() => grade(rating)}
                >
                  {label} ({rating} {arrow})
                </button>
              ))}
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                className="xp-btn is-default"
                onClick={() => setRevealed(true)}
              >
                Reveal (Space / arrows)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
