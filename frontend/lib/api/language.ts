import { z } from "zod";

import { API_URL, ApiError, apiFetch } from "@/lib/api/client";

export const languageCodeSchema = z.enum(["es", "fr"]);
export type LanguageCode = z.infer<typeof languageCodeSchema>;

export const cardTypeSchema = z.enum(["basic", "cloze", "audio"]);
export type CardType = z.infer<typeof cardTypeSchema>;

export const cardDirectionSchema = z.enum(["recognition", "production"]);
export type CardDirection = z.infer<typeof cardDirectionSchema>;

export const reviewStateSchema = z.enum(["new", "learning", "review", "relearning"]);
export type ReviewState = z.infer<typeof reviewStateSchema>;

// ---------------------------------------------------------------------------
// decks
// ---------------------------------------------------------------------------

export const deckSchema = z.object({
  id: z.number(),
  name: z.string(),
  language: languageCodeSchema,
  description: z.string(),
  tags: z.array(z.string()),
  is_system: z.boolean(),
  created_at: z.string(),
  card_count: z.number(),
  due_count: z.number(),
  new_count: z.number(),
});
export type Deck = z.infer<typeof deckSchema>;

export type DeckIn = {
  name: string;
  language: LanguageCode;
  description?: string;
  tags?: string[];
};

export function listDecks(): Promise<Deck[]> {
  return apiFetch("/language/decks", z.array(deckSchema));
}

export function createDeck(body: DeckIn): Promise<Deck> {
  return apiFetch("/language/decks", deckSchema, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateDeck(
  id: number,
  body: Partial<Omit<DeckIn, "language">>,
): Promise<Deck> {
  return apiFetch(`/language/decks/${id}`, deckSchema, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteDeck(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/language/decks/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }
}

// ---------------------------------------------------------------------------
// cards
// ---------------------------------------------------------------------------

export const cardSchema = z.object({
  id: z.number(),
  deck_id: z.number(),
  card_type: cardTypeSchema,
  direction: cardDirectionSchema,
  front: z.string(),
  back: z.string(),
  ipa: z.string(),
  gender: z.string(),
  part_of_speech: z.string(),
  audio_url: z.string(),
  example: z.string(),
  example_translation: z.string(),
  cognate_note: z.string(),
  is_false_friend: z.boolean(),
  source: z.string(),
  source_ref: z.string(),
  lexeme_id: z.number().nullable(),
  conjugation_id: z.number().nullable(),
  tags: z.array(z.string()),
  created_at: z.string(),
  state: reviewStateSchema,
  due: z.string(),
  reps: z.number(),
  lapses: z.number(),
  stability: z.number().nullable(),
});
export type Card = z.infer<typeof cardSchema>;

export type CardIn = {
  deck_id: number;
  front: string;
  back?: string;
  card_type?: CardType;
  direction?: CardDirection;
  ipa?: string;
  gender?: string;
  part_of_speech?: string;
  example?: string;
  example_translation?: string;
  cognate_note?: string;
  tags?: string[];
  enrich?: boolean;
};

export function listCards(deckId: number): Promise<Card[]> {
  return apiFetch(`/language/decks/${deckId}/cards`, z.array(cardSchema));
}

export function createCard(body: CardIn): Promise<Card> {
  return apiFetch("/language/cards", cardSchema, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateCard(
  id: number,
  body: Partial<Omit<CardIn, "enrich">>,
): Promise<Card> {
  return apiFetch(`/language/cards/${id}`, cardSchema, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function enrichCard(id: number): Promise<Card> {
  return apiFetch(`/language/cards/${id}/enrich`, cardSchema, { method: "POST" });
}

export async function deleteCard(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/language/cards/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }
}

// ---------------------------------------------------------------------------
// study
// ---------------------------------------------------------------------------

export const studyQueueSchema = z.object({
  cards: z.array(cardSchema),
  due_count: z.number(),
  new_count: z.number(),
});
export type StudyQueue = z.infer<typeof studyQueueSchema>;

export const reviewOutSchema = z.object({
  card_id: z.number(),
  state: reviewStateSchema,
  due: z.string(),
  again_soon: z.boolean(),
});
export type ReviewOut = z.infer<typeof reviewOutSchema>;

export function getStudyQueue(params: {
  deckId?: number;
  verbSetId?: number;
  language?: LanguageCode;
  newLimit?: number;
}): Promise<StudyQueue> {
  const search = new URLSearchParams();
  if (params.deckId != null) search.set("deck_id", String(params.deckId));
  if (params.verbSetId != null)
    search.set("verb_set_id", String(params.verbSetId));
  if (params.language) search.set("language", params.language);
  if (params.newLimit != null) search.set("new_limit", String(params.newLimit));
  return apiFetch(`/language/study/queue?${search}`, studyQueueSchema);
}

export function reviewCard(cardId: number, rating: number): Promise<ReviewOut> {
  return apiFetch("/language/study/review", reviewOutSchema, {
    method: "POST",
    body: JSON.stringify({ card_id: cardId, rating }),
  });
}

// ---------------------------------------------------------------------------
// text library + annotations
// ---------------------------------------------------------------------------

export const textAnnotationSchema = z.object({
  id: z.number(),
  text_id: z.number(),
  start_offset: z.number(),
  end_offset: z.number(),
  selected_text: z.string(),
  kind: z.string(),
  color: z.string(),
  note: z.string(),
  translation: z.string(),
  ipa: z.string(),
  gender: z.string(),
  part_of_speech: z.string(),
  cognate_note: z.string(),
  is_false_friend: z.boolean(),
  lexeme_id: z.number().nullable(),
  headword: z.string(),
  form_note: z.string(),
  deck_id: z.number().nullable(),
  flashcard_id: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type TextAnnotation = z.infer<typeof textAnnotationSchema>;

export const languageTextSummarySchema = z.object({
  id: z.number(),
  title: z.string(),
  language: languageCodeSchema,
  source_type: z.string(),
  source_ref: z.string(),
  tags: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
  annotation_count: z.number(),
});
export type LanguageTextSummary = z.infer<typeof languageTextSummarySchema>;

export const languageTextDetailSchema = languageTextSummarySchema.extend({
  content: z.string(),
  annotations: z.array(textAnnotationSchema),
});
export type LanguageTextDetail = z.infer<typeof languageTextDetailSchema>;

export type LanguageTextIn = {
  title: string;
  language: LanguageCode;
  content: string;
  source_type?: string;
  source_ref?: string;
  tags?: string[];
};

export type TextAnnotationIn = {
  start_offset: number;
  end_offset: number;
  selected_text?: string;
  kind?: string;
  color?: string;
  note?: string;
  translation?: string;
  ipa?: string;
  gender?: string;
  part_of_speech?: string;
  cognate_note?: string;
  is_false_friend?: boolean;
  headword?: string;
  form_note?: string;
};

export const cardLocationSchema = z.object({
  card_id: z.number(),
  deck_id: z.number(),
  deck_name: z.string(),
});

export const textLookupSchema = z.object({
  selected_text: z.string(),
  translation: z.string(),
  ipa: z.string(),
  gender: z.string(),
  part_of_speech: z.string(),
  cognate_note: z.string(),
  is_false_friend: z.boolean(),
  provider: z.string(),
  headword: z.string(),
  is_inflected: z.boolean(),
  form_note: z.string(),
  lexeme_id: z.number().nullable(),
  existing_cards: z.array(cardLocationSchema),
});
export type TextLookup = z.infer<typeof textLookupSchema>;

export function listLanguageTexts(language?: LanguageCode): Promise<LanguageTextSummary[]> {
  const search = new URLSearchParams();
  if (language) search.set("language", language);
  const suffix = search.toString() ? `?${search}` : "";
  return apiFetch(`/language/texts${suffix}`, z.array(languageTextSummarySchema));
}

export function createLanguageText(body: LanguageTextIn): Promise<LanguageTextDetail> {
  return apiFetch("/language/texts", languageTextDetailSchema, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getLanguageText(id: number): Promise<LanguageTextDetail> {
  return apiFetch(`/language/texts/${id}`, languageTextDetailSchema);
}

export function updateLanguageText(
  id: number,
  body: Partial<LanguageTextIn>,
): Promise<LanguageTextDetail> {
  return apiFetch(`/language/texts/${id}`, languageTextDetailSchema, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteLanguageText(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/language/texts/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }
}

export function createTextAnnotation(
  textId: number,
  body: TextAnnotationIn,
): Promise<TextAnnotation> {
  return apiFetch(`/language/texts/${textId}/annotations`, textAnnotationSchema, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateTextAnnotation(
  id: number,
  body: Partial<TextAnnotationIn>,
): Promise<TextAnnotation> {
  return apiFetch(`/language/annotations/${id}`, textAnnotationSchema, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteTextAnnotation(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/language/annotations/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }
}

export function lookupTextSelection(
  textId: number,
  selectedText: string,
): Promise<TextLookup> {
  return apiFetch(`/language/texts/${textId}/lookup`, textLookupSchema, {
    method: "POST",
    body: JSON.stringify({ selected_text: selectedText }),
  });
}

export function createCardFromAnnotation(
  annotationId: number,
  body: {
    deck_id: number;
    front?: string;
    back?: string;
    card_type?: CardType;
    direction?: CardDirection;
    tags?: string[];
    enrich?: boolean;
  },
): Promise<Card> {
  return apiFetch(`/language/annotations/${annotationId}/card`, cardSchema, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// speak - generic tap-to-hear
// ---------------------------------------------------------------------------

/** Cached TTS URL for arbitrary text; "" when the server can't synthesize. */
export function fetchSpeechUrl(
  language: LanguageCode,
  text: string,
): Promise<string> {
  return apiFetch("/language/speak", z.object({ audio_url: z.string() }), {
    method: "POST",
    body: JSON.stringify({ language, text }),
  }).then((res) => res.audio_url);
}

// ---------------------------------------------------------------------------
// wiki
// ---------------------------------------------------------------------------

export const wikiSenseSchema = z.object({
  definition: z.string(),
  examples: z.array(z.string()),
  tags: z.array(z.string()),
  translation: z.string(),
});

export const wikiDictEntrySchema = z.object({
  part_of_speech: z.string(),
  ipa: z.string(),
  gender: z.string(),
  senses: z.array(wikiSenseSchema),
  synonyms: z.array(z.string()),
});

export const wikiConjugationSchema = z.object({
  mood: z.string(),
  tense: z.string(),
  person: z.string(),
  form: z.string(),
});
export type WikiConjugation = z.infer<typeof wikiConjugationSchema>;

export const wikiOutSchema = z.object({
  word: z.string(),
  language: languageCodeSchema,
  found: z.boolean(),
  source: z.string(),
  translated_from: z.string(),
  entries: z.array(wikiDictEntrySchema),
  gender: z.string(),
  ipa: z.string(),
  frequency: z.number().nullable(),
  lemma: z.string(),
  headword: z.string(),
  is_inflected: z.boolean(),
  form_note: z.string(),
  lexeme_id: z.number().nullable(),
  existing_cards: z.array(cardLocationSchema),
  cognate_note: z.string(),
  is_false_friend: z.boolean(),
  is_verb: z.boolean(),
  verb_id: z.number().nullable(),
  conjugations: z.array(wikiConjugationSchema),
  can_conjugate: z.boolean(),
  predicted: z.boolean(),
  equivalent: z
    .object({
      language: languageCodeSchema,
      word: z.string(),
      verb_id: z.number().nullable(),
    })
    .nullable(),
});
export type WikiResult = z.infer<typeof wikiOutSchema>;

/** Language the definitions are shown in - English or machine-translated. */
export type WikiDefsLanguage = "en" | LanguageCode;

export function wikiLookup(
  language: LanguageCode,
  word: string,
  defs: WikiDefsLanguage = "en",
): Promise<WikiResult> {
  return apiFetch(
    `/language/wiki/${language}/${encodeURIComponent(word)}?defs=${defs}`,
    wikiOutSchema,
  );
}

// ---------------------------------------------------------------------------
// conjugation center
// ---------------------------------------------------------------------------

export const verbSchema = z.object({
  id: z.number(),
  language: languageCodeSchema,
  lexeme_id: z.number().nullable(),
  infinitive: z.string(),
  group: z.string(),
  is_irregular: z.boolean(),
  translation: z.string(),
  frequency_rank: z.number(),
  equivalent_verb_id: z.number().nullable(),
  equivalent_language: z.string(),
  equivalent_infinitive: z.string(),
  set_ids: z.array(z.number()),
});
export type Verb = z.infer<typeof verbSchema>;

export const conjugationSchema = z.object({
  id: z.number(),
  mood: z.string(),
  tense: z.string(),
  person: z.string(),
  form: z.string(),
  slot_key: z.string(),
  equivalent_form: z.string(),
  audio_url: z.string(),
});
export type Conjugation = z.infer<typeof conjugationSchema>;

export const verbDetailSchema = verbSchema.extend({
  conjugations: z.array(conjugationSchema),
});
export type VerbDetail = z.infer<typeof verbDetailSchema>;

export function listVerbs(language: LanguageCode = "fr"): Promise<Verb[]> {
  return apiFetch(`/language/verbs?language=${language}`, z.array(verbSchema));
}

/** Conjugate + save a wiki verb into the conjugation center (verbecc). */
export function saveVerb(
  language: LanguageCode,
  infinitive: string,
  setIds: number[] = [],
): Promise<VerbDetail> {
  return apiFetch("/language/verbs", verbDetailSchema, {
    method: "POST",
    body: JSON.stringify({ language, infinitive, set_ids: setIds }),
  });
}

export function getVerb(id: number): Promise<VerbDetail> {
  return apiFetch(`/language/verbs/${id}`, verbDetailSchema);
}

export function getConjugationAudio(
  id: number,
): Promise<{ id: number; audio_url: string }> {
  return apiFetch(
    `/language/conjugations/${id}/audio`,
    z.object({ id: z.number(), audio_url: z.string() }),
    { method: "POST" },
  );
}

export type DrillIn = {
  mood: string;
  tense: string;
  verb_ids?: number[];
  group?: string;
  irregular_only?: boolean;
  audio_first?: boolean;
  language?: LanguageCode;
  set_id?: number;
};

export function createDrills(body: DrillIn): Promise<Deck> {
  return apiFetch("/language/drills", deckSchema, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export const verbSetSchema = z.object({
  id: z.number(),
  language: languageCodeSchema,
  name: z.string(),
  description: z.string(),
  verb_count: z.number(),
  created_at: z.string(),
});
export type VerbSet = z.infer<typeof verbSetSchema>;

export function listVerbSets(language?: LanguageCode): Promise<VerbSet[]> {
  const suffix = language ? `?language=${language}` : "";
  return apiFetch(`/language/verb-sets${suffix}`, z.array(verbSetSchema));
}

export function createVerbSet(body: {
  language: LanguageCode;
  name: string;
  description?: string;
}): Promise<VerbSet> {
  return apiFetch("/language/verb-sets", verbSetSchema, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function addVerbToSet(setId: number, verbId: number): Promise<VerbSet> {
  return apiFetch(`/language/verb-sets/${setId}/members`, verbSetSchema, {
    method: "POST",
    body: JSON.stringify({ verb_id: verbId }),
  });
}

export async function removeVerbFromSet(
  setId: number,
  verbId: number,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/language/verb-sets/${setId}/members/${verbId}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

// ---------------------------------------------------------------------------
// bulk import - paste a word list, or upload a Kobo highlight database
// ---------------------------------------------------------------------------

export const importItemSchema = z.object({
  selected_text: z.string(),
  book: z.string(),
  front: z.string(),
  back: z.string(),
  ipa: z.string(),
  gender: z.string(),
  part_of_speech: z.string(),
  cognate_note: z.string(),
  is_false_friend: z.boolean(),
  is_inflected: z.boolean(),
  form_note: z.string(),
  lexeme_id: z.number().nullable(),
  existing_decks: z.array(z.string()),
});
export type ImportItem = z.infer<typeof importItemSchema>;

export const importPreviewSchema = z.object({
  language: languageCodeSchema,
  total_highlights: z.number(),
  items: z.array(importItemSchema),
});
export type ImportPreview = z.infer<typeof importPreviewSchema>;

export type ImportSource = "paste" | "kobo";

/** Resolve a pasted newline/comma-separated word list into card drafts. */
export function pasteImportPreview(
  language: LanguageCode,
  text: string,
): Promise<ImportPreview> {
  return apiFetch("/language/import/paste", importPreviewSchema, {
    method: "POST",
    body: JSON.stringify({ language, text }),
  });
}

/** Upload a KoboReader.sqlite; get back resolved, deduped card drafts. */
export async function koboImportPreview(
  language: LanguageCode,
  file: File,
): Promise<ImportPreview> {
  const form = new FormData();
  form.append("language", language);
  form.append("file", file);
  const res = await fetch(`${API_URL}/language/import/kobo`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }
  return importPreviewSchema.parse(await res.json());
}

export type ImportCommitCard = {
  front: string;
  back?: string;
  ipa?: string;
  gender?: string;
  part_of_speech?: string;
  cognate_note?: string;
  is_false_friend?: boolean;
  source_ref?: string;
};

export const importCommitSchema = z.object({
  created: z.number(),
  skipped: z.number(),
});
export type ImportCommitResult = z.infer<typeof importCommitSchema>;

export function importCommit(
  deckId: number,
  source: ImportSource,
  cards: ImportCommitCard[],
): Promise<ImportCommitResult> {
  return apiFetch("/language/import/commit", importCommitSchema, {
    method: "POST",
    body: JSON.stringify({ deck_id: deckId, source, cards }),
  });
}
