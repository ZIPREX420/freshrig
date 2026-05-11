// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { APP_NAME } from "../../config/app";

export interface BrandMarkProps {
  /** Pixel width of the mark. Height auto-computes from the 2:1 aspect. */
  size?: number;
  /** Optional className applied to the root <svg>. */
  className?: string;
  /** Unique gradient/filter ID suffix when multiple marks render together. */
  idSuffix?: string;
  /** Background colour to "cut" through the hollow tube centres. Defaults to
   *  the card surface (`var(--bg-card)`). Set this to whatever colour the
   *  parent surface is using when not the standard card bg. */
  surfaceColor?: string;
}

/**
 * "FR" neon-tube monogram. Solid cyan F + solid magenta R, with a narrow
 * violet kiss between them. Built with the hollow-tube technique so each
 * stroke reads as a lit-up neon sign rather than a flat painted line:
 *
 *   1. Bloom filter — wide cyan + magenta gaussian halos behind the strokes
 *   2. Outer ring  — full-color stroke at width N
 *   3. Hollow cut  — surface-coloured stroke at width N − ~4 (carves out the
 *                    centre, leaving ~2px-wide bright rings on each side)
 *   4. Bright core — thin white highlight at width 1, low opacity, for the
 *                    sense of light coming from inside the tube
 *
 * No frame around the monogram (matches the reference identity exactly). The
 * hex frame that used to wrap the FR has moved to `<HexIcon>` (action-tile
 * thumbnails / page centerpieces); brand surfaces use this clean monogram.
 */
export function BrandMark({
  size = 64,
  className = "",
  idSuffix = "",
  surfaceColor = "var(--bg-card)",
}: BrandMarkProps) {
  // 2:1 width-to-height aspect — wider than tall to fit F + R side by side.
  const w = size;
  const h = size * 0.5;
  const gradId = `brand-grad${idSuffix}`;
  const bloomId = `brand-bloom${idSuffix}`;

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 200 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${APP_NAME} logo`}
      className={className}
    >
      <defs>
        {/* Hard-stop gradient — solid cyan ⟶ narrow violet bridge ⟶ solid
            magenta. The bridge is intentionally tight so each letter reads
            as its own colour, with just a kiss of warmth where they meet. */}
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00e5ff" />
          <stop offset="42%" stopColor="#00e5ff" />
          <stop offset="50%" stopColor="#a060ff" />
          <stop offset="58%" stopColor="#ff2bd6" />
          <stop offset="100%" stopColor="#ff2bd6" />
        </linearGradient>
        {/* Bloom — separate cyan and magenta halos behind the strokes,
            sized to radiate ~3× the stroke width without losing definition. */}
        <filter id={bloomId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="b1" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="b2" />
          <feFlood floodColor="#00e5ff" floodOpacity="0.55" result="cyan" />
          <feComposite in="cyan" in2="b2" operator="in" result="cyan-glow" />
          <feFlood floodColor="#ff2bd6" floodOpacity="0.50" result="mag" />
          <feComposite in="mag" in2="b1" operator="in" result="mag-glow" />
          <feMerge>
            <feMergeNode in="cyan-glow" />
            <feMergeNode in="mag-glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Hollow-tube stack. All three layers share the same FRPaths geometry —
          drawn at decreasing widths to carve the bright rings + lit centre. */}
      <g filter={`url(#${bloomId})`}>
        {/* OUTER ring — full gradient colour, the visible "tube body" */}
        <FRPaths stroke={`url(#${gradId})`} strokeWidth={9} />
        {/* HOLLOW cut — surface colour, leaves ~2px bright rings on each side */}
        <FRPaths stroke={surfaceColor} strokeWidth={5} />
        {/* INNER core — thin white specular glint, suggests light from inside */}
        <FRPaths stroke="rgba(255, 255, 255, 0.65)" strokeWidth={1.2} />
      </g>
    </svg>
  );
}

// Shared path geometry. Three FRPaths render the hollow-tube stack at
// different stroke widths. Coordinates target the 200×100 viewBox.
function FRPaths({
  stroke,
  strokeWidth,
}: {
  stroke: string;
  strokeWidth: number;
}) {
  return (
    <g
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      {/* === F (left) — upright vertical + two horizontal arms === */}
      <path d="M 30 18 L 30 82" />
      <path d="M 30 18 L 78 18" />
      <path d="M 30 50 L 64 50" />

      {/* === R (right) — upright vertical + bowl + diagonal leg === */}
      <path d="M 100 18 L 100 82" />
      <path d="M 100 18 L 136 18 C 168 18 168 54 136 54 L 100 54" />
      <path d="M 136 54 L 176 82" />
    </g>
  );
}

/**
 * "FRESHRIG" wordmark. "FRESH" in primary text colour, "RIG" in the magenta
 * accent. Letter-spacing wide for the instrument-panel feel. Pair with
 * `<BrandMark>` for hero scale; can omit when only the chrome wordmark is needed.
 */
export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-semibold tracking-[0.08em] ${className}`}
      aria-label={APP_NAME}
    >
      <span className="text-text-primary">FRESH</span>
      <span className="text-accent-magenta">RIG</span>
    </span>
  );
}
