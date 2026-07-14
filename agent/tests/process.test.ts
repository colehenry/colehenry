import assert from "node:assert/strict";
import test from "node:test";

import { runProcess } from "../src/process.js";

test("bounds retained and streamed command output", async () => {
  let streamed = "";
  const result = await runProcess(
    process.execPath,
    ["-e", "process.stdout.write('x'.repeat(1000))"],
    {
      cwd: process.cwd(),
      maxBytes: 100,
      maxOutputEventBytes: 80,
      onOutput: (_stream, chunk) => { streamed += chunk; },
    },
  );
  assert.equal(result.code, 0);
  assert.equal(result.stdout.length, 100);
  assert.equal((streamed.match(/x/g) ?? []).length, 80);
  assert.match(streamed, /output truncated/);
});
