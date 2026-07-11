"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** twinkle phase */
  t: number;
};

/** height of the sticky header (h-14 = 3.5rem) the canvas tucks under */
const HEADER_OFFSET = 56;
/** grid cell size (px) — small, like a sheet of graph paper */
const CELL = 24;
/** sample step along bent lines (px) — smaller = smoother curves */
const STEP = 14;
/** diameter of the soft cursor glow that floats above the content */
const GLOW_SIZE = 480;
/** gravity well radius (px) and max pull (px) — wide and gentle */
const WELL_R = 420;
const WELL_PULL = 50;
/** spring that drags the well after the cursor — stiff and heavily damped so
    it snaps hard onto the cursor with barely one overshoot: intense gravity */
const STIFF = 0.22;
const DAMP = 0.62;
/** grid scrolls 1:1 with the page (attached); stars lag behind for depth */
const GRID_PARALLAX = 1;
const STAR_PARALLAX = 0.4;
/** base grid line opacity (old blueprint grid was 0.04) */
const GRID_ALPHA = 0.1;
/** cursor→star link reach (px) */
const MOUSE_DIST = 190;

/**
 * Full-page "spacetime" background. A square grid mesh is bent by a gravity
 * well that springs after the cursor — lines pinch toward the mouse like a
 * mass on a rubber sheet and bounce straight again when it leaves. Drifting,
 * twinkling stars ride on top (pulled by the well too) and link to the cursor.
 * Fixed behind the page content (below the header, above the opaque footer),
 * parallax-scrolls with the page, samples theme HSL tokens for light/dark,
 * and renders statically under reduced-motion.
 */
export function HeroConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // catan has its own hex-board backdrop — no spacetime there
  const disabled = pathname.startsWith("/catan");
  // the carolina cursor glow is a home-page-only flourish
  const showGlow = pathname === "/";

  useEffect(() => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const glow = glowRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Sample theme tokens (HSL triplets like "205 51% 66%") for light/dark.
    let fgHsl = "215 25% 12%";
    let bgHsl = "210 20% 99%";
    let carolinaHsl = "205 51% 66%";
    const sampleColors = () => {
      const s = getComputedStyle(document.documentElement);
      fgHsl = s.getPropertyValue("--fg").trim() || fgHsl;
      bgHsl = s.getPropertyValue("--bg").trim() || bgHsl;
      carolinaHsl = s.getPropertyValue("--carolina").trim() || carolinaHsl;
    };
    sampleColors();

    let width = 0;
    let height = 0;
    let rectLeft = 0;
    let rectTop = HEADER_OFFSET;
    let stars: Star[] = [];

    const mouse = { x: -9999, y: -9999, active: false };
    // the well springs after the cursor; power eases 0→1 on enter/leave
    let wx = 0;
    let wy = 0;
    let wvx = 0;
    let wvy = 0;
    let power = 0;

    // gravity-well displacement: pulls a point toward the well, zero at the
    // well's center (no singularity) and fading smoothly past WELL_R
    let warpX = 0;
    let warpY = 0;
    const warp = (x: number, y: number) => {
      warpX = x;
      warpY = y;
      if (power < 0.01) return;
      const dx = wx - x;
      const dy = wy - y;
      if (dx > WELL_R || dx < -WELL_R || dy > WELL_R || dy < -WELL_R) return;
      const r = Math.hypot(dx, dy);
      if (r < 0.0001 || r > WELL_R) return;
      const n = r / WELL_R;
      // smooth radial bump: zero displacement AND zero slope at the edge, so
      // the warp melts into the flat grid with no visible boundary
      const e = 1 - n * n;
      const g = ((WELL_PULL * power * 3.5 * n * e * e) / r);
      warpX = x + dx * g;
      warpY = y + dy * g;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      rectLeft = rect.left;
      rectTop = rect.top;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(90, Math.floor((width * height) / 14000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: Math.random() * 1.3 + 0.6,
        t: Math.random() * Math.PI * 2,
      }));
    };

    // one grid line: straight cheap stroke when outside the well's reach,
    // sampled + warped polyline when it passes near the well
    const gridLine = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      nearWell: boolean,
    ) => {
      ctx.beginPath();
      if (!nearWell) {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      } else {
        const len = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.ceil(len / STEP);
        warp(x0, y0);
        ctx.moveTo(warpX, warpY);
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          warp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
          ctx.lineTo(warpX, warpY);
        }
      }
      ctx.stroke();
    };

    const drawGrid = () => {
      const active = power >= 0.01;
      const scroll = window.scrollY * GRID_PARALLAX;
      const offY = CELL - (scroll % CELL);

      ctx.lineWidth = 1;
      ctx.strokeStyle = `hsl(${fgHsl} / ${GRID_ALPHA})`;

      // vertical lines
      for (let x = 0; x <= width + CELL; x += CELL) {
        const near = active && Math.abs(x - wx) < WELL_R + WELL_PULL;
        gridLine(x, -CELL, x, height + CELL, near);
      }
      // horizontal lines, shifted by parallax scroll
      for (let y = offY - CELL * 2; y <= height + CELL; y += CELL) {
        const near = active && Math.abs(y - wy) < WELL_R + WELL_PULL;
        gridLine(-CELL, y, width + CELL, y, near);
      }

      // soft-fade the grid toward the cursor: warped lines dissolve and blur
      // into the background instead of glowing, so focus stays readable
      if (active) {
        const fade = ctx.createRadialGradient(wx, wy, 0, wx, wy, WELL_R);
        fade.addColorStop(0, `hsl(${bgHsl} / ${0.6 * power})`);
        fade.addColorStop(0.6, `hsl(${bgHsl} / ${0.25 * power})`);
        fade.addColorStop(1, `hsl(${bgHsl} / 0)`);
        ctx.fillStyle = fade;
        ctx.fillRect(wx - WELL_R, wy - WELL_R, WELL_R * 2, WELL_R * 2);
      }
    };

    const drawStars = () => {
      const scroll = window.scrollY * STAR_PARALLAX;
      ctx.lineWidth = 1;
      for (const a of stars) {
        // parallax scroll (wrapped), then pulled by the well like the grid
        const fy = ((((a.y - scroll) % height) + height) % height);
        warp(a.x, fy);
        const px = warpX;
        const py = warpY;

        if (mouse.active) {
          const dist = Math.hypot(px - mouse.x, py - mouse.y);
          if (dist < MOUSE_DIST) {
            const alpha = (1 - dist / MOUSE_DIST) * 0.6;
            ctx.strokeStyle = `hsl(${carolinaHsl} / ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }

        const twinkle = reduced ? 0.7 : 0.55 + Math.sin(a.t) * 0.3;
        ctx.fillStyle = `hsl(${fgHsl} / ${twinkle})`;
        ctx.beginPath();
        ctx.arc(px, py, a.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      drawGrid();
      drawStars();
    };

    let raf = 0;
    const step = () => {
      // spring the well after the cursor; ease its power in/out
      if (mouse.active) {
        wvx = (wvx + (mouse.x - wx) * STIFF) * DAMP;
        wvy = (wvy + (mouse.y - wy) * STIFF) * DAMP;
        wx += wvx;
        wy += wvy;
        power += (1 - power) * 0.2; // gravity engages fast
      } else {
        power += (0 - power) * 0.06;
      }

      for (const a of stars) {
        a.x += a.vx;
        a.y += a.vy;
        a.t += 0.02;
        if (a.x < 0) a.x = width;
        else if (a.x > width) a.x = 0;
        if (a.y < 0) a.y = height;
        else if (a.y > height) a.y = 0;
      }
      draw();

      // the glow floats above the content, riding the same springy well, so
      // the cursor never feels dead over opaque cards
      if (glow) {
        const gx = wx - GLOW_SIZE / 2;
        const gy = wy + rectTop - GLOW_SIZE / 2;
        glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
        glow.style.opacity = String(power);
      }
      raf = requestAnimationFrame(step);
    };

    const onMove = (e: MouseEvent) => {
      // cached rect — no layout work on the hot path
      const x = e.clientX - rectLeft;
      const y = e.clientY - rectTop;
      const inside = y >= 0 && y <= height && x >= 0 && x <= width;
      if (inside && !mouse.active) {
        // well appears where the cursor enters instead of flying across
        wx = x;
        wy = y;
        wvx = 0;
        wvy = 0;
      }
      mouse.x = x;
      mouse.y = y;
      mouse.active = inside;
    };
    const onLeave = () => {
      mouse.active = false;
    };
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!reduced && !raf) {
        raf = requestAnimationFrame(step);
      }
    };
    // reduced-motion: no loop, but still track scroll for the parallax
    let staticRaf = 0;
    const onScrollStatic = () => {
      if (staticRaf) return;
      staticRaf = requestAnimationFrame(() => {
        staticRaf = 0;
        draw();
      });
    };

    const themeObserver = new MutationObserver(() => {
      sampleColors();
      if (reduced) draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);

    if (reduced) {
      draw();
      window.addEventListener("scroll", onScrollStatic, { passive: true });
    } else {
      raf = requestAnimationFrame(step);
    }

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(staticRaf);
      themeObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("scroll", onScrollStatic);
    };
  }, [disabled, showGlow]);

  if (disabled) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        // canvas is a replaced element: `inset` doesn't stretch it, so width
        // and height must be explicit or it collapses to its 300×150 intrinsic
        className="pointer-events-none fixed left-0 z-0"
        style={{
          top: HEADER_OFFSET,
          width: "100vw",
          height: `calc(100vh - ${HEADER_OFFSET}px)`,
        }}
      />
      {/* soft cursor glow above the content (below the z-50 header) so the
          well stays visible even over opaque cards — home page only */}
      {showGlow && (
        <div
          ref={glowRef}
          aria-hidden
          className="pointer-events-none fixed top-0 left-0 z-40 rounded-full opacity-0"
          style={{
            width: GLOW_SIZE,
            height: GLOW_SIZE,
            background:
              "radial-gradient(circle closest-side, hsl(var(--carolina) / 0.06), transparent 70%)",
            willChange: "transform, opacity",
          }}
        />
      )}
    </>
  );
}
