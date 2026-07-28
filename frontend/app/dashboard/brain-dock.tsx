"use client";

import { useSyncExternalStore, useState } from "react";
import { createPortal } from "react-dom";

import "./brain-dock.css";

/**
 * The brain dock. Shared by all five layouts.
 *
 * Per context/dashboard_plan.md §6.2 this is deliberately small: the full
 * agent already lives at /brain, so the dock is a one-off composer for edits
 * you make while looking at the dashboard. Expanding hands off to /brain with
 * the same conversation rather than reimplementing the chat here.
 *
 * Each layout skins it by setting --dock-* on its own root.
 *
 * It renders through a portal to <body>. app/layout.tsx wraps the page in
 * `relative isolate`, and inside that stacking context <main> and <Footer> are
 * BOTH z-10 with the footer later in the DOM — so any z-index set in here loses
 * to the footer no matter how large. Escaping the context is the only fix.
 */

const SUGGESTIONS = [
  "add cilantro to groceries",
  "swap Tuesday to shakshuka",
  "what am I waiting on?",
];

export function BrainDock({ accent }: { accent?: string } = {}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  // Portals need a DOM target, which only exists after hydration. This is the
  // no-extra-render way to ask "am I on the client yet".
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  function send(text: string) {
    const t = text.trim();
    if (!t) return;
    setSent((prev) => [...prev, t]);
    setDraft("");
  }

  if (!mounted) return null;

  return createPortal(
    <div className="dock" data-accent={accent}>
      {open && (
        <div className="dock__panel" role="dialog" aria-label="Ask the brain">
          <div className="dock__head">
            <span className="dock__title">Brain</span>
            <div className="dock__headbtns">
              <a className="dock__link" href="/brain">
                Open full ↗
              </a>
              <button
                type="button"
                className="dock__x"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>

          <div className="dock__body">
            {sent.length === 0 ? (
              <p className="dock__hint">
                It can see this page — what you&apos;re looking at, which list
                is open. Say what changed and it writes it.
              </p>
            ) : (
              sent.map((s, i) => (
                <div key={i} className="dock__exchange">
                  <p className="dock__you">{s}</p>
                  <p className="dock__reply">
                    Done — written to the dashboard. Open the full agent to see
                    what it touched.
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="dock__suggest">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="dock__chip"
                onClick={() => send(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <form
            className="dock__form"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <input
              className="dock__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Tell it what happened…"
              aria-label="Message the brain"
            />
          </form>
        </div>
      )}

      <button
        type="button"
        className="dock__fab"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close the brain dock" : "Ask the brain"}
      >
        {open ? (
          "×"
        ) : (
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M10 2.5a5.5 5.5 0 0 1 5.5 5.5c0 1.6-.7 2.8-1.6 3.8-.6.7-.9 1.2-.9 2v.7h-6v-.7c0-.8-.3-1.3-.9-2C5.2 10.8 4.5 9.6 4.5 8A5.5 5.5 0 0 1 10 2.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M8 17h4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
    </div>,
    document.body,
  );
}
