"use client";

// Practice: run one activity (deterministic or AI), a whole composed session,
// or pick a format by hand ("Generate drill"). Results go through the shared
// mastery pipeline; a completion row is written per finished activity.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  buildExercises,
  getSession,
  submitResults,
  type Activity,
  type Exercise,
  type ExerciseSet,
  type ExercisesIn,
  type PlanItem,
  type Resource,
} from "@/lib/api/learning";
import { type Deck } from "@/lib/api/language";
import { ExerciseRunner, RunnerSummaryView, toResult, type RunnerSummary } from "./exercise-runner";
import { StudyView } from "./study-view";

export type PracticeConfig = {
  activityId?: string;
  format?: string;
  params?: Record<string, unknown>;
  targets?: string[];
  source?: "auto" | "deterministic" | "llm";
  sprint?: number;
  count?: number;
  sessionId?: number;
  title?: string;
  fresh?: boolean;
};

const FORMATS: { id: string; label: string; llm?: boolean; needsTarget?: string }[] = [
  { id: "sentence_transform", label: "Sentence transformations", llm: true },
  { id: "translation_ladder", label: "Translation ladder", llm: true },
  { id: "es_to_fr", label: "Spanish → French", llm: true },
  { id: "fr_to_es", label: "French → Spanish" },
  { id: "audio_recognition", label: "Audio recognition" },
  { id: "audio_comprehension", label: "Audio comprehension" },
  { id: "cloze", label: "Cloze", llm: true },
  { id: "context_choice", label: "Vocabulary in context (AI)", llm: true },
  { id: "verb_drill", label: "Verb drill" },
  { id: "dictation", label: "Dictation" },
  { id: "pronunciation_ab", label: "Sound discrimination", needsTarget: "pron" },
  { id: "grapheme", label: "Spelling → sound", needsTarget: "pron" },
  { id: "error_repair", label: "Interference repair", llm: true },
  { id: "micro_dialogue", label: "Micro-dialogue", llm: true },
  { id: "timed_fluency", label: "Spoken questions" },
  { id: "reading", label: "Short reading", llm: true },
  { id: "cognate_mining", label: "Cognate mining", llm: true },
];

const PRON_TARGETS = [
  ["y_vs_u", "/y/ vs /u/"], ["i_vs_y", "/i/ vs /y/"], ["nasals", "nasals"], ["sh_zh", "/ʃ/ vs /ʒ/"], ["s_vs_z", "/s/ vs /z/"],
  ["grapheme_decoding", "spelling → sound"], ["silent_finals", "silent finals"], ["final_ent", "verb -ent"], ["liaison_intro", "ils ont / sont"],
  ["e_vs_eh", "/e/ vs /ɛ/"], ["oe_vs_o", "/ø/ vs /o/"], ["liaison_recognition", "liaison"], ["spoken_reductions", "spoken French"],
  ["r_production", "French R"], ["rhythm_reading", "read aloud"], ["enchainement_schwa", "linking & schwa"], ["shadowing", "shadowing"],
];

function activityLabel(a: Activity | PlanItem | null | undefined, fallback: string): string {
  return a?.name ?? fallback;
}

export function PracticeView({
  config,
  decks,
  activeSprint,
  resources,
  onExit,
  onOpenRef,
  onOpenTexts,
  onStartTest,
}: {
  config: PracticeConfig | null;
  decks: Deck[];
  activeSprint: number;
  resources: Resource[];
  onExit: () => void;
  onOpenRef: (ref: string) => void;
  onOpenTexts: () => void;
  onStartTest: (sprint: number) => void;
}) {
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState<PracticeConfig | null>(config);
  const [set, setSet] = useState<ExerciseSet | null>(null);
  const [summary, setSummary] = useState<RunnerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planIndex, setPlanIndex] = useState<number | null>(null);

  const sessionId = current?.sessionId ?? config?.sessionId;
  const session = useQuery({
    queryKey: ["language", "session", sessionId],
    queryFn: () => getSession(sessionId as number),
    enabled: sessionId != null,
  });

  const load = useMutation({
    mutationFn: (body: ExercisesIn) => buildExercises(body),
    onSuccess: (data) => {
      setSet(data);
      setSummary(null);
      setError(data.exercises.length ? null : "Nothing generated" + (data.rejected.length ? ` - ${data.rejected.slice(0, 2).join("; ")}` : ""));
    },
    onError: (e: Error) => setError(e.message),
  });

  const start = useCallback(
    (cfg: PracticeConfig) => {
      setCurrent(cfg);
      setSummary(null);
      setSet(null);
      setError(null);
      load.mutate({
        activity_id: cfg.activityId,
        format: cfg.format,
        params: cfg.params,
        targets: cfg.targets,
        source: cfg.source ?? "auto",
        sprint: cfg.sprint ?? activeSprint,
        count: cfg.count,
        fresh: cfg.fresh,
      });
    },
    [load, activeSprint],
  );

  // auto-start a direct activity config (not a session, not the picker)
  useEffect(() => {
    if (config && !config.sessionId && (config.activityId || config.format)) {
      load.mutate({
        activity_id: config.activityId,
        format: config.format,
        params: config.params,
        targets: config.targets,
        source: config.source ?? "auto",
        sprint: config.sprint ?? activeSprint,
        count: config.count,
        fresh: config.fresh,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const submit = useMutation({
    mutationFn: submitResults,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["language", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["language", "session"] });
      queryClient.invalidateQueries({ queryKey: ["language", "vocab"] });
      queryClient.invalidateQueries({ queryKey: ["language", "interference"] });
    },
  });

  const sprint = set?.sprint ?? current?.sprint ?? activeSprint;
  const activity = set?.activity ?? null;
  const activityId = current?.activityId ?? current?.format ?? "manual";

  const finishRunner = useCallback(
    (s: RunnerSummary) => {
      setSummary(s);
      const results = s.items.map((it) => toResult(it, sprint, activityId));
      submit.mutate({
        results,
        session_id: sessionId ?? null,
        completion: {
          activity_id: activityId,
          name: activityLabel(activity, current?.title ?? FORMATS.find((f) => f.id === current?.format)?.label ?? activityId),
          skill: activity?.skill ?? s.items[0]?.exercise.skill ?? "grammar",
          sprint,
          score: s.score,
          summary: `${s.correct}/${s.total}`,
          minutes: Math.max(1, Math.round(s.seconds / 60)),
        },
      });
    },
    [sprint, activityId, activity, current, sessionId, submit],
  );

  const completeNonDrill = useCallback(
    (item: PlanItem, score: number) => {
      submit.mutate({
        results: [],
        session_id: sessionId ?? null,
        completion: { activity_id: item.activity_id, name: item.name, skill: item.skill, sprint, score, summary: "done", minutes: item.minutes },
      });
      setPlanIndex(null);
    },
    [submit, sessionId, sprint],
  );

  // ---- session mode --------------------------------------------------------
  if (sessionId != null) {
    if (session.isLoading || !session.data) return <p className="xp-muted p-3">Loading session…</p>;
    const plan = session.data;
    const active = planIndex != null ? plan.plan[planIndex] : null;

    if (active && set && !summary) {
      return (
        <ExerciseRunner
          exercises={set.exercises}
          title={active.name}
          subtitle={`${active.minutes} min · ${set.source}${set.model ? ` · ${set.model}` : ""}`}
          onFinish={finishRunner}
          onExit={() => {
            setSet(null);
            setPlanIndex(null);
          }}
          onOpenRef={onOpenRef}
          autoAdvanceMs={set.exercises[0]?.meta?.timed ? 600 : 0}
        />
      );
    }
    if (active && summary) {
      return (
        <RunnerSummaryView
          summary={summary}
          title={active.name}
          backLabel="Back to session"
          onBack={() => {
            setSummary(null);
            setSet(null);
            setPlanIndex(null);
          }}
        />
      );
    }
    if (active && active.kind === "srs") {
      return (
        <div className="flex flex-col gap-2">
          <div className="pr-top">
            <b style={{ color: "var(--xp-text)" }}>Review due</b>
            <span>{active.minutes} min</span>
            <button type="button" className="xp-btn is-small" style={{ marginLeft: "auto" }} onClick={() => completeNonDrill(active, 1)}>
              Done
            </button>
            <button type="button" className="xp-link" onClick={() => setPlanIndex(null)}>
              [back]
            </button>
          </div>
          <StudyView decks={decks} initialLanguage="fr" />
        </div>
      );
    }
    if (active && (active.kind === "external" || active.kind === "text" || active.kind === "self" || active.kind === "test")) {
      const res = resources.find((r) => r.id === active.resource);
      return (
        <div className="pr-shell">
          <div className="pr-top">
            <b style={{ color: "var(--xp-text)" }}>{active.name}</b>
            <span>{active.minutes} min</span>
            <button type="button" className="xp-link" style={{ marginLeft: "auto" }} onClick={() => setPlanIndex(null)}>
              [back]
            </button>
          </div>
          <div className="pr-card">
            <div className="pr-instructions">{active.target}</div>
            {res && (
              <p>
                <a className="xp-link" href={res.url} target="_blank" rel="noreferrer">
                  {res.name} ↗
                </a>
                {res.section && <span className="xp-muted"> · {res.section}</span>}
                <br />
                <span className="xp-muted">{res.note}</span>
              </p>
            )}
            {active.kind === "text" && (
              <button type="button" className="xp-btn" onClick={onOpenTexts}>
                Open Texts
              </button>
            )}
            {active.kind === "test" && (
              <button type="button" className="xp-btn" onClick={() => onStartTest(sprint)}>
                Start mastery test
              </button>
            )}
            {active.kind === "self" && (
              <button type="button" className="xp-btn" onClick={() => start({ activityId: active.activity_id, sessionId, sprint })}>
                Open task
              </button>
            )}
            <div className="pr-actions">
              <span className="xp-muted">How did it go?</span>
              {["skipped", "hard", "ok", "good"].map((l, i) => (
                <button key={l} type="button" className={`xp-btn is-small ${i === 2 ? "is-default" : ""}`} onClick={() => completeNonDrill(active, [0, 0.4, 0.8, 1][i])}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }
    const doneIds = new Set(plan.completed);
    const total = plan.plan.reduce((a, b) => a + b.minutes, 0);
    return (
      <div className="flex flex-col gap-2">
        <div className="hub-header">
          <h2>Session · {plan.minutes} min</h2>
          <span className="xp-muted">
            {plan.source === "llm" ? "✦ composed" : "rules"} · {doneIds.size} / {plan.plan.length} done · {total} min planned
          </span>
          <button type="button" className="xp-link" style={{ marginLeft: "auto" }} onClick={onExit}>
            [dashboard]
          </button>
        </div>
        <table className="xp-listview">
          <thead>
            <tr>
              <th style={{ width: 24 }} />
              <th>Activity</th>
              <th>Why</th>
              <th style={{ width: 60 }}>min</th>
              <th style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {plan.plan.map((item, i) => {
              const isDone = doneIds.has(item.activity_id);
              return (
                <tr key={`${item.activity_id}-${i}`} className={isDone ? "" : "is-clickable"} onClick={() => !isDone && openPlanItem(i, item)}>
                  <td>{isDone ? "✓" : "○"}</td>
                  <td>
                    <span className="hub-skill mr-2">{item.skill.slice(0, 5)}</span>
                    {item.name}
                    {item.target && <span className="xp-muted"> · {item.target}</span>}
                  </td>
                  <td className="xp-muted">{item.why}</td>
                  <td className="hub-minutes">{item.minutes}</td>
                  <td>
                    {!isDone && (
                      <button type="button" className="xp-btn is-small" onClick={(e) => (e.stopPropagation(), openPlanItem(i, item))}>
                        Start
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {load.isPending && <p className="xp-muted">Building… ✦</p>}
        {error && <p className="xp-muted">{error}</p>}
        {plan.completed_at && <p>Session complete.</p>}
      </div>
    );
  }

  function openPlanItem(i: number, item: PlanItem) {
    setPlanIndex(i);
    setSummary(null);
    setSet(null);
    if (item.kind === "drill" || item.kind === "llm") {
      start({ activityId: item.activity_id, sessionId, sprint: sprint, title: item.name });
    }
  }

  // ---- single activity / manual --------------------------------------------
  if (set && !summary && set.exercises.length) {
    return (
      <ExerciseRunner
        exercises={set.exercises}
        title={activityLabel(activity, current?.title ?? FORMATS.find((f) => f.id === current?.format)?.label ?? "Practice")}
        subtitle={set.source}
        onFinish={finishRunner}
        onExit={() => {
          setSet(null);
          setCurrent(null);
        }}
        onOpenRef={onOpenRef}
        autoAdvanceMs={set.exercises[0]?.meta?.timed ? 600 : 0}
      />
    );
  }
  if (summary) {
    return (
      <RunnerSummaryView
        summary={summary}
        title={activityLabel(activity, current?.title ?? "Practice")}
        onAgain={() => current && start({ ...current, fresh: current.source === "llm" })}
        onBack={onExit}
      />
    );
  }
  if (load.isPending) {
    return (
      <div className="xp-well flex h-72 flex-col items-center justify-center gap-1">
        <span>Building…</span>
        {(current?.source === "llm" || (activity?.kind === "llm" && current?.source !== "deterministic")) && (
          <span className="xp-muted">✦ AI</span>
        )}
      </div>
    );
  }
  return <Picker activeSprint={activeSprint} onStart={start} error={error} lastConfig={current} />;
}

function Picker({
  activeSprint,
  onStart,
  error,
  lastConfig,
}: {
  activeSprint: number;
  onStart: (cfg: PracticeConfig) => void;
  error: string | null;
  lastConfig: PracticeConfig | null;
}) {
  const [format, setFormat] = useState(lastConfig?.format ?? "sentence_transform");
  const [count, setCount] = useState(lastConfig?.count ?? 10);
  const [source, setSource] = useState<"auto" | "deterministic" | "llm">(lastConfig?.source ?? "deterministic");
  const [sprint, setSprint] = useState(lastConfig?.sprint ?? activeSprint);
  const [targets, setTargets] = useState((lastConfig?.targets ?? []).join(", "));
  const [pron, setPron] = useState("y_vs_u");
  const [transformations, setTransformations] = useState<string[]>([]);
  const fmt = useMemo(() => FORMATS.find((f) => f.id === format), [format]);

  const allTransforms = ["person", "polarity", "question", "modality", "time", "tense_futur_proche", "tense_passe_compose", "object_pronoun", "translate"];

  return (
    <div className="flex flex-col gap-3" style={{ maxWidth: 640 }}>
      <div className="hub-header">
        <h2>Generate drill</h2>
        <span className="xp-muted">local · AI ✦</span>
      </div>
      <fieldset className="xp-group flex flex-col gap-2">
        <legend>Drill</legend>
        <div className="flex flex-wrap items-center gap-2">
          <label className="xp-label mb-0">Format</label>
          <select className="xp-select" value={format} onChange={(e) => setFormat(e.target.value)}>
            {FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
                {f.llm ? " ✦" : ""}
              </option>
            ))}
          </select>
          <label className="xp-label mb-0">Sprint</label>
          <select className="xp-select" value={sprint} onChange={(e) => setSprint(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <label className="xp-label mb-0">Items</label>
          <input className="xp-input" style={{ width: 56 }} type="number" min={1} max={40} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="xp-label mb-0">Source</label>
          {(["deterministic", "llm", "auto"] as const).map((s) => (
            <label key={s} className="flex items-center gap-1">
              <input type="radio" className="xp-checkbox" checked={source === s} disabled={s !== "deterministic" && !fmt?.llm} onChange={() => setSource(s)} />
              {s === "llm" ? "AI ✦" : s}
            </label>
          ))}
        </div>
        {fmt?.needsTarget === "pron" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="xp-label mb-0">Target</label>
            <select className="xp-select" value={pron} onChange={(e) => setPron(e.target.value)}>
              {PRON_TARGETS.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}
        {format === "sentence_transform" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="xp-label mb-0">Dimensions</label>
            {allTransforms.map((t) => (
              <button
                key={t}
                type="button"
                className={`hub-chip ${transformations.includes(t) ? "is-active" : ""}`}
                onClick={() => setTransformations((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}
              >
                {t.replace("tense_", "→ ").replace(/_/g, " ")}
              </button>
            ))}
          </div>
        )}
        {format === "verb_drill" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="xp-label mb-0">Verbs</label>
            <input className="xp-input" style={{ width: 280 }} placeholder="être, avoir, vouloir … (blank = sprint verbs)" value={targets} onChange={(e) => setTargets(e.target.value)} />
          </div>
        )}
        {fmt?.llm && source !== "deterministic" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="xp-label mb-0">Targets</label>
            <input className="xp-input" style={{ width: 280 }} placeholder="vouloir, futur proche, chez … (optional)" value={targets} onChange={(e) => setTargets(e.target.value)} />
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="xp-btn is-default"
            onClick={() =>
              onStart({
                format,
                sprint,
                count,
                source,
                targets: targets.split(",").map((t) => t.trim()).filter(Boolean),
                params: {
                  ...(fmt?.needsTarget === "pron" ? { target: pron } : {}),
                  ...(format === "sentence_transform" && transformations.length ? { transformations } : {}),
                  ...(format === "dictation" ? { level: Math.min(sprint, 4) } : {}),
                  ...(format === "verb_drill" && targets ? { verbs: targets.split(",").map((t) => t.trim()).filter(Boolean) } : {}),
                },
                fresh: source === "llm",
              })
            }
          >
            Start
          </button>
          {error && <span className="xp-muted">{error}</span>}
        </div>
      </fieldset>
    </div>
  );
}

export type { Exercise };
