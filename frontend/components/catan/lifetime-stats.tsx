"use client";

import type { CatanDashboard } from "@/lib/api/catan";
import { formatDay, formatPct } from "@/components/catan/format";
import { PlayerMark } from "@/components/catan/player-mark";
import { ResourceIcon, type ResourceName } from "@/components/catan/resource-icon";

/** Join tied leaders: "Cole + Jaren". */
function leaders<T>(rows: T[], value: (row: T) => number, name: (row: T) => string) {
  const best = Math.max(0, ...rows.map(value));
  if (best === 0) return { names: [], value: 0 };
  return { names: rows.filter((r) => value(r) === best).map(name), value: best };
}

type Entry = {
  icon: ResourceName;
  label: string;
  value: string;
  names: string[];
  detail: string;
};

/**
 * Almanac strip — a rule-bound line of records, not a row of cards.
 */
export function LifetimeStats({ data }: { data: CatanDashboard }) {
  const rows = data.leaderboard;
  const lastGame = data.timeline[data.timeline.length - 1];

  const mostWins = leaders(rows, (r) => r.wins, (r) => r.name);
  const bestPct = leaders(rows, (r) => r.win_pct, (r) => r.name);
  const roads = leaders(rows, (r) => r.longest_count, (r) => r.name);
  const armies = leaders(rows, (r) => r.largest_count, (r) => r.name);

  const entries: Entry[] = [
    {
      icon: "hex",
      label: "games",
      value: String(data.total_games),
      names: [],
      detail: data.first_game ? `since ${formatDay(data.first_game, true)}` : "",
    },
    {
      icon: "brick",
      label: "most wins",
      value: String(mostWins.value),
      names: mostWins.names,
      detail: mostWins.names.join(" + "),
    },
    {
      icon: "wheat",
      label: "best win rate",
      value: formatPct(bestPct.value),
      names: bestPct.names,
      detail: bestPct.names.join(" + "),
    },
    {
      icon: "crown",
      label: "last winner",
      value: lastGame?.winner ?? "—",
      names: lastGame?.winner ? [lastGame.winner] : [],
      detail: lastGame ? formatDay(lastGame.played_at) : "",
    },
    {
      icon: "road",
      label: "longest roads",
      value: String(roads.value),
      names: roads.names,
      detail: roads.names.join(" + "),
    },
    {
      icon: "shield",
      label: "largest armies",
      value: String(armies.value),
      names: armies.names,
      detail: armies.names.join(" + "),
    },
  ];

  return (
    <dl className="reveal grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-5 sm:grid-cols-3 xl:grid-cols-6"
      style={{ "--reveal-i": 3 } as React.CSSProperties}
    >
      {entries.map((entry) => (
        <div key={entry.label} className="min-w-0 text-center">
          <dt className="flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            <ResourceIcon name={entry.icon} className="size-3.5 text-brand" />
            {entry.label}
          </dt>
          <dd className="mt-1.5">
            <p className="font-heading text-3xl font-medium tracking-tight">
              {entry.value}
            </p>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              {entry.names.map((n) => (
                <PlayerMark key={n} name={n} className="size-3" />
              ))}
              <span className="truncate">{entry.detail || " "}</span>
            </p>
          </dd>
        </div>
      ))}
    </dl>
  );
}
