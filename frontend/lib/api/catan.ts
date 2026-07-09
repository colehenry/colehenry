import { z } from "zod";

import { API_URL, ApiError, apiFetch } from "@/lib/api/client";

export const catanResultSchema = z.object({
  player_id: z.number(),
  player_name: z.string(),
  victory_points: z.number().nullable(),
  starting_pips: z.number().nullable(),
  largest: z.boolean(),
  longest: z.boolean(),
  won: z.boolean(),
});
export type CatanResult = z.infer<typeof catanResultSchema>;

export const catanGameSchema = z.object({
  id: z.number(),
  played_at: z.string(),
  location: z.string(),
  notes: z.string(),
  winner: z.string().nullable(),
  results: z.array(catanResultSchema),
});
export type CatanGame = z.infer<typeof catanGameSchema>;

export const catanGameSummarySchema = z.object({
  id: z.number(),
  played_at: z.string(),
  location: z.string(),
  notes: z.string(),
  winner: z.string().nullable(),
  player_names: z.array(z.string()),
  longest: z.array(z.string()),
  largest: z.array(z.string()),
});
export type CatanGameSummary = z.infer<typeof catanGameSummarySchema>;

export const leaderboardRowSchema = z.object({
  player_id: z.number(),
  name: z.string(),
  games: z.number(),
  wins: z.number(),
  win_pct: z.number(),
  avg_vp: z.number().nullable(),
  longest_count: z.number(),
  largest_count: z.number(),
  last_win: z.string().nullable(),
});
export type LeaderboardRow = z.infer<typeof leaderboardRowSchema>;

export const catanPerformanceSpotlightSchema = z.object({
  game_id: z.number(),
  played_at: z.string(),
  location: z.string(),
  player_name: z.string(),
  victory_points: z.number().nullable(),
  winner: z.string().nullable(),
});
export type CatanPerformanceSpotlight = z.infer<
  typeof catanPerformanceSpotlightSchema
>;

export const catanDashboardSchema = z.object({
  total_games: z.number(),
  first_game: z.string().nullable(),
  last_game: z.string().nullable(),
  leaderboard: z.array(leaderboardRowSchema),
  timeline: z.array(
    z.object({
      game_id: z.number(),
      played_at: z.string(),
      winner: z.string().nullable(),
    }),
  ),
  players: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      show_in_dashboard: z.boolean(),
    }),
  ),
  worst_performances: z.array(catanPerformanceSpotlightSchema),
  longest_road_to_nowhere: z.array(catanPerformanceSpotlightSchema),
  close_but_no_sheep: z.array(catanPerformanceSpotlightSchema),
});
export type CatanDashboard = z.infer<typeof catanDashboardSchema>;

/** One player's line when creating/editing a game. */
export type CatanResultIn = {
  player_name: string;
  victory_points: number | null;
  starting_pips: number | null;
  largest: boolean;
  longest: boolean;
  won: boolean;
};

export type CatanGameIn = {
  played_at: string;
  location: string;
  notes: string;
  results: CatanResultIn[];
};

export function getCatanDashboard(): Promise<CatanDashboard> {
  return apiFetch("/catan/dashboard", catanDashboardSchema);
}

export function listCatanGames(): Promise<CatanGameSummary[]> {
  return apiFetch("/catan/games", z.array(catanGameSummarySchema));
}

export function getCatanGame(id: number): Promise<CatanGame> {
  return apiFetch(`/catan/games/${id}`, catanGameSchema);
}

export function createCatanGame(body: CatanGameIn): Promise<CatanGame> {
  return apiFetch("/catan/games", catanGameSchema, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateCatanGame(
  id: number,
  body: Partial<CatanGameIn>,
): Promise<CatanGame> {
  return apiFetch(`/catan/games/${id}`, catanGameSchema, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteCatanGame(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/catan/games/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }
}
