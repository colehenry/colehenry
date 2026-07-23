import { z } from "zod";

import { API_URL, apiFetch } from "@/lib/api/client";

/* --- REST ----------------------------------------------------------------- */

const roomOutSchema = z.object({
  room_id: z.string(),
  token: z.string(),
  mode: z.string(),
  join_path: z.string(),
});
export type RoomOut = z.infer<typeof roomOutSchema>;

const seatSchema = z.object({
  seat: z.number(),
  name: z.string(),
  kind: z.string(),
  connected: z.boolean(),
});
export type SeatInfo = z.infer<typeof seatSchema>;

const roomMetaSchema = z.object({
  room_id: z.string(),
  mode: z.string(),
  started: z.boolean(),
  round_no: z.number(),
  seats: z.array(seatSchema),
});
export type RoomMeta = z.infer<typeof roomMetaSchema>;

const opponentRowSchema = z.object({
  name: z.string(),
  rounds: z.number(),
  wins: z.number(),
  losses: z.number(),
});

const statsSchema = z.object({
  games: z.number(),
  rounds: z.number(),
  wins: z.number(),
  win_pct: z.number(),
  current_streak: z.number(),
  longest_streak: z.number(),
  avg_closing_score: z.number().nullable(),
  snap_attempts: z.number(),
  snap_accuracy: z.number().nullable(),
  offloads: z.number(),
  cambio_calls: z.number(),
  cambio_call_accuracy: z.number().nullable(),
  opponents: z.array(opponentRowSchema),
  last_played: z.string().nullable(),
});
export type CambioStats = z.infer<typeof statsSchema>;

export function createRoom(mode: "vs_bot" | "vs_human"): Promise<RoomOut> {
  return apiFetch("/cambio/rooms", roomOutSchema, {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

export function getRoomMeta(roomId: string, token: string): Promise<RoomMeta> {
  return apiFetch(
    `/cambio/rooms/${encodeURIComponent(roomId)}?t=${encodeURIComponent(token)}`,
    roomMetaSchema,
  );
}

export function getStats(): Promise<CambioStats> {
  return apiFetch("/cambio/stats", statsSchema);
}

/* --- WebSocket types (server is authoritative; these mirror view_for) ----- */

export type CardFace = { uid: number; rank: string; suit: string | null };
export type HandSlot = { uid: number };

export type Belief = {
  dist: Record<string, number>;
  ev: number;
  p_low: Record<string, number>;
  pool_size: number;
  unknown_uids: number[];
};

export type GameEvent = { type: string; [key: string]: unknown };

export type GameView = {
  seat: number;
  phase: string;
  turn: number;
  move_seq: number;
  config: Record<string, unknown>;
  stock_count: number;
  discard_count: number;
  discard_top: CardFace | null;
  drawn: { holder: number; from_discard: boolean; card?: CardFace } | null;
  players: { seat: number; hand: HandSlot[] }[];
  known: Record<string, CardFace>;
  king_looked: boolean;
  snap: {
    rank: string;
    attempted: number[];
    giver: number | null;
    receiver: number | null;
  } | null;
  cambio_caller: number | null;
  final_turns: number[];
  scores: number[] | null;
  winners: number[] | null;
  events: GameEvent[];
  belief: Belief;
  hand_estimate: number;
};

export type RoomInfo = {
  id: string;
  mode: string;
  round_no?: number;
  seats: SeatInfo[];
  snap_window_ms?: number;
};

export type ServerMessage =
  | { type: "joined"; seat: number; seat_token: string }
  | { type: "view"; room: RoomInfo; view: GameView }
  | { type: "waiting"; room: RoomInfo }
  | { type: "error"; message: string }
  | { type: "pong" };

export type Move =
  | { type: "draw_stock" }
  | { type: "draw_discard" }
  | { type: "cambio" }
  | { type: "swap"; slot: number }
  | { type: "play" }
  | { type: "peek"; target: number; slot: number }
  | { type: "blind_swap"; slot: number; target: number; target_slot: number }
  | { type: "king_look"; target: number; slot: number }
  | { type: "king_swap"; slot: number; target: number; target_slot: number }
  | { type: "skip_power" }
  | { type: "snap"; target: number; slot: number }
  | { type: "snap_give"; slot: number };

export function wsUrl(roomId: string, token: string, name: string, seatToken?: string) {
  const base = API_URL.replace(/^http/, "ws");
  const params = new URLSearchParams({ t: token, name });
  if (seatToken) params.set("seat", seatToken);
  return `${base}/cambio/ws/${encodeURIComponent(roomId)}?${params.toString()}`;
}

/* --- shared client helpers ------------------------------------------------ */

export function cardValue(rank: string, suit: string | null): number {
  if (rank === "JO") return 0;
  if (rank === "A") return 1;
  if (rank === "J" || rank === "Q") return 10;
  if (rank === "K") return suit === "H" || suit === "D" ? -1 : 10;
  return parseInt(rank, 10);
}
