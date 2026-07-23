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
 * hand slot or the held card) so it SLIDES here, then FLIPS face-up on arrival —
 * i.e. the replaced card flips in place and slides to the discard (Cole). */
function DiscardTop({ face, skinArt }: { face: CardFace; skinArt: boolean }) {
  // Keyed by uid at the call site, so each new discard remounts as a back (false)
  // and then flips — no synchronous reset needed.
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

export function CambioTable({
  view,
  room,
  seat,
  send,
  restart,
  error,
  events,
  skin,
  scene,
}: {
  view: GameView;
  room: RoomInfo;
  seat: number;
  send: (m: Move) => void;
  restart: () => void;
  error: string | null;
  events: GameEvent[];
  skin: Skin;
  scene: Scene;
}) {
  // Two-step swap powers: a pick is only valid for the exact game state it was
  // made in, so deriving validity from move_seq replaces any reset effect.
  const [pickedRaw, setPickedRaw] = useState<{ slot: number; seq: number } | null>(null);
  const [mascot, setMascot] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const myTurn = view.turn === seat;
  const phase = view.phase;
  const me = view.players.find((p) => p.seat === seat)!;
  const opponents = view.players.filter((p) => p.seat !== seat);

  const picked: Picked = useMemo(
    () => (pickedRaw && pickedRaw.seq === view.move_seq ? { slot: pickedRaw.slot } : null),
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
  const [peekPop, setPeekPop] = useState<CardFace | null>(null);
  const processedRef = useRef<number | null>(null);
  useEffect(() => {
    // Skip event history on first mount / reconnect so nothing stale flashes.
    if (processedRef.current === null) {
      processedRef.current = events.length;
      return;
    }
    const fresh = events.slice(processedRef.current);
    processedRef.current = events.length;
    let map: Record<number, CardFace> | null = null;
    let single: CardFace | null = null;
    let ms = 0;
    for (const e of fresh) {
      if (e.type === "opening_peek" && Array.isArray(e.cards)) {
        map = {};
        for (const c of e.cards as CardFace[]) map[c.uid] = c;
        ms = Math.max(ms, 5000);
      } else if (e.type === "peek" && e.card) {
        const c = e.card as CardFace;
        map = { ...(map ?? {}), [c.uid]: c };
        single = c;
        ms = Math.max(ms, 4500);
      } else if (e.type === "snap_attempt" && e.card) {
        // Show the flipped card to everyone briefly (esp. a WRONG snap that's
        // kept) so you can see it before the penalty card arrives (§1.5).
        const c = e.card as CardFace;
        map = { ...(map ?? {}), [c.uid]: c };
        ms = Math.max(ms, 2200);
      }
    }
    if (map) {
      setReveal(map);
      setPeekPop(single);
      const t = setTimeout(() => {
        setReveal({});
        setPeekPop(null);
      }, ms);
      return () => clearTimeout(t);
    }
  }, [events]);

  /* --- what is clickable right now ---------------------------------------- */

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

  function seatName(s: number): string {
    if (s === seat) return "You";
    return room.seats.find((x) => x.seat === s)?.name || `Player ${s + 1}`;
  }

  /* --- the "moment": tone for rails/dim + a minimal prompt (only when a word
   * actually helps — plain draw/swap rely on the glowing targets) ----------- */

  const moment: Moment = useMemo(() => {
    if (phase === "round_end") return { key: "end", tone: "neutral", hint: null };
    if (snapOpen)
      return { key: `snap-${view.move_seq}`, tone: "snap", hint: `Snap the ${rankLabel(view.snap!.rank)}` };
    if (phase === "snap_give")
      return iMayGive
        ? { key: `give-${view.move_seq}`, tone: "good", hint: "Give a card" }
        : { key: `give2-${view.move_seq}`, tone: "neutral", hint: null };
    if (!myTurn) return { key: `opp-${view.turn}`, tone: "neutral", hint: null };
    switch (phase) {
      case "turn":
        return { key: `turn-${view.move_seq}`, tone: "you", hint: null };
      case "drawn":
        return { key: `drawn-${view.move_seq}`, tone: "you", hint: null };
      case "peek_own":
        return { key: `po-${view.move_seq}`, tone: "power", hint: "Peek one of yours" };
      case "peek_opp":
        return { key: `pp-${view.move_seq}`, tone: "power", hint: "Peek an opponent card" };
      case "blind_swap":
        return picked
          ? { key: `bs1-${view.move_seq}-${picked.slot}`, tone: "power", hint: "Pick a card to swap with" }
          : { key: `bs0-${view.move_seq}`, tone: "power", hint: "Blind swap — pick yours" };
      case "king":
        if (!view.king_looked && !picked)
          return { key: `k0-${view.move_seq}`, tone: "power", hint: "King — look or pick a card" };
        return picked
          ? { key: `k2-${view.move_seq}-${picked.slot}`, tone: "power", hint: "Pick the card to take" }
          : { key: `k1-${view.move_seq}`, tone: "power", hint: "Pick one of yours, or skip" };
      default:
        return { key: `x-${view.move_seq}`, tone: "neutral", hint: null };
    }
  }, [phase, snapOpen, iMayGive, myTurn, picked, view]);

  // Whose turn it is drives dim/glow; during snap both can act, so nobody dims.
  const normalTurn = !snapOpen && phase !== "snap_give" && phase !== "round_end";
  const railToMe = snapOpen ? true : view.turn === seat;

  /* --- draw / drawn / cambio ---------------------------------------------- */

  const canDraw = myTurn && phase === "turn" && !snapOpen;
  const myDrawn = view.drawn && view.drawn.holder === seat ? view.drawn : null;
  const canPlayDrawn =
    myTurn && phase === "drawn" && (!view.drawn?.from_discard || me.hand.length === 0);
  const showSkip =
    myTurn && ["peek_own", "peek_opp", "blind_swap", "king"].includes(phase);

  function callCambio() {
    send({ type: "cambio" });
    setMascot(true);
    setTimeout(() => setMascot(false), 2600);
  }

  /* --- hand rendering (2×N grid + floating odd card) ---------------------- */

  function renderSlot(playerSeat: number, i: number, uid: number, mine: boolean) {
    const action = slotAction(playerSeat, i);
    const intent = action ? (playerSeat === seat ? "own" : "opp") : null;
    const isPicked =
      mine && picked?.slot === i && (phase === "blind_swap" || phase === "king");
    const revealed = phase === "round_end" ? view.known[String(uid)] : reveal[uid] ?? null;
    return (
      <motion.div
        key={uid}
        layout
        layoutId={`card-${uid}`}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className={`cb-slot ${intent ? `is-target is-${intent}` : ""} ${isPicked ? "is-picked" : ""}`}
        onClick={() => clickSlot(playerSeat, i)}
      >
        <PlayingCard face={revealed ?? null} up={revealed != null} skinArt={skin === "art"} />
      </motion.div>
    );
  }

  function renderHand(playerSeat: number, hand: { uid: number }[], mine: boolean) {
    const n = hand.length;
    const even = n - (n % 2);
    const sideCard = n % 2 ? hand[n - 1] : null;
    return (
      <div className={`cb-hand ${mine ? "is-me" : "is-opp"}`}>
        {n === 0 && <span className="cb-empty-hand">no cards!</span>}
        {even > 0 && (
          <div className="cb-grid">
            {hand.slice(0, even).map(({ uid }, i) => renderSlot(playerSeat, i, uid, mine))}
          </div>
        )}
        {sideCard && (
          <div className="cb-grid-side">{renderSlot(playerSeat, n - 1, sideCard.uid, mine)}</div>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */

  return (
    <div ref={rootRef} data-section="cambio" className={`cb-game cb-fit cb-skin-${skin} cb-scene-${scene}`}>
      <SceneBackdrop scene={scene} />

      {/* HUD: deck/scene are chosen at the lobby and locked in — only fullscreen. */}
      <div className="cb-hud">
        <button className="cb-gear" onClick={toggleFull} aria-label={isFull ? "Exit full screen" : "Full screen"}>
          {isFull ? "⤡" : "⤢"}
        </button>
      </div>

      {/* side rails: chevrons march toward whoever's turn it is */}
      <div className={`cb-turnrail on-left is-${moment.tone} ${railToMe ? "" : "to-opp"}`} aria-hidden>
        <span className="cb-chevron" />
        <span className="cb-chevron" />
        <span className="cb-chevron" />
      </div>
      <div className={`cb-turnrail on-right is-${moment.tone} ${railToMe ? "" : "to-opp"}`} aria-hidden>
        <span className="cb-chevron" />
        <span className="cb-chevron" />
        <span className="cb-chevron" />
      </div>

      <LayoutGroup>
        <div className="cb-felt">
          {/* opponent(s) */}
          <div className="cb-zone cb-zone-opp">
            {opponents.map((p) => {
              const holding = view.drawn && view.drawn.holder === p.seat;
              const connected = room.seats.find((s) => s.seat === p.seat)?.connected;
              const isTurn = view.turn === p.seat;
              return (
                <div
                  key={p.seat}
                  className={`cb-player ${normalTurn && !isTurn ? "is-dim" : ""}`}
                >
                  <div className={`cb-nameplate ${normalTurn && isTurn ? "is-active" : ""}`}>
                    <span className={`cb-dot ${connected ? "" : "is-off"}`} />
                    {seatName(p.seat)} · {p.hand.length}
                    {holding && <span className="cb-hold-tag">drew a card</span>}
                  </div>
                  {renderHand(p.seat, p.hand, false)}
                </div>
              );
            })}
          </div>

          {/* center: [drawn card]  ·  pile · discard  ·  [CAMBIO] — symmetric */}
          <div className="cb-zone cb-zone-center">
            {/* left cell: the drawn card (tap a slot to swap) or a peeked card */}
            <div className="cb-center-side is-left">
              {myDrawn ? (
                <div className="cb-held">
                  <motion.div
                    className="cb-held-card"
                    layout
                    layoutId={myDrawn.card ? `card-${myDrawn.card.uid}` : "held-back"}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  >
                    <PlayingCard face={myDrawn.card ?? null} up={myDrawn.card != null} skinArt={skin === "art"} />
                  </motion.div>
                  {canPlayDrawn && (
                    <button className="cb-play-btn" onClick={() => send({ type: "play" })}>
                      Play it
                    </button>
                  )}
                </div>
              ) : peekPop ? (
                <div className="cb-held">
                  <motion.div
                    className="cb-held-static"
                    key={`peek-${peekPop.uid}`}
                    initial={{ opacity: 0, rotateY: 120 }}
                    animate={{ opacity: 1, rotateY: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 24 }}
                  >
                    <PlayingCard face={peekPop} up skinArt={skin === "art"} />
                  </motion.div>
                </div>
              ) : null}
            </div>

            <div className="cb-piles">
              <div className="cb-pile">
                <div
                  className={`cb-draw ${canDraw && view.stock_count > 0 ? "is-target" : ""}`}
                  onClick={() => canDraw && view.stock_count > 0 && send({ type: "draw_stock" })}
                >
                  {view.stock_count > 0 ? (
                    <PlayingCard face={null} up={false} />
                  ) : (
                    <div className="cb-pile-empty">—</div>
                  )}
                </div>
                pile · {view.stock_count}
              </div>

              <div className="cb-pile">
                <div
                  className={`cb-draw ${canPlayDrawn ? "is-drop" : ""}`}
                  onClick={() => canPlayDrawn && send({ type: "play" })}
                  title={canPlayDrawn ? "Play the drawn card" : undefined}
                >
                  {view.discard_top ? (
                    <DiscardTop key={view.discard_top.uid} face={view.discard_top} skinArt={skin === "art"} />
                  ) : (
                    <div className="cb-pile-empty">—</div>
                  )}
                </div>
                discard · {view.discard_count}
              </div>
            </div>

            {/* right cell: CAMBIO (mirrors the drawn card) + skip */}
            <div className="cb-center-side is-right">
              <button
                className="cb-cambio"
                disabled={!canDraw || view.cambio_caller != null}
                onClick={callCambio}
              >
                Cambio
              </button>
              {showSkip && (
                <button className="cb-skip" onClick={() => send({ type: "skip_power" })}>
                  skip power
                </button>
              )}
            </div>
          </div>

          {/* me */}
          <div className="cb-zone cb-zone-me">
            <div className={`cb-player ${normalTurn && view.turn !== seat ? "is-dim" : ""}`}>
              {renderHand(seat, me.hand, true)}
              <div className={`cb-nameplate ${normalTurn && view.turn === seat ? "is-active is-you" : ""}`}>
                <span className="cb-dot" />
                You · {me.hand.length}
              </div>
            </div>
          </div>
        </div>
      </LayoutGroup>

      {/* minimal top prompt — only when a word helps (snap / powers) */}
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

      {/* Italian mascot on Cambio call */}
      <AnimatePresence>{mascot && <Mascot onClick={() => setMascot(false)} />}</AnimatePresence>

      {error && <div className="cb-toast">{error}</div>}

      {/* round end */}
      {phase === "round_end" && view.scores && (
        <div className="cb-overlay">
          <div className="cb-dialog">
            <div className="cb-dialog-title">Round over</div>
            {view.players.map((p) => (
              <div key={p.seat} className="cb-dialog-row">
                <b>
                  {seatName(p.seat)} — {view.scores![p.seat]} pts
                  {view.winners?.includes(p.seat) ? " 🏆" : ""}
                  {view.cambio_caller === p.seat ? " (called Cambio)" : ""}
                </b>
                <div className="cb-dialog-cards">
                  {p.hand.map(({ uid }) => {
                    const c = view.known[String(uid)];
                    return (
                      <PlayingCard key={uid} face={c ?? null} up={c != null} small skinArt={skin === "art"} />
                    );
                  })}
                </div>
              </div>
            ))}
            <button className="cb-again" onClick={restart}>
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
