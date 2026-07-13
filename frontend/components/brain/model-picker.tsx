"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { CHAT_MODELS } from "@/lib/api/brain";
import { ProviderLogo } from "@/components/brain/model-logos";

export function ModelPicker({
  model,
  onChange,
}: {
  model: string;
  onChange: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = CHAT_MODELS.find((m) => m.slug === model) ?? CHAT_MODELS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-[var(--term-line)] bg-[var(--term-bg-2)] px-2 py-1 text-xs text-[var(--term-fg)] hover:border-[var(--term-accent)]"
      >
        <ProviderLogo provider={current.provider} className="size-3.5" />
        <span className="max-w-[9rem] truncate">{current.label}</span>
        <ChevronDown className="size-3 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-64 overflow-hidden rounded-md border border-[var(--term-line)] bg-[var(--term-bg-2)] py-1 shadow-lg">
            {CHAT_MODELS.map((m) => (
              <button
                key={m.slug}
                type="button"
                onClick={() => {
                  onChange(m.slug);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-xs hover:bg-[rgba(169,139,255,0.12)] ${
                  m.slug === model ? "text-[var(--term-fg)]" : "text-[var(--term-dim)]"
                }`}
              >
                <ProviderLogo provider={m.provider} className="size-4 shrink-0" />
                <span className="flex-1 truncate text-[var(--term-fg)]">{m.label}</span>
                {m.hint && (
                  <span className="shrink-0 text-[10px] text-[var(--term-dim)]">{m.hint}</span>
                )}
                {m.slug === model && (
                  <Check className="size-3.5 shrink-0 text-[var(--term-accent)]" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
