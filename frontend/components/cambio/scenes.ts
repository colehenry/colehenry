/** Scene registry (plan §7). A scene themes the TABLE surface + background and
 * is independent of the card deck (skins.ts) — decks and scenes compose freely.
 * A scene is applied via the `cb-scene-*` class on the game root; its visual
 * tokens (backdrop, surface, light tint, accent) live in table.css. Adding a
 * scene = a `.cb-scene-*` block there plus a row here.
 *
 * Art direction: Trattoria (warm illustrated). Ship Seaside first; others are
 * picker slots to be illustrated later. */

export type Scene = "seaside" | "cafe" | "tavern" | "neutral";

export const SCENE_LABELS: Record<Scene, string> = {
  seaside: "Seaside terrace",
  cafe: "Coffee shop",
  tavern: "Medieval tavern",
  neutral: "Neutral",
};

/** Fully illustrated vs. lightweight preview (picker marks the previews). */
export const SCENE_READY: Record<Scene, boolean> = {
  seaside: true,
  cafe: true,
  tavern: true,
  neutral: true,
};

export const SCENE_ORDER: Scene[] = ["seaside", "cafe", "tavern", "neutral"];
export const DEFAULT_SCENE: Scene = "seaside";

export function isScene(v: string | null): v is Scene {
  return v === "seaside" || v === "cafe" || v === "tavern" || v === "neutral";
}
