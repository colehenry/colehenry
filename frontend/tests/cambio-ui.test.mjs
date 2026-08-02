import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  cardInteractionClass,
  deriveMoment,
  eventsAfter,
} from "../components/cambio/table-state.ts";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const table = readSource("components/cambio/table.tsx");
const tableState = readSource("components/cambio/table-state.ts");
const styles = readSource("components/cambio/table.css");
const backdrop = readSource("components/cambio/scene-backdrop.tsx");
const scenes = readSource("components/cambio/scenes.ts");
const header = readSource("components/shell/header.tsx");
const lobby = readSource("components/cambio/lobby.tsx");
const roomPage = readSource("app/cambio/r/[roomId]/page.tsx");
const api = readSource("lib/api/cambio.ts");
const proxy = readSource("proxy.ts");
const sections = readSource("lib/sections.ts");

test("mobile turn rails move toward the active player", () => {
  const mobile = styles.slice(styles.indexOf("@media (max-width: 680px) {", styles.indexOf(".cb-turnrail")));
  assert.match(mobile, /--rail-shift: clamp\(130px, 27dvh, 220px\)/);
  assert.match(mobile, /\.cb-turnrail\.to-opp[\s\S]*?clamp\(-220px, -27dvh, -130px\)/);
  assert.match(mobile, /translateY\(calc\(-50% \+ var\(--rail-shift\)\)\)/);
});

test("opponent targets derive from legal moves without dimming either hand", () => {
  assert.match(table, /const legal = view\.legal_moves \?\? \[\]/);
  assert.match(
    table,
    /move\.type === "king_look" &&[\s\S]*?move\.target === target/,
  );
  assert.doesNotMatch(table, /targetingOpponent|is-dim/);
  assert.doesNotMatch(styles, /\.cb-player\.is-dim/);
});

test("temporary flips are bound to one move while server phases own countdowns", () => {
  assert.match(table, /function ActionCountdown/);
  assert.match(table, /revealSeq === view\.move_seq/);
  assert.match(table, /setRevealSeq\(view\.move_seq\)/);
  assert.match(table, /label="Snap"/);
  assert.match(table, /room\.opening_deadline_ms/);
  assert.match(table, /room\.power_reveal_deadline_ms/);
  assert.match(styles, /\.cb-action-countdown-track/);
});

test("both players share one held-card animation with a private face", () => {
  assert.match(table, /const heldDrawn = view\.drawn/);
  assert.match(table, /layoutId=\{`card-\$\{heldDrawn\.uid\}`\}/);
  assert.match(table, /face=\{heldByMe \? \(heldDrawn\.card \?\? null\) : null\}/);
  assert.match(table, /up=\{heldByMe && heldDrawn\.card != null\}/);
  assert.doesNotMatch(table, /opponentDraw|cb-opponent-draw/);
});

test("opponent swaps land cleanly in the discard before replacing its top", () => {
  assert.match(table, /e\.type === "swap_in"[\s\S]*?e\.seat !== seat/);
  assert.match(table, /e\.type === "discard"[\s\S]*?e\.source === "swap"/);
  const landing = table.slice(
    table.indexOf("function OpponentDiscardLanding"),
    table.indexOf("function ActionCountdown"),
  );
  assert.match(landing, /initial=\{\{ y: "-30vh" \}\}/);
  assert.match(landing, /animate=\{\{ y: 0 \}\}/);
  assert.doesNotMatch(landing, /opacity|rotate|scale/);
  assert.match(
    table,
    /opponentSwapIsTop \? \([\s\S]*?<OpponentDiscardLanding[\s\S]*?: view\.discard_top \? \(/,
  );
  assert.match(table, /face=\{opponentSwap\.previous\}/);
  assert.match(table, /className="cb-discard-space"/);
  assert.match(table, /className="cb-opponent-swap-discard"/);
  assert.match(styles, /\.cb-opponent-swap-discard/);
  assert.match(styles, /\.cb-discard-space \{[\s\S]*?visibility: hidden/);
  assert.doesNotMatch(styles, /\.cb-opponent-swap-discard \.cbc/);
});

test("seaside scene uses generated art with reduced-motion-safe ambience", () => {
  assert.match(backdrop, /cb-seaside-photo/);
  assert.match(styles, /seaside-terrace-v1\.jpg/);
  assert.match(styles, /@keyframes cb-sea-shimmer/);
  assert.match(styles, /prefers-reduced-motion[\s\S]*?cb-seaside-shimmer/);
});

test("coffee shop uses generated art with a quiet motion-safe ambience", () => {
  assert.match(backdrop, /cb-cafe-photo/);
  assert.match(backdrop, /cb-cafe-glow/);
  assert.match(styles, /cafe-v1\.jpg/);
  assert.match(styles, /rgb\(101 54 25 \/ 0\.16\)/);
  assert.match(styles, /@keyframes cb-cafe-glow/);
  assert.match(
    styles,
    /prefers-reduced-motion[\s\S]*?cb-cafe-glow,[\s\S]*?cb-cafe-steam/,
  );
});

test("cafe and tavern keep illustrated detail in the mobile crop", () => {
  assert.match(
    styles,
    /@media \(max-width: 680px\)[\s\S]*?\.cb-cafe-photo\s*\{\s*background-position: 10% center;[\s\S]*?\.cb-tavern-photo\s*\{\s*background-position: 22% center;/,
  );
});

test("medieval tavern uses generated art with warm motion-safe firelight", () => {
  assert.match(backdrop, /cb-tavern-photo/);
  assert.match(backdrop, /cb-tavern-firelight/);
  assert.match(styles, /tavern-v1\.jpg/);
  assert.match(styles, /rgb\(92 49 26 \/ 0\.22\)/);
  assert.match(styles, /@keyframes cb-tavern-firelight/);
  assert.match(
    styles,
    /prefers-reduced-motion[\s\S]*?cb-tavern-firelight\s*\{\s*animation: none/,
  );
});

test("scene picker contains only the three illustrated environments", () => {
  assert.match(
    scenes,
    /SCENE_ORDER: Scene\[\] = \["seaside", "cafe", "tavern"\]/,
  );
  assert.doesNotMatch(scenes, /"neutral"/);
  assert.doesNotMatch(styles, /\.cb-scene-neutral/);
});

test("rooms require explicit readiness before the opening reveal", () => {
  assert.match(table, /ready: \(\) => void/);
  assert.match(table, /Ready for next round/);
  assert.match(styles, /\.cb-ready-list/);
});

test("opening and power peeks are blocking, in-place reveal states", () => {
  assert.match(table, /phase === "opening" && room\.opening_deadline_ms/);
  assert.match(table, /phase === "power_reveal"/);
  assert.match(table, /view\.active_reveal\?\.target === playerSeat/);
  assert.match(table, /view\.active_reveal\.slot === i/);
  assert.match(table, /powerSelected \? \(view\.active_reveal\?\.card \?\? null\) : null/);
  assert.match(table, /powerSelected \? "is-revealing"/);
  assert.match(styles, /@keyframes cb-reveal-focus/);
  assert.doesNotMatch(table, /peekPop|cb-held-static/);
  assert.doesNotMatch(api, /skip_power/);
});

test("snap leaves non-target cards fully visible after a failed attempt", () => {
  assert.equal(
    cardInteractionClass({ intent: null }),
    "is-neutral",
  );
  assert.equal(
    cardInteractionClass({ intent: "opp" }),
    "is-target is-opp",
  );
  assert.doesNotMatch(styles, /\.cb-slot\.is-neutral \.cbc/);
});

test("prompt priority distinguishes snap-give and available snap without duplicate reveal pills", () => {
  const giveIndex = tableState.indexOf('if (phase === "snap_give")');
  const snapIndex = tableState.indexOf("if (iMaySnap)", giveIndex);
  assert.ok(giveIndex >= 0 && snapIndex > giveIndex);
  assert.match(table, /label=\{view\.active_reveal\?\.card \? "Remember card" : "Opponent peeking"\}/);
  assert.doesNotMatch(tableState, /hint: "Remember this card"/);
  assert.equal(
    deriveMoment({ phase: "power_reveal", moveSeq: 3, myTurn: true, iMaySnap: false, iMayGive: false, hasPrivateReveal: true, hasPickedCard: false, kingLooked: false }).hint,
    null,
  );
});

test("every authoritative phase has one deterministic prompt policy", () => {
  const base = { moveSeq: 4, myTurn: true, iMaySnap: false, iMayGive: false, hasPrivateReveal: false, hasPickedCard: false, kingLooked: false };
  assert.equal(deriveMoment({ ...base, phase: "opening" }).hint, null);
  assert.equal(deriveMoment({ ...base, phase: "turn" }).hint, "Draw a card");
  assert.equal(deriveMoment({ ...base, phase: "drawn" }).hint, null);
  assert.equal(deriveMoment({ ...base, phase: "peek_own" }).hint, "Peek one of yours");
  assert.equal(deriveMoment({ ...base, phase: "peek_opp" }).hint, "Peek an opponent card");
  assert.equal(deriveMoment({ ...base, phase: "blind_swap" }).hint, "Blind swap - pick yours");
  assert.equal(deriveMoment({ ...base, phase: "king" }).hint, "Black King - look at a card");
  assert.equal(deriveMoment({ ...base, phase: "round_end" }).hint, null);
  assert.equal(deriveMoment({ ...base, phase: "turn", myTurn: false }).hint, null);
  assert.equal(deriveMoment({ ...base, phase: "turn", iMaySnap: true, snapRank: "JO" }).hint, "Snap the Joker");
  assert.equal(deriveMoment({ ...base, phase: "snap_give", iMaySnap: true, iMayGive: true }).hint, "Give a card");
});

test("normal turns emphasize drawing before hand actions", () => {
  assert.match(tableState, /hint: "Draw a card"/);
  assert.doesNotMatch(table, /draw_discard/);
  assert.match(table, /view\.stock_count > 0 \? "is-target" : "is-neutral"/);
});

test("mobile piles stay centered and Cambio floats independently", () => {
  assert.match(styles, /\.cb-zone-center \{[\s\S]*?display: flex;[\s\S]*?justify-content: center/);
  assert.match(styles, /\.cb-center-side\.is-left \{[\s\S]*?position: absolute/);
  assert.match(styles, /\.cb-center-side\.is-right \{[\s\S]*?display: none/);
  assert.match(styles, /\.cb-cambio-mobile \{[\s\S]*?position: absolute;[\s\S]*?border-radius: 50%/);
  assert.match(table, /canCallCambio && \([\s\S]*?cb-cambio-mobile/);
  assert.match(styles, /--cbc-h: clamp\(58px, 10\.5vh, 92px\)/);
});

test("Cambio calls create a slapstick impact and last-turn warning", () => {
  assert.match(table, /e\.type === "cambio_called"/);
  assert.match(table, /className="cb-cambio-impact"/);
  assert.match(table, /<Mascot key=\{cambioImpact\.key\} scene=\{scene\} \/>/);
  assert.match(table, /"Last turn!"/);
  assert.match(table, /"Your last turn!"/);
  assert.doesNotMatch(table, /Final turns!/);
  assert.match(styles, /@keyframes cb-table-wham/);
  assert.match(styles, /\.cb-mascot\.is-cafe \.cb-mascot-bubble/);
  assert.match(styles, /\.cb-mascot\.is-tavern \.cb-mascot-bubble/);
  assert.match(
    styles,
    /\.cb-cambio-impact strong \{[\s\S]*?-webkit-text-stroke: 3px #27211d/,
  );
  assert.match(
    styles,
    /\.cb-cambio-impact span \{[\s\S]*?background: #27211d;[\s\S]*?color: #ffd84f/,
  );
});

test("Cambio impact survives the rolling event-buffer boundary", () => {
  const existing = Array.from({ length: 81 }, (_, id) => ({ id }));
  const lastProcessed = existing.at(-1);
  const cambio = { id: 82, type: "cambio_called", seat: 1 };
  const rolled = [...existing.slice(-80), cambio];

  assert.equal(rolled.length, existing.length);
  assert.deepEqual(eventsAfter(rolled, lastProcessed), [cambio]);
  assert.match(table, /eventsAfter\(events, processedEventRef\.current\)/);
});

test("fullscreen control uses a conventional SVG without twisting", () => {
  assert.match(table, /function FullscreenIcon/);
  assert.match(table, /<FullscreenIcon active=\{isFull\}/);
  assert.match(styles, /\.cb-gear:hover \{\s*transform: scale\(1\.06\);/);
  assert.match(styles, /\.cb-gear:active \{[\s\S]*?color: #2a2320/);
  assert.match(styles, /\.cb-gear:focus-visible \{[\s\S]*?color: #2a2320/);
  assert.match(styles, /\.cb-game:fullscreen \.cb-gear \{[\s\S]*?color: #2a2320/);
});

test("inactive cards stay neutral while legal targets alone are emphasized", () => {
  assert.equal(
    cardInteractionClass({ intent: null }),
    "is-neutral",
  );
  assert.equal(
    cardInteractionClass({ intent: "own" }),
    "is-target is-own",
  );
  assert.match(table, /canPlayDrawn \? "is-drop" : "is-neutral"/);
  assert.doesNotMatch(styles, /filter: grayscale/);
  assert.doesNotMatch(styles, /@keyframes cb-nope/);
});

test("three-card hands retain their two-column positions", () => {
  assert.match(table, /const preserveTwoByTwo = n === 3/);
  assert.match(table, /const gridCount = preserveTwoByTwo \? n/);
});

test("Cambio routes hide the site language switcher", () => {
  assert.match(
    header,
    /!pathname\.startsWith\("\/cambio"\) \? <LanguageToggle \/> : null/,
  );
});

test("Cambio-only hosts can sign in without exposing owner navigation", () => {
  assert.match(api, /apiFetch\("\/cambio\/host", userSchema\)/);
  assert.match(lobby, /queryKey: \["cambio-host"\]/);
  assert.doesNotMatch(lobby, /queryFn: getMe/);
  assert.doesNotMatch(lobby, /Sign in with Google to host/);
});

test("Cambio lobby is hidden until an authorized host signs in", () => {
  assert.match(sections, /slug: "cambio"[\s\S]*?cambioHostOnly: true/);
  assert.match(proxy, /"\/cambio"/);
  assert.doesNotMatch(proxy, /"\/cambio\/:path\*"/);
  assert.match(lobby, /!isLoadingHost && !host\) router\.replace\("\/login"\)/);
});

test("bot games skip identity and invite UI but still wait for Ready", () => {
  assert.match(
    lobby,
    /mode === "vs_bot" \? `\$\{room\.join_path\}&mode=vs_bot`/,
  );
  assert.match(roomPage, /const isBotGame = search\.get\("mode"\) === "vs_bot"/);
  assert.match(roomPage, /const name = isBotGame \? "Player"/);
  assert.match(roomPage, /!isBotGame && name === null/);
  assert.match(roomPage, /!isBotGame && \([\s\S]*?Invite link/);
  assert.match(roomPage, /\? isBotGame\s*\? "Starting…"/);
});
