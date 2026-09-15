export type VerbCardState = { active: boolean; pinned: boolean };

export type VerbCardEvent =
  | { type: "show" }
  | { type: "hide_transient" }
  | { type: "toggle_pin" }
  | { type: "dismiss" };

export const CLOSED_VERB_CARD: VerbCardState = { active: false, pinned: false };

/** Pure interaction state shared by hover, keyboard focus, click, and touch. */
export function reduceVerbCard(state: VerbCardState, event: VerbCardEvent): VerbCardState {
  switch (event.type) {
    case "show":
      return state.active ? state : { ...state, active: true };
    case "hide_transient":
      return state.pinned ? state : CLOSED_VERB_CARD;
    case "toggle_pin":
      return state.pinned ? CLOSED_VERB_CARD : { active: true, pinned: true };
    case "dismiss":
      return CLOSED_VERB_CARD;
  }
}
