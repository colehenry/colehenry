"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { CHAT_MODELS } from "@/lib/api/brain";
import { ProviderLogo } from "@/components/brain/model-logos";

export function ModelPicker({
  model,
  onChange,
  placement = "down",
}: {
  model: string;
  onChange: (slug: string) => void;
  placement?: "down" | "up";
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
        <span className="hidden text-[10px] text-[var(--term-dim)] sm:inline">{current.price.input}/{current.price.output}M</span>
        <ChevronDown className="size-3 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className={`absolute right-0 z-40 max-h-[min(70dvh,36rem)] w-72 overflow-y-auto rounded-md border border-[var(--term-line)] bg-[var(--term-bg-2)] py-1 shadow-lg ${placement === "up" ? "bottom-full mb-2" : "mt-1"}`}>
            <p className="px-3 py-1 text-[10px] text-[var(--term-dim)]">input / output · USD per 1M tokens</p>
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
                <span className="min-w-0 flex-1"><span className="block truncate text-[var(--term-fg)]">{m.label}</span>{m.hint && <span className="block truncate text-[10px] text-[var(--term-dim)]">{m.hint}</span>}</span>
                <span className="shrink-0 text-right font-mono text-[10px] leading-tight text-[var(--term-dim)]"><span className="block">{m.price.input} in</span><span className="block">{m.price.output} out</span></span>
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
