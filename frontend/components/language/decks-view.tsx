"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCard,
  createDeck,
  deleteCard,
  deleteDeck,
  enrichCard,
  listCards,
  updateCard,
  type Card,
  type CardDirection,
  type CardType,
  type Deck,
  type LanguageCode,
} from "@/lib/api/language";
import { cardSpeechText, genderLabel, Speak, splitTags } from "./language-shared";
import { ImportDialog } from "./import-dialog";

const EMPTY_CARD_FORM = {
  front: "",
  back: "",
  card_type: "basic" as CardType,
  direction: "recognition" as CardDirection,
  ipa: "",
  part_of_speech: "",
  example: "",
  example_translation: "",
  cognate_note: "",
  tags: "",
};

export function DecksView({
  decks,
  readOnly = false,
  onStudyDeck,
}: {
  decks: Deck[];
  readOnly?: boolean;
  onStudyDeck: (deckId: number) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(
    decks.find((d) => !d.is_system)?.id ?? decks[0]?.id ?? null,
  );
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckLanguage, setNewDeckLanguage] = useState<LanguageCode>("fr");
  const [newDeckDescription, setNewDeckDescription] = useState("");
  const [cardForm, setCardForm] = useState(EMPTY_CARD_FORM);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [confirmDeleteDeck, setConfirmDeleteDeck] = useState(false);
  const [koboOpen, setKoboOpen] = useState(false);

  const effectiveSelectedDeckId = selectedDeckId ?? decks[0]?.id ?? null;
  const selectedDeck =
    decks.find((deck) => deck.id === effectiveSelectedDeckId) ?? null;
  const cards = useQuery({
    queryKey: ["language", "cards", effectiveSelectedDeckId],
    queryFn: () => listCards(effectiveSelectedDeckId as number),
    enabled: effectiveSelectedDeckId != null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["language", "decks"] });
    queryClient.invalidateQueries({
      queryKey: ["language", "cards", effectiveSelectedDeckId],
    });
  };

  const createDeckMutation = useMutation({
    mutationFn: () =>
      createDeck({
        name: newDeckName,
        language: newDeckLanguage,
        description: newDeckDescription,
      }),
    onSuccess: (deck) => {
      setNewDeckName("");
      setNewDeckDescription("");
      setNewDeckOpen(false);
      setSelectedDeckId(deck.id);
      queryClient.invalidateQueries({ queryKey: ["language", "decks"] });
    },
  });

  const saveCardMutation = useMutation({
    mutationFn: () => {
      if (!effectiveSelectedDeckId) throw new Error("No deck selected");
      const payload = {
        deck_id: effectiveSelectedDeckId,
        front: cardForm.front,
        back: cardForm.back,
        card_type: cardForm.card_type,
        direction: cardForm.direction,
        ipa: cardForm.ipa,
        part_of_speech: cardForm.part_of_speech,
        example: cardForm.example,
        example_translation: cardForm.example_translation,
        cognate_note: cardForm.cognate_note,
        tags: splitTags(cardForm.tags),
      };
      return editingCard
        ? updateCard(editingCard.id, payload)
        : createCard(payload);
    },
    onSuccess: () => {
      setCardForm(EMPTY_CARD_FORM);
      setEditingCard(null);
      invalidate();
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: deleteCard,
    onSuccess: invalidate,
  });

  const deleteDeckMutation = useMutation({
    mutationFn: deleteDeck,
    onSuccess: () => {
      setConfirmDeleteDeck(false);
      setSelectedDeckId(
        decks.find((d) => d.id !== effectiveSelectedDeckId)?.id ?? null,
      );
      queryClient.invalidateQueries({ queryKey: ["language", "decks"] });
    },
  });

  const enrichMutation = useMutation({
    mutationFn: enrichCard,
    onSuccess: invalidate,
  });

  const edit = (card: Card) => {
    setEditingCard(card);
    setCardForm({
      front: card.front,
      back: card.back,
      card_type: card.card_type,
      direction: card.direction,
      ipa: card.ipa,
      part_of_speech: card.part_of_speech,
      example: card.example,
      example_translation: card.example_translation,
      cognate_note: card.cognate_note,
      tags: card.tags.join(", "),
    });
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <aside className="flex w-full flex-col gap-2 lg:w-60 lg:shrink-0">
        <div className="flex items-center justify-between">
          <span style={{ fontWeight: 700 }}>Decks</span>
          {!readOnly && (
            <span className="flex gap-2">
              <button
                type="button"
                className="xp-link"
                onClick={() => setKoboOpen(true)}
              >
                [import]
              </button>
              <button
                type="button"
                className="xp-link"
                onClick={() => setNewDeckOpen((open) => !open)}
              >
                [new deck]
              </button>
            </span>
          )}
        </div>

        {newDeckOpen && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (newDeckName.trim()) createDeckMutation.mutate();
            }}
          >
            <fieldset className="xp-group flex flex-col gap-2">
              <legend>New deck</legend>
              <div>
                <label className="xp-label" htmlFor="deck-name">
                  Name:
                </label>
                <input
                  id="deck-name"
                  className="xp-input"
                  value={newDeckName}
                  onChange={(event) => setNewDeckName(event.target.value)}
                />
              </div>
              <div>
                <label className="xp-label" htmlFor="deck-language">
                  Language:
                </label>
                <select
                  id="deck-language"
                  className="xp-select"
                  value={newDeckLanguage}
                  onChange={(event) =>
                    setNewDeckLanguage(event.target.value as LanguageCode)
                  }
                >
                  <option value="fr">French</option>
                  <option value="es">Spanish</option>
                </select>
              </div>
              <div>
                <label className="xp-label" htmlFor="deck-description">
                  Description:
                </label>
                <textarea
                  id="deck-description"
                  className="xp-textarea"
                  style={{ minHeight: 48 }}
                  value={newDeckDescription}
                  onChange={(event) => setNewDeckDescription(event.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <button
                  className="xp-btn is-default"
                  disabled={createDeckMutation.isPending}
                >
                  Create
                </button>
              </div>
            </fieldset>
          </form>
        )}

        <div className="xp-well max-h-[420px] overflow-y-auto">
          {decks.map((deck) => (
            <button
              key={deck.id}
              type="button"
              className={`xp-tree-item ${
                effectiveSelectedDeckId === deck.id ? "is-active" : ""
              }`}
              style={{ whiteSpace: "normal", padding: "3px 6px" }}
              onClick={() => setSelectedDeckId(deck.id)}
            >
              <span>
                {deck.name}{" "}
                <span
                  className={
                    effectiveSelectedDeckId === deck.id ? "" : "xp-muted"
                  }
                >
                  ({deck.language.toUpperCase()}, {deck.card_count} cards,{" "}
                  {deck.due_count} due)
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span style={{ fontWeight: 700, fontSize: "13px" }}>
            {selectedDeck?.name ?? "Cards"}
          </span>
          {selectedDeck &&
            (selectedDeck.due_count > 0 || selectedDeck.new_count > 0) && (
              <button
                type="button"
                className="xp-btn is-small"
                onClick={() => onStudyDeck(selectedDeck.id)}
              >
                Study this deck
              </button>
            )}
          {selectedDeck && !readOnly && (
            <button
              type="button"
              className="xp-link ml-auto"
              onClick={() => setConfirmDeleteDeck(true)}
            >
              [delete deck]
            </button>
          )}
        </div>

        {confirmDeleteDeck && selectedDeck && (
          <>
            <button
              type="button"
              aria-label="Cancel delete"
              className="xp-dialog-backdrop cursor-default"
              onClick={() => setConfirmDeleteDeck(false)}
            />
            <div className="xp-dialog" role="dialog" aria-label="Delete deck">
              <div className="xp-titlebar">
                <span className="xp-title-text">Confirm Deck Delete</span>
                <button
                  type="button"
                  className="xp-caption-btn is-close"
                  aria-label="Close dialog"
                  onClick={() => setConfirmDeleteDeck(false)}
                >
                  ×
                </button>
              </div>
              <div className="xp-dialog-body">
                <p>
                  Delete <b>{selectedDeck.name}</b> and its{" "}
                  {selectedDeck.card_count} card
                  {selectedDeck.card_count === 1 ? "" : "s"}?
                </p>
                <p className="xp-muted mt-2">
                  Review history for these cards is removed too. This cannot be
                  undone.
                </p>
              </div>
              <div className="xp-dialog-buttons">
                <button
                  type="button"
                  className="xp-btn"
                  onClick={() => setConfirmDeleteDeck(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="xp-btn is-default"
                  disabled={deleteDeckMutation.isPending}
                  onClick={() => deleteDeckMutation.mutate(selectedDeck.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </>
        )}

        {readOnly ? null : selectedDeck?.is_system ? (
          <p className="xp-muted">
            System deck (generated). Add manual cards to a personal deck.
          </p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (cardForm.front.trim()) saveCardMutation.mutate();
            }}
          >
            <fieldset className="xp-group flex flex-col gap-2">
              <legend>{editingCard ? `Edit card #${editingCard.id}` : "New card"}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="xp-label" htmlFor="card-front">
                    Front:
                  </label>
                  <textarea
                    id="card-front"
                    className="xp-textarea"
                    style={{ minHeight: 48 }}
                    value={cardForm.front}
                    onChange={(event) =>
                      setCardForm((prev) => ({
                        ...prev,
                        front: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="xp-label" htmlFor="card-back">
                    Back:
                  </label>
                  <textarea
                    id="card-back"
                    className="xp-textarea"
                    style={{ minHeight: 48 }}
                    value={cardForm.back}
                    onChange={(event) =>
                      setCardForm((prev) => ({
                        ...prev,
                        back: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="xp-label" htmlFor="card-type">
                    Type:
                  </label>
                  <select
                    id="card-type"
                    className="xp-select"
                    value={cardForm.card_type}
                    onChange={(event) =>
                      setCardForm((prev) => ({
                        ...prev,
                        card_type: event.target.value as CardType,
                      }))
                    }
                  >
                    <option value="basic">Basic</option>
                    <option value="cloze">Cloze</option>
                    <option value="audio">Audio-first</option>
                  </select>
                </div>
                <div>
                  <label className="xp-label" htmlFor="card-direction">
                    Direction:
                  </label>
                  <select
                    id="card-direction"
                    className="xp-select"
                    value={cardForm.direction}
                    onChange={(event) =>
                      setCardForm((prev) => ({
                        ...prev,
                        direction: event.target.value as CardDirection,
                      }))
                    }
                  >
                    <option value="recognition">Recognition</option>
                    <option value="production">Production</option>
                  </select>
                </div>
                <div className="min-w-32 flex-1">
                  <label className="xp-label" htmlFor="card-tags">
                    Tags:
                  </label>
                  <input
                    id="card-tags"
                    className="xp-input"
                    value={cardForm.tags}
                    onChange={(event) =>
                      setCardForm((prev) => ({
                        ...prev,
                        tags: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="min-w-32 flex-1">
                  <label className="xp-label" htmlFor="card-note">
                    Spanish note:
                  </label>
                  <input
                    id="card-note"
                    className="xp-input"
                    value={cardForm.cognate_note}
                    onChange={(event) =>
                      setCardForm((prev) => ({
                        ...prev,
                        cognate_note: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                {editingCard && (
                  <button
                    type="button"
                    className="xp-btn"
                    onClick={() => {
                      setEditingCard(null);
                      setCardForm(EMPTY_CARD_FORM);
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  className="xp-btn is-default"
                  disabled={saveCardMutation.isPending || !effectiveSelectedDeckId}
                >
                  {editingCard ? "Save" : "Add card"}
                </button>
              </div>
            </fieldset>
          </form>
        )}

        <div className="xp-well overflow-x-auto">
          <table className="xp-listview">
            <thead>
              <tr>
                <th>Front</th>
                <th>Back</th>
                <th>State</th>
                <th>Notes</th>
                <th style={{ width: 1 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cards.isLoading && (
                <tr>
                  <td colSpan={5} className="xp-muted">
                    Loading cards…
                  </td>
                </tr>
              )}
              {cards.data?.map((card) => (
                <tr key={card.id}>
                  <td style={{ fontWeight: 700 }}>{card.front}</td>
                  <td>{card.back}</td>
                  <td className="xp-muted">{card.state}</td>
                  <td>
                    {card.gender && (
                      <span className="xp-muted">
                        {genderLabel(card.gender)}{" "}
                      </span>
                    )}
                    {card.is_false_friend && (
                      <span style={{ color: "#c4523a" }}>faux ami </span>
                    )}
                    {card.cognate_note}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {selectedDeck && (
                      <>
                        <Speak
                          language={selectedDeck.language}
                          text={cardSpeechText(card)}
                          url={card.audio_url || undefined}
                        />{" "}
                      </>
                    )}
                    {!readOnly && (
                      <>
                        <button
                          type="button"
                          className="xp-link"
                          onClick={() => edit(card)}
                        >
                          [edit]
                        </button>{" "}
                        <button
                          type="button"
                          className="xp-link"
                          onClick={() => enrichMutation.mutate(card.id)}
                        >
                          [enrich]
                        </button>{" "}
                        <button
                          type="button"
                          className="xp-link"
                          onClick={() => deleteCardMutation.mutate(card.id)}
                        >
                          [delete]
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {cards.data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="xp-muted">
                    {readOnly
                      ? "This deck is empty."
                      : "This deck is empty. Add a card above."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {koboOpen && (
        <ImportDialog
          decks={decks}
          onClose={() => setKoboOpen(false)}
          onImported={(deckId) => {
            setKoboOpen(false);
            setSelectedDeckId(deckId);
          }}
        />
      )}
    </div>
  );
}
