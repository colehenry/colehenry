"use client";

import type { ChallengeWindow } from "@/lib/api/challenges";
import { fmtDate } from "@/lib/challenges";

/**
 * The run at a glance: eleven three-week windows as a punch card.
 * purple = met, amber = the live window, destructive = closed empty,
 * outline = not open yet. A count > 1 is printed in the cell — extra
 * completions never carry forward, so the number stays with its window.
 */
export function WindowStrip({
  windows,
  finish,
}: {
  windows: ChallengeWindow[];
  finish: string;
}) {
  return (
    <div>
      <div className="flex gap-1.5" role="img" aria-label={stripLabel(windows)}>
        {windows.map((w) => (
          <div
            key={w.index}
            title={`Window ${w.index} · ${fmtDate(w.start)} – ${fmtDate(w.end)} · ${w.status}`}
            className={
              "flex h-9 flex-1 items-center justify-center rounded-md border font-mono text-[10px] transition-colors " +
              cellClass(w.status)
            }
          >
            {w.status === "met" && w.count > 1 && w.count}
            {w.status === "missed" && "×"}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        <span>{fmtDate(windows[0].end)}</span>
        <span>{fmtDate(finish)}</span>
      </div>
    </div>
  );
}

function cellClass(status: ChallengeWindow["status"]): string {
  switch (status) {
    case "met":
      return "border-brand bg-brand text-brand-contrast";
    case "current":
      return "border-brand-2 bg-brand-2/10 shadow-[inset_0_0_0_1px] shadow-brand-2/40";
    case "missed":
      return "border-destructive bg-destructive/80 text-white";
    default:
      return "border-border bg-card";
  }
}

function stripLabel(windows: ChallengeWindow[]): string {
  const met = windows.filter((w) => w.status === "met").length;
  const missed = windows.filter((w) => w.status === "missed").length;
  return `${met} of 11 windows met${missed ? `, ${missed} missed` : ""}`;
}
