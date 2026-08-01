"use client";

import type { CatanPerformanceSpotlight } from "@/lib/api/catan";
import { formatDay } from "@/components/catan/format";
import { PlayerMark } from "@/components/catan/player-mark";
import { cn } from "@/lib/utils";

export function PerformanceTable({
  rows,
  onOpen,
}: {
  rows: CatanPerformanceSpotlight[];
  onOpen: (id: number) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        No entries
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {["#", "Player", "VP", "Game", "Winner"].map((label, i) => (
              <th
                key={label}
                className={cn(
                  "px-2 py-2 text-left font-mono text-[9px] font-normal uppercase tracking-[0.15em] text-muted-foreground",
                  i === 0 && "pl-3",
                  i === 2 && "text-center",
                  i === 4 && "hidden sm:table-cell",
                )}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.game_id}-${row.player_name}-${i}`}
              onClick={() => onOpen(row.game_id)}
              className={cn(
                "cursor-pointer transition-colors hover:bg-accent",
                i > 0 && "border-t border-border/60",
              )}
            >
              <td className="w-8 px-2 py-2.5 pl-3 font-mono text-xs text-muted-foreground">
                {i + 1}
              </td>
              <td className="min-w-0 px-2 py-2.5">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <PlayerMark name={row.player_name} className="size-4 shrink-0" />
                  <span className="truncate">{row.player_name}</span>
                </span>
              </td>
              <td className="w-12 px-2 py-2.5 text-center font-mono text-xs">
                {row.victory_points ?? "-"}
              </td>
              <td className="px-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {formatDay(row.played_at, true)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.location || "-"}
                  </p>
                </div>
              </td>
              <td className="hidden px-2 py-2.5 pr-3 sm:table-cell">
                <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <PlayerMark name={row.winner ?? ""} className="size-3.5 shrink-0" />
                  <span className="truncate">{row.winner ?? "-"}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
