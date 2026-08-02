"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_SCENE, isScene, type Scene } from "./scenes";

function subscribe(notify: () => void) {
  window.addEventListener("cambio-scene", notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener("cambio-scene", notify);
    window.removeEventListener("storage", notify);
  };
}

function snapshot(): Scene {
  const stored = localStorage.getItem("cambio-scene");
  return isScene(stored) ? stored : DEFAULT_SCENE;
}

/** Table scene, persisted per browser; pickers broadcast a `cambio-scene`
 * custom event after writing localStorage so every mounted table stays in
 * sync (mirrors use-skin.ts). */
export function useScene(): Scene {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_SCENE);
}

export function setScene(scene: Scene) {
  localStorage.setItem("cambio-scene", scene);
  window.dispatchEvent(new CustomEvent("cambio-scene", { detail: scene }));
}

/** Same broadcast contract for the card deck (skins.ts). */
export function setSkin(skin: string) {
  localStorage.setItem("cambio-skin", skin);
  window.dispatchEvent(new CustomEvent("cambio-skin", { detail: skin }));
}
