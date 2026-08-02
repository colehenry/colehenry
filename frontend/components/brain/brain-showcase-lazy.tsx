"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const BrainShowcase = dynamic(
  () => import("./brain-showcase").then((module) => module.BrainShowcase),
  { ssr: false },
);

export function BrainShowcaseLazy() {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return;
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setShow(true);
      },
      { rootMargin: "400px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [show]);

  return (
    // The height is pinned on the wrapper, not just the placeholder: brain.css
    // ships inside the dynamic chunk, so there is a frame where the real
    // showcase is mounted but unstyled and therefore its natural height. Left
    // unpinned that spikes the page height, which drags the whole galaxy scene
    // (stars included) up and back down on the first scroll.
    <div ref={ref} className="h-[340px] overflow-hidden">
      {show ? (
        <BrainShowcase compact />
      ) : (
        <div aria-hidden className="h-full w-full animate-pulse bg-muted/40" />
      )}
    </div>
  );
}
