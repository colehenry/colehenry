export type ConjugationLanguage = "fr" | "es";

const FR_DISPLAY_SUBJECTS: Record<string, string> = {
  "1s": "je",
  "2s": "tu",
  "3s": "il/elle",
  "1p": "nous",
  "2p": "vous",
  "3p": "ils/elles",
};

const ES_DISPLAY_SUBJECTS: Record<string, string> = {
  "1s": "yo",
  "2s": "tú",
  "3s": "él/ella",
  "1p": "nosotros",
  "2p": "vosotros",
  "3p": "ellos/ellas",
};

const FR_SPACED_REFLEXIVE_CLITICS = new Set([
  "me",
  "te",
  "se",
  "nous",
  "vous",
]);

function frenchFiniteSoundKey(form: string, person: string): string {
  if (form === "es" || form === "est") return "è";
  let key = form.replaceAll("î", "i");
  if (person === "1s" || person === "2s") {
    key = key.replace(/[sx]$/, "").replace(/[td]$/, "").replace(/e$/, "");
  } else if (person === "3s") {
    key = key.replace(/[td]$/, "").replace(/e$/, "");
  } else if (person === "1p") {
    key = key.replace(/s$/, "");
  } else if (person === "3p") {
    key = key.endsWith("ent") ? key.slice(0, -3) : key.replace(/t$/, "");
  }
  return key;
}

/** Conservative comparison key for repeated conjugation sounds in one tense. */
export function conjugationSoundKey(
  form: string,
  person: string,
  language: ConjugationLanguage,
): string {
  const words = form
    .normalize("NFC")
    .toLocaleLowerCase(language)
    .replaceAll("’", "'")
    .trim()
    .split(/\s+/);
  if (language !== "fr" || !words[0]) return words.join(" ");

  const finiteIndex =
    FR_SPACED_REFLEXIVE_CLITICS.has(words[0]) && words.length > 1 ? 1 : 0;
  const elidedClitic = words[finiteIndex].match(/^([mts]')(.+)$/);
  if (elidedClitic) {
    words[finiteIndex] = `${elidedClitic[1]}${frenchFiniteSoundKey(
      elidedClitic[2],
      person,
    )}`;
  } else {
    words[finiteIndex] = frenchFiniteSoundKey(words[finiteIndex], person);
  }
  return words.join(" ");
}

/** Complete learner-facing form: "j'aime", "il/elle aime", "yo amo". */
export function displayConjugation(
  person: string,
  form: string,
  mood: string,
  language: ConjugationLanguage = "fr",
): string {
  if (!form || mood === "imperatif" || mood === "imperativo") return form;
  if (language === "es") {
    const subject = ES_DISPLAY_SUBJECTS[person] ?? person;
    const phrase = `${subject} ${form}`;
    return mood === "subjuntivo" ? `que ${phrase}` : phrase;
  }
  const subject = FR_DISPLAY_SUBJECTS[person] ?? person;
  const phrase =
    subject === "je" && /^[aeiouyàâäéèêëîïôöùûüh]/i.test(form)
      ? `j'${form}`
      : `${subject} ${form}`;
  if (mood === "subjonctif") {
    return /^[iî]/i.test(phrase) ? `qu'${phrase}` : `que ${phrase}`;
  }
  return phrase;
}
