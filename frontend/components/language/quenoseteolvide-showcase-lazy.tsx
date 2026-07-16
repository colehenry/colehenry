"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

/**
 * Defers the showcase — the real LanguageApp, which fires live study/deck
 * queries the moment it mounts — until it is nearly on screen. On the home
 * page it is a decorative miniature far below the fold, so mounting it eagerly
 * spent app-sized JS and API round-trips on a thumbnail nobody had scrolled to.
 */
const QuenoseteolvideShowcase = dynamic(
  () =>
    import("./quenoseteolvide-showcase").then((m) => m.QuenoseteolvideShowcase),
  // the app is client-only anyway (live data, read-only); skipping SSR keeps it
  // out of the document and off the hydration path
  { ssr: false },
);

export function QuenoseteolvideShowcaseLazy({
  compact = false,
}: {
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShow(true);
      },
      // start loading a viewport early so it is ready by the time it is read
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show]);

  return (
    <div ref={ref}>
      {show ? (
        <QuenoseteolvideShowcase compact={compact} />
      ) : (
        // matches `.qnst-showcase.is-compact { height: 340px }` in xp.css so
        // revealing the real app doesn't shift the page
        <div
          aria-hidden
          className="h-[340px] w-full animate-pulse bg-muted/40"
        />
      )}
    </div>
  );
}
