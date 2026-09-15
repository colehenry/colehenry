/** French noun articles - mirrors backend/app/curriculum/articles.py. */

const VOWEL_START = /^[aeiouyàâäéèêëîïôöùûüœæh]/i;
const ARTICLE_RE = /^(de l'|de la|du|des|les|le|la|l'|une|un)\s*/i;

const ARTICLE_GENDER: Record<string, "m" | "f"> = { le: "m", un: "m", du: "m", la: "f", une: "f", "de la": "f" };

const DISPLAY_OVERRIDES: Record<string, string> = {
  "ami / amie": "un ami / une amie",
  "copain / copine": "un copain / une copine",
  "an / ans": "un an / des ans",
  gens: "les gens",
  vacances: "les vacances",
  eau: "l'eau",
  argent: "l'argent",
};

export function splitForms(french: string): string[] {
  return french
    .split(/\s*\/\s*/)
    .map((f) => f.trim())
    .filter(Boolean);
}

/** Definite article, or the indefinite one when the definite would elide. */
export function articleFor(word: string, gender: string): string {
  if (VOWEL_START.test(word)) return gender === "f" ? "une" : "un";
  return gender === "f" ? "la" : "le";
}

/** Display form for any headword; non-nouns come back unchanged. */
export function nounDisplay(french: string, gender: string, pos: string): string {
  if (pos !== "noun" || !gender) return french;
  const override = DISPLAY_OVERRIDES[french];
  if (override) return override;
  return splitForms(french)
    .map((form) => `${articleFor(form, gender)} ${form}`)
    .join(" / ");
}

export type SplitArticle = { article: string; word: string; gender: "m" | "f" | "" };

/** ("la", "maison") for "la maison"; article "" when none leads. */
export function splitArticle(text: string): SplitArticle {
  const m = ARTICLE_RE.exec(text.trim());
  if (!m) return { article: "", word: text.trim(), gender: "" };
  const article = m[1].toLowerCase();
  return { article: m[1], word: text.trim().slice(m[0].length), gender: ARTICLE_GENDER[article] ?? "" };
}

/** Why an article-bearing answer missed: "missing", "genre", or "". */
export function wrongArticle(expected: string, given: string): "missing" | "genre" | "" {
  const exp = splitArticle(expected);
  if (!exp.article) return "";
  const got = splitArticle(given);
  if (got.word.trim().toLowerCase() !== exp.word.trim().toLowerCase()) return "";
  if (!got.article) return "missing";
  if (exp.gender && got.gender && exp.gender !== got.gender) return "genre";
  return "";
}

export function articleIssue(answer: string, accepted: string[]): "missing" | "genre" | "" {
  const given = answer.trim().toLowerCase();
  for (const variant of accepted) {
    const issue = wrongArticle(variant.toLowerCase(), given);
    if (issue) return issue;
  }
  return "";
}

/** Every accent the learner may need to type, in keyboard-ish order. */
export const FRENCH_ACCENTS = ["é", "è", "ê", "ë", "à", "â", "ç", "î", "ï", "ô", "ù", "û", "ü", "œ"] as const;
