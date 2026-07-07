import type { Section } from "@/lib/sections";

/**
 * Themed blank page for sections that get built in later phases.
 * The wrapping div sets `data-section`, which reskins --accent for
 * everything inside.
 */
export function ComingSoon({ section }: { section: Section }) {
  return (
    <div data-section={section.accent}>
      <div className="bg-grid absolute inset-x-0 top-14 h-72" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col px-4 pt-24 pb-32 sm:px-6">
        <p className="section-label reveal" style={{ "--reveal-i": 0 } as React.CSSProperties}>
          {section.path}
        </p>
        <h1
          className="reveal mt-4 text-5xl font-medium tracking-tight sm:text-6xl"
          style={{ "--reveal-i": 1 } as React.CSSProperties}
        >
          {section.name}
        </h1>
        <p
          className="reveal mt-4 max-w-md text-lg text-muted-foreground"
          style={{ "--reveal-i": 2 } as React.CSSProperties}
        >
          {section.description}
        </p>
        <div
          className="reveal mt-10 inline-flex w-fit items-center gap-2 rounded-full border border-brand/30 bg-brand/5 px-4 py-1.5 font-mono text-xs text-brand"
          style={{ "--reveal-i": 3 } as React.CSSProperties}
        >
          <span className="size-1.5 animate-pulse rounded-full bg-brand" />
          under construction
        </div>
      </div>
    </div>
  );
}
