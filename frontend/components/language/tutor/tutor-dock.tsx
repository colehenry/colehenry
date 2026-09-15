"use client";

/**
 * The bottom-right tutor window. Collapsed it is a small pill showing what the
 * tutor currently "sees" (the focus chip); open it is a chat over one persisted
 * thread, with preset questions per surface. ⌘K toggles it (see provider).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { TutorMarkdown } from "@/components/language/tutor/tutor-message";
import { useTutor } from "@/components/language/tutor/tutor-provider";
import {
  createTutorThread,
  deleteTutorThread,
  fetchTutorStatus,
  fetchTutorThread,
  focusLabel,
  listTutorThreads,
  streamTutorMessage,
  type TutorFocus,
  type TutorLang,
} from "@/lib/api/tutor";

type LocalMessage = {
  key: string;
  role: "user" | "assistant" | "divider";
  content: string;
  focus?: TutorFocus | Record<string, unknown> | null;
  tools?: string[];
  streaming?: boolean;
  error?: string;
  cost?: number;
};

type TutorPreset = { label: string; text: string };

const PRESETS: Record<TutorLang, Record<string, TutorPreset[]>> = {
  es: {
    exercise: [
      { label: "¿por qué?", text: "¿Por qué es esa la respuesta correcta? Explícame la regla." },
      { label: "vs español", text: "¿En qué se diferencia esto del español? ¿Dónde está la trampa?" },
      { label: "otra frase", text: "Dame dos frases más con esta misma estructura, con vocabulario que ya conozco." },
      { label: "dilo lento", text: "Pronuncia la respuesta despacio y dime en qué sonidos fijarme." },
    ],
    vocab: [
      { label: "¿cómo se usa?", text: "¿Cómo uso esta palabra en una frase? Dame ejemplos con lo que ya sé." },
      { label: "vs español", text: "¿Se parece al español? ¿Hay alguna trampa?" },
      { label: "pronúncialo", text: "¿Cómo se pronuncia? Dame el IPA y un contraste." },
    ],
    reference: [
      { label: "explícamelo", text: "Explícame esta sección con un ejemplo por punto." },
      { label: "un ejercicio", text: "Ponme un mini-ejercicio de 3 preguntas sobre esta sección y corrígeme." },
    ],
    text: [
      { label: "explica", text: "Explícame esta frase: estructura, verbo y vocabulario." },
      { label: "otra forma", text: "¿Cómo diría esto de otra forma, en francés hablado?" },
    ],
    default: [
      { label: "¿cómo voy?", text: "¿Cómo voy en el sprint? ¿Qué debería repasar hoy?" },
      { label: "algo débil", text: "Dime mi punto más débil ahora mismo y una actividad de 5 minutos para trabajarlo." },
    ],
  },
  en: {
    exercise: [
      { label: "why?", text: "Why is that the correct answer? Explain the rule." },
      { label: "vs Spanish", text: "How does this differ from Spanish? Where is the trap?" },
      { label: "another sentence", text: "Give me two more sentences with the same structure, using vocabulary I already know." },
      { label: "say it slowly", text: "Pronounce the answer slowly and tell me which sounds to listen for." },
    ],
    vocab: [
      { label: "how is it used?", text: "How do I use this word in a sentence? Give me examples using what I already know." },
      { label: "vs Spanish", text: "Is it similar to Spanish? Are there any traps?" },
      { label: "pronounce it", text: "How is it pronounced? Give me the IPA and a contrast." },
    ],
    reference: [
      { label: "explain it", text: "Explain this section with one example per point." },
      { label: "an exercise", text: "Give me a three-question mini-exercise on this section and correct me." },
    ],
    text: [
      { label: "explain", text: "Explain this sentence: its structure, verb, and vocabulary." },
      { label: "another way", text: "How would I say this another way in spoken French?" },
    ],
    default: [
      { label: "how am I doing?", text: "How am I doing in this sprint? What should I review today?" },
      { label: "weak spot", text: "Tell me my weakest point right now and give me a five-minute activity to work on it." },
    ],
  },
};

const LANG_KEY = "qnst-tutor-lang";

function loadLang(): TutorLang {
  try {
    return (window.localStorage.getItem(LANG_KEY) as TutorLang) || "es";
  } catch {
    return "es";
  }
}

export function TutorDock() {
  const tutor = useTutor();
  const queryClient = useQueryClient();
  const [threadId, setThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [lang, setLang] = useState<TutorLang>("es");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"chat" | "threads">("chat");
  const abortRef = useRef<AbortController | null>(null);
  const previousSurfaceRef = useRef<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const status = useQuery({ queryKey: ["language", "tutor", "status"], queryFn: fetchTutorStatus, staleTime: 5 * 60_000 });
  const threads = useQuery({
    queryKey: ["language", "tutor", "threads"],
    queryFn: () => listTutorThreads(40),
    enabled: view === "threads",
  });
  const removeThread = useMutation({
    mutationFn: deleteTutorThread,
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ["language", "tutor", "threads"] });
      if (id === threadId) {
        setThreadId(null);
        setMessages([]);
      }
    },
  });

  useEffect(() => {
    const id = window.setTimeout(() => setLang(loadLang()), 0);
    return () => window.clearTimeout(id);
  }, []);
  const chooseLang = (next: TutorLang) => {
    setLang(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      /* private mode */
    }
  };

  const scrollToEnd = useCallback(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  useEffect(scrollToEnd, [messages, scrollToEnd]);

  const isOpen = tutor?.isOpen ?? false;
  const focus = tutor?.focus ?? null;

  // Keep a long-running thread legible when the learner moves to another part
  // of the app. Per-question changes within one surface do not need a divider.
  useEffect(() => {
    const surface = focus?.surface ?? null;
    const previous = previousSurfaceRef.current;
    if (isOpen && previous && surface && previous !== surface) {
      const label = focusLabel(focus);
      setMessages((current) =>
        current.length
          ? [...current, { key: `focus-${Date.now()}`, role: "divider", content: `ahora: ${label || surface}` }]
          : current,
      );
    }
    previousSurfaceRef.current = surface;
  }, [focus, isOpen]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy || !tutor) return;
      setBusy(true);
      setView("chat");
      setInput("");
      let id = threadId;
      try {
        if (id === null) {
          const created = await createTutorThread(focus);
          id = created.id;
          setThreadId(id);
          void queryClient.invalidateQueries({ queryKey: ["language", "tutor", "threads"] });
        }
      } catch {
        setBusy(false);
        setMessages((m) => [...m, { key: `err-${Date.now()}`, role: "assistant", content: "", error: "no se pudo abrir el hilo" }]);
        return;
      }
      const userKey = `u-${Date.now()}`;
      const replyKey = `a-${Date.now()}`;
      setMessages((m) => [
        ...m,
        { key: userKey, role: "user", content, focus },
        { key: replyKey, role: "assistant", content: "", streaming: true, tools: [] },
      ]);
      const patch = (fn: (msg: LocalMessage) => LocalMessage) =>
        setMessages((m) => m.map((msg) => (msg.key === replyKey ? fn(msg) : msg)));
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        for await (const ev of streamTutorMessage(id, content, focus, lang, controller.signal)) {
          if (ev.type === "token") patch((msg) => ({ ...msg, content: msg.content + ev.text }));
          else if (ev.type === "reset") patch((msg) => ({ ...msg, content: "" }));
          else if (ev.type === "tool") patch((msg) => ({ ...msg, tools: [...(msg.tools ?? []), ev.label] }));
          else if (ev.type === "error") patch((msg) => ({ ...msg, error: ev.message }));
          else if (ev.type === "done") patch((msg) => ({ ...msg, content: ev.content || msg.content, streaming: false, cost: ev.cost }));
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          patch((msg) => ({ ...msg, error: "sin conexión", streaming: false }));
        }
      } finally {
        patch((msg) => ({ ...msg, streaming: false }));
        abortRef.current = null;
        setBusy(false);
        void queryClient.invalidateQueries({ queryKey: ["language", "tutor", "threads"] });
      }
    },
    [busy, tutor, threadId, focus, lang, queryClient],
  );

  // A prefilled question (from an inline trigger) lands in the box — or goes
  // straight out. prefillVersion also catches triggers while the dock is open.
  useEffect(() => {
    if (!isOpen || !tutor) return;
    // deferred: the prefill arrives from an external trigger, not from render state
    const id = window.setTimeout(() => {
      const pre = tutor.takePrefill();
      if (pre) {
        if (pre.send) void send(pre.text);
        else setInput(pre.text);
      }
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tutor?.prefillVersion]);

  const openThread = async (id: number) => {
    const detail = await fetchTutorThread(id);
    setThreadId(id);
    setMessages(
      detail.messages.map((m) => ({
        key: `m-${m.id}`,
        role: m.role,
        content: m.content,
        focus: m.focus ?? null,
        tools: Array.isArray(m.tool_calls) ? m.tool_calls.map((t) => String((t as { label?: string }).label ?? "")) : undefined,
      })),
    );
    setView("chat");
  };

  const newThread = () => {
    abortRef.current?.abort();
    setThreadId(null);
    setMessages([]);
    setView("chat");
    inputRef.current?.focus();
  };

  if (!tutor) return null;

  const chip = focusLabel(focus);
  const presets = PRESETS[lang][focus?.surface ?? ""] ?? PRESETS[lang].default;
  const unavailable = status.data && !status.data.available;
  const lastCost = [...messages].reverse().find((m) => m.cost !== undefined)?.cost;

  if (!isOpen) {
    return (
      <button type="button" className="tutor-pill" title="Tuteur (⌘K)" onClick={() => tutor.open()}>
        <span className="tutor-pill-icon">✦</span>
        <span>Tuteur</span>
        {chip && <span className="tutor-pill-chip">re: {chip}</span>}
      </button>
    );
  }

  return (
    <div className="tutor-dock" role="dialog" aria-label="Tuteur">
      <div className="xp-titlebar tutor-titlebar">
        <span className="xp-title-text">✦ Tuteur</span>
        <span className="tutor-title-actions">
          <button type="button" className="xp-caption-btn" title="Hilos" onClick={() => setView((v) => (v === "threads" ? "chat" : "threads"))}>
            ≡
          </button>
          <button type="button" className="xp-caption-btn" title="Nuevo hilo" onClick={newThread}>
            +
          </button>
          <button type="button" className="xp-caption-btn" title="Minimizar (⌘K)" onClick={tutor.close}>
            _
          </button>
        </span>
      </div>

      {view === "threads" ? (
        <div className="tutor-body" ref={bodyRef}>
          {threads.isPending && <div className="xp-muted">…</div>}
          {threads.data?.length === 0 && <div className="xp-muted">Sin hilos todavía.</div>}
          {threads.data?.map((t) => (
            <div key={t.id} className={`tutor-thread-row ${t.id === threadId ? "is-active" : ""}`}>
              <button type="button" className="tutor-thread-open" onClick={() => void openThread(t.id)}>
                <span className="tutor-thread-title">{t.title || "Sin título"}</span>
                {focusLabel(t.focus) && <span className="tutor-thread-chip">re: {focusLabel(t.focus)}</span>}
              </button>
              <button type="button" className="xp-link" title="Borrar" onClick={() => removeThread.mutate(t.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="tutor-body" ref={bodyRef}>
          {unavailable && <div className="tutor-notice">El tutor no está configurado (falta la clave del modelo).</div>}
          {messages.length === 0 && !unavailable && (
            <div className="tutor-empty">
              <p>{lang === "es" ? "Pregunta lo que quieras sobre el francés." : "Ask anything about French."}</p>
            </div>
          )}
          {messages.map((m) =>
            m.role === "divider" ? (
              <div key={m.key} className="tutor-focus-divider">
                <span>{m.content}</span>
              </div>
            ) : m.role === "user" ? (
              <div key={m.key} className="tutor-msg is-user">
                {focusLabel(m.focus) && <span className="tutor-msg-chip">re: {focusLabel(m.focus)}</span>}
                <div>{m.content}</div>
              </div>
            ) : (
              <div key={m.key} className="tutor-msg is-tutor">
                {m.tools && m.tools.length > 0 && (
                  <div className="tutor-tools">
                    {m.tools.map((t, i) => (
                      <span key={`${t}-${i}`}>✦ {t}</span>
                    ))}
                  </div>
                )}
                {m.content ? <TutorMarkdown content={m.content} /> : m.streaming ? <span className="tutor-cursor">▍</span> : null}
                {m.streaming && m.content && <span className="tutor-cursor">▍</span>}
                {m.error && <div className="tutor-error">⚠ {m.error}</div>}
              </div>
            ),
          )}
        </div>
      )}

      <div className="tutor-presets">
        {presets.map((p) => (
          <button key={p.label} type="button" className="tutor-preset" disabled={busy || Boolean(unavailable)} onClick={() => void send(p.text)}>
            {p.label}
          </button>
        ))}
      </div>

      <form
        className="tutor-compose"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <textarea
          ref={inputRef}
          className="xp-textarea tutor-input"
          rows={2}
          placeholder={lang === "es" ? (chip ? `Pregunta sobre "${chip}"…` : "Pregunta algo…") : (chip ? `Ask about "${chip}"…` : "Ask anything…")}
          value={input}
          disabled={Boolean(unavailable)}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(input);
            }
          }}
        />
        {busy ? (
          <button type="button" className="xp-btn is-small" onClick={() => abortRef.current?.abort()}>
            Parar
          </button>
        ) : (
          <button type="submit" className="xp-btn is-small is-default" disabled={!input.trim() || Boolean(unavailable)}>
            Enviar
          </button>
        )}
      </form>

      <div className="tutor-footer">
        <span className="tutor-lang">
          {(["es", "en"] as TutorLang[]).map((l) => (
            <button key={l} type="button" className={`xp-link ${lang === l ? "is-active" : ""}`} onClick={() => chooseLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </span>
        <span className="xp-muted">
          {chip ? `re: ${chip}` : "sin contexto"}
          {lastCost !== undefined && lastCost > 0 ? ` · $${lastCost.toFixed(4)}` : ""}
        </span>
      </div>
    </div>
  );
}
