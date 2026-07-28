import {
  GROCERIES,
  INBOX,
  ROUTINE,
  TAGS,
  TASKS,
  TODAY,
  WAITING,
  WEEK,
  eventsFor,
} from "../data";

/** The four tabs. "Open loops" absorbs waiting, later and undated — all three
 *  are things without a home today, and none of them justified a tab alone. */
export type Tab = "today" | "calendar" | "kitchen" | "loops";

export const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "calendar", label: "Calendar" },
  { id: "kitchen", label: "Kitchen" },
  { id: "loops", label: "Open loops" },
];

export function counts(got: Record<string, boolean>) {
  const todayDue = TASKS.filter((t) => t.dueOn && t.dueOn <= TODAY);
  const later = TASKS.filter((t) => t.dueOn && t.dueOn > TODAY);
  const toBuy = GROCERIES.filter((g) => !got[g.id]);
  return {
    todayDue,
    later,
    toBuy,
    today: ROUTINE.length + todayDue.length + eventsFor(TODAY).length,
    calendar: WEEK.reduce((n, d) => n + eventsFor(d.date).length, 0),
    kitchen: toBuy.length,
    loops: WAITING.length + later.length + INBOX.length,
  };
}

/* ------------------------------------------------------------------ *
 * Omnibar parser — used only by the Slate version.
 * ------------------------------------------------------------------ */

export type Parsed = {
  kind: "task" | "grocery" | "note" | "waiting" | "meal";
  title: string;
  date?: string;
  dateLabel?: string;
  tag?: string;
  list?: string;
};

const DAY_WORDS: Record<string, string> = {
  today: "2026-07-26",
  tomorrow: "2026-07-27",
  sunday: "2026-07-26",
  monday: "2026-07-27",
  tuesday: "2026-07-28",
  wednesday: "2026-07-29",
  thursday: "2026-07-30",
  friday: "2026-07-31",
  saturday: "2026-08-01",
  sun: "2026-07-26",
  mon: "2026-07-27",
  tue: "2026-07-28",
  wed: "2026-07-29",
  thu: "2026-07-30",
  fri: "2026-07-31",
  sat: "2026-08-01",
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const GROCERY_VERBS = /^(buy|get|grab|pick up)\s+/i;
const WAITING_VERBS = /^(waiting on|chase|follow up with|ask)\s+/i;
const MEAL_VERBS = /^(cook|make|eat)\s+/i;

/**
 * Deliberately small and predictable. It only recognises patterns worth
 * trusting, and anything it cannot place becomes an undated note rather than a
 * guess — a wrong guess costs more than no guess.
 */
export function parse(raw: string): Parsed {
  let text = raw.trim();
  if (!text) return { kind: "note", title: "" };

  let tag: string | undefined;
  const tagMatch = text.match(/#([a-z0-9.\-]+)/i);
  if (tagMatch) {
    const found = TAGS.find(
      (t) => t.toLowerCase() === tagMatch[1].toLowerCase(),
    );
    tag = found ?? tagMatch[1];
    text = text.replace(tagMatch[0], "").trim();
  }

  let date: string | undefined;
  let dateLabel: string | undefined;

  const monthMatch = text.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})\b/i,
  );
  if (monthMatch) {
    date = `2026-${MONTHS[monthMatch[1].toLowerCase()]}-${monthMatch[2].padStart(2, "0")}`;
    dateLabel = `${monthMatch[1][0].toUpperCase()}${monthMatch[1].slice(1).toLowerCase()} ${monthMatch[2]}`;
    text = text.replace(monthMatch[0], "").trim();
  } else {
    for (const [word, iso] of Object.entries(DAY_WORDS)) {
      const re = new RegExp(`\\b${word}\\b`, "i");
      if (re.test(text)) {
        date = iso;
        dateLabel =
          word === "today" || word === "tomorrow"
            ? word
            : (WEEK.find((d) => d.date === iso)?.weekday ?? word);
        text = text.replace(re, "").trim();
        break;
      }
    }
  }

  let kind: Parsed["kind"] = date ? "task" : "note";
  let list: string | undefined;

  if (GROCERY_VERBS.test(text)) {
    kind = "grocery";
    list = "Groceries";
    text = text.replace(GROCERY_VERBS, "");
  } else if (WAITING_VERBS.test(text)) {
    kind = "waiting";
    text = text.replace(WAITING_VERBS, "");
  } else if (MEAL_VERBS.test(text)) {
    kind = "meal";
    text = text.replace(MEAL_VERBS, "");
  } else if (
    GROCERIES.some((g) => g.name.toLowerCase() === text.toLowerCase())
  ) {
    kind = "grocery";
    list = "Groceries";
  }

  return {
    kind,
    title: text.replace(/\s{2,}/g, " ").trim(),
    date,
    dateLabel,
    tag,
    list,
  };
}

export function destination(p: Parsed): string {
  if (!p.title) return "";
  const bits: string[] = [];
  bits.push(
    p.kind === "grocery"
      ? "Groceries"
      : p.kind === "waiting"
        ? "Waiting on"
        : p.kind === "meal"
          ? "Meals"
          : p.kind === "task"
            ? "Task"
            : "Undated",
  );
  if (p.dateLabel) bits.push(p.dateLabel);
  if (p.tag) bits.push(`#${p.tag}`);
  return bits.join(" · ");
}
