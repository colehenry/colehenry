import assert from "node:assert/strict";
import test from "node:test";

import { canonicalizeLoopbackUrl } from "../lib/api/client.ts";

test("canonicalizes a loopback API override to the OAuth callback host", () => {
  assert.equal(
    canonicalizeLoopbackUrl("http://127.0.0.1:8000"),
    "http://localhost:8000",
  );
  assert.equal(
    canonicalizeLoopbackUrl("https://api.colehenry.dev"),
    "https://api.colehenry.dev",
  );
});
