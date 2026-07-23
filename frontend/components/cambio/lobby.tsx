"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { getMe } from "@/lib/api/auth";
import { createRoom, getStats } from "@/lib/api/cambio";
import { PlayingCard } from "./card";
import { SKIN_LABELS, type Skin } from "./skins";
import { useSkin } from "./use-skin";
import "./xp.css";
import "./cards.css";

const RULE_ROWS: [string, string][] = [
  ["Joker", "0"],
  ["Ace", "1"],
  ["2–10", "face value"],
  ["J / Q", "10 · power: blind swap"],
  ["7 / 8", "7, 8 · power: peek your own card"],
  ["9 / 10", "9, 10 · power: peek an opponent card"],
  ["Red King ♥♦", "−1 (best card — no power)"],
  ["Black King ♠♣", "10 · power: look, then swap"],
];

export function CambioLobby() {
  const router = useRouter();
  const skin = useSkin();
  const [creating, setCreating] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const { data: stats } = useQuery({
    queryKey: ["cambio-stats"],
    queryFn: getStats,
    enabled: !!me,
    retry: false,
  });

  async function newGame(mode: "vs_bot" | "vs_human") {
    setCreating(mode);
    try {
      const room = await createRoom(mode);
      if (mode === "vs_bot") {
        router.push(room.join_path);
      } else {
        const url = `${window.location.origin}${room.join_path}`;
        setInviteUrl(url);
        // The creator takes seat 0 by opening the room themselves.
        router.push(room.join_path);
      }
    } finally {
      setCreating(null);
    }
  }

  return (
    <div data-section="cambio" className="cb-desktop">
      <div className="cb-window">
        <div className="cb-titlebar">
          <span aria-hidden>🂠</span>
          <span className="cb-title-text">Cambio — Lobby</span>
          <span className="cb-caption-btn" aria-hidden>
            ✕
          </span>
        </div>

        <div className="cb-lobby-body">
          <div style={{ display: "grid", gap: 14 }}>
            <div className="cb-panel">
              <div className="cb-panel-head">New game</div>
              <div className="cb-panel-body">
                {me ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="cb-btn"
                      disabled={creating !== null}
                      onClick={() => newGame("vs_bot")}
                    >
                      ♟ Play vs the bot
                    </button>
                    <button
                      className="cb-btn"
                      disabled={creating !== null}
                      onClick={() => newGame("vs_human")}
                    >
                      ✉ Create invite game
                    </button>
                  </div>
                ) : (
                  <p>
                    Games are started by the site owner — if someone sent you an
                    invite link, just open it and pick a nickname.
                  </p>
                )}
                {inviteUrl && (
                  <p style={{ marginTop: 8, wordBreak: "break-all", fontSize: 11 }}>
                    Invite: {inviteUrl}
                  </p>
                )}
              </div>
            </div>

            <div className="cb-panel">
              <div className="cb-panel-head">How to play</div>
              <div className="cb-panel-body">
                <p style={{ marginBottom: 6 }}>
                  Four face-down cards each; you briefly see your bottom two.
                  Each turn: draw, then swap the card into your grid or play it
                  (powers trigger when played). Any reveal opens a 3-second{" "}
                  <b>snap window</b> — tap a matching face-down card to shed it
                  (snap an opponent&apos;s and hand them one of yours). Wrong
                  snap = penalty card. Call <b>Cambio</b> when you think you&apos;re
                  lowest; everyone else gets one last turn. Lowest total wins.
                </p>
                <table className="cb-rules-table">
                  <tbody>
                    {RULE_ROWS.map(([card, val]) => (
                      <tr key={card}>
                        <td>{card}</td>
                        <td>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
            <div className={`cb-panel cb-skin-${skin}`}>
              <div className="cb-panel-head">Card skin</div>
              <div className="cb-panel-body">
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  {(Object.keys(SKIN_LABELS) as Skin[]).map((s) => (
                    <button
                      key={s}
                      className="cb-btn"
                      style={s === skin ? { fontWeight: 700 } : undefined}
                      onClick={() => {
                        localStorage.setItem("cambio-skin", s);
                        window.dispatchEvent(
                          new CustomEvent("cambio-skin", { detail: s }),
                        );
                      }}
                    >
                      {SKIN_LABELS[s]}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <PlayingCard face={{ rank: "K", suit: "H" }} up skinArt={skin === "art"} />
                  <PlayingCard face={{ rank: "A", suit: "S" }} up skinArt={skin === "art"} />
                  <PlayingCard face={null} up={false} />
                </div>
              </div>
            </div>

            {stats && (
              <div className="cb-panel">
                <div className="cb-panel-head">Your record</div>
                <div className="cb-panel-body">
                  <div className="cb-stat-grid">
                    <div className="cb-stat cb-well">
                      <div className="cb-stat-num">{stats.rounds}</div>
                      <div className="cb-stat-label">rounds</div>
                    </div>
                    <div className="cb-stat cb-well">
                      <div className="cb-stat-num">
                        {(stats.win_pct * 100).toFixed(0)}%
                      </div>
                      <div className="cb-stat-label">win rate</div>
                    </div>
                    <div className="cb-stat cb-well">
                      <div className="cb-stat-num">{stats.current_streak}</div>
                      <div className="cb-stat-label">streak (best {stats.longest_streak})</div>
                    </div>
                    <div className="cb-stat cb-well">
                      <div className="cb-stat-num">
                        {stats.avg_closing_score ?? "—"}
                      </div>
                      <div className="cb-stat-label">avg score</div>
                    </div>
                    <div className="cb-stat cb-well">
                      <div className="cb-stat-num">
                        {stats.snap_accuracy != null
                          ? `${(stats.snap_accuracy * 100).toFixed(0)}%`
                          : "—"}
                      </div>
                      <div className="cb-stat-label">
                        snap acc. ({stats.snap_attempts})
                      </div>
                    </div>
                    <div className="cb-stat cb-well">
                      <div className="cb-stat-num">
                        {stats.cambio_call_accuracy != null
                          ? `${(stats.cambio_call_accuracy * 100).toFixed(0)}%`
                          : "—"}
                      </div>
                      <div className="cb-stat-label">
                        cambio calls ({stats.cambio_calls})
                      </div>
                    </div>
                  </div>
                  {stats.opponents.length > 0 && (
                    <table className="cb-rules-table" style={{ marginTop: 10 }}>
                      <tbody>
                        {stats.opponents.slice(0, 6).map((o) => (
                          <tr key={o.name}>
                            <td>{o.name}</td>
                            <td>
                              {o.wins}–{o.losses}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="cb-status">
          <span className="cb-status-msg">
            2-player realtime · invite links, no sign-in for guests
          </span>
        </div>
      </div>
    </div>
  );
}
