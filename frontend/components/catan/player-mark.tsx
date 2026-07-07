import { PLAYER_RESOURCES, playerColor } from "@/components/catan/colors";
import { ResourceIcon } from "@/components/catan/resource-icon";
import { cn } from "@/lib/utils";

/**
 * A player's identity mark: their resource glyph in their color for the
 * regulars, a neutral hex chip for guests.
 */
export function PlayerMark({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const resource = PLAYER_RESOURCES[name.toLowerCase()];
  if (!resource)
    return (
      <span
        className={cn(
          "inline-block size-2.5 shrink-0 [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]",
          className,
        )}
        style={{ background: playerColor(name) }}
      />
    );
  return (
    <ResourceIcon
      name={resource}
      className={cn("size-3.5 shrink-0", className)}
      style={{ color: playerColor(name) }}
    />
  );
}
