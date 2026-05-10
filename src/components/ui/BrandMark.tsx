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
 * Outlined "FR" monogram — neon hollow-tube look.
 *
 * Matches the master `src-tauri/icons/app-icon.svg` at 1/16 scale (64-unit
 * viewBox vs 1024). Cyan→violet→magenta gradient stroke wraps the
 * letterforms; a tighter dark stroke punches the inside, leaving a thin
 * ring; a bright highlight runs through the centre. A layered gaussian
 * bloom on the parent group adds the cyan + magenta halo.
 *
 * `idSuffix` lets multiple instances coexist without colliding `<defs>` IDs.
 * `size` is the rendered pixel square — at <= 16px the bloom collapses
 * visually and the mark degrades cleanly to a chunky gradient FR.
 */
export function BrandMark({ size = 32, className = "", idSuffix = "" }: BrandMarkProps) {
  const gradId = `fr-grad${idSuffix}`;
  const bloomId = `fr-bloom${idSuffix}`;
  const glyphId = `fr-glyph${idSuffix}`;
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
        <linearGradient
          id={gradId}
          x1="0"
          y1="0"
          x2="64"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" style={{ stopColor: "var(--accent-cyan)" }} />
          <stop offset="50%" stopColor="#9b6bff" />
          <stop offset="100%" style={{ stopColor: "var(--accent-magenta)" }} />
        </linearGradient>

        <filter id={bloomId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.3" result="b1" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.0" result="b2" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="b3" />
          <feFlood floodColor="#00e5ff" floodOpacity="0.5" result="cyan" />
          <feComposite in="cyan" in2="b3" operator="in" result="cyan-glow" />
          <feFlood floodColor="#ff2bd6" floodOpacity="0.5" result="mag" />
          <feComposite in="mag" in2="b2" operator="in" result="mag-glow" />
          <feMerge>
            <feMergeNode in="cyan-glow" />
            <feMergeNode in="mag-glow" />
            <feMergeNode in="b1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/*
          Shared FR letterforms — six paths reused by the three layered <use>
          calls below. Geometry mirrors the 1024-unit master glyph at 1/16:
          F  → vertical (slight italic), top arm, mid arm.
          R  → vertical (matching lean), bowl, diagonal leg.
        */}
        <g id={glyphId} fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* F */}
          <path d="M 16.25 15 L 15.31 47.5" />
          <path d="M 15.75 15 L 30 15" />
          <path d="M 15.5 31.875 L 26.56 31.875" />
          {/* R */}
          <path d="M 36.875 15 L 35.94 47.5" />
          <path d="M 36.375 15 L 45 15 C 52.75 15 52.75 31.875 45 31.875 L 37.81 31.875" />
          <path d="M 41.25 31.875 L 54.375 47.5" />
        </g>
      </defs>

      {/* Hollow neon tube: outer gradient + dark cutout + bright highlight + bloom */}
      <g filter={`url(#${bloomId})`}>
        <use href={`#${glyphId}`} stroke={`url(#${gradId})`} strokeWidth="3.875" />
        <use href={`#${glyphId}`} stroke="#0a0c14" strokeWidth="1.5" />
        <use href={`#${glyphId}`} stroke="#ffffff" strokeWidth="0.4" opacity="0.85" />
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
