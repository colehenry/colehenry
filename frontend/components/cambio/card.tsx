"use client";

import type { CardFace } from "@/lib/api/cambio";

/** Hand-built playing card (plan §6.3): CSS 3D flip, two faces with
 * backface-visibility hidden. Skins restyle it purely via the `.cb-skin-*`
 * class on the table root - geometry never changes. */

const SUIT_GLYPH: Record<string, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

function suitColor(rank: string, suit: string | null): string {
  if (rank === "JO") return "is-joker";
  return suit === "H" || suit === "D" ? "is-red" : "is-black";
}

/** Deterministic little modernist composition for the art skin's centers -
 * shapes and palette keyed off rank+suit so each card has a stable plate. */
function ArtPlate({ rank, suit }: { rank: string; suit: string | null }) {
  const seed =
    (rank.charCodeAt(0) * 31 + (suit ? suit.charCodeAt(0) : 7)) % 97;
  const palettes = [
    ["#a33327", "#e0a92f", "#22406b"],
    ["#22406b", "#a33327", "#5a7d4a"],
    ["#e0a92f", "#22201c", "#a33327"],
    ["#5a7d4a", "#22406b", "#e0a92f"],
  ];
  const [c1, c2, c3] = palettes[seed % palettes.length];
  const r1 = 6 + (seed % 9);
  const x = 8 + (seed % 12);
  return (
    <svg width="34" height="44" viewBox="0 0 34 44" aria-hidden>
      <rect x="0" y="0" width="34" height="44" fill="#f4f0e6" />
      <rect x={x - 6} y="4" width="18" height="26" fill={c2} transform={`rotate(${seed % 21 - 10} 17 22)`} />
      <circle cx={x} cy={14 + (seed % 10)} r={r1} fill={c1} />
      <path d={`M2 ${40 - (seed % 8)} L${10 + (seed % 14)} ${20 + (seed % 10)} L32 40 Z`} fill={c3} opacity="0.9" />
      <circle cx={22 + (seed % 6)} cy={12} r="2.4" fill="#22201c" />
    </svg>
  );
}

export function PlayingCard({
  face,
  up,
  small,
  skinArt,
  className = "",
  onClick,
  title,
}: {
  /** null = face unknown (renders the back even if `up`) */
  face: CardFace | { rank: string; suit: string | null } | null;
  up: boolean;
  small?: boolean;
  /** art skin renders generated plates in the center */
  skinArt?: boolean;
  className?: string;
  onClick?: () => void;
  title?: string;
}) {
  const showFace = up && face != null;
  const rank = face?.rank ?? "";
  const suit = face?.suit ?? null;
  const glyph = rank === "JO" ? "★" : suit ? SUIT_GLYPH[suit] : "";
  const indexText = rank === "JO" ? "J★" : rank;
  return (
    <div
      className={`cbc ${small ? "cbc-sm" : ""} ${showFace ? "" : "is-down"} ${className}`}
      onClick={onClick}
      title={title}
      role={onClick ? "button" : undefined}
    >
      <div className="cbc-inner">
        <div className={`cbc-face ${face ? suitColor(rank, suit) : ""}`}>
          {face && (
            <>
              <span className="cbc-corner is-tl">
                {indexText}
                <span className="cbc-suit">{glyph}</span>
              </span>
              <span className="cbc-center">
                {skinArt && rank !== "JO" ? (
                  <ArtPlate rank={rank} suit={suit} />
                ) : (
                  glyph || "★"
                )}
              </span>
              <span className="cbc-corner is-br">
                {indexText}
                <span className="cbc-suit">{glyph}</span>
              </span>
            </>
          )}
        </div>
        <div className="cbc-back" />
      </div>
    </div>
  );
}
