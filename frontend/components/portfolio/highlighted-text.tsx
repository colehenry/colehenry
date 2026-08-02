export type HighlightableText = {
  text: string;
  highlights?: string[];
};

export function HighlightedText({ value }: { value: HighlightableText }) {
  if (!value.highlights?.length) return <>{value.text}</>;

  const parts: React.ReactNode[] = [];
  let remaining = value.text;

  value.highlights.forEach((highlight) => {
    const index = remaining.indexOf(highlight);
    if (index === -1) return;

    if (index > 0) parts.push(remaining.slice(0, index));
    parts.push(
      <strong
        key={`${highlight}-${parts.length}`}
        className="font-semibold text-foreground"
      >
        {highlight}
      </strong>,
    );
    remaining = remaining.slice(index + highlight.length);
  });

  if (remaining) parts.push(remaining);

  return <>{parts}</>;
}
