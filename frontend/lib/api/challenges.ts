import { z } from "zod";

import { apiFetch } from "@/lib/api/client";

export const windowSchema = z.object({
  index: z.number(),
  start: z.string(),
  end: z.string(),
  status: z.enum(["met", "current", "missed", "upcoming"]),
  count: z.number(),
});
export type ChallengeWindow = z.infer<typeof windowSchema>;

export const challengeDashboardSchema = z.object({
  ordering: z.array(z.number()),
  // JSON object keys are strings; challenge ids come back as "1".."25".
  completions: z.record(z.string(), z.string()),
  windows: z.array(windowSchema),
  run_status: z.enum(["on_track", "due", "failed", "won"]),
  completed_count: z.number(),
  current_window: z.number().nullable(),
  finish: z.string(),
  video_ideas: z.string(),
});
export type ChallengeDashboard = z.infer<typeof challengeDashboardSchema>;

export function getChallengeDashboard(): Promise<ChallengeDashboard> {
  return apiFetch("/challenges/dashboard", challengeDashboardSchema);
}

export function setChallengeOrder(
  ordering: number[],
): Promise<ChallengeDashboard> {
  return apiFetch("/challenges/order", challengeDashboardSchema, {
    method: "PUT",
    body: JSON.stringify({ ordering }),
  });
}

export function completeChallenge(id: number): Promise<ChallengeDashboard> {
  return apiFetch(`/challenges/completions/${id}`, challengeDashboardSchema, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function uncompleteChallenge(id: number): Promise<ChallengeDashboard> {
  return apiFetch(`/challenges/completions/${id}`, challengeDashboardSchema, {
    method: "DELETE",
  });
}

export function setVideoIdeas(text: string): Promise<ChallengeDashboard> {
  return apiFetch("/challenges/video-ideas", challengeDashboardSchema, {
    method: "PUT",
    body: JSON.stringify({ text }),
  });
}

export function resetChallenges(): Promise<ChallengeDashboard> {
  return apiFetch("/challenges/reset", challengeDashboardSchema, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
