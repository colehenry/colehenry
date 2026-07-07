"use client";

import { useState } from "react";
import { ArrowDown } from "lucide-react";

import type { LeaderboardRow } from "@/lib/api/catan";
import { playerColor } from "@/components/catan/colors";
import { formatDay, formatPct } from "@/components/catan/format";
import { PlayerMark } from "@/components/catan/player-mark";
import { ResourceIcon } from "@/components/catan/resource-icon";
import { cn } from "@/lib/utils";

export type Robber = { name: string; drought: number };

type SortKey =
  | "win_pct"
  | "wins"
  | "games"
  | "avg_vp"
  | "longest_count"
  | "largest_count";

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: "games", label: "Games", title: "Games played" },
  { key: "wins", label: "Wins", title: "Wins" },
  { key: "win_pct", label: "Win %", title: "Win percentage" },
  { key: "avg_vp", label: "Avg VP", title: "Average victory points" },
  { key: "longest_count", label: "Longest", title: "Longest road count" },
  { key: "largest_count", label: "Largest", title: "Largest army count" },
];

export function CatanLeaderboard({
  rows,
  robber,
}: {
  rows: LeaderboardRow[];
  robber?: Robber | null;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("win_pct");

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? -1;
    const bv = b[sortKey] ?? -1;
    if (bv !== av) return (bv as number) - (av as number);
    return b.win_pct - a.win_pct || a.name.localeCompare(b.name);
  });
  const maxPct = Math.max(...rows.map((r) => r.win_pct), 0.0001);

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-3 py-2.5 text-left font-mono text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground sm:px-4">
              Player
            </th>
            {COLUMNS.map((col) => (
              <th key={col.key} className="px-2 py-2.5 text-center sm:px-3">
                <button
                  onClick={() => setSortKey(col.key)}
                  title={`Sort by ${col.title.toLowerCase()}`}
                  className={cn(
                    "inline-flex items-center gap-0.5 font-mono text-[10px] font-normal uppercase tracking-[0.15em] transition-colors",
                    sortKey === col.key
                      ? "text-brand"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {col.label}
                  <ArrowDown
                    className={cn(
                      "size-3 transition-opacity",
                      sortKey === col.key ? "opacity-100" : "opacity-0",
                    )}
                  />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.player_id}
              className={cn(
                "transition-colors hover:bg-accent",
                i > 0 && "border-t border-border/60",
              )}
            >
              <td className="px-3 py-2.5 sm:px-4">
                <div className="flex items-center gap-2.5">
                  <PlayerMark name={row.name} className="size-4" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium">
                      {row.name}
                      {robber?.name === row.name && (
                        <span className="group relative inline-flex" tabIndex={0}>
                          <ResourceIcon
                            name="robber"
                            className="size-3.5 text-muted-foreground"
                            aria-label="the robber"
                          />
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden w-max max-w-[240px] -translate-y-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs font-normal text-popover-foreground shadow-sm group-hover:block group-focus-visible:block"
                          >
                            The robber camps on the coldest player —{" "}
                            {robber.drought} games since their last win.
                          </span>
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {row.last_win
                        ? `last win ${formatDay(row.last_win)}`
                        : "no wins yet"}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-2 py-2.5 text-center font-mono text-xs sm:px-3">
                {row.games}
              </td>
              <td className="px-2 py-2.5 text-center font-mono text-xs sm:px-3">
                {row.wins}
              </td>
              <td className="px-2 py-2.5 text-center sm:px-3">
                <div className="inline-flex flex-col items-center gap-1">
                  <span className="font-mono text-xs font-medium">
                    {formatPct(row.win_pct)}
                  </span>
                  <span className="block h-1 w-12 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${(row.win_pct / maxPct) * 100}%`,
                        background: playerColor(row.name),
                      }}
                    />
                  </span>
                </div>
              </td>
              <td className="px-2 py-2.5 text-center font-mono text-xs sm:px-3">
                {row.avg_vp ?? "—"}
              </td>
              <td className="px-2 py-2.5 text-center font-mono text-xs sm:px-3">
                {row.longest_count}
              </td>
              <td className="px-2 py-2.5 text-center font-mono text-xs sm:px-3">
                {row.largest_count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
