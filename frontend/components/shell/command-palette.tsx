"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

const CommandPaletteDialog = dynamic(
  () => import("./command-palette-dialog").then((m) => m.CommandPaletteDialog),
  { ssr: false },
);

/**
 * The site-wide ⌘K palette - mounted once in the root layout.
 * Also opens via the header button (a custom "open-command-palette" event).
 *
 * Only the trigger lives here. The contents pull in `cmdk` and its Radix
 * dialog, which is dead weight on every route for a surface that starts
 * closed, so they load on first open and stay mounted afterwards.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  // once opened, keep the dialog mounted: it owns its own open/close animation
  // and re-importing the chunk on every ⌘K would stutter
  const [loaded, setLoaded] = useState(false);

  const toggle = useCallback(() => {
    setLoaded(true);
    setOpen((v) => !v);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    const onOpen = () => {
      setLoaded(true);
      setOpen(true);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("open-command-palette", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("open-command-palette", onOpen);
    };
  }, [toggle]);

  if (!loaded) return null;
  return <CommandPaletteDialog open={open} onOpenChange={setOpen} />;
}
