/**
 * Demo dataset for /dashboard.
 *
 * AUTHORED DEMONSTRATION CONTENT — the `dash_items`, `dash_lists` and pantry
 * tables from `context/dashboard_plan.md` do not exist yet. Deliberately dense:
 * a month carrying only four events makes a month view look broken, so there is
 * enough here to judge a layout under something like real load.
 *
 * Anchor is Sunday 2026-07-26. Weekday names are hardcoded rather than derived
 * so server and client render identically regardless of the viewer's timezone.
 */

export type Kind =
  | "task"
  | "deadline"
  | "grocery"
  | "meal"
  | "note"
  | "waiting"
  | "routine";

/** Pantry lives as a flag on a grocery item — never its own view or tab. */
export type PantryStatus = "stocked" | "low" | "out";

export type Item = {
  id: string;
  kind: Kind;
  title: string;
  dueOn?: string;
  dueTime?: string;
  tag?: string;
  note?: string;
  done?: boolean;
};

export type GroceryItem = {
  id: string;
  /** Joins `recipes.ingredients[].key` — the shared namespace. */
  ingredientKey: string;
  name: string;
  qtyNote?: string;
  staple?: boolean;
  pantry?: PantryStatus;
  daysLeft?: number;
  forMeal?: string;
  got?: boolean;
  /** Which store list it sits on. */
  list?: "market" | "costco" | "hardware";
};

export type Meal = {
  id: string;
  day: string;
  title: string;
  recipeSlug?: string;
  kind: "cook" | "out" | "leftovers" | "travel";
};

export type CalendarEvent = {
  id: string;
  day: string;
  time?: string;
  title: string;
  calendar: "personal" | "work";
};

export type Waiting = {
  id: string;
  who: string;
  what: string;
  since: string;
  days: number;
  thread?: boolean;
  replied?: boolean;
};

export type Routine = {
  id: string;
  title: string;
  cadence: string;
  done?: boolean;
};

export type Day = {
  date: string;
  weekday: string;
  weekdayShort: string;
  dayNum: string;
  month: string;
  isToday?: boolean;
};

export const TODAY = "2026-07-26";

export const WEEK: Day[] = [
  { date: "2026-07-26", weekday: "Sunday", weekdayShort: "Sun", dayNum: "26", month: "Jul", isToday: true },
  { date: "2026-07-27", weekday: "Monday", weekdayShort: "Mon", dayNum: "27", month: "Jul" },
  { date: "2026-07-28", weekday: "Tuesday", weekdayShort: "Tue", dayNum: "28", month: "Jul" },
  { date: "2026-07-29", weekday: "Wednesday", weekdayShort: "Wed", dayNum: "29", month: "Jul" },
  { date: "2026-07-30", weekday: "Thursday", weekdayShort: "Thu", dayNum: "30", month: "Jul" },
  { date: "2026-07-31", weekday: "Friday", weekdayShort: "Fri", dayNum: "31", month: "Jul" },
  { date: "2026-08-01", weekday: "Saturday", weekdayShort: "Sat", dayNum: "1", month: "Aug" },
];

export const ROUTINE: Routine[] = [
  { id: "r1", title: "Spanish — 20 min", cadence: "every day", done: true },
  { id: "r2", title: "Walk", cadence: "every day" },
  { id: "r3", title: "Water the plants", cadence: "Sun · Wed" },
  { id: "r4", title: "Inbox to zero", cadence: "every day" },
  { id: "r5", title: "Back up the vault", cadence: "Sundays", done: true },
];

export const TASKS: Item[] = [
  { id: "t1", kind: "task", title: "Send Aditya the Catan season CSV", dueOn: "2026-07-22", tag: "catan" },
  { id: "t2", kind: "task", title: "Reply to the lease renewal email", dueOn: "2026-07-24", tag: "admin" },
  { id: "t3", kind: "task", title: "Defrost the pork shoulder", dueOn: "2026-07-26", tag: "kitchen" },
  { id: "t4", kind: "deadline", title: "Migration 0019 — dash_items on Neon", dueOn: "2026-07-29", tag: "colehenry.dev" },
  { id: "t5", kind: "task", title: "Book RDU long-term parking", dueOn: "2026-07-30", tag: "travel" },
  { id: "t6", kind: "task", title: "Print boarding pass, check the bag fee", dueOn: "2026-07-30", tag: "travel" },
  { id: "t7", kind: "deadline", title: "Pay the quarterly estimated tax", dueOn: "2026-07-31", tag: "admin" },
  { id: "t8", kind: "task", title: "Pick up Dad's birthday present", dueOn: "2026-08-01", tag: "family" },
  { id: "t9", kind: "deadline", title: "Cambio engine — finish scoring rules", dueOn: "2026-08-03", tag: "cambio" },
  { id: "t10", kind: "task", title: "Swap the Railway plan before the cycle", dueOn: "2026-08-05", tag: "colehenry.dev" },
  { id: "t11", kind: "deadline", title: "Brain nightly queue — first commit", dueOn: "2026-08-08", tag: "colehenry.dev" },
  { id: "t12", kind: "deadline", title: "Renew passport", dueOn: "2026-08-14", tag: "admin" },
  { id: "t13", kind: "task", title: "Dentist — six month cleaning", dueOn: "2026-08-19", tag: "health" },
  { id: "t14", kind: "deadline", title: "Cambio — playable build for Jaren", dueOn: "2026-08-28", tag: "cambio" },
];

/** Undated, unlisted. The most-used surface in the product. */
export const INBOX: Item[] = [
  { id: "i1", kind: "note", title: "Nightly fact queue — one LLM call, commit to the vault, re-index" },
  { id: "i2", kind: "note", title: "Neon branching for 0019 so prod stays clean" },
  { id: "i3", kind: "note", title: "Subjuntivo imperfecto drills are too easy — bump the FSRS ease" },
  { id: "i4", kind: "note", title: "Ask Jaren whether he still has the second Catan expansion" },
  { id: "i5", kind: "note", title: "Try the cast-iron ribeye with a compound butter next time" },
  { id: "i6", kind: "note", title: "Look at Cloudflare Images instead of Cloudinary for recipe photos" },
  { id: "i7", kind: "note", title: "The /language XP window needs a keyboard-only path" },
  { id: "i8", kind: "note", title: "Pantry staples could reorder themselves from grocery history" },
  { id: "i9", kind: "note", title: "Read the Postgres generated-columns docs before 0019" },
  { id: "i10", kind: "note", title: "Barber — book before the trip" },
];

export const MEALS: Meal[] = [
  { id: "m0a", day: "2026-07-20", title: "Shakshuka", recipeSlug: "shakshuka", kind: "cook" },
  { id: "m0b", day: "2026-07-21", title: "Out — ramen with Dan", kind: "out" },
  { id: "m0c", day: "2026-07-22", title: "Lentil soup", recipeSlug: "lentil-soup", kind: "cook" },
  { id: "m0d", day: "2026-07-23", title: "Leftovers", kind: "leftovers" },
  { id: "m0e", day: "2026-07-24", title: "Pollo al ajillo", recipeSlug: "pollo-al-ajillo", kind: "cook" },
  { id: "m0f", day: "2026-07-25", title: "Out — birthday dinner", kind: "out" },
  { id: "m1", day: "2026-07-26", title: "Pollo al ajillo", recipeSlug: "pollo-al-ajillo", kind: "cook" },
  { id: "m2", day: "2026-07-27", title: "Leftovers", kind: "leftovers" },
  { id: "m3", day: "2026-07-28", title: "Cochinita pibil tacos", recipeSlug: "cochinita-pibil", kind: "cook" },
  { id: "m4", day: "2026-07-29", title: "Out — Catan at Jaren's", kind: "out" },
  { id: "m5", day: "2026-07-30", title: "Lentil soup", recipeSlug: "lentil-soup", kind: "cook" },
  { id: "m6", day: "2026-07-31", title: "Travelling", kind: "travel" },
  { id: "m7", day: "2026-08-01", title: "Cast-iron ribeye", recipeSlug: "cast-iron-ribeye", kind: "cook" },
];

export const EVENTS: CalendarEvent[] = [
  { id: "e1", day: "2026-07-06", time: "09:30", title: "1:1 with Priya", calendar: "work" },
  { id: "e2", day: "2026-07-08", time: "14:00", title: "Design review", calendar: "work" },
  { id: "e3", day: "2026-07-09", time: "18:30", title: "Catan at Dan's", calendar: "personal" },
  { id: "e4", day: "2026-07-13", time: "09:30", title: "1:1 with Priya", calendar: "work" },
  { id: "e5", day: "2026-07-14", time: "11:00", title: "Dentist consult", calendar: "personal" },
  { id: "e6", day: "2026-07-16", time: "15:00", title: "Quarterly planning", calendar: "work" },
  { id: "e7", day: "2026-07-18", time: "19:00", title: "Allen's leaving drinks", calendar: "personal" },
  { id: "e8", day: "2026-07-20", time: "09:30", title: "1:1 with Priya", calendar: "work" },
  { id: "e9", day: "2026-07-22", time: "13:00", title: "Vendor call — Railway", calendar: "work" },
  { id: "e10", day: "2026-07-25", time: "19:30", title: "Dinner — Maria's birthday", calendar: "personal" },
  { id: "e10b", day: "2026-07-26", time: "16:00", title: "Call with Mom", calendar: "personal" },
  { id: "e11", day: "2026-07-27", time: "09:30", title: "1:1 with Priya", calendar: "work" },
  { id: "e12", day: "2026-07-27", time: "16:00", title: "Sprint retro", calendar: "work" },
  { id: "e13", day: "2026-07-28", time: "12:00", title: "Lunch with Allen", calendar: "personal" },
  { id: "e14", day: "2026-07-29", time: "10:00", title: "Architecture sync", calendar: "work" },
  { id: "e15", day: "2026-07-29", time: "18:00", title: "Catan at Jaren's", calendar: "personal" },
  { id: "e16", day: "2026-07-30", time: "09:30", title: "1:1 with Priya", calendar: "work" },
  { id: "e17", day: "2026-07-31", time: "07:15", title: "DL 2214 → RDU", calendar: "personal" },
  { id: "e18", day: "2026-08-01", title: "Dad's birthday", calendar: "personal" },
];

export const GROCERIES: GroceryItem[] = [
  { id: "g1", ingredientKey: "cilantro", name: "Cilantro", qtyNote: "1 bunch", pantry: "stocked", daysLeft: 2, forMeal: "Pollo al ajillo", list: "market" },
  { id: "g2", ingredientKey: "achiote-paste", name: "Achiote paste", staple: true, pantry: "out", forMeal: "Cochinita pibil", list: "market" },
  { id: "g3", ingredientKey: "pork-shoulder", name: "Pork shoulder", qtyNote: "3 lb", forMeal: "Cochinita pibil", list: "market" },
  { id: "g4", ingredientKey: "olive-oil", name: "Olive oil", staple: true, pantry: "low", qtyNote: "about a third left", list: "costco" },
  { id: "g5", ingredientKey: "limes", name: "Limes", qtyNote: "6", list: "market" },
  { id: "g6", ingredientKey: "ribeye", name: "Ribeye", qtyNote: "2, dry-aged", forMeal: "Cast-iron ribeye", list: "market" },
  { id: "g7", ingredientKey: "yogurt", name: "Whole-milk yogurt", pantry: "stocked", daysLeft: 4, list: "market" },
  { id: "g8", ingredientKey: "red-cabbage", name: "Red cabbage", qtyNote: "half a head", pantry: "stocked", daysLeft: 5, list: "market" },
  { id: "g9", ingredientKey: "corn-tortillas", name: "Corn tortillas", qtyNote: "12", forMeal: "Cochinita pibil", list: "market" },
  { id: "g10", ingredientKey: "eggs", name: "Eggs", staple: true, pantry: "low", qtyNote: "3 left", list: "market" },
  { id: "g11", ingredientKey: "coffee-beans", name: "Coffee beans", staple: true, pantry: "low", qtyNote: "a week or so", list: "costco" },
  { id: "g12", ingredientKey: "milk", name: "Milk", staple: true, pantry: "stocked", daysLeft: 6, list: "market" },
  { id: "g13", ingredientKey: "carrots", name: "Carrots", qtyNote: "3", forMeal: "Lentil soup", list: "market" },
  { id: "g14", ingredientKey: "paper-towels", name: "Paper towels", staple: true, pantry: "out", list: "costco" },
  { id: "g15", ingredientKey: "dish-soap", name: "Dish soap", staple: true, pantry: "low", list: "costco" },
  { id: "g16", ingredientKey: "furnace-filter", name: "Furnace filter", qtyNote: "20x25x1", list: "hardware" },
  { id: "g17", ingredientKey: "brown-lentils", name: "Brown lentils", staple: true, pantry: "stocked", forMeal: "Lentil soup", got: true, list: "costco" },
  { id: "g18", ingredientKey: "garlic", name: "Garlic", staple: true, pantry: "stocked", got: true, list: "market" },
  { id: "g19", ingredientKey: "butter", name: "Butter", staple: true, pantry: "stocked", got: true, list: "market" },
  { id: "g20", ingredientKey: "sherry", name: "Dry sherry", pantry: "stocked", got: true, list: "market" },
];

export const WAITING: Waiting[] = [
  { id: "w1", who: "Landlord", what: "Lease renewal terms", since: "Jun 30", days: 26, thread: true },
  { id: "w2", who: "Aditya", what: "Catan season CSV", since: "Jul 14", days: 12 },
  { id: "w3", who: "Railway support", what: "Egress billing question", since: "Jul 23", days: 3, thread: true, replied: true },
  { id: "w4", who: "Priya", what: "Sign-off on the Q3 roadmap", since: "Jul 17", days: 9, thread: true },
  { id: "w5", who: "Jaren", what: "Whether he's free Aug 8 to test Cambio", since: "Jul 21", days: 5 },
  { id: "w6", who: "Passport agency", what: "Renewal acknowledgement", since: "Jul 2", days: 24, thread: true },
  { id: "w7", who: "Dan", what: "Photos from the Catan night", since: "Jul 20", days: 6 },
];

/* ------------------------------------------------------------------ *
 * Recipes — the Kitchen tab reads these.
 * ------------------------------------------------------------------ */

export type RecipeIngredient = { key: string; name: string; qtyNote?: string };

export type Recipe = {
  slug: string;
  title: string;
  minutes: number;
  serves: number;
  rating: number;
  ingredients: RecipeIngredient[];
};

export const RECIPES: Recipe[] = [
  {
    slug: "pollo-al-ajillo",
    title: "Pollo al ajillo",
    minutes: 45,
    serves: 4,
    rating: 4.5,
    ingredients: [
      { key: "chicken-thighs", name: "Chicken thighs", qtyNote: "6" },
      { key: "garlic", name: "Garlic", qtyNote: "1 head" },
      { key: "olive-oil", name: "Olive oil" },
      { key: "sherry", name: "Dry sherry", qtyNote: "splash" },
      { key: "cilantro", name: "Cilantro", qtyNote: "1 bunch" },
    ],
  },
  {
    slug: "cochinita-pibil",
    title: "Cochinita pibil tacos",
    minutes: 240,
    serves: 6,
    rating: 5,
    ingredients: [
      { key: "pork-shoulder", name: "Pork shoulder", qtyNote: "3 lb" },
      { key: "achiote-paste", name: "Achiote paste" },
      { key: "limes", name: "Limes", qtyNote: "6" },
      { key: "red-cabbage", name: "Red cabbage", qtyNote: "half a head" },
      { key: "corn-tortillas", name: "Corn tortillas", qtyNote: "12" },
    ],
  },
  {
    slug: "lentil-soup",
    title: "Lentil soup",
    minutes: 50,
    serves: 4,
    rating: 4,
    ingredients: [
      { key: "brown-lentils", name: "Brown lentils", qtyNote: "2 cups" },
      { key: "garlic", name: "Garlic" },
      { key: "olive-oil", name: "Olive oil" },
      { key: "carrots", name: "Carrots", qtyNote: "3" },
    ],
  },
  {
    slug: "cast-iron-ribeye",
    title: "Cast-iron ribeye",
    minutes: 25,
    serves: 2,
    rating: 5,
    ingredients: [
      { key: "ribeye", name: "Ribeye", qtyNote: "2, dry-aged" },
      { key: "garlic", name: "Garlic" },
      { key: "butter", name: "Butter" },
    ],
  },
  {
    slug: "shakshuka",
    title: "Shakshuka",
    minutes: 35,
    serves: 3,
    rating: 4,
    ingredients: [
      { key: "eggs", name: "Eggs", qtyNote: "6" },
      { key: "tomatoes", name: "Tinned tomatoes", qtyNote: "2 tins" },
      { key: "red-pepper", name: "Red pepper", qtyNote: "1" },
      { key: "cilantro", name: "Cilantro" },
    ],
  },
  {
    slug: "carnitas",
    title: "Carnitas",
    minutes: 180,
    serves: 6,
    rating: 4.5,
    ingredients: [
      { key: "pork-shoulder", name: "Pork shoulder", qtyNote: "4 lb" },
      { key: "limes", name: "Limes", qtyNote: "4" },
      { key: "corn-tortillas", name: "Corn tortillas" },
    ],
  },
  {
    slug: "tortilla-espanola",
    title: "Tortilla española",
    minutes: 40,
    serves: 4,
    rating: 4.5,
    ingredients: [
      { key: "eggs", name: "Eggs", qtyNote: "8" },
      { key: "olive-oil", name: "Olive oil", qtyNote: "a lot of it" },
      { key: "potatoes", name: "Potatoes", qtyNote: "4" },
    ],
  },
  {
    slug: "chicken-stock",
    title: "Chicken stock",
    minutes: 300,
    serves: 8,
    rating: 4,
    ingredients: [
      { key: "chicken-bones", name: "Chicken bones" },
      { key: "carrots", name: "Carrots", qtyNote: "3" },
      { key: "garlic", name: "Garlic" },
    ],
  },
];

export function recipeFor(slug?: string) {
  return slug ? RECIPES.find((r) => r.slug === slug) : undefined;
}

/** Everything already in the kitchen, by key. */
export const STOCKED_KEYS = new Set(
  GROCERIES.filter((g) => g.pantry === "stocked" || g.got).map(
    (g) => g.ingredientKey,
  ),
);

/* ------------------------------------------------------------------ *
 * Derived views.
 * ------------------------------------------------------------------ */

export const USE_SOON = GROCERIES.filter(
  (g) => g.daysLeft !== undefined && g.pantry === "stocked",
).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

export const TO_BUY = GROCERIES.filter((g) => !g.got);

export const NEEDS_RESTOCK = GROCERIES.filter(
  (g) => g.staple && (g.pantry === "out" || g.pantry === "low"),
);

export const TODAY_MEAL = MEALS.find((m) => m.day === TODAY);

export const TODAY_ITEMS = TASKS.filter((t) => t.dueOn && t.dueOn <= TODAY);

export const UPCOMING = TASKS.filter((t) => t.dueOn && t.dueOn > TODAY).sort(
  (a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? ""),
);

/** Every distinct tag — used for grouping and by the omnibar parser. */
export const TAGS = Array.from(
  new Set(TASKS.map((t) => t.tag).filter(Boolean) as string[]),
).sort();

export function eventsFor(day: string) {
  return EVENTS.filter((e) => e.day === day).sort((a, b) =>
    (a.time ?? "zz").localeCompare(b.time ?? "zz"),
  );
}

export function mealFor(day: string) {
  return MEALS.find((m) => m.day === day);
}

export function itemsFor(day: string) {
  return TASKS.filter((t) => t.dueOn === day);
}

/** "4 days ago" reads as fact. Nothing renders it red. */
export function relativeDay(date: string): string {
  const index = WEEK.findIndex((d) => d.date === date);
  if (index === 0) return "today";
  if (index === 1) return "tomorrow";
  if (index > 1) return WEEK[index].weekday.toLowerCase();
  if (date < TODAY) {
    const days = Math.round((Date.parse(TODAY) - Date.parse(date)) / 86_400_000);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }
  const days = Math.round((Date.parse(date) - Date.parse(TODAY)) / 86_400_000);
  return `in ${days} days`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

/** July 2026 starts on a Wednesday. Used by every month grid. */
export const MONTH_PAD = 3;
export const MONTH_DAYS = 31;
export const MONTH_LABEL = "July 2026";

export function dayOfMonth(n: number) {
  return `2026-07-${String(n).padStart(2, "0")}`;
}
