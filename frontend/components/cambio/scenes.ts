/** Scene registry (plan §7). A scene themes the TABLE surface + background and
 * is independent of the card deck (skins.ts) - decks and scenes compose freely.
 * A scene is applied via the `cb-scene-*` class on the game root; its visual
 * image and foreground ambience live in table.css. Generated images are the
 * only base layer; scenes intentionally have no SVG or CSS-art fallback. */

export type Scene = "seaside" | "cafe" | "tavern";

export const SCENE_LABELS: Record<Scene, string> = {
  seaside: "Seaside terrace",
  cafe: "Coffee shop",
  tavern: "Medieval tavern",
};

/** All registered scenes have final generated art. */
export const SCENE_READY: Record<Scene, boolean> = {
  seaside: true,
  cafe: true,
  tavern: true,
};

export const SCENE_ORDER: Scene[] = ["seaside", "cafe", "tavern"];
export const DEFAULT_SCENE: Scene = "seaside";

export function isScene(v: string | null): v is Scene {
  return v === "seaside" || v === "cafe" || v === "tavern";
}
