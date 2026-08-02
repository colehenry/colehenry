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
      ["brain-galaxy", "right"],
      ["bilingual-moon", "left"],
    ],
  );
  assert.ok(GALAXY_OBJECTS.every(({ travel }) => travel >= 40 && travel <= 90));
  const asteroid = GALAXY_OBJECTS.find(({ id }) => id === "asteroid");
  assert.ok(asteroid && asteroid.travel >= 80 && asteroid.turn <= 140);
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
  assert.match(component, /CONNECTOR_RADIUS_SQUARED/);
  assert.match(component, /GRAVITY_RADIUS = 360/);
  assert.match(component, /MAX_GRAVITY_PULL = 14/);
  assert.match(component, /galaxy-black-hole/);
  assert.match(component, /galaxy-warp/);
  assert.match(component, /slice\(0, MAX_CONNECTORS\)/);
  assert.match(component, /starCenters = stars\.map/);
  assert.match(component, /Array\.from\(\{ length: MAX_CONNECTORS \}/);
  assert.doesNotMatch(component, /galaxy-orbits|GALAXY_ORBITS/);
  assert.match(component, /--galaxy-shift/);
  assert.match(component, /--galaxy-object-opacity/);
  assert.match(component, /--galaxy-eclipse-shift/);
});

test("scroll gives objects controlled rotation and moves the layered eclipse", () => {
  assert.ok(
    GALAXY_OBJECTS.every(
      ({ turn }) => Math.abs(turn) >= 20 && Math.abs(turn) <= 140,
    ),
  );
  assert.match(component, /SCROLL_RESPONSE = \[0\.11, 0\.14, 0\.09, 0\.13\]/);
  assert.match(component, /SCROLL_SETTLE_EPSILON = 0\.0005/);
  // the per-frame response is rescaled by real frame time so 120Hz displays
  // converge at the same rate as 60Hz ones
  assert.match(component, /progress \+ delta \* response/);
  assert.match(component, /\(1 - SCROLL_RESPONSE\[index\]\) \*\* \(frameMs \/ REFERENCE_FRAME_MS\)/);
  assert.match(component, /requestAnimationFrame\(animateScrollMotion\)/);
  assert.doesNotMatch(styles, /transform 160ms cubic-bezier/);
  assert.match(styles, /translateX\(var\(--galaxy-eclipse-shift\)\)/);
  assert.match(styles, /animation-play-state: paused/);
  assert.match(styles, /black-hole-accretion/);
  assert.match(styles, /black-hole-infall/);
  assert.match(styles, /rotateX\(66deg\)/);
  assert.doesNotMatch(component, /function step|const step/);
});

test("final pixel assets replace the CSS placeholder surfaces", () => {
  assert.match(styles, /pixel-asteroid\.png/);
  assert.match(styles, /pixel-lapwise-planet\.png/);
  assert.match(styles, /pixel-brain-galaxy\.png/);
  assert.match(styles, /pixel-bilingual-moon-base\.png/);
  assert.match(styles, /pixel-bilingual-moon-overlay\.png/);
  assert.match(component, /galaxy-moon-base/);
  assert.match(component, /galaxy-moon-overlay/);
  assert.doesNotMatch(component, /PlaceholderObject/);
  assert.match(styles, /image-rendering: pixelated/);

  const objectStyles = styles.slice(
    styles.indexOf(".galaxy-object-surface"),
    styles.indexOf(".galaxy-warp"),
  );
  assert.doesNotMatch(objectStyles, /clip-path|radial-gradient|double/);
});

test("eclipse discs cross each other as scroll progress increases", () => {
  assert.match(component, /ECLIPSE_START_GAP = 110/);
  assert.match(component, /ECLIPSE_END_GAP = -94/);
  assert.match(component, /ECLIPSE_STATIC_GAP = 8/);
  assert.match(component, /\(1 - progress\)/);
});

test("sprite assets stay visible on laptops and are omitted on phones", () => {
  assert.doesNotMatch(component, /galaxy-mobile-accent/);
  assert.match(styles, /@media \(min-width: 768px\)[\s\S]*pixel-asteroid\.png/);
  assert.match(styles, /@media \(min-width: 768px\) and \(max-width: 1179px\)[\s\S]*?left: -2\.75rem/);
  assert.match(styles, /@media \(max-width: 767px\)[\s\S]*?\.galaxy-object,[\s\S]*?display: none/);
});

test("cursor warp avoids expensive duplicated paint and backdrop filters", () => {
  const warpStyles = styles.slice(
    styles.indexOf(".galaxy-warp"),
    styles.indexOf(".galaxy-black-hole"),
  );
  assert.doesNotMatch(
    warpStyles,
    /background-size: 48px|--warp-grid|backdrop-filter/,
  );
});

test("pointer hot path uses cached star geometry", () => {
  const pointerPath = component.slice(
    component.indexOf("const drawPointerEffects"),
    component.indexOf("const onPointerMove"),
  );
  assert.doesNotMatch(pointerPath, /getBoundingClientRect|offsetLeft|offsetTop/);
  assert.match(pointerPath, /starCenters/);
  assert.match(component, /x: star\.offsetLeft,\s*y: star\.offsetTop/);
  assert.doesNotMatch(component, /star\.offsetLeft \+ star\.offsetWidth/);
});

test("black-hole cursor keeps a neutral core and draws its energy from the brand blue", () => {
  const cursorStyles = styles.slice(
    styles.indexOf(".galaxy-black-hole"),
    styles.indexOf("@media\n    (min-width: 1180px)"),
  );
  // the accretion disk, glow, and infalling particles follow --accent so the
  // cursor tracks the Carolina palette in both themes
  assert.match(cursorStyles, /hsl\(var\(--accent\)/);
  assert.doesNotMatch(cursorStyles, /hsl\(24 98% 54%|hsl\(32 100% 68%/);
  // the singularity itself stays black - that is the whole point
  assert.match(cursorStyles, /hsl\(0 0% 3%\)/);
  // gravitational lensing ring: an annulus that bends the page behind it
  assert.match(cursorStyles, /\.galaxy-black-hole::after/);
  assert.match(cursorStyles, /backdrop-filter: blur\(2px\)/);
});

test("navigation dropdown restores a visible native cursor", () => {
  assert.match(
    styles,
    /html\.galaxy-cursor-active \[data-slot="dropdown-menu-content"\][\s\S]*?cursor: default !important/,
  );
});

test("responsive and reduced-motion layouts are deliberate", () => {
  assert.match(styles, /@media \(min-width: 768px\) and \(max-width: 1179px\)[\s\S]*?\.galaxy-object\[data-side="right"\]/);
  assert.match(styles, /@media \(max-width: 767px\)[\s\S]*?\.galaxy-object,[\s\S]*?display: none/);
  assert.match(styles, /@media \(max-width: 767px\)[\s\S]*?\.galaxy-grid,[\s\S]*?display: none/);
  assert.doesNotMatch(component, /galaxy-mobile-accent/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.galaxy-object/);
  assert.match(component, /setAuthoredPositions/);
  assert.match(component, /reducedMotion\.matches/);
});
