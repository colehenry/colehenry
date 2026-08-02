"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  GALAXY_OBJECTS,
  GALAXY_STARS,
  galaxyObjectProgress,
  type GalaxyObject,
} from "@/components/portfolio/galaxy-scene-data";

const CONNECTOR_RADIUS = 240;
const CONNECTOR_RADIUS_SQUARED = CONNECTOR_RADIUS * CONNECTOR_RADIUS;
const MAX_CONNECTORS = 7;
const GRAVITY_RADIUS = 360;
const MAX_GRAVITY_PULL = 14;
const WARP_RADIUS = 110;
const BLACK_HOLE_RADIUS = 19;
const ECLIPSE_START_GAP = 110;
const ECLIPSE_END_GAP = -94;
const ECLIPSE_STATIC_GAP = 8;
const SCROLL_RESPONSE = [0.11, 0.14, 0.09, 0.13] as const;
const SCROLL_SETTLE_EPSILON = 0.0005;
// SCROLL_RESPONSE is authored per 60Hz frame; rescaling by the real frame time
// keeps a 120Hz display from converging twice as fast as a 60Hz one.
const REFERENCE_FRAME_MS = 1000 / 60;
const MAX_FRAME_MS = 50;
// how fast an object slides to a new scene-height anchor, in px per frame terms
const ANCHOR_RESPONSE = 0.16;
const ANCHOR_SETTLE_EPSILON = 0.05;
// objects stay solid through the whole pass; scroll only breathes the last
// sliver of opacity rather than fading them most of the way out
const OBJECT_MIN_OPACITY = 0.82;
const OBJECT_OPACITY_RANGE = 0.18;

type GalaxyObjectStyle = React.CSSProperties & {
  "--galaxy-anchor-y": string;
  "--galaxy-shift": string;
  "--galaxy-rotation": string;
  "--galaxy-object-opacity": number;
  "--galaxy-pull-x": string;
  "--galaxy-pull-y": string;
  "--galaxy-pull-turn": string;
  "--galaxy-eclipse-shift": string;
};

function GalaxyArtwork({ object }: { object: GalaxyObject }) {
  const style: GalaxyObjectStyle = {
    // the vertical anchor is a percentage of the scene, but the scene is as
    // tall as the page - so any late reflow (font swap, hydration, a lazy
    // block) would move it instantly. Driving it through the transform instead
    // of `top` lets the same lerp that handles scroll absorb those changes.
    "--galaxy-anchor-y": "0px",
    "--galaxy-shift": "0px",
    "--galaxy-rotation": `${object.angle}deg`,
    // authored geometry is only correct at scroll progress 0.5, so the first
    // painted frame stays invisible until the effect has measured the scene
    // and written the real scroll-derived transform (see data-galaxy-ready)
    "--galaxy-object-opacity": 0,
    "--galaxy-pull-x": "0px",
    "--galaxy-pull-y": "0px",
    "--galaxy-pull-turn": "0deg",
    "--galaxy-eclipse-shift": `${ECLIPSE_START_GAP}px`,
  };

  return (
    <div
      data-galaxy-object={object.id}
      data-kind={object.kind}
      data-side={object.side}
      className="galaxy-object"
      style={style}
    >
      <span className="galaxy-object-surface">
        {object.id === "bilingual-moon" ? (
          <>
            <span className="galaxy-object-image galaxy-moon-base" />
            <span className="galaxy-object-image galaxy-moon-overlay" />
          </>
        ) : (
          <span
            className={`galaxy-object-image galaxy-${object.id}-sprite`}
          />
        )}
      </span>
    </div>
  );
}

/**
 * Homepage-only 8-bit galaxy. Geometry lives in a separate data table so the
 * final sprites share the approved composition,
 * breakpoints, exclusion zones, and scroll behavior.
 */
export function HeroConstellation() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const warpRef = useRef<HTMLDivElement>(null);
  const blackHoleRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const disabled = pathname !== "/";

  useEffect(() => {
    if (disabled) return;
    const scene = sceneRef.current;
    const warp = warpRef.current;
    const blackHole = blackHoleRef.current;
    if (!scene || !warp || !blackHole) return;

    const objects = Array.from(
      scene.querySelectorAll<HTMLElement>("[data-galaxy-object]"),
    );
    const stars = Array.from(
      scene.querySelectorAll<HTMLElement>("[data-galaxy-star]"),
    );
    const connectors = Array.from(
      scene.querySelectorAll<SVGLineElement>("[data-galaxy-connector]"),
    );
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const hoverCapable = window.matchMedia(
      "(min-width: 1180px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    let objectTops = new Map<HTMLElement, number>();
    let objectCenters = new Map<HTMLElement, { x: number; y: number }>();
    let starCenters: Array<{ x: number; y: number }> = [];
    let sceneDocumentTop = 0;
    let scrollFrame = 0;
    let lastFrameTime = 0;
    let currentProgress = GALAXY_OBJECTS.map(() => 0);
    let targetProgress = GALAXY_OBJECTS.map(() => 0);
    let currentAnchor = GALAXY_OBJECTS.map(() => 0);
    let targetAnchor = GALAXY_OBJECTS.map(() => 0);
    let pointerFrame = 0;
    let pointerX = -1;
    let pointerY = -1;
    let pointerVisible = false;

    const setAuthoredPositions = () => {
      objects.forEach((node, index) => {
        const object = GALAXY_OBJECTS[index];
        node.style.setProperty(
          "--galaxy-anchor-y",
          `${targetAnchor[index].toFixed(2)}px`,
        );
        node.style.setProperty("--galaxy-shift", "0px");
        node.style.setProperty(
          "--galaxy-rotation",
          `${object.angle}deg`,
        );
        node.style.setProperty("--galaxy-object-opacity", "1");
        node.style.setProperty("--galaxy-pull-x", "0px");
        node.style.setProperty("--galaxy-pull-y", "0px");
        node.style.setProperty("--galaxy-pull-turn", "0deg");
        node.style.setProperty(
          "--galaxy-eclipse-shift",
          `${ECLIPSE_STATIC_GAP}px`,
        );
      });
    };

    const measure = () => {
      sceneDocumentTop =
        scene.getBoundingClientRect().top + window.scrollY;
      const sceneHeight = scene.clientHeight;
      targetAnchor = GALAXY_OBJECTS.map(
        (object) => (sceneHeight * object.top) / 100,
      );
      objectTops = new Map(
        objects.map((node, index) => [
          node,
          sceneDocumentTop + targetAnchor[index],
        ]),
      );
      objectCenters = new Map(
        objects.map((node, index) => [
          node,
          {
            x: node.offsetLeft + node.offsetWidth / 2,
            y: targetAnchor[index] + node.offsetHeight / 2,
          },
        ]),
      );
      starCenters = stars.map((star) => ({
        x: star.offsetLeft,
        y: star.offsetTop,
      }));
    };

    const renderObjectProgress = (
      node: HTMLElement,
      index: number,
      progress: number,
    ) => {
      const object = GALAXY_OBJECTS[index];
      const centered = progress - 0.5;
      const opacity =
        OBJECT_MIN_OPACITY +
        Math.sin(progress * Math.PI) * OBJECT_OPACITY_RANGE;

      node.style.setProperty(
        "--galaxy-anchor-y",
        `${currentAnchor[index].toFixed(2)}px`,
      );
      node.style.setProperty(
        "--galaxy-shift",
        `${(centered * object.travel).toFixed(2)}px`,
      );
      node.style.setProperty(
        "--galaxy-rotation",
        `${(object.angle + centered * object.turn).toFixed(2)}deg`,
      );
      node.style.setProperty(
        "--galaxy-object-opacity",
        opacity.toFixed(3),
      );
      node.style.setProperty(
        "--galaxy-eclipse-shift",
        `${(ECLIPSE_END_GAP + (1 - progress) * (ECLIPSE_START_GAP - ECLIPSE_END_GAP)).toFixed(2)}px`,
      );
    };

    const readScrollTargets = () => {
      targetProgress = objects.map((node) => {
        const top = objectTops.get(node) ?? 0;
        return galaxyObjectProgress(
          window.scrollY,
          window.innerHeight,
          top,
        );
      });
    };

    const renderCurrentProgress = () => {
      objects.forEach((node, index) => {
        renderObjectProgress(node, index, currentProgress[index]);
      });
    };

    const animateScrollMotion = (now: number) => {
      scrollFrame = 0;
      if (reducedMotion.matches) {
        setAuthoredPositions();
        return;
      }

      const frameMs = lastFrameTime
        ? Math.min(MAX_FRAME_MS, now - lastFrameTime)
        : REFERENCE_FRAME_MS;
      lastFrameTime = now;

      let stillMoving = false;
      currentProgress = currentProgress.map((progress, index) => {
        const delta = targetProgress[index] - progress;
        if (Math.abs(delta) <= SCROLL_SETTLE_EPSILON) {
          return targetProgress[index];
        }

        stillMoving = true;
        const response =
          1 -
          (1 - SCROLL_RESPONSE[index]) ** (frameMs / REFERENCE_FRAME_MS);
        return progress + delta * response;
      });
      currentAnchor = currentAnchor.map((anchor, index) => {
        const delta = targetAnchor[index] - anchor;
        if (Math.abs(delta) <= ANCHOR_SETTLE_EPSILON) {
          return targetAnchor[index];
        }

        stillMoving = true;
        const response =
          1 - (1 - ANCHOR_RESPONSE) ** (frameMs / REFERENCE_FRAME_MS);
        return anchor + delta * response;
      });
      renderCurrentProgress();

      if (stillMoving) {
        scrollFrame = window.requestAnimationFrame(animateScrollMotion);
      } else {
        lastFrameTime = 0;
      }
    };

    const snapScrollMotion = () => {
      readScrollTargets();
      currentProgress = [...targetProgress];
      currentAnchor = [...targetAnchor];
      renderCurrentProgress();
    };

    const scheduleUpdate = () => {
      readScrollTargets();
      if (!scrollFrame) {
        scrollFrame = window.requestAnimationFrame(animateScrollMotion);
      }
      if (pointerX >= 0 && !pointerFrame) {
        pointerFrame = window.requestAnimationFrame(drawPointerEffects);
      }
    };

    const clearConnectors = () => {
      connectors.forEach((line) => line.setAttribute("opacity", "0"));
    };

    const clearGravity = () => {
      objects.forEach((node) => {
        node.style.setProperty("--galaxy-pull-x", "0px");
        node.style.setProperty("--galaxy-pull-y", "0px");
        node.style.setProperty("--galaxy-pull-turn", "0deg");
      });
    };

    const clearPointerEffects = () => {
      clearConnectors();
      clearGravity();
      if (pointerVisible) {
        warp.style.opacity = "0";
        blackHole.style.opacity = "0";
        blackHole.removeAttribute("data-active");
        pointerVisible = false;
      }
    };

    const syncCursorMode = () => {
      document.documentElement.classList.toggle(
        "galaxy-cursor-active",
        hoverCapable.matches,
      );
      if (!hoverCapable.matches) clearPointerEffects();
    };

    const drawPointerEffects = () => {
      pointerFrame = 0;
      if (!hoverCapable.matches) {
        clearPointerEffects();
        return;
      }

      const x = pointerX;
      const y = pointerY + window.scrollY - sceneDocumentTop;
      const warpLeft = pointerX - WARP_RADIUS;
      const warpTop = pointerY - WARP_RADIUS;

      blackHole.style.transform = `translate3d(${(pointerX - BLACK_HOLE_RADIUS).toFixed(2)}px, ${(pointerY - BLACK_HOLE_RADIUS).toFixed(2)}px, 0)`;
      warp.style.transform = `translate3d(${warpLeft.toFixed(2)}px, ${warpTop.toFixed(2)}px, 0)`;
      if (!pointerVisible) {
        blackHole.style.opacity = "1";
        blackHole.setAttribute("data-active", "true");
        warp.style.opacity = "0.58";
        pointerVisible = true;
      }

      objects.forEach((node) => {
        const center = objectCenters.get(node);
        if (!center) return;
        const dx = x - center.x;
        const dy = y - center.y;
        const distance = Math.hypot(dx, dy);
        const strength = Math.max(0, 1 - distance / GRAVITY_RADIUS) ** 2;
        const scale = distance > 0 ? (MAX_GRAVITY_PULL * strength) / distance : 0;

        node.style.setProperty(
          "--galaxy-pull-x",
          `${(dx * scale).toFixed(2)}px`,
        );
        node.style.setProperty(
          "--galaxy-pull-y",
          `${(dy * scale).toFixed(2)}px`,
        );
        node.style.setProperty(
          "--galaxy-pull-turn",
          `${((dx / GRAVITY_RADIUS) * strength * 1.5).toFixed(2)}deg`,
        );
      });

      const nearestStars = starCenters
        .map(({ x: starX, y: starY }) => {
          const dx = starX - x;
          const dy = starY - y;
          return {
            distanceSquared: dx * dx + dy * dy,
            starX,
            starY,
          };
        })
        .filter(
          ({ distanceSquared }) =>
            distanceSquared <= CONNECTOR_RADIUS_SQUARED,
        )
        .sort((a, b) => a.distanceSquared - b.distanceSquared)
        .slice(0, MAX_CONNECTORS);

      clearConnectors();
      nearestStars.forEach(({ distanceSquared, starX, starY }, index) => {
        const line = connectors[index];
        const distance = Math.sqrt(distanceSquared);
        line.setAttribute("x1", starX.toFixed(2));
        line.setAttribute("y1", starY.toFixed(2));
        line.setAttribute("x2", x.toFixed(2));
        line.setAttribute("y2", y.toFixed(2));
        line.setAttribute(
          "opacity",
          ((1 - distance / CONNECTOR_RADIUS) * 0.36).toFixed(3),
        );
      });
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (pointerFrame) return;
      pointerFrame = window.requestAnimationFrame(drawPointerEffects);
    };

    const onResize = () => {
      measure();
      clearPointerEffects();
      snapScrollMotion();
    };

    /**
     * Late layout changes - the font swap, the lazy showcases mounting, images
     * landing - move both the scene height the objects are anchored to and the
     * document offsets the scroll ranges are derived from. Re-measuring and
     * letting the lerp catch up keeps that from reading as a second jump the
     * way a snap would.
     */
    let disposed = false;
    let confirmFrame = 0;
    let settledHeight = -1;
    const remeasureAndGlide = () => {
      if (disposed) return;

      // A lazily mounted block is briefly on the page before its own stylesheet
      // arrives, so the height can spike for a single frame. Gliding to that
      // would drag every object out and back, which is worse than the snap this
      // lerp exists to remove - so only retarget once two frames agree.
      const height = scene.clientHeight;
      if (height !== settledHeight) {
        settledHeight = height;
        window.cancelAnimationFrame(confirmFrame);
        confirmFrame = window.requestAnimationFrame(remeasureAndGlide);
        return;
      }

      confirmFrame = 0;
      measure();
      readScrollTargets();
      if (!scrollFrame) {
        scrollFrame = window.requestAnimationFrame(animateScrollMotion);
      }
    };

    const sceneResize = new ResizeObserver(remeasureAndGlide);

    /**
     * The web fonts swapping in resizes the page, which moves every anchor.
     * Waiting for them means that reflow - the last big one on a cold load -
     * happens while the scene is still transparent, so it costs nothing. A
     * warm cache resolves this on the next microtask.
     */
    const revealScene = () => {
      if (disposed) return;
      measure();
      snapScrollMotion();
      scene.dataset.galaxyReady = "true";
    };

    measure();
    snapScrollMotion();
    syncCursorMode();
    sceneResize.observe(scene);
    if (document.fonts) {
      document.fonts.ready.then(revealScene);
    } else {
      revealScene();
    }
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", clearPointerEffects);
    reducedMotion.addEventListener("change", scheduleUpdate);
    hoverCapable.addEventListener("change", syncCursorMode);

    return () => {
      disposed = true;
      sceneResize.disconnect();
      window.cancelAnimationFrame(confirmFrame);
      window.cancelAnimationFrame(scrollFrame);
      window.cancelAnimationFrame(pointerFrame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", clearPointerEffects);
      reducedMotion.removeEventListener("change", scheduleUpdate);
      hoverCapable.removeEventListener("change", syncCursorMode);
      document.documentElement.classList.remove("galaxy-cursor-active");
    };
  }, [disabled]);

  if (disabled) return null;

  return (
    <>
      <div ref={sceneRef} className="galaxy-scene" aria-hidden="true">
        <div className="galaxy-grid" />

        <svg className="galaxy-connectors">
          {Array.from({ length: MAX_CONNECTORS }, (_, index) => (
            <line
              key={index}
              data-galaxy-connector={index}
              opacity="0"
            />
          ))}
        </svg>

        <div className="galaxy-stars">
          {GALAXY_STARS.map((star) => (
            <span
              key={star.id}
              className="galaxy-star"
              data-galaxy-star={star.id}
              data-size={star.size}
              data-tone={star.tone}
              data-zone={
                star.x <= 4.5 || star.x >= 95.5 ? "gutter" : "field"
              }
              style={{ left: `${star.x}%`, top: `${star.y}%` }}
            />
          ))}
        </div>

        {GALAXY_OBJECTS.map((object) => (
          <GalaxyArtwork key={object.id} object={object} />
        ))}

      </div>
      <div ref={warpRef} className="galaxy-warp" aria-hidden="true" />
      <div
        ref={blackHoleRef}
        className="galaxy-black-hole"
        aria-hidden="true"
      >
        <span className="galaxy-black-hole-core" />
        <span className="galaxy-black-hole-particle" />
        <span className="galaxy-black-hole-particle" />
        <span className="galaxy-black-hole-particle" />
        <span className="galaxy-black-hole-particle" />
        <span className="galaxy-black-hole-particle" />
        <span className="galaxy-black-hole-particle" />
      </div>
    </>
  );
}
