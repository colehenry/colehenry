import assert from "node:assert/strict";
import test from "node:test";

import { LOOP_GUARD_LIMITS, LoopGuard } from "../src/loop-guard.js";

function call(guard: LoopGuard, index: number, failed = false) {
  return guard.recordTool({
    name: "read_file",
    args: { path: `src/file-${index}.ts` },
    output: failed ? "Tool failed: missing" : `content-${index}`,
    failed,
  });
}

test("allows long runs that keep making novel tool calls", () => {
  const guard = new LoopGuard();
  for (let index = 0; index < 150; index += 1) {
    assert.equal(call(guard, index).action, "continue");
  }
});

test("nudges and then pauses an identical repeated call", () => {
  const guard = new LoopGuard();
  assert.equal(call(guard, 1).action, "continue");
  assert.equal(call(guard, 1).action, "continue");
  assert.equal(call(guard, 1).action, "nudge");
  assert.equal(call(guard, 1).action, "continue");
  const decision = call(guard, 1);
  assert.equal(decision.action, "pause");
  assert.equal(decision.reason, "repeated_call");
});

test("pauses the same recurring failure even when other calls occur between attempts", () => {
  const guard = new LoopGuard();
  let decision = call(guard, 1, true);
  for (let index = 0; index < 4; index += 1) {
    call(guard, 100 + index);
    decision = call(guard, 1, true);
  }
  assert.equal(decision.action, "pause");
  assert.equal(decision.reason, "repeated_failure");
});

test("detects an alternating loop that avoids identical consecutive calls", () => {
  const guard = new LoopGuard();
  call(guard, 1);
  call(guard, 2);
  let sawNudge = false;
  let decision = call(guard, 1);
  for (let index = 1; index < LOOP_GUARD_LIMITS.staleCallPause; index += 1) {
    decision = call(guard, index % 2 === 0 ? 1 : 2);
    if (decision.action === "nudge") sawNudge = true;
    if (decision.action === "pause") break;
  }
  assert.equal(sawNudge, true);
  assert.equal(decision.action, "pause");
  assert.equal(decision.reason, "no_progress");
});

test("keeps a high emergency fuse without failing ordinary agent runs", () => {
  const guard = new LoopGuard();
  assert.equal(guard.beforeModelRound(LOOP_GUARD_LIMITS.emergencyModelRounds - 1).action, "continue");
  const decision = guard.beforeModelRound(LOOP_GUARD_LIMITS.emergencyModelRounds);
  assert.equal(decision.action, "pause");
  assert.equal(decision.reason, "emergency_fuse");
});
