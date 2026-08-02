"use client";

import type { Scene } from "./scenes";

/** Illustrated table backdrops (plan §7), combining generated scene art with
 * lightweight SVG ambience and CSS motion overlays. */
export function SceneBackdrop({ scene }: { scene: Scene }) {
  return (
    <div className={`cb-backdrop cb-scene-${scene}`} aria-hidden>
      {scene === "seaside" && (
        <>
          <Seaside />
          <div className="cb-seaside-photo" />
          <div className="cb-seaside-shimmer" />
        </>
      )}
      {scene === "cafe" && (
        <>
          <Cafe />
          <div className="cb-cafe-photo" />
          <div className="cb-cafe-glow" />
          <div className="cb-cafe-steam" />
        </>
      )}
      {scene === "tavern" && (
        <>
          <Tavern />
          <div className="cb-tavern-photo" />
          <div className="cb-tavern-firelight" />
        </>
      )}
    </div>
  );
}

/** Trattoria awning across the top - cohesive with the red-striped mascot. */
function Awning() {
  const stripes = Array.from({ length: 18 });
  return (
    <g>
      {stripes.map((_, i) => (
        <rect
          key={i}
          x={i * 90}
          y={0}
          width={90}
          height={58}
          fill={i % 2 ? "#f4efe6" : "#c8342b"}
        />
      ))}
      {/* scalloped bottom edge */}
      {stripes.map((_, i) => (
        <path
          key={`s${i}`}
          d={`M${i * 90} 58 a45 34 0 0 0 90 0 Z`}
          fill={i % 2 ? "#f4efe6" : "#c8342b"}
        />
      ))}
    </g>
  );
}

function Seaside() {
  return (
    <svg className="cb-scene-svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="cb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fce7c8" />
          <stop offset="0.5" stopColor="#f6dcb0" />
          <stop offset="1" stopColor="#d5e6df" />
        </linearGradient>
        <linearGradient id="cb-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#93cfe0" />
          <stop offset="0.5" stopColor="#519fc5" />
          <stop offset="1" stopColor="#3a83af" />
        </linearGradient>
        <linearGradient id="cb-table" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cd9061" />
          <stop offset="1" stopColor="#9a6335" />
        </linearGradient>
        <radialGradient id="cb-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff4cf" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#ffe6a3" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffe6a3" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cb-tablelight" cx="0.5" cy="0.1" r="0.85">
          <stop offset="0" stopColor="#e7b581" />
          <stop offset="1" stopColor="#9a6335" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* sky */}
      <rect x="0" y="0" width="1600" height="520" fill="url(#cb-sky)" />

      {/* sun + glow */}
      <circle cx="1230" cy="200" r="250" fill="url(#cb-sun)" />
      <circle cx="1230" cy="200" r="64" fill="#fff2c4" />

      {/* clouds */}
      <g fill="#fffaf0" opacity="0.5">
        <ellipse cx="360" cy="180" rx="120" ry="24" />
        <ellipse cx="470" cy="196" rx="86" ry="18" />
        <ellipse cx="980" cy="150" rx="140" ry="22" />
      </g>

      {/* sea */}
      <rect x="0" y="500" width="1600" height="232" fill="url(#cb-sea)" />
      <rect x="0" y="500" width="1600" height="12" fill="#eef6f3" opacity="0.55" />
      <ellipse cx="1230" cy="560" rx="120" ry="28" fill="#ffe6a3" opacity="0.45" />
      <g stroke="#ffffff" strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M120 560 q40 -10 80 0 t80 0" />
        <path d="M620 604 q40 -10 80 0 t80 0" />
        <path d="M1050 574 q40 -10 80 0 t80 0" />
        <path d="M320 660 q40 -10 80 0 t80 0" />
        <path d="M1180 648 q40 -10 80 0 t80 0" />
      </g>

      {/* sailboats */}
      <g transform="translate(430 452)">
        <path d="M0 40 L44 40 L34 54 L8 54 Z" fill="#f4efe6" />
        <path d="M22 0 L22 38 L2 38 Z" fill="#fbfaf5" />
        <path d="M24 6 L24 38 L42 38 Z" fill="#e9a24a" />
      </g>
      <g transform="translate(960 470) scale(0.8)">
        <path d="M0 40 L44 40 L34 54 L8 54 Z" fill="#f4efe6" />
        <path d="M22 0 L22 38 L2 38 Z" fill="#fbfaf5" />
        <path d="M24 6 L24 38 L42 38 Z" fill="#c8544a" />
      </g>

      {/* terrace balustrade at the horizon */}
      <g fill="#efe7d6" opacity="0.9">
        <rect x="0" y="688" width="1600" height="12" />
        <rect x="0" y="700" width="1600" height="14" fill="#d9cdb4" />
        {Array.from({ length: 27 }).map((_, i) => (
          <rect key={i} x={i * 60 + 8} y="704" width="18" height="9" fill="#d9cdb4" />
        ))}
      </g>

      {/* terrace tabletop */}
      <rect x="0" y="714" width="1600" height="286" fill="url(#cb-table)" />
      <ellipse cx="800" cy="722" rx="1300" ry="120" fill="url(#cb-tablelight)" />
      <g stroke="#7f5330" strokeOpacity="0.3" strokeWidth="2">
        <line x1="0" y1="808" x2="1600" y2="800" />
        <line x1="0" y1="900" x2="1600" y2="892" />
      </g>

      <Awning />
    </svg>
  );
}

function Cafe() {
  return (
    <svg className="cb-scene-svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="cb-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1d15" />
          <stop offset="0.55" stopColor="#432f21" />
          <stop offset="1" stopColor="#5a3f2c" />
        </linearGradient>
        <linearGradient id="cb-counter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6b4831" />
          <stop offset="1" stopColor="#3f2818" />
        </linearGradient>
        <radialGradient id="cb-lamp" cx="0.5" cy="0.42" r="0.5">
          <stop offset="0" stopColor="#ffe6a8" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#f0b45a" stopOpacity="0.32" />
          <stop offset="1" stopColor="#f0b45a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* wall */}
      <rect x="0" y="0" width="1600" height="1000" fill="url(#cb-wall)" />

      {/* warm window glow on the left */}
      <rect x="120" y="120" width="300" height="360" rx="10" fill="#f2c477" opacity="0.22" />
      <rect x="130" y="130" width="280" height="340" rx="8" fill="#ffdd93" opacity="0.14" />
      <line x1="270" y1="120" x2="270" y2="480" stroke="#2a1d15" strokeWidth="8" opacity="0.5" />
      <line x1="120" y1="300" x2="420" y2="300" stroke="#2a1d15" strokeWidth="8" opacity="0.5" />

      {/* pendant lamp */}
      <line x1="1120" y1="0" x2="1120" y2="150" stroke="#1c130d" strokeWidth="5" />
      <path d="M1070 150 L1170 150 L1150 205 L1090 205 Z" fill="#2a1a10" />
      <ellipse cx="1120" cy="205" rx="34" ry="9" fill="#ffdd93" />
      <circle cx="1120" cy="300" r="300" fill="url(#cb-lamp)" />

      {/* back-bar shelf with bottles */}
      <rect x="820" y="360" width="620" height="14" fill="#33241a" />
      <g>
        {[
          ["#7ba05b", 860],
          ["#9c4a3c", 920],
          ["#c8a24a", 980],
          ["#5b7d8a", 1040],
          ["#8a5b7d", 1100],
          ["#a06a3c", 1160],
          ["#6b8f5b", 1220],
        ].map(([c, x], i) => (
          <g key={i}>
            <rect x={x as number} y={300} width="22" height="60" rx="4" fill={c as string} opacity="0.85" />
            <rect x={(x as number) + 8} y={286} width="6" height="18" fill={c as string} opacity="0.85" />
          </g>
        ))}
      </g>

      {/* steam wisps from an unseen cup */}
      <g stroke="#fff" strokeOpacity="0.14" strokeWidth="6" fill="none" strokeLinecap="round">
        <path d="M560 640 q-20 -40 0 -80 q20 -40 0 -80" />
        <path d="M610 640 q-20 -40 0 -80 q20 -40 0 -80" />
      </g>

      {/* bar counter (foreground table) */}
      <rect x="0" y="690" width="1600" height="310" fill="url(#cb-counter)" />
      <rect x="0" y="690" width="1600" height="10" fill="#8a5f40" opacity="0.7" />
      <g stroke="#241609" strokeOpacity="0.35" strokeWidth="2">
        <line x1="0" y1="800" x2="1600" y2="800" />
        <line x1="0" y1="900" x2="1600" y2="900" />
      </g>
    </svg>
  );
}

function Tavern() {
  return (
    <svg className="cb-scene-svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="cb-stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2620" />
          <stop offset="0.6" stopColor="#3d352b" />
          <stop offset="1" stopColor="#4a3d2e" />
        </linearGradient>
        <linearGradient id="cb-board" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6e4d2f" />
          <stop offset="1" stopColor="#3e2916" />
        </linearGradient>
        <radialGradient id="cb-hearth" cx="0.5" cy="0.55" r="0.5">
          <stop offset="0" stopColor="#ffd27a" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#e8863a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#e8863a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* stone wall */}
      <rect x="0" y="0" width="1600" height="1000" fill="url(#cb-stone)" />
      {/* stone block seams */}
      <g stroke="#20190f" strokeOpacity="0.4" strokeWidth="3">
        <line x1="0" y1="150" x2="1600" y2="150" />
        <line x1="0" y1="330" x2="1600" y2="330" />
        <line x1="0" y1="510" x2="1600" y2="510" />
        <line x1="200" y1="0" x2="200" y2="150" />
        <line x1="520" y1="150" x2="520" y2="330" />
        <line x1="900" y1="0" x2="900" y2="150" />
        <line x1="1240" y1="150" x2="1240" y2="330" />
        <line x1="700" y1="330" x2="700" y2="510" />
        <line x1="1120" y1="330" x2="1120" y2="510" />
      </g>

      {/* hearth glow on the left */}
      <rect x="120" y="300" width="260" height="240" rx="14" fill="#1a120a" />
      <circle cx="250" cy="470" r="230" fill="url(#cb-hearth)" />
      {/* flames */}
      <g>
        <path d="M210 500 q-20 -60 30 -100 q-6 44 26 60 q28 -22 18 -66 q40 40 20 100 Z" fill="#ffab40" />
        <path d="M232 500 q-10 -40 18 -66 q-2 28 16 38 q16 -16 10 -42 q24 28 12 70 Z" fill="#ffd873" />
      </g>

      {/* hanging iron chandelier */}
      <line x1="1160" y1="0" x2="1160" y2="120" stroke="#15100a" strokeWidth="5" />
      <ellipse cx="1160" cy="130" rx="90" ry="16" fill="none" stroke="#2b2117" strokeWidth="8" />
      {[1090, 1130, 1160, 1190, 1230].map((x, i) => (
        <g key={i}>
          <rect x={x - 3} y="118" width="6" height="20" fill="#2b2117" />
          <ellipse cx={x} cy="150" rx="7" ry="12" fill="#ffd27a" />
          <circle cx={x} cy="150" r="22" fill="#ffd27a" opacity="0.18" />
        </g>
      ))}

      {/* wood ceiling beam */}
      <rect x="0" y="60" width="1600" height="34" fill="#2e2013" opacity="0.85" />

      {/* hanging banner / pennant */}
      <g transform="translate(620 94)">
        <rect x="0" y="0" width="120" height="150" fill="#7c1f1a" />
        <path d="M0 150 L60 200 L120 150 Z" fill="#7c1f1a" />
        <path d="M45 40 l15 -22 l15 22 l-15 22 Z" fill="#d8b34a" />
        <circle cx="60" cy="96" r="14" fill="none" stroke="#d8b34a" strokeWidth="5" />
      </g>

      {/* heavy wooden table (foreground) */}
      <rect x="0" y="678" width="1600" height="322" fill="url(#cb-board)" />
      <rect x="0" y="678" width="1600" height="12" fill="#8a5f36" opacity="0.7" />
      <g stroke="#241205" strokeOpacity="0.4" strokeWidth="3">
        <line x1="0" y1="790" x2="1600" y2="784" />
        <line x1="0" y1="892" x2="1600" y2="886" />
      </g>
      {/* iron tankard on the table edge */}
      <g transform="translate(1360 700)">
        <rect x="0" y="0" width="70" height="90" rx="8" fill="#3a3a40" />
        <rect x="6" y="6" width="58" height="20" rx="6" fill="#e9dcae" />
        <path d="M70 20 q34 0 34 30 q0 30 -34 30" fill="none" stroke="#3a3a40" strokeWidth="10" />
      </g>
    </svg>
  );
}
