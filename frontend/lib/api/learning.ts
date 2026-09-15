import { z } from "zod";

import { API_URL, ApiError, apiFetch } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// shared exercise shape (deterministic + LLM + test items all use it)
// ---------------------------------------------------------------------------

export const exerciseSchema = z.object({
  id: z.string(),
  format: z.string(),
  kind: z.enum(["mc", "typed", "self", "intro"]),
  sprint: z.number(),
  skill: z.string(),
  dims: z.record(z.string(), z.number()),
  source: z.string(),
  instructions: z.string(),
  prompt: z.string(),
  prompt_es: z.string(),
  hint: z.string(),
  audio: z.object({ language: z.enum(["fr", "es"]), text: z.string() }).nullable(),
  audio_only: z.boolean(),
  autoplay: z.boolean(),
  options: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      audio: z.object({ language: z.enum(["fr", "es"]), text: z.string() }).nullable(),
    }),
  ),
  answer_id: z.string().nullable(),
  accepted: z.array(z.string()),
  reveal: z.string(),
  explanation: z.string(),
  refs: z.array(z.object({ ref: z.string(), label: z.string() })),
  target_ids: z.array(z.string()),
  difficulty: z.number(),
  transformation: z.string(),
  pattern: z.string(),
  group: z.string(),
  meta: z.record(z.string(), z.unknown()),
  generated_id: z.number().nullable().optional(),
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const activitySchema = z.object({
  id: z.string(),
  name: z.string(),
  skill: z.string(),
  minutes: z.number(),
  kind: z.string(),
  format: z.string(),
  target: z.string(),
  params: z.record(z.string(), z.unknown()),
  resource: z.string(),
  dims: z.record(z.string(), z.number()),
});
export type Activity = z.infer<typeof activitySchema>;

export const resourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  skill: z.string(),
  note: z.string(),
  minutes: z.number(),
  section: z.string(),
});
export type Resource = z.infer<typeof resourceSchema>;

export const coreVerbSchema = z.object({
  id: z.string(),
  infinitive: z.string(),
  spanish: z.string(),
  english: z.string(),
  sprint: z.number(),
  ipa: z.string(),
  group: z.string(),
  present: z.record(z.string(), z.string()),
  participle: z.string(),
  auxiliary: z.string(),
  es_infinitive: z.string(),
  es_present: z.record(z.string(), z.string()),
  es_participle: z.string(),
  family: z.string(),
  constructions: z.array(z.object({ fr: z.string(), es: z.string() })),
  examples: z.array(z.object({ fr: z.string(), es: z.string() })),
  prepositions: z.string(),
  pronunciation: z.string(),
  notes: z.string(),
});
export type CoreVerb = z.infer<typeof coreVerbSchema>;

export const pronTargetSchema = z.object({
  id: z.string(),
  label: z.string(),
  sprint: z.number(),
  kind: z.string(),
  ref: z.string(),
  note: z.string(),
  sounds: z.array(z.string()),
  threshold: z.number(),
  min_attempts: z.number(),
});

export const sprintSchema = z.object({
  number: z.number(),
  title: z.string(),
  mission: z.string(),
  weights: z.record(z.string(), z.number()),
  grammar: z.array(
    z.object({ id: z.string(), label: z.string(), ref: z.string(), es: z.string(), recognition_only: z.boolean() }),
  ),
  resources: z.array(resourceSchema),
  activities: z.array(activitySchema),
  criteria: z.array(z.object({ dimension: z.string(), label: z.string(), metric: z.string() })),
  output_targets: z.array(z.string()),
  listening_target: z.number(),
  output_target: z.number(),
  verbs: z.array(coreVerbSchema),
  pronunciation: z.array(pronTargetSchema),
  vocab_count: z.number(),
  core_count: z.number(),
});
export type Sprint = z.infer<typeof sprintSchema>;

const detailSchema = z.object({
  id: z.string(),
  label: z.string(),
  accuracy: z.number(),
  attempts: z.number(),
  met: z.boolean(),
  progress: z.number(),
  ref: z.string().optional(),
  kind: z.string().optional(),
});
export type ProgressDetail = z.infer<typeof detailSchema>;

export const progressSchema = z.object({
  sprint: z.number(),
  dims: z.record(z.string(), z.number()),
  weights: z.record(z.string(), z.number()),
  readiness: z.number(),
  targets: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      done: z.number(),
      total: z.number(),
      detail: z.string().optional(),
      dimension: z.string(),
    }),
  ),
  verbs: z.array(detailSchema),
  pronunciation: z.array(detailSchema),
  grammar: z.array(detailSchema),
  vocab: z.object({ total: z.number(), known: z.number(), productive: z.number() }),
  completions: z.record(z.string(), z.number()),
  completed_activity_ids: z.array(z.string()),
  practice: z.record(z.string(), z.object({ done: z.number(), total: z.number() })),
});
export type Progress = z.infer<typeof progressSchema>;

export const testSummarySchema = z.object({
  id: z.number(),
  sprint: z.number(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
  scores: z.record(z.string(), z.unknown()),
  profile: z.record(z.string(), z.unknown()),
  readiness: z.number(),
  passed: z.boolean(),
  weak: z.array(z.unknown()),
});
export type TestSummary = z.infer<typeof testSummarySchema>;

export const planItemSchema = z.object({
  activity_id: z.string(),
  name: z.string(),
  skill: z.string(),
  minutes: z.number(),
  kind: z.string(),
  format: z.string(),
  params: z.record(z.string(), z.unknown()),
  target: z.string(),
  resource: z.string(),
  why: z.string(),
});
export type PlanItem = z.infer<typeof planItemSchema>;

export const dashboardSchema = z.object({
  state: z.object({ active_sprint: z.number(), settings: z.record(z.string(), z.unknown()) }),
  sprints: z.array(z.object({ number: z.number(), title: z.string(), mission: z.string() })),
  sprint: sprintSchema,
  progress: progressSchema,
  carryover: z.array(z.object({ sprint: z.number(), dimension: z.string(), source: z.string() })),
  cards: z.object({ due: z.number(), new: z.number() }),
  recent: z.array(
    z.object({
      activity_id: z.string(),
      name: z.string(),
      skill: z.string(),
      score: z.number(),
      correct: z.boolean(),
      occurred_at: z.string(),
      summary: z.string(),
    }),
  ),
  last_test: testSummarySchema.nullable(),
  tests_count: z.number(),
  llm: z.object({ available: z.boolean(), models: z.array(z.string()) }),
  suggestion: z.array(planItemSchema),
  interference_due: z.number(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

export function getDashboard(sprint?: number): Promise<Dashboard> {
  const qs = sprint ? `?sprint=${sprint}` : "";
  return apiFetch(`/language/learning/dashboard${qs}`, dashboardSchema);
}

export function setActiveSprint(sprint: number): Promise<{ active_sprint: number }> {
  return apiFetch("/language/learning/state", z.object({ active_sprint: z.number() }), {
    method: "POST",
    body: JSON.stringify({ active_sprint: sprint }),
  });
}

export function syncCurriculum(): Promise<{ vocab: number; cards_created: number }> {
  return apiFetch("/language/learning/sync", z.object({ vocab: z.number(), cards_created: z.number() }), { method: "POST" });
}

export const curriculumSchema = z.object({
  sprints: z.array(sprintSchema),
  verbs: z.array(coreVerbSchema),
  pronunciation: z.array(pronTargetSchema),
});
export type Curriculum = z.infer<typeof curriculumSchema>;

export function getCurriculum(): Promise<Curriculum> {
  return apiFetch("/language/learning/curriculum", curriculumSchema);
}

// ---------------------------------------------------------------------------
// exercises + results
// ---------------------------------------------------------------------------

export const exerciseSetSchema = z.object({
  activity: activitySchema.nullable(),
  format: z.string().nullable(),
  sprint: z.number(),
  source: z.string(),
  model: z.string(),
  rejected: z.array(z.string()),
  exercises: z.array(exerciseSchema),
});
export type ExerciseSet = z.infer<typeof exerciseSetSchema>;

export type ExercisesIn = {
  activity_id?: string;
  format?: string;
  sprint?: number;
  count?: number;
  params?: Record<string, unknown>;
  targets?: string[];
  source?: "auto" | "deterministic" | "llm";
  fresh?: boolean;
  difficulty?: number;
};

export function buildExercises(body: ExercisesIn): Promise<ExerciseSet> {
  return apiFetch("/language/learning/exercises", exerciseSetSchema, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type ResultIn = {
  sprint: number;
  activity_id?: string;
  format: string;
  source?: string;
  skill: string;
  target_ids?: string[];
  dims?: Record<string, number>;
  correct: boolean;
  score: number;
  prompt?: string;
  answer?: string;
  expected?: string;
  time_ms?: number;
  generated_id?: number | null;
  meta?: Record<string, unknown>;
};

export type CompletionIn = {
  activity_id: string;
  name?: string;
  skill: string;
  sprint: number;
  score: number;
  summary?: string;
  minutes?: number;
};

export function submitResults(body: {
  results: ResultIn[];
  session_id?: number | null;
  completion?: CompletionIn | null;
}): Promise<{ recorded: number }> {
  return apiFetch("/language/learning/results", z.object({ recorded: z.number() }), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------

export const sessionSchema = z.object({
  id: z.number(),
  created_at: z.string(),
  sprint: z.number(),
  minutes: z.number(),
  source: z.string(),
  plan: z.array(planItemSchema),
  completed: z.array(z.string()),
  completed_at: z.string().nullable(),
});
export type StudySession = z.infer<typeof sessionSchema>;

export function buildSession(body: { minutes: number; use_llm?: boolean; sprint?: number }): Promise<StudySession> {
  return apiFetch("/language/learning/sessions", sessionSchema, { method: "POST", body: JSON.stringify(body) });
}

export function getSession(id: number): Promise<StudySession> {
  return apiFetch(`/language/learning/sessions/${id}`, sessionSchema);
}

export function listSessions(limit = 5): Promise<StudySession[]> {
  return apiFetch(`/language/learning/sessions?limit=${limit}`, z.array(sessionSchema));
}

// ---------------------------------------------------------------------------
// mastery tests
// ---------------------------------------------------------------------------

export const testSchema = testSummarySchema.extend({
  payload: z.object({
    sprint: z.number(),
    title: z.string(),
    sections: z.array(
      z.object({
        id: z.string(),
        dimension: z.string(),
        title: z.string(),
        exercises: z.array(exerciseSchema),
        weight: z.number().optional(),
      }),
    ),
    criteria: z.array(z.object({ dimension: z.string(), label: z.string() })),
  }),
});
export type MasteryTest = z.infer<typeof testSchema>;

export function startTest(sprint: number): Promise<MasteryTest> {
  return apiFetch("/language/learning/tests", testSchema, { method: "POST", body: JSON.stringify({ sprint }) });
}

export function submitTest(id: number, results: ResultIn[]): Promise<MasteryTest> {
  return apiFetch(`/language/learning/tests/${id}/submit`, testSchema, {
    method: "POST",
    body: JSON.stringify({ results }),
  });
}

export function listTests(sprint?: number): Promise<TestSummary[]> {
  const qs = sprint ? `?sprint=${sprint}` : "";
  return apiFetch(`/language/learning/tests${qs}`, z.array(testSummarySchema));
}

// ---------------------------------------------------------------------------
// vocabulary
// ---------------------------------------------------------------------------

export const vocabSchema = z.object({
  id: z.number(),
  curriculum_id: z.string().nullable(),
  french: z.string(),
  spanish: z.string(),
  english: z.string(),
  part_of_speech: z.string(),
  gender: z.string(),
  ipa: z.string(),
  sprint: z.number(),
  priority: z.number(),
  status: z.string(),
  frequency_band: z.string(),
  example_fr: z.string(),
  example_es: z.string(),
  pattern: z.string(),
  spanish_connection: z.string(),
  pronunciation_warning: z.string(),
  cognate_type: z.string(),
  false_friend: z.boolean(),
  reference_links: z.array(z.unknown()),
  tags: z.array(z.unknown()),
  source: z.string(),
  text_id: z.number().nullable(),
  recognition: z.number(),
  audio_recognition: z.number(),
  written_production: z.number(),
  spoken_production: z.number(),
  contextual_use: z.number(),
  attempts: z.number(),
  last_seen_at: z.string().nullable(),
});
export type VocabItem = z.infer<typeof vocabSchema>;

export function listVocab(params: { sprint?: number; status?: string; q?: string } = {}): Promise<VocabItem[]> {
  const qs = new URLSearchParams();
  if (params.sprint) qs.set("sprint", String(params.sprint));
  if (params.status) qs.set("status", params.status);
  if (params.q) qs.set("q", params.q);
  const s = qs.toString();
  return apiFetch(`/language/learning/vocab${s ? `?${s}` : ""}`, z.array(vocabSchema));
}

export function setVocabStatus(id: number, status: "core" | "recognition" | "encountered"): Promise<VocabItem> {
  return apiFetch(`/language/learning/vocab/${id}`, vocabSchema, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function importVocab(items: unknown[]): Promise<{ created: number; updated: number; cards_created: number }> {
  return apiFetch(
    "/language/learning/vocab/import",
    z.object({ created: z.number(), updated: z.number(), cards_created: z.number() }),
    { method: "POST", body: JSON.stringify({ items }) },
  );
}

export type EncounterIn = {
  french: string;
  spanish?: string;
  english?: string;
  part_of_speech?: string;
  gender?: string;
  ipa?: string;
  example_fr?: string;
  example_es?: string;
  text_id?: number | null;
  lexeme_id?: number | null;
  status?: "core" | "recognition" | "encountered";
};

export function encounterVocab(body: EncounterIn): Promise<VocabItem> {
  return apiFetch("/language/learning/vocab/encounter", vocabSchema, { method: "POST", body: JSON.stringify(body) });
}

// ---------------------------------------------------------------------------
// interference log
// ---------------------------------------------------------------------------

export const interferenceSchema = z.object({
  id: z.number(),
  error: z.string(),
  correct: z.string(),
  spanish_source: z.string(),
  explanation: z.string(),
  ref: z.string(),
  pattern: z.string(),
  source: z.string(),
  times_seen: z.number(),
  next_review: z.string(),
  last_seen: z.string(),
  resolved: z.boolean(),
  created_at: z.string(),
});
export type Interference = z.infer<typeof interferenceSchema>;

export function listInterference(includeResolved = false): Promise<Interference[]> {
  return apiFetch(`/language/learning/interference?include_resolved=${includeResolved}`, z.array(interferenceSchema));
}

export function addInterference(body: {
  error: string;
  correct: string;
  spanish_source?: string;
  explanation?: string;
  ref?: string;
}): Promise<Interference> {
  return apiFetch("/language/learning/interference", interferenceSchema, { method: "POST", body: JSON.stringify(body) });
}

export function updateInterference(id: number, body: { resolved?: boolean; explanation?: string; correct?: string }): Promise<Interference> {
  return apiFetch(`/language/learning/interference/${id}`, interferenceSchema, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deleteInterference(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/language/learning/interference/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => res.statusText));
}

// ---------------------------------------------------------------------------
// explain
// ---------------------------------------------------------------------------

export const explanationSchema = z.object({
  explanation: z.string(),
  examples: z.array(z.object({ fr: z.string(), es: z.string() })),
  refs: z.array(z.object({ ref: z.string(), label: z.string() })),
  mode: z.string(),
  text: z.string(),
  cached: z.boolean(),
});
export type Explanation = z.infer<typeof explanationSchema>;
export type ExplainMode = "explain" | "compare_es" | "why_tense" | "more_examples" | "pronunciation";

export function explainFrench(body: { text: string; mode: ExplainMode; context?: string }): Promise<Explanation> {
  return apiFetch("/language/learning/explain", explanationSchema, { method: "POST", body: JSON.stringify(body) });
}
