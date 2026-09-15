export type ConjugationLanguage = "fr" | "es";

const FR_DISPLAY_SUBJECTS: Record<string, string> = {
  "1s": "je",
  "2s": "tu",
  "3s": "il/elle",
  "1p": "nous",
  "2p": "vous",
  "3p": "ils/elles",
};

const FR_PREVIEW_SUBJECTS: Record<string, string> = {
  ...FR_DISPLAY_SUBJECTS,
  "3s": "il / elle / on",
  "3p": "ils / elles",
};

const FR_SPOKEN_SUBJECTS: Record<string, string> = {
  "1s": "je",
  "2s": "tu",
  "3s": "il",
  "1p": "nous",
  "2p": "vous",
  "3p": "ils",
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

/** Natural spoken French: person codes become one subject, never a slash-list. */
export function joinFrenchSubject(person: string, form: string): string {
  const personLabel = FR_SPOKEN_SUBJECTS[person] ?? person;
  const subject = personLabel.startsWith("ils")
    ? "ils"
    : personLabel.startsWith("il")
      ? "il"
      : personLabel;
  if (subject === "je" && /^[aeiouyàâäéèêëîïôöùûüh]/i.test(form)) {
    return `j'${form}`;
  }
  return `${subject} ${form}`;
}

/** Speech text for a conjugation cell, including its subject where applicable. */
export function spokenConjugation(
  person: string,
  form: string,
  mood: string,
  language: ConjugationLanguage = "fr",
): string {
  if (!form || mood === "imperatif" || mood === "imperativo") return form;
  if (language === "es") {
    const subject = ES_DISPLAY_SUBJECTS[person]?.split("/")[0] ?? person;
    const phrase = `${subject} ${form}`;
    return mood === "subjuntivo" ? `que ${phrase}` : phrase;
  }
  const phrase = joinFrenchSubject(person, form);
  if (mood === "subjonctif") {
    return /^[iî]/i.test(phrase) ? `qu'${phrase}` : `que ${phrase}`;
  }
  return phrase;
}

/** Complete compact row label; unlike speech, includes all 3rd-person options. */
export function verbPreviewLabel(person: string, form: string): string {
  const spoken = spokenConjugation(person, form, "indicatif");
  if (person === "1s" && spoken.startsWith("j'")) {
    return spoken.replace("'", "’");
  }
  return `${FR_PREVIEW_SUBJECTS[person] ?? person} ${form}`;
}
