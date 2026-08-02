import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const table = readSource("components/cambio/table.tsx");
const styles = readSource("components/cambio/table.css");
const backdrop = readSource("components/cambio/scene-backdrop.tsx");
const header = readSource("components/shell/header.tsx");
const lobby = readSource("components/cambio/lobby.tsx");
const api = readSource("lib/api/cambio.ts");
const proxy = readSource("proxy.ts");
const sections = readSource("lib/sections.ts");

test("mobile turn rails move toward the active player", () => {
  const mobile = styles.slice(styles.indexOf("@media (max-width: 680px) {", styles.indexOf(".cb-turnrail")));
  assert.match(mobile, /--rail-shift: clamp\(130px, 27dvh, 220px\)/);
  assert.match(mobile, /\.cb-turnrail\.to-opp[\s\S]*?clamp\(-220px, -27dvh, -130px\)/);
  assert.match(mobile, /translateY\(calc\(-50% \+ var\(--rail-shift\)\)\)/);
});

test("opponent targeting dims only the player's hand", () => {
  assert.match(table, /const targetingOpponent =[\s\S]*?phase === "peek_opp"/);
  assert.match(table, /phase === "blind_swap" \|\| phase === "king"/);
  assert.match(table, /!isTurn && !targetingOpponent/);
  assert.match(table, /view\.turn !== seat\) \|\|\s*targetingOpponent/);
});

test("temporary reveals and snap windows show accurate countdowns", () => {
  assert.match(table, /function ActionCountdown/);
  assert.match(table, /deadline: Date\.now\(\) \+ ms/);
  assert.match(table, /label="Snap"/);
  assert.match(table, /label: countdownLabel/);
  assert.match(styles, /\.cb-action-countdown-track/);
});

test("opponent stock draws animate only a face-down card", () => {
  assert.match(table, /e\.type === "draw"[\s\S]*?e\.source === "stock"/);
  assert.match(table, /e\.seat !== seat/);
  assert.match(table, /className="cb-opponent-draw"/);
  assert.match(table, /<PlayingCard face=\{null\} up=\{false\}/);
  assert.match(styles, /\.cb-opponent-draw/);
});

test("opponent swaps animate the replaced card into the discard", () => {
  assert.match(table, /e\.type === "swap_in"[\s\S]*?e\.seat !== seat/);
  assert.match(table, /e\.type === "discard"[\s\S]*?e\.source === "swap"/);
  assert.match(table, /function OpponentSwapAnimation/);
  assert.match(table, /className="cb-opponent-swap-discard"/);
  assert.match(styles, /\.cb-opponent-swap-discard/);
});

test("seaside scene uses generated art with reduced-motion-safe ambience", () => {
  assert.match(backdrop, /cb-seaside-photo/);
  assert.match(styles, /seaside-terrace-v1\.jpg/);
  assert.match(styles, /@keyframes cb-sea-shimmer/);
  assert.match(styles, /prefers-reduced-motion[\s\S]*?cb-seaside-shimmer/);
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
  assert.doesNotMatch(table, /peekPop|cb-held-static/);
  assert.doesNotMatch(api, /skip_power/);
});

test("normal turns emphasize drawing before hand actions", () => {
  assert.match(table, /hint: "Draw a card"/);
  assert.match(table, /const targetingDraw = myTurn && phase === "turn"/);
  assert.doesNotMatch(table, /draw_discard/);
  assert.match(table, /targetingOpponent \|\|\s*targetingDraw/);
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
  assert.match(table, /"Your last turn!"/);
  assert.match(styles, /@keyframes cb-table-wham/);
});

test("fullscreen control uses a conventional SVG without twisting", () => {
  assert.match(table, /function FullscreenIcon/);
  assert.match(table, /<FullscreenIcon active=\{isFull\}/);
  assert.match(styles, /\.cb-gear:hover \{\s*transform: scale\(1\.06\);/);
});

test("untouchable cards and piles are always dimmed", () => {
  assert.match(table, /intent \? `is-target is-\$\{intent\}` : "is-disabled"/);
  assert.match(table, /view\.stock_count > 0 \? "is-target" : "is-disabled"/);
  assert.match(styles, /\.cb-slot\.is-disabled \.cbc/);
  assert.match(styles, /filter: grayscale\(0\.95\) brightness\(0\.62\)/);
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
