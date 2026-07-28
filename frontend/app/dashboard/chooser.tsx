"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Studio, type Variant } from "./studio/studio";
import "./dashboard.css";

/**
 * Three versions of the Studio layout. Same four tabs, same always-there
 * sidebar, same data — they differ in palette and in how you add things.
 */

const VERSIONS: { id: Variant; name: string; idea: string }[] = [
  {
    id: "paper",
    name: "Paper",
    idea: "Warm paper. Every list ends with its own + add — nothing to learn.",
  },
  {
    id: "slate",
    name: "Slate",
    idea: "Deep slate + cyan. One omnibar; a parser routes it and shows where first.",
  },
  {
    id: "ember",
    name: "Ember",
    idea: "Warm dark. The sidebar is writable — add to any section from any tab.",
  },
];

export function DashboardChooser() {
  return (
    <Suspense fallback={<div className="dash-shell" />}>
      <Chooser />
    </Suspense>
  );
}

function Chooser() {
  const router = useRouter();
  const params = useSearchParams();
  const fromUrl = params.get("v");
  const [picked, setPicked] = useState<Variant | null>(null);

  const active =
    picked ??
    ((VERSIONS.some((v) => v.id === fromUrl) ? fromUrl : VERSIONS[0].id) as Variant);
  const current = VERSIONS.find((v) => v.id === active) ?? VERSIONS[0];

  function choose(id: Variant) {
    setPicked(id);
    router.replace(`/dashboard?v=${id}`, { scroll: false });
  }

  return (
    <div className="dash-shell">
      <div className="dash-picker">
        <div className="dash-picker__inner">
          <div className="dash-picker__list" role="tablist" aria-label="Version">
            {VERSIONS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={v.id === active}
                className="dash-picker__btn"
                onClick={() => choose(v.id)}
              >
                <span className="dash-picker__name">{v.name}</span>
              </button>
            ))}
          </div>
          <p className="dash-picker__idea">{current.idea}</p>
        </div>
      </div>

      <div className="dash-stage" key={active}>
        <Studio variant={active} />
      </div>
    </div>
  );
}
