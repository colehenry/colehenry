/** French diacritics: what each mark is called and what it does. */

export type AccentInfo = {
  mark: string;
  name: string;
  letters: string;
  sound: string;
  role: string;
  examples: string;
};

export const ACCENTS: AccentInfo[] = [
  { mark: "´", name: "accent aigu", letters: "é", sound: "/e/", role: "closed e, like Spanish 'e' in 'café'", examples: "été · café · parlé" },
  { mark: "`", name: "accent grave", letters: "è · à · ù", sound: "è = /ɛ/", role: "open e; on a / u it only tells words apart (a/à, ou/où)", examples: "mère · très · à · où" },
  { mark: "^", name: "accent circonflexe", letters: "â · ê · î · ô · û", sound: "ê = /ɛ/, ô = /o/", role: "a lost letter (usually s): forêt ← forest, hôpital ← hospital", examples: "être · fête · hôtel · sûr" },
  { mark: "¨", name: "tréma", letters: "ë · ï · ü", sound: "vowel kept separate", role: "read the two vowels apart: naïf = na-ïf, not 'nèf'", examples: "naïf · Noël · maïs" },
  { mark: "¸", name: "cédille", letters: "ç", sound: "/s/", role: "keeps c soft before a / o / u", examples: "ça · français · garçon" },
  { mark: "œ", name: "e dans l'o", letters: "œ", sound: "/ø/ · /œ/", role: "one letter, one sound - like eu", examples: "œuf · sœur · cœur" },
  { mark: "'", name: "apostrophe (élision)", letters: "l' · j' · n' · qu'", sound: "-", role: "a vowel dropped before another vowel: le ami → l'ami", examples: "l'eau · j'ai · qu'est-ce" },
];

const ACCENT_BY_CHAR: Record<string, AccentInfo> = {};
for (const info of ACCENTS) {
  for (const letter of info.letters.split(" · ")) {
    ACCENT_BY_CHAR[letter.replace(/'$/, "")] = info;
    if (letter.length === 1) ACCENT_BY_CHAR[letter.toUpperCase()] = info;
  }
}

export function accentFor(char: string): AccentInfo | undefined {
  return ACCENT_BY_CHAR[char];
}

/** Accented letters present in `expected` that the learner's answer lacks - "é (accent aigu, /e/)". */
export function missingAccents(expected: string, given: string): { letter: string; info: AccentInfo }[] {
  const wanted = new Set([...expected.toLowerCase()].filter((c) => accentFor(c)));
  const have = new Set([...given.toLowerCase()]);
  return [...wanted].filter((c) => !have.has(c)).map((letter) => ({ letter, info: accentFor(letter)! }));
}
