import { ResourceIcon } from "@/components/catan/resource-icon";

const PLAYLIST_ID = "4Nu347f3p0m1O6H1xQaACj";

export function Soundtrack() {
  return (
    <section
      className="reveal overflow-hidden rounded-lg border bg-card"
      style={{ "--reveal-i": 1 } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 border-b bg-brand/5 px-4 py-2.5">
        <ResourceIcon name="sheep" className="size-4 text-brand" />
        <h2 className="font-heading text-base font-medium">Soundtrack</h2>
      </div>
      <iframe
        title="Soundtrack"
        src={`https://open.spotify.com/embed/playlist/${PLAYLIST_ID}?theme=0`}
        width="100%"
        height="352"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        className="block"
      />
    </section>
  );
}
