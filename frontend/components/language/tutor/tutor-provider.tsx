"use client";

/**
 * Tutor context: the current on-screen *focus* (set by whichever view is
 * showing), the dock's open/closed state, and the navigation hooks the tag
 * renderer needs ([[ref:]] → reference sheet, [[activity:]] → practice).
 *
 * Views call `useTutorFocus(focus)`; inline triggers call `open({ prefill })`.
 * Everything is a no-op without a provider so the showcase keeps working.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { TutorFocus } from "@/lib/api/tutor";

export type TutorOpenOptions = { focus?: TutorFocus | null; prefill?: string; send?: boolean };

type TutorContextValue = {
  focus: TutorFocus | null;
  setFocus: (focus: TutorFocus | null) => void;
  isOpen: boolean;
  open: (opts?: TutorOpenOptions) => void;
  close: () => void;
  toggle: () => void;
  prefillVersion: number;
  /** Consumed once by the dock when it opens with a prefilled question. */
  takePrefill: () => { text: string; send: boolean } | null;
  onOpenRef?: (ref: string) => void;
  onOpenActivity?: (activityId: string) => void;
};

const TutorContext = createContext<TutorContextValue | null>(null);

export function TutorProvider({
  children,
  onOpenRef,
  onOpenActivity,
}: {
  children: React.ReactNode;
  onOpenRef?: (ref: string) => void;
  onOpenActivity?: (activityId: string) => void;
}) {
  const [focus, setFocusState] = useState<TutorFocus | null>(null);
  const [isOpen, setOpen] = useState(false);
  const [prefillVersion, setPrefillVersion] = useState(0);
  const prefillRef = useRef<{ text: string; send: boolean } | null>(null);

  // Views re-render often; only accept a focus that actually changed.
  const setFocus = useCallback((next: TutorFocus | null) => {
    setFocusState((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
  }, []);

  const open = useCallback(
    (opts?: TutorOpenOptions) => {
      if (opts?.focus !== undefined) setFocus(opts.focus);
      if (opts?.prefill) {
        prefillRef.current = { text: opts.prefill, send: Boolean(opts.send) };
        setPrefillVersion((version) => version + 1);
      }
      setOpen(true);
    },
    [setFocus],
  );
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const takePrefill = useCallback(() => {
    const p = prefillRef.current;
    prefillRef.current = null;
    return p;
  }, []);

  // ⌘K / Ctrl+K toggles the dock from anywhere in the app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo<TutorContextValue>(
    () => ({ focus, setFocus, isOpen, open, close, toggle, prefillVersion, takePrefill, onOpenRef, onOpenActivity }),
    [focus, setFocus, isOpen, open, close, toggle, prefillVersion, takePrefill, onOpenRef, onOpenActivity],
  );
  return <TutorContext.Provider value={value}>{children}</TutorContext.Provider>;
}

/** Null outside a provider (showcase / read-only) — callers must tolerate it. */
export function useTutor(): TutorContextValue | null {
  return useContext(TutorContext);
}

/** Declare what the tutor should see while this component is on screen. */
export function useTutorFocus(focus: TutorFocus | null) {
  const tutor = useTutor();
  const setFocus = tutor?.setFocus;
  const key = JSON.stringify(focus);
  useEffect(() => {
    if (!setFocus) return;
    setFocus(focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setFocus, key]);
}
