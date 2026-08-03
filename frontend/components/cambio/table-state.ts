export type Tone = "you" | "snap" | "power" | "good" | "neutral";
export type Moment = { key: string; tone: Tone; hint: string | null };

export function formatPoints(score: number): string {
  return `${score} ${score === 1 ? "pt" : "pts"}`;
}

export type PromptState = {
  phase: string;
  moveSeq: number;
  myTurn: boolean;
  iMaySnap: boolean;
  iMayGive: boolean;
  snapRank?: string;
  hasPrivateReveal: boolean;
  hasPickedCard: boolean;
  kingLooked: boolean;
};

function rankLabel(rank: string | undefined): string {
  return rank === "JO" ? "Joker" : (rank ?? "card");
}

/** One prompt policy for every authoritative phase. Timed opening/reveal
 * states use the countdown as their sole instruction, so they never create a
 * second floating pill or tell the observing player to remember a hidden face.
 */
export function deriveMoment(state: PromptState): Moment {
  const {
    phase,
    moveSeq,
    myTurn,
    iMaySnap,
    iMayGive,
    snapRank,
    hasPrivateReveal,
    hasPickedCard,
    kingLooked,
  } = state;

  if (phase === "round_end" || phase === "showdown_pending")
    return { key: "end", tone: "neutral", hint: null };
  if (phase === "opening") return { key: "opening", tone: "neutral", hint: null };
  if (phase === "power_reveal")
    return {
      key: `reveal-${moveSeq}`,
      tone: hasPrivateReveal ? "power" : "neutral",
      hint: null,
    };
  if (phase === "snap_give")
    return iMayGive
      ? { key: `give-${moveSeq}`, tone: "good", hint: "Give a card" }
      : { key: `give-wait-${moveSeq}`, tone: "neutral", hint: null };
  if (iMaySnap)
    return {
      key: `snap-${moveSeq}`,
      tone: "snap",
      hint: `Snap the ${rankLabel(snapRank)}`,
    };
  if (!myTurn) return { key: `opp-${moveSeq}`, tone: "neutral", hint: null };

  switch (phase) {
    case "turn":
      return { key: `turn-${moveSeq}`, tone: "you", hint: "Draw a card" };
    case "drawn":
      return { key: `drawn-${moveSeq}`, tone: "you", hint: null };
    case "peek_own":
      return { key: `peek-own-${moveSeq}`, tone: "power", hint: "Peek one of yours" };
    case "peek_opp":
      return { key: `peek-opp-${moveSeq}`, tone: "power", hint: "Peek an opponent card" };
    case "blind_swap":
      return hasPickedCard
        ? { key: `blind-target-${moveSeq}`, tone: "power", hint: "Pick a card to swap with" }
        : { key: `blind-own-${moveSeq}`, tone: "power", hint: "Blind swap - pick yours" };
    case "king":
      if (!kingLooked)
        return { key: `king-look-${moveSeq}`, tone: "power", hint: "Black King - look at a card" };
      return hasPickedCard
        ? { key: `king-target-${moveSeq}`, tone: "power", hint: "Pick the card to take" }
        : { key: `king-own-${moveSeq}`, tone: "power", hint: "Now pick one of yours to swap" };
    default:
      return { key: `idle-${moveSeq}`, tone: "neutral", hint: null };
  }
}

export function cardInteractionClass({
  intent,
}: {
  intent: "own" | "opp" | null;
}): string {
  if (intent) return `is-target is-${intent}`;
  return "is-neutral";
}

/** Return events appended after the exact last object we processed. The room
 * keeps a rolling event buffer, so an array-length cursor eventually stalls
 * when one old event is removed for every new event added. */
export function eventsAfter<T>(events: T[], lastEvent: T | null): T[] {
  if (lastEvent === null) return events;
  const lastIndex = events.indexOf(lastEvent);
  return lastIndex === -1 ? events : events.slice(lastIndex + 1);
}
