// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import type { ReactNode } from "react";

export type HexAccent = "cyan" | "magenta" | "gradient";
export type HexSize = "sm" | "md" | "lg" | "xl" | "hero";

export interface HexIconProps {
  /** Lucide icon (or anything renderable) shown in the centre. */
  children?: ReactNode;
  /** Visual size preset.
   *  - sm   = 32px (sidebar status, inline rows)
   *  - md   = 48px (sidebar header, action-tile thumbnail)
   *  - lg   = 80px (in-page accent)
   *  - xl   = 128px (action-tile hero icon)
   *  - hero = 200px (page-level centerpiece — Snelsetup / Aangepaste hero) */
  size?: HexSize;
  /** Stroke colour. `gradient` paints the cyan→magenta brand gradient; `cyan`
   *  / `magenta` are flat single-colour strokes. Match the surrounding section's
   *  upsell tier (Pro = cyan, Business / "creative" = magenta). */
  accent?: HexAccent;
  /** Slow ambient pulse on the outer glow. Use sparingly — only for the page
   *  centerpiece, not for inline / repeating instances. */
  pulse?: boolean;
  /** Subtle "Tron horizon" perspective grid floor inside the hex frame.
   *  Only legible at lg+ sizes; quietly skipped at sm/md. */
  perspectiveFloor?: boolean;
  /** Disambiguates SVG `<defs>` IDs when several HexIcons render together. */
  idSuffix?: string;
  /** Extra class on the outer wrapper. */
  className?: string;
}

const SIZE_PX: Record<HexSize, number> = {
  sm: 32,
  md: 48,
  lg: 80,
  xl: 128,
  hero: 200,
};

// Stroke width tuned per size so the frame stays visually consistent at every
// scale — small hexes need thicker relative strokes to read, hero hexes can
// go thinner because the bloom does the work.
const STROKE_WIDTH: Record<HexSize, number> = {
  sm: 3.5,
  md: 3,
  lg: 2.75,
  xl: 2.5,
  hero: 2.25,
};

// Pointy-top hexagon vertices on a 64×64 viewBox — matches BrandMark's hex so
// the brand and feature hexes share the same silhouette.
const HEX_POINTS = "32,4 56,18 56,46 32,60 8,46 8,18";

/**
 * Hexagonal frame containing a centred icon, with neon stroke + outer glow.
 * The signature primitive of the v2.4 redesign — used for action tiles, hero
 * sections, and inline status pegs across the desktop app.
 */
export function HexIcon({
  children,
  size = "lg",
  accent = "cyan",
  pulse = false,
  perspectiveFloor = false,
  idSuffix = "",
  className = "",
}: HexIconProps) {
  const px = SIZE_PX[size];
  const strokeW = STROKE_WIDTH[size];
  const gradId = `hex-grad-${accent}-${idSuffix}`;
  const clipId = `hex-clip-${idSuffix}`;
  const showFloor = perspectiveFloor && (size === "lg" || size === "xl" || size === "hero");
  const pulseClass =
    pulse && size === "hero"
      ? accent === "magenta"
        ? "animate-hex-pulse-magenta"
        : "animate-hex-pulse-cyan"
      : "";

  // Stroke source: gradient → use SVG <linearGradient>, flat → use a CSS var.
  const strokeRef =
    accent === "gradient"
      ? `url(#${gradId})`
      : accent === "magenta"
      ? "var(--accent-magenta)"
      : "var(--accent-cyan)";

  // Outer drop-shadow glow is rendered via CSS `filter` on the wrapper so it
  // stays performant. SVG <feGaussianBlur> would also work but recomputes on
  // every paint and tanks idle FPS at hero size.
  const glowFilter =
    accent === "magenta"
      ? "drop-shadow(0 0 16px var(--accent-magenta-glow)) drop-shadow(0 0 32px var(--accent-magenta-glow))"
      : "drop-shadow(0 0 16px var(--accent-cyan-glow)) drop-shadow(0 0 32px var(--accent-cyan-glow))";

  return (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: px, height: px }}
    >
      <svg
        viewBox="0 0 64 64"
        width={px}
        height={px}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={`absolute inset-0 ${pulseClass}`}
        style={pulse ? undefined : { filter: glowFilter }}
      >
        <defs>
          {accent === "gradient" && (
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: "var(--accent-cyan)" }} />
              <stop offset="100%" style={{ stopColor: "var(--accent-magenta)" }} />
            </linearGradient>
          )}
          {showFloor && (
            <clipPath id={clipId}>
              <polygon points={HEX_POINTS} />
            </clipPath>
          )}
        </defs>

        {/* Tron-horizon perspective floor inside the hex (lg+ only). Three
            horizontal lines stepping toward a vanishing point at hex centre,
            with two diagonal converging guides — keeps the cyber aesthetic
            without needing a raster backdrop. */}
        {showFloor && (
          <g
            clipPath={`url(#${clipId})`}
            stroke={strokeRef}
            strokeWidth="0.4"
            strokeOpacity="0.5"
            fill="none"
          >
            {/* Horizontal scan lines at increasing depth */}
            <line x1="10" y1="44" x2="54" y2="44" strokeOpacity="0.45" />
            <line x1="14" y1="50" x2="50" y2="50" strokeOpacity="0.32" />
            <line x1="20" y1="56" x2="44" y2="56" strokeOpacity="0.20" />
            {/* Vanishing-point guides converging at hex centre (32,32) */}
            <line x1="10" y1="44" x2="32" y2="32" strokeOpacity="0.35" />
            <line x1="54" y1="44" x2="32" y2="32" strokeOpacity="0.35" />
            <line x1="20" y1="56" x2="32" y2="32" strokeOpacity="0.20" />
            <line x1="44" y1="56" x2="32" y2="32" strokeOpacity="0.20" />
          </g>
        )}

        {/* Soft inner fill — barely-there tint inside the hex frame so the
            shape reads as an enclosed surface rather than just an outline. */}
        <polygon
          points={HEX_POINTS}
          fill={
            accent === "magenta"
              ? "var(--accent-magenta-soft)"
              : "var(--accent-cyan-soft)"
          }
          opacity="0.35"
        />

        {/* Hex frame stroke */}
        <polygon
          points={HEX_POINTS}
          fill="none"
          stroke={strokeRef}
          strokeWidth={strokeW}
          strokeLinejoin="round"
        />
      </svg>

      {/* Centred icon. Sized to roughly 40% of the hex bounding box so it
          sits comfortably inside the frame without crowding the strokes. */}
      {children && (
        <span
          className="relative flex items-center justify-center"
          style={{
            width: px * 0.42,
            height: px * 0.42,
            color:
              accent === "magenta"
                ? "var(--accent-magenta)"
                : accent === "gradient"
                ? "var(--accent-cyan)"
                : "var(--accent-cyan)",
          }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
