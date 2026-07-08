/**
 * The single registry of site sections. Drives the header nav, the cmd+k
 * palette, and the coming-soon pages — add a section here and every part of
 * the shell picks it up.
 */
export type Section = {
  slug: string;
  path: string;
  name: string;
  /** value for the `data-section` attribute — keys into the CSS accent skins */
  accent: string;
  description: string;
  ownerOnly?: boolean;
  /** built for real vs. themed blank page */
  comingSoon?: boolean;
};

export const sections: Section[] = [
  {
    slug: "catan",
    path: "/catan",
    name: "Catan",
    accent: "catan",
    description: "Game log, standings, win rates, head-to-head.",
  },
  {
    slug: "blog",
    path: "/blog",
    name: "Blog",
    accent: "blog",
    description: "Writing on software, side projects, and whatever else.",
    comingSoon: true,
  },
  {
    slug: "recipes",
    path: "/recipes",
    name: "Recipes",
    accent: "recipes",
    description: "Things I cook, with photos and honest notes.",
    comingSoon: true,
  },
  {
    slug: "challenges",
    path: "/challenges",
    name: "Challenges",
    accent: "challenges",
    description: "The 25 — a personal challenge log. Owner only.",
    ownerOnly: true,
  },
  {
    slug: "language",
    path: "/language",
    name: "Language",
    accent: "language",
    description: "Flashcard decks and spaced-repetition study.",
    comingSoon: true,
  },
  {
    slug: "journal",
    path: "/journal",
    name: "Journal",
    accent: "journal",
    description: "Private daily entries. Owner only.",
    ownerOnly: true,
    comingSoon: true,
  },
  {
    slug: "dashboard",
    path: "/dashboard",
    name: "Dashboard",
    accent: "dash",
    description: "Todos, calendar, now playing. Owner only.",
    ownerOnly: true,
    comingSoon: true,
  },
];

/** Paths gated by the auth proxy (see /web/proxy.ts). */
export const ownerOnlyPaths = sections
  .filter((s) => s.ownerOnly)
  .map((s) => s.path);
