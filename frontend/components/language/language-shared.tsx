"use client";

import { useState } from "react";

import { fetchSpeechUrl, type Card, type LanguageCode } from "@/lib/api/language";

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

export function genderLabel(gender: string): string {
  if (gender === "m") return "masculine";
  if (gender === "f") return "feminine";
  return gender;
}

/** "je" + "aime" → "j'aime"; "il/elle" → "il". Mirrors the backend rule. */
export function joinSubject(person: string, form: string): string {
  const subject = person.startsWith("ils") ? "ils" : person.startsWith("il") ? "il" : person;
  if (subject === "je" && /^[aeiouyàâäéèêëîïôöùûüh]/i.test(form)) {
    return `j'${form}`;
  }
  return `${subject} ${form}`;
}

const ES_SUBJECTS: Record<string, string> = {
  "1s": "yo",
  "2s": "tú",
  "3s": "él",
  "1p": "nosotros",
  "2p": "vosotros",
  "3p": "ellos",
};

/** Spoken form of a conjugation cell — FR mirrors the backend exactly. */
export function spokenConjugation(
  person: string,
  form: string,
  mood: string,
  language: LanguageCode = "fr",
): string {
  if (!form || mood === "imperatif" || mood === "imperativo") return form;
  if (language === "es") {
    const subject = ES_SUBJECTS[person] ?? person;
    const phrase = `${subject} ${form}`;
    return mood === "subjuntivo" ? `que ${phrase}` : phrase;
  }
  const phrase = joinSubject(person, form);
  if (mood === "subjonctif") {
    return /^[iî]/i.test(phrase) ? `qu'${phrase}` : `que ${phrase}`;
  }
  return phrase;
}

/** The text TTS should read for a card (full sentence for cloze, else word). */
export function audioText(card: Card): string {
  if (card.card_type === "cloze" && card.front.includes("___")) {
    return card.front.replace("___", card.back);
  }
  if (card.direction === "production") return card.back;
  return card.front;
}

/** Like audioText, but conjugation drills speak subject + verb ("je suis"). */
export function cardSpeechText(card: Card): string {
  if (card.source === "conjugation") {
    const person = card.front.split(" · ")[0]?.trim();
    if (person) return joinSubject(person, card.back);
  }
  return audioText(card);
}

export function playAudio(url: string) {
  if (!url) return;
  void new Audio(url).play().catch(() => {});
}

function browserSpeak(language: LanguageCode, text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === "fr" ? "fr-FR" : "es-ES";
  utterance.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

// One URL per (language, text) per page load; "" = server TTS unavailable.
const speechUrlCache = new Map<string, Promise<string>>();

/**
 * Speak any FR/ES text: cached server TTS when configured, otherwise the
 * browser's speech synthesis. `knownUrl` (e.g. a card's audio_url) skips
 * the round-trip.
 */
export async function speakText(
  language: LanguageCode,
  text: string,
  knownUrl?: string,
): Promise<void> {
  text = text.trim();
  if (!text) return;
  if (knownUrl) {
    playAudio(knownUrl);
    return;
  }
  const key = `${language}:${text}`;
  let pending = speechUrlCache.get(key);
  if (!pending) {
    pending = fetchSpeechUrl(language, text).catch(() => "");
    speechUrlCache.set(key, pending);
  }
  const url = await pending;
  if (url) {
    playAudio(url);
  } else {
    browserSpeak(language, text);
  }
}

/** Tap-to-hear link — drop next to any French/Spanish word or phrase. */
export function Speak({
  language,
  text,
  url,
  label = "[listen]",
  className = "xp-link",
  title,
}: {
  language: LanguageCode;
  text: string;
  url?: string;
  label?: string;
  className?: string;
  title?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      title={title ?? `Listen: ${text}`}
      aria-label={`Listen: ${text}`}
      disabled={busy}
      onClick={async (event) => {
        event.stopPropagation();
        setBusy(true);
        try {
          await speakText(language, text, url);
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </button>
  );
}
