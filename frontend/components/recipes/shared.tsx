import type { Locale } from "@/lib/i18n/locale";
import type { Ingredient, Recipe, RecipeListItem } from "@/lib/api/recipes";

/** Shared helpers for the recipe tin. */

export const TOKEN_RE = /\{([a-z0-9-]+)\}/g;

/* --- quantities ---------------------------------------------------------- */

const VULGAR: [number, string][] = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
];

/** 2.25 → "2¼", 0.75 → "¾", 3 → "3". Falls back to decimals for odd values. */
export function formatQty(qty: number): string {
  if (qty <= 0) return "";
  const whole = Math.floor(qty);
  const frac = qty - whole;
  if (frac < 0.01) return String(whole);
  for (const [value, glyph] of VULGAR) {
    if (Math.abs(frac - value) < 0.02) {
      return whole > 0 ? `${whole}${glyph}` : glyph;
    }
  }
  const rounded = Math.round(qty * 100) / 100;
  return String(rounded);
}

/** Units that never take a plural "s" (abbreviations, metric). */
const INVARIANT_UNITS = new Set([
  "tsp",
  "tbsp",
  "cdta",
  "cda",
  "oz",
  "g",
  "kg",
  "ml",
  "l",
  "lb",
]);

export function formatUnit(unit: string, qty: number | null): string {
  if (!unit) return "";
  if (qty === null || qty <= 1 || INVARIANT_UNITS.has(unit.toLowerCase())) {
    return unit;
  }
  return unit.endsWith("s") ? unit : `${unit}s`;
}

export type UnitSystem = "us" | "metric";

/** Volume units → ml, weight units → g. Covers EN + ES cookbook units. */
const UNIT_TO_ML: Record<string, number> = {
  cup: 240,
  taza: 240,
  tbsp: 15,
  cda: 15,
  tsp: 5,
  cdta: 5,
  "fl oz": 30,
  pint: 473,
  quart: 946,
};
const UNIT_TO_G: Record<string, number> = {
  oz: 28,
  lb: 454,
  stick: 113,
  barra: 113,
};

/** Round to kitchen-usable metric amounts; step up to l/kg past 1000. */
function metricAmount(value: number, small: string, big: string) {
  if (value >= 1000) {
    return { qty: Math.round(value / 50) * 50 / 1000, unit: big };
  }
  const rounded =
    value >= 100 ? Math.round(value / 5) * 5 : Math.round(value * 2) / 2;
  return { qty: rounded, unit: small };
}

/** null when the unit isn't convertible (e.g. "clove", "can", or empty). */
export function toMetric(
  qty: number,
  unit: string,
): { qty: number; unit: string } | null {
  const u = unit.trim().toLowerCase().replace(/\.$/, "");
  if (UNIT_TO_ML[u]) return metricAmount(qty * UNIT_TO_ML[u], "ml", "l");
  if (UNIT_TO_G[u]) return metricAmount(qty * UNIT_TO_G[u], "g", "kg");
  return null;
}

/**
 * "2¼ cups all-purpose flour" - the full inline form a token expands to.
 * In metric mode convertible units render as "540 ml flour" (decimals, no
 * vulgar fractions); everything else falls back to the US form.
 */
export function formatAmount(
  ing: Pick<Ingredient, "qty" | "unit" | "name">,
  scale: number,
  units: UnitSystem = "us",
): string {
  if (ing.qty === null) return ing.name;
  const qty = ing.qty * scale;
  if (units === "metric") {
    const metric = toMetric(qty, ing.unit);
    if (metric) {
      return `${metric.qty} ${metric.unit} ${ing.name}`;
    }
  }
  return [formatQty(qty), formatUnit(ing.unit, qty), ing.name]
    .filter(Boolean)
    .join(" ");
}

/* --- localization -------------------------------------------------------- */

export type LocalizedRecipe = {
  title: string;
  description: string;
  /** full ingredient rows with names/units/notes in the active language */
  ingredients: Ingredient[];
  steps: { text: string }[];
  /** true when showing a machine translation rather than the source text */
  machine: boolean;
  /** true when the active locale differs from the source and no translation exists yet */
  pending: boolean;
};

/**
 * Pick the recipe's text for the active locale: source language as written,
 * other language from `translations` when the background LLM run has landed.
 */
export function localizeRecipe(
  recipe: Pick<
    Recipe,
    "title" | "description" | "ingredients" | "steps" | "language" | "translations"
  >,
  locale: Locale,
): LocalizedRecipe {
  const base = {
    title: recipe.title,
    description: recipe.description,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    machine: false,
    pending: false,
  };
  if (locale === recipe.language) return base;
  const tr = recipe.translations[locale];
  if (
    !tr ||
    tr.ingredients.length !== recipe.ingredients.length ||
    tr.steps.length !== recipe.steps.length
  ) {
    return { ...base, pending: true };
  }
  return {
    title: tr.title,
    description: tr.description,
    ingredients: recipe.ingredients.map((ing, i) => ({
      ...ing,
      name: tr.ingredients[i].name || ing.name,
      unit: tr.ingredients[i].unit,
      note: tr.ingredients[i].note,
    })),
    steps: tr.steps,
    machine: true,
    pending: false,
  };
}

/** List items carry translations too - localize just the card face. */
export function localizeListItem(
  item: RecipeListItem,
  locale: Locale,
): { title: string; description: string } {
  if (locale === item.language) {
    return { title: item.title, description: item.description };
  }
  const tr = item.translations[locale];
  return {
    title: tr?.title || item.title,
    description: tr?.description ?? item.description,
  };
}

/* --- step token rendering ------------------------------------------------ */

/**
 * Expand {key} tokens into amount-carrying ingredient mentions. Returns
 * segments so the caller can style mentions (and skip unknown tokens
 * gracefully - validation upstream should make that impossible).
 */
export function renderStepSegments(
  text: string,
  ingredients: Ingredient[],
  scale: number,
  units: UnitSystem = "us",
): { text: string; ingredientKey?: string }[] {
  const byKey = new Map(ingredients.map((i) => [i.key, i]));
  const segments: { text: string; ingredientKey?: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const ing = byKey.get(match[1]);
    if (!ing) continue;
    if (match.index > last) segments.push({ text: text.slice(last, match.index) });
    segments.push({
      text: formatAmount(ing, scale, units),
      ingredientKey: ing.key,
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

/* --- ingredient thumbnails ------------------------------------------------ */

/**
 * TheMealDB serves free, keyless ingredient photos by English name.
 * The <img> onError handler hides misses; emoji fallback comes from
 * ingredientEmoji below.
 */
export function mealDbThumb(englishName: string): string {
  const cleaned = englishName.trim().toLowerCase().replace(/\s+/g, "%20");
  return `https://www.themealdb.com/images/ingredients/${cleaned}-small.png`;
}

const EMOJI_RULES: [RegExp, string][] = [
  [/butter|mantequilla/i, "🧈"],
  [/egg|huevo/i, "🥚"],
  [/flour|harina/i, "🌾"],
  [/sugar|azúcar/i, "🍬"],
  [/chocolate|cocoa|cacao/i, "🍫"],
  [/milk|cream|leche|nata|crema/i, "🥛"],
  [/cheese|queso/i, "🧀"],
  [/garlic|ajo/i, "🧄"],
  [/onion|cebolla/i, "🧅"],
  [/tomato|tomate/i, "🍅"],
  [/pepper|chile|pimiento/i, "🌶️"],
  [/carrot|zanahoria/i, "🥕"],
  [/potato|papa|patata/i, "🥔"],
  [/lemon|lime|limón|lima/i, "🍋"],
  [/chicken|pollo/i, "🍗"],
  [/beef|steak|res|ternera/i, "🥩"],
  [/pork|bacon|cerdo|tocino/i, "🥓"],
  [/fish|salmon|pescado|salmón/i, "🐟"],
  [/shrimp|camarón|gamba/i, "🦐"],
  [/rice|arroz/i, "🍚"],
  [/bread|pan\b/i, "🍞"],
  [/oil|aceite/i, "🫒"],
  [/honey|miel/i, "🍯"],
  [/salt|sal\b/i, "🧂"],
  [/nut|almond|walnut|pecan|nuez|almendra/i, "🥜"],
  [/vanilla|vainilla/i, "🌼"],
  [/apple|manzana/i, "🍎"],
  [/banana|plátano/i, "🍌"],
  [/berry|fresa|mora|arándano/i, "🍓"],
  [/herb|basil|cilantro|parsley|albahaca|perejil/i, "🌿"],
];

export function ingredientEmoji(name: string): string {
  for (const [re, emoji] of EMOJI_RULES) {
    if (re.test(name)) return emoji;
  }
  return "🥄";
}

/* --- stars ------------------------------------------------------------------ */

/** ★★★★½ - the /5 rating as a star row (half-star steps). */
export function Stars({ rating }: { rating: number }) {
  const five = Math.round(rating * 2) / 2;
  const cells = Array.from({ length: 5 }, (_, i) => {
    if (five >= i + 1) return "full";
    if (five >= i + 0.5) return "half";
    return "empty";
  });
  return (
    <span
      className="rb-stars"
      role="img"
      aria-label={`${rating} / 5`}
      title={`${rating} / 5`}
    >
      {cells.map((cell, i) =>
        cell === "full" ? (
          <span key={i}>★</span>
        ) : cell === "half" ? (
          <span key={i} className="is-half">
            ★
          </span>
        ) : (
          <span key={i} className="is-empty">
            ★
          </span>
        ),
      )}
    </span>
  );
}

/* --- misc ----------------------------------------------------------------- */

export function formatPostedDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es" : "en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

/** Cloudinary URLs get sized on the fly; other URLs pass through. */
export function cloudinaryResize(url: string, width: number): string {
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
}
