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
  language?: LanguageCode;
  newLimit?: number;
}): Promise<StudyQueue> {
  const search = new URLSearchParams();
  if (params.deckId != null) search.set("deck_id", String(params.deckId));
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
// tasks + targets
// ---------------------------------------------------------------------------

export const taskSchema = z.object({
  id: z.number(),
  text: z.string(),
  done: z.boolean(),
  task_date: z.string().nullable(),
  recurrence: z.string(),
  template_id: z.number().nullable(),
  action_ref: z.string(),
});
export type Task = z.infer<typeof taskSchema>;

export function createTask(body: {
  text: string;
  task_date?: string | null;
  recurrence?: string;
  action_ref?: string;
}): Promise<Task> {
  return apiFetch("/language/tasks", taskSchema, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateTask(
  id: number,
  body: { text?: string; done?: boolean },
): Promise<Task> {
  return apiFetch(`/language/tasks/${id}`, taskSchema, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/language/tasks/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }
}

export const targetSchema = z.object({
  id: z.number(),
  metric: z.string(),
  label: z.string(),
  target: z.number(),
  auto: z.boolean(),
  current: z.number(),
});
export type Target = z.infer<typeof targetSchema>;

export function tickTarget(id: number, delta: 1 | -1 = 1): Promise<Target> {
  return apiFetch(
    `/language/targets/${id}/tick?delta=${delta}&tz_offset=${tzOffset()}`,
    targetSchema,
    { method: "POST" },
  );
}

// ---------------------------------------------------------------------------
// dashboard
// ---------------------------------------------------------------------------

const splitSchema = z.object({ fr: z.number(), es: z.number() });
export type LanguageSplit = z.infer<typeof splitSchema>;

export const dashboardSchema = z.object({
  streak_days: z.number(),
  reviews_today: z.number(),
  due_today: splitSchema,
  new_cards: splitSchema,
  total_cards: splitSchema,
  mature_cards: splitSchema,
  retention_30d: z.object({
    fr: z.number().nullable(),
    es: z.number().nullable(),
  }),
  guardrail: z.object({
    es_reviews_this_week: z.number(),
    floor: z.number(),
  }),
  tasks: z.array(taskSchema),
  targets: z.array(targetSchema),
  heatmap: z.array(z.object({ day: z.string(), count: z.number() })),
  decks: z.array(deckSchema),
});
export type LanguageDashboard = z.infer<typeof dashboardSchema>;

/** Minutes behind UTC (JS convention) — lets the API bucket days locally. */
export function tzOffset(): number {
  return new Date().getTimezoneOffset();
}

export function getLanguageDashboard(): Promise<LanguageDashboard> {
  return apiFetch(`/language/dashboard?tz_offset=${tzOffset()}`, dashboardSchema);
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
  part_of_speech: z.string(),
  cognate_note: z.string(),
  is_false_friend: z.boolean(),
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
  part_of_speech?: string;
  cognate_note?: string;
  is_false_friend?: boolean;
};

export const textLookupSchema = z.object({
  selected_text: z.string(),
  translation: z.string(),
  ipa: z.string(),
  part_of_speech: z.string(),
  cognate_note: z.string(),
  is_false_friend: z.boolean(),
  provider: z.string(),
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
// conjugation center
// ---------------------------------------------------------------------------

export const verbSchema = z.object({
  id: z.number(),
  infinitive: z.string(),
  group: z.string(),
  is_irregular: z.boolean(),
  translation: z.string(),
  es_equivalent: z.string(),
  frequency_rank: z.number(),
});
export type Verb = z.infer<typeof verbSchema>;

export const conjugationSchema = z.object({
  id: z.number(),
  mood: z.string(),
  tense: z.string(),
  person: z.string(),
  form: z.string(),
  es_form: z.string(),
  audio_url: z.string(),
});
export type Conjugation = z.infer<typeof conjugationSchema>;

export const verbDetailSchema = verbSchema.extend({
  conjugations: z.array(conjugationSchema),
});
export type VerbDetail = z.infer<typeof verbDetailSchema>;

export function listVerbs(): Promise<Verb[]> {
  return apiFetch("/language/verbs", z.array(verbSchema));
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
};

export function createDrills(body: DrillIn): Promise<Deck> {
  return apiFetch("/language/drills", deckSchema, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
