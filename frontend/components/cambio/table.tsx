"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";

import type {
  CardFace,
  GameEvent,
  GameView,
  Move,
  RoomInfo,
} from "@/lib/api/cambio";
import { PlayingCard } from "./card";
import { Mascot } from "./mascot";
import { SceneBackdrop } from "./scene-backdrop";
import type { Skin } from "./skins";
import type { Scene } from "./scenes";
import "./table.css";
import "./cards.css";

function rankLabel(rank: string): string {
  return rank === "JO" ? "Joker" : rank;
}

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

/** Turn/decision state that drives the top prompt + side rails. `hint` is null
 * for plain draw/swap (the glowing targets carry those), so text stays minimal. */
type Tone = "you" | "snap" | "power" | "good" | "neutral";
type Moment = { key: string; tone: Tone; hint: string | null };
type RevealCountdown = {
  deadline: number;
  duration: number;
  label: string;
};
type OpponentDraw = { key: number; seat: number };
type OpponentSwapDiscard = { key: number; seat: number; card: CardFace };
type CambioImpact = { key: number; seat: number };

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

function OpponentSwapAnimation({
  card,
  skinArt,
}: {
  card: CardFace;
  skinArt: boolean;
}) {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setUp(true), 320);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <motion.div
      className="cb-opponent-swap-discard"
      aria-label="Opponent's replaced card moved to the discard"
      initial={{ opacity: 0, x: "-50%", y: "-30vh", scale: 0.86, rotate: -5 }}
      animate={{
        opacity: [0, 1, 1, 0],
        y: ["-30vh", "-18vh", "0vh", "1vh"],
        scale: [0.86, 1, 1, 0.96],
        rotate: [-5, 3, 0, 0],
      }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 1.05,
        times: [0, 0.18, 0.82, 1],
        ease: "easeInOut",
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
  const [mascot, setMascot] = useState(false);
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

  /* --- reveals: opening peek + power peeks (fixes peek-opponent). A "peek"
   * event carries the single card I'm entitled to see; "opening_peek" carries my
   * bottom two. Both flip the card(s) face-up on the board briefly, keyed by uid
   * so opponent cards reveal too. A single power-peek also pops up big (left). */

  const [reveal, setReveal] = useState<Record<number, CardFace>>({});
  const [opponentDraw, setOpponentDraw] = useState<OpponentDraw | null>(null);
  const [opponentSwap, setOpponentSwap] = useState<OpponentSwapDiscard | null>(
    null,
  );
  const [cambioImpact, setCambioImpact] = useState<CambioImpact | null>(null);
  const [revealCountdown, setRevealCountdown] =
    useState<RevealCountdown | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opponentDrawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const opponentSwapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const cambioImpactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const processedRef = useRef<number | null>(null);
  /* Incoming WebSocket events are an external stream. Projecting a new reveal
   * event into temporary UI state is the synchronization this effect owns. */
  useEffect(() => {
    // On first mount, keep the round-opening reveal but skip stale move history
    // delivered during a reconnect.
    if (processedRef.current === null) {
      processedRef.current = events.some(
        (event) => event.type === "opening_peek",
      )
        ? 0
        : events.length;
    }
    const fresh = events.slice(processedRef.current);
    processedRef.current = events.length;
    let map: Record<number, CardFace> | null = null;
    let ms = 0;
    const countdownLabel = "Reveal";
    let opponentSwapSeat: number | null = null;
    for (const e of fresh) {
      if (e.type === "snap_attempt" && e.card) {
        // Show the flipped card to everyone briefly (esp. a WRONG snap that's
        // kept) so you can see it before the penalty card arrives (§1.5).
        const c = e.card as CardFace;
        map = { ...(map ?? {}), [c.uid]: c };
        ms = Math.max(ms, 2200);
      } else if (
        e.type === "draw" &&
        e.source === "stock" &&
        typeof e.seat === "number" &&
        e.seat !== seat
      ) {
        if (opponentDrawTimerRef.current)
          clearTimeout(opponentDrawTimerRef.current);
        setOpponentDraw({ key: Date.now(), seat: e.seat });
        opponentDrawTimerRef.current = setTimeout(() => {
          setOpponentDraw(null);
          opponentDrawTimerRef.current = null;
        }, 950);
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
        if (opponentSwapTimerRef.current)
          clearTimeout(opponentSwapTimerRef.current);
        setOpponentSwap({
          key: Date.now(),
          seat: opponentSwapSeat,
          card: e.card as CardFace,
        });
        opponentSwapTimerRef.current = setTimeout(() => {
          setOpponentSwap(null);
          opponentSwapTimerRef.current = null;
        }, 1100);
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
      setRevealCountdown({
        deadline: Date.now() + ms,
        duration: ms,
        label: countdownLabel,
      });
      revealTimerRef.current = setTimeout(() => {
        setReveal({});
        setRevealCountdown(null);
        revealTimerRef.current = null;
      }, ms);
    }
  }, [events, seat]);
  useEffect(
    () => () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      if (opponentDrawTimerRef.current)
        clearTimeout(opponentDrawTimerRef.current);
      if (opponentSwapTimerRef.current)
        clearTimeout(opponentSwapTimerRef.current);
      if (cambioImpactTimerRef.current)
        clearTimeout(cambioImpactTimerRef.current);
    },
    [],
  );

  /* --- what is clickable right now ---------------------------------------- */

  const snapOpen = view.snap != null;
  const iMayGive = phase === "snap_give" && view.snap?.giver === seat;
  const iMaySnap =
    snapOpen && phase !== "snap_give" && !view.snap!.attempted.includes(seat);

  function slotAction(target: number, slot: number): Move | "pick" | null {
    if (iMaySnap) return { type: "snap", target, slot };
    if (iMayGive && target === seat) return { type: "snap_give", slot };
    if (phase === "snap_give") return null;
    if (!myTurn) return null;
    if (phase === "drawn" && target === seat) return { type: "swap", slot };
    if (phase === "peek_own" && target === seat)
      return { type: "peek", target, slot };
    if (phase === "peek_opp" && target !== seat)
      return { type: "peek", target, slot };
    if (phase === "blind_swap") {
      if (picked == null) return target === seat ? "pick" : null;
      if (target !== seat)
        return {
          type: "blind_swap",
          slot: picked.slot,
          target,
          target_slot: slot,
        };
      return "pick";
    }
    if (phase === "king") {
      if (!view.king_looked) return { type: "king_look", target, slot };
      if (picked == null) return target === seat ? "pick" : null;
      if (target !== seat)
        return {
          type: "king_swap",
          slot: picked.slot,
          target,
          target_slot: slot,
        };
      return "pick";
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

  const moment: Moment = useMemo(() => {
    if (phase === "round_end")
      return { key: "end", tone: "neutral", hint: null };
    if (phase === "opening")
      return { key: "opening", tone: "neutral", hint: "Memorize your cards" };
    if (phase === "power_reveal")
      return {
        key: `reveal-${view.move_seq}`,
        tone: "power",
        hint: "Remember this card",
      };
    if (snapOpen)
      return {
        key: `snap-${view.move_seq}`,
        tone: "snap",
        hint: `Snap the ${rankLabel(view.snap!.rank)}`,
      };
    if (phase === "snap_give")
      return iMayGive
        ? { key: `give-${view.move_seq}`, tone: "good", hint: "Give a card" }
        : { key: `give2-${view.move_seq}`, tone: "neutral", hint: null };
    if (!myTurn)
      return { key: `opp-${view.turn}`, tone: "neutral", hint: null };
    switch (phase) {
      case "turn":
        return {
          key: `turn-${view.move_seq}`,
          tone: "you",
          hint: "Draw a card",
        };
      case "drawn":
        return { key: `drawn-${view.move_seq}`, tone: "you", hint: null };
      case "peek_own":
        return {
          key: `po-${view.move_seq}`,
          tone: "power",
          hint: "Peek one of yours",
        };
      case "peek_opp":
        return {
          key: `pp-${view.move_seq}`,
          tone: "power",
          hint: "Peek an opponent card",
        };
      case "blind_swap":
        return picked
          ? {
              key: `bs1-${view.move_seq}-${picked.slot}`,
              tone: "power",
              hint: "Pick a card to swap with",
            }
          : {
              key: `bs0-${view.move_seq}`,
              tone: "power",
              hint: "Blind swap - pick yours",
            };
      case "king":
        if (!view.king_looked)
          return {
            key: `k0-${view.move_seq}`,
            tone: "power",
            hint: "Black King - look at a card",
          };
        return picked
          ? {
              key: `k2-${view.move_seq}-${picked.slot}`,
              tone: "power",
              hint: "Pick the card to take",
            }
          : {
              key: `k1-${view.move_seq}`,
              tone: "power",
              hint: "Now pick one of yours to swap",
            };
      default:
        return { key: `x-${view.move_seq}`, tone: "neutral", hint: null };
    }
  }, [phase, snapOpen, iMayGive, myTurn, picked, view]);

  // Whose turn it is drives dim/glow; during snap both can act, so nobody dims.
  const normalTurn =
    !snapOpen &&
    !["opening", "power_reveal", "snap_give", "round_end"].includes(phase);
  const targetingOpponent =
    phase === "peek_opp" ||
    ((phase === "blind_swap" || phase === "king") && picked !== null);
  const railToMe = snapOpen ? true : view.turn === seat;
  const targetingDraw = myTurn && phase === "turn";

  /* --- draw / drawn / cambio ---------------------------------------------- */

  const canDraw = myTurn && phase === "turn";
  const canCallCambio = canDraw && view.cambio_caller == null;
  const myDrawn = view.drawn && view.drawn.holder === seat ? view.drawn : null;
  const canPlayDrawn = myTurn && phase === "drawn";

  function callCambio() {
    send({ type: "cambio" });
    setMascot(true);
    setTimeout(() => setMascot(false), 2600);
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
    const powerFace =
      phase === "power_reveal" &&
      view.active_reveal?.target === playerSeat &&
      view.active_reveal.slot === i
        ? view.active_reveal.card
        : null;
    const revealed =
      phase === "round_end"
        ? view.known[String(uid)]
        : (openingFace ?? powerFace ?? reveal[uid] ?? null);
    const openingCard = phase === "opening" && mine && openingFace != null;
    return (
      <motion.div
        key={uid}
        layout
        layoutId={`card-${uid}`}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className={`cb-slot ${intent ? `is-target is-${intent}` : "is-disabled"} ${isPicked ? "is-picked" : ""} ${openingCard ? "is-opening" : ""}`}
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
    hand: { uid: number }[],
    mine: boolean,
  ) {
    const n = hand.length;
    const preserveTwoByTwo = n === 3;
    const gridCount = preserveTwoByTwo ? n : n - (n % 2);
    const sideCard = !preserveTwoByTwo && n % 2 ? hand[n - 1] : null;
    return (
      <div className={`cb-hand ${mine ? "is-me" : "is-opp"}`}>
        {n === 0 && <span className="cb-empty-hand">no cards!</span>}
        {gridCount > 0 && (
          <div className="cb-grid">
            {hand
              .slice(0, gridCount)
              .map(({ uid }, i) => renderSlot(playerSeat, i, uid, mine))}
          </div>
        )}
        {sideCard && (
          <div className="cb-grid-side">
            {renderSlot(playerSeat, n - 1, sideCard.uid, mine)}
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
          label="Memorize"
          tone="peek"
        />
      ) : phase === "power_reveal" && room.power_reveal_deadline_ms ? (
        <ActionCountdown
          deadline={room.power_reveal_deadline_ms}
          duration={Number(view.config.power_reveal_ms ?? 2500)}
          label="Peek"
          tone="peek"
        />
      ) : snapOpen && snapDeadline ? (
        <ActionCountdown
          key={snapDeadline}
          deadline={snapDeadline}
          duration={room.snap_window_ms ?? 3000}
          label="Snap"
          tone="snap"
        />
      ) : revealCountdown ? (
        <ActionCountdown
          key={revealCountdown.deadline}
          {...revealCountdown}
          tone="peek"
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
        <div className={`cb-felt ${targetingDraw ? "is-draw-step" : ""}`}>
          {/* opponent(s) */}
          <div className="cb-zone cb-zone-opp">
            {opponents.map((p) => {
              const holding = view.drawn && view.drawn.holder === p.seat;
              const connected = room.seats.find(
                (s) => s.seat === p.seat,
              )?.connected;
              const isTurn = view.turn === p.seat;
              return (
                <div
                  key={p.seat}
                  className={`cb-player ${normalTurn && !isTurn && !targetingOpponent ? "is-dim" : ""}`}
                >
                  <div
                    className={`cb-nameplate ${normalTurn && isTurn ? "is-active" : ""}`}
                  >
                    <span className={`cb-dot ${connected ? "" : "is-off"}`} />
                    {seatName(p.seat)} · {p.hand.length}
                    {holding && (
                      <span className="cb-hold-tag">drew a card</span>
                    )}
                  </div>
                  {renderHand(p.seat, p.hand, false)}
                </div>
              );
            })}
          </div>

          {/* center: [drawn card]  ·  pile · discard  ·  [CAMBIO] - symmetric */}
          <div className="cb-zone cb-zone-center">
            {/* left cell: the drawn card (tap a slot to swap) or a peeked card */}
            <div className="cb-center-side is-left">
              {myDrawn ? (
                <div className="cb-held">
                  <motion.div
                    className="cb-held-card"
                    layout
                    layoutId={
                      myDrawn.card ? `card-${myDrawn.card.uid}` : "held-back"
                    }
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  >
                    <PlayingCard
                      face={myDrawn.card ?? null}
                      up={myDrawn.card != null}
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
                  className={`cb-draw ${canDraw && view.stock_count > 0 ? "is-target" : "is-disabled"}`}
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
                    canPlayDrawn ? "is-drop" : "is-disabled"
                  }`}
                  onClick={() => {
                    if (canPlayDrawn) send({ type: "play" });
                  }}
                  title={canPlayDrawn ? "Play the drawn card" : undefined}
                >
                  {view.discard_top ? (
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
            <div
              className={`cb-player ${
                (normalTurn && view.turn !== seat) ||
                targetingOpponent ||
                targetingDraw
                  ? "is-dim"
                  : ""
              }`}
            >
              {renderHand(seat, me.hand, true)}
              <div
                className={`cb-nameplate ${normalTurn && view.turn === seat ? "is-active is-you" : ""}`}
              >
                <span className="cb-dot" />
                You · {me.hand.length}
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
                ? "Final turns!"
                : "Your last turn!"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Italian mascot on Cambio call */}
      <AnimatePresence>
        {mascot && <Mascot onClick={() => setMascot(false)} />}
      </AnimatePresence>

      {error && <div className="cb-toast">{error}</div>}

      <AnimatePresence>
        {opponentDraw && (
          <motion.div
            key={opponentDraw.key}
            className="cb-opponent-draw"
            aria-label={`${seatName(opponentDraw.seat)} drew a face-down card`}
            initial={{
              opacity: 0,
              x: "-58%",
              y: "4vh",
              scale: 0.82,
              rotate: -5,
            }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: ["-58%", "-50%", "-50%", "-50%"],
              y: ["4vh", "-10vh", "-27vh", "-31vh"],
              scale: [0.82, 1, 0.92, 0.84],
              rotate: [-5, 2, -2, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.9,
              times: [0, 0.24, 0.78, 1],
              ease: "easeInOut",
            }}
          >
            <PlayingCard face={null} up={false} skinArt={skin === "art"} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {opponentSwap && (
          <OpponentSwapAnimation
            key={opponentSwap.key}
            card={opponentSwap.card}
            skinArt={skin === "art"}
          />
        )}
      </AnimatePresence>

      {/* round end */}
      {phase === "round_end" && view.scores && (
        <div className="cb-overlay">
          <div className="cb-dialog">
            <div className="cb-dialog-title">Round over</div>
            {view.players.map((p) => (
              <div key={p.seat} className="cb-dialog-row">
                <b>
                  {seatName(p.seat)}: {view.scores![p.seat]} pts
                  {view.winners?.includes(p.seat) ? " 🏆" : ""}
                  {view.cambio_caller === p.seat ? " (called Cambio)" : ""}
                </b>
                <div className="cb-dialog-cards">
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
            <button
              className="cb-again"
              onClick={ready}
              disabled={
                room.seats.find((player) => player.seat === seat)?.ready
              }
            >
              {room.seats.find((player) => player.seat === seat)?.ready
                ? "Ready - waiting for opponent"
                : "Ready for next round"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
