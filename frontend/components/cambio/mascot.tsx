"use client";

import { motion } from "motion/react";

import type { Scene } from "./scenes";

/** The Cambio mascot changes costume with the table while remaining the same
 * familiar character: seaside local, café barista, or tavern jester. */
export function Mascot({ scene }: { scene: Scene }) {
  const shirtClip = `cb-shirt-${scene}`;
  return (
    <motion.div
      className={`cb-mascot is-${scene}`}
      initial={{ opacity: 0, y: 60, scale: 0.6, rotate: -8 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, y: 40, scale: 0.7, rotate: 6 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      aria-hidden
    >
      <div className="cb-mascot-bubble">Cambio!</div>
      <svg width="132" height="150" viewBox="0 0 132 150" aria-hidden>
        {scene === "tavern" && (
          <g>
            <path d="M34 40Q42 10 66 30Q88 5 99 39Q78 29 66 42Q52 29 34 40Z" fill="#7a245f" />
            <path d="M34 40Q34 14 18 18Q27 38 43 46Z" fill="#d6a72a" />
            <circle cx="18" cy="18" r="4" fill="#f1d56b" stroke="#4a2a20" strokeWidth="1.5" />
            <circle cx="66" cy="28" r="4" fill="#f1d56b" stroke="#4a2a20" strokeWidth="1.5" />
            <circle cx="99" cy="39" r="4" fill="#f1d56b" stroke="#4a2a20" strokeWidth="1.5" />
          </g>
        )}
        {scene === "cafe" && (
          <path d="M37 40Q43 17 68 16Q90 17 96 38Q72 31 37 40Z" fill="#f1e1c4" stroke="#6b4027" strokeWidth="2" />
        )}
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
        {/* scene costume base */}
        <path
          d="M30 150c0-24 16-40 36-40s36 16 36 40Z"
          fill={scene === "tavern" ? "#7a245f" : "#f4f0e6"}
        />
        <clipPath id={shirtClip}>
          <path d="M30 150c0-24 16-40 36-40s36 16 36 40Z" />
        </clipPath>
        {scene === "seaside" && (
          <g clipPath={`url(#${shirtClip})`}>
            <rect x="24" y="110" width="84" height="7" fill="#c8342b" />
            <rect x="24" y="124" width="84" height="7" fill="#c8342b" />
            <rect x="24" y="138" width="84" height="7" fill="#c8342b" />
          </g>
        )}
        {scene === "seaside" && (
          <path d="M56 110l10 12 10-12-10-4Z" fill="#2f6f4e" />
        )}
        {scene === "cafe" && (
          <g>
            <path d="M43 120Q66 110 89 120L94 150H38Z" fill="#71472f" />
            <path d="M53 110L47 128M79 110L85 128" stroke="#71472f" strokeWidth="5" />
            <path d="M48 143H84" stroke="#b98258" strokeWidth="2" />
            <path d="M92 127h15v12H92Z" fill="#fff8e8" stroke="#593621" strokeWidth="2" />
            <path d="M107 130q8 0 5 6q-2 4-6 1" fill="none" stroke="#593621" strokeWidth="2" />
            <path d="M96 124q-3-5 1-8M102 124q-3-5 1-8" fill="none" stroke="#fff1d2" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}
        {scene === "tavern" && (
          <g clipPath={`url(#${shirtClip})`}>
            <path d="M66 108V150H102Q102 120 66 108Z" fill="#d6a72a" />
            <path d="M37 114L51 128L66 113L81 128L96 114" fill="#f4ead2" stroke="#4a2a20" strokeWidth="1.5" />
            <circle cx="51" cy="129" r="3" fill="#f1d56b" stroke="#4a2a20" />
            <circle cx="81" cy="129" r="3" fill="#f1d56b" stroke="#4a2a20" />
          </g>
        )}
      </svg>
    </motion.div>
  );
}
