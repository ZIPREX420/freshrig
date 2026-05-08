// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { APP_NAME } from "../../config/app";

export interface BrandMarkProps {
  /** Pixel size of the mark (square). Default 32. */
  size?: number;
  /** Optional className applied to the root <svg>. */
  className?: string;
  /** Unique gradient ID suffix when multiple marks render on the same page. */
  idSuffix?: string;
}

/**
 * Hexagonal "FR" monogram. Cyan→magenta gradient stroke with a soft outer
 * glow. Used in Sidebar / TitleBar / splash. The shape is intentionally
 * angular (cyber/instrument-panel feel) rather than rounded.
 *
 * The stroke is drawn as a path so the gradient applies cleanly across the
 * whole mark. `idSuffix` lets multiple instances coexist without colliding
 * `<defs>` IDs.
 */
export function BrandMark({ size = 32, className = "", idSuffix = "" }: BrandMarkProps) {
  const gradId = `brand-grad${idSuffix}`;
  const glowId = `brand-glow${idSuffix}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${APP_NAME} logo`}
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "var(--accent-cyan)" }} />
          <stop offset="100%" style={{ stopColor: "var(--accent-magenta)" }} />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Hexagon frame */}
      <polygon
        points="32,4 56,18 56,46 32,60 8,46 8,18"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="2.5"
        strokeLinejoin="round"
        filter={`url(#${glowId})`}
      />

      {/* "F" — left vertical + two horizontal arms */}
      <g
        stroke={`url(#${gradId})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter={`url(#${glowId})`}
      >
        <path d="M 20 18 L 20 46" />
        <path d="M 20 18 L 32 18" />
        <path d="M 20 31 L 30 31" />

        {/* "R" — right vertical, arch, diagonal leg */}
        <path d="M 36 46 L 36 18" />
        <path d="M 36 18 L 42 18 Q 47 18 47 24 Q 47 30 42 30 L 36 30" />
        <path d="M 41 30 L 47 46" />
      </g>
    </svg>
  );
}

/**
 * "FRESHRIG" wordmark. "FRESH" uses primary text color, "RIG" uses the
 * magenta accent — matches the reference identity. Letter-spacing is wide
 * for the "instrument panel" feel.
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
