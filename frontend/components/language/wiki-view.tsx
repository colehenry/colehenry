"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCard,
  addVerbToSet,
  createVerbSet,
  createDrills,
  getConjugationAudio,
  getVerb,
  listCards,
  listVerbSets,
  removeVerbFromSet,
  listVerbs,
  saveVerb,
  wikiLookup,
  type Conjugation as ConjugationRow,
  type Deck,
  type DrillIn,
  type LanguageCode,
  type VerbDetail,
  type VerbSet,
  type WikiConjugation,
  type WikiDefsLanguage,
  type WikiResult,
} from "@/lib/api/language";
import {
  conjugationSoundKey,
  displayConjugation,
} from "@/lib/conjugation";
import {
  genderLabel,
  playAudio,
  Speak,
  speakText,
  spokenConjugation,
} from "./language-shared";

export type WikiTab = "search" | "conjugation" | "pronunciation";
export type WikiQuery = { language: LanguageCode; word: string };

const TENSES = [
  { mood: "indicatif", tense: "présent", label: "Présent" },
  { mood: "indicatif", tense: "passé-composé", label: "Passé composé" },
  { mood: "indicatif", tense: "imparfait", label: "Imparfait" },
  { mood: "indicatif", tense: "futur-proche", label: "Futur proche" },
  { mood: "indicatif", tense: "futur-simple", label: "Futur simple" },
  { mood: "conditionnel", tense: "présent", label: "Conditionnel" },
  { mood: "subjonctif", tense: "présent", label: "Subjonctif" },
  { mood: "imperatif", tense: "présent", label: "Impératif" },
  { mood: "indicatif", tense: "passé-simple", label: "Passé simple" },
] as const;

const PERSON_SLOT_LABELS: Record<string, string> = {
  "1s": "1st singular",
  "2s": "2nd singular",
  "3s": "3rd singular",
  "1p": "1st plural",
  "2p": "2nd plural",
  "3p": "3rd plural",
};

const ES_TENSES = [
  { mood: "indicativo", tense: "presente", label: "Presente" },
  {
    mood: "indicativo",
    tense: "pretérito-perfecto-compuesto",
    label: "Pretérito perfecto",
  },
  { mood: "indicativo", tense: "pretérito-imperfecto", label: "Imperfecto" },
  { mood: "indicativo", tense: "futuro-próximo", label: "Futuro próximo" },
  { mood: "indicativo", tense: "futuro", label: "Futuro" },
  {
    mood: "indicativo",
    tense: "pretérito-perfecto-simple",
    label: "Indefinido",
  },
  { mood: "condicional", tense: "presente", label: "Condicional" },
  { mood: "subjuntivo", tense: "presente", label: "Subjuntivo" },
  { mood: "imperativo", tense: "afirmativo", label: "Imperativo" },
] as const;

function freqLabel(freq: number): string {
  if (freq >= 100) return "very common";
  if (freq >= 10) return "common";
  if (freq >= 1) return "less common";
  return "rare";
}

function personSlotLabel(person: string): string {
  return PERSON_SLOT_LABELS[person] ?? person;
}

function localizedMood(slotKey: string, language: LanguageCode): string {
  const mood = slotKey.split(":", 1)[0];
  if (mood === "imperative") {
    return language === "fr" ? "imperatif" : "imperativo";
  }
  if (mood === "subjunctive") {
    return language === "fr" ? "subjonctif" : "subjuntivo";
  }
  return mood;
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

/* -------------------------------------------------------------------------- */
/* Pronunciation — sounds you can actually hear                                */
/* -------------------------------------------------------------------------- */

type SoundRow = {
  grapheme: string;
  ipa: string;
  examples: string[];
  note?: string;
};

const SOUND_GROUPS: { title: string; blurb: string; rows: SoundRow[] }[] = [
  {
    title: "Oral vowels",
    blurb: "Letter groups map to one steady vowel — no gliding like English.",
    rows: [
      {
        grapheme: "é · -er · -ez",
        ipa: "/e/",
        examples: ["été", "parler", "chez"],
      },
      {
        grapheme: "è · ê · ai",
        ipa: "/ɛ/",
        examples: ["mère", "fête", "mais"],
      },
      {
        grapheme: "e (muet)",
        ipa: "/ə/",
        examples: ["le", "petit", "samedi"],
        note: "Often dropped entirely in fast speech.",
      },
      { grapheme: "a", ipa: "/a/", examples: ["chat", "madame"] },
      { grapheme: "i · y", ipa: "/i/", examples: ["vie", "stylo"] },
      { grapheme: "ou", ipa: "/u/", examples: ["tout", "jour", "amour"] },
      {
        grapheme: "u",
        ipa: "/y/",
        examples: ["tu", "rue", "musique"],
        note: "Say /i/, then round the lips — not Spanish u.",
      },
      {
        grapheme: "o · au · eau",
        ipa: "/o/",
        examples: ["mot", "chaud", "beau"],
      },
      {
        grapheme: "eu · œu",
        ipa: "/ø/ · /œ/",
        examples: ["peu", "sœur", "fleur"],
      },
      { grapheme: "oi", ipa: "/wa/", examples: ["moi", "voiture", "trois"] },
    ],
  },
  {
    title: "Nasal vowels",
    blurb:
      "Air through the nose, and the n/m is never pronounced. These carry meaning where Spanish uses vowel + n.",
    rows: [
      {
        grapheme: "in · ain · ein · un",
        ipa: "/ɛ̃/",
        examples: ["vin", "pain", "plein", "brun"],
      },
      {
        grapheme: "an · en",
        ipa: "/ɑ̃/",
        examples: ["vent", "blanc", "enfant"],
      },
      { grapheme: "on", ipa: "/ɔ̃/", examples: ["bon", "maison", "pont"] },
    ],
  },
  {
    title: "Consonants & combinations",
    blurb: "The letter groups that don't sound like they look.",
    rows: [
      { grapheme: "ch", ipa: "/ʃ/", examples: ["chat", "chien"] },
      {
        grapheme: "j · g(e,i)",
        ipa: "/ʒ/",
        examples: ["jour", "genou", "girafe"],
      },
      { grapheme: "gn", ipa: "/ɲ/", examples: ["montagne", "gagner"] },
      {
        grapheme: "ill · -il",
        ipa: "/j/",
        examples: ["fille", "travail", "soleil"],
        note: "Exceptions: ville, mille, tranquille use /l/.",
      },
      { grapheme: "qu", ipa: "/k/", examples: ["qui", "musique"] },
      {
        grapheme: "r",
        ipa: "/ʁ/",
        examples: ["rue", "Paris", "parler"],
        note: "Soft, in the throat — never rolled like Spanish rr.",
      },
      { grapheme: "ç", ipa: "/s/", examples: ["ça", "français"] },
      {
        grapheme: "h",
        ipa: "(silent)",
        examples: ["homme", "heure"],
        note: "h muet allows liaison and elision (l'homme).",
      },
    ],
  },
];

const SILENT_EXAMPLES = {
  silent: ["grand", "petit", "trop", "vous", "nez"],
  pronounced: ["avec", "pour", "chef", "avril"],
};

const LIAISONS: { phrase: string; note: string; forbidden?: boolean }[] = [
  { phrase: "les amis", note: "s links as /z/ — lay-za-mi" },
  { phrase: "vous avez", note: "vou-za-vay" },
  { phrase: "un homme", note: "n carries over — œ̃-nɔm" },
  { phrase: "petit ami", note: "the silent t comes back — pə-ti-ta-mi" },
  { phrase: "et aussi", note: "never liaise after et", forbidden: true },
  { phrase: "les héros", note: "h aspiré blocks the link", forbidden: true },
];

function Pronunciation({
  decks,
  onStudyDeck,
}: {
  decks: Deck[];
  onStudyDeck: (deckId: number) => void;
}) {
  const minimalPairDeck = decks.find((deck) =>
    deck.name.toLowerCase().includes("minimal pairs"),
  );
  const pairs = useQuery({
    queryKey: ["language", "cards", minimalPairDeck?.id],
    queryFn: () => listCards(minimalPairDeck?.id as number),
    enabled: minimalPairDeck != null,
  });

  return (
    <div className="flex flex-col gap-3">
      {SOUND_GROUPS.map((group) => (
        <fieldset key={group.title} className="xp-group">
          <legend>{group.title}</legend>
          <p className="mb-2">{group.blurb}</p>
          <div className="overflow-x-auto">
            <table
              className="xp-listview"
              style={{ background: "transparent" }}
            >
              <thead>
                <tr>
                  <th>Spelling</th>
                  <th>Sound</th>
                  <th>Hear it</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.grapheme}>
                    <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                      {row.grapheme}
                    </td>
                    <td className="xp-ipa" style={{ whiteSpace: "nowrap" }}>
                      {row.ipa}
                    </td>
                    <td>
                      {row.examples.map((word, i) => (
                        <span key={word}>
                          {i > 0 && " · "}
                          <Speak
                            language="fr"
                            text={word}
                            label={word}
                            className="xp-link"
                          />
                        </span>
                      ))}
                      {row.note && <div className="xp-muted">{row.note}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
      ))}

      <fieldset className="xp-group">
        <legend>Silent final consonants</legend>
        <p>
          Final consonants are usually <b>silent</b> — except <b>C</b>, <b>R</b>
          , <b>F</b>, <b>L</b> (think <i>CaReFuL</i>), which usually sound.
        </p>
        <p className="mt-2">
          Silent:{" "}
          {SILENT_EXAMPLES.silent.map((word, i) => (
            <span key={word}>
              {i > 0 && " · "}
              <Speak language="fr" text={word} label={word} />
            </span>
          ))}
        </p>
        <p>
          Pronounced:{" "}
          {SILENT_EXAMPLES.pronounced.map((word, i) => (
            <span key={word}>
              {i > 0 && " · "}
              <Speak language="fr" text={word} label={word} />
            </span>
          ))}
        </p>
      </fieldset>

      <fieldset className="xp-group">
        <legend>Liaison</legend>
        <p className="mb-2">
          A silent final consonant is pronounced when the next word starts with
          a vowel — required inside noun and verb groups.
        </p>
        <table className="xp-listview" style={{ background: "transparent" }}>
          <tbody>
            {LIAISONS.map((row) => (
              <tr key={row.phrase}>
                <td style={{ width: 1, whiteSpace: "nowrap" }}>
                  {row.forbidden ? "✗" : "✓"}
                </td>
                <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                  <Speak language="fr" text={row.phrase} label={row.phrase} />
                </td>
                <td className="xp-muted">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>

      <div className="flex items-center justify-between">
        <span style={{ fontWeight: 700 }}>Minimal pairs</span>
        {minimalPairDeck && (
          <button
            type="button"
            className="xp-btn is-small"
            onClick={() => onStudyDeck(minimalPairDeck.id)}
          >
            Study these
          </button>
        )}
      </div>

      <div
        className="overflow-x-auto border"
        style={{ borderColor: "var(--xp-well-border)" }}
      >
        <table className="xp-listview">
          <thead>
            <tr>
              <th>Pair</th>
              <th>IPA</th>
              <th>Contrast</th>
              <th style={{ width: 1 }} />
            </tr>
          </thead>
          <tbody>
            {pairs.data?.map((card) => (
              <tr key={card.id}>
                <td style={{ fontWeight: 700 }}>{card.front}</td>
                <td className="xp-ipa">{card.ipa}</td>
                <td>{card.back}</td>
                <td>
                  <Speak
                    language="fr"
                    text={card.front}
                    url={card.audio_url || undefined}
                  />
                </td>
              </tr>
            ))}
            {pairs.isLoading && (
              <tr>
                <td colSpan={4} className="xp-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!minimalPairDeck && (
              <tr>
                <td colSpan={4} className="xp-muted">
                  Run <code>python -m app.seed_language</code> to create the
                  minimal-pair deck.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Conjugation center — saved verbs                                            */
/* -------------------------------------------------------------------------- */

function ConjugationTable({
  verb,
  showEquivalent,
  readOnly,
}: {
  verb: VerbDetail;
  showEquivalent: boolean;
  readOnly: boolean;
}) {
  const queryClient = useQueryClient();
  const audioMutation = useMutation({
    mutationFn: (conj: ConjugationRow) => getConjugationAudio(conj.id),
    onSuccess: (updated, conj) => {
      queryClient.setQueryData<VerbDetail>(
        ["language", "verb", verb.id],
        (current) =>
          current
            ? {
                ...current,
                conjugations: current.conjugations.map((row) =>
                  row.id === updated.id
                    ? { ...row, audio_url: updated.audio_url }
                    : row,
                ),
              }
            : current,
      );
      if (updated.audio_url) {
        playAudio(updated.audio_url);
      } else {
        // Server TTS unconfigured — browser speech says the same phrase.
        void speakText(
          verb.language,
          spokenConjugation(
            conj.person,
            conj.form,
            conj.mood,
            verb.language,
          ),
        );
      }
    },
  });

  return (
    <div className="flex flex-col gap-3">
      {(verb.language === "es" ? ES_TENSES : TENSES).map(
        ({ mood, tense, label }) => {
        const rows = verb.conjugations.filter(
          (conj) => conj.mood === mood && conj.tense === tense,
        );
        if (!rows.length) return null;
        const soundCounts = new Map<string, number>();
        for (const row of rows) {
          const key = conjugationSoundKey(
            row.form,
            row.person,
            verb.language,
          );
          soundCounts.set(key, (soundCounts.get(key) ?? 0) + 1);
        }
        return (
          <fieldset key={`${mood}-${tense}`} className="xp-group">
            <legend>
              {label} <span className="xp-muted">({mood})</span>
            </legend>
            <div className="overflow-x-auto">
              <table
                className="xp-listview"
                style={{ background: "transparent" }}
              >
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>{verb.language.toUpperCase()}</th>
                    {showEquivalent && verb.equivalent_language && (
                      <th>{verb.equivalent_language.toUpperCase()}</th>
                    )}
                    <th style={{ width: 1 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((conj) => (
                    <tr key={conj.id}>
                      <td className="xp-muted">
                        {personSlotLabel(conj.person)}
                      </td>
                      <td>
                        <b>
                          {displayConjugation(
                            conj.person,
                            conj.form,
                            conj.mood,
                            verb.language,
                          )}
                        </b>
                        {(soundCounts.get(
                          conjugationSoundKey(
                            conj.form,
                            conj.person,
                            verb.language,
                          ),
                        ) ?? 0) > 1 && (
                          <span className="xp-muted">
                            {" "}(same verb sound)
                          </span>
                        )}
                      </td>
                      {showEquivalent && verb.equivalent_language && (
                        <td>
                          {conj.equivalent_form &&
                          (verb.equivalent_language === "fr" ||
                            verb.equivalent_language === "es")
                            ? displayConjugation(
                                conj.person,
                                conj.equivalent_form,
                                localizedMood(
                                  conj.slot_key,
                                  verb.equivalent_language,
                                ),
                                verb.equivalent_language,
                              )
                            : "—"}
                        </td>
                      )}
                      <td>
                        <button
                          type="button"
                          className="xp-link"
                          title={`Listen: ${spokenConjugation(conj.person, conj.form, conj.mood, verb.language)}`}
                          onClick={() => {
                            if (conj.audio_url) {
                              playAudio(conj.audio_url);
                            } else if (readOnly) {
                              // Generating server TTS is owner-only; the
                              // preview falls back to browser speech.
                              void speakText(
                                verb.language,
                                spokenConjugation(
                                  conj.person,
                                  conj.form,
                                  conj.mood,
                                  verb.language,
                                ),
                              );
                            } else {
                              audioMutation.mutate(conj);
                            }
                          }}
                        >
                          [listen]
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </fieldset>
        );
        },
      )}
    </div>
  );
}

function Conjugation({
  readOnly,
  initialVerbId,
  initialLanguage,
  onDrillsCreated,
  onStudyVerbSet,
}: {
  readOnly: boolean;
  initialVerbId?: number | null;
  initialLanguage?: LanguageCode;
  onDrillsCreated: () => void;
  onStudyVerbSet: (setId: number, language: LanguageCode) => void;
}) {
  const queryClient = useQueryClient();
  const [language, setLanguage] = useState<LanguageCode>(
    initialLanguage ?? "fr",
  );
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [selectedVerbId, setSelectedVerbId] = useState<number | null>(
    initialVerbId ?? null,
  );
  const [showEquivalent, setShowEquivalent] = useState(true);
  const [drillTense, setDrillTense] = useState<{
    mood: string;
    tense: string;
    label: string;
  }>(TENSES[0]);
  const [drillScope, setDrillScope] = useState<
    "selected" | "group" | "irregular" | "set"
  >("selected");
  const [audioFirst, setAudioFirst] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<number | "">("");
  const [newSetName, setNewSetName] = useState("");

  const tenses = language === "es" ? ES_TENSES : TENSES;

  const verbs = useQuery({
    queryKey: ["language", "verbs", language],
    queryFn: () => listVerbs(language),
  });
  const verbSets = useQuery({
    queryKey: ["language", "verb-sets", language],
    queryFn: () => listVerbSets(language),
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (verbs.data ?? []).filter((verb) => {
      if (needle && !verb.infinitive.toLowerCase().includes(needle))
        return false;
      if (group === "irregular" && !verb.is_irregular) return false;
      if (group !== "all" && group !== "irregular" && verb.group !== group)
        return false;
      return true;
    });
  }, [group, query, verbs.data]);

  const selectedVerb =
    (verbs.data ?? []).find((verb) => verb.id === selectedVerbId) ??
    filtered[0];

  const detail = useQuery({
    queryKey: ["language", "verb", selectedVerb?.id],
    queryFn: () => getVerb(selectedVerb?.id as number),
    enabled: selectedVerb != null,
  });

  const drillMutation = useMutation({
    mutationFn: () => {
      if (!selectedVerb) throw new Error("No verb selected");
      const body: DrillIn = {
        mood: drillTense.mood,
        tense: drillTense.tense,
        audio_first: audioFirst,
        language,
      };
      if (drillScope === "selected") body.verb_ids = [selectedVerb.id];
      if (drillScope === "group") body.group = selectedVerb.group;
      if (drillScope === "irregular") body.irregular_only = true;
      if (drillScope === "set" && selectedSetId) body.set_id = selectedSetId;
      return createDrills(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["language", "decks"] });
      if (drillScope === "set" && selectedSetId) {
        onStudyVerbSet(selectedSetId, language);
      } else {
        onDrillsCreated();
      }
    },
  });

  const createSetMutation = useMutation({
    mutationFn: () =>
      createVerbSet({ language, name: newSetName.trim() }),
    onSuccess: (created) => {
      setNewSetName("");
      setSelectedSetId(created.id);
      queryClient.invalidateQueries({ queryKey: ["language", "verb-sets"] });
    },
  });

  const membershipMutation = useMutation({
    mutationFn: async ({ set, add }: { set: VerbSet; add: boolean }) => {
      if (!selectedVerb) throw new Error("No verb selected");
      if (add) {
        await addVerbToSet(set.id, selectedVerb.id);
      } else {
        await removeVerbFromSet(set.id, selectedVerb.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["language", "verbs"] });
      queryClient.invalidateQueries({ queryKey: ["language", "verb-sets"] });
    },
  });

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <aside className="flex w-full flex-col gap-2 lg:w-56 lg:shrink-0">
        <select
          aria-label="Conjugation language"
          className="xp-select"
          value={language}
          onChange={(event) => {
            const next = event.target.value as LanguageCode;
            setLanguage(next);
            setDrillTense(next === "es" ? ES_TENSES[0] : TENSES[0]);
            setSelectedVerbId(null);
            setSelectedSetId("");
          }}
        >
          <option value="fr">French</option>
          <option value="es">Spanish</option>
        </select>
        <div className="flex gap-2">
          <input
            aria-label="Search verbs"
            className="xp-input"
            placeholder="Find verb…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            aria-label="Group"
            className="xp-select"
            value={group}
            onChange={(event) => setGroup(event.target.value)}
          >
            <option value="all">All</option>
            {language === "fr" ? (
              <>
                <option value="-er">-er</option>
                <option value="-ir">-ir</option>
                <option value="-re">-re</option>
              </>
            ) : (
              <>
                <option value="-ar">-ar</option>
                <option value="-er">-er</option>
                <option value="-ir">-ir</option>
              </>
            )}
            <option value="irregular">Irreg.</option>
          </select>
        </div>

        <div className="xp-well max-h-[320px] overflow-y-auto">
          {filtered.map((verb) => (
            <button
              key={verb.id}
              type="button"
              className={`xp-tree-item ${
                selectedVerb?.id === verb.id ? "is-active" : ""
              }`}
              onClick={() => setSelectedVerbId(verb.id)}
            >
              <span>
                <b>{verb.infinitive}</b>{" "}
                <span
                  className={selectedVerb?.id === verb.id ? "" : "xp-muted"}
                >
                  {verb.translation}
                </span>
              </span>
            </button>
          ))}
        </div>

        {!readOnly && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (selectedVerb) drillMutation.mutate();
          }}
        >
          <fieldset className="xp-group flex flex-col gap-2">
            <legend>Generate drills</legend>
            <div>
              <label className="xp-label" htmlFor="drill-tense">
                Tense:
              </label>
              <select
                id="drill-tense"
                className="xp-select w-full"
                value={`${drillTense.mood}|${drillTense.tense}`}
                onChange={(event) => {
                  const [mood, tense] = event.target.value.split("|");
                  const next = tenses.find(
                    (t) => t.mood === mood && t.tense === tense,
                  );
                  if (next) setDrillTense(next);
                }}
              >
                {tenses.map((tense) => (
                  <option
                    key={`${tense.mood}-${tense.tense}`}
                    value={`${tense.mood}|${tense.tense}`}
                  >
                    {tense.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="xp-label" htmlFor="drill-scope">
                Scope:
              </label>
              <select
                id="drill-scope"
                className="xp-select w-full"
                value={drillScope}
                onChange={(event) =>
                  setDrillScope(
                    event.target.value as
                      | "selected"
                      | "group"
                      | "irregular"
                      | "set",
                  )
                }
              >
                <option value="selected">Selected verb</option>
                <option value="group">Selected verb&apos;s group</option>
                <option value="irregular">All irregulars</option>
                <option value="set">Verb set</option>
              </select>
            </div>
            {drillScope === "set" && (
              <select
                aria-label="Verb set"
                className="xp-select w-full"
                value={selectedSetId}
                onChange={(event) =>
                  setSelectedSetId(
                    event.target.value ? Number(event.target.value) : "",
                  )
                }
              >
                <option value="">Choose set…</option>
                {(verbSets.data ?? []).map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.name} ({set.verb_count})
                  </option>
                ))}
              </select>
            )}
            <label
              className="flex items-center gap-2"
              style={{ fontSize: "11px" }}
            >
              <input
                type="checkbox"
                className="xp-checkbox"
                checked={audioFirst}
                onChange={(event) => setAudioFirst(event.target.checked)}
              />
              Audio-first cards
            </label>
            <div className="flex justify-end">
              <button
                className="xp-btn"
                disabled={
                  !selectedVerb ||
                  drillMutation.isPending ||
                  (drillScope === "set" && !selectedSetId)
                }
              >
                Generate
              </button>
            </div>
          </fieldset>
        </form>
        )}

        {!readOnly && (
        <fieldset className="xp-group flex flex-col gap-2">
          <legend>Verb sets</legend>
          {selectedVerb &&
            (verbSets.data ?? []).map((set) => (
              <label key={set.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="xp-checkbox"
                  checked={selectedVerb.set_ids.includes(set.id)}
                  disabled={membershipMutation.isPending}
                  onChange={(event) =>
                    membershipMutation.mutate({
                      set,
                      add: event.target.checked,
                    })
                  }
                />
                {set.name}
              </label>
            ))}
          <div className="flex gap-1">
            <input
              aria-label="New verb set name"
              className="xp-input min-w-0 flex-1"
              placeholder="New set…"
              value={newSetName}
              onChange={(event) => setNewSetName(event.target.value)}
            />
            <button
              type="button"
              className="xp-btn is-small"
              disabled={!newSetName.trim() || createSetMutation.isPending}
              onClick={() => createSetMutation.mutate()}
            >
              Add
            </button>
          </div>
        </fieldset>
        )}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          {selectedVerb && (
            <span>
              <b style={{ fontSize: "14px" }}>{selectedVerb.infinitive}</b>{" "}
              <Speak language={language} text={selectedVerb.infinitive} label="►" />{" "}
              <span className="xp-muted">
                {selectedVerb.translation}
                {selectedVerb.equivalent_infinitive
                  ? ` · ${selectedVerb.equivalent_language.toUpperCase()} ${selectedVerb.equivalent_infinitive}`
                  : ""}
              </span>
            </span>
          )}
          <label
            className="ml-auto flex items-center gap-2"
            style={{ fontSize: "11px" }}
          >
            <input
              type="checkbox"
              className="xp-checkbox"
            checked={showEquivalent}
            onChange={(event) => setShowEquivalent(event.target.checked)}
            />
            Show equivalent forms
          </label>
        </div>

        {detail.isLoading && <p className="xp-muted">Loading conjugations…</p>}
        {detail.data && (
          <ConjugationTable
            verb={detail.data}
            showEquivalent={showEquivalent}
            readOnly={readOnly}
          />
        )}
        {verbs.data?.length === 0 && (
          <p className="xp-muted">
            Run <code>python scripts/seed_verbs.py</code> from{" "}
            <code>/backend</code> after installing{" "}
            <code>requirements-seed.txt</code>.
          </p>
        )}
      </main>
    </div>
  );
}
