import assert from "node:assert/strict";
import test from "node:test";

import {
  CLOSED_VERB_CARD,
  reduceVerbCard,
} from "../lib/verb-card.ts";

test("hover and focus create a transient card", () => {
  const shown = reduceVerbCard(CLOSED_VERB_CARD, { type: "show" });
  assert.deepEqual(shown, { active: true, pinned: false });
  assert.deepEqual(
    reduceVerbCard(shown, { type: "hide_transient" }),
    CLOSED_VERB_CARD,
  );
});

test("click or tap pins until a second click", () => {
  const pinned = reduceVerbCard(CLOSED_VERB_CARD, { type: "toggle_pin" });
  assert.deepEqual(pinned, { active: true, pinned: true });
  assert.equal(reduceVerbCard(pinned, { type: "hide_transient" }), pinned);
  assert.deepEqual(
    reduceVerbCard(pinned, { type: "toggle_pin" }),
    CLOSED_VERB_CARD,
  );
});

test("Escape or outside click dismisses pinned and transient cards", () => {
  assert.deepEqual(
    reduceVerbCard({ active: true, pinned: true }, { type: "dismiss" }),
    CLOSED_VERB_CARD,
  );
  assert.deepEqual(
    reduceVerbCard({ active: true, pinned: false }, { type: "dismiss" }),
    CLOSED_VERB_CARD,
  );
});
