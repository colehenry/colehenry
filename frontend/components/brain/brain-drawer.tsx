"use client";

import type { ReactNode } from "react";

export function BrainDrawer({
  open,
  onClose,
  label,
  side = "left",
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  side?: "left" | "right";
  children: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        aria-label={`Close ${label}`}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={`brain-drawer-backdrop ${open ? "brain-drawer-backdrop-open" : ""}`}
      />
      <aside
        aria-label={label}
        aria-hidden={!open}
        className={`brain-drawer brain-drawer-${side} ${open ? "brain-drawer-open" : ""}`}
      >
        {children}
      </aside>
    </>
  );
}
