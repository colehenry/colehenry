"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { getMe } from "@/lib/api/auth";
import { createRoom } from "@/lib/api/cambio";
import { PlayingCard } from "./card";
import { SceneBackdrop } from "./scene-backdrop";
import { SKIN_LABELS, type Skin } from "./skins";
import { SCENE_LABELS, SCENE_ORDER } from "./scenes";
import { useSkin } from "./use-skin";
import { useScene, setScene, setSkin } from "./use-scene";
import "./table.css";
import "./cards.css";

const RULE_ROWS: [string, string][] = [
  ["Joker", "0"],
  ["Ace", "1"],
  ["2–10", "face value"],
  ["J / Q", "10 · blind swap"],
  ["7 / 8", "peek your own"],
  ["9 / 10", "peek opponent"],
  ["Red King ♥♦", "−1 · best card"],
  ["Black King ♠♣", "10 · look then swap"],
];

export function CambioLobby() {
  const router = useRouter();
  const skin = useSkin();
  const scene = useScene();
  const [creating, setCreating] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });

  async function newGame(mode: "vs_bot" | "vs_human") {
    setCreating(mode);
    try {
      const room = await createRoom(mode);
      router.push(room.join_path);
    } finally {
      setCreating(null);
    }
  }

  return (
    <div data-section="cambio" className={`cb-game cb-skin-${skin} cb-scene-${scene}`}>
      <SceneBackdrop scene={scene} />

      <div className="cb-lobby">
        <header className="cb-lobby-hero">
          <h1 className="cb-lobby-title">Cambio</h1>
        </header>

        <div className="cb-home">
          <div className="cb-info-wrap">
            <button className="cb-info" aria-label="How to play">
              i
            </button>
            <div className="cb-info-pop" role="tooltip">
              <p style={{ marginBottom: 8 }}>
                Four face-down cards each; you briefly see your bottom two. Each
                turn: draw, then swap the card in or play it (powers trigger when
                played). Any reveal opens a 3-second <b>snap window</b> — tap a
                matching card to shed it. Call <b>Cambio</b> when you think
                you&apos;re lowest; everyone else gets one last turn. Lowest total
                wins.
              </p>
              <table className="cb-rules">
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

          <div>
            <h3>New game</h3>
            {me ? (
              <div className="cb-btn-row" style={{ marginTop: 10 }}>
                <button
                  className="cb-primary is-gold"
                  disabled={creating !== null}
                  onClick={() => newGame("vs_bot")}
                >
                  ♟ Play the bot
                </button>
                <button
                  className="cb-primary"
                  disabled={creating !== null}
                  onClick={() => newGame("vs_human")}
                >
                  ✉ Invite a friend
                </button>
              </div>
            ) : (
              <p style={{ marginTop: 8 }}>
                Games are started by the site owner — if someone sent you an
                invite link, just open it and pick a nickname.
              </p>
            )}
          </div>

          <div>
            <div className="cb-card-sub">Card deck</div>
            <div className="cb-chip-row">
              {(Object.keys(SKIN_LABELS) as Skin[]).map((s) => (
                <button
                  key={s}
                  className={`cb-chip ${s === skin ? "is-on" : ""}`}
                  onClick={() => setSkin(s)}
                >
                  {SKIN_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="cb-card-sub">Table scene</div>
            <div className="cb-chip-row">
              {SCENE_ORDER.map((s) => (
                <button
                  key={s}
                  className={`cb-chip ${s === scene ? "is-on" : ""}`}
                  onClick={() => setScene(s)}
                >
                  {SCENE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className={`cb-preview-row cb-skin-${skin}`}>
            <PlayingCard face={{ rank: "K", suit: "H" }} up skinArt={skin === "art"} />
            <PlayingCard face={{ rank: "A", suit: "S" }} up skinArt={skin === "art"} />
            <PlayingCard face={null} up={false} />
          </div>
        </div>
      </div>
    </div>
  );
}
