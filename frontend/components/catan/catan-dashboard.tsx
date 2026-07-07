"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { getCatanDashboard, listCatanGames } from "@/lib/api/catan";
import { CatanLeaderboard, type Robber } from "@/components/catan/leaderboard";
import { WinsOverTime } from "@/components/catan/charts";
import { CHART_ORDER } from "@/components/catan/colors";
import { formatDay } from "@/components/catan/format";
import { HomeAway } from "@/components/catan/home-away";
import { GameEditorDialog } from "@/components/catan/game-editor-dialog";
import { GameSummaryDialog } from "@/components/catan/game-summary-dialog";
import { HeadToHead } from "@/components/catan/head-to-head";
import { LifetimeStats } from "@/components/catan/lifetime-stats";
import { PlayerMark } from "@/components/catan/player-mark";
import { RecentGamesTable } from "@/components/catan/recent-games";
import { ResourceIcon, type ResourceName } from "@/components/catan/resource-icon";
import { Soundtrack } from "@/components/catan/soundtrack";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/hooks/use-me";

function ChartCard({
  title,
  icon,
  revealIndex,
  children,
}: {
  title: string;
  icon: ResourceName;
  revealIndex: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="reveal min-w-0 rounded-lg border bg-card p-4"
      style={{ "--reveal-i": revealIndex } as React.CSSProperties}
    >
      <h2 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        <ResourceIcon name={icon} className="size-3.5 text-brand" />
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function CatanDashboardPage() {
  const { me } = useMe();
  const isOwner = !!me;
  const [openGameId, setOpenGameId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const dashboard = useQuery({
    queryKey: ["catan", "dashboard"],
    queryFn: getCatanDashboard,
  });
  const games = useQuery({ queryKey: ["catan", "games"], queryFn: listCatanGames });

  const knownPlayers = useMemo(
    () => dashboard.data?.players.map((p) => p.name) ?? [],
    [dashboard.data],
  );
  const knownLocations = useMemo(
    () =>
      [...new Set(games.data?.map((g) => g.location).filter(Boolean) ?? [])].sort(),
    [games.data],
  );

  // the robber camps on whoever has played the most games since last winning
  const robber = useMemo<Robber | null>(() => {
    if (!games.data?.length) return null;
    const chronological = [...games.data].sort(
      (a, b) => a.played_at.localeCompare(b.played_at) || a.id - b.id,
    );
    const droughts = new Map<string, number>();
    for (const game of chronological)
      for (const name of game.player_names) {
        if (!CHART_ORDER.includes(name)) continue;
        droughts.set(name, game.winner === name ? 0 : (droughts.get(name) ?? 0) + 1);
      }
    let coldest: Robber | null = null;
    for (const [name, drought] of droughts)
      if (drought > 0 && drought > (coldest?.drought ?? 0))
        coldest = { name, drought };
    return coldest;
  }, [games.data]);

  const data = dashboard.data;

  return (
    <div data-section="catan">
      <div className="bg-hex absolute inset-x-0 top-14 h-80" aria-hidden />
      <div className="relative mx-auto w-full max-w-5xl px-4 pt-16 pb-24 sm:px-6">
        {/* header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p
              className="reveal flex items-center gap-2 text-brand"
              style={{ "--reveal-i": 0 } as React.CSSProperties}
              aria-hidden
            >
              {(["brick", "wood", "wheat", "sheep", "ore"] as const).map((r) => (
                <ResourceIcon key={r} name={r} className="size-4" />
              ))}
            </p>
            <h1
              className="reveal mt-3 text-4xl font-medium tracking-tight sm:text-5xl"
              style={{ "--reveal-i": 1 } as React.CSSProperties}
            >
              Champions League
            </h1>
            {data && data.first_game && (
              <p
                className="reveal mt-2 font-mono text-xs text-muted-foreground"
                style={{ "--reveal-i": 2 } as React.CSSProperties}
              >
                {data.total_games} games · since {formatDay(data.first_game, true)}
              </p>
            )}
          </div>
          {isOwner && (
            <Button
              size="sm"
              className="reveal shrink-0 bg-brand text-brand-contrast hover:bg-brand/90"
              style={{ "--reveal-i": 1 } as React.CSSProperties}
              onClick={() => {
                setEditId(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add game
            </Button>
          )}
        </div>

        {/* the arena */}
        <div
          className="reveal relative mt-8 overflow-hidden rounded-xl border"
          style={{ "--reveal-i": 2 } as React.CSSProperties}
        >
          <Image
            src="/catan/champions.png"
            alt="The champion enthroned in the arena, banners of wool and wheat flying"
            width={1024}
            height={768}
            priority
            className="h-44 w-full object-cover object-[50%_30%] sm:h-64"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent"
            aria-hidden
          />
          {data?.timeline.length ? (
            <p className="absolute bottom-2.5 left-3.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-white/90">
              <PlayerMark
                name={data.timeline[data.timeline.length - 1].winner ?? ""}
                className="size-3.5"
              />
              reigning champion ·{" "}
              {data.timeline[data.timeline.length - 1].winner}
            </p>
          ) : null}
        </div>

        {(dashboard.isError || games.isError) && (
          <div className="mt-10 rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm">
            <p className="font-medium">Couldn&apos;t load the table records.</p>
            <button
              onClick={() => {
                dashboard.refetch();
                games.refetch();
              }}
              className="mt-2 text-brand underline-offset-4 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {dashboard.isLoading && (
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted" />
            ))}
          </div>
        )}

        {data && (
          <>
            <div className="mt-10">
              <LifetimeStats data={data} />
            </div>

            <section
              className="reveal mt-10"
              style={{ "--reveal-i": 4 } as React.CSSProperties}
            >
              <h2 className="section-label flex items-center gap-2">
                <ResourceIcon name="crown" className="size-3.5" />
                standings
              </h2>
              <div className="mt-4">
                <CatanLeaderboard rows={data.leaderboard} robber={robber} />
              </div>
            </section>

            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              <ChartCard title="Head to head" icon="shield" revealIndex={0}>
                {games.data && <HeadToHead games={games.data} />}
              </ChartCard>
              <ChartCard title="Home & away" icon="hex" revealIndex={1}>
                {games.data && <HomeAway games={games.data} />}
              </ChartCard>
              <div className="min-w-0 lg:col-span-2">
                <ChartCard title="Wins over time" icon="road" revealIndex={2}>
                  <WinsOverTime data={data} />
                </ChartCard>
              </div>
            </div>

            <div className="mt-10">
              <Soundtrack />
            </div>

            <section
              className="reveal mt-10"
              style={{ "--reveal-i": 1 } as React.CSSProperties}
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="section-label flex items-center gap-2">
                  <ResourceIcon name="hex" className="size-3.5" />
                  game log
                </h2>
                <a
                  href="https://catan.bunge.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground underline-offset-4 transition-colors hover:text-brand hover:underline"
                >
                  Perfect Board Generator ↗
                </a>
              </div>
              <div className="mt-4">
                {games.data && (
                  <RecentGamesTable games={games.data} onOpen={setOpenGameId} />
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <GameSummaryDialog
        gameId={openGameId}
        isOwner={isOwner}
        onClose={() => setOpenGameId(null)}
        onEdit={(id) => {
          setOpenGameId(null);
          setEditId(id);
          setEditorOpen(true);
        }}
      />
      <GameEditorDialog
        open={editorOpen}
        editId={editId}
        knownPlayers={knownPlayers}
        knownLocations={knownLocations}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  );
}
