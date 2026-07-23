"use client";

import { useSyncExternalStore } from "react";

import type { Skin } from "./skins";

function subscribe(notify: () => void) {
  window.addEventListener("cambio-skin", notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener("cambio-skin", notify);
    window.removeEventListener("storage", notify);
  };
}

function snapshot(): Skin {
  const stored = localStorage.getItem("cambio-skin");
  return stored === "medieval" || stored === "art" ? stored : "xp";
}

/** Card skin, persisted per browser; pickers broadcast a `cambio-skin`
 * custom event after writing localStorage so every mounted table/preview
 * stays in sync. */
export function useSkin(): Skin {
  return useSyncExternalStore(subscribe, snapshot, () => "xp" as Skin);
}
