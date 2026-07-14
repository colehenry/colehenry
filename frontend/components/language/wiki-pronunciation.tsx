"use client";

// French pronunciation tab: sound tables, silent consonants, liaison, and
// the minimal-pairs deck.

import { useQuery } from "@tanstack/react-query";

import { listCards, type Deck } from "@/lib/api/language";
import { Speak } from "./language-shared";

type SoundRow = {
  grapheme: string;
  ipa: string;
  examples: string[];
  note?: string;
};

const SOUND_GROUPS: { title: string; blurb: string; rows: SoundRow[] }[] = [
  {
    title: "Oral vowels",
    blurb: "Letter groups map to one steady vowel — no gliding like English.",
    rows: [
      {
        grapheme: "é · -er · -ez",
        ipa: "/e/",
        examples: ["été", "parler", "chez"],
      },
      {
        grapheme: "è · ê · ai",
        ipa: "/ɛ/",
        examples: ["mère", "fête", "mais"],
      },
      {
        grapheme: "e (muet)",
        ipa: "/ə/",
        examples: ["le", "petit", "samedi"],
        note: "Often dropped entirely in fast speech.",
      },
      { grapheme: "a", ipa: "/a/", examples: ["chat", "madame"] },
      { grapheme: "i · y", ipa: "/i/", examples: ["vie", "stylo"] },
      { grapheme: "ou", ipa: "/u/", examples: ["tout", "jour", "amour"] },
      {
        grapheme: "u",
        ipa: "/y/",
        examples: ["tu", "rue", "musique"],
        note: "Say /i/, then round the lips — not Spanish u.",
      },
      {
        grapheme: "o · au · eau",
        ipa: "/o/",
        examples: ["mot", "chaud", "beau"],
      },
      {
        grapheme: "eu · œu",
        ipa: "/ø/ · /œ/",
        examples: ["peu", "sœur", "fleur"],
      },
      { grapheme: "oi", ipa: "/wa/", examples: ["moi", "voiture", "trois"] },
    ],
  },
  {
    title: "Nasal vowels",
    blurb:
      "Air through the nose, and the n/m is never pronounced. These carry meaning where Spanish uses vowel + n.",
    rows: [
      {
        grapheme: "in · ain · ein · un",
        ipa: "/ɛ̃/",
        examples: ["vin", "pain", "plein", "brun"],
      },
      {
        grapheme: "an · en",
        ipa: "/ɑ̃/",
        examples: ["vent", "blanc", "enfant"],
      },
      { grapheme: "on", ipa: "/ɔ̃/", examples: ["bon", "maison", "pont"] },
    ],
  },
  {
    title: "Consonants & combinations",
    blurb: "The letter groups that don't sound like they look.",
    rows: [
      { grapheme: "ch", ipa: "/ʃ/", examples: ["chat", "chien"] },
      {
        grapheme: "j · g(e,i)",
        ipa: "/ʒ/",
        examples: ["jour", "genou", "girafe"],
      },
      { grapheme: "gn", ipa: "/ɲ/", examples: ["montagne", "gagner"] },
      {
        grapheme: "ill · -il",
        ipa: "/j/",
        examples: ["fille", "travail", "soleil"],
        note: "Exceptions: ville, mille, tranquille use /l/.",
      },
      { grapheme: "qu", ipa: "/k/", examples: ["qui", "musique"] },
      {
        grapheme: "r",
        ipa: "/ʁ/",
        examples: ["rue", "Paris", "parler"],
        note: "Soft, in the throat — never rolled like Spanish rr.",
      },
      { grapheme: "ç", ipa: "/s/", examples: ["ça", "français"] },
      {
        grapheme: "h",
        ipa: "(silent)",
        examples: ["homme", "heure"],
        note: "h muet allows liaison and elision (l'homme).",
      },
    ],
  },
];

const SILENT_EXAMPLES = {
  silent: ["grand", "petit", "trop", "vous", "nez"],
  pronounced: ["avec", "pour", "chef", "avril"],
};

const LIAISONS: { phrase: string; note: string; forbidden?: boolean }[] = [
  { phrase: "les amis", note: "s links as /z/ — lay-za-mi" },
  { phrase: "vous avez", note: "vou-za-vay" },
  { phrase: "un homme", note: "n carries over — œ̃-nɔm" },
  { phrase: "petit ami", note: "the silent t comes back — pə-ti-ta-mi" },
  { phrase: "et aussi", note: "never liaise after et", forbidden: true },
  { phrase: "les héros", note: "h aspiré blocks the link", forbidden: true },
];

export function Pronunciation({
  decks,
  onStudyDeck,
}: {
  decks: Deck[];
  onStudyDeck: (deckId: number) => void;
}) {
  const minimalPairDeck = decks.find((deck) =>
    deck.name.toLowerCase().includes("minimal pairs"),
  );
  const pairs = useQuery({
    queryKey: ["language", "cards", minimalPairDeck?.id],
    queryFn: () => listCards(minimalPairDeck?.id as number),
    enabled: minimalPairDeck != null,
  });

  return (
    <div className="flex flex-col gap-3">
      {SOUND_GROUPS.map((group) => (
        <fieldset key={group.title} className="xp-group">
          <legend>{group.title}</legend>
          <p className="mb-2">{group.blurb}</p>
          <div className="overflow-x-auto">
            <table
              className="xp-listview"
              style={{ background: "transparent" }}
            >
              <thead>
                <tr>
                  <th>Spelling</th>
                  <th>Sound</th>
                  <th>Hear it</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.grapheme}>
                    <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                      {row.grapheme}
                    </td>
                    <td className="xp-ipa" style={{ whiteSpace: "nowrap" }}>
                      {row.ipa}
                    </td>
                    <td>
                      {row.examples.map((word, i) => (
                        <span key={word}>
                          {i > 0 && " · "}
                          <Speak
                            language="fr"
                            text={word}
                            label={word}
                            className="xp-link"
                          />
                        </span>
                      ))}
                      {row.note && <div className="xp-muted">{row.note}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
      ))}

      <fieldset className="xp-group">
        <legend>Silent final consonants</legend>
        <p>
          Final consonants are usually <b>silent</b> — except <b>C</b>, <b>R</b>
          , <b>F</b>, <b>L</b> (think <i>CaReFuL</i>), which usually sound.
        </p>
        <p className="mt-2">
          Silent:{" "}
          {SILENT_EXAMPLES.silent.map((word, i) => (
            <span key={word}>
              {i > 0 && " · "}
              <Speak language="fr" text={word} label={word} />
            </span>
          ))}
        </p>
        <p>
          Pronounced:{" "}
          {SILENT_EXAMPLES.pronounced.map((word, i) => (
            <span key={word}>
              {i > 0 && " · "}
              <Speak language="fr" text={word} label={word} />
            </span>
          ))}
        </p>
      </fieldset>

      <fieldset className="xp-group">
        <legend>Liaison</legend>
        <p className="mb-2">
          A silent final consonant is pronounced when the next word starts with
          a vowel — required inside noun and verb groups.
        </p>
        <table className="xp-listview" style={{ background: "transparent" }}>
          <tbody>
            {LIAISONS.map((row) => (
              <tr key={row.phrase}>
                <td style={{ width: 1, whiteSpace: "nowrap" }}>
                  {row.forbidden ? "✗" : "✓"}
                </td>
                <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                  <Speak language="fr" text={row.phrase} label={row.phrase} />
                </td>
                <td className="xp-muted">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>

      <div className="flex items-center justify-between">
        <span style={{ fontWeight: 700 }}>Minimal pairs</span>
        {minimalPairDeck && (
          <button
            type="button"
            className="xp-btn is-small"
            onClick={() => onStudyDeck(minimalPairDeck.id)}
          >
            Study these
          </button>
        )}
      </div>

      <div
        className="overflow-x-auto border"
        style={{ borderColor: "var(--xp-well-border)" }}
      >
        <table className="xp-listview">
          <thead>
            <tr>
              <th>Pair</th>
              <th>IPA</th>
              <th>Contrast</th>
              <th style={{ width: 1 }} />
            </tr>
          </thead>
          <tbody>
            {pairs.data?.map((card) => (
              <tr key={card.id}>
                <td style={{ fontWeight: 700 }}>{card.front}</td>
                <td className="xp-ipa">{card.ipa}</td>
                <td>{card.back}</td>
                <td>
                  <Speak
                    language="fr"
                    text={card.front}
                    url={card.audio_url || undefined}
                  />
                </td>
              </tr>
            ))}
            {pairs.isLoading && (
              <tr>
                <td colSpan={4} className="xp-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!minimalPairDeck && (
              <tr>
                <td colSpan={4} className="xp-muted">
                  Run <code>python -m app.seed_language</code> to create the
                  minimal-pair deck.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
