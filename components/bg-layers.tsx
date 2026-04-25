/**
 * BLACKBIRD — Background layers (v4)
 * 6 SVG layers positioned absolutely, z-0, pointer-events none.
 * Uses ONLY the official palette with opacity variations.
 */
export function BgLayers() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Layer 1 — central gunmetal glow */}
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1440 900"
        fill="none"
      >
        <defs>
          <radialGradient id="bb-glow-gunmetal" cx="50%" cy="20%" r="55%">
            <stop offset="0%" stopColor="#152132" stopOpacity="1" />
            <stop offset="100%" stopColor="#121315" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bb-glow-alice" cx="80%" cy="4%" r="28%">
            <stop offset="0%" stopColor="rgba(203,216,228,0.03)" stopOpacity="1" />
            <stop offset="100%" stopColor="rgba(203,216,228,0)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Layer 1 fill */}
        <rect width="1440" height="900" fill="url(#bb-glow-gunmetal)" />
        {/* Layer 2 — top-right alice blue light */}
        <rect width="1440" height="900" fill="url(#bb-glow-alice)" />

        {/* Layer 3 — top border thin alice line */}
        <rect x="0" y="0" width="1440" height="1.5" fill="rgba(203,216,228,0.2)" />

        {/* Layer 4 — editorial grid: 2 diagonals + 1 dashed vertical center */}
        <line
          x1="0"
          y1="0"
          x2="1440"
          y2="900"
          stroke="rgba(203,216,228,0.018)"
          strokeWidth="0.5"
        />
        <line
          x1="1440"
          y1="0"
          x2="0"
          y2="900"
          stroke="rgba(203,216,228,0.018)"
          strokeWidth="0.5"
        />
        <line
          x1="720"
          y1="0"
          x2="720"
          y2="900"
          stroke="rgba(203,216,228,0.01)"
          strokeWidth="0.5"
          strokeDasharray="4 14"
        />

        {/* Layer 5 — concentric circles (radar/surveillance) center 50% 22% */}
        <g>
          <circle
            cx="720"
            cy="198"
            r="155"
            stroke="rgba(203,216,228,0.025)"
            strokeWidth="0.5"
            fill="none"
          />
          <circle
            cx="720"
            cy="198"
            r="255"
            stroke="rgba(203,216,228,0.016)"
            strokeWidth="0.5"
            fill="none"
          />
          <circle
            cx="720"
            cy="198"
            r="370"
            stroke="rgba(203,216,228,0.009)"
            strokeWidth="0.5"
            fill="none"
          />
        </g>

        {/* Layer 6 — node network */}
        <g>
          {/* connecting lines */}
          <line x1="240" y1="160" x2="560" y2="260" stroke="rgba(203,216,228,0.05)" strokeWidth="0.5" />
          <line x1="560" y1="260" x2="920" y2="180" stroke="rgba(203,216,228,0.04)" strokeWidth="0.5" />
          <line x1="920" y1="180" x2="1220" y2="320" stroke="rgba(203,216,228,0.035)" strokeWidth="0.5" />
          <line x1="560" y1="260" x2="780" y2="440" stroke="rgba(203,216,228,0.04)" strokeWidth="0.5" />

          {/* nodes */}
          <circle cx="240" cy="160" r="1.5" fill="rgba(203,216,228,0.3)" />
          <circle cx="560" cy="260" r="1.5" fill="rgba(203,216,228,0.25)" />
          <circle cx="920" cy="180" r="1" fill="rgba(203,216,228,0.2)" />
          <circle cx="1220" cy="320" r="1.2" fill="rgba(203,216,228,0.18)" />
          <circle cx="780" cy="440" r="1" fill="rgba(203,216,228,0.15)" />
        </g>
      </svg>
    </div>
  )
}
