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

const deploymentAnswerEn = [
  "The latest example Lapwise deployment completed successfully at 4:18 PM. ",
  "The service started cleanly, passed its health check, and showed no runtime errors. ",
  "It is linked to commit `8f3c2a1`, which refreshes the 2026 results pipeline.",
];

const dinnerAnswerEn = [
  "You generally like bold flavors, seafood, and places that feel unique to LA. If you're looking for something new, try out **Holbox** in Mercado La Paloma tonight. ",
  "Customers generally like the ceviche to share, with the pescado al carbón tacos.",
];

const calendarAnswerEn = [
  "You have **Catan night on Wednesday** at **8PM** and a **hike in Angeles National Forest** planned for **Sunday morning**. ",
  "Want me to add anything any trail snacks to your grocery list?",
];

const deploymentAnswerEs = [
  "El último despliegue de ejemplo de Lapwise se completó correctamente a las 4:18 p. m. ",
  "El servicio inició sin problemas, superó la comprobación de estado y no mostró errores de ejecución. ",
  "Está vinculado al commit `8f3c2a1`, que actualiza el pipeline de resultados de 2026.",
];

const dinnerAnswerEs = [
  "Por lo general te gustan los sabores intensos, los mariscos y los lugares que se sienten únicos de Los Ángeles. Si buscas algo nuevo, prueba **Holbox** en Mercado La Paloma esta noche. ",
  "A los clientes les suele gustar compartir el ceviche y pedir los tacos de pescado al carbón.",
];

const calendarAnswerEs = [
  "Tienes **noche de Catan el miércoles** a las **8 p. m.** y una **caminata en el Bosque Nacional de Los Ángeles** planeada para la **mañana del domingo**. ",
  "¿Quieres que agregue algún snack para la caminata a tu lista de compras?",
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
