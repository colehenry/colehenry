/** Parse "YYYY-MM-DD" as a local date (Date.parse would shift it to UTC). */
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDay(iso: string, withYear = false): string {
  return parseDay(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

export function formatPct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
