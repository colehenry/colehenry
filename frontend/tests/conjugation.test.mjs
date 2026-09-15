import assert from "node:assert/strict";
import test from "node:test";

import {
  conjugationSoundKey,
  displayConjugation,
  spokenConjugation,
  verbPreviewLabel,
} from "../lib/conjugation.ts";

const FR = "fr";

test("displays complete French and Spanish conjugations", () => {
  assert.equal(displayConjugation("1s", "aime", "indicatif", FR), "j'aime");
  assert.equal(
    displayConjugation("1s", "me balade", "indicatif", FR),
    "je me balade",
  );
  assert.equal(
    displayConjugation("3s", "aime", "indicatif", FR),
    "il/elle aime",
  );
  assert.equal(
    displayConjugation("1s", "amo", "indicativo", "es"),
    "yo amo",
  );
});

test("groups only the homophonous aimer present forms", () => {
  const forms = ["aime", "aimes", "aime", "aimons", "aimez", "aiment"];
  const persons = ["1s", "2s", "3s", "1p", "2p", "3p"];
  const keys = forms.map((form, index) =>
    conjugationSoundKey(form, persons[index], FR),
  );

  assert.deepEqual(keys, ["aim", "aim", "aim", "aimon", "aimez", "aim"]);
});

test("keeps aimer imperative forms in separate sound groups", () => {
  const keys = [
    conjugationSoundKey("aime", "2s", FR),
    conjugationSoundKey("aimons", "1p", FR),
    conjugationSoundKey("aimez", "2p", FR),
  ];

  assert.equal(new Set(keys).size, keys.length);
});

test("keeps conservative irregular and reflexive distinctions", () => {
  assert.equal(conjugationSoundKey("finis", "1s", FR), "fini");
  assert.equal(conjugationSoundKey("finit", "3s", FR), "fini");
  assert.equal(conjugationSoundKey("finissent", "3p", FR), "finiss");
  assert.equal(conjugationSoundKey("vois", "1s", FR), "voi");
  assert.equal(conjugationSoundKey("voient", "3p", FR), "voi");
  assert.equal(conjugationSoundKey("es", "2s", FR), "è");
  assert.equal(conjugationSoundKey("est", "3s", FR), "è");
  assert.notEqual(
    conjugationSoundKey("me balade", "1s", FR),
    conjugationSoundKey("te balades", "2s", FR),
  );
});

test("uses exact spelling for Spanish", () => {
  assert.notEqual(
    conjugationSoundKey("amo", "1s", "es"),
    conjugationSoundKey("amas", "2s", "es"),
  );
});

test("speaks the subject and verb for every French present form", () => {
  assert.equal(spokenConjugation("1s", "suis", "indicatif"), "je suis");
  assert.equal(spokenConjugation("2s", "es", "indicatif"), "tu es");
  assert.equal(spokenConjugation("1p", "sommes", "indicatif"), "nous sommes");
  assert.equal(spokenConjugation("3p", "sont", "indicatif"), "ils sont");
});

test("elides je before a vowel in speech and popup labels", () => {
  assert.equal(spokenConjugation("1s", "ai", "indicatif"), "j'ai");
  assert.equal(spokenConjugation("1s", "aime", "indicatif"), "j'aime");
  assert.equal(verbPreviewLabel("1s", "ai"), "j’ai");
  assert.equal(verbPreviewLabel("1s", "aime"), "j’aime");
});

test("shows on with the singular form without speaking a slash-list", () => {
  assert.equal(verbPreviewLabel("3s", "est"), "il / elle / on est");
  assert.equal(spokenConjugation("3s", "est", "indicatif"), "il est");
  assert.equal(verbPreviewLabel("3p", "sont"), "ils / elles sont");
});
