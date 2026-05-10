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
 * Geometry mirrors the master `src-tauri/icons/app-icon.svg` at 1/16 scale
 * (64-unit viewBox vs 1024). The master uses a three-layer hollow-tube
 * stack (gradient outer + dark cutout + white highlight) which only reads
 * at icon sizes (64 px+). At sidebar (32 px) and titlebar (14 px) sizes
 * the dark cutout would be sub-pixel and just muddy the silhouette, so
 * the in-app mark renders the simpler "single neon stroke + bloom"
 * variant — visually consistent with the icon at the sizes it ships at.
 *
 * `idSuffix` keeps `<defs>` IDs unique when multiple marks share a page.
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
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="b3" />
          <feFlood floodColor="#00e5ff" floodOpacity="0.65" result="cyan" />
          <feComposite in="cyan" in2="b3" operator="in" result="cyan-glow" />
          <feFlood floodColor="#ff2bd6" floodOpacity="0.65" result="mag" />
          <feComposite in="mag" in2="b2" operator="in" result="mag-glow" />
          <feMerge>
            <feMergeNode in="cyan-glow" />
            <feMergeNode in="mag-glow" />
            <feMergeNode in="b1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/*
          Shared FR letterforms — six paths reused by the layered <use>
          calls below. Geometry is the 1024-master glyph divided by 16.
          F  → italic vertical, top arm, mid arm.
          R  → italic vertical, bowl, diagonal leg.
        */}
        <g id={glyphId} fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* F */}
          <path d="M 15.75 14.375 L 14.375 48.125" />
          <path d="M 15.625 14.375 L 30 14.375" />
          <path d="M 15 31.875 L 23.75 31.875" />
          {/* R */}
          <path d="M 37.5 14.375 L 36.125 48.125" />
          <path d="M 37.375 14.375 L 45 14.375 C 53.125 14.375 53.125 31.875 45 31.875 L 37.1875 31.875" />
          <path d="M 41.125 31.875 L 54.25 48.125" />
        </g>
      </defs>

      {/* Single gradient stroke + bloom. The hollow-tube three-layer stack
          from the icon master collapses below ~40 px, so at sidebar /
          titlebar sizes a clean gradient FR with halo reads better. */}
      <g filter={`url(#${bloomId})`}>
        <use href={`#${glyphId}`} stroke={`url(#${gradId})`} strokeWidth="3" />
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
