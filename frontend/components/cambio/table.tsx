"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGroup, motion } from "motion/react";

import {
  cardValue,
  type CardFace,
  type GameEvent,
  type GameView,
  type Move,
  type RoomInfo,
} from "@/lib/api/cambio";
import { PlayingCard } from "./card";
import { SKIN_LABELS, type Skin } from "./skins";
import "./xp.css";
import "./cards.css";

const PSEUDO_LABEL: Record<string, string> = {
  A: "A",
  J: "J",
  Q: "Q",
  KR: "K♥",
  KB: "K♠",
  JO: "★",
};

function fmtCard(c: CardFace | { rank: string; suit: string | null }): string {
  const suit = c.suit === "S" ? "♠" : c.suit === "H" ? "♥" : c.suit === "D" ? "♦" : c.suit === "C" ? "♣" : "";
  return c.rank === "JO" ? "Joker" : `${c.rank}${suit}`;
}

/** Local pick state for the two-step swap powers (J/Q and black king). */
type Picked = { slot: number } | null;

export function CambioTable({
  view,
  room,
  seat,
  send,
  restart,
  error,
  events,
  snapDeadline,
  skin,
}: {
  view: GameView;
  room: RoomInfo;
  seat: number;
  send: (m: Move) => void;
  restart: () => void;
  error: string | null;
  events: GameEvent[];
  snapDeadline: number | null;
  skin: Skin;
}) {
  // Two-step swap powers: a pick is only valid for the exact game state it
  // was made in, so deriving validity from move_seq replaces any reset effect.
  const [pickedRaw, setPickedRaw] = useState<{ slot: number; seq: number } | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showOdds, setShowOdds] = useState(false);
  const [hoverUid, setHoverUid] = useState<number | null>(null);

  const myTurn = view.turn === seat;
  const phase = view.phase;
  const me = view.players.find((p) => p.seat === seat)!;
  const opponents = view.players.filter((p) => p.seat !== seat);

  const picked: Picked =
    pickedRaw && pickedRaw.seq === view.move_seq ? { slot: pickedRaw.slot } : null;
  const setPicked = (p: Picked) =>
    setPickedRaw(p ? { slot: p.slot, seq: view.move_seq } : null);

  // Opening peek: show my bottom-row faces for a few seconds at round start.
  // Derived from the event stream; the timer only ever dismisses (async).
  const lastPeekIdx = events.findLastIndex((e) => e.type === "opening_peek");
  const [peekDismissedIdx, setPeekDismissedIdx] = useState(-1);
  useEffect(() => {
    if (lastPeekIdx < 0) return;
    const timer = setTimeout(() => setPeekDismissedIdx(lastPeekIdx), 5000);
    return () => clearTimeout(timer);
  }, [lastPeekIdx]);
  const peekFaces = useMemo(() => {
    if (lastPeekIdx < 0 || lastPeekIdx <= peekDismissedIdx) return null;
    const cards = events[lastPeekIdx].cards;
    if (!Array.isArray(cards)) return null;
    const faces: Record<number, CardFace> = {};
    for (const c of cards as CardFace[]) faces[c.uid] = c;
    return faces;
  }, [events, lastPeekIdx, peekDismissedIdx]);

  /* --- what is clickable right now --------------------------------------- */

  const snapOpen = phase === "snap" && view.snap != null;
  const iMayGive = phase === "snap_give" && view.snap?.giver === seat;
  const iMaySnap = snapOpen && !view.snap!.attempted.includes(seat);

  function slotAction(target: number, slot: number): Move | "pick" | null {
    if (iMaySnap) return { type: "snap", target, slot };
    if (iMayGive && target === seat) return { type: "snap_give", slot };
    if (snapOpen || phase === "snap_give") return null;
    if (!myTurn) return null;
    if (phase === "drawn" && target === seat) return { type: "swap", slot };
    if (phase === "peek_own" && target === seat) return { type: "peek", target, slot };
    if (phase === "peek_opp" && target !== seat) return { type: "peek", target, slot };
    if (phase === "blind_swap") {
      if (picked == null) return target === seat ? "pick" : null;
      if (target !== seat)
        return { type: "blind_swap", slot: picked.slot, target, target_slot: slot };
      return "pick";
    }
    if (phase === "king") {
      if (!view.king_looked && picked == null)
        return { type: "king_look", target, slot };
      if (picked == null) return target === seat ? "pick" : null;
      if (target !== seat)
        return { type: "king_swap", slot: picked.slot, target, target_slot: slot };
      return "pick";
    }
    return null;
  }

  function clickSlot(target: number, slot: number) {
    const action = slotAction(target, slot);
    if (action === "pick") setPicked({ slot });
    else if (action) send(action);
  }

  /* --- helpers ------------------------------------------------------------ */

  function seatName(s: number): string {
    if (s === seat) return "You";
    return room.seats.find((x) => x.seat === s)?.name || `Player ${s + 1}`;
  }

  const statusMsg = useMemo(() => {
    if (error) return `✗ ${error}`;
    if (phase === "round_end") return "Round over";
    if (snapOpen)
      return `Snap window — tap a face-down card matching ${view.snap!.rank === "JO" ? "Joker" : view.snap!.rank}`;
    if (phase === "snap_give")
      return iMayGive
        ? "Correct snap! Choose one of your cards to hand over"
        : `${seatName(view.snap?.giver ?? 0)} is choosing a card to offload…`;
    if (!myTurn) return `${seatName(view.turn)}'s turn…`;
    switch (phase) {
      case "turn":
        return "Your turn — draw from the stock or discard, or call Cambio";
      case "drawn":
        return view.drawn?.from_discard
          ? "Swap the drawn card into one of your slots"
          : "Swap it into a slot, or play it to the discard";
      case "peek_own":
        return "Peek one of your own cards (7/8)";
      case "peek_opp":
        return "Peek one opponent card (9/10)";
      case "blind_swap":
        return picked
          ? "Now pick the opponent card to swap with"
          : "Blind swap (J/Q): pick one of YOUR cards first, or skip";
      case "king":
        if (!view.king_looked && !picked)
          return "Black King: look at any card, or pick one of yours to swap, or skip";
        return picked
          ? "Now pick the opponent card to take"
          : "Pick one of YOUR cards to start a swap, or skip";
      default:
        return "";
    }
  }, [error, phase, snapOpen, iMayGive, myTurn, picked, view, room]); // eslint-disable-line react-hooks/exhaustive-deps

  const showSkip =
    myTurn && ["peek_own", "peek_opp", "blind_swap", "king"].includes(phase);

  /* --- odds tooltip -------------------------------------------------------- */

  function OddsTip({ uid }: { uid: number }) {
    const known = view.known[String(uid)];
    if (known) {
      return (
        <div className="cb-odds">
          <b>{fmtCard(known)}</b> — {cardValue(known.rank, known.suit)} pts
          <br />
          (you have seen this card)
        </div>
      );
    }
    const rows = Object.entries(view.belief.dist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return (
      <div className="cb-odds">
        <table>
          <tbody>
            {rows.map(([pr, p]) => (
              <tr key={pr}>
                <td>{PSEUDO_LABEL[pr] ?? pr}</td>
                <td>
                  <span className="cb-odds-bar" style={{ width: `${p * 140}px` }} />
                </td>
                <td>{(p * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        EV {view.belief.ev} · P(≤2) {((view.belief.p_low["2"] ?? 0) * 100).toFixed(0)}%
      </div>
    );
  }

  /* --- hand rendering ------------------------------------------------------ */

  function renderHand(playerSeat: number, hand: { uid: number }[]) {
    const mine = playerSeat === seat;
    return (
      <div className="cb-hand">
        {hand.map(({ uid }, i) => {
          const action = slotAction(playerSeat, i);
          const isPicked = mine && picked?.slot === i && (phase === "blind_swap" || phase === "king");
          const peeking = mine && peekFaces?.[uid];
          const revealed =
            phase === "round_end" ? view.known[String(uid)] : peeking || null;
          return (
            <motion.div
              key={uid}
              layout
              layoutId={`card-${uid}`}
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
              className={`cb-slot ${action ? "is-target" : ""} ${isPicked ? "is-picked" : ""}`}
              onClick={() => clickSlot(playerSeat, i)}
              onMouseEnter={() => setHoverUid(uid)}
              onMouseLeave={() => setHoverUid((h) => (h === uid ? null : h))}
            >
              <PlayingCard
                face={revealed ?? null}
                up={revealed != null}
                skinArt={skin === "art"}
              />
              {showOdds && hoverUid === uid && phase !== "round_end" && (
                <OddsTip uid={uid} />
              )}
            </motion.div>
          );
        })}
        {hand.length === 0 && <span style={{ color: "#fff9", fontSize: 11 }}>no cards!</span>}
      </div>
    );
  }

  /* --- center row ---------------------------------------------------------- */

  const canDraw = myTurn && phase === "turn" && !snapOpen;
  const drawnCard = view.drawn;
  const canPlayDrawn =
    myTurn &&
    phase === "drawn" &&
    (!drawnCard?.from_discard || me.hand.length === 0);

  /* --- move log ------------------------------------------------------------ */

  const logLines = useMemo(() => {
    const lines: string[] = [];
    for (const e of events) {
      switch (e.type) {
        case "draw":
          lines.push(`${seatName(e.seat as number)} drew from the ${e.source}`);
          break;
        case "discard":
          lines.push(`${fmtCard(e.card as CardFace)} → discard`);
          break;
        case "power":
          lines.push(`${seatName(e.seat as number)} triggered ${String(e.power).replace("_", " ")}`);
          break;
        case "peek":
          lines.push(`You saw ${fmtCard(e.card as CardFace)}`);
          break;
        case "peeked":
          lines.push(`${seatName(e.by as number)} peeked a card of ${seatName(e.seat as number)}`);
          break;
        case "table_swap":
          lines.push("Two cards swapped places");
          break;
        case "snap_open":
          lines.push(`Snap window: ${e.rank}`);
          break;
        case "snap_attempt":
          lines.push(
            `${seatName(e.by as number)} snapped ${fmtCard(e.card as CardFace)} — ${e.correct ? "correct!" : "wrong"}`,
          );
          break;
        case "penalty":
          lines.push(`${seatName(e.seat as number)} drew a penalty card`);
          break;
        case "offload":
          lines.push(`${seatName(e.from as number)} offloaded a card to ${seatName(e.seat as number)}`);
          break;
        case "cambio_called":
          lines.push(`★ ${seatName(e.seat as number)} called CAMBIO`);
          break;
        case "reshuffle":
          lines.push("Discard reshuffled into the stock");
          break;
        case "round_end":
          lines.push("Round over");
          break;
      }
    }
    return lines;
  }, [events]); // eslint-disable-line react-hooks/exhaustive-deps

  const logRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logLines.length, showLog]);

  /* ------------------------------------------------------------------------ */

  return (
    <div className={`cb-window cb-skin-${skin}`}>
      <div className="cb-titlebar">
        <span aria-hidden>🂠</span>
        <span className="cb-title-text">
          Cambio — Room #{room.id}
          {view.cambio_caller != null && phase !== "round_end"
            ? ` · CAMBIO called by ${seatName(view.cambio_caller)}!`
            : ""}
        </span>
        <label style={{ fontSize: 11 }}>
          <select
            className="cb-title-select"
            value={skin}
            onChange={(e) => {
              const s = e.target.value as Skin;
              localStorage.setItem("cambio-skin", s);
              window.dispatchEvent(new CustomEvent("cambio-skin", { detail: s }));
            }}
            aria-label="Card skin"
          >
            {(Object.keys(SKIN_LABELS) as Skin[]).map((s) => (
              <option key={s} value={s}>
                {SKIN_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <button
          className="cb-caption-btn"
          style={{ width: "auto", padding: "0 6px", fontWeight: showOdds ? 700 : 400 }}
          onClick={() => setShowOdds((v) => !v)}
          title="Toggle the odds overlay (hover face-down cards)"
        >
          odds
        </button>
        <button
          className="cb-caption-btn"
          style={{ width: "auto", padding: "0 6px", fontWeight: showLog ? 700 : 400 }}
          onClick={() => setShowLog((v) => !v)}
          title="Toggle the move log"
        >
          log
        </button>
        <span className="cb-caption-btn" aria-hidden>
          ✕
        </span>
      </div>

      <div className="cb-table-wrap">
        <LayoutGroup>
        <div className="cb-table">
          {/* opponent(s) */}
          {opponents.map((p) => (
            <div key={p.seat} className="cb-player-row">
              <div className="cb-player-label">
                <span
                  className={`cb-dot ${room.seats.find((s) => s.seat === p.seat)?.connected ? "" : "is-off"}`}
                />
                {seatName(p.seat)} · {p.hand.length} cards
                {view.turn === p.seat && phase !== "round_end" && (
                  <span className="cb-turn-tag">their turn</span>
                )}
              </div>
              {renderHand(p.seat, p.hand)}
            </div>
          ))}

          {/* center row */}
          <div className="cb-center-row">
            <div className="cb-pile">
              <div
                className={`cb-pile-slot cb-slot ${canDraw && view.stock_count > 0 ? "is-target" : ""}`}
                onClick={() => canDraw && view.stock_count > 0 && send({ type: "draw_stock" })}
              >
                {view.stock_count > 0 ? (
                  <PlayingCard face={null} up={false} />
                ) : (
                  <div className="cbc cb-pile-empty">—</div>
                )}
              </div>
              stock · {view.stock_count}
            </div>

            <div className="cb-pile">
              <div className="cb-pile-slot">
                {drawnCard ? (
                  <div
                    className={`cb-slot ${canPlayDrawn ? "is-target" : ""}`}
                    onClick={() => canPlayDrawn && send({ type: "play" })}
                    title={canPlayDrawn ? "Play to the discard" : undefined}
                  >
                    <PlayingCard
                      face={drawnCard.card ?? null}
                      up={drawnCard.card != null}
                      skinArt={skin === "art"}
                    />
                  </div>
                ) : (
                  <div className="cbc cb-pile-empty">drawn</div>
                )}
              </div>
              drawn{drawnCard && drawnCard.holder !== seat ? ` (${seatName(drawnCard.holder)})` : ""}
            </div>

            <div className="cb-pile">
              <div
                className={`cb-pile-slot cb-slot ${canDraw && view.discard_top ? "is-target" : ""}`}
                onClick={() => canDraw && view.discard_top && send({ type: "draw_discard" })}
              >
                {view.discard_top ? (
                  <PlayingCard
                    face={view.discard_top}
                    up
                    skinArt={skin === "art"}
                  />
                ) : (
                  <div className="cbc cb-pile-empty">—</div>
                )}
              </div>
              discard · {view.discard_count}
            </div>

            <div className="cb-pile">
              <button
                className="cb-cambio-btn"
                disabled={!canDraw || view.cambio_caller != null}
                onClick={() => send({ type: "cambio" })}
              >
                CAMBIO
              </button>
              {showSkip && (
                <button className="cb-btn" onClick={() => send({ type: "skip_power" })}>
                  skip power
                </button>
              )}
            </div>
          </div>

          {/* me */}
          <div className="cb-player-row">
            {renderHand(seat, me.hand)}
            <div className="cb-player-label">
              <span className="cb-dot" />
              You · est. {view.hand_estimate} pts
              {myTurn && phase !== "round_end" && (
                <span className="cb-turn-tag">your turn</span>
              )}
            </div>
          </div>

          {/* round end overlay */}
          {phase === "round_end" && view.scores && (
            <div className="cb-overlay">
              <div className="cb-dialog">
                <div className="cb-dialog-title">Round over</div>
                <div className="cb-dialog-body">
                  {view.players.map((p) => (
                    <div key={p.seat} style={{ marginBottom: 10 }}>
                      <b>
                        {seatName(p.seat)} — {view.scores![p.seat]} pts
                        {view.winners?.includes(p.seat) ? " 🏆" : ""}
                        {view.cambio_caller === p.seat ? " (called Cambio)" : ""}
                      </b>
                      <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                        {p.hand.map(({ uid }) => {
                          const c = view.known[String(uid)];
                          return (
                            <PlayingCard
                              key={uid}
                              face={c ?? null}
                              up={c != null}
                              small
                              skinArt={skin === "art"}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <button className="cb-btn" onClick={restart} style={{ marginTop: 4 }}>
                    Play again
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        </LayoutGroup>

        {showLog && (
          <div className="cb-dock">
            <div className="cb-dock-head">Move log</div>
            <div className="cb-dock-body" ref={logRef}>
              {logLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="cb-status">
        <span className="cb-status-msg">{statusMsg}</span>
        {snapOpen && snapDeadline && (
          <div className="cb-snapbar">
            {/* keyed by deadline: each window restarts the CSS drain */}
            <div
              key={snapDeadline}
              className="cb-snapbar-fill"
              style={{
                animationDuration: `${room.snap_window_ms ?? 3000}ms`,
              }}
            />
          </div>
        )}
        <span style={{ color: "var(--cb-text-muted)" }}>round {room.round_no}</span>
      </div>
    </div>
  );
}
