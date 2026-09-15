"use client";

/**
 * Tiny "ask the tutor" trigger to drop anywhere: an ✦ link that opens the dock
 * with the given focus and (optionally) a ready question. Renders nothing
 * without a provider (showcase).
 */

import { useTutor } from "@/components/language/tutor/tutor-provider";
import type { TutorFocus } from "@/lib/api/tutor";

export function TutorInline({
  focus,
  prefill,
  send = false,
  label = "✦ tuteur",
  className = "xp-link",
  title = "Pregúntale al tutor (⌘K)",
}: {
  focus?: TutorFocus | null;
  prefill?: string;
  send?: boolean;
  label?: string;
  className?: string;
  title?: string;
}) {
  const tutor = useTutor();
  if (!tutor) return null;
  return (
    <button type="button" className={className} title={title} onClick={() => tutor.open({ focus, prefill, send })}>
      {label}
    </button>
  );
}
