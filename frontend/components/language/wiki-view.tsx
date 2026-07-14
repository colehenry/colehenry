"use client";

// Wiki shell: tab bar plus the dictionary search page. The other two tabs
// live in wiki-conjugation.tsx and wiki-pronunciation.tsx.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCard,
  getVerb,
  listVerbSets,
  saveVerb,
  wikiLookup,
  type Deck,
  type LanguageCode,
  type WikiConjugation,
  type WikiDefsLanguage,
  type WikiResult,
} from "@/lib/api/language";
import { displayConjugation } from "@/lib/conjugation";
import { genderLabel, Speak, spokenConjugation } from "./language-shared";
import { Conjugation } from "./wiki-conjugation";
import { Pronunciation } from "./wiki-pronunciation";
import { ES_TENSES, TENSES, personSlotLabel } from "./wiki-tenses";

export type WikiTab = "search" | "conjugation" | "pronunciation";
export type WikiQuery = { language: LanguageCode; word: string };

function freqLabel(freq: number): string {
  if (freq >= 100) return "very common";
  if (freq >= 10) return "common";
  if (freq >= 1) return "less common";
  return "rare";
}

export function WikiView({
  decks,
  readOnly = false,
  initialTab = "search",
  initialQuery = null,
  onTabChange,
  onStudyDeck,
  onStudyVerbSet,
  onDrillsCreated,
}: {
  decks: Deck[];
  readOnly?: boolean;
  initialTab?: WikiTab;
  initialQuery?: WikiQuery | null;
  onTabChange?: (tab: WikiTab) => void;
  onStudyDeck: (deckId: number) => void;
  onStudyVerbSet: (setId: number, language: LanguageCode) => void;
  onDrillsCreated: () => void;
}) {
  const [tab, setTab] = useState<WikiTab>(initialTab);
  const [conjugationVerbId, setConjugationVerbId] = useState<number | null>(
    null,
  );
  const [conjugationLanguage, setConjugationLanguage] =
    useState<LanguageCode>("fr");

  // The sidebar tree drives initialTab after mount too — follow it.
  const [lastInitialTab, setLastInitialTab] = useState(initialTab);
  if (initialTab !== lastInitialTab) {
    setLastInitialTab(initialTab);
    setTab(initialTab);
  }

  const switchTab = (next: WikiTab) => {
    setTab(next);
    onTabChange?.(next);
  };

  return (
    <div>
      <div className="xp-tabs">
        {(
          [
            ["search", "Search"],
            ["conjugation", "Conjugations"],
            ["pronunciation", "Pronunciation"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`xp-tab ${tab === id ? "is-active" : ""}`}
            onClick={() => switchTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="xp-tab-panel">
        {tab === "search" && (
          <WikiSearch
            decks={decks}
            readOnly={readOnly}
            initialQuery={initialQuery}
            onOpenVerb={(verbId, language) => {
              setConjugationVerbId(verbId);
              setConjugationLanguage(language);
              switchTab("conjugation");
            }}
          />
        )}
        {tab === "conjugation" && (
          <Conjugation
            readOnly={readOnly}
            initialVerbId={conjugationVerbId}
            initialLanguage={conjugationLanguage}
            onDrillsCreated={onDrillsCreated}
            onStudyVerbSet={onStudyVerbSet}
          />
        )}
        {tab === "pronunciation" && (
          <Pronunciation decks={decks} onStudyDeck={onStudyDeck} />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Search — look up any word                                                   */
/* -------------------------------------------------------------------------- */

function WikiSearch({
  decks,
  readOnly,
  initialQuery,
  onOpenVerb,
}: {
  decks: Deck[];
  readOnly: boolean;
  initialQuery?: WikiQuery | null;
  onOpenVerb: (verbId: number, language: LanguageCode) => void;
}) {
  const [language, setLanguage] = useState<LanguageCode>(
    initialQuery?.language ?? "fr",
  );
  const [defs, setDefs] = useState<WikiDefsLanguage>("en");
  const [input, setInput] = useState(initialQuery?.word ?? "");
  const [query, setQuery] = useState<WikiQuery | null>(
    initialQuery
      ? { language: initialQuery.language, word: initialQuery.word }
      : null,
  );

  // The app shell can push a new lookup (e.g. the title-bar phrase).
  const [lastInitialQuery, setLastInitialQuery] = useState(initialQuery);
  if (initialQuery !== lastInitialQuery) {
    setLastInitialQuery(initialQuery);
    if (initialQuery) {
      setLanguage(initialQuery.language);
      setInput(initialQuery.word);
      setQuery(initialQuery);
    }
  }

  // Live lookups can hit external dictionaries and the LLM, so the endpoint
  // is owner-only and the preview never calls it.
  const result = useQuery({
    queryKey: ["language", "wiki", query?.language, query?.word, defs],
    queryFn: () => wikiLookup(query!.language, query!.word, defs),
    enabled: query != null && !readOnly,
  });

  const search = (word: string, lang: LanguageCode = language) => {
    const cleaned = word.trim().toLowerCase();
    if (cleaned) setQuery({ language: lang, word: cleaned });
  };

  if (readOnly) {
    return (
      <div className="flex flex-col gap-2 pt-4 text-center">
        <p className="xp-muted">
          Dictionary search runs live lookups (external dictionaries and an
          LLM fallback), so it stays owner-only.
        </p>
        <p className="xp-muted">
          The <b>Conjugations</b> and <b>Pronunciation</b> tabs are fully
          browsable.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        className="mx-auto flex w-full max-w-lg items-end gap-2 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          search(input);
        }}
      >
        <select
          aria-label="Language"
          className="xp-select"
          value={language}
          onChange={(event) => setLanguage(event.target.value as LanguageCode)}
        >
          <option value="fr">FR</option>
          <option value="es">ES</option>
        </select>
        <input
          aria-label="Look up a word"
          className="xp-input flex-1"
          placeholder="Any word — English works too…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button className="xp-btn is-default" disabled={!input.trim()}>
          Look up
        </button>
        <div>
          <label className="xp-label" htmlFor="wiki-defs">
            Defs in:
          </label>
          <select
            id="wiki-defs"
            className="xp-select"
            value={defs}
            onChange={(event) =>
              setDefs(event.target.value as WikiDefsLanguage)
            }
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
          </select>
        </div>
      </form>

      {!query && (
        <p className="xp-muted text-center">
          Definitions, gender, pronunciation, and conjugations — for any French
          or Spanish word.
        </p>
      )}

      {result.isLoading && <p className="xp-muted text-center">Looking up…</p>}
      {result.isError && (
        <p className="xp-muted text-center">
          The lookup failed. Check the connection and try again.
        </p>
      )}
      {result.data && (
        <WikiWordPage
          key={`${result.data.language}:${result.data.word}`}
          result={result.data}
          decks={decks}
          onSearch={(word, nextLanguage = result.data.language) => {
            setLanguage(nextLanguage);
            setInput(word);
            search(word, nextLanguage);
          }}
          onOpenVerb={onOpenVerb}
        />
      )}
    </div>
  );
}

function WikiWordPage({
  result,
  decks,
  onSearch,
  onOpenVerb,
}: {
  result: WikiResult;
  decks: Deck[];
  onSearch: (word: string, language?: LanguageCode) => void;
  onOpenVerb: (verbId: number, language: LanguageCode) => void;
}) {
  const queryClient = useQueryClient();
  const compatibleDecks = decks.filter(
    (d) => d.language === result.language && !d.is_system,
  );
  const [deckId, setDeckId] = useState<number | "">(
    compatibleDecks[0]?.id ?? "",
  );
  const [selectedSetIds, setSelectedSetIds] = useState<number[]>([]);
  const existingDeckIds = new Set(
    result.existing_cards.map((card) => card.deck_id),
  );
  const selectedDeckHasCard =
    deckId !== "" && existingDeckIds.has(deckId as number);

  const verbSets = useQuery({
    queryKey: ["language", "verb-sets", result.language],
    queryFn: () => listVerbSets(result.language),
    enabled: result.is_verb,
  });

  // Saved verbs keep their conjugations in the DB — reuse them for the panel.
  const savedVerb = useQuery({
    queryKey: ["language", "verb", result.verb_id],
    queryFn: () => getVerb(result.verb_id as number),
    enabled: result.verb_id != null,
  });
  const conjugations: WikiConjugation[] = result.conjugations.length
    ? result.conjugations
    : (savedVerb.data?.conjugations ?? []);

  const addCardMutation = useMutation({
    mutationFn: () => {
      if (!deckId) throw new Error("No deck");
      return createCard({
        deck_id: deckId as number,
        front: result.headword || result.word,
        back: result.is_inflected
          ? ""
          : (result.entries[0]?.senses[0]?.definition ?? ""),
        tags: ["wiki"],
        enrich: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["language", "decks"] });
      queryClient.invalidateQueries({
        queryKey: ["language", "wiki", result.language],
      });
    },
  });

  const saveVerbMutation = useMutation({
    mutationFn: () =>
      saveVerb(
        result.language,
        result.headword || result.word,
        selectedSetIds,
      ),
    onSuccess: (verb) => {
      queryClient.invalidateQueries({ queryKey: ["language", "verbs"] });
      queryClient.invalidateQueries({ queryKey: ["language", "verb-sets"] });
      queryClient.invalidateQueries({
        queryKey: ["language", "wiki", result.language, result.word],
      });
      onOpenVerb(verb.id, verb.language);
    },
  });

  return (
    <div className="flex flex-col gap-3">
      {/* header */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span style={{ fontSize: "22px", fontWeight: 700 }}>{result.word}</span>
        <Speak language={result.language} text={result.word} label="► listen" />
        {result.ipa && <span className="xp-ipa xp-muted">{result.ipa}</span>}
        {result.gender && (
          <span>
            {genderLabel(result.gender)}{" "}
            <span className="xp-muted">
              ({result.gender === "m" ? "le" : "la"} {result.word})
            </span>
          </span>
        )}
        {result.frequency != null && result.frequency > 0 && (
          <span
            className="xp-muted"
            title={`Said ${result.frequency.toFixed(1)} times per million words in film subtitles (Lexique)`}
          >
            {freqLabel(result.frequency)} · {result.frequency.toFixed(1)}/M
          </span>
        )}
      </div>

      {result.translated_from && (
        <p className="xp-muted">
          English “{result.translated_from}” → <b>{result.word}</b>
        </p>
      )}

      {!result.found && (
        <p className="xp-muted">
          No dictionary entry for “{result.word}”
          {result.lemma ? (
            <>
              {" "}
              — it may be a form of{" "}
              <button
                type="button"
                className="xp-link"
                onClick={() => onSearch(result.lemma)}
              >
                {result.lemma}
              </button>
            </>
          ) : (
            <>
              . Check the spelling (accents matter) — phrases and rare words can
              still be heard and added to a deck below.
            </>
          )}
        </p>
      )}

      {result.found && result.lemma && (
        <p className="xp-muted">
          Form of{" "}
          <button
            type="button"
            className="xp-link"
            onClick={() => onSearch(result.lemma)}
          >
            {result.lemma}
          </button>
        </p>
      )}

      {result.is_inflected && result.form_note && (
        <p className="xp-muted">{result.form_note}</p>
      )}

      {result.equivalent && (
        <p className="xp-muted">
          {result.equivalent.language.toUpperCase()} equivalent: {" "}
          <button
            type="button"
            className="xp-link"
            onClick={() =>
              onSearch(result.equivalent!.word, result.equivalent!.language)
            }
          >
            {result.equivalent.word}
          </button>
        </p>
      )}

      {result.source === "llm" && (
        <p className="xp-muted">
          ✦ AI-generated definition — not in the dictionary, so double-check
          before trusting it.
        </p>
      )}

      {result.is_false_friend && (
        <fieldset className="xp-group">
          <legend>⚠ Faux ami</legend>
          <p>{result.cognate_note}</p>
        </fieldset>
      )}

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* dictionary entries */}
          {result.entries.map((entry, i) => (
            <fieldset key={i} className="xp-group">
              <legend>
                {entry.part_of_speech || "entry"}
                {entry.gender && (
                  <span className="xp-muted">
                    {" "}
                    · {genderLabel(entry.gender)}
                  </span>
                )}
                {entry.ipa && (
                  <span className="xp-ipa xp-muted"> {entry.ipa}</span>
                )}
              </legend>
              <ol className="flex list-decimal flex-col gap-1 pl-5">
                {entry.senses.map((sense, j) => (
                  <li key={j}>
                    <span
                      title={sense.translation ? sense.definition : undefined}
                    >
                      {sense.translation || sense.definition}
                    </span>
                    {sense.tags.length > 0 && (
                      <span className="xp-muted">
                        {" "}
                        ({sense.tags.join(", ")})
                      </span>
                    )}
                    {sense.examples.map((example, k) => (
                      <div key={k} className="xp-muted">
                        “{example}”{" "}
                        <Speak
                          language={result.language}
                          text={example}
                          label="►"
                        />
                      </div>
                    ))}
                  </li>
                ))}
              </ol>
              {entry.synonyms.length > 0 && (
                <p className="xp-muted mt-1">
                  Synonyms:{" "}
                  {entry.synonyms.map((syn, j) => (
                    <span key={syn}>
                      {j > 0 && ", "}
                      <button
                        type="button"
                        className="xp-link"
                        onClick={() => onSearch(syn)}
                      >
                        {syn}
                      </button>
                    </span>
                  ))}
                </p>
              )}
            </fieldset>
          ))}

          {/* actions */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Deck"
              className="xp-select"
              value={deckId}
              onChange={(event) =>
                setDeckId(event.target.value ? Number(event.target.value) : "")
              }
            >
              {compatibleDecks.length === 0 && (
                <option value="">No matching deck</option>
              )}
              {compatibleDecks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}{existingDeckIds.has(d.id) ? " — already added" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="xp-btn is-small"
              disabled={
                !deckId || addCardMutation.isPending || selectedDeckHasCard
              }
              onClick={() => addCardMutation.mutate()}
            >
              {addCardMutation.isSuccess
                ? "Card added ✓"
                : selectedDeckHasCard
                  ? "Already in deck"
                  : `Add ${result.headword || result.word}`}
            </button>
            {result.verb_id != null && (
              <button
                type="button"
                className="xp-btn is-small"
                onClick={() =>
                  onOpenVerb(result.verb_id as number, result.language)
                }
              >
                Open in conjugations
              </button>
            )}
            {result.is_verb &&
              result.verb_id == null &&
              result.can_conjugate && (
                <div className="flex flex-wrap items-center gap-2">
                  {(verbSets.data ?? []).map((set) => (
                    <label key={set.id} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        className="xp-checkbox"
                        checked={selectedSetIds.includes(set.id)}
                        onChange={(event) =>
                          setSelectedSetIds((current) =>
                            event.target.checked
                              ? [...current, set.id]
                              : current.filter((id) => id !== set.id),
                          )
                        }
                      />
                      {set.name}
                    </label>
                  ))}
                  <button
                    type="button"
                    className="xp-btn is-small"
                    disabled={saveVerbMutation.isPending}
                    onClick={() => saveVerbMutation.mutate()}
                  >
                    Save to conjugation center
                  </button>
                </div>
              )}
          </div>
        </div>

        {/* conjugation preview — every verb, tense picker on the right */}
        {conjugations.length > 0 && (
          <aside className="w-full lg:w-72 lg:shrink-0">
            <ConjugationPanel
              conjugations={conjugations}
              language={result.language}
              predicted={result.predicted}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function ConjugationPanel({
  conjugations,
  language,
  predicted,
}: {
  conjugations: WikiConjugation[];
  language: LanguageCode;
  predicted: boolean;
}) {
  const tenseList: readonly {
    mood: string;
    tense: string;
    label: string;
  }[] = language === "es" ? ES_TENSES : TENSES;
  const options = tenseList.filter(({ mood, tense }) =>
    conjugations.some((c) => c.mood === mood && c.tense === tense),
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const active =
    options.find(({ mood, tense }) => `${mood}|${tense}` === selectedKey) ??
    options[0];
  if (!active) return null;
  const rows = conjugations.filter(
    (c) => c.mood === active.mood && c.tense === active.tense,
  );

  return (
    <fieldset className="xp-group">
      <legend>Conjugation</legend>
      <select
        aria-label="Tense"
        className="xp-select mb-2 w-full"
        value={`${active.mood}|${active.tense}`}
        onChange={(event) => setSelectedKey(event.target.value)}
      >
        {options.map(({ mood, tense, label }) => (
          <option key={`${mood}|${tense}`} value={`${mood}|${tense}`}>
            {label}
          </option>
        ))}
      </select>
      <table className="xp-listview" style={{ background: "transparent" }}>
        <tbody>
          {rows.map((conj) => (
            <tr key={`${conj.person}-${conj.form}`}>
              <td className="xp-muted" style={{ width: "35%" }}>
                {personSlotLabel(conj.person)}
              </td>
              <td>
                <b>
                  {displayConjugation(
                    conj.person,
                    conj.form,
                    conj.mood,
                    language,
                  )}
                </b>
              </td>
              <td style={{ width: 1 }}>
                <Speak
                  language={language}
                  text={spokenConjugation(
                    conj.person,
                    conj.form,
                    conj.mood,
                    language,
                  )}
                  label="►"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {predicted && (
        <p className="xp-muted mt-2">
          ⚠ Template inferred — double-check unusual forms.
        </p>
      )}
    </fieldset>
  );
}
