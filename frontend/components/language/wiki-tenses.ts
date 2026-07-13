// Tense/person constants shared by the wiki search preview and the
// conjugation center. Keep in sync with TENSE_LABELS in the backend
// (app/routers/language/verbs.py).

import type { LanguageCode } from "@/lib/api/language";

export type TenseOption = { mood: string; tense: string; label: string };

export const TENSES = [
  { mood: "indicatif", tense: "présent", label: "Présent" },
  { mood: "indicatif", tense: "passé-composé", label: "Passé composé" },
  { mood: "indicatif", tense: "imparfait", label: "Imparfait" },
  { mood: "indicatif", tense: "futur-proche", label: "Futur proche" },
  { mood: "indicatif", tense: "futur-simple", label: "Futur simple" },
  { mood: "conditionnel", tense: "présent", label: "Conditionnel" },
  { mood: "subjonctif", tense: "présent", label: "Subjonctif" },
  { mood: "imperatif", tense: "présent", label: "Impératif" },
  { mood: "indicatif", tense: "passé-simple", label: "Passé simple" },
] as const;

export const ES_TENSES = [
  { mood: "indicativo", tense: "presente", label: "Presente" },
  {
    mood: "indicativo",
    tense: "pretérito-perfecto-compuesto",
    label: "Pretérito perfecto",
  },
  { mood: "indicativo", tense: "pretérito-imperfecto", label: "Imperfecto" },
  { mood: "indicativo", tense: "futuro-próximo", label: "Futuro próximo" },
  { mood: "indicativo", tense: "futuro", label: "Futuro" },
  {
    mood: "indicativo",
    tense: "pretérito-perfecto-simple",
    label: "Indefinido",
  },
  { mood: "condicional", tense: "presente", label: "Condicional" },
  { mood: "subjuntivo", tense: "presente", label: "Subjuntivo" },
  { mood: "imperativo", tense: "afirmativo", label: "Imperativo" },
] as const;

const PERSON_SLOT_LABELS: Record<string, string> = {
  "1s": "1st singular",
  "2s": "2nd singular",
  "3s": "3rd singular",
  "1p": "1st plural",
  "2p": "2nd plural",
  "3p": "3rd plural",
};

export function personSlotLabel(person: string): string {
  return PERSON_SLOT_LABELS[person] ?? person;
}

export function localizedMood(slotKey: string, language: LanguageCode): string {
  const mood = slotKey.split(":", 1)[0];
  if (mood === "imperative") {
    return language === "fr" ? "imperatif" : "imperativo";
  }
  if (mood === "subjunctive") {
    return language === "fr" ? "subjonctif" : "subjuntivo";
  }
  return mood;
}
