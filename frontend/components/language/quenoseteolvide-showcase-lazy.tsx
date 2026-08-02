"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

/**
 * Defers the showcase - the real LanguageApp, which fires live study/deck
 * queries the moment it mounts - until it is nearly on screen. On the home
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
    // Matches `.qnst-showcase.is-compact { height: 340px }` in xp.css. The
    // height is pinned on the wrapper rather than only on the placeholder
    // because xp.css ships inside the dynamic chunk: for a frame the real app
    // is mounted but unstyled, and an unpinned wrapper would take its natural
    // height, spiking the page and dragging the galaxy scene on first scroll.
    <div ref={ref} className="h-[340px] overflow-hidden">
      {show ? (
        <QuenoseteolvideShowcase compact={compact} />
      ) : (
        <div aria-hidden className="h-full w-full animate-pulse bg-muted/40" />
      )}
    </div>
  );
}
