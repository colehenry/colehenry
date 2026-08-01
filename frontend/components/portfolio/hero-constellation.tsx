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
const MAX_CONNECTORS = 7;
const GRAVITY_RADIUS = 360;
const MAX_GRAVITY_PULL = 18;
const WARP_RADIUS = 110;
const BLACK_HOLE_RADIUS = 19;

type GalaxyObjectStyle = React.CSSProperties & {
  "--galaxy-shift": string;
  "--galaxy-rotation": string;
  "--galaxy-object-opacity": number;
  "--galaxy-pull-x": string;
  "--galaxy-pull-y": string;
  "--galaxy-pull-turn": string;
  "--galaxy-eclipse-shift": string;
};

function PlaceholderObject({ object }: { object: GalaxyObject }) {
  const style: GalaxyObjectStyle = {
    top: `${object.top}%`,
    "--galaxy-shift": "0px",
    "--galaxy-rotation": `${object.angle}deg`,
    "--galaxy-object-opacity": 1,
    "--galaxy-pull-x": "0px",
    "--galaxy-pull-y": "0px",
    "--galaxy-pull-turn": "0deg",
    "--galaxy-eclipse-shift": "0px",
  };

  return (
    <div
      data-galaxy-object={object.id}
      data-kind={object.kind}
      data-side={object.side}
      className="galaxy-object"
      style={style}
    >
      <span className="galaxy-object-surface" />
    </div>
  );
}

/**
 * Homepage-only paper-galaxy prototype. Geometry lives in a separate data
 * table so Phase 3 can replace the three object surfaces without changing
 * composition, breakpoints, exclusion zones, or scroll behavior.
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
    let scrollFrame = 0;
    let pointerFrame = 0;
    let pointerX = -1;
    let pointerY = -1;

    const setAuthoredPositions = () => {
      objects.forEach((node, index) => {
        const object = GALAXY_OBJECTS[index];
        node.style.setProperty("--galaxy-shift", "0px");
        node.style.setProperty(
          "--galaxy-rotation",
          `${object.angle}deg`,
        );
        node.style.setProperty("--galaxy-object-opacity", "1");
        node.style.setProperty("--galaxy-pull-x", "0px");
        node.style.setProperty("--galaxy-pull-y", "0px");
        node.style.setProperty("--galaxy-pull-turn", "0deg");
        node.style.setProperty("--galaxy-eclipse-shift", "0px");
      });
    };

    const measure = () => {
      const sceneTop = scene.getBoundingClientRect().top + window.scrollY;
      objectTops = new Map(
        objects.map((node) => [node, sceneTop + node.offsetTop]),
      );
      objectCenters = new Map(
        objects.map((node) => [
          node,
          {
            x: node.offsetLeft + node.offsetWidth / 2,
            y: node.offsetTop + node.offsetHeight / 2,
          },
        ]),
      );
    };

    const update = () => {
      scrollFrame = 0;
      if (reducedMotion.matches) {
        setAuthoredPositions();
        return;
      }

      objects.forEach((node, index) => {
        const object = GALAXY_OBJECTS[index];
        const top = objectTops.get(node) ?? 0;
        const progress = galaxyObjectProgress(
          window.scrollY,
          window.innerHeight,
          top,
        );
        const centered = progress - 0.5;
        const opacity = 0.45 + Math.sin(progress * Math.PI) * 0.55;

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
          `${(centered * 18).toFixed(2)}px`,
        );
      });
    };

    const scheduleUpdate = () => {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(update);
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
      warp.style.opacity = "0";
      blackHole.style.opacity = "0";
      blackHole.removeAttribute("data-active");
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

      const sceneRect = scene.getBoundingClientRect();
      const x = pointerX - sceneRect.left;
      const y = pointerY - sceneRect.top;
      const warpLeft = pointerX - WARP_RADIUS;
      const warpTop = pointerY - WARP_RADIUS;

      blackHole.style.transform = `translate3d(${(pointerX - BLACK_HOLE_RADIUS).toFixed(2)}px, ${(pointerY - BLACK_HOLE_RADIUS).toFixed(2)}px, 0)`;
      blackHole.style.opacity = "1";
      blackHole.setAttribute("data-active", "true");
      warp.style.transform = `translate3d(${warpLeft.toFixed(2)}px, ${warpTop.toFixed(2)}px, 0)`;
      warp.style.opacity = "0.58";

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
          `${((dx / GRAVITY_RADIUS) * strength * 3).toFixed(2)}deg`,
        );
      });

      const nearestStars = stars
        .map((star, index) => {
          const starRect = star.getBoundingClientRect();
          const starX = starRect.left + starRect.width / 2 - sceneRect.left;
          const starY = starRect.top + starRect.height / 2 - sceneRect.top;
          return {
            distance: Math.hypot(starX - x, starY - y),
            line: connectors[index],
            starX,
            starY,
          };
        })
        .filter(({ distance }) => distance <= CONNECTOR_RADIUS)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, MAX_CONNECTORS);

      clearConnectors();
      nearestStars.forEach(({ distance, line, starX, starY }) => {
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
      scheduleUpdate();
    };

    measure();
    update();
    syncCursorMode();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", clearPointerEffects);
    reducedMotion.addEventListener("change", scheduleUpdate);
    hoverCapable.addEventListener("change", syncCursorMode);

    return () => {
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
          {GALAXY_STARS.map((star) => (
            <line
              key={star.id}
              data-galaxy-connector={star.id}
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
          <PlaceholderObject key={object.id} object={object} />
        ))}

        <span className="galaxy-mobile-accent" />
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
