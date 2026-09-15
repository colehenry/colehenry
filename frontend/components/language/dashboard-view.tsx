"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  discardAttempt,
  getDashboard,
  listAttempts,
  setActiveSprint,
  type Activity,
  type Attempt,
  type Dashboard,
  type PlanItem,
  type ProgressDetail,
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
const TRACKABLE_KINDS = new Set(["drill", "llm", "self"]);

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function DashboardView({
  viewSprint,
  onPractice,
  onStudy,
  onTest,
  onOpenRef,
  onTexts,
}: {
  viewSprint?: number;
  onPractice: (config: PracticeConfig) => void;
  onStudy: () => void;
  onTest: (sprint: number) => void;
  onOpenRef: (ref: string) => void;
  onTexts: () => void;
}) {
  const queryClient = useQueryClient();
  const [time, setTime] = useState(1);
  const [skill, setSkill] = useState("all");

  const dashboard = useQuery({
    queryKey: ["language", "dashboard", viewSprint ?? "active"],
    queryFn: () => getDashboard(viewSprint),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["language", "dashboard"] });
  const activate = useMutation({ mutationFn: setActiveSprint, onSuccess: invalidate });

  // unfinished runs - resumable from here, and shown as a partial bar on their activity row
  const attempts = useQuery({ queryKey: ["language", "attempts"], queryFn: listAttempts });
  const discard = useMutation({
    mutationFn: discardAttempt,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["language", "attempts"] }),
  });
  const openAttempts: Attempt[] = attempts.data ?? [];
  const attemptByActivity = new Map(openAttempts.map((attempt) => [attempt.activity_id, attempt]));
  const resumeAttempt = (attempt: Attempt) => onPractice({ attemptId: attempt.id, activityId: attempt.activity_id, sprint: attempt.sprint, title: attempt.title });

  const data: Dashboard | undefined = dashboard.data;
  const sprint = data?.sprint;
  const progress = data?.progress;

  if (dashboard.isLoading || !data || !sprint || !progress) {
    return <p className="xp-muted p-3">{dashboard.isError ? "Dashboard unavailable." : "Loading…"}</p>;
  }

  const [, low, high] = TIME_BUCKETS[time];
  const activities = sprint.activities.filter(
    (activity) =>
      activity.kind !== "test" &&
      activity.minutes >= low &&
      activity.minutes <= high &&
      (skill === "all" || activity.skill === skill),
  );
  const completedIds = new Set(progress.completed_activity_ids);
  const isActive = data.state.active_sprint === sprint.number;
  const visibleDimensions = DIM_ORDER.filter((dimension) => (progress.weights[dimension] ?? 0) > 0);

  const runActivity = (activity: Activity | PlanItem) => {
    const id = "activity_id" in activity ? activity.activity_id : activity.id;
    if (activity.kind === "srs") return onStudy();
    if (activity.kind === "text") return onTexts();
    if (activity.kind === "test") return onTest(sprint.number);
    if (activity.kind === "external") {
      const resource = sprint.resources.find((item) => item.id === activity.resource);
      if (resource) window.open(resource.url, "_blank", "noopener");
      return;
    }
    onPractice({ activityId: id, sprint: sprint.number, title: activity.name });
  };

  const detailsFor = (dimension: string) => {
    const target = progress.targets.find((item) => item.dimension === dimension);
    const practice = sprint.activities.filter(
      (activity) => activity.skill === dimension && TRACKABLE_KINDS.has(activity.kind),
    );
    const learned: ProgressDetail[] =
      dimension === "verbs"
        ? progress.verbs
        : dimension === "pronunciation"
          ? progress.pronunciation
          : dimension === "grammar"
            ? progress.grammar
            : [];

    return (
      <div className="hub-progress-detail">
        {target && (
          <div className="hub-progress-item">
            <span>{target.done >= target.total && target.total > 0 ? "✓" : "○"}</span>
            <span>{target.label}</span>
            <span className="hub-count">{target.done} / {target.total}</span>
          </div>
        )}
        {dimension === "vocabulary" &&
          (
            [
              ["Productive words", progress.vocab.productive],
              ["Heard & spelled", progress.vocab.heard],
              ["Used in context", progress.vocab.in_context],
              ["Spoken", progress.vocab.spoken],
            ] as [string, number | undefined][]
          )
            .filter((entry): entry is [string, number] => entry[1] != null)
            .map(([label, value]) => (
              <div key={label} className="hub-progress-item">
                <span>{value >= progress.vocab.total && progress.vocab.total > 0 ? "✓" : "○"}</span>
                <span>{label}</span>
                <span className="hub-count">{value} / {progress.vocab.total}</span>
              </div>
            ))}
        {learned.map((item) => (
          <button
            key={item.id}
            type="button"
            className="hub-progress-item is-button"
            onClick={() => {
              if (item.ref) onOpenRef(item.ref);
              else if (dimension === "verbs") onPractice({ format: "verb_drill", sprint: sprint.number, count: 10, targets: [item.id], title: `Verb drill · ${item.id}`, source: "deterministic" });
            }}
          >
            <span>{item.met ? "✓" : "○"}</span>
            <span>{item.label}</span>
            <span className="hub-count">{item.attempts} tries</span>
          </button>
        ))}
        {practice.map((activity) => (
          <button key={activity.id} type="button" className="hub-progress-item is-button" onClick={() => runActivity(activity)}>
            <span>{completedIds.has(activity.id) ? "✓" : "○"}</span>
            <span>{activity.name}</span>
            <span className="hub-count">{activity.minutes}m</span>
          </button>
        ))}
        {dimension === "speaking" && sprint.output_targets.map((item) => (
          <div key={item} className="hub-progress-item">
            <span>○</span>
            <span>{item}</span>
            <span />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="hub-dashboard">
      {openAttempts.length > 0 && (
        <fieldset className="xp-group">
          <legend>Pick up where you left off</legend>
          <div className="flex flex-col gap-2">
            {openAttempts.map((attempt) => {
              const done = attempt.graded.length;
              return (
                <div key={attempt.id} className="hub-resume">
                  <b>{attempt.title || attempt.activity_id}</b>
                  <span className="xp-muted">S{attempt.sprint} · {ago(attempt.updated_at)} ago</span>
                  <span className="hub-bar"><i style={{ width: `${attempt.total ? Math.round((done / attempt.total) * 100) : 0}%` }} /></span>
                  <span className="hub-count">{done} / {attempt.total}</span>
                  <button type="button" className="xp-btn is-small is-default" onClick={() => resumeAttempt(attempt)}>Resume</button>
                  <button type="button" className="xp-link" disabled={discard.isPending} onClick={() => discard.mutate(attempt.id)}>[discard]</button>
                </div>
              );
            })}
          </div>
        </fieldset>
      )}
      <fieldset className="xp-group">
        <legend>Do next</legend>
        <div className="hub-next-grid">
          {data.suggestion.map((item, index) => (
            <div key={item.activity_id} className="hub-next-item" title={item.target}>
              <div className="hub-next-meta">
                <span className="hub-next-rank">{index + 1}</span>
                <span className="hub-minutes">{item.minutes} min</span>
              </div>
              <b>{item.name}</b>
              <span className="xp-muted">{item.why}</span>
              <button type="button" className={`xp-btn ${index === 0 ? "is-default" : ""}`} onClick={() => runActivity(item)}>
                Start
              </button>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="hub-dashboard-columns">
        <div className="hub-dashboard-main">
          <fieldset className="xp-group hub-activity-panel">
            <legend>Activity bank</legend>
            <div className="hub-filters">
              {TIME_BUCKETS.map(([label], index) => (
                <button key={label} type="button" className={`hub-chip ${time === index ? "is-active" : ""}`} onClick={() => setTime(index)}>
                  {label}
                </button>
              ))}
              <select className="xp-select" aria-label="Activity skill" value={skill} onChange={(event) => setSkill(event.target.value)}>
                {SKILLS.map((item) => <option key={item} value={item}>{item === "all" ? "All skills" : DIM_LABELS[item] ?? item}</option>)}
              </select>
              <span className="ml-auto xp-muted">{activities.length} activities</span>
            </div>
            <div className="hub-activity-scroll">
              {activities.map((activity) => {
                const open = attemptByActivity.get(activity.id);
                return (
                  <button key={activity.id} type="button" className="hub-act is-button" onClick={() => (open ? resumeAttempt(open) : runActivity(activity))}>
                    <span className="hub-act-name">
                      {completedIds.has(activity.id) && <span className="ok mr-1">✓</span>}
                      {activity.name}
                      {activity.kind === "llm" && <span className="xp-muted"> ✦</span>}
                      {open && (
                        <span className="hub-act-partial" title={`${open.graded.length} / ${open.total} done`}>
                          <i style={{ width: `${open.total ? Math.round((open.graded.length / open.total) * 100) : 0}%` }} />
                        </span>
                      )}
                    </span>
                    <span className="hub-act-target">{DIM_LABELS[activity.skill] ?? activity.skill}</span>
                    <span className="hub-minutes">{TIME_BUCKETS[time][0]}</span>
                    <span className="xp-btn is-small">{activity.kind === "external" ? "Open" : open ? "Resume" : "Start"}</span>
                  </button>
                );
              })}
              {activities.length === 0 && <p className="xp-muted p-2">No activities in this filter.</p>}
            </div>
          </fieldset>
        </div>

        <div className="hub-dashboard-side">
          <fieldset className="xp-group hub-progress-panel">
            <legend>Sprint progress</legend>
            <div className="hub-progress-total">
              <b>Total</b>
              <div className="hub-bar"><i style={{ width: `${Math.round(progress.readiness * 100)}%` }} /></div>
              <span className="hub-count">{pct(progress.readiness)}</span>
              {!isActive && (
                <button type="button" className="xp-btn is-small" disabled={activate.isPending} onClick={() => activate.mutate(sprint.number)}>
                  Make active
                </button>
              )}
            </div>
            {visibleDimensions.map((dimension) => {
              const value = progress.dims[dimension] ?? 0;
              return (
                <details key={dimension} className="hub-progress-group">
                  <summary>
                    <span className="hub-progress-summary">
                      <span>{DIM_LABELS[dimension] ?? dimension}</span>
                      <span className="hub-bar"><i style={{ width: `${Math.round(value * 100)}%` }} /></span>
                      <span className="hub-count">{pct(value)}</span>
                    </span>
                  </summary>
                  {detailsFor(dimension)}
                </details>
              );
            })}
            {data.carryover.length > 0 && (
              <div className="hub-carryover">Carry-over: {data.carryover.map((item) => `${DIM_LABELS[item.dimension] ?? item.dimension} (S${item.sprint})`).join(" · ")}</div>
            )}
          </fieldset>

          <fieldset className="xp-group hub-resources-panel">
            <legend>Resources</legend>
            <div className="hub-resource-list">
              {sprint.resources.map((resource) => (
                <div key={resource.id} className="hub-resource-row">
                  <a className="xp-link" href={resource.url} target="_blank" rel="noreferrer">{resource.name}</a>
                  <span className="xp-muted">{resource.section || resource.note}</span>
                  <span className="hub-minutes">{resource.minutes}m</span>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <fieldset className="xp-group hub-sprint-test">
        <legend>Sprint test</legend>
        <div>
          <b>{pct(progress.readiness)}</b>
          <span className="xp-muted">Sprint {sprint.number} progress</span>
          {data.last_test && <span className="xp-muted">Last test {pct(data.last_test.readiness)} · {ago(data.last_test.completed_at ?? data.last_test.started_at)}</span>}
        </div>
        <button type="button" className="xp-btn" onClick={() => onTest(sprint.number)}>Start test</button>
      </fieldset>
    </div>
  );
}
