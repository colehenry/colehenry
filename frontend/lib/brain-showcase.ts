export type ShowcaseToolEvent = {
  type: "tool";
  name:
    | "enable_capabilities"
    | "list_railway_deployments"
    | "get_railway_logs"
    | "list_google_calendar_events"
    | "read_note"
    | "web_search";
  label: string;
  delay: number;
};

export type ShowcaseTextEvent = {
  type: "text";
  content: string;
  delay: number;
};

export type ShowcaseDoneEvent = {
  type: "done";
  delay: number;
};

export type ShowcaseEvent =
  | ShowcaseToolEvent
  | ShowcaseTextEvent
  | ShowcaseDoneEvent;

export type ShowcaseConversation = {
  id: string;
  prompt: string;
  events: ShowcaseEvent[];
};

export type ShowcasePlayback = {
  tools: ShowcaseToolEvent[];
  text: string;
  complete: boolean;
};

export const EMPTY_SHOWCASE_PLAYBACK: ShowcasePlayback = {
  tools: [],
  text: "",
  complete: false,
};

export function applyShowcaseEvent(
  playback: ShowcasePlayback,
  event: ShowcaseEvent,
): ShowcasePlayback {
  if (event.type === "tool") {
    return { ...playback, tools: [...playback.tools, event] };
  }
  if (event.type === "text") {
    return { ...playback, text: playback.text + event.content };
  }
  return { ...playback, complete: true };
}

export function completeShowcaseConversation(
  conversation: ShowcaseConversation,
): ShowcasePlayback {
  return conversation.events.reduce(
    applyShowcaseEvent,
    EMPTY_SHOWCASE_PLAYBACK,
  );
}

const deploymentAnswer = [
  "The latest example Lapwise deployment completed successfully at 4:18 PM. ",
  "The service started cleanly, its health check passed, and the runtime logs contain no errors in the inspected window. ",
  "It is linked to commit `8f3c2a1`, which refreshes the 2026 results pipeline. I would still open the results route before treating the release as fully verified.",
];

const dinnerAnswer = [
  "You generally like bold flavors, seafood, and places that feel unique to LA. If you're looking for something new, try out **Holbox** in Mercado La Paloma tonight. ",
  "Customers generally like the ceviche to share, with the pescado al carbón tacos.",
];

const calendarAnswer = [
  "You have **Catan night on Wednesday** at **8PM** and a **hike in Angeles National Forest** planned for **Sunday morning**. ",
  "Want me to add anything any trail snacks to your grocery list?",
];

function textEvents(chunks: string[]): ShowcaseTextEvent[] {
  return chunks.map((content) => ({
    type: "text",
    content,
    delay: 240,
  }));
}

export const BRAIN_SHOWCASE_CONVERSATIONS: ShowcaseConversation[] = [
  {
    id: "lapwise-deployment",
    prompt: "Is the latest Lapwise deployment healthy?",
    events: [
      {
        type: "tool",
        name: "enable_capabilities",
        label: "opening Railway tools",
        delay: 280,
      },
      {
        type: "tool",
        name: "list_railway_deployments",
        label: "checking Lapwise deployments",
        delay: 380,
      },
      {
        type: "tool",
        name: "get_railway_logs",
        label: "reading Lapwise runtime logs",
        delay: 440,
      },
      ...textEvents(deploymentAnswer),
      { type: "done", delay: 80 },
    ],
  },
  {
    id: "dinner",
    prompt: "What should I get for dinner tonight?",
    events: [
      {
        type: "tool",
        name: "read_note",
        label: "checking saved food preferences",
        delay: 340,
      },
      {
        type: "tool",
        name: "web_search",
        label: "searching current dinner options in Los Angeles",
        delay: 460,
      },
      ...textEvents(dinnerAnswer),
      { type: "done", delay: 80 },
    ],
  },
  {
    id: "calendar",
    prompt: "What do I have coming up this week?",
    events: [
      {
        type: "tool",
        name: "enable_capabilities",
        label: "opening Calendar tools",
        delay: 280,
      },
      {
        type: "tool",
        name: "list_google_calendar_events",
        label: "reading this week's calendar",
        delay: 380,
      },
      ...textEvents(calendarAnswer),
      { type: "done", delay: 80 },
    ],
  },
];
