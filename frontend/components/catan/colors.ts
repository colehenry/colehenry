/**
 * Fixed per-player chart colors, drawn from Catan resources and validated
 * for CVD separation + contrast on both surfaces (dataviz palette checks).
 * Assignment never changes with sort order or filters - color follows the
 * player. Guests fall back to the muted swatch.
 */
export const PLAYER_SLOTS: Record<string, number> = {
  jaren: 1,
  cole: 2,
  aditya: 3,
  dan: 4,
  allen: 5,
};

/** CSS var for a player's color; resolves per light/dark via globals.css. */
export function playerColor(name: string): string {
  const slot = PLAYER_SLOTS[name.toLowerCase()];
  return slot ? `var(--catan-p${slot})` : "hsl(var(--muted-hsl))";
}

/** Chart order = validated palette order (adjacent-pair CVD checked). */
export const CHART_ORDER = ["Jaren", "Cole", "Aditya", "Dan", "Allen"];

/** Each regular carries a resource to match their color. */
export const PLAYER_RESOURCES: Record<string, "brick" | "ore" | "wheat" | "sheep" | "wood"> = {
  jaren: "brick",
  cole: "ore",
  aditya: "wheat",
  dan: "sheep",
  allen: "wood",
};
