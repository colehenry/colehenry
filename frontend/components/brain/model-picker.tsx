"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

import { CHAT_MODELS } from "@/lib/api/brain";
import { ProviderLogo } from "@/components/brain/model-logos";

type PopupStyle = CSSProperties & Record<`--term-${string}`, string>;

export function ModelPicker({
  model,
  onChange,
  placement = "down",
  modelSlugs,
  dimBackground = true,
  modal = true,
}: {
  model: string;
  onChange: (slug: string) => void;
  placement?: "down" | "up";
  modelSlugs?: string[];
  dimBackground?: boolean;
  modal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<PopupStyle>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const models = modelSlugs
    ? CHAT_MODELS.filter((candidate) => modelSlugs.includes(candidate.slug))
    : CHAT_MODELS;
  const current =
    models.find((candidate) => candidate.slug === model) ??
    models[0] ??
    CHAT_MODELS[0];

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;

    function positionPopup() {
      const rect = trigger!.getBoundingClientRect();
      const viewportGap = 8;
      const popupGap = 8;
      const width = Math.min(288, window.innerWidth - viewportGap * 2);
      const spaceAbove = rect.top - popupGap - viewportGap;
      const spaceBelow = window.innerHeight - rect.bottom - popupGap - viewportGap;
      const minimumComfortableHeight = Math.min(420, window.innerHeight * 0.55);
      const openAbove = placement === "up"
        ? spaceAbove >= minimumComfortableHeight || spaceAbove >= spaceBelow
        : !(spaceBelow >= minimumComfortableHeight || spaceBelow >= spaceAbove);
      const availableHeight = Math.max(160, openAbove ? spaceAbove : spaceBelow);
      const computed = getComputedStyle(trigger!);
      setPopupStyle({
        position: "fixed",
        zIndex: modal ? 1001 : 60,
        width,
        maxHeight: Math.min(576, availableHeight),
        left: Math.max(viewportGap, Math.min(rect.right - width, window.innerWidth - width - viewportGap)),
        ...(openAbove
          ? { bottom: window.innerHeight - rect.top + popupGap }
          : { top: rect.bottom + popupGap }),
        "--term-bg-2": computed.getPropertyValue("--term-bg-2").trim() || "#11151c",
        "--term-line": computed.getPropertyValue("--term-line").trim() || "#2b3440",
        "--term-fg": computed.getPropertyValue("--term-fg").trim() || "#e7ebf2",
        "--term-dim": computed.getPropertyValue("--term-dim").trim() || "#8d97a8",
        "--term-accent": computed.getPropertyValue("--term-accent").trim() || "#7cb0d5",
      });
    }

    positionPopup();
    window.addEventListener("resize", positionPopup);
    return () => window.removeEventListener("resize", positionPopup);
  }, [modal, open, placement]);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    let appRoot: HTMLElement | null = trigger;
    while (appRoot?.parentElement && appRoot.parentElement !== document.body) appRoot = appRoot.parentElement;
    const wasInert = appRoot?.inert ?? false;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    if (modal) {
      if (appRoot) appRoot.inert = true;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    const blockBackgroundScroll = (event: WheelEvent | TouchEvent) => {
      if (!popupRef.current?.contains(event.target as Node)) event.preventDefault();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    if (modal) {
      document.addEventListener("wheel", blockBackgroundScroll, { passive: false });
      document.addEventListener("touchmove", blockBackgroundScroll, { passive: false });
    }
    document.addEventListener("keydown", keyboard);
    const focusFrame = requestAnimationFrame(() => {
      popupRef.current?.querySelector<HTMLButtonElement>("[aria-selected='true']")?.focus();
    });

    return () => {
      cancelAnimationFrame(focusFrame);
      if (modal) {
        document.removeEventListener("wheel", blockBackgroundScroll);
        document.removeEventListener("touchmove", blockBackgroundScroll);
      }
      document.removeEventListener("keydown", keyboard);
      if (modal) {
        document.body.style.overflow = bodyOverflow;
        document.documentElement.style.overflow = htmlOverflow;
        if (appRoot) appRoot.inert = wasInert;
      }
      trigger?.focus();
    };
  }, [modal, open]);

  const popup = open && popupStyle ? createPortal(
    <>
      <button
        type="button"
        style={{ zIndex: modal ? 1000 : 40 }}
        className={`fixed inset-0 cursor-default ${dimBackground ? "bg-black/30 backdrop-blur-[1px]" : "bg-transparent"}`}
        aria-label="Close model selector"
        onClick={() => setOpen(false)}
      />
      <div
        ref={popupRef}
        role="listbox"
        aria-label="Choose model"
        style={popupStyle}
        className="overflow-y-auto overscroll-contain rounded-md border border-[var(--term-line)] bg-[var(--term-bg-2)] py-1 shadow-[0_1.5rem_4rem_rgba(0,0,0,0.5)]"
      >
        <p className="px-3 py-1 text-[10px] text-[var(--term-dim)]">input / output · USD per 1M tokens</p>
        {models.map((m) => (
          <button
            key={m.slug}
            type="button"
            role="option"
            aria-selected={m.slug === model}
            onClick={() => {
              onChange(m.slug);
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-xs hover:bg-[color-mix(in_srgb,var(--term-accent)_14%,transparent)] ${
              m.slug === model ? "text-[var(--term-fg)]" : "text-[var(--term-dim)]"
            }`}
          >
            <ProviderLogo provider={m.provider} className="size-4 shrink-0" />
            <span className="min-w-0 flex-1"><span className="block truncate text-[var(--term-fg)]">{m.label}</span>{m.hint && <span className="block truncate text-[10px] text-[var(--term-dim)]">{m.hint}</span>}</span>
            <span className="shrink-0 text-right font-mono text-[10px] leading-tight text-[var(--term-dim)]"><span className="block">{m.price.input} in</span><span className="block">{m.price.output} out</span></span>
            {m.slug === model && <Check className="size-3.5 shrink-0 text-[var(--term-accent)]" />}
          </button>
        ))}
      </div>
    </>,
    document.body,
  ) : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-md border border-[var(--term-line)] bg-[var(--term-bg-2)] px-2 py-1 text-xs text-[var(--term-fg)] hover:border-[var(--term-accent)]"
      >
        <ProviderLogo provider={current.provider} className="size-3.5" />
        <span className="max-w-[9rem] truncate">{current.label}</span>
        <span className="hidden text-[10px] text-[var(--term-dim)] sm:inline">{current.price.input}/{current.price.output}M</span>
        <ChevronDown className={`size-3 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {popup}
    </div>
  );
}
