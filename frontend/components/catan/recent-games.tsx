"use client";

import { StickyNote } from "lucide-react";

import type { CatanGameSummary } from "@/lib/api/catan";
import { playerColor } from "@/components/catan/colors";
import { formatDay } from "@/components/catan/format";
import { PlayerMark } from "@/components/catan/player-mark";
import { cn } from "@/lib/utils";

function PlayerDots({ names }: { names: string[] }) {
  return (
    <span className="flex items-center gap-1">
      {names.map((n) => (
        <span
          key={n}
          title={n}
          className="size-2.5 shrink-0 [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]"
          style={{ background: playerColor(n) }}
        />
      ))}
    </span>
  );
}

export function RecentGamesTable({
  games,
  onOpen,
}: {
  games: CatanGameSummary[];
  onOpen: (id: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* desktop table */}
      <table className="hidden w-full text-sm sm:table">
        <thead>
          <tr className="border-b">
            {["Date", "Winner", "Location", "Players", "Longest", "Largest", ""].map(
              (label, i) => (
                <th
                  key={i}
                  className={cn(
                    "px-3 py-2.5 text-left font-mono text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground",
                    i === 0 && "pl-4",
                  )}
                >
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {games.map((game, i) => (
            <tr
              key={game.id}
              onClick={() => onOpen(game.id)}
              className={cn(
                "cursor-pointer transition-colors hover:bg-accent",
                i > 0 && "border-t border-border/60",
              )}
            >
              <td className="px-3 py-2.5 pl-4 font-mono text-xs text-muted-foreground">
                {formatDay(game.played_at, true)}
              </td>
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-2 font-medium">
                  <PlayerMark name={game.winner ?? ""} className="size-4" />
                  {game.winner ?? "—"}
                </span>
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{game.location}</td>
              <td className="px-3 py-2.5">
                <PlayerDots names={game.player_names} />
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">
                {game.longest.join(", ") || "—"}
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">
                {game.largest.join(", ") || "—"}
              </td>
              <td className="px-3 py-2.5 pr-4 text-right">
                {game.notes && (
                  <StickyNote
                    className="inline size-3.5 text-muted-foreground"
                    aria-label="has notes"
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* mobile rows */}
      <ul className="sm:hidden">
        {games.map((game, i) => (
          <li key={game.id} className={cn(i > 0 && "border-t border-border/60")}>
            <button
              onClick={() => onOpen(game.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors active:bg-accent"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <PlayerMark name={game.winner ?? ""} className="size-4" />
                  {game.winner ?? "—"}
                  {game.notes && (
                    <StickyNote className="size-3 shrink-0 text-muted-foreground" />
                  )}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {formatDay(game.played_at, true)} · {game.location}
                </p>
              </div>
              <PlayerDots names={game.player_names} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
