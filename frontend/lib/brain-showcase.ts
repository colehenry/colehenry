import type { Locale } from "@/lib/i18n/locale";

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

// Kept short on purpose: the compact showcase is a fixed 340px box, and on a
// phone anything longer than a few lines gets clipped by its overflow.
const deploymentAnswerEn = [
  "Healthy. It finished at 4:18 PM, passed its health check, and logged no runtime errors. ",
  "Linked to commit `8f3c2a1`, which refreshes the 2026 results pipeline.",
];

const dinnerAnswerEn = [
  "You like bold flavors and seafood, so try **Holbox** in Mercado La Paloma. ",
  "Get the ceviche to share with the pescado al carbón tacos.",
];

const calendarAnswerEn = [
  "**Catan night Wednesday** at **8PM**, and a **hike in Angeles National Forest** on **Sunday morning**. ",
  "Want me to add trail snacks to your grocery list?",
];

const deploymentAnswerEs = [
  "Correcto. Terminó a las 4:18 p. m., superó la comprobación de estado y no registró errores. ",
  "Vinculado al commit `8f3c2a1`, que actualiza el pipeline de resultados de 2026.",
];

const dinnerAnswerEs = [
  "Te gustan los sabores intensos y los mariscos, así que prueba **Holbox** en Mercado La Paloma. ",
  "Pide el ceviche para compartir con los tacos de pescado al carbón.",
];

const calendarAnswerEs = [
  "**Noche de Catan el miércoles** a las **8 p. m.**, y una **caminata en el Bosque Nacional de Los Ángeles** el **domingo por la mañana**. ",
  "¿Agrego snacks para la caminata a tu lista de compras?",
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
      ...textEvents(deploymentAnswerEn),
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
      ...textEvents(dinnerAnswerEn),
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
      ...textEvents(calendarAnswerEn),
      { type: "done", delay: 80 },
    ],
  },
];

const BRAIN_SHOWCASE_CONVERSATIONS_ES: ShowcaseConversation[] = [
  {
    id: "lapwise-deployment",
    prompt: "¿Está funcionando correctamente el despliegue más reciente de Lapwise?",
    events: [
      {
        type: "tool",
        name: "enable_capabilities",
        label: "abriendo herramientas de Railway",
        delay: 280,
      },
      {
        type: "tool",
        name: "list_railway_deployments",
        label: "revisando despliegues de Lapwise",
        delay: 380,
      },
      {
        type: "tool",
        name: "get_railway_logs",
        label: "leyendo registros de ejecución de Lapwise",
        delay: 440,
      },
      ...textEvents(deploymentAnswerEs),
      { type: "done", delay: 80 },
    ],
  },
  {
    id: "dinner",
    prompt: "¿Qué debería cenar esta noche?",
    events: [
      {
        type: "tool",
        name: "read_note",
        label: "revisando preferencias de comida guardadas",
        delay: 340,
      },
      {
        type: "tool",
        name: "web_search",
        label: "buscando opciones actuales para cenar en Los Ángeles",
        delay: 460,
      },
      ...textEvents(dinnerAnswerEs),
      { type: "done", delay: 80 },
    ],
  },
  {
    id: "calendar",
    prompt: "¿Qué tengo programado esta semana?",
    events: [
      {
        type: "tool",
        name: "enable_capabilities",
        label: "abriendo herramientas de Calendario",
        delay: 280,
      },
      {
        type: "tool",
        name: "list_google_calendar_events",
        label: "leyendo el calendario de esta semana",
        delay: 380,
      },
      ...textEvents(calendarAnswerEs),
      { type: "done", delay: 80 },
    ],
  },
];

const CONVERSATIONS_BY_LOCALE: Record<
  Locale,
  ShowcaseConversation[]
> = {
  en: BRAIN_SHOWCASE_CONVERSATIONS,
  es: BRAIN_SHOWCASE_CONVERSATIONS_ES,
};

export function getBrainShowcaseConversations(
  locale: Locale,
): ShowcaseConversation[] {
  return CONVERSATIONS_BY_LOCALE[locale];
}
