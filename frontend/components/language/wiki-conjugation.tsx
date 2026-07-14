"use client";

// Conjugation center tab: saved-verb browser, full conjugation tables,
// drill generation, and verb-set management.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addVerbToSet,
  createDrills,
  createVerbSet,
  getConjugationAudio,
  getVerb,
  listVerbSets,
  listVerbs,
  removeVerbFromSet,
  type Conjugation as ConjugationRow,
  type DrillIn,
  type LanguageCode,
  type VerbDetail,
  type VerbSet,
} from "@/lib/api/language";
import {
  conjugationSoundKey,
  displayConjugation,
} from "@/lib/conjugation";
import {
  playAudio,
  Speak,
  speakText,
  spokenConjugation,
} from "./language-shared";
import {
  ES_TENSES,
  TENSES,
  localizedMood,
  personSlotLabel,
} from "./wiki-tenses";

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

export function Conjugation({
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
