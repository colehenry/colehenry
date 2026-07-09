"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, GripVertical, Maximize2, Minimize2 } from "lucide-react";

import {
  completeChallenge,
  getChallengeDashboard,
  resetChallenges,
  setChallengeOrder,
  setVideoIdeas,
  uncompleteChallenge,
  type ChallengeDashboard,
  type ChallengeWindow,
} from "@/lib/api/challenges";
import { CHALLENGES_BY_ID, fmtDate } from "@/lib/challenges";
import { WindowStrip } from "@/components/challenges/window-strip";
import { Button } from "@/components/ui/button";

const QUERY_KEY = ["challenges", "dashboard"];

/** Window a completion date landed in — completions only count there. */
function windowFor(date: string, windows: ChallengeWindow[]): number | null {
  for (const w of windows) if (date <= w.end) return w.index;
  return null; // post-window tail before the finish date
}

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Live geometry for a drag: where each row sits (page coords) and the grab point. */
type DragGeometry = {
  grabOffset: number; // pointer offset inside the picked-up row
  pointerY: number; // last pointer position, page coords
  tops: Map<number, number>;
  heights: Map<number, number>;
};

const LIFT = "scale(1.03)";

export function ChallengesPage() {
  const queryClient = useQueryClient();
  const dashboard = useQuery({ queryKey: QUERY_KEY, queryFn: getChallengeDashboard });

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [confirmReset, setConfirmReset] = useState(false);

  // Drag state: draftOrder overrides the server order while a drag is live.
  const [draftOrder, setDraftOrder] = useState<number[] | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const rowRefs = useRef<Record<number, HTMLLIElement | null>>({});
  const draftRef = useRef<number[] | null>(null);
  draftRef.current = draftOrder;
  const geom = useRef<DragGeometry | null>(null);

  const applyServer = (data: ChallengeDashboard) =>
    queryClient.setQueryData(QUERY_KEY, data);

  const orderMutation = useMutation({
    mutationFn: setChallengeOrder,
    onSuccess: applyServer,
    onSettled: () => setDraftOrder(null),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      done ? uncompleteChallenge(id) : completeChallenge(id),
    onSuccess: applyServer,
  });

  const resetMutation = useMutation({
    mutationFn: resetChallenges,
    onSuccess: (data) => {
      applyServer(data);
      setConfirmReset(false);
    },
  });

  /** Pin the picked-up row under the pointer, lifted and slightly grown. */
  const positionDragged = (id: number) => {
    const el = rowRefs.current[id];
    const g = geom.current;
    if (!el || !g) return;
    const layoutTop = g.tops.get(id) ?? 0;
    el.style.transform = `translateY(${g.pointerY - g.grabOffset - layoutTop}px) ${LIFT}`;
  };

  // Pointer drag: the picked-up row follows the pointer; crossing a row's
  // midpoint reorders the draft, and the layout effect below glides the
  // neighbors into their new slots.
  useEffect(() => {
    if (dragId == null) return;
    const move = (e: PointerEvent) => {
      const g = geom.current;
      if (!g) return;
      g.pointerY = e.pageY;
      positionDragged(dragId);
      const ids = draftRef.current ?? [];
      let target = ids.length - 1;
      for (let i = 0; i < ids.length; i++) {
        const top = g.tops.get(ids[i]);
        const height = g.heights.get(ids[i]) ?? 0;
        if (top != null && g.pointerY < top + height / 2) {
          target = i;
          break;
        }
      }
      setDraftOrder((prev) => {
        const cur = prev ?? [];
        const from = cur.indexOf(dragId);
        if (from === -1 || from === target) return prev;
        const next = cur.slice();
        next.splice(target, 0, ...next.splice(from, 1));
        return next;
      });
    };
    const up = () => {
      const el = rowRefs.current[dragId];
      if (el) {
        // settle: shrink back and drop into the slot it's already laid out in
        const lifted = el.style.transform;
        el.style.transform = "";
        if (lifted && !prefersReducedMotion()) {
          const settle = el.animate(
            [{ transform: lifted }, { transform: "translateY(0) scale(1)" }],
            { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
          );
          settle.onfinish = () => {
            el.style.zIndex = "";
          };
        } else {
          el.style.zIndex = "";
        }
      }
      geom.current = null;
      setDragId(null);
      document.body.style.userSelect = "";
      const final = draftRef.current;
      if (final) orderMutation.mutate(final);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // orderMutation is stable (useMutation), safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId]);

  // FLIP: after a reorder, measure the new layout and animate every other row
  // from where it was to where it now sits. Runs before paint, so no flicker.
  useLayoutEffect(() => {
    const g = geom.current;
    if (dragId == null || !g || !draftOrder) return;
    const dragEl = rowRefs.current[dragId];
    if (dragEl) dragEl.style.transform = ""; // measure layout, not the lift
    const prevTops = new Map(g.tops);
    const scrollY = window.scrollY;
    for (const id of draftOrder) {
      const el = rowRefs.current[id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      g.tops.set(id, r.top + scrollY);
      g.heights.set(id, r.height);
    }
    const reduce = prefersReducedMotion();
    for (const id of draftOrder) {
      if (id === dragId) continue;
      const el = rowRefs.current[id];
      const from = prevTops.get(id);
      const to = g.tops.get(id);
      if (!el || from == null || to == null || from === to) continue;
      if (!reduce)
        el.animate(
          [{ transform: `translateY(${from - to}px)` }, { transform: "translateY(0)" }],
          { duration: 160, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
    }
    positionDragged(dragId);
    // positionDragged reads refs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftOrder, dragId]);

  const data = dashboard.data;
  const ordering = draftOrder ?? data?.ordering ?? [];

  const startDrag = (e: React.PointerEvent, id: number) => {
    e.preventDefault();
    document.body.style.userSelect = "none";
    setDraftOrder(ordering);
    const tops = new Map<number, number>();
    const heights = new Map<number, number>();
    const scrollY = window.scrollY;
    for (const rid of ordering) {
      const el = rowRefs.current[rid];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      tops.set(rid, r.top + scrollY);
      heights.set(rid, r.height);
    }
    geom.current = {
      grabOffset: e.pageY - (tops.get(id) ?? e.pageY),
      pointerY: e.pageY,
      tops,
      heights,
    };
    setDragId(id);
    const el = rowRefs.current[id];
    if (el) {
      // pick up: grow into the lift
      el.style.zIndex = "10";
      el.style.transform = LIFT;
      if (!prefersReducedMotion())
        el.animate([{ transform: "scale(1)" }, { transform: LIFT }], {
          duration: 120,
          easing: "ease-out",
        });
    }
  };

  /** Keyboard fallback for the drag handle: arrow keys move the row. */
  const nudge = (id: number, delta: -1 | 1) => {
    const from = ordering.indexOf(id);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= ordering.length) return;
    const next = ordering.slice();
    next.splice(to, 0, ...next.splice(from, 1));
    setDraftOrder(next);
    orderMutation.mutate(next);
  };

  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  if (dashboard.isLoading) {
    return (
      <Shell>
        <p className="mt-16 font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
          Loading…
        </p>
      </Shell>
    );
  }
  if (dashboard.isError || !data) {
    return (
      <Shell>
        <p className="mt-16 text-sm text-muted-foreground">
          Couldn&apos;t load. Refresh, or sign in again.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mt-8">
        <WindowStrip windows={data.windows} finish={data.finish} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* the 25, in order */}
        <div>
          <ol className="space-y-2">
            {ordering.map((id, position) => {
              const challenge = CHALLENGES_BY_ID.get(id);
              if (!challenge) return null;
              const completedAt = data.completions[String(id)];
              const done = completedAt != null;
              const open = expanded.has(id);
              const stampWindow = done ? windowFor(completedAt, data.windows) : null;
              return (
                <li
                  key={id}
                  ref={(el) => {
                    rowRefs.current[id] = el;
                  }}
                  className={
                    "relative flex items-stretch overflow-hidden rounded-lg border bg-card " +
                    (done ? "border-brand/40 shadow-[inset_3px_0_0] shadow-brand " : "") +
                    (dragId === id ? "shadow-xl ring-1 ring-brand/40" : "")
                  }
                >
                  <button
                    type="button"
                    aria-label={`Reorder ${challenge.title} — arrow keys move it`}
                    className="flex w-9 shrink-0 cursor-grab touch-none items-center justify-center border-r text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
                    onPointerDown={(e) => startDrag(e, id)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp") (e.preventDefault(), nudge(id, -1));
                      if (e.key === "ArrowDown") (e.preventDefault(), nudge(id, 1));
                    }}
                  >
                    <GripVertical className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-3 px-3.5 py-3 text-left"
                    aria-expanded={open}
                    onClick={() => toggleExpand(id)}
                  >
                    <span className="w-5 pt-0.5 font-mono text-xs text-muted-foreground/60">
                      {String(position + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={
                          "block text-[15px] leading-snug font-medium " +
                          (done ? "text-muted-foreground" : "")
                        }
                      >
                        {challenge.title}
                      </span>
                      {done && (
                        <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-brand">
                          {fmtDate(completedAt)}
                          {stampWindow != null && ` · W${stampWindow}`}
                        </span>
                      )}
                      {open && (
                        <span className="mt-2 block text-[13.5px] leading-relaxed text-muted-foreground">
                          {challenge.desc}
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      className={
                        "mt-1 size-4 shrink-0 text-muted-foreground/50 transition-transform " +
                        (open ? "rotate-180" : "")
                      }
                    />
                  </button>
                  <button
                    type="button"
                    className="flex w-12 shrink-0 items-center justify-center border-l"
                    aria-pressed={done}
                    aria-label={done ? `Mark ${challenge.title} not done` : `Mark ${challenge.title} done`}
                    onClick={() => toggleMutation.mutate({ id, done })}
                  >
                    <span
                      className={
                        "flex size-6 items-center justify-center rounded-md border transition-colors " +
                        (done
                          ? "border-brand bg-brand text-brand-contrast"
                          : "border-border text-transparent hover:border-muted-foreground/50")
                      }
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* footer: total progress + reset */}
          <div className="mt-10 border-t pt-5">
            <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <span>{data.completed_count} / 25</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full border bg-muted">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500"
                style={{ width: `${(data.completed_count / 25) * 100}%` }}
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              {confirmReset ? (
                <>
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-brand-2">
                    Clear all completions?
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => resetMutation.mutate()}
                    disabled={resetMutation.isPending}
                  >
                    Yes, clear them
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <button
                  type="button"
                  className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground/60 hover:text-muted-foreground"
                  onClick={() => setConfirmReset(true)}
                >
                  Reset progress
                </button>
              )}
            </div>
          </div>
        </div>

        {/* video ideas notepad */}
        <VideoIdeas initial={data.video_ideas} onSaved={applyServer} />
      </div>
    </Shell>
  );
}

/** Shared page chrome: section skin, grid texture, heading. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div data-section="challenges">
      <div className="bg-grid absolute inset-x-0 top-14 h-72" aria-hidden />
      <div className="relative mx-auto w-full max-w-5xl px-4 pt-16 pb-24 sm:px-6">
        <h1
          className="reveal text-4xl font-medium tracking-tight sm:text-5xl"
          style={{ "--reveal-i": 0 } as React.CSSProperties}
        >
          The 25
        </h1>
        <div className="reveal" style={{ "--reveal-i": 1 } as React.CSSProperties}>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Free-form notepad, autosaved to the DB a moment after typing stops.
 * Compact by default; the corner button grows it.
 */
function VideoIdeas({
  initial,
  onSaved,
}: {
  initial: string;
  onSaved: (data: ChallengeDashboard) => void;
}) {
  const [text, setText] = useState(initial);
  const [big, setBig] = useState(false);
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);

  const save = useMutation({
    mutationFn: setVideoIdeas,
    onSuccess: (data) => {
      onSaved(data);
      setDirty(false);
    },
  });

  const onChange = (value: string) => {
    setText(value);
    setDirty(true);
    pending.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pending.current = null;
      save.mutate(value);
    }, 800);
  };

  // Flush a pending edit when leaving the page instead of dropping it.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current != null) save.mutate(pending.current);
    },
    // save is stable (useMutation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <aside className="lg:sticky lg:top-20 lg:self-start">
      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-3.5 py-2.5">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Video Ideas
          </h2>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/50">
              {save.isPending || dirty ? "saving…" : "saved"}
            </span>
            <button
              type="button"
              aria-label={big ? "Shrink editor" : "Expand editor"}
              className="text-muted-foreground/50 hover:text-muted-foreground"
              onClick={() => setBig((b) => !b)}
            >
              {big ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type here…"
          spellCheck={false}
          className={
            "block w-full resize-none bg-transparent px-3.5 py-3 text-sm leading-relaxed outline-none transition-[height] placeholder:text-muted-foreground/40 " +
            (big ? "h-[70vh]" : "h-44")
          }
        />
      </section>
    </aside>
  );
}
