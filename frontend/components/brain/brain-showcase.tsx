"use client";

import {
  Cloud,
  FileText,
  Globe2,
  Plus,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ModelPicker } from "@/components/brain/model-picker";
import {
  applyShowcaseEvent,
  EMPTY_SHOWCASE_PLAYBACK,
  getBrainShowcaseConversations,
  type ShowcasePlayback,
} from "@/lib/brain-showcase";
import { type Locale, useLocale } from "@/lib/i18n/locale";

import "./brain.css";

const EXAMPLE_MODEL_SLUGS = [
  "deepseek/deepseek-v4-flash",
  "mistralai/mistral-small-2603",
  "anthropic/claude-opus-5",
];

const SHOWCASE_COPY = {
  en: {
    badge: "examples",
    newChat: "New example chat",
    questions: "example questions",
    choose: "Choose a question to see a streamed example response.",
    response: "Example Brain response",
    checking: "checking context…",
  },
  es: {
    badge: "ejemplos",
    newChat: "Nuevo chat de ejemplo",
    questions: "preguntas de ejemplo",
    choose: "Elige una pregunta para ver una respuesta de ejemplo en tiempo real.",
    response: "Respuesta de ejemplo de Brain",
    checking: "revisando contexto…",
  },
};

function LocalizedBrainShowcase({
  compact,
  locale,
}: {
  compact: boolean;
  locale: Locale;
}) {
  const conversations = getBrainShowcaseConversations(locale);
  const copy = SHOWCASE_COPY[locale];
  const [activeId, setActiveId] = useState<string | null>(() =>
    compact ? "lapwise-deployment" : null,
  );
  const active = conversations.find(({ id }) => id === activeId) ?? null;
  const [playback, setPlayback] = useState<ShowcasePlayback>(
    EMPTY_SHOWCASE_PLAYBACK,
  );
  const [eventIndex, setEventIndex] = useState(0);
  const [model, setModel] = useState("deepseek/deepseek-v4-flash");

  function startConversation(conversationId: string) {
    setActiveId(conversationId);
    setPlayback(EMPTY_SHOWCASE_PLAYBACK);
    setEventIndex(0);
  }

  function reset() {
    setActiveId(null);
    setPlayback(EMPTY_SHOWCASE_PLAYBACK);
    setEventIndex(0);
  }

  useEffect(() => {
    if (!active || eventIndex >= active.events.length) return;

    const event = active.events[eventIndex];
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(() => {
      setPlayback((current) => applyShowcaseEvent(current, event));
      setEventIndex((current) => current + 1);
    }, reduceMotion ? 0 : event.delay);

    return () => window.clearTimeout(timer);
  }, [active, eventIndex]);

  useEffect(() => {
    if (!compact || !active || !playback.complete) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => {
      const current = conversations.findIndex(
        (conversation) => conversation.id === active.id,
      );
      const next = (current + 1) % conversations.length;
      setActiveId(conversations[next].id);
      setPlayback(EMPTY_SHOWCASE_PLAYBACK);
      setEventIndex(0);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [active, compact, conversations, playback.complete]);

  return (
    <div
      className={`brain-term brain-workspace brain-showcase ${compact ? "brain-showcase-compact" : ""}`}
    >
      <section className="flex min-h-0 flex-1 flex-col">
        <header className="brain-workspace-header">
          <div className="brain-workspace-header-inner">
            <span className="min-w-0 flex-1 truncate text-xs text-[var(--term-dim)]">
              brain/examples
            </span>
            <ModelPicker
              model={model}
              onChange={setModel}
              modelSlugs={EXAMPLE_MODEL_SLUGS}
              dimBackground={false}
              modal={false}
            />
            <span className="brain-showcase-badge">{copy.badge}</span>
            {!compact && (
              <button
                type="button"
                onClick={reset}
                className="brain-icon-control"
                aria-label={copy.newChat}
              >
                <Plus className="size-4" />
              </button>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            {!active ? (
              <div className="brain-showcase-welcome">
                <div className="flex items-center gap-2 text-xs text-[var(--term-dim)]">
                  <Sparkles className="size-3.5 text-[var(--term-accent)]" />
                  {copy.questions}
                </div>
                <p className="mt-3 text-sm text-[var(--term-fg)]">
                  {copy.choose}
                </p>
                <div className="mt-4 grid gap-2">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => startConversation(conversation.id)}
                      className="brain-showcase-prompt"
                    >
                      {conversation.prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="brain-turn">
                  <span className="term-user">colehenry</span>
                  <span className="min-w-0 text-[var(--term-fg)]">
                    {active.prompt}
                  </span>
                </div>
                <div className="brain-turn">
                  <span className="term-brain">brain</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    {playback.tools.map((tool, index) => (
                      <div
                        key={`${tool.label}-${index}`}
                        className="term-tool flex items-center gap-1.5 text-xs"
                      >
                        {tool.name === "web_search" ? (
                          <Globe2 className="size-3.5 shrink-0" />
                        ) : tool.name.includes("railway") ? (
                          <Cloud className="size-3.5 shrink-0" />
                        ) : (
                          <FileText className="size-3.5 shrink-0" />
                        )}
                        <span>{tool.label}</span>
                      </div>
                    ))}
                    <div
                      className="brain-term-prose"
                      aria-live="polite"
                      aria-label={copy.response}
                    >
                      {playback.text ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {playback.text}
                        </ReactMarkdown>
                      ) : (
                        <span className="text-xs text-[var(--term-dim)]">
                          {copy.checking}
                        </span>
                      )}
                      {!playback.complete && playback.text && (
                        <span className="term-cursor" aria-hidden />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export function BrainShowcase({ compact = false }: { compact?: boolean }) {
  const { locale } = useLocale();
  return (
    <LocalizedBrainShowcase key={locale} compact={compact} locale={locale} />
  );
}
