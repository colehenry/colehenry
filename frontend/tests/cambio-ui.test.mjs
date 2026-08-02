import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const table = readSource("components/cambio/table.tsx");
const styles = readSource("components/cambio/table.css");
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

test("rooms require explicit readiness before the opening reveal", () => {
  assert.match(table, /ready: \(\) => void/);
  assert.match(table, /Ready for next round/);
  assert.match(styles, /\.cb-ready-list/);
});

test("normal turns emphasize drawing before hand actions", () => {
  assert.match(table, /hint: "Draw a card"/);
  assert.match(table, /const targetingDraw = myTurn && phase === "turn"/);
  assert.match(table, /canDrawDiscard[\s\S]*?send\(\{ type: "draw_discard" \}\)/);
  assert.match(table, /targetingOpponent \|\|\s*targetingDraw/);
});

test("mobile layout keeps Cambio under the draw pile", () => {
  assert.match(styles, /"held draw discard"\s*"held action empty"/);
  assert.match(styles, /\.cb-pile:first-child[\s\S]*?grid-area: draw/);
  assert.match(styles, /\.cb-center-side\.is-right[\s\S]*?grid-area: action/);
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
