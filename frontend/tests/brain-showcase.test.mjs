import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BRAIN_SHOWCASE_CONVERSATIONS,
  completeShowcaseConversation,
} from "../lib/brain-showcase.ts";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("showcase contains three complete scripted conversations", () => {
  assert.equal(BRAIN_SHOWCASE_CONVERSATIONS.length, 3);

  for (const conversation of BRAIN_SHOWCASE_CONVERSATIONS) {
    const playback = completeShowcaseConversation(conversation);
    assert.equal(playback.complete, true);
    assert.ok(playback.tools.length >= 2);
    assert.ok(playback.text.length > 80);
  }
});

test("showcase frontend has no live data or authentication dependency", () => {
  const sources = [
    readSource("components/brain/brain-showcase.tsx"),
    readSource("components/brain/brain-showcase-lazy.tsx"),
    readSource("lib/brain-showcase.ts"),
  ].join("\n");

  for (const forbidden of [
    "@/lib/api/brain",
    "apiFetch",
    "fetch(",
    "useQuery",
    "useMe",
    "googleLoginUrl",
  ]) {
    assert.equal(sources.includes(forbidden), false, forbidden);
  }
});

test("proxy exposes only the Brain examples before owner gating", () => {
  const proxy = readSource("proxy.ts");
  const publicException = proxy.indexOf(
    'request.nextUrl.pathname === "/brain/examples"',
  );
  const ownerGate = proxy.indexOf('if (!request.cookies.has(SESSION_COOKIE))');

  assert.ok(publicException > 0);
  assert.ok(ownerGate > publicException);
  assert.match(proxy, /"\/brain\/:path\*"/);
});

test("example UI mirrors Brain without adding scroll containers", () => {
  const source = readSource("components/brain/brain-showcase.tsx");
  assert.match(source, /<span className="term-user">colehenry<\/span>/);
  assert.match(source, /modelSlugs=\{EXAMPLE_MODEL_SLUGS\}/);
  assert.match(source, /dimBackground=\{false\}/);
  assert.match(source, /modal=\{false\}/);
  assert.match(source, /aria-label="New example chat"/);
  assert.match(source, /}, 5000\);/);
  assert.doesNotMatch(source, /overflow-y-auto/);
  assert.doesNotMatch(source, /BrainDrawer|FolderTree|example note/i);

  const fixture = readSource("lib/brain-showcase.ts");
  assert.doesNotMatch(fixture, /BRAIN_SHOWCASE_NOTES|demo\//);
});
