"use client";

// Vocabulary: curriculum + mined items with status (core / recognition /
// encountered) and per-dimension mastery. Bulk JSON import lives here.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { importVocab, listVocab, setVocabStatus, type VocabItem } from "@/lib/api/learning";
import { Speak } from "./language-shared";

const DIMS: [keyof VocabItem, string][] = [
  ["recognition", "rec"],
  ["audio_recognition", "ear"],
  ["written_production", "write"],
  ["contextual_use", "ctx"],
];

const IMPORT_EXAMPLE = `[
  {"id": "fr_vouloir", "french": "vouloir", "spanish": "querer", "english": "to want", "part_of_speech": "verb",
   "ipa": "/vulwaʁ/", "sprint": 2, "priority": 1, "status": "core", "frequency_band": "very_high",
   "example_fr": "Je veux partir.", "example_es": "Quiero irme.", "pattern": "vouloir + infinitif",
   "spanish_connection": "querer + infinitivo", "pronunciation_warning": null, "false_friend": false, "reference_links": []}
]`;

export function VocabView({ activeSprint, onPractice, onOpenRef }: { activeSprint: number; onPractice: (targets: string[], format: string) => void; onOpenRef: (ref: string) => void }) {
  const queryClient = useQueryClient();
  const [sprint, setSprint] = useState<number | 0>(activeSprint);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");

  const vocab = useQuery({
    queryKey: ["language", "vocab", sprint, status, q],
    queryFn: () => listVocab({ sprint: sprint || undefined, status: status || undefined, q: q || undefined }),
  });
  const setStatusM = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "core" | "recognition" | "encountered" }) => setVocabStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["language", "vocab"] });
      queryClient.invalidateQueries({ queryKey: ["language", "decks"] });
      queryClient.invalidateQueries({ queryKey: ["language", "dashboard"] });
    },
  });
  const importM = useMutation({
    mutationFn: (items: unknown[]) => importVocab(items),
    onSuccess: (r) => {
      setImportMsg(`${r.created} created · ${r.updated} updated · ${r.cards_created} cards`);
      queryClient.invalidateQueries({ queryKey: ["language"] });
    },
    onError: (e: Error) => setImportMsg(e.message),
  });

  const rows = useMemo(() => vocab.data ?? [], [vocab.data]);
  const counts = useMemo(() => {
    const c = { core: 0, recognition: 0, encountered: 0, known: 0, productive: 0 };
    for (const r of rows) {
      c[r.status as keyof typeof c] += 1;
      if (r.recognition >= 0.75) c.known += 1;
      if (r.written_production >= 0.6) c.productive += 1;
    }
    return c;
  }, [rows]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="xp-label mb-0">Sprint</label>
        <select className="xp-select" value={sprint} onChange={(e) => setSprint(Number(e.target.value))}>
          <option value={0}>All</option>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <label className="xp-label mb-0">Status</label>
        <select className="xp-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="core">Core</option>
          <option value="recognition">Recognition</option>
          <option value="encountered">Encountered</option>
        </select>
        <input className="xp-input" style={{ width: 180 }} placeholder="search fr / es / en" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="xp-muted ml-auto">
          {rows.length} · core {counts.core} · rec {counts.recognition} · enc {counts.encountered} · known {counts.known} · productive {counts.productive}
        </span>
        <button type="button" className="xp-btn is-small" onClick={() => onPractice(rows.filter((r) => r.status === "core").slice(0, 40).map((r) => r.curriculum_id ?? `v:${r.id}`), "es_to_fr")}>
          Drill ES→FR
        </button>
        <button type="button" className="xp-btn is-small" onClick={() => setImportOpen((o) => !o)}>
          Import JSON
        </button>
      </div>

      {importOpen && (
        <fieldset className="xp-group flex flex-col gap-2">
          <legend>Bulk import</legend>
          <textarea className="xp-textarea" style={{ minHeight: 120, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 11 }} placeholder={IMPORT_EXAMPLE} value={importText} onChange={(e) => setImportText(e.target.value)} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="xp-btn is-default"
              disabled={importM.isPending}
              onClick={() => {
                try {
                  const parsed = JSON.parse(importText);
                  importM.mutate(Array.isArray(parsed) ? parsed : parsed.items ?? [parsed]);
                } catch (e) {
                  setImportMsg((e as Error).message);
                }
              }}
            >
              Import
            </button>
            <span className="xp-muted">{importMsg || "Array of items in the curriculum shape (id optional). Existing ids update in place."}</span>
          </div>
        </fieldset>
      )}

      <div className="overflow-x-auto border" style={{ borderColor: "var(--xp-well-border)" }}>
        <table className="xp-listview">
          <thead>
            <tr>
              <th style={{ width: 1 }} />
              <th>French</th>
              <th>Spanish</th>
              <th>pos</th>
              <th style={{ width: 1 }}>S</th>
              <th>Status</th>
              {DIMS.map(([, l]) => (
                <th key={l} style={{ width: 52 }}>
                  {l}
                </th>
              ))}
              <th style={{ width: 1 }}>n</th>
            </tr>
          </thead>
          <tbody>
            {vocab.isLoading && (
              <tr>
                <td colSpan={11} className="xp-muted">
                  Loading…
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <RowGroup key={r.id} r={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} onStatus={(s) => setStatusM.mutate({ id: r.id, status: s })} onOpenRef={onOpenRef} onDrill={() => onPractice([r.curriculum_id ?? `v:${r.id}`], "es_to_fr")} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowGroup({
  r,
  open,
  onToggle,
  onStatus,
  onOpenRef,
  onDrill,
}: {
  r: VocabItem;
  open: boolean;
  onToggle: () => void;
  onStatus: (s: "core" | "recognition" | "encountered") => void;
  onOpenRef: (ref: string) => void;
  onDrill: () => void;
}) {
  return (
    <>
      <tr className="is-clickable" onClick={onToggle}>
        <td>
          <Speak language="fr" text={r.french.split(" / ")[0]} label="►" />
        </td>
        <td style={{ fontWeight: 700 }}>
          {r.french}
          {r.gender && <span className="xp-muted"> ({r.gender})</span>}
          {r.false_friend && <span title="faux ami"> ⚠</span>}
        </td>
        <td>{r.spanish}</td>
        <td className="xp-muted">{r.part_of_speech}</td>
        <td className="xp-muted">{r.sprint}</td>
        <td onClick={(e) => e.stopPropagation()}>
          <select className="xp-select vocab-status" value={r.status} onChange={(e) => onStatus(e.target.value as "core" | "recognition" | "encountered")}>
            <option value="core">core</option>
            <option value="recognition">recognition</option>
            <option value="encountered">encountered</option>
          </select>
        </td>
        {DIMS.map(([k]) => {
          const v = Number(r[k] ?? 0);
          return (
            <td key={String(k)} title={`${Math.round(v * 100)}%`}>
              <span className={`hub-bar is-mini ${v >= 0.75 ? "is-strong" : v > 0 && v < 0.4 ? "is-weak" : ""}`}>
                <i style={{ width: `${Math.round(v * 100)}%` }} />
              </span>
            </td>
          );
        })}
        <td className="xp-muted">{r.attempts}</td>
      </tr>
      {open && (
        <tr>
          <td />
          <td colSpan={10} style={{ fontSize: 12, lineHeight: 1.6 }}>
            <span className="xp-ipa">{r.ipa}</span>
            {r.english && <span className="xp-muted"> · {r.english}</span>}
            {r.example_fr && (
              <div>
                <Speak language="fr" text={r.example_fr} label="►" /> {r.example_fr} <span className="xp-muted">- {r.example_es}</span>
              </div>
            )}
            {r.pattern && <div className="xp-muted">pattern: {r.pattern}</div>}
            {r.spanish_connection && <div>ES: {r.spanish_connection}</div>}
            {r.pronunciation_warning && <div>⚠ {r.pronunciation_warning}</div>}
            <div className="mt-1 flex flex-wrap gap-2">
              {(r.reference_links as string[]).map((ref) => (
                <button key={ref} type="button" className="xp-link" onClick={() => onOpenRef(ref)}>
                  [{ref}]
                </button>
              ))}
              <button type="button" className="xp-link" onClick={onDrill}>
                [drill]
              </button>
              <span className="xp-muted">{r.source}{r.frequency_band ? ` · ${r.frequency_band}` : ""} · priority {r.priority}</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
