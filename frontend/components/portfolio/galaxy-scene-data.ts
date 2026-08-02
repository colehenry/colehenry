export type GalaxyStar = {
  id: string;
  x: number;
  y: number;
  size: 1 | 2 | 3;
  tone: "quiet" | "standard" | "bright";
};

export type GalaxyObject = {
  id: "asteroid" | "lapwise-planet" | "brain-galaxy" | "bilingual-moon";
  kind: "asteroid" | "ring-planet" | "spiral-galaxy" | "layered-moon";
  side: "left" | "right";
  top: number;
  travel: number;
  turn: number;
  angle: number;
};

/**
 * Percentages are relative to the full homepage scene. Brighter stars stay in
 * the outer gutters while a quieter deterministic field crosses open space.
 */
export const GALAXY_STARS: readonly GalaxyStar[] = [
  { id: "s01", x: 2.4, y: 2.8, size: 1, tone: "quiet" },
  { id: "s02", x: 97.1, y: 4.9, size: 2, tone: "standard" },
  { id: "s03", x: 3.8, y: 7.6, size: 1, tone: "standard" },
  { id: "s04", x: 98.2, y: 10.4, size: 1, tone: "quiet" },
  { id: "s05", x: 1.7, y: 13.9, size: 2, tone: "bright" },
  { id: "s06", x: 96.2, y: 16.8, size: 1, tone: "standard" },
  { id: "s07", x: 4.2, y: 19.7, size: 1, tone: "quiet" },
  { id: "s08", x: 98.6, y: 22.5, size: 2, tone: "bright" },
  { id: "s09", x: 2.9, y: 25.3, size: 1, tone: "standard" },
  { id: "s10", x: 95.8, y: 27.6, size: 1, tone: "quiet" },
  { id: "s11", x: 1.4, y: 30.2, size: 3, tone: "standard" },
  { id: "s12", x: 97.5, y: 32.8, size: 1, tone: "standard" },
  { id: "s13", x: 4.4, y: 35.1, size: 1, tone: "quiet" },
  { id: "s14", x: 98.8, y: 37.9, size: 2, tone: "bright" },
  { id: "s15", x: 2.1, y: 40.7, size: 1, tone: "standard" },
  { id: "s16", x: 96.6, y: 43.5, size: 1, tone: "quiet" },
  { id: "s17", x: 3.5, y: 46.1, size: 2, tone: "bright" },
  { id: "s18", x: 98.1, y: 48.8, size: 1, tone: "standard" },
  { id: "s19", x: 1.8, y: 51.4, size: 1, tone: "quiet" },
  { id: "s20", x: 95.9, y: 53.7, size: 2, tone: "standard" },
  { id: "s21", x: 4.1, y: 56.2, size: 1, tone: "standard" },
  { id: "s22", x: 97.2, y: 58.6, size: 1, tone: "bright" },
  { id: "s23", x: 2.6, y: 60.8, size: 2, tone: "standard" },
  { id: "s24", x: 98.7, y: 62.4, size: 1, tone: "quiet" },
  { id: "s25", x: 1.3, y: 64.1, size: 1, tone: "quiet" },
  { id: "s26", x: 96.4, y: 65.7, size: 2, tone: "standard" },
  { id: "s27", x: 18, y: 12.1, size: 1, tone: "quiet" },
  { id: "s28", x: 72, y: 14.8, size: 1, tone: "quiet" },
  { id: "s29", x: 43, y: 17.4, size: 1, tone: "quiet" },
  { id: "s30", x: 84, y: 26.2, size: 1, tone: "quiet" },
  { id: "s31", x: 23, y: 29.1, size: 1, tone: "quiet" },
  { id: "s32", x: 62, y: 31.7, size: 1, tone: "quiet" },
  { id: "s33", x: 37, y: 34.3, size: 1, tone: "quiet" },
  { id: "s34", x: 78, y: 41.6, size: 1, tone: "quiet" },
  { id: "s35", x: 15, y: 44.2, size: 1, tone: "quiet" },
  { id: "s36", x: 55, y: 46.7, size: 1, tone: "quiet" },
  { id: "s37", x: 88, y: 52.1, size: 1, tone: "quiet" },
  { id: "s38", x: 29, y: 54.9, size: 1, tone: "quiet" },
  { id: "s39", x: 67, y: 58.1, size: 1, tone: "quiet" },
  { id: "s40", x: 46, y: 61.3, size: 1, tone: "quiet" },
  { id: "s41", x: 10, y: 4.2, size: 2, tone: "standard" },
  { id: "s42", x: 31, y: 6.1, size: 1, tone: "quiet" },
  { id: "s43", x: 58, y: 8.3, size: 2, tone: "quiet" },
  { id: "s44", x: 82, y: 10.1, size: 1, tone: "standard" },
  { id: "s45", x: 48, y: 21.2, size: 2, tone: "standard" },
  { id: "s46", x: 12, y: 23.7, size: 1, tone: "quiet" },
  { id: "s47", x: 69, y: 37.1, size: 2, tone: "standard" },
  { id: "s48", x: 26, y: 39.6, size: 1, tone: "quiet" },
  { id: "s49", x: 52, y: 49.8, size: 2, tone: "standard" },
  { id: "s50", x: 83, y: 63.5, size: 1, tone: "quiet" },
  { id: "s51", x: 20, y: 2.3, size: 2, tone: "standard" },
  { id: "s52", x: 47, y: 3.1, size: 1, tone: "quiet" },
  { id: "s53", x: 73, y: 4.9, size: 1, tone: "standard" },
  { id: "s54", x: 90, y: 6.7, size: 2, tone: "quiet" },
  { id: "s55", x: 16, y: 9.5, size: 1, tone: "standard" },
  { id: "s56", x: 36, y: 11.7, size: 1, tone: "quiet" },
  { id: "s57", x: 64, y: 13.2, size: 2, tone: "standard" },
  { id: "s58", x: 87, y: 15.6, size: 1, tone: "quiet" },
  { id: "s59", x: 8, y: 18.1, size: 2, tone: "standard" },
  { id: "s60", x: 27, y: 19.5, size: 1, tone: "quiet" },
  { id: "s61", x: 56, y: 22.8, size: 2, tone: "standard" },
  { id: "s62", x: 79, y: 24.4, size: 1, tone: "quiet" },
  { id: "s63", x: 18, y: 27.1, size: 1, tone: "standard" },
  { id: "s64", x: 41, y: 28.6, size: 2, tone: "quiet" },
  { id: "s65", x: 70, y: 30.4, size: 1, tone: "standard" },
  { id: "s66", x: 91, y: 33, size: 2, tone: "quiet" },
  { id: "s67", x: 11, y: 35.3, size: 1, tone: "standard" },
  { id: "s68", x: 34, y: 36.2, size: 2, tone: "quiet" },
  { id: "s69", x: 59, y: 38.8, size: 1, tone: "standard" },
  { id: "s70", x: 86, y: 40.4, size: 2, tone: "quiet" },
  { id: "s71", x: 21, y: 43, size: 1, tone: "standard" },
  { id: "s72", x: 45, y: 45, size: 2, tone: "quiet" },
  { id: "s73", x: 73, y: 47.6, size: 1, tone: "standard" },
  { id: "s74", x: 9, y: 50.4, size: 2, tone: "quiet" },
  { id: "s75", x: 33, y: 51.8, size: 1, tone: "standard" },
  { id: "s76", x: 61, y: 53.4, size: 2, tone: "quiet" },
  { id: "s77", x: 88, y: 55.6, size: 1, tone: "standard" },
  { id: "s78", x: 17, y: 57.3, size: 2, tone: "quiet" },
  { id: "s79", x: 42, y: 59.7, size: 1, tone: "standard" },
  { id: "s80", x: 76, y: 62.8, size: 2, tone: "quiet" },
] as const;

export const GALAXY_OBJECTS: readonly GalaxyObject[] = [
  {
    id: "asteroid",
    kind: "asteroid",
    side: "right",
    top: 5.5,
    travel: 88,
    turn: 132,
    angle: -14,
  },
  {
    id: "lapwise-planet",
    kind: "ring-planet",
    side: "left",
    top: 20.5,
    travel: 46,
    turn: -28,
    angle: -8,
  },
  {
    id: "brain-galaxy",
    kind: "spiral-galaxy",
    side: "right",
    top: 34.5,
    travel: 42,
    turn: 58,
    angle: -4,
  },
  {
    id: "bilingual-moon",
    kind: "layered-moon",
    side: "left",
    top: 49,
    travel: 52,
    turn: 42,
    angle: 5,
  },
] as const;

export function galaxyObjectProgress(
  scrollY: number,
  viewportHeight: number,
  objectTop: number,
) {
  const start = objectTop - viewportHeight * 0.9;
  const end = objectTop + viewportHeight * 0.5;
  return Math.min(1, Math.max(0, (scrollY - start) / (end - start)));
}
