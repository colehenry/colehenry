"use client";

import { motion } from "motion/react";

/** The Cambio mascot — a cartoon Italian fellow in a red-striped shirt who pops
 * up when you call Cambio (plan §6.5). Placeholder hand-drawn SVG; real /
 * commissioned art can swap in later without touching callers. */
export function Mascot({ onClick }: { onClick?: () => void }) {
  return (
    <motion.div
      className="cb-mascot"
      onClick={onClick}
      initial={{ opacity: 0, y: 60, scale: 0.6, rotate: -8 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, y: 40, scale: 0.7, rotate: 6 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
    >
      <div className="cb-mascot-bubble">Cambio!</div>
      <svg width="132" height="150" viewBox="0 0 132 150" aria-hidden>
        {/* hair */}
        <path
          d="M34 52c0-20 14-34 32-34s32 14 32 34c0 6-2 10-2 10-4-16-16-22-30-22s-26 6-30 22c0 0-2-4-2-10Z"
          fill="#2b2018"
        />
        {/* face */}
        <ellipse cx="66" cy="58" rx="27" ry="30" fill="#f0c39a" />
        {/* ears */}
        <circle cx="39" cy="60" r="6" fill="#f0c39a" />
        <circle cx="93" cy="60" r="6" fill="#f0c39a" />
        {/* eyes */}
        <circle cx="55" cy="55" r="3.4" fill="#2b2018" />
        <circle cx="77" cy="55" r="3.4" fill="#2b2018" />
        {/* brows */}
        <path d="M49 47c3-3 9-3 12 0" stroke="#2b2018" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M71 47c3-3 9-3 12 0" stroke="#2b2018" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        {/* nose */}
        <path d="M66 57v9" stroke="#d79a6b" strokeWidth="3" strokeLinecap="round" />
        {/* moustache */}
        <path
          d="M50 72c5 5 11 5 16 1 5 4 11 4 16-1-4 7-12 8-16 4-4 4-12 3-16-4Z"
          fill="#2b2018"
        />
        {/* smile */}
        <path d="M58 80c5 4 11 4 16 0" stroke="#8a4b32" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        {/* neck */}
        <rect x="59" y="86" width="14" height="12" fill="#e6b487" />
        {/* red-striped shirt */}
        <path d="M30 150c0-24 16-40 36-40s36 16 36 40Z" fill="#f4f0e6" />
        <clipPath id="cb-shirt">
          <path d="M30 150c0-24 16-40 36-40s36 16 36 40Z" />
        </clipPath>
        <g clipPath="url(#cb-shirt)">
          <rect x="24" y="110" width="84" height="7" fill="#c8342b" />
          <rect x="24" y="124" width="84" height="7" fill="#c8342b" />
          <rect x="24" y="138" width="84" height="7" fill="#c8342b" />
        </g>
        {/* collar / neckerchief */}
        <path d="M56 110l10 12 10-12-10-4Z" fill="#2f6f4e" />
      </svg>
    </motion.div>
  );
}
