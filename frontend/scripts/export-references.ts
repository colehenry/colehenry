/**
 * Dump the static reference sheets to backend/app/curriculum/references.json so
 * the tutor can search, read, and validate `sheet#section` links server-side.
 * Run after editing lib/french/references.ts:  npm run export:references
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REFERENCE_SHEETS } from "../lib/french/references";

const out = resolve(__dirname, "../../backend/app/curriculum/references.json");
const sheets = REFERENCE_SHEETS.map((s) => ({
  id: s.id,
  title: s.title,
  blurb: s.blurb,
  dynamic: s.dynamic ?? null,
  sections: s.sections.map((sec) => ({
    id: sec.id,
    title: sec.title,
    note: sec.note ?? "",
    columns: sec.columns ?? [],
    speak: sec.speak ?? null,
    rows: sec.rows,
  })),
}));
writeFileSync(out, JSON.stringify(sheets, null, 1) + "\n");
console.log(`wrote ${sheets.length} sheets, ${sheets.reduce((n, s) => n + s.sections.length, 0)} sections → ${out}`);
