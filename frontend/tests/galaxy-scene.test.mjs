import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GALAXY_OBJECTS,
  GALAXY_STARS,
  galaxyObjectProgress,
} from "../components/portfolio/galaxy-scene-data.ts";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const component = readSource("components/portfolio/hero-constellation.tsx");
const styles = readSource("app/globals.css");

test("galaxy composition keeps bright stars in gutters and center stars quiet", () => {
  assert.equal(GALAXY_STARS.length, 80);
  assert.equal(new Set(GALAXY_STARS.map((star) => star.id)).size, 80);
  const fieldStars = GALAXY_STARS.filter(
    (star) => star.x > 4.5 && star.x < 95.5,
  );
  assert.equal(fieldStars.length, 54);
  assert.ok(
    GALAXY_STARS.filter((star) => star.tone === "bright").every(
      (star) => star.x <= 4.5 || star.x >= 95.5,
    ),
  );
  assert.ok(GALAXY_STARS.every((star) => star.y <= 66));

  assert.deepEqual(
    GALAXY_OBJECTS.map(({ id, side }) => [id, side]),
    [
      ["asteroid", "right"],
      ["lapwise-planet", "left"],
      ["bilingual-moon", "right"],
    ],
  );
  assert.ok(
    GALAXY_OBJECTS.every(
      ({ travel }) => travel >= 30 && travel <= 60,
    ),
  );
});

test("scroll progress is clamped and centered on an object's active range", () => {
  const viewportHeight = 1000;
  const objectTop = 2000;

  assert.equal(galaxyObjectProgress(0, viewportHeight, objectTop), 0);
  assert.equal(galaxyObjectProgress(2500, viewportHeight, objectTop), 1);
  assert.ok(
    galaxyObjectProgress(1800, viewportHeight, objectTop) >
      galaxyObjectProgress(1600, viewportHeight, objectTop),
  );
});

test("scene removes random animation but connects nearby field stars", () => {
  assert.doesNotMatch(component, /Math\.random/);
  assert.doesNotMatch(component, /canvas|getContext/);
  assert.doesNotMatch(component, /glow|twinkle/i);
  assert.match(component, /addEventListener\("scroll", scheduleUpdate/);
  assert.match(component, /addEventListener\("pointermove", onPointerMove/);
  assert.doesNotMatch(component, /inSafeGutter|CONTENT_RAIL_WIDTH/);
  assert.match(component, /CONNECTOR_RADIUS = 240/);
  assert.match(component, /MAX_CONNECTORS = 7/);
  assert.match(component, /GRAVITY_RADIUS = 360/);
  assert.match(component, /MAX_GRAVITY_PULL = 18/);
  assert.match(component, /galaxy-black-hole/);
  assert.match(component, /galaxy-warp/);
  assert.match(component, /slice\(0, MAX_CONNECTORS\)/);
  assert.doesNotMatch(component, /galaxy-orbits|GALAXY_ORBITS/);
  assert.match(component, /--galaxy-shift/);
  assert.match(component, /--galaxy-object-opacity/);
  assert.match(component, /--galaxy-eclipse-shift/);
});

test("scroll spins objects and moves the layered eclipse without idle animation", () => {
  assert.ok(GALAXY_OBJECTS.every(({ turn }) => Math.abs(turn) >= 20));
  assert.match(styles, /translateX\(var\(--galaxy-eclipse-shift\)\)/);
  assert.match(styles, /animation-play-state: paused/);
  assert.match(styles, /black-hole-accretion/);
  assert.match(styles, /black-hole-infall/);
  assert.match(styles, /rotateX\(66deg\)/);
  assert.doesNotMatch(component, /function step|const step/);
});

test("cursor warp does not redraw a second grid", () => {
  const warpStyles = styles.slice(
    styles.indexOf(".galaxy-warp"),
    styles.indexOf(".galaxy-black-hole"),
  );
  assert.doesNotMatch(warpStyles, /background-size: 48px|--warp-grid/);
  assert.match(warpStyles, /backdrop-filter: blur\(0\.7px\)/);
});

test("black-hole cursor uses a neutral core and orange energy only", () => {
  const cursorStyles = styles.slice(
    styles.indexOf(".galaxy-black-hole"),
    styles.indexOf("@media\n    (min-width: 1180px)"),
  );
  assert.doesNotMatch(cursorStyles, /--carolina|--accent|hsl\(21[0-9]/);
  assert.match(cursorStyles, /hsl\(24 98% 54%/);
  assert.match(cursorStyles, /hsl\(0 0% 3%\)/);
  assert.doesNotMatch(cursorStyles, /\.galaxy-black-hole::after/);
});

test("responsive and reduced-motion layouts are deliberate", () => {
  assert.match(styles, /@media \(max-width: 1179px\)[\s\S]*?\.galaxy-object,[\s\S]*?display: none/);
  assert.match(styles, /@media \(max-width: 767px\)[\s\S]*?\.galaxy-mobile-accent/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.galaxy-object/);
  assert.match(component, /setAuthoredPositions/);
  assert.match(component, /reducedMotion\.matches/);
});
