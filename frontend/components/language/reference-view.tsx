"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createDrills,
  getConjugationAudio,
  getVerb,
  listCards,
  listVerbs,
  type Deck,
  type DrillIn,
  type VerbDetail,
} from "@/lib/api/language";
import { playAudio } from "./language-shared";

export type ReferenceTab = "pronunciation" | "conjugation";

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

const PERSON_LABELS: Record<string, string> = {
  "1s": "je",
  "2s": "tu",
  "3s": "il/elle",
  "1p": "nous",
  "2p": "vous",
  "3p": "ils/elles",
};

const PRONUNCIATION_RULES = [
  {
    title: "Nasal vowels",
    note: "French nasal vowels carry meaning where Spanish uses vowel + n/m. Keep the air through the nose, no final consonant.",
    examples: "vin /vɛ̃/ · vent /vɑ̃/ · bon /bɔ̃/",
  },
  {
    title: "French r",
    note: "A light uvular fricative. Don't roll it like Spanish r/rr.",
    examples: "rue /ʁy/ · parler /paʁle/",
  },
  {
    title: "U vs ou",
    note: "French u /y/ is not Spanish u. Say /i/, then round the lips without moving the tongue.",
    examples: "tu /ty/ · tout /tu/",
  },
  {
    title: "Final consonants",
    note: "Many final consonants are silent until liaison. Spelling is a hint, not a transcript.",
    examples: "grand /ɡʁɑ̃/ · grand ami /ɡʁɑ̃tami/",
  },
  {
    title: "é, è, e",
    note: "Keep /e/, /ɛ/, and /ə/ separate — they collapse meaning in common forms.",
    examples: "les /le/ · mais /mɛ/ · le /lə/",
  },
];

export function ReferenceView({
  decks,
  initialTab = "pronunciation",
  onTabChange,
  onStudyDeck,
  onDrillsCreated,
}: {
  decks: Deck[];
  initialTab?: ReferenceTab;
  onTabChange?: (tab: ReferenceTab) => void;
  onStudyDeck: (deckId: number) => void;
  onDrillsCreated: () => void;
}) {
  const [tab, setTab] = useState<ReferenceTab>(initialTab);

  const switchTab = (next: ReferenceTab) => {
    setTab(next);
    onTabChange?.(next);
  };

  return (
    <div>
      <div className="xp-tabs">
        {(["pronunciation", "conjugation"] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={`xp-tab ${tab === id ? "is-active" : ""}`}
            onClick={() => switchTab(id)}
          >
            {id === "pronunciation" ? "Pronunciation" : "Conjugation"}
          </button>
        ))}
      </div>
      <div className="xp-tab-panel">
        {tab === "pronunciation" ? (
          <Pronunciation decks={decks} onStudyDeck={onStudyDeck} />
        ) : (
          <Conjugation onDrillsCreated={onDrillsCreated} />
        )}
      </div>
    </div>
  );
}

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
      <div className="grid gap-2 md:grid-cols-2">
        {PRONUNCIATION_RULES.map((rule) => (
          <fieldset key={rule.title} className="xp-group">
            <legend>{rule.title}</legend>
            <p>{rule.note}</p>
            <p className="xp-ipa xp-muted mt-1">{rule.examples}</p>
          </fieldset>
        ))}
      </div>

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

      <div className="overflow-x-auto border" style={{ borderColor: "var(--xp-well-border)" }}>
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
                  {card.audio_url && (
                    <button
                      type="button"
                      className="xp-link"
                      onClick={() => playAudio(card.audio_url)}
                    >
                      [listen]
                    </button>
                  )}
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

function ConjugationTable({
  verb,
  showSpanish,
}: {
  verb: VerbDetail;
  showSpanish: boolean;
}) {
  const queryClient = useQueryClient();
  const audioMutation = useMutation({
    mutationFn: getConjugationAudio,
    onSuccess: (updated) => {
      queryClient.setQueryData<VerbDetail>(
        ["language", "verb", verb.id],
        (current) =>
          current
            ? {
                ...current,
                conjugations: current.conjugations.map((conj) =>
                  conj.id === updated.id
                    ? { ...conj, audio_url: updated.audio_url }
                    : conj,
                ),
              }
            : current,
      );
      playAudio(updated.audio_url);
    },
  });

  const formCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const conj of verb.conjugations) {
      counts.set(conj.form, (counts.get(conj.form) ?? 0) + 1);
    }
    return counts;
  }, [verb.conjugations]);

  return (
    <div className="flex flex-col gap-3">
      {TENSES.map(({ mood, tense, label }) => {
        const rows = verb.conjugations.filter(
          (conj) => conj.mood === mood && conj.tense === tense,
        );
        if (!rows.length) return null;
        return (
          <fieldset key={`${mood}-${tense}`} className="xp-group">
            <legend>
              {label} <span className="xp-muted">({mood})</span>
            </legend>
            <div className="overflow-x-auto">
              <table className="xp-listview" style={{ background: "transparent" }}>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>French</th>
                    {showSpanish && <th>Spanish</th>}
                    <th style={{ width: 1 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((conj) => (
                    <tr key={conj.id}>
                      <td className="xp-muted">
                        {PERSON_LABELS[conj.person] ?? conj.person}
                      </td>
                      <td>
                        <b>{conj.form}</b>
                        {(formCounts.get(conj.form) ?? 0) > 1 && (
                          <span className="xp-muted"> (homophone)</span>
                        )}
                      </td>
                      {showSpanish && <td>{conj.es_form || "—"}</td>}
                      <td>
                        <button
                          type="button"
                          className="xp-link"
                          onClick={() =>
                            conj.audio_url
                              ? playAudio(conj.audio_url)
                              : audioMutation.mutate(conj.id)
                          }
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
      })}
    </div>
  );
}

function Conjugation({ onDrillsCreated }: { onDrillsCreated: () => void }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [selectedVerbId, setSelectedVerbId] = useState<number | null>(null);
  const [showSpanish, setShowSpanish] = useState(true);
  const [drillTense, setDrillTense] = useState<(typeof TENSES)[number]>(TENSES[0]);
  const [drillScope, setDrillScope] = useState<
    "selected" | "group" | "irregular"
  >("selected");
  const [audioFirst, setAudioFirst] = useState(false);

  const verbs = useQuery({ queryKey: ["language", "verbs"], queryFn: listVerbs });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (verbs.data ?? []).filter((verb) => {
      if (needle && !verb.infinitive.toLowerCase().includes(needle)) return false;
      if (group === "irregular" && !verb.is_irregular) return false;
      if (group !== "all" && group !== "irregular" && verb.group !== group)
        return false;
      return true;
    });
  }, [group, query, verbs.data]);

  const selectedVerb =
    filtered.find((verb) => verb.id === selectedVerbId) ?? filtered[0];

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
      };
      if (drillScope === "selected") body.verb_ids = [selectedVerb.id];
      if (drillScope === "group") body.group = selectedVerb.group;
      if (drillScope === "irregular") body.irregular_only = true;
      return createDrills(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["language", "decks"] });
      onDrillsCreated();
    },
  });

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <aside className="flex w-full flex-col gap-2 lg:w-56 lg:shrink-0">
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
            <option value="-er">-er</option>
            <option value="-ir">-ir</option>
            <option value="-re">-re</option>
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
                  const next = TENSES.find(
                    (t) => t.mood === mood && t.tense === tense,
                  );
                  if (next) setDrillTense(next);
                }}
              >
                {TENSES.map((tense) => (
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
                    event.target.value as "selected" | "group" | "irregular",
                  )
                }
              >
                <option value="selected">Selected verb</option>
                <option value="group">Selected verb&apos;s group</option>
                <option value="irregular">All irregulars</option>
              </select>
            </div>
            <label className="flex items-center gap-2" style={{ fontSize: "11px" }}>
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
                disabled={!selectedVerb || drillMutation.isPending}
              >
                Generate
              </button>
            </div>
          </fieldset>
        </form>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          {selectedVerb && (
            <span>
              <b style={{ fontSize: "14px" }}>{selectedVerb.infinitive}</b>{" "}
              <span className="xp-muted">
                {selectedVerb.translation} · ES {selectedVerb.es_equivalent}
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
              checked={showSpanish}
              onChange={(event) => setShowSpanish(event.target.checked)}
            />
            Show Spanish forms
          </label>
        </div>

        {detail.isLoading && <p className="xp-muted">Loading conjugations…</p>}
        {detail.data && (
          <ConjugationTable verb={detail.data} showSpanish={showSpanish} />
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
