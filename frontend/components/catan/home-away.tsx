"use client";

import { useMemo } from "react";

import type { CatanGameSummary } from "@/lib/api/catan";
import { CHART_ORDER } from "@/components/catan/colors";
import { PlayerMark } from "@/components/catan/player-mark";
import { cn } from "@/lib/utils";

const LOCATIONS = ["Redcliff", "Mariposa"] as const;

/** Where each regular sleeps - their table is the shaded column. */
const HOME: Record<string, (typeof LOCATIONS)[number]> = {
  cole: "Redcliff",
  aditya: "Redcliff",
  jaren: "Mariposa",
  dan: "Mariposa",
  allen: "Mariposa",
};

type Tally = { wins: number; games: number };

export function HomeAway({ games }: { games: CatanGameSummary[] }) {
  const tallies = useMemo(() => {
    const map = new Map<string, Tally>();
    for (const name of CHART_ORDER)
      for (const loc of LOCATIONS) map.set(`${name}|${loc}`, { wins: 0, games: 0 });
    for (const game of games) {
      if (!LOCATIONS.includes(game.location as (typeof LOCATIONS)[number])) continue;
      for (const name of game.player_names) {
        const tally = map.get(`${name}|${game.location}`);
        if (!tally) continue;
        tally.games += 1;
        if (game.winner === name) tally.wins += 1;
      }
    }
    return map;
  }, [games]);

  return (
    <div>
      <table className="w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <td />
            {LOCATIONS.map((loc) => (
              <th
                key={loc}
                className="pb-1 text-center font-mono text-[9px] font-normal uppercase tracking-wider text-muted-foreground"
              >
                {loc}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CHART_ORDER.map((name) => (
            <tr key={name}>
              <th
                className="pr-2 text-left font-mono text-[9px] font-normal uppercase tracking-wider text-muted-foreground"
                title={name}
              >
                <span className="inline-flex items-center gap-1.5">
                  <PlayerMark name={name} className="size-3.5" />
                  {name.slice(0, 3)}
                </span>
              </th>
              {LOCATIONS.map((loc) => {
                const tally = tallies.get(`${name}|${loc}`)!;
                const home = HOME[name.toLowerCase()] === loc;
                return (
                  <td
                    key={loc}
                    title={`${name} - ${tally.wins} wins in ${tally.games} games at ${loc}${home ? " (home board)" : ""}`}
                    className={cn(
                      "rounded-md border border-border/60 py-2 text-center font-mono text-xs",
                      home && "border-brand/30 bg-brand/8",
                      tally.games === 0 && "text-muted-foreground",
                    )}
                  >
                    {tally.games === 0 ? (
                      "-"
                    ) : (
                      <>
                        <span className="font-semibold">{tally.wins}</span>
                        <span className="text-muted-foreground">/{tally.games}</span>
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
