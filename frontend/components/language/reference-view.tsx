"use client";

// Reference library: static sheets (lib/french/references.ts), the Core Verb
// Atlas (curriculum API) and the Personal Interference Log (learner data).
// Deep-linkable per section: `sheet#section`.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { addInterference, deleteInterference, getCurriculum, listInterference, updateInterference, type CoreVerb } from "@/lib/api/learning";
import { REFERENCE_SHEETS, SHEET_BY_ID, parseRef, type RefSection } from "@/lib/french/references";
import { Speak } from "./language-shared";

const PERSONS: [string, string][] = [
  ["1s", "je"],
  ["2s", "tu"],
  ["3s", "il / elle / on"],
  ["1p", "nous"],
  ["2p", "vous"],
  ["3p", "ils / elles"],
];

function joinSubject(p: string, form: string): string {
  const subj = p === "1s" ? "je" : p === "2s" ? "tu" : p === "3s" ? "il" : p === "1p" ? "nous" : p === "2p" ? "vous" : "ils";
  if (subj === "je" && /^[aeiouyàâäéèêëîïôöùûüh]/i.test(form)) return `j'${form}`;
  return `${subj} ${form}`;
}

export function ReferenceView({
  target,
  onOpenVerb,
  onPractice,
}: {
  target: string | null; // "sheet#section"
  onOpenVerb: (infinitive: string) => void;
  onPractice: (format: string, targets: string[]) => void;
}) {
  const initial = target ? parseRef(target) : { sheet: "pronunciation", section: "" };
  const [sheetId, setSheetId] = useState(initial.sheet in SHEET_BY_ID ? initial.sheet : "pronunciation");
  const [section, setSection] = useState(initial.section);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!target) return;
    const p = parseRef(target);
    const timer = window.setTimeout(() => {
      if (p.sheet in SHEET_BY_ID) setSheetId(p.sheet);
      setSection(p.section);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [target]);

  useEffect(() => {
    if (!section) return;
    const t = window.setTimeout(() => document.getElementById(`ref-${sheetId}-${section}`)?.scrollIntoView({ block: "start" }), 50);
    return () => window.clearTimeout(t);
  }, [sheetId, section]);

  const sheet = SHEET_BY_ID[sheetId];
  const query = q.trim().toLowerCase();

  // global search across static sheets
  const hits = useMemo(() => {
    if (!query) return [];
    const out: { sheet: string; section: RefSection; rows: string[][] }[] = [];
    for (const s of REFERENCE_SHEETS) {
      for (const sec of s.sections) {
        const rows = sec.rows.filter((r) => r.some((c) => c.toLowerCase().includes(query)));
        if (rows.length || sec.title.toLowerCase().includes(query)) out.push({ sheet: s.id, section: sec, rows: rows.length ? rows : sec.rows.slice(0, 3) });
      }
    }
    return out;
  }, [query]);

  return (
    <div className="ref-layout">
      <div className="xp-well ref-list" style={{ padding: 4, alignSelf: "start" }}>
        <input className="xp-input mb-1" placeholder="search all sheets" value={q} onChange={(e) => setQ(e.target.value)} />
        {REFERENCE_SHEETS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={s.id === sheetId && !query ? "is-active" : ""}
            onClick={() => {
              setSheetId(s.id);
              setSection("");
              setQ("");
            }}
          >
            <span className="xp-muted" style={{ display: "inline-block", width: 18 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            {s.title}
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {query ? (
          <>
            <div className="hub-header">
              <h2>“{q}”</h2>
              <span className="xp-muted">{hits.length} sections</span>
            </div>
            {hits.map((h) => (
              <SectionBlock key={`${h.sheet}-${h.section.id}`} sheetId={h.sheet} section={{ ...h.section, rows: h.rows }} highlight={false} onJump={() => (setSheetId(h.sheet), setSection(h.section.id), setQ(""))} />
            ))}
          </>
        ) : (
          <>
            <div className="hub-header">
              <h2>{sheet.title}</h2>
              <span className="xp-muted">{sheet.blurb}</span>
              {sheet.sections.length > 0 && (
                <span className="ml-auto flex flex-wrap gap-1">
                  {sheet.sections.map((s) => (
                    <button key={s.id} type="button" className={`hub-chip ${s.id === section ? "is-active" : ""}`} onClick={() => setSection(s.id)}>
                      {s.title}
                    </button>
                  ))}
                </span>
              )}
            </div>
            {sheet.dynamic === "core-verbs" && <VerbAtlas focus={section} onOpenVerb={onOpenVerb} onPractice={onPractice} />}
            {sheet.dynamic === "interference" && <InterferenceLog onPractice={onPractice} />}
            {sheet.sections.map((s) => (
              <SectionBlock key={s.id} sheetId={sheet.id} section={s} highlight={s.id === section} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function SectionBlock({ sheetId, section, highlight, onJump }: { sheetId: string; section: RefSection; highlight: boolean; onJump?: () => void }) {
  const speakCol = section.speak ?? -1;
  return (
    <div id={`ref-${sheetId}-${section.id}`} className={`ref-section ${highlight ? "is-target" : ""}`}>
      <h3>
        {section.title}{" "}
        <a href={`#ref/${sheetId}/${section.id}`} onClick={(e) => (onJump ? (e.preventDefault(), onJump()) : undefined)}>
          #{sheetId}/{section.id}
        </a>
      </h3>
      {section.note && <p className="ref-note">{section.note}</p>}
      <table className="xp-listview ref-table">
        {section.columns && (
          <thead>
            <tr>
              {section.columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {section.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>
                  {j === speakCol && cell ? <Speakable text={cell} /> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "a · b · c" cells become individually playable. */
function Speakable({ text }: { text: string }) {
  const parts = text.split(" · ");
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && " · "}
          <Speak language="fr" text={p.replace(/‿/g, " ").replace(/\s*\(.*?\)\s*/g, " ").trim()} label={p} className="xp-link" />
        </span>
      ))}
    </>
  );
}

function VerbAtlas({ focus, onOpenVerb, onPractice }: { focus: string; onOpenVerb: (inf: string) => void; onPractice: (format: string, targets: string[]) => void }) {
  const cur = useQuery({ queryKey: ["language", "curriculum"], queryFn: getCurriculum, staleTime: Infinity });
  const [sprint, setSprint] = useState(0);
  if (cur.isLoading || !cur.data) return <p className="xp-muted">Loading…</p>;
  const verbs = cur.data.verbs.filter((v) => !sprint || v.sprint === sprint);
  return (
    <div className="flex flex-col gap-2">
      <div className="hub-filters">
        {[0, 1, 2, 3, 4].map((n) => (
          <button key={n} type="button" className={`hub-chip ${sprint === n ? "is-active" : ""}`} onClick={() => setSprint(n)}>
            {n === 0 ? "All 32" : `Sprint ${n}`}
          </button>
        ))}
        <span className="ml-auto flex gap-1">
          {verbs.map((v) => (
            <a key={v.id} className="xp-link" href={`#ref/core-verbs/${v.infinitive}`} onClick={(e) => (e.preventDefault(), document.getElementById(`ref-core-verbs-${v.infinitive}`)?.scrollIntoView())}>
              {v.infinitive}
            </a>
          ))}
        </span>
      </div>
      {verbs.map((v) => (
        <VerbCard key={v.id} v={v} highlight={focus === v.infinitive} onOpenVerb={onOpenVerb} onPractice={onPractice} />
      ))}
    </div>
  );
}

function VerbCard({ v, highlight, onOpenVerb, onPractice }: { v: CoreVerb; highlight: boolean; onOpenVerb: (inf: string) => void; onPractice: (format: string, targets: string[]) => void }) {
  return (
    <div id={`ref-core-verbs-${v.infinitive}`} className={`ref-verb ref-section ${highlight ? "is-target" : ""}`}>
      <div>
        <h4>
          <Speak language="fr" text={v.infinitive} label={v.infinitive} className="xp-link" /> <span className="xp-ipa xp-muted" style={{ fontWeight: 400, fontSize: 12 }}>{v.ipa}</span>
        </h4>
        <div style={{ fontSize: 12 }}>
          {v.spanish} <span className="xp-muted">· {v.english} · S{v.sprint} · {v.group}</span>
        </div>
        <table className="mt-1">
          <tbody>
            {PERSONS.map(([p, label]) => (
              <tr key={p}>
                <td className="xp-muted">{label}</td>
                <td>
                  <Speak language="fr" text={joinSubject(p, v.present[p])} label={v.present[p]} className="xp-link" />
                </td>
                <td className="xp-muted">{v.es_present[p]}</td>
              </tr>
            ))}
            <tr>
              <td className="xp-muted">pp</td>
              <td>
                {v.auxiliary === "être" ? "être" : "avoir"} + <b>{v.participle}</b>
              </td>
              <td className="xp-muted">{v.es_participle}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-1 flex gap-2" style={{ fontSize: 11 }}>
          <button type="button" className="xp-link" onClick={() => onOpenVerb(v.infinitive)}>
            [all tenses]
          </button>
          <button type="button" className="xp-link" onClick={() => onPractice("verb_drill", [v.infinitive])}>
            [drill]
          </button>
        </div>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.55 }}>
        <div>
          <b>Constructions</b>
          {v.constructions.map((c) => (
            <div key={c.fr}>
              {c.fr} <span className="xp-muted">↔ {c.es}</span>
            </div>
          ))}
        </div>
        <div className="mt-1">
          <b>Examples</b>
          {v.examples.map((e) => (
            <div key={e.fr}>
              <Speak language="fr" text={e.fr} label="►" /> {e.fr} <span className="xp-muted">- {e.es}</span>
            </div>
          ))}
        </div>
        {v.pronunciation && (
          <div className="mt-1">
            <b>Sound</b> <span className="xp-ipa">{v.pronunciation}</span>
          </div>
        )}
        {v.family && (
          <div className="xp-muted">
            family: {v.family}
          </div>
        )}
        {v.notes && <div className="mt-1">{v.notes}</div>}
      </div>
    </div>
  );
}

function InterferenceLog({ onPractice }: { onPractice: (format: string, targets: string[]) => void }) {
  const queryClient = useQueryClient();
  const [showResolved, setShowResolved] = useState(false);
  const [form, setForm] = useState({ error: "", correct: "", spanish_source: "", explanation: "" });
  const log = useQuery({ queryKey: ["language", "interference", showResolved], queryFn: () => listInterference(showResolved) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["language", "interference"] });
  const add = useMutation({ mutationFn: addInterference, onSuccess: () => (invalidate(), setForm({ error: "", correct: "", spanish_source: "", explanation: "" })) });
  const upd = useMutation({ mutationFn: ({ id, resolved }: { id: number; resolved: boolean }) => updateInterference(id, { resolved }), onSuccess: invalidate });
  const del = useMutation({ mutationFn: deleteInterference, onSuccess: invalidate });
  const rows = log.data ?? [];
  const [now] = useState(Date.now);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="xp-muted">{rows.length} entries · {rows.filter((r) => new Date(r.next_review).getTime() <= now).length} due</span>
        <label className="flex items-center gap-1">
          <input type="checkbox" className="xp-checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> resolved
        </label>
        <button type="button" className="xp-btn is-small ml-auto" onClick={() => onPractice("error_repair", [])}>
          Drill due
        </button>
      </div>
      <table className="xp-listview">
        <thead>
          <tr>
            <th>Error</th>
            <th>Correct</th>
            <th>Spanish source</th>
            <th>Why</th>
            <th style={{ width: 1 }}>seen</th>
            <th style={{ width: 1 }}>next</th>
            <th style={{ width: 1 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ opacity: r.resolved ? 0.6 : 1 }}>
              <td style={{ color: "#c4523a" }}>✗ {r.error}</td>
              <td>
                <b>{r.correct}</b> <Speak language="fr" text={r.correct} label="►" />
              </td>
              <td className="xp-muted">{r.spanish_source}</td>
              <td>{r.explanation}</td>
              <td className="xp-muted">{r.times_seen}</td>
              <td className="xp-muted" style={{ whiteSpace: "nowrap" }}>
                {new Date(r.next_review).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button type="button" className="xp-link mr-1" onClick={() => upd.mutate({ id: r.id, resolved: !r.resolved })}>
                  [{r.resolved ? "reopen" : "resolve"}]
                </button>
                <button type="button" className="xp-link" onClick={() => del.mutate(r.id)}>
                  [×]
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="xp-muted">
                Empty. Wrong answers with a known Spanish-interference shape land here automatically; add your own below.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <fieldset className="xp-group">
        <legend>Add</legend>
        <div className="flex flex-wrap gap-2">
          <input className="xp-input" style={{ width: 200 }} placeholder="✗ what I said" value={form.error} onChange={(e) => setForm({ ...form, error: e.target.value })} />
          <input className="xp-input" style={{ width: 200 }} placeholder="✓ correct" value={form.correct} onChange={(e) => setForm({ ...form, correct: e.target.value })} />
          <input className="xp-input" style={{ width: 160 }} placeholder="Spanish source" value={form.spanish_source} onChange={(e) => setForm({ ...form, spanish_source: e.target.value })} />
          <input className="xp-input" style={{ width: 240 }} placeholder="why (es)" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
          <button type="button" className="xp-btn" disabled={!form.error || !form.correct || add.isPending} onClick={() => add.mutate(form)}>
            Add
          </button>
        </div>
      </fieldset>
    </div>
  );
}
