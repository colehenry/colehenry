import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(
  new URL("../components/language/xp.css", import.meta.url),
  "utf8",
);
const references = readFileSync(
  new URL("../components/language/reference-view.tsx", import.meta.url),
  "utf8",
);

test("language shell is contained by the mobile viewport", () => {
  assert.match(css, /\.xp-app\s*\{[^}]*max-width:\s*100vw;[^}]*overflow-x:\s*clip;/s);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.xp-window\.is-narrow[\s\S]*?max-width:\s*100%;/);
  assert.match(css, /\.xp-main\s*\{[^}]*min-width:\s*0;[^}]*overflow-x:\s*auto;/s);
});

test("mobile navigation and reference selectors scroll or reflow locally", () => {
  assert.match(css, /\.xp-mobile-nav\s*\{[^}]*overflow-x:\s*auto;/s);
  assert.match(css, /@media \(max-width: 899px\)[\s\S]*?\.ref-list[\s\S]*?overflow-x:\s*auto;/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.ref-verb-jumps\s*\{\s*display:\s*none;/);
  assert.match(references, /className="xp-select ref-verb-jump-select"/);
  assert.match(references, /aria-label="Jump to a core verb"/);
});

test("mobile tutor uses the dynamic viewport instead of a desktop-sized float", () => {
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.tutor-dock\s*\{[^}]*width:\s*100vw;[^}]*height:\s*min\(72dvh, 560px\);/s);
});
