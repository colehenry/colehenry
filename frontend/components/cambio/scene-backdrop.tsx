"use client";

import type { Scene } from "./scenes";

/** Generated scene art is the sole base layer. The remaining elements are
 * lightweight foreground ambience, never fallback artwork behind the image. */
export function SceneBackdrop({ scene }: { scene: Scene }) {
  return (
    <div className={`cb-backdrop cb-scene-${scene}`} aria-hidden>
      {scene === "seaside" && (
        <>
          <div className="cb-seaside-photo" />
          <div className="cb-seaside-shimmer" />
        </>
      )}
      {scene === "cafe" && (
        <>
          <div className="cb-cafe-photo" />
          <div className="cb-cafe-glow" />
          <div className="cb-cafe-steam" />
        </>
      )}
      {scene === "tavern" && (
        <>
          <div className="cb-tavern-photo" />
          <div className="cb-tavern-firelight" />
        </>
      )}
    </div>
  );
}
