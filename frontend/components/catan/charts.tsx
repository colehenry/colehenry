"use client";

import { useMemo, useRef, useState } from "react";

import type { CatanDashboard } from "@/lib/api/catan";
import { CHART_ORDER, playerColor } from "@/components/catan/colors";
import { formatDay } from "@/components/catan/format";

const W = 640;
const H = 240;
const PAD = { top: 12, right: 62, bottom: 24, left: 26 };

/** Cumulative wins per player across the game log, with a hover guideline. */
export function WinsOverTime({ data }: { data: CatanDashboard }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { series, n, maxWins } = useMemo(() => {
    const names = CHART_ORDER.filter((name) =>
      data.leaderboard.some((r) => r.name === name),
    );
    const totals = new Map(names.map((name) => [name, 0]));
    const series = names.map((name) => ({ name, values: [0] as number[] }));
    for (const event of data.timeline) {
      for (const s of series) {
        if (event.winner === s.name) totals.set(s.name, totals.get(s.name)! + 1);
        s.values.push(totals.get(s.name)!);
      }
    }
    const maxWins = Math.max(1, ...[...totals.values()]);
    return { series, n: data.timeline.length, maxWins };
  }, [data]);

  if (n === 0) return null;

  const x = (i: number) => PAD.left + (i / n) * (W - PAD.left - PAD.right);
  const y = (v: number) => H - PAD.bottom - (v / maxWins) * (H - PAD.top - PAD.bottom);
  const step = (values: number[]) =>
    values
      .map((v, i) => (i === 0 ? `M${x(0)},${y(v)}` : `H${x(i)}V${y(v)}`))
      .join("");

  // stagger end labels so tied players don't overlap
  const ends = series
    .map((s) => ({ name: s.name, v: s.values[n] }))
    .sort((a, b) => b.v - a.v);
  const labelY = new Map<string, number>();
  let prev = -Infinity;
  for (const e of [...ends].sort((a, b) => y(a.v) - y(b.v))) {
    const yy = Math.max(y(e.v), prev + 12, PAD.top + 4);
    labelY.set(e.name, yy);
    prev = yy;
  }

  const hoverEvent = hover !== null ? data.timeline[hover - 1] : null;

  return (
    <div className="overflow-x-auto">
      <div ref={wrapRef} className="relative min-w-[420px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full overflow-visible"
        onMouseMove={(ev) => {
          const rect = ev.currentTarget.getBoundingClientRect();
          const px = ((ev.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * n);
          setHover(Math.min(n, Math.max(1, i)));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {/* recessive grid: one line per win count */}
        {Array.from({ length: maxWins + 1 }, (_, v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="hsl(var(--border-hsl))"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {v}
            </text>
          </g>
        ))}
        {/* date ticks: first + last game */}
        <text
          x={x(1)}
          y={H - 6}
          textAnchor="start"
          className="fill-muted-foreground font-mono text-[10px]"
        >
          {formatDay(data.timeline[0].played_at)}
        </text>
        <text
          x={x(n)}
          y={H - 6}
          textAnchor="end"
          className="fill-muted-foreground font-mono text-[10px]"
        >
          {formatDay(data.timeline[n - 1].played_at)}
        </text>

        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="hsl(var(--muted-hsl))"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {series.map((s) => (
          <path
            key={s.name}
            d={step(s.values)}
            fill="none"
            stroke={playerColor(s.name)}
            strokeWidth="2"
            strokeLinejoin="round"
            pathLength={1}
            className="chart-draw"
          />
        ))}
        {/* win markers, ringed so overlaps stay legible */}
        {series.map((s) =>
          s.values.map((v, i) =>
            i > 0 && v > s.values[i - 1] ? (
              <circle
                key={`${s.name}-${i}`}
                cx={x(i)}
                cy={y(v)}
                r="3.5"
                fill={playerColor(s.name)}
                stroke="hsl(var(--card-hsl))"
                strokeWidth="2"
              />
            ) : null,
          ),
        )}
        {ends.map((e) => (
          <text
            key={e.name}
            x={W - PAD.right + 8}
            y={labelY.get(e.name)! + 3}
            className="font-mono text-[10px]"
            fill={playerColor(e.name)}
          >
            {e.name.slice(0, 3).toUpperCase()} · {e.v}
          </text>
        ))}
      </svg>

      {hoverEvent && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-sm"
          style={{ left: `${(x(hover!) / W) * 100}%` }}
        >
          <p className="font-mono text-[10px] text-muted-foreground">
            {formatDay(hoverEvent.played_at, true)}
          </p>
          <p className="flex items-center gap-1.5 font-medium">
            <span
              className="size-2 rounded-[2px]"
              style={{ background: playerColor(hoverEvent.winner ?? "") }}
            />
            {hoverEvent.winner ?? "—"} won
          </p>
        </div>
      )}
      </div>
    </div>
  );
}
