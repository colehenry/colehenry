import type { Card, LanguageCode } from "@/lib/api/language";

/** Shared helpers for the language tool. */

export function languageName(language: LanguageCode): string {
  return language === "fr" ? "French" : "Spanish";
}

export function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function shortDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

/** The text TTS should read for a card (full sentence for cloze, else word). */
export function audioText(card: Card): string {
  if (card.card_type === "cloze" && card.front.includes("___")) {
    return card.front.replace("___", card.back);
  }
  if (card.direction === "production") return card.back;
  return card.front;
}

export function playAudio(url: string) {
  if (!url) return;
  void new Audio(url).play().catch(() => {});
}
