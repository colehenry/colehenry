"use client";

import { useMemo } from "react";

import type { CatanGameSummary } from "@/lib/api/catan";
import { CHART_ORDER, playerColor } from "@/components/catan/colors";
import { PlayerMark } from "@/components/catan/player-mark";
import { cn } from "@/lib/utils";

type Record_ = { wins: number; losses: number; shared: number };

/**
 * Pairwise records among the dashboard crew: reading across a row, each cell
 * is that player's game wins vs the column player in games they both played.
 */
export function HeadToHead({ games }: { games: CatanGameSummary[] }) {
  const records = useMemo(() => {
    const map = new Map<string, Record_>();
    const key = (a: string, b: string) => `${a}|${b}`;
    for (const a of CHART_ORDER)
      for (const b of CHART_ORDER)
        if (a !== b) map.set(key(a, b), { wins: 0, losses: 0, shared: 0 });
    for (const game of games) {
      const crew = game.player_names.filter((n) => CHART_ORDER.includes(n));
      for (const a of crew)
        for (const b of crew) {
          if (a === b) continue;
          const rec = map.get(key(a, b))!;
          rec.shared += 1;
          if (game.winner === a) rec.wins += 1;
          if (game.winner === b) rec.losses += 1;
        }
    }
    return map;
  }, [games]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] border-separate border-spacing-1">
        <thead>
          <tr>
            <td />
            {CHART_ORDER.map((name) => (
              <th key={name} className="pb-1 text-center" title={name}>
                <span className="inline-flex flex-col items-center gap-1">
                  <PlayerMark name={name} className="size-3.5" />
                  <span className="font-mono text-[9px] font-normal uppercase tracking-wider text-muted-foreground">
                    {name.slice(0, 3)}
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CHART_ORDER.map((row) => (
            <tr key={row}>
              <th
                className="pr-2 text-left font-mono text-[9px] font-normal uppercase tracking-wider text-muted-foreground"
                title={row}
              >
                <span className="inline-flex items-center gap-1.5">
                  <PlayerMark name={row} className="size-3.5" />
                  {row.slice(0, 3)}
                </span>
              </th>
              {CHART_ORDER.map((col) => {
                if (row === col)
                  return (
                    <td key={col} className="rounded-md bg-muted/50 py-2 text-center">
                      <PlayerMark name={row} className="mx-auto size-3.5 opacity-50" />
                    </td>
                  );
                const rec = records.get(`${row}|${col}`)!;
                const leader =
                  rec.wins > rec.losses ? row : rec.losses > rec.wins ? col : null;
                return (
                  <td
                    key={col}
                    title={`${row} ${rec.wins} – ${rec.losses} ${col} · ${rec.shared} games together`}
                    className={cn(
                      "rounded-md border border-border/60 py-2 text-center font-mono text-xs",
                      rec.shared === 0 && "text-muted-foreground",
                    )}
                    style={
                      leader
                        ? {
                            background: `color-mix(in srgb, ${playerColor(leader)} 14%, transparent)`,
                          }
                        : undefined
                    }
                  >
                    {rec.shared === 0 ? (
                      "-"
                    ) : (
                      <>
                        <span className={cn(leader === row && "font-semibold")}>
                          {rec.wins}
                        </span>
                        <span className="text-muted-foreground">–</span>
                        <span className={cn(leader === col && "font-semibold")}>
                          {rec.losses}
                        </span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
