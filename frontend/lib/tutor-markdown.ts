const TAG_RE = /\[\[(fr-slow|fr|ref|activity|vocab|new):([^\]\n]+?)(?:\|([^\]\n]*))?\]\]/g;

export type TutorMarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: TutorMarkdownNode[];
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function prettyRef(id: string): string {
  const [sheet, section] = id.split("#");
  return section
    ? `${sheet.replace(/-/g, " ")} · ${section.replace(/-/g, " ")}`
    : sheet.replace(/-/g, " ");
}

/** `[[kind:id|label]]` → `[label](tutor://kind/<encoded id>)`. */
export function tagsToLinks(markdown: string): string {
  return markdown.replace(TAG_RE, (_match, kind: string, id: string, label?: string) => {
    const text = (label && label.trim()) || (kind === "ref" ? prettyRef(id.trim()) : id.trim());
    const safe = text.replace(/[[\]]/g, "");
    return `[${safe}](tutor://${kind}/${encodeURIComponent(id.trim())})`;
  });
}

/** Remark plugin that links known infinitives while leaving links and code alone. */
export function knownVerbsPlugin(infinitives: string[]) {
  const alternatives = infinitives
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  const pattern = alternatives
    ? new RegExp(`(^|[^\\p{L}\\p{M}-])(${alternatives})(?=$|[^\\p{L}\\p{M}-])`, "giu")
    : null;

  return () => (tree: TutorMarkdownNode) => {
    if (!pattern) return;
    const walk = (node: TutorMarkdownNode, blocked = false) => {
      const nextBlocked = blocked || node.type === "link" || node.type === "code" || node.type === "inlineCode";
      if (!node.children || nextBlocked) return;
      const next: TutorMarkdownNode[] = [];
      for (const child of node.children) {
        if (child.type !== "text" || !child.value) {
          walk(child, false);
          next.push(child);
          continue;
        }
        let cursor = 0;
        pattern.lastIndex = 0;
        for (const match of child.value.matchAll(pattern)) {
          const boundary = match[1] ?? "";
          const verb = match[2];
          const start = (match.index ?? 0) + boundary.length;
          if (start > cursor) next.push({ type: "text", value: child.value.slice(cursor, start) });
          next.push({
            type: "link",
            url: `tutor://verb/${encodeURIComponent(verb)}`,
            children: [{ type: "text", value: verb }],
          });
          cursor = start + verb.length;
        }
        if (cursor < child.value.length) next.push({ type: "text", value: child.value.slice(cursor) });
      }
      node.children = next;
    };
    walk(tree);
  };
}
