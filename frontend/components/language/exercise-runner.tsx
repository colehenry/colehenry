"use client";

// Shared practice runner: one component runs every exercise kind (mc /
// typed / self) from any source (deterministic, LLM, mastery test). Grading
// is client-side (mirrors the backend); results are returned to the caller,
// which decides where they go (practice results vs. test submission).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { explainFrench, type Exercise, type ExplainMode, type ResultIn } from "@/lib/api/learning";
import { SELF_SCORES, checkTyped, dictationScore, wordDiff, type TypedResult } from "@/lib/french/grading";
import { Speak, speakText } from "./language-shared";

export type GradedItem = {
  exercise: Exercise;
  answer: string;
  correct: boolean;
  score: number;
  timeMs: number;
};

export type RunnerSummary = {
  items: GradedItem[];
  score: number; // 0..1 mean
  correct: number;
  total: number;
  bySkill: Record<string, { score: number; n: number }>;
  seconds: number;
};

export function toResult(item: GradedItem, sprint: number, activityId: string, extraMeta: Record<string, unknown> = {}): ResultIn {
  const ex = item.exercise;
  return {
    sprint,
    activity_id: activityId,
    format: ex.format,
    source: ex.source,
    skill: ex.skill,
    target_ids: ex.target_ids,
    dims: ex.dims,
    correct: item.correct,
    score: item.score,
    prompt: ex.prompt,
    answer: item.answer,
    expected: ex.kind === "mc" ? (ex.options.find((o) => o.id === ex.answer_id)?.text ?? "") : (ex.accepted[0] ?? ""),
    time_ms: item.timeMs,
    generated_id: ex.generated_id ?? null,
    meta: { ...ex.meta, ...extraMeta },
  };
}

export function summarize(items: GradedItem[], seconds: number): RunnerSummary {
  const bySkill: Record<string, { score: number; n: number }> = {};
  for (const it of items) {
    const s = (bySkill[it.exercise.skill] ??= { score: 0, n: 0 });
    s.score += it.score;
    s.n += 1;
  }
  for (const k of Object.keys(bySkill)) bySkill[k].score = bySkill[k].score / bySkill[k].n;
  const total = items.length;
  const score = total ? items.reduce((a, b) => a + b.score, 0) / total : 0;
  return { items, score, correct: items.filter((i) => i.correct).length, total, bySkill, seconds };
}

const RATING_KEYS = ["1", "2", "3", "4"];

function VoiceRecorder() {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const clear = useCallback(() => {
    setUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
  }, []);

  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  const start = async () => {
    setError("");
    clear();
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      const next = new MediaRecorder(mic);
      stream.current = mic;
      recorder.current = next;
      chunks.current = [];
      next.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      next.onstop = () => {
        const blob = new Blob(chunks.current, { type: next.mimeType || "audio/webm" });
        setUrl(URL.createObjectURL(blob));
        setRecording(false);
        mic.getTracks().forEach((track) => track.stop());
        stream.current = null;
      };
      next.start();
      setRecording(true);
    } catch {
      setError("Mic unavailable");
    }
  };

  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  return (
    <div className="pr-recorder">
      <button type="button" className={`xp-btn ${recording ? "is-default" : ""}`} onClick={recording ? stop : start}>
        {recording ? "■ Stop" : "● Record"}
      </button>
      {url && <audio src={url} controls preload="metadata" aria-label="Your recording" />}
      {url && (
        <button type="button" className="xp-link" onClick={clear}>
          [discard]
        </button>
      )}
      {error && <span className="xp-muted">{error}</span>}
    </div>
  );
}

export function ExerciseRunner({
  exercises,
  title,
  subtitle,
  onFinish,
  onExit,
  onOpenRef,
  autoAdvanceMs = 0,
  retryMissed = false,
}: {
  exercises: Exercise[];
  title: string;
  subtitle?: string;
  onFinish: (summary: RunnerSummary) => void;
  onExit: () => void;
  onOpenRef?: (ref: string) => void;
  autoAdvanceMs?: number;
  retryMissed?: boolean;
}) {
  const [queue, setQueue] = useState(exercises);
  const [retryAdded, setRetryAdded] = useState(false);
  const [index, setIndex] = useState(0);
  const [graded, setGraded] = useState<GradedItem[]>([]);
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState<{ correct: boolean; score: number; detail?: TypedResult } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [startedAt] = useState(Date.now);
  const itemStart = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [explain, setExplain] = useState<{ mode: ExplainMode; text: string } | null>(null);

  const ex = queue[index];
  const done = index >= queue.length;
  const passage = typeof ex?.meta?.passage === "string" ? (ex.meta.passage as string) : "";
  const speakAfter = typeof ex?.meta?.speak_after === "string" ? (ex.meta.speak_after as string) : "";
  const isDictation = ex?.meta?.dictation === true;
  const lenient = ex?.meta?.lenient === true;
  const selfScale = Array.isArray(ex?.meta?.self_scale) ? (ex!.meta.self_scale as string[]) : ["raté", "difficile", "bien", "fluide"];

  const explainMutation = useMutation({
    mutationFn: (args: { text: string; mode: ExplainMode; context?: string }) => explainFrench(args),
  });

  // autoplay audio on arrival
  useEffect(() => {
    if (!ex) return;
    const resetTimer = window.setTimeout(() => {
      itemStart.current = Date.now();
      setTyped("");
      setPicked(null);
      setChecked(null);
      setRevealed(false);
      setExplain(null);
      explainMutation.reset();
      if (ex.audio && ex.autoplay) void speakText(ex.audio.language, ex.audio.text);
    }, 0);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(resetTimer);
      window.clearTimeout(focusTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, ex?.id]);

  const finish = useCallback(
    (items: GradedItem[]) => {
      onFinish(summarize(items, Math.round((Date.now() - startedAt) / 1000)));
    },
    [onFinish, startedAt],
  );

  const commit = useCallback(
    (answer: string, correct: boolean, score: number, detail?: TypedResult) => {
      if (!ex || checked) return;
      const item: GradedItem = { exercise: ex, answer, correct, score, timeMs: itemStart.current ? Date.now() - itemStart.current : 0 };
      setChecked({ correct, score, detail });
      setGraded((g) => [...g, item]);
      if (speakAfter && ex.kind !== "self" && !(ex.audio && ex.audio.text === speakAfter && ex.autoplay && ex.audio_only === false)) {
        void speakText("fr", speakAfter);
      } else if (ex.audio_only && ex.audio && ex.kind !== "self") {
        void speakText(ex.audio.language, ex.audio.text);
      }
    },
    [ex, checked, speakAfter],
  );

  const next = useCallback(() => {
    if (!checked) return;
    const all = graded;
    if (index + 1 >= queue.length) {
      const missed = all.filter((item) => !item.correct && item.exercise.meta?.retry_missed === true && item.exercise.meta?.is_retry !== true);
      if (retryMissed && !retryAdded && missed.length) {
        const retries = missed.map((item) => ({
          ...item.exercise,
          id: `${item.exercise.id}-retry`,
          instructions: `Retry · ${item.exercise.instructions.replace(/^\d\s*\/\s*\d\s*·\s*/, "")}`,
          meta: { ...item.exercise.meta, is_retry: true },
        }));
        setQueue((current) => [...current, ...retries]);
        setRetryAdded(true);
        setIndex((current) => current + 1);
        return;
      }
      finish(all);
    } else {
      setIndex((i) => i + 1);
    }
  }, [checked, graded, index, queue.length, finish, retryMissed, retryAdded]);

  const nextIntro = useCallback(() => {
    if (index + 1 < queue.length) setIndex((current) => current + 1);
  }, [index, queue.length]);

  // auto-advance for fast MC drills when correct
  useEffect(() => {
    if (!checked || !autoAdvanceMs || !checked.correct || ex?.kind !== "mc") return;
    const t = window.setTimeout(next, autoAdvanceMs);
    return () => window.clearTimeout(t);
  }, [checked, autoAdvanceMs, next, ex?.kind]);

  const checkTypedAnswer = useCallback(() => {
    if (!ex || checked) return;
    if (isDictation) {
      const expected = ex.accepted[0] ?? "";
      const score = dictationScore(expected, typed);
      const detail = checkTyped(typed, ex.accepted);
      commit(typed, score >= 0.85, Math.max(score, detail.score), detail);
      return;
    }
    const r = checkTyped(typed, ex.accepted);
    if (!r.correct && lenient) {
      // free-response formats: reveal samples, let the learner self-judge
      setChecked({ correct: false, score: -1, detail: r });
      return;
    }
    commit(typed, r.correct, r.score, r);
  }, [ex, checked, typed, isDictation, lenient, commit]);

  const pickOption = useCallback(
    (id: string) => {
      if (!ex || checked) return;
      setPicked(id);
      const correct = id === ex.answer_id;
      const text = ex.options.find((o) => o.id === id)?.text ?? id;
      commit(text, correct, correct ? 1 : 0);
    },
    [ex, checked, commit],
  );

  const rateSelf = useCallback(
    (level: number) => {
      if (!ex) return;
      const score = SELF_SCORES[level] ?? 0;
      if (checked) return;
      setChecked({ correct: score >= 0.8, score });
      setGraded((g) => [...g, { exercise: ex, answer: `self:${level}`, correct: score >= 0.8, score, timeMs: itemStart.current ? Date.now() - itemStart.current : 0 }]);
    },
    [ex, checked],
  );

  // keyboard: 1-4 options / ratings, Enter check or next, P play
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!ex) return;
      const target = e.target as HTMLElement | null;
      const inField = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (e.key === "Enter") {
        if (ex.kind === "intro") {
          e.preventDefault();
          nextIntro();
        } else if (checked && (checked.score >= 0 || ex.kind !== "typed")) {
          e.preventDefault();
          next();
        } else if (ex.kind === "typed" && !checked) {
          e.preventDefault();
          checkTypedAnswer();
        }
        return;
      }
      if (inField) return;
      if (e.key.toLowerCase() === "p" && ex.audio) {
        e.preventDefault();
        void speakText(ex.audio.language, ex.audio.text);
        return;
      }
      if (ex.kind === "mc" && !checked && RATING_KEYS.includes(e.key)) {
        const opt = ex.options[Number(e.key) - 1];
        if (opt) pickOption(opt.id);
      } else if (ex.kind === "self" && !checked && RATING_KEYS.includes(e.key)) {
        rateSelf(Number(e.key) - 1);
      } else if (e.key === " " && ex.kind === "self" && !revealed) {
        e.preventDefault();
        setRevealed(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ex, checked, next, nextIntro, checkTypedAnswer, pickOption, rateSelf, revealed]);

  const progressPct = useMemo(() => (queue.length ? (index / queue.length) * 100 : 0), [index, queue.length]);

  if (!ex || done) {
    return null;
  }

  const showPromptText = !(ex.audio_only && !checked);
  const groupLabel = ex.group ? ex.group.split("-")[0] : "";

  return (
    <div className="pr-shell">
      <div className="pr-top">
        <b style={{ color: "var(--xp-text)" }}>{title}</b>
        {subtitle && <span>{subtitle}</span>}
        <div className="pr-progress" aria-hidden>
          <i style={{ width: `${progressPct}%` }} />
        </div>
        <span>
          {index + 1} / {queue.length}
        </span>
        {graded.length > 0 && <span>{Math.round((graded.reduce((a, b) => a + b.score, 0) / graded.length) * 100)}%</span>}
        <button type="button" className="xp-link" onClick={onExit}>
          [quit]
        </button>
      </div>

      <div className="pr-card">
        {passage && (
          <div className="pr-passage">
            <div className="mb-1 flex items-center gap-2" style={{ fontFamily: "var(--xp-font)", fontSize: 11 }}>
              <Speak language="fr" text={passage} label="► lire" />
              {groupLabel && <span className="xp-muted">{ex.instructions}</span>}
            </div>
            {passage}
          </div>
        )}
        <div className="pr-instructions">
          {ex.instructions}
          {ex.hint && <span className="xp-muted"> · {ex.hint}</span>}
          {ex.source === "llm" && <span className="xp-muted"> · ✦</span>}
        </div>

        {ex.kind !== "self" && ex.audio && (ex.audio_only || ex.format === "sentence_transform" || ex.kind === "intro") && (
          <div className="mb-2">
            <Speak language={ex.audio.language} text={ex.audio.text} label="► écouter (P)" className="xp-btn pr-big-play" />
          </div>
        )}
        {showPromptText && ex.kind !== "self" && (
          <div className={`pr-prompt ${ex.prompt.length > 60 ? "is-small" : ""}`} style={{ whiteSpace: "pre-wrap" }}>
            {ex.prompt}
          </div>
        )}
        {ex.prompt_es && showPromptText && ex.kind !== "self" && ex.format !== "es_to_fr" && (
          <div className="pr-prompt-es">{ex.prompt_es}</div>
        )}

        {ex.kind === "intro" && (
          <div className="pr-feedback">
            <div>{ex.explanation}</div>
            <div className="pr-actions">
              <button type="button" className="xp-btn is-default" onClick={nextIntro}>Continue (Enter)</button>
            </div>
          </div>
        )}

        {/* ---- multiple choice ---- */}
        {ex.kind === "mc" && (
          <div className="pr-options">
            {ex.options.map((o, i) => {
              const state = checked ? (o.id === ex.answer_id ? "is-correct" : o.id === picked ? "is-wrong" : "") : "";
              return (
                <button
                  key={o.id}
                  type="button"
                  className={`pr-option ${state}`}
                  disabled={!!checked}
                  onClick={() => pickOption(o.id)}
                >
                  <kbd>{i + 1}</kbd>
                  <span>{o.text}</span>
                  {checked && o.audio && <Speak language={o.audio.language} text={o.audio.text} label="►" />}
                </button>
              );
            })}
          </div>
        )}

        {/* ---- typed ---- */}
        {ex.kind === "typed" && (
          <>
            <input
              ref={inputRef}
              className="xp-input pr-input"
              value={typed}
              disabled={!!checked && checked.score >= 0}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              lang="fr"
              placeholder={isDictation ? "écris ce que tu entends" : "→ français"}
              onChange={(e) => setTyped(e.target.value)}
            />
            {!checked && (
              <div className="pr-actions">
                <button type="button" className="xp-btn is-default" onClick={checkTypedAnswer}>
                  Vérifier (Enter)
                </button>
                <button type="button" className="xp-btn is-small" onClick={() => commit("", false, 0)}>
                  Je ne sais pas
                </button>
                <span className="xp-muted" style={{ fontSize: 11 }}>é è ê à ç ù î ô</span>
              </div>
            )}
          </>
        )}

        {/* ---- self-graded ---- */}
        {ex.kind === "self" && (
          <>
            {ex.audio && (
              <div className="mb-2 flex items-center gap-2">
                <Speak language={ex.audio.language} text={ex.audio.text} label="► écouter (P)" className="xp-btn pr-big-play" />
                {ex.audio_only && !revealed && <span className="xp-muted">réponds à voix haute, puis révèle</span>}
              </div>
            )}
            {(!ex.audio_only || revealed) && (
              <div className="pr-prompt is-small" style={{ whiteSpace: "pre-wrap" }}>
                {ex.prompt}
              </div>
            )}
            {ex.prompt_es && revealed && <div className="pr-prompt-es">{ex.prompt_es}</div>}
            <VoiceRecorder key={ex.id} />
            {!revealed ? (
              <div className="pr-actions">
                <button type="button" className="xp-btn" onClick={() => setRevealed(true)}>
                  Révéler (Space)
                </button>
              </div>
            ) : (
              ex.reveal && (
                <div className="pr-feedback" style={{ whiteSpace: "pre-wrap" }}>
                  {ex.reveal}
                </div>
              )
            )}
            {!checked && (
              <div className="pr-self">
                {selfScale.map((label, i) => (
                  <button key={label} type="button" className={`xp-btn ${i === 2 ? "is-default" : ""}`} onClick={() => rateSelf(i)}>
                    {label} ({i + 1})
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---- feedback ---- */}
        {checked && checked.score === -1 && ex.kind === "typed" && (
          <div className="pr-feedback">
            <div>
              Pas dans la liste. Réponses possibles :
              <ul className="pr-steps" style={{ fontSize: 13 }}>
                {ex.accepted.slice(0, 4).map((a) => (
                  <li key={a}>
                    {a} <Speak language="fr" text={a} label="►" />
                  </li>
                ))}
              </ul>
            </div>
            <div className="pr-actions">
              <button type="button" className="xp-btn" onClick={() => commit(typed, true, 0.8)}>
                Équivalent · ok
              </button>
              <button type="button" className="xp-btn" onClick={() => commit(typed, false, 0.2)}>
                Faux
              </button>
            </div>
          </div>
        )}
        {checked && checked.score >= 0 && (
          <div className={`pr-feedback ${checked.correct ? "is-correct" : "is-wrong"}`}>
            {ex.kind === "typed" && (
              <div>
                {checked.correct ? <b className="ok">✓</b> : <b className="ko">✗</b>}{" "}
                {checked.detail?.exact ? "exact" : ""}
                {checked.detail?.accentIssue ? "accent : " : ""}
                {checked.detail?.neDropped ? "ne omis (oral) : " : ""}
                {!checked.correct || !checked.detail?.exact ? (
                  <>
                    <b>{ex.accepted[0]}</b> <Speak language="fr" text={ex.accepted[0] ?? ""} label="►" />
                    {ex.accepted.length > 1 && <span className="xp-muted"> · aussi : {ex.accepted.slice(1, 3).join(" · ")}</span>}
                  </>
                ) : null}
                {isDictation && typed && (
                  <div className="pr-diff mt-1">
                    {wordDiff(ex.accepted[0] ?? "", typed).map((d, i) => (
                      <span key={i} className={d.op === "equal" ? "" : `is-${d.op}`} title={d.expected ? `→ ${d.expected}` : undefined}>
                        {d.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {ex.kind === "mc" && (
              <div>
                {checked.correct ? <b className="ok">✓</b> : <b className="ko">✗ → {ex.options.find((o) => o.id === ex.answer_id)?.text}</b>}
                {ex.audio_only && <> · {ex.prompt}</>}
              </div>
            )}
            {ex.kind === "self" && <div>{checked.correct ? <b className="ok">✓</b> : <b className="ko">→ à refaire</b>}</div>}
            {ex.explanation && <div className="mt-1">{ex.explanation}</div>}
            {ex.prompt_es && ex.format === "es_to_fr" ? null : ex.prompt_es && ex.audio_only ? <div className="xp-muted">{ex.prompt_es}</div> : null}
            <div className="pr-actions">
              {ex.refs.map((r) => (
                <button key={r.ref} type="button" className="xp-link" onClick={() => onOpenRef?.(r.ref)}>
                  [{r.label}]
                </button>
              ))}
              {(["explain", "compare_es", "pronunciation"] as ExplainMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className="xp-link"
                  disabled={explainMutation.isPending}
                  onClick={() => {
                    const text = ex.accepted[0] || ex.options.find((o) => o.id === ex.answer_id)?.text || ex.prompt;
                    setExplain({ mode, text });
                    explainMutation.mutate({ text, mode, context: ex.prompt });
                  }}
                >
                  [{mode === "explain" ? "explique" : mode === "compare_es" ? "vs español" : "prononciation"}]
                </button>
              ))}
              <button type="button" className="xp-btn is-default" style={{ marginLeft: "auto" }} onClick={next}>
                {index + 1 >= exercises.length ? "Terminer" : "Suivant"} (Enter)
              </button>
            </div>
            {explain && (
              <div className="mt-2" style={{ borderTop: "1px dotted var(--xp-face-lo)", paddingTop: 6 }}>
                {explainMutation.isPending && <span className="xp-muted">✦ …</span>}
                {explainMutation.isError && <span className="xp-muted">LLM indisponible.</span>}
                {explainMutation.data && (
                  <div>
                    <div>{explainMutation.data.explanation}</div>
                    {explainMutation.data.examples.map((e) => (
                      <div key={e.fr} className="mt-1">
                        <Speak language="fr" text={e.fr} label="►" /> <b>{e.fr}</b> <span className="xp-muted">- {e.es}</span>
                      </div>
                    ))}
                    {explainMutation.data.refs.map((r) => (
                      <button key={r.ref} type="button" className="xp-link mr-2" onClick={() => onOpenRef?.(r.ref)}>
                        [{r.label}]
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function RunnerSummaryView({
  summary,
  title,
  onAgain,
  onBack,
  backLabel = "Dashboard",
  children,
}: {
  summary: RunnerSummary;
  title: string;
  onAgain?: () => void;
  onBack: () => void;
  backLabel?: string;
  children?: React.ReactNode;
}) {
  const wrong = summary.items.filter((i) => !i.correct);
  return (
    <div className="flex flex-col gap-3">
      <div className="hub-header">
        <h2>{title}</h2>
        <span className="xp-muted">
          {summary.correct} / {summary.total} · {Math.round(summary.score * 100)}% · {Math.floor(summary.seconds / 60)}:{String(summary.seconds % 60).padStart(2, "0")}
        </span>
      </div>
      <div className="pr-summary">
        {Object.entries(summary.bySkill).map(([skill, s]) => (
          <div key={skill}>
            <span className="xp-muted" style={{ fontSize: 11 }}>
              {skill}
            </span>
            <b>{Math.round(s.score * 100)}%</b>
          </div>
        ))}
      </div>
      {wrong.length > 0 && (
        <fieldset className="xp-group">
          <legend>À revoir ({wrong.length})</legend>
          <table className="xp-listview" style={{ background: "transparent" }}>
            <tbody>
              {wrong.map((w) => {
                const ex = w.exercise;
                const expected = ex.kind === "mc" ? ex.options.find((o) => o.id === ex.answer_id)?.text : ex.accepted[0];
                return (
                  <tr key={ex.id}>
                    <td style={{ maxWidth: 320 }}>{ex.prompt || ex.audio?.text}</td>
                    <td className="xp-muted">{w.answer && !w.answer.startsWith("self:") ? w.answer : "-"}</td>
                    <td>
                      <b>{expected}</b> {expected && <Speak language="fr" text={expected} label="►" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </fieldset>
      )}
      {children}
      <div className="flex gap-2">
        {onAgain && (
          <button type="button" className="xp-btn" onClick={onAgain}>
            Encore
          </button>
        )}
        <button type="button" className="xp-btn is-default" onClick={onBack}>
          {backLabel}
        </button>
      </div>
    </div>
  );
}
