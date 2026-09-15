"use client";

// Sprint dashboard - a control panel: sprint switcher, progress meters,
// "do now" session builder, activity bank, targets, mastery test, quick
// actions, resources. Numbers over prose.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  buildSession,
  getDashboard,
  setActiveSprint,
  syncCurriculum,
  type Activity,
  type Dashboard,
  type PlanItem,
} from "@/lib/api/learning";
import type { PracticeConfig } from "./practice-view";

const DIM_LABELS: Record<string, string> = {
  vocabulary: "Vocab",
  verbs: "Verbs",
  pronunciation: "Pronunciation",
  grammar: "Grammar",
  listening: "Listening",
  speaking: "Speaking",
  reading: "Reading",
  writing: "Writing",
};
const DIM_ORDER = ["vocabulary", "verbs", "pronunciation", "grammar", "listening", "speaking", "reading", "writing"];
const TIME_BUCKETS: [string, number, number][] = [
  ["5 min", 0, 5],
  ["15 min", 6, 15],
  ["30 min", 16, 30],
  ["Deep", 31, 999],
];
const SKILLS = ["all", "vocabulary", "verbs", "pronunciation", "grammar", "listening", "reading", "speaking"];

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function barClass(v: number): string {
  if (v >= 0.8) return "is-strong";
  if (v < 0.5) return "is-weak";
  return "";
}

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function DashboardView({
  onPractice,
  onSession,
  onStudy,
  onTest,
  onOpenRef,
  onVocab,
  onTexts,
  onDecks,
  onConjugations,
  onPronunciation,
}: {
  onPractice: (cfg: PracticeConfig) => void;
  onSession: (sessionId: number) => void;
  onStudy: () => void;
  onTest: (sprint: number) => void;
  onOpenRef: (ref: string) => void;
  onVocab: () => void;
  onTexts: () => void;
  onDecks: () => void;
  onConjugations: () => void;
  onPronunciation: () => void;
}) {
  const queryClient = useQueryClient();
  const [viewSprint, setViewSprint] = useState<number | undefined>(undefined);
  const [time, setTime] = useState(1);
  const [skill, setSkill] = useState("all");
  const [duration, setDuration] = useState(15);
  const [useLlm, setUseLlm] = useState(true);

  const dash = useQuery({
    queryKey: ["language", "dashboard", viewSprint ?? "active"],
    queryFn: () => getDashboard(viewSprint),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["language", "dashboard"] });
  const activate = useMutation({ mutationFn: setActiveSprint, onSuccess: invalidate });
  const sync = useMutation({ mutationFn: syncCurriculum, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["language"] }) });
  const session = useMutation({
    mutationFn: () => buildSession({ minutes: duration, use_llm: useLlm, sprint: d?.sprint.number }),
    onSuccess: (s) => onSession(s.id),
  });

  const d: Dashboard | undefined = dash.data;
  const sprint = d?.sprint;
  const progress = d?.progress;

  if (dash.isLoading || !d || !sprint || !progress) {
    return <p className="xp-muted p-3">{dash.isError ? "Dashboard unavailable." : "Loading…"}</p>;
  }

  const [, lo, hi] = TIME_BUCKETS[time];
  const activities: Activity[] = sprint.activities.filter(
    (a) => a.kind !== "test" && a.minutes >= lo && a.minutes <= hi && (skill === "all" || a.skill === skill),
  );

  const isActive = d.state.active_sprint === sprint.number;
  const runActivity = (a: Activity | PlanItem) => {
    const id = "activity_id" in a ? a.activity_id : a.id;
    const kind = a.kind;
    if (kind === "srs") return onStudy();
    if (kind === "text") return onTexts();
    if (kind === "test") return onTest(sprint.number);
    if (kind === "external") {
      const res = sprint.resources.find((r) => r.id === a.resource);
      if (res) window.open(res.url, "_blank", "noopener");
      return;
    }
    onPractice({ activityId: id, sprint: sprint.number, title: a.name });
  };

  return (
    <div className="flex flex-col gap-2">
      {/* sprint switcher */}
      <div className="hub-sprints">
        {d.sprints.map((s) => (
          <button
            key={s.number}
            type="button"
            className={`hub-sprint-tab ${s.number === sprint.number ? "is-active" : ""} ${s.number === d.state.active_sprint ? "is-current" : ""}`}
            onClick={() => setViewSprint(s.number)}
          >
            <span>Sprint {s.number}</span>
            <small>{s.title}</small>
          </button>
        ))}
      </div>
      <div className="hub-header">
        <h2>
          Sprint {sprint.number} · {sprint.title}
        </h2>
        <span className="xp-muted">{sprint.mission}</span>
        <span className="ml-auto flex items-center gap-2">
          {!isActive ? (
            <button type="button" className="xp-btn is-small" disabled={activate.isPending} onClick={() => activate.mutate(sprint.number)}>
              Make active
            </button>
          ) : (
            <span className="xp-muted">active</span>
          )}
          <button type="button" className="xp-btn is-small" disabled={sprint.number <= 1} onClick={() => setViewSprint(sprint.number - 1)}>
            ‹
          </button>
          <button type="button" className="xp-btn is-small" disabled={sprint.number >= 4} onClick={() => setViewSprint(sprint.number + 1)}>
            ›
          </button>
        </span>
      </div>

      <div className="hub-grid">
        {/* ---------------- left column ---------------- */}
        <div className="hub-col">
          <div className="hub-row">
            <fieldset className="xp-group">
              <legend>Progress</legend>
              {DIM_ORDER.filter((k) => (progress.weights[k] ?? 0) > 0 || (progress.dims[k] ?? 0) > 0).map((k) => {
                const v = progress.dims[k] ?? 0;
                const target = progress.targets.find((t) => t.dimension === k);
                return (
                  <div key={k} className="hub-meter">
                    <span>{DIM_LABELS[k]}</span>
                    <div className={`hub-bar ${barClass(v)}`}>
                      <i style={{ width: `${Math.round(v * 100)}%` }} />
                    </div>
                    <span className="hub-count xp-muted">{target ? `${target.done} / ${target.total}` : ""}</span>
                    <span className="hub-count">{pct(v)}</span>
                  </div>
                );
              })}
              {d.carryover.length > 0 && (
                <div className="mt-2 xp-muted" style={{ fontSize: 11 }}>
                  carry-over: {d.carryover.map((c) => `${DIM_LABELS[c.dimension] ?? c.dimension} (S${c.sprint})`).join(" · ")}
                </div>
              )}
            </fieldset>

            <fieldset className="xp-group">
              <legend>Sprint targets</legend>
              {progress.targets.map((t) => {
                const met = t.total > 0 && t.done >= t.total;
                return (
                  <div key={t.id} className="hub-meter" style={{ gridTemplateColumns: "14px minmax(0,1fr) auto" }}>
                    <span>{met ? "●" : "○"}</span>
                    <span>
                      {t.label}
                      {t.detail ? <span className="xp-muted"> · {t.detail}</span> : null}
                    </span>
                    <span className="hub-count">
                      {t.done} / {t.total}
                    </span>
                  </div>
                );
              })}
              <div className="mt-2 flex flex-wrap gap-1">
                {progress.pronunciation.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`hub-chip ${p.met ? "is-active" : ""}`}
                    title={`${p.attempts} attempts · ${pct(p.accuracy)}`}
                    onClick={() => {
                      const a = sprint.activities.find((x) => x.params.target === p.id);
                      if (a) runActivity(a);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {progress.grammar.map((g) => (
                  <button key={g.id} type="button" className={`hub-chip ${g.met ? "is-active" : ""}`} title={`${g.attempts} · ${pct(g.accuracy)}`} onClick={() => g.ref && onOpenRef(g.ref)}>
                    {g.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="hub-row">
            <fieldset className="xp-group">
              <legend>Do now</legend>
              <div className="flex flex-wrap items-center gap-2">
                <div className="hub-durations">
                  {[5, 15, 30, 60].map((m) => (
                    <button key={m} type="button" className={`xp-btn ${duration === m ? "is-on" : ""}`} onClick={() => setDuration(m)}>
                      {m === 60 ? "Deep" : `${m} min`}
                    </button>
                  ))}
                </div>
                <button type="button" className="xp-btn is-default" disabled={session.isPending} onClick={() => session.mutate()}>
                  {session.isPending ? "Building…" : "Build session"}
                </button>
                <label className="flex items-center gap-1 xp-muted" style={{ fontSize: 11 }}>
                  <input type="checkbox" className="xp-checkbox" checked={useLlm} disabled={!d.llm.available} onChange={(e) => setUseLlm(e.target.checked)} />
                  ✦ compose
                </label>
              </div>
              <div className="mt-2">
                {d.suggestion.map((p) => (
                  <div key={p.activity_id} className="hub-act is-clickable" style={{ cursor: "pointer" }} onClick={() => runActivity(p)}>
                    <span className="hub-act-name">
                      <span className="hub-skill mr-2">{p.skill.slice(0, 5)}</span>
                      {p.name}
                    </span>
                    <span className="hub-act-target">{p.why}</span>
                    <span className="hub-minutes">{p.minutes}m</span>
                    <button type="button" className="xp-btn is-small">
                      Start
                    </button>
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset className="xp-group">
              <legend>Recent</legend>
              {d.recent.length === 0 && <p className="xp-muted">Nothing yet.</p>}
              {d.recent.map((r, i) => (
                <div key={`${r.activity_id}-${i}`} className="hub-act">
                  <span className="hub-act-name">
                    {r.score >= 0.6 ? "✓" : "✗"} {r.name}
                  </span>
                  <span className="hub-act-target">{r.summary}</span>
                  <span className="hub-minutes">{pct(r.score)}</span>
                  <span className="hub-minutes">{ago(r.occurred_at)}</span>
                </div>
              ))}
            </fieldset>
          </div>

          <fieldset className="xp-group">
            <legend>Activity bank</legend>
            <div className="hub-filters">
              {TIME_BUCKETS.map(([label], i) => (
                <button key={label} type="button" className={`hub-chip ${time === i ? "is-active" : ""}`} onClick={() => setTime(i)}>
                  {label}
                </button>
              ))}
              <span style={{ width: 8 }} />
              {SKILLS.map((s) => (
                <button key={s} type="button" className={`hub-chip ${skill === s ? "is-active" : ""}`} onClick={() => setSkill(s)}>
                  {s === "all" ? "All" : DIM_LABELS[s] ?? s}
                </button>
              ))}
              <span className="ml-auto xp-muted">{activities.length}</span>
            </div>
            {activities.map((a) => (
              <div key={a.id} className="hub-act" style={{ cursor: "pointer" }} onClick={() => runActivity(a)}>
                <span className="hub-act-name">
                  <span className="hub-skill mr-2">{a.skill.slice(0, 5)}</span>
                  {a.name}
                  {a.kind === "llm" && <span className="xp-muted"> ✦</span>}
                  {a.kind === "external" && <span className="xp-muted"> ↗</span>}
                </span>
                <span className="hub-act-target">{a.target}</span>
                <span className="hub-minutes">{a.minutes}m</span>
                <button type="button" className="xp-btn is-small">
                  {a.kind === "external" ? "Open" : "Start"}
                </button>
              </div>
            ))}
            {activities.length === 0 && <p className="xp-muted">No activity in this bucket.</p>}
          </fieldset>
        </div>

        {/* ---------------- right column ---------------- */}
        <div className="hub-col">
          <fieldset className="xp-group">
            <legend>Mastery test</legend>
            <div className="flex items-center gap-3">
              <div className="hub-ring" style={{ ["--p" as string]: Math.round(progress.readiness * 100) }}>
                <span>{pct(progress.readiness)}</span>
              </div>
              <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                {sprint.criteria.map((c) => (
                  <div key={c.dimension}>
                    <span className={`hub-bar is-mini ${barClass(progress.dims[c.dimension] ?? 0)}`}>
                      <i style={{ width: `${Math.round((progress.dims[c.dimension] ?? 0) * 100)}%` }} />
                    </span>{" "}
                    {c.label}
                  </div>
                ))}
              </div>
            </div>
            {d.last_test && (
              <div className="mt-2 xp-muted" style={{ fontSize: 11 }}>
                last: {pct(d.last_test.readiness)} · {d.last_test.passed ? "pass" : "not yet"} · {ago(d.last_test.completed_at ?? d.last_test.started_at)} ago
                {d.last_test.weak.length > 0 && <> · weak: {(d.last_test.weak as string[]).map((w) => DIM_LABELS[w] ?? w).join(", ")}</>}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <button type="button" className="xp-btn is-default" onClick={() => onTest(sprint.number)}>
                ▶ Start test
              </button>
              <span className="xp-muted" style={{ fontSize: 11 }}>
                {d.tests_count} attempt{d.tests_count === 1 ? "" : "s"}
              </span>
            </div>
          </fieldset>

          <fieldset className="xp-group">
            <legend>Quick actions</legend>
            <div className="hub-quick">
              <button type="button" className="xp-btn" onClick={onStudy}>
                Review due <span className="xp-muted">{d.cards.due}</span>
              </button>
              <button type="button" className="xp-btn" onClick={() => onPractice({ format: undefined })}>
                Generate drill
              </button>
              <button type="button" className="xp-btn" onClick={() => session.mutate()}>
                Build session
              </button>
              <button type="button" className="xp-btn" onClick={onTexts}>
                Open text
              </button>
              <button type="button" className="xp-btn" onClick={onVocab}>
                Vocabulary
              </button>
              <button type="button" className="xp-btn" onClick={onDecks}>
                Add cards
              </button>
              <button type="button" className="xp-btn" onClick={() => onOpenRef("core-verbs")}>
                Core verbs
              </button>
              <button type="button" className="xp-btn" onClick={onPronunciation}>
                Pronunciation
              </button>
              <button type="button" className="xp-btn" onClick={() => onOpenRef("pronunciation")}>
                References
              </button>
              <button type="button" className="xp-btn" onClick={() => onOpenRef("interference")}>
                Interference <span className="xp-muted">{d.interference_due}</span>
              </button>
              <button type="button" className="xp-btn" onClick={onConjugations}>
                Conjugations
              </button>
              <button type="button" className="xp-btn" disabled={sync.isPending} onClick={() => sync.mutate()}>
                {sync.isPending ? "Syncing…" : "Sync curriculum"}
              </button>
            </div>
          </fieldset>

          <fieldset className="xp-group">
            <legend>Verbs</legend>
            <div className="flex flex-wrap gap-1">
              {progress.verbs.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`hub-chip ${v.met ? "is-active" : ""}`}
                  title={`${v.attempts} · ${pct(v.accuracy)}`}
                  onClick={() => onPractice({ format: "verb_drill", sprint: sprint.number, count: 10, targets: [v.id], title: `Verb drill · ${v.id}`, source: "deterministic" })}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="xp-group">
            <legend>Resources</legend>
            {sprint.resources.map((r) => (
              <div key={r.id} className="hub-act" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <span>
                  <a className="xp-link" href={r.url} target="_blank" rel="noreferrer">
                    {r.name}
                  </a>
                  {r.section && <span className="xp-muted"> · {r.section}</span>}
                </span>
                <span className="hub-minutes">{r.minutes}m</span>
              </div>
            ))}
          </fieldset>

          <fieldset className="xp-group">
            <legend>Output checks</legend>
            {sprint.output_targets.map((t) => (
              <div key={t} style={{ fontSize: 12 }}>
                ○ {t}
              </div>
            ))}
            {!d.llm.available && (
              <p className="xp-muted mt-2" style={{ fontSize: 11 }}>
                AI offline - deterministic drills only.
              </p>
            )}
          </fieldset>
        </div>
      </div>
    </div>
  );
}
