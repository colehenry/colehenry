import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const homepage = readSource("app/page.tsx");
const layout = readSource("app/layout.tsx");
const resume = readSource("lib/resume.ts");
const header = readSource("components/shell/header.tsx");
const styles = readSource("app/globals.css");

test("homepage identifies the AI software engineer role in both locales", () => {
  assert.match(resume, /en: "AI software engineer/);
  assert.match(resume, /es: "Ingeniero de software de IA/);
});

test("projects expose status, engineering proof, and visible destinations", () => {
  assert.match(homepage, /Formula 1 Analytics Platform/);
  assert.match(homepage, /76 seasons of race and telemetry data/);
  assert.match(homepage, /Visit lapwise\.dev/);
  assert.match(homepage, /href="https:\/\/lapwise\.dev"/);

  assert.match(homepage, /Chatbot w\/ Personalized Context/);
  assert.match(homepage, /all of my personal context/);
  assert.match(homepage, /href="\/brain\/examples"/);
  assert.match(homepage, /"Obsidian"/);

  assert.match(homepage, /French Through Spanish Learning App/);
  assert.match(homepage, /read-only React preview uses live FastAPI data/);
  assert.match(homepage, /Explore the live app \(read-only\)/);
  assert.doesNotMatch(homepage, /->/);
});

test("current role includes Airflow in its technology tags", () => {
  const currentRole = resume.slice(
    resume.indexOf('en: "AI Software Engineer"'),
    resume.indexOf('en: "Analytics Engineer"'),
  );
  assert.match(currentRole, /"Airflow"/);
});

test("default and social metadata are recruiter-specific", () => {
  assert.match(layout, /default: "Cole Henry \| AI SWE"/);
  assert.match(layout, /production AI agents, RAG systems, and data tools/);
  assert.match(layout, /openGraph: \{/);
  assert.match(layout, /twitter: \{/);
  assert.match(layout, /card: "summary"/);
});

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory()) return sourceFiles(new URL(`${entry.name}/`, directory));
    return /\.(?:css|mjs|ts|tsx)$/.test(entry.name) ? [url] : [];
  });
}

test("frontend source contains no em dashes", () => {
  const emDash = String.fromCodePoint(0x2014);
  const roots = ["app/", "components/", "lib/", "tests/"].map(
    (path) => new URL(`../${path}`, import.meta.url),
  );
  const files = roots.flatMap(sourceFiles);
  files.push(new URL("../proxy.ts", import.meta.url));

  for (const file of files) {
    assert.equal(readFileSync(file, "utf8").includes(emDash), false, file.pathname);
  }
});

test("public homepage header defers login and prominent search", () => {
  assert.match(header, /const isHome = pathname === "\/"/);
  assert.match(header, /isHome \? "hidden" : "hidden sm:flex"/);
  assert.match(header, /\) : !isHome \? \(/);
  assert.match(header, /me \? \(/);
});

function hslToRgb([h, s, l]) {
  s /= 100;
  l /= 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - chroma / 2;
  const [r, g, b] =
    h < 60
      ? [chroma, x, 0]
      : h < 120
        ? [x, chroma, 0]
        : h < 180
          ? [0, chroma, x]
          : h < 240
            ? [0, x, chroma]
            : h < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];
  return [r + m, g + m, b + m];
}

function luminance(hsl) {
  return hslToRgb(hsl)
    .map((value) =>
      value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
      0,
    );
}

function contrast(a, b) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function rootHsl(variable) {
  const root = styles.match(/:root \{([\s\S]*?)\n\}/)?.[1] ?? "";
  const match = root.match(
    new RegExp(`--${variable}:\\s*(\\d+)\\s+(\\d+)%\\s+(\\d+)%`),
  );
  assert.ok(match, `missing --${variable}`);
  return match.slice(1).map(Number);
}

test("light-mode display and functional blues meet contrast targets", () => {
  const background = luminance(rootHsl("bg"));
  const white = 1;
  const displayBlue = luminance(rootHsl("carolina"));
  const functionalBlue = luminance(rootHsl("accent"));

  assert.ok(contrast(displayBlue, background) >= 3);
  assert.ok(contrast(functionalBlue, background) >= 4.5);
  assert.ok(contrast(functionalBlue, white) >= 4.5);
});
