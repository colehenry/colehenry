"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  importCommit,
  koboImportPreview,
  pasteImportPreview,
  type Deck,
  type ImportItem,
  type ImportSource,
  type LanguageCode,
} from "@/lib/api/language";
import { genderLabel } from "./language-shared";

/**
 * Bulk-import words into a deck from one of two sources:
 *  - "paste"  - a newline/comma-separated list typed into a textarea
 *  - "kobo"   - an uploaded KoboReader.sqlite of highlights
 * Both resolve every term (dictionary → LLM for phrases), dedupe against your
 * decks, and share one review → commit step. Terms already in a deck are shown
 * but unchecked by default.
 */
export function ImportDialog({
  decks,
  onClose,
  onImported,
}: {
  decks: Deck[];
  onClose: () => void;
  onImported: (deckId: number) => void;
}) {
  const queryClient = useQueryClient();
  const [source, setSource] = useState<ImportSource>("paste");
  const [language, setLanguage] = useState<LanguageCode>("fr");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<ImportItem[] | null>(null);
  const [totalTerms, setTotalTerms] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deckId, setDeckId] = useState<number | "">("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compatibleDecks = useMemo(
    () => decks.filter((d) => d.language === language && !d.is_system),
    [decks, language],
  );

  const preview = useMutation({
    mutationFn: () => {
      if (source === "paste") {
        if (!text.trim()) throw new Error("Paste some words first.");
        return pasteImportPreview(language, text);
      }
      if (!file) throw new Error("Choose your KoboReader.sqlite file first.");
      return koboImportPreview(language, file);
    },
    onSuccess: (data) => {
      setItems(data.items);
      setTotalTerms(data.total_highlights);
      // Pre-check everything not already sitting in a deck.
      setSelected(
        new Set(
          data.items.flatMap((it, i) =>
            it.existing_decks.length === 0 ? [i] : [],
          ),
        ),
      );
      const firstDeck = decks.find(
        (d) => d.language === data.language && !d.is_system,
      );
      setDeckId(firstDeck?.id ?? "");
    },
  });

  const commit = useMutation({
    mutationFn: () => {
      if (!deckId || !items) throw new Error("Pick a deck to import into.");
      const cards = [...selected].map((i) => {
        const it = items[i];
        return {
          front: it.front,
          back: it.back,
          ipa: it.ipa,
          gender: it.gender,
          part_of_speech: it.part_of_speech,
          cognate_note: it.cognate_note,
          is_false_friend: it.is_false_friend,
          source_ref: it.book,
        };
      });
      return importCommit(deckId as number, source, cards);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["language", "decks"] });
      queryClient.invalidateQueries({
        queryKey: ["language", "cards", deckId],
      });
      onImported(deckId as number);
    },
  });

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const allCheckable = items
    ? items.flatMap((it, i) => (it.existing_decks.length === 0 ? [i] : []))
    : [];
  const allChecked =
    allCheckable.length > 0 && allCheckable.every((i) => selected.has(i));

  return (
    <>
      <button
        type="button"
        aria-label="Close dialog"
        className="xp-dialog-backdrop cursor-default"
        onClick={onClose}
      />
      <div
        className="xp-dialog"
        role="dialog"
        aria-label="Import words"
        style={{ width: "min(720px, 92vw)" }}
      >
        <div className="xp-titlebar">
          <span className="xp-title-text">Import words</span>
          <button
            type="button"
            className="xp-caption-btn is-close"
            aria-label="Close dialog"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="xp-dialog-body">
          {!items ? (
            <fieldset className="xp-group flex flex-col gap-2">
              <legend>Source</legend>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`xp-btn is-small ${source === "paste" ? "is-default" : ""}`}
                  onClick={() => setSource("paste")}
                >
                  Paste words
                </button>
                <button
                  type="button"
                  className={`xp-btn is-small ${source === "kobo" ? "is-default" : ""}`}
                  onClick={() => setSource("kobo")}
                >
                  Kobo file
                </button>
              </div>

              <div>
                <label className="xp-label" htmlFor="import-language">
                  Language:
                </label>
                <select
                  id="import-language"
                  className="xp-select"
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value as LanguageCode)
                  }
                >
                  <option value="fr">French</option>
                  <option value="es">Spanish</option>
                </select>
              </div>

              {source === "paste" ? (
                <div>
                  <label className="xp-label" htmlFor="import-text">
                    Words (one per line, or comma-separated):
                  </label>
                  <textarea
                    id="import-text"
                    className="xp-textarea"
                    style={{ minHeight: 140 }}
                    placeholder={"chaleureux\ndépayser\nfaire la grasse matinée"}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                  />
                  <p className="xp-muted">
                    Each entry is looked up and de-duplicated against your decks.
                    Phrases the dictionary lacks fall back to the AI definer.
                  </p>
                </div>
              ) : (
                <div>
                  <span className="xp-label">File:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="xp-btn is-small"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Choose file…
                    </button>
                    <span className="xp-muted">
                      {file ? file.name : "No file chosen"}
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    id="import-file"
                    type="file"
                    className="hidden"
                    accept=".sqlite,application/x-sqlite3,application/vnd.sqlite3"
                    onChange={(event) =>
                      setFile(event.target.files?.[0] ?? null)
                    }
                  />
                  <p className="xp-muted">
                    Plug in your Kobo and pick{" "}
                    <code>.kobo/KoboReader.sqlite</code>.
                  </p>
                </div>
              )}
              {preview.isError && (
                <p className="xp-muted">{(preview.error as Error).message}</p>
              )}
            </fieldset>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {totalTerms} found · {selected.size} selected
                </span>
                <div className="flex items-center gap-2">
                  <label className="xp-label" htmlFor="import-deck">
                    Into:
                  </label>
                  <select
                    id="import-deck"
                    className="xp-select"
                    value={deckId}
                    onChange={(event) =>
                      setDeckId(
                        event.target.value ? Number(event.target.value) : "",
                      )
                    }
                  >
                    {compatibleDecks.length === 0 && (
                      <option value="">No matching deck</option>
                    )}
                    {compatibleDecks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                className="xp-well"
                style={{ maxHeight: 320, overflow: "auto" }}
              >
                <table className="xp-listview" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}>
                        <input
                          type="checkbox"
                          aria-label="Select all new"
                          checked={allChecked}
                          onChange={() =>
                            setSelected(
                              allChecked ? new Set() : new Set(allCheckable),
                            )
                          }
                        />
                      </th>
                      <th>Word</th>
                      <th>Meaning</th>
                      {source === "kobo" && <th>Book</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => {
                      const exists = it.existing_decks.length > 0;
                      return (
                        <tr key={i}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Select ${it.front}`}
                              checked={selected.has(i)}
                              onChange={() => toggle(i)}
                            />
                          </td>
                          <td>
                            <b>{it.front}</b>
                            {it.gender && (
                              <span className="xp-muted">
                                {" "}
                                {genderLabel(it.gender)}
                              </span>
                            )}
                            {it.is_inflected &&
                              it.selected_text !== it.front && (
                                <span className="xp-muted">
                                  {" "}
                                  · {it.selected_text}
                                </span>
                              )}
                            {it.is_false_friend && (
                              <span style={{ color: "#c4523a" }}> faux-ami</span>
                            )}
                          </td>
                          <td>
                            {it.back || <span className="xp-muted">-</span>}
                            {exists && (
                              <span className="xp-muted">
                                {" "}
                                (in {it.existing_decks.join(", ")})
                              </span>
                            )}
                          </td>
                          {source === "kobo" && (
                            <td className="xp-muted">{it.book}</td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {commit.isError && (
                <p className="xp-muted">{(commit.error as Error).message}</p>
              )}
            </div>
          )}
        </div>

        <div className="xp-dialog-buttons">
          <button type="button" className="xp-btn" onClick={onClose}>
            Cancel
          </button>
          {!items ? (
            <button
              type="button"
              className="xp-btn is-default"
              disabled={
                preview.isPending ||
                (source === "paste" ? !text.trim() : !file)
              }
              onClick={() => preview.mutate()}
            >
              {preview.isPending ? "Reading…" : "Preview"}
            </button>
          ) : (
            <button
              type="button"
              className="xp-btn is-default"
              disabled={!deckId || selected.size === 0 || commit.isPending}
              onClick={() => commit.mutate()}
            >
              {commit.isPending
                ? "Importing…"
                : `Import ${selected.size} card${selected.size === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
