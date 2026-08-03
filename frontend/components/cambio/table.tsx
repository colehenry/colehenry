"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";

import type {
  CardFace,
  GameEvent,
  GameView,
  HandSlot,
  Move,
  RoomInfo,
} from "@/lib/api/cambio";
import { PlayingCard } from "./card";
import { Mascot } from "./mascot";
import { SceneBackdrop } from "./scene-backdrop";
import type { Skin } from "./skins";
import type { Scene } from "./scenes";
import {
  cardInteractionClass,
  deriveMoment,
  eventsAfter,
  formatPoints,
} from "./table-state";
import "./table.css";
import "./cards.css";

/** Top of the discard. Shares `layoutId` with the card's previous position (a
 * hand slot or the held card) so it SLIDES here, then FLIPS face-up on arrival -
 * i.e. the replaced card flips in place and slides to the discard (Cole). */
function DiscardTop({ face, skinArt }: { face: CardFace; skinArt: boolean }) {
  // Keyed by uid at the call site, so each new discard remounts as a back (false)
  // and then flips - no synchronous reset needed.
  const [up, setUp] = useState(false);
  useEffect(() => {
    // let the slide begin as a back, then flip to reveal while it's still moving
    const t = setTimeout(() => setUp(true), 120);
    return () => clearTimeout(t);
  }, []);
  return (
    <motion.div
      layout
      layoutId={`card-${face.uid}`}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
    >
      <PlayingCard face={face} up={up} skinArt={skinArt} />
    </motion.div>
  );
}

/** Local pick state for the two-step swap powers (J/Q and black king). */
type Picked = { slot: number } | null;

type RevealCountdown = {
  deadline: number;
  duration: number;
  label: string;
};
type OpponentSwapDiscard = {
  key: number;
  card: CardFace;
  previous: CardFace | null;
};
type CambioImpact = { key: number; seat: number };

function ResultOverlay({
  view,
  room,
  seat,
  ready,
  skinArt,
  scene,
  seatName,
}: {
  view: GameView;
  room: RoomInfo;
  seat: number;
  ready: () => void;
  skinArt: boolean;
  scene: Scene;
  seatName: (seat: number) => string;
}) {
  const tied = view.phase === "showdown_pending";
  const won = view.winners?.includes(seat) ?? false;
  const meReady = room.seats.find((player) => player.seat === seat)?.ready;
  const players = tied
    ? view.players
    : [...view.players].sort(
        (a, b) =>
          Number(view.winners?.includes(b.seat)) -
          Number(view.winners?.includes(a.seat)),
      );

  return (
    <div className="cb-overlay" role="dialog" aria-modal="true">
      <div
        className={`cb-dialog ${tied ? "is-tie" : won ? "is-win" : "is-loss"}`}
      >
        <div className="cb-result-title">
          {tied ? "TIE" : won ? "YOU WIN" : "YOU LOSE"}
        </div>
        {tied && (
          <div className="cb-result-subtitle">
            One card each. Lowest score wins the showdown.
          </div>
        )}
        <div className="cb-result-players">
          {players.map((player) => {
            const isWinner = !tied && view.winners?.includes(player.seat);
            const calledCambio = view.cambio_caller === player.seat;
            return (
              <div
                key={player.seat}
                className={`cb-dialog-row ${tied ? "is-tied" : isWinner ? "is-winner" : "is-loser"} ${calledCambio ? "is-caller" : ""}`}
              >
                <div className="cb-result-player-line">
                  <strong>{seatName(player.seat)}</strong>
                  <span className="cb-result-score">
                    {formatPoints(view.scores?.[player.seat] ?? 0)}
                  </span>
                  {isWinner && <span aria-label="winner">🏆</span>}
                </div>
                {calledCambio && <Mascot scene={scene} compact />}
                <div className="cb-dialog-cards">
                  {player.hand.map(({ uid }) => {
                    const card = view.known[String(uid)];
                    return (
                      <PlayingCard
                        key={uid}
                        face={card ?? null}
                        up={card != null}
                        small
                        skinArt={skinArt}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {tied && room.mode === "vs_human" && (
          <div className="cb-ready-list cb-showdown-ready-list">
            {room.seats
              .filter((player) => player.kind === "human")
              .map((player) => (
                <div key={player.seat}>
                  <span>{seatName(player.seat)}</span>
                  <strong>{player.ready ? "ready" : "not ready"}</strong>
                </div>
              ))}
          </div>
        )}
        <button className="cb-again" onClick={ready} disabled={meReady}>
          {meReady
            ? "Ready - waiting for opponent"
            : tied
              ? "Continue to showdown"
              : "Ready for next round"}
        </button>
      </div>
    </div>
  );
}

function FullscreenIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </svg>
  );
}

function OpponentDiscardLanding({
  card,
  skinArt,
}: {
  card: CardFace;
  skinArt: boolean;
}) {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setUp(true), 180);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <motion.div
      className="cb-opponent-swap-discard"
      aria-label="Opponent's replaced card moved to the discard"
      initial={{ y: "-30vh" }}
      animate={{ y: 0 }}
      transition={{
        duration: 0.72,
        ease: [0.22, 0.8, 0.2, 1],
      }}
    >
      <PlayingCard face={card} up={up} skinArt={skinArt} />
    </motion.div>
  );
}

function ActionCountdown({
  deadline,
  duration,
  label,
  tone,
}: RevealCountdown & { tone: "peek" | "snap" }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, deadline - Date.now()),
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = Math.max(0, deadline - Date.now());
      setRemaining(next);
      if (next === 0) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [deadline]);

  if (remaining <= 0) return null;
  const progress = Math.min(1, remaining / duration);

  return (
    <div className={`cb-action-countdown is-${tone}`} role="timer">
      <span>{label}</span>
      <strong>{(remaining / 1000).toFixed(1)}s</strong>
      <span className="cb-action-countdown-track" aria-hidden>
        <span style={{ transform: `scaleX(${progress})` }} />
      </span>
    </div>
  );
}

export function CambioTable({
  view,
  room,
  seat,
  send,
  ready,
  error,
  events,
  snapDeadline,
  skin,
  scene,
}: {
  view: GameView;
  room: RoomInfo;
  seat: number;
  send: (m: Move) => void;
  ready: () => void;
  error: string | null;
  events: GameEvent[];
  snapDeadline: number | null;
  skin: Skin;
  scene: Scene;
}) {
  // Two-step swap powers: a pick is only valid for the exact game state it was
  // made in, so deriving validity from move_seq replaces any reset effect.
  const [pickedRaw, setPickedRaw] = useState<{
    slot: number;
    seq: number;
  } | null>(null);
  const [isFull, setIsFull] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const myTurn = view.turn === seat;
  const phase = view.phase;
  const me = view.players.find((p) => p.seat === seat)!;
  const opponents = view.players.filter((p) => p.seat !== seat);

  const picked: Picked = useMemo(
    () =>
      pickedRaw && pickedRaw.seq === view.move_seq
        ? { slot: pickedRaw.slot }
        : null,
    [pickedRaw, view.move_seq],
  );
  const setPicked = (p: Picked) =>
    setPickedRaw(p ? { slot: p.slot, seq: view.move_seq } : null);

  /* --- fullscreen ---------------------------------------------------------- */

  useEffect(() => {
    const h = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  }

  /* Snap flips are the only transient client reveal. Opening and power peeks
   * are authoritative server phases, so reconnecting cannot leave a face up. */

  const [reveal, setReveal] = useState<Record<number, CardFace>>({});
  const [revealSeq, setRevealSeq] = useState<number | null>(null);
  const [opponentSwap, setOpponentSwap] = useState<OpponentSwapDiscard | null>(
    null,
  );
  const [cambioImpact, setCambioImpact] = useState<CambioImpact | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cambioImpactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const previousDiscardRef = useRef<CardFace | null>(view.discard_top);
  const processedEventRef = useRef<GameEvent | null | undefined>(undefined);
  /* Incoming WebSocket events are an external stream. Projecting a new reveal
   * event into temporary UI state is the synchronization this effect owns. */
  useLayoutEffect(() => {
    // A mount or reconnect starts from the current state without replaying old
    // table theatrics. Once mounted, object identity survives the rolling
    // buffer in use-room and gives us a stable event cursor.
    if (processedEventRef.current === undefined) {
      processedEventRef.current = events.at(-1) ?? null;
      previousDiscardRef.current = view.discard_top;
      return;
    }
    const fresh = eventsAfter(events, processedEventRef.current);
    processedEventRef.current = events.at(-1) ?? processedEventRef.current;
    let map: Record<number, CardFace> | null = null;
    let ms = 0;
    let opponentSwapSeat: number | null = null;
    for (const e of fresh) {
      if (e.type === "snap_attempt" && e.card) {
        // Show the flipped card to everyone briefly (esp. a WRONG snap that's
        // kept) so you can see it before the penalty card arrives (§1.5).
        const c = e.card as CardFace;
        map = { ...(map ?? {}), [c.uid]: c };
        ms = Math.max(ms, 2200);
      } else if (
        e.type === "swap_in" &&
        typeof e.seat === "number" &&
        e.seat !== seat
      ) {
        opponentSwapSeat = e.seat;
      } else if (
        e.type === "discard" &&
        e.source === "swap" &&
        e.card &&
        opponentSwapSeat !== null
      ) {
        setOpponentSwap({
          key: Date.now(),
          card: e.card as CardFace,
          previous: previousDiscardRef.current,
        });
      } else if (e.type === "cambio_called" && typeof e.seat === "number") {
        if (cambioImpactTimerRef.current)
          clearTimeout(cambioImpactTimerRef.current);
        setCambioImpact({ key: Date.now(), seat: e.seat });
        cambioImpactTimerRef.current = setTimeout(() => {
          setCambioImpact(null);
          cambioImpactTimerRef.current = null;
        }, 1650);
      }
    }
    if (map) {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      setReveal(map);
      setRevealSeq(view.move_seq);
      revealTimerRef.current = setTimeout(() => {
        setReveal({});
        setRevealSeq(null);
        revealTimerRef.current = null;
      }, ms);
    }
    previousDiscardRef.current = view.discard_top;
  }, [events, seat, view.discard_top, view.move_seq]);
  useEffect(
    () => () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      if (cambioImpactTimerRef.current)
        clearTimeout(cambioImpactTimerRef.current);
    },
    [],
  );

  /* --- what is clickable right now ---------------------------------------- */

  /* View contract:
   * opening       own opening faces clear; no legal moves
   * turn          stock + Cambio glow; every hand stays clear and neutral
   * drawn         shared held position; holder sees face and may play/swap
   * peek/swap     only server-listed targets glow
   * power_reveal  chosen slot lifts; face exists only in the viewer's payload
   * snap overlay  legal snap targets glow; all other cards remain neutral
   * snap_give     only the giver's legal offload cards glow
   * round_end     dialog owns the fully revealed result
   */

  const legal = view.legal_moves ?? [];
  const iMayGive = legal.some((move) => move.type === "snap_give");
  const iMaySnap = legal.some((move) => move.type === "snap");
  const canDraw = legal.some((move) => move.type === "draw_stock");
  const canCallCambio = legal.some((move) => move.type === "cambio");
  const canPlayDrawn = legal.some((move) => move.type === "play");
  const heldDrawn = view.drawn;
  const heldByMe = heldDrawn?.holder === seat;

  function slotAction(target: number, slot: number): Move | "pick" | null {
    const snap = legal.find(
      (move) =>
        move.type === "snap" && move.target === target && move.slot === slot,
    );
    if (snap) return snap;

    const give = legal.find(
      (move) =>
        move.type === "snap_give" && target === seat && move.slot === slot,
    );
    if (give) return give;

    const swap = legal.find(
      (move) => move.type === "swap" && target === seat && move.slot === slot,
    );
    if (swap) return swap;

    const peek = legal.find(
      (move) =>
        move.type === "peek" && move.target === target && move.slot === slot,
    );
    if (peek) return peek;

    if (phase === "blind_swap") {
      const swaps = legal.filter((move) => move.type === "blind_swap");
      if (target === seat && swaps.some((move) => move.slot === slot))
        return "pick";
      if (picked)
        return (
          swaps.find(
            (move) =>
              move.slot === picked.slot &&
              move.target === target &&
              move.target_slot === slot,
          ) ?? null
        );
    }
    if (phase === "king") {
      const look = legal.find(
        (move) =>
          move.type === "king_look" &&
          move.target === target &&
          move.slot === slot,
      );
      if (look) return look;
      const swaps = legal.filter((move) => move.type === "king_swap");
      if (target === seat && swaps.some((move) => move.slot === slot))
        return "pick";
      if (picked)
        return (
          swaps.find(
            (move) =>
              move.slot === picked.slot &&
              move.target === target &&
              move.target_slot === slot,
          ) ?? null
        );
    }
    return null;
  }

  function clickSlot(target: number, slot: number) {
    const action = slotAction(target, slot);
    if (action === "pick") setPicked({ slot });
    else if (action) send(action);
  }

  function seatName(s: number): string {
    if (s === seat) return "You";
    return room.seats.find((x) => x.seat === s)?.name || `Player ${s + 1}`;
  }

  /* --- the "moment": tone for rails/dim + a minimal prompt (only when a word
   * actually helps - plain draw/swap rely on the glowing targets) ----------- */

  const moment = useMemo(
    () =>
      deriveMoment({
        phase,
        moveSeq: view.move_seq,
        myTurn,
        iMaySnap,
        iMayGive,
        snapRank: view.snap?.rank,
        hasPrivateReveal: view.active_reveal?.card != null,
        hasPickedCard: picked != null,
        kingLooked: view.king_looked,
      }),
    [phase, iMayGive, iMaySnap, myTurn, picked, view],
  );

  // Turn ownership drives the nameplate and rails. Cards remain fully visible;
  // only server-authorized targets gain interaction styling.
  const railToMe = iMaySnap || iMayGive ? true : view.turn === seat;
  const opponentSwapIsTop =
    opponentSwap !== null &&
    view.discard_top !== null &&
    opponentSwap.card.uid === view.discard_top.uid;

  /* --- draw / drawn / cambio ---------------------------------------------- */

  function callCambio() {
    send({ type: "cambio" });
  }

  /* --- hand rendering (2×N grid + floating odd card) ---------------------- */

  function renderSlot(
    playerSeat: number,
    i: number,
    uid: number,
    mine: boolean,
  ) {
    const action = slotAction(playerSeat, i);
    const intent = action ? (playerSeat === seat ? "own" : "opp") : null;
    const isPicked =
      mine &&
      picked?.slot === i &&
      (phase === "blind_swap" || phase === "king");
    const openingFace =
      phase === "opening" && mine ? view.known[String(uid)] : null;
    const powerSelected =
      phase === "power_reveal" &&
      view.active_reveal?.target === playerSeat &&
      view.active_reveal.slot === i;
    const powerFace = powerSelected ? (view.active_reveal?.card ?? null) : null;
    const snapFace = revealSeq === view.move_seq ? reveal[uid] : null;
    const revealed =
      phase === "round_end"
        ? view.known[String(uid)]
        : (openingFace ?? powerFace ?? snapFace ?? null);
    const interactionClass = cardInteractionClass({
      intent,
    });
    return (
      <motion.div
        key={uid}
        layout
        layoutId={`card-${uid}`}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className={`cb-slot ${interactionClass} ${isPicked ? "is-picked" : ""} ${powerSelected ? "is-revealing" : ""}`}
        onClick={() => clickSlot(playerSeat, i)}
      >
        <PlayingCard
          face={revealed ?? null}
          up={revealed != null}
          skinArt={skin === "art"}
        />
      </motion.div>
    );
  }

  function renderHand(
    playerSeat: number,
    hand: HandSlot[],
    mine: boolean,
  ) {
    const n = hand.length;
    const indexed = hand.map((card, index) => ({ ...card, index }));
    return (
      <div className={`cb-hand ${mine ? "is-me" : "is-opp"}`}>
        {n === 0 && <span className="cb-empty-hand">no cards!</span>}
        {n > 0 && (
          <div className="cb-grid">
            {[0, 1].map((row) => (
              <div key={row} className="cb-grid-row">
                {indexed
                  .filter((card) => card.row === row)
                  .map((card) =>
                    renderSlot(playerSeat, card.index, card.uid, mine),
                  )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */

  return (
    <div
      ref={rootRef}
      data-section="cambio"
      className={`cb-game cb-fit cb-skin-${skin} cb-scene-${scene} ${cambioImpact ? "is-cambio-hit" : ""}`}
    >
      <SceneBackdrop scene={scene} />

      {/* HUD: deck/scene are chosen at the lobby and locked in - only fullscreen. */}
      <div className="cb-hud">
        <button
          className="cb-gear"
          onClick={toggleFull}
          aria-label={isFull ? "Exit full screen" : "Full screen"}
        >
          <FullscreenIcon active={isFull} />
        </button>
      </div>

      {phase === "opening" && room.opening_deadline_ms ? (
        <ActionCountdown
          deadline={room.opening_deadline_ms}
          duration={Number(view.config.opening_peek_ms ?? 5000)}
          label="Memorize cards"
          tone="peek"
        />
      ) : phase === "power_reveal" && room.power_reveal_deadline_ms ? (
        <ActionCountdown
          deadline={room.power_reveal_deadline_ms}
          duration={Number(view.config.power_reveal_ms ?? 2500)}
          label={view.active_reveal?.card ? "Remember card" : "Opponent peeking"}
          tone="peek"
        />
      ) : iMaySnap && snapDeadline ? (
        <ActionCountdown
          key={snapDeadline}
          deadline={snapDeadline}
          duration={room.snap_window_ms ?? 3000}
          label="Snap"
          tone="snap"
        />
      ) : null}

      {/* side rails: chevrons march toward whoever's turn it is */}
      {phase !== "opening" && phase !== "power_reveal" && (
        <>
          <div
            className={`cb-turnrail on-left is-${moment.tone} ${railToMe ? "" : "to-opp"}`}
            aria-hidden
          >
            <span className="cb-chevron" />
            <span className="cb-chevron" />
            <span className="cb-chevron" />
          </div>
          <div
            className={`cb-turnrail on-right is-${moment.tone} ${railToMe ? "" : "to-opp"}`}
            aria-hidden
          >
            <span className="cb-chevron" />
            <span className="cb-chevron" />
            <span className="cb-chevron" />
          </div>
        </>
      )}

      <LayoutGroup>
        <div className="cb-felt">
          {/* opponent(s) */}
          <div className="cb-zone cb-zone-opp">
            {opponents.map((p) => {
              const isTurn = view.turn === p.seat;
              return (
                <div key={p.seat} className="cb-player">
                  <div
                    className={`cb-nameplate ${isTurn ? "is-active" : ""}`}
                  >
                    {seatName(p.seat)}
                  </div>
                  {renderHand(p.seat, p.hand, false)}
                </div>
              );
            })}
          </div>

          {/* center: [drawn card]  ·  pile · discard  ·  [CAMBIO] - symmetric */}
          <div className="cb-zone cb-zone-center">
            {/* Every player uses this same held-card position. Only the holder
                receives the face; opponents see the identical card back. */}
            <div className="cb-center-side is-left">
              {heldDrawn ? (
                <div className="cb-held">
                  <motion.div
                    className={`cb-held-card ${heldByMe ? "is-mine" : "is-opponent"}`}
                    aria-label={
                      heldByMe
                        ? "Your drawn card"
                        : `${seatName(heldDrawn.holder)} drew a face-down card`
                    }
                    layout
                    layoutId={`card-${heldDrawn.uid}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  >
                    <PlayingCard
                      face={heldByMe ? (heldDrawn.card ?? null) : null}
                      up={heldByMe && heldDrawn.card != null}
                      skinArt={skin === "art"}
                    />
                  </motion.div>
                  {canPlayDrawn && (
                    <button
                      className="cb-play-btn"
                      onClick={() => send({ type: "play" })}
                    >
                      Play it
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            <div className="cb-piles">
              <div className="cb-pile">
                <div
                  className={`cb-draw ${canDraw && view.stock_count > 0 ? "is-target" : "is-neutral"}`}
                  onClick={() =>
                    canDraw &&
                    view.stock_count > 0 &&
                    send({ type: "draw_stock" })
                  }
                >
                  {view.stock_count > 0 ? (
                    <PlayingCard face={null} up={false} />
                  ) : (
                    <div className="cb-pile-empty">-</div>
                  )}
                </div>
                pile · {view.stock_count}
              </div>

              <div className="cb-pile">
                <div
                  className={`cb-draw ${
                    canPlayDrawn ? "is-drop" : "is-neutral"
                  }`}
                  onClick={() => {
                    if (canPlayDrawn) send({ type: "play" });
                  }}
                  title={canPlayDrawn ? "Play the drawn card" : undefined}
                >
                  {opponentSwapIsTop ? (
                    <div className="cb-discard-stage">
                      {opponentSwap.previous ? (
                        <PlayingCard
                          face={opponentSwap.previous}
                          up
                          skinArt={skin === "art"}
                        />
                      ) : (
                        <div className="cb-discard-space" aria-hidden>
                          <PlayingCard face={null} up={false} />
                        </div>
                      )}
                      <OpponentDiscardLanding
                        key={opponentSwap.key}
                        card={opponentSwap.card}
                        skinArt={skin === "art"}
                      />
                    </div>
                  ) : view.discard_top ? (
                    <DiscardTop
                      key={view.discard_top.uid}
                      face={view.discard_top}
                      skinArt={skin === "art"}
                    />
                  ) : (
                    <div className="cb-pile-empty">-</div>
                  )}
                </div>
                discard · {view.discard_count}
              </div>
            </div>

            {/* Desktop-only symmetric Cambio cell; mobile floats independently. */}
            <div className="cb-center-side is-right">
              {canCallCambio && (
                <button
                  className="cb-cambio cb-cambio-desktop"
                  onClick={callCambio}
                >
                  Cambio
                </button>
              )}
            </div>
          </div>

          {/* me */}
          <div className="cb-zone cb-zone-me">
            <div className="cb-player">
              {renderHand(seat, me.hand, true)}
              <div
                className={`cb-nameplate ${view.turn === seat ? "is-active" : ""}`}
              >
                You
              </div>
            </div>
          </div>
        </div>
      </LayoutGroup>

      {canCallCambio && (
        <button
          className="cb-cambio cb-cambio-mobile"
          onClick={callCambio}
          aria-label="Call Cambio"
        >
          Cambio
        </button>
      )}

      {/* minimal top prompt - only when a word helps (snap / powers) */}
      <div className="cb-prompt-anchor">
        <AnimatePresence>
          {moment.hint && (
            <motion.div
              key={moment.key}
              className={`cb-prompt is-${moment.tone}`}
              initial={{ opacity: 0, y: -14, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
            >
              {moment.hint}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {cambioImpact && (
          <motion.div
            key={cambioImpact.key}
            className="cb-cambio-impact"
            role="status"
            initial={{ opacity: 0, x: "-50%", scale: 2.4, rotate: -12, y: -80 }}
            animate={{ opacity: [0, 1, 1, 0], x: "-50%", scale: [2.4, 0.92, 1, 1.08], rotate: [-12, 4, -2, 1], y: [-80, 0, 0, -24] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.55, times: [0, 0.22, 0.78, 1], ease: "easeOut" }}
          >
            <strong>CAMBIO!</strong>
            <span>
              {cambioImpact.seat === seat
                ? "Last turn!"
                : "Your last turn!"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cambioImpact && <Mascot key={cambioImpact.key} scene={scene} />}
      </AnimatePresence>

      {error && <div className="cb-toast">{error}</div>}

      {(phase === "round_end" || phase === "showdown_pending") &&
        view.scores && (
          <ResultOverlay
            view={view}
            room={room}
            seat={seat}
            ready={ready}
            skinArt={skin === "art"}
            scene={scene}
            seatName={seatName}
          />
        )}
    </div>
  );
}
