"use client";

import { useState } from "react";

import { fetchSpeechUrl, type Card, type LanguageCode } from "@/lib/api/language";
import { nounDisplay, splitArticle, splitForms } from "@/lib/french/articles";

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

/**
 * French text with any leading article coloured by gender (blue masculine,
 * pink feminine). Handles "un ami / une amie" style alternates. Plain text
 * when nothing leads with an article.
 */
export function Fr({ text, className, say = false }: { text: string; className?: string; say?: boolean }) {
  const forms = splitForms(text);
  const parts = forms.map((form) => splitArticle(form));
  // `say`: the text itself is the play button - every alternate ("un ami / une amie") is spoken in turn
  const sayProps = say
    ? {
        role: "button" as const,
        tabIndex: -1,
        title: "► écouter",
        onClick: (event: React.MouseEvent) => {
          event.stopPropagation();
          void speakText("fr", text);
        },
      }
    : {};
  const cls = [className, say ? "fr-say" : ""].filter(Boolean).join(" ") || undefined;
  if (!parts.some((part) => part.gender)) return <span className={cls} {...sayProps}>{text}</span>;
  return (
    <span className={cls} {...sayProps}>
      {parts.map((part, i) => (
        <span key={`${part.article}${part.word}${i}`}>
          {i > 0 && " / "}
          {part.article && (
            <span className={`fr-article ${part.gender ? `is-${part.gender}` : ""}`}>{part.article}</span>
          )}
          {part.article && !part.article.endsWith("'") ? " " : ""}
          {part.word}
        </span>
      ))}
    </span>
  );
}

const FR_SUBJECTS: Record<string, string> = {
  "1s": "je",
  "2s": "tu",
  "3s": "il",
  "1p": "nous",
  "2p": "vous",
  "3p": "ils",
};

/** "je" + "aime" → "j'aime"; "il/elle" → "il" for speech. */
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

/** Spoken form of a conjugation cell - FR mirrors the backend exactly. */
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
  const subject = FR_SUBJECTS[person] ?? person;
  const phrase = joinSubject(subject, form);
  if (mood === "subjonctif") {
    return /^[iî]/i.test(phrase) ? `qu'${phrase}` : `que ${phrase}`;
  }
  return phrase;
}

/** A French noun card shows its article ("la maison"); other text passes through. */
export function cardFrench(card: Card, text: string): string {
  if (!card.gender || card.card_type === "cloze" || /\s/.test(text.trim()) || splitArticle(text).article) return text;
  return nounDisplay(text.trim(), card.gender, "noun");
}

/** The text TTS should read for a card (full sentence for cloze, else word). */
export function audioText(card: Card): string {
  if (card.card_type === "cloze" && card.front.includes("___")) {
    return card.front.replace("___", card.back);
  }
  if (card.direction === "production") return cardFrench(card, card.back);
  return cardFrench(card, card.front);
}

/** Like audioText, but conjugation drills speak subject + verb ("je suis"). */
export function cardSpeechText(card: Card): string {
  if (card.source === "conjugation") {
    const person = card.front.split(" · ")[0]?.trim();
    if (person) return joinSubject(person, card.back);
  }
  return audioText(card);
}

/** Plays a clip; resolves when it ends (or fails) so clips can be chained. */
export function playAudio(url: string): Promise<void> {
  if (!url) return Promise.resolve();
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.play().catch(() => resolve());
  });
}

function browserSpeak(language: LanguageCode, text: string): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "fr" ? "fr-FR" : "es-ES";
    utterance.rate = 0.9;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
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
    await playAudio(knownUrl);
    return;
  }
  // "un ami / une amie" - alternates are spoken one after the other
  const forms = splitForms(text);
  if (forms.length > 1) {
    for (const form of forms) {
      await speakText(language, form);
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
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
    await playAudio(url);
  } else {
    await browserSpeak(language, text);
  }
}

/** Tap-to-hear link - drop next to any French/Spanish word or phrase. */
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
