"use client";

import { LanguageApp } from "./language-app";
import "./xp.css";

/**
 * The public preview is the real app with live data in read-only mode —
 * see LanguageApp's `readOnly` prop and the backend's public `/language`
 * read router. `compact` renders the same surface at miniature scale for
 * the portfolio card (styles in xp.css under `.qnst-showcase.is-compact`).
 */
export function QuenoseteolvideShowcase({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className={`qnst-showcase ${compact ? "is-compact" : ""}`}>
      <LanguageApp readOnly />
    </div>
  );
}
