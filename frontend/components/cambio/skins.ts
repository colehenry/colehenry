/** Card-skin registry. Skins style the cards only - the XP chrome and felt
 * table never change (plan §7). Adding a skin = a `.cb-skin-*` block in
 * cards.css plus a row here. */

export type Skin = "xp" | "medieval" | "art";

export const SKIN_LABELS: Record<Skin, string> = {
  xp: "Solitaire XP",
  medieval: "Illuminated",
  art: "Art pack",
};
