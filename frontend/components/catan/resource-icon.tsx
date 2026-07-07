import type { SVGProps } from "react";

/**
 * Hand-drawn Catan resource glyphs in the lucide idiom (24-grid, stroked,
 * round caps) so they sit next to lucide icons without looking imported
 * from a different set.
 */
export type ResourceName =
  | "hex"
  | "brick"
  | "wheat"
  | "road"
  | "shield"
  | "sheep"
  | "wood"
  | "ore"
  | "robber"
  | "crown";

const PATHS: Record<ResourceName, React.ReactNode> = {
  // board tile
  hex: (
    <path d="M12 2.5 20.2 7.25v9.5L12 21.5 3.8 16.75v-9.5L12 2.5z" />
  ),
  // stacked bricks
  brick: (
    <>
      <rect x="3" y="13.5" width="8" height="5" rx="0.5" />
      <rect x="13" y="13.5" width="8" height="5" rx="0.5" />
      <rect x="8" y="6.5" width="8" height="5" rx="0.5" />
    </>
  ),
  // wheat stalk
  wheat: (
    <>
      <path d="M12 21V8" />
      <path d="M12 12c-3 0-5-2-5-5 3 0 5 2 5 5z" />
      <path d="M12 12c3 0 5-2 5-5-3 0-5 2-5 5z" />
      <path d="M12 17c-3 0-5-2-5-5 3 0 5 2 5 5z" />
      <path d="M12 17c3 0 5-2 5-5-3 0-5 2-5 5z" />
      <path d="M12 8c0-3 1-4.5 2.5-5.5" />
    </>
  ),
  // longest road — winding path with segments
  road: (
    <>
      <path d="M4 19c5 0 4-6 8-7s8-1 8-6" />
      <path d="M7.2 16.2l1.6 1.8M12.6 11.6l.9 2.2M17.6 8l.6 2.3" />
    </>
  ),
  // largest army
  shield: (
    <>
      <path d="M12 21c-4.5-2-7.5-5-7.5-10V5.5L12 3l7.5 2.5V11c0 5-3 8-7.5 10z" />
      <path d="M12 7.5v6M9.5 10h5" />
    </>
  ),
  // games played
  sheep: (
    <>
      <path d="M7 9.5a3.2 3.2 0 0 1 1.6-3.7 3.2 3.2 0 0 1 6 .1 3.2 3.2 0 0 1 2.7 4.3 3.2 3.2 0 0 1-1.6 4.6H9a3.2 3.2 0 0 1-2-5.3z" />
      <path d="M9.5 15v4M14.5 15v4" />
      <circle cx="17.5" cy="10" r="0.2" />
    </>
  ),
  // pine tree
  wood: (
    <>
      <path d="M12 3 7 10h2.5L6 15.5h4M12 3l5 7h-2.5l3.5 5.5h-4" />
      <path d="M10 15.5h4" />
      <path d="M12 15.5V21" />
    </>
  ),
  // rock cluster
  ore: (
    <>
      <path d="M12 4 6.5 8.5 8 14h8l1.5-5.5L12 4z" />
      <path d="M8 14l-3.5 4.5h15L16 14M12 4v10" />
    </>
  ),
  // the robber pawn
  robber: (
    <>
      <circle cx="12" cy="5.5" r="2.7" />
      <path d="M10 8.2c-2.2 1.7-3.2 4.6-3.4 9.3h10.8c-.2-4.7-1.2-7.6-3.4-9.3" />
      <path d="M5.5 20.5h13" />
    </>
  ),
  // winner
  crown: (
    <>
      <path d="M4 8l4 4 4-6 4 6 4-4-1.5 10h-13L4 8z" />
      <path d="M6 21h12" />
    </>
  ),
};

export function ResourceIcon({
  name,
  ...props
}: { name: ResourceName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
