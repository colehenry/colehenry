/** Client-side grading - mirrors backend/app/services/learning/text.py exactly. */

const APOSTROPHES: Record<string, string> = { "’": "'", "‘": "'", "`": "'", "´": "'" };

export function normalize(text: string, stripAccents = false): string {
  let t = text.replace(/[’‘`´]/g, (c) => APOSTROPHES[c] ?? c).toLowerCase().trim();
  t = t.replace(/[.,;:!?¿¡«»"()[\]]+/g, " ");
  t = t.replace(/' /g, "'");
  t = t.replace(/\s+/g, " ").trim();
  if (stripAccents) t = t.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return t;
}

export function dropNe(text: string): string {
  let out = text.replace(/\bne\s+/g, "");
  out = out.replace(/\bn'(?=[aeiouyhéèêàâôûîï])/g, "");
  out = out.replace(/\bje (?=[aeiouyhéèêàâôûîï])/g, "j'");
  return out.replace(/\s+/g, " ").trim();
}

function similarity(a: string, b: string): number {
  // Ratcliff/Obershelp approximation via LCS ratio - good enough for typo tolerance
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  const dp: number[] = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    let prev = 0;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return (2 * dp[n]) / (m + n);
}

export type TypedResult = {
  correct: boolean;
  score: number;
  exact: boolean;
  accentIssue: boolean;
  neDropped: boolean;
  closest: string;
};

export function checkTyped(answer: string, accepted: string[]): TypedResult {
  const given = normalize(answer);
  const base: TypedResult = { correct: false, score: 0, exact: false, accentIssue: false, neDropped: false, closest: accepted[0] ?? "" };
  if (!given) return base;
  const variants = accepted.filter((a) => a.trim()).map((a) => normalize(a));
  if (variants.includes(given)) return { ...base, correct: true, score: 1, exact: true, closest: answer };
  const flat = normalize(answer, true);
  for (let i = 0; i < variants.length; i++) {
    if (flat === normalize(variants[i], true)) return { ...base, correct: true, score: 0.9, accentIssue: true, closest: accepted[i] };
  }
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    if (v.includes("ne ") || v.includes("n'")) {
      const informal = dropNe(v);
      if (given === informal || flat === normalize(informal, true)) {
        return { ...base, correct: true, score: 0.8, neDropped: true, closest: accepted[i] };
      }
    }
  }
  let best = accepted[0] ?? "";
  let bestRatio = 0;
  for (let i = 0; i < variants.length; i++) {
    const r = similarity(flat, normalize(variants[i], true));
    if (r > bestRatio) {
      bestRatio = r;
      best = accepted[i];
    }
  }
  if (bestRatio >= 0.92) return { ...base, correct: true, score: 0.7, closest: best };
  return { ...base, score: Math.round(bestRatio * 50) / 100, closest: best };
}

export type DiffOp = { op: "equal" | "missing" | "extra" | "wrong"; text: string; expected?: string };

export function wordDiff(expected: string, given: string): DiffOp[] {
  const exp = normalize(expected).split(" ").filter(Boolean);
  const got = normalize(given).split(" ").filter(Boolean);
  // LCS table
  const m = exp.length;
  const n = got.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = exp[i] === got[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (exp[i] === got[j]) {
      out.push({ op: "equal", text: exp[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      // expected word missing; if the next given word also mismatches treat as wrong
      if (dp[i + 1][j + 1] === dp[i + 1][j] && got[j] !== exp[i + 1]) {
        out.push({ op: "wrong", text: got[j], expected: exp[i] });
        i++;
        j++;
      } else {
        out.push({ op: "missing", text: exp[i] });
        i++;
      }
    } else {
      out.push({ op: "extra", text: got[j] });
      j++;
    }
  }
  while (i < m) out.push({ op: "missing", text: exp[i++] });
  while (j < n) out.push({ op: "extra", text: got[j++] });
  return out;
}

export function dictationScore(expected: string, given: string): number {
  const exp = normalize(expected, true).split(" ").filter(Boolean);
  const got = normalize(given, true).split(" ").filter(Boolean);
  if (!exp.length) return 0;
  const m = exp.length;
  const n = got.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = exp[i - 1] === got[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return Math.round((dp[m][n] / Math.max(m, n)) * 100) / 100;
}

export const SELF_SCORES = [0, 0.4, 0.8, 1];
