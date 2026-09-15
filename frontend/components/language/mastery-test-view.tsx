"use client";

// Sprint mastery test: sections run back-to-back through the shared runner;
// one submission scores a profile (strong / adequate / weak per dimension).
// Advancing is always allowed - weak dimensions carry forward.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getDashboard, listTests, setActiveSprint, startTest, submitTest, type MasteryTest, type ResultIn } from "@/lib/api/learning";
import { ExerciseRunner, toResult, type RunnerSummary } from "./exercise-runner";

const LABELS: Record<string, string> = {
  vocabulary: "Vocab", verbs: "Verbs", pronunciation: "Pronunciation", grammar: "Grammar", listening: "Listening", speaking: "Speaking", reading: "Reading", writing: "Writing",
};

export function MasteryTestView({ sprint, onExit, onOpenRef }: { sprint: number; onExit: () => void; onOpenRef: (ref: string) => void }) {
  const queryClient = useQueryClient();
  const [test, setTest] = useState<MasteryTest | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [collected, setCollected] = useState<ResultIn[]>([]);
  const [sectionScores, setSectionScores] = useState<Record<string, number>>({});
  const [result, setResult] = useState<MasteryTest | null>(null);

  const dash = useQuery({ queryKey: ["language", "dashboard", sprint], queryFn: () => getDashboard(sprint) });
  const history = useQuery({ queryKey: ["language", "tests", sprint], queryFn: () => listTests(sprint) });
  const start = useMutation({
    mutationFn: () => startTest(sprint),
    onSuccess: (t) => {
      setTest(t);
      setSectionIndex(0);
      setCollected([]);
      setSectionScores({});
      setResult(null);
    },
  });
  const submit = useMutation({
    mutationFn: (results: ResultIn[]) => submitTest(test!.id, results),
    onSuccess: (t) => {
      setResult(t);
      queryClient.invalidateQueries({ queryKey: ["language"] });
    },
  });
  const advance = useMutation({
    mutationFn: () => setActiveSprint(Math.min(4, sprint + 1)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["language", "dashboard"] });
      onExit();
    },
  });

  const sections = test?.payload.sections ?? [];
  const section = sections[sectionIndex];

  const onSectionDone = (s: RunnerSummary) => {
    if (!test || !section) return;
    const results = s.items.map((it) => toResult(it, sprint, "test", { section: section.id }));
    const all = [...collected, ...results];
    const scores = { ...sectionScores, [section.id]: s.score };
    setCollected(all);
    setSectionScores(scores);
    if (sectionIndex + 1 < sections.length) {
      setSectionIndex(sectionIndex + 1);
    } else {
      submit.mutate(all);
    }
  };

  // ---- result -------------------------------------------------------------
  if (result) {
    const dims = Object.entries(result.scores).filter(([k]) => k !== "sections") as [string, number][];
    return (
      <div className="flex flex-col gap-3" style={{ maxWidth: 760 }}>
        <div className="hub-header">
          <h2>Sprint {sprint} · result</h2>
          <span className="xp-muted">
            readiness {Math.round(result.readiness * 100)}% · {result.passed ? "pass" : "not yet"}
          </span>
        </div>
        <div className="pr-summary">
          {dims.map(([k, v]) => (
            <div key={k}>
              <span className="xp-muted" style={{ fontSize: 11 }}>
                {LABELS[k] ?? k} · {String(result.profile[k] ?? "")}
              </span>
              <b>{Math.round(v * 100)}%</b>
            </div>
          ))}
        </div>
        {result.weak.length > 0 && (
          <p>
            Carry forward: <b>{(result.weak as string[]).map((w) => LABELS[w] ?? w).join(", ")}</b> - the session builder will keep surfacing them.
          </p>
        )}
        <div className="flex gap-2">
          {sprint < 4 && (
            <button type="button" className="xp-btn is-default" disabled={advance.isPending} onClick={() => advance.mutate()}>
              Advance to Sprint {sprint + 1}
            </button>
          )}
          <button type="button" className="xp-btn" onClick={() => start.mutate()}>
            Retake
          </button>
          <button type="button" className="xp-btn" onClick={onExit}>
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ---- running -------------------------------------------------------------
  if (test && section) {
    if (submit.isPending) return <p className="xp-muted p-3">Scoring…</p>;
    return (
      <ExerciseRunner
        key={section.id}
        exercises={section.exercises}
        title={`Test · ${section.title}`}
        subtitle={`section ${sectionIndex + 1} / ${sections.length}`}
        onFinish={onSectionDone}
        onExit={() => {
          if (window.confirm("Abandon this test attempt?")) {
            setTest(null);
            onExit();
          }
        }}
        onOpenRef={onOpenRef}
      />
    );
  }

  // ---- intro -----------------------------------------------------------------
  const d = dash.data;
  return (
    <div className="flex flex-col gap-3" style={{ maxWidth: 760 }}>
      <div className="hub-header">
        <h2>Sprint {sprint} · mastery test</h2>
        {d && <span className="xp-muted">readiness estimate {Math.round(d.progress.readiness * 100)}%</span>}
      </div>
      <fieldset className="xp-group">
        <legend>Requirements</legend>
        {d?.sprint.criteria.map((c) => (
          <div key={c.dimension} className="hub-meter" style={{ gridTemplateColumns: "90px minmax(0,1fr) 40px" }}>
            <span>{LABELS[c.dimension]}</span>
            <span className="xp-muted">{c.label}</span>
            <span className="hub-count">{Math.round((d.progress.dims[c.dimension] ?? 0) * 100)}%</span>
          </div>
        ))}
      </fieldset>
      <fieldset className="xp-group">
        <legend>Format</legend>
        <p style={{ fontSize: 12 }}>
          ~90 items · recognition 20 · production 12 · verbs 12 · pronunciation 24 (unseen words) · transformations 8–13 · listening 8 · speaking 8 + task
          {sprint >= 3 ? " · reading" : ""}
          {sprint === 4 ? " · writing" : ""} · ≈ 30 min. Profile per dimension; nothing is locked.
        </p>
      </fieldset>
      {(history.data ?? []).filter((t) => t.completed_at).length > 0 && (
        <fieldset className="xp-group">
          <legend>Previous attempts</legend>
          <table className="xp-listview" style={{ background: "transparent" }}>
            <tbody>
              {(history.data ?? [])
                .filter((t) => t.completed_at)
                .map((t) => (
                  <tr key={t.id}>
                    <td>{new Date(t.completed_at as string).toLocaleDateString()}</td>
                    <td>{Math.round(t.readiness * 100)}%</td>
                    <td>{t.passed ? "pass" : "-"}</td>
                    <td className="xp-muted">{(t.weak as string[]).map((w) => LABELS[w] ?? w).join(", ")}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </fieldset>
      )}
      <div className="flex gap-2">
        <button type="button" className="xp-btn is-default" disabled={start.isPending} onClick={() => start.mutate()}>
          {start.isPending ? "Building…" : "▶ Start"}
        </button>
        <button type="button" className="xp-btn" onClick={onExit}>
          Back
        </button>
      </div>
    </div>
  );
}
