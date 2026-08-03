"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type GameEvent,
  type GameView,
  type Move,
  type RoomInfo,
  type ServerMessage,
  wsUrl,
} from "@/lib/api/cambio";

export type RoomStatus =
  | "connecting"
  | "waiting" // seated, opponent not here yet
  | "playing"
  | "full"
  | "closed"
  | "error";

/** Owns the WebSocket for one room: connect, auto-reconnect with the seat
 * token (survives refresh via sessionStorage), expose the latest masked view
 * and a `send` for moves. The server is authoritative - this hook never
 * simulates anything. */
export function useRoom(roomId: string, token: string, name: string | null) {
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [seat, setSeat] = useState<number | null>(null);
  const [view, setView] = useState<GameView | null>(null);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Events from views we already consumed, kept separately so animations can
  // replay them once (each view's events describe only the last move).
  const [events, setEvents] = useState<GameEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const closedRef = useRef(false);
  const latestSeqRef = useRef(-1);
  const latestRoundRef = useRef(-1);
  const pendingSeqRef = useRef<number | null>(null);

  const storageKey = `cambio-seat-${roomId}`;

  useEffect(() => {
    if (name === null) return; // nickname gate not passed yet
    closedRef.current = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      const seatToken = sessionStorage.getItem(storageKey) ?? undefined;
      const ws = new WebSocket(wsUrl(roomId, token, name || "", seatToken));
      wsRef.current = ws;

      ws.onmessage = (raw) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(raw.data);
        } catch {
          return;
        }
        if (msg.type === "joined") {
          setSeat(msg.seat);
          sessionStorage.setItem(storageKey, msg.seat_token);
        } else if (msg.type === "waiting") {
          setRoom(msg.room);
          setStatus("waiting");
        } else if (msg.type === "view") {
          const incomingRound = msg.room.round_no ?? 0;
          if (
            incomingRound < latestRoundRef.current ||
            (incomingRound === latestRoundRef.current &&
              msg.view.move_seq < latestSeqRef.current)
          ) {
            return;
          }
          latestRoundRef.current = incomingRound;
          latestSeqRef.current = msg.view.move_seq;
          pendingSeqRef.current = null;
          setRoom(msg.room);
          setView(msg.view);
          setStatus("playing");
          if (msg.view.events.length) {
            setEvents((prev) => [...prev.slice(-80), ...msg.view.events]);
          }
        } else if (msg.type === "error") {
          pendingSeqRef.current = null;
          setError(msg.message);
          setTimeout(() => setError(null), 2500);
        }
      };

      ws.onclose = (ev) => {
        if (closedRef.current) return;
        if (ev.code === 4001) {
          setStatus("full");
        } else if (ev.code === 4004) {
          setStatus("closed");
        } else {
          setStatus("connecting");
          retry = setTimeout(connect, 1500); // pause-and-wait reconnect
        }
      };
    }

    connect();
    return () => {
      closedRef.current = true;
      if (retry) clearTimeout(retry);
      wsRef.current?.close();
    };
  }, [roomId, token, name, storageKey]);

  const send = useCallback((move: Move) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (pendingSeqRef.current === latestSeqRef.current) return;
    pendingSeqRef.current = latestSeqRef.current;
    ws.send(JSON.stringify({ type: "move", move }));
  }, []);

  const ready = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "ready" }));
  }, []);

  const snapDeadline = room?.snap_deadline_ms ?? null;
  return { status, seat, view, room, error, events, snapDeadline, send, ready };
}
