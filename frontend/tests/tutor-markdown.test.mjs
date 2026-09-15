import assert from "node:assert/strict";
import test from "node:test";

import {
  knownVerbsPlugin,
  tagsToLinks,
} from "../lib/tutor-markdown.ts";

function transform(tree, verbs = ["être", "avoir", "aller", "faire"]) {
  knownVerbsPlugin(verbs)()(tree);
  return tree;
}

test("converts tutor tags without native tooltip metadata", () => {
  assert.equal(
    tagsToLinks("[[vocab:être]] [[ref:core-verbs#present|verb sheet]]"),
    "[être](tutor://vocab/%C3%AAtre) [verb sheet](tutor://ref/core-verbs%23present)",
  );
});

test("links bold untagged infinitives case-insensitively", () => {
  const tree = {
    type: "root",
    children: [
      {
        type: "strong",
        children: [{ type: "text", value: "ÊTRE and avoir" }],
      },
    ],
  };

  transform(tree);
  assert.deepEqual(tree.children[0].children, [
    {
      type: "link",
      url: "tutor://verb/%C3%8ATRE",
      children: [{ type: "text", value: "ÊTRE" }],
    },
    { type: "text", value: " and " },
    {
      type: "link",
      url: "tutor://verb/avoir",
      children: [{ type: "text", value: "avoir" }],
    },
  ]);
});

test("does not retag links, code, or verbs inside hyphenated words", () => {
  const existing = {
    type: "link",
    url: "tutor://vocab/%C3%AAtre",
    children: [{ type: "text", value: "être" }],
  };
  const tree = {
    type: "root",
    children: [
      existing,
      { type: "text", value: " peut-être " },
      { type: "inlineCode", value: "avoir" },
      { type: "text", value: " aller" },
    ],
  };

  transform(tree);
  assert.equal(tree.children[0], existing);
  assert.equal(tree.children[1].value, " peut-être ");
  assert.equal(tree.children[2].value, "avoir");
  assert.equal(tree.children[4].url, "tutor://verb/aller");
});
