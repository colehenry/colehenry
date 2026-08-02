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
    <div ref={ref}>
      {show ? (
        <BrainShowcase compact />
      ) : (
        <div aria-hidden className="h-[340px] w-full animate-pulse bg-muted/40" />
      )}
    </div>
  );
}
