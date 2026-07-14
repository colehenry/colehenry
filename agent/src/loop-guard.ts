import { createHash } from "node:crypto";

export const LOOP_GUARD_LIMITS = {
  emergencyModelRounds: 200,
  repeatedCallNudge: 3,
  repeatedCallPause: 5,
  repeatedFailureNudge: 3,
  repeatedFailurePause: 5,
  staleCallNudge: 12,
  staleCallPause: 20,
  recentWindow: 12,
} as const;

export type LoopGuardDecision = {
  action: "continue" | "nudge" | "pause";
  reason?: "repeated_call" | "repeated_failure" | "no_progress" | "emergency_fuse";
  message?: string;
};

type Observation = {
  key: string;
  failureKey: string | null;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function nudge(reason: LoopGuardDecision["reason"], message: string): LoopGuardDecision {
  return { action: "nudge", reason, message };
}

function pause(reason: LoopGuardDecision["reason"], message: string): LoopGuardDecision {
  return { action: "pause", reason, message };
}

export class LoopGuard {
  private readonly seenSignatures = new Set<string>();
  private readonly observations: Observation[] = [];
  private staleCalls = 0;
  private repeatedCalls = 0;
  private nudgeIssuedForStaleRun = false;
  private toolCalls = 0;

  beforeModelRound(round: number): LoopGuardDecision {
    if (round < LOOP_GUARD_LIMITS.emergencyModelRounds) return { action: "continue" };
    return pause(
      "emergency_fuse",
      `The agent reached the ${LOOP_GUARD_LIMITS.emergencyModelRounds}-round emergency fuse.`,
    );
  }

  recordTool(input: {
    name: string;
    args: Record<string, unknown>;
    output: string;
    failed: boolean;
  }): LoopGuardDecision {
    this.toolCalls += 1;
    const signature = digest(`${input.name}:${stableJson(input.args)}`);
    const outputHash = digest(input.output);
    const key = `${signature}:${outputHash}:${input.failed ? "failed" : "ok"}`;
    const isNovelCall = !this.seenSignatures.has(signature);
    this.seenSignatures.add(signature);

    if (isNovelCall) {
      this.staleCalls = 0;
      this.nudgeIssuedForStaleRun = false;
    } else {
      this.staleCalls += 1;
    }

    const previous = this.observations.at(-1);
    this.repeatedCalls = previous?.key === key ? this.repeatedCalls + 1 : 1;
    const failureKey = input.failed ? `${signature}:${outputHash}` : null;
    this.observations.push({ key, failureKey });
    if (this.observations.length > LOOP_GUARD_LIMITS.recentWindow) this.observations.shift();

    const matchingFailures = failureKey
      ? this.observations.filter((observation) => observation.failureKey === failureKey).length
      : 0;

    if (this.repeatedCalls >= LOOP_GUARD_LIMITS.repeatedCallPause) {
      return pause("repeated_call", "The agent repeated the same tool call with the same result five times.");
    }
    if (matchingFailures >= LOOP_GUARD_LIMITS.repeatedFailurePause) {
      return pause("repeated_failure", "The same tool call failed five times without a successful alternative.");
    }
    if (this.staleCalls >= LOOP_GUARD_LIMITS.staleCallPause) {
      return pause("no_progress", "The recent tool activity did not gather new information or take a new action.");
    }

    if (!this.nudgeIssuedForStaleRun && this.repeatedCalls >= LOOP_GUARD_LIMITS.repeatedCallNudge) {
      this.nudgeIssuedForStaleRun = true;
      return nudge("repeated_call", "You are repeating the same tool call and receiving the same result.");
    }
    if (!this.nudgeIssuedForStaleRun && matchingFailures >= LOOP_GUARD_LIMITS.repeatedFailureNudge) {
      this.nudgeIssuedForStaleRun = true;
      return nudge("repeated_failure", "The same tool call is failing repeatedly.");
    }
    if (!this.nudgeIssuedForStaleRun && this.staleCalls >= LOOP_GUARD_LIMITS.staleCallNudge) {
      this.nudgeIssuedForStaleRun = true;
      return nudge("no_progress", "Your recent tool calls are revisiting known operations without measurable progress.");
    }
    return { action: "continue" };
  }

  stats(rounds: number) {
    return { model_rounds: rounds, tool_calls: this.toolCalls };
  }
}

export function strongerDecision(
  current: LoopGuardDecision,
  candidate: LoopGuardDecision,
): LoopGuardDecision {
  const priority = { continue: 0, nudge: 1, pause: 2 } as const;
  return priority[candidate.action] > priority[current.action] ? candidate : current;
}
