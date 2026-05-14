// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { APP_NAME } from "../../config/app";
import logoIcon from "../../assets/brand/logo.png";

export interface BrandMarkProps {
  /** Pixel size of the (square) mark. Height matches width -- the logo is 1:1. */
  size?: number;
  /** Optional className applied to the root <img>. */
  className?: string;
  /** Retained for backward compatibility. No longer used -- the mark used to be
   *  an inline SVG that needed unique gradient/filter IDs; it is now a raster
   *  asset, so call sites can drop this prop at their leisure. */
  idSuffix?: string;
  /** Retained for backward compatibility. No longer used -- the logo carries its
   *  own framed background, so there is no hollow-tube cutout to colour-match. */
  surfaceColor?: string;
}

/**
 * FreshRig brand mark -- the neon "FR" app logo.
 *
 * Renders the official logo asset (`src/assets/brand/logo.png`): the framed
 * rounded-tile neon "FR" monogram with transparent corners. This is the single
 * source of truth for the in-app logo -- the very same artwork backs the
 * desktop app icons in `src-tauri/icons/` (regenerated from the raster brand
 * master `brand/logo-icon.png` via `npx @tauri-apps/cli icon brand/logo-icon.png`)
 * and the landing page in `site/`.
 *
 * Square 1:1 aspect. Used across the title bar, sidebar and splash screen --
 * pair with `<BrandWordmark>` for the full "FRESHRIG" lockup.
 */
export function BrandMark({ size = 64, className = "" }: BrandMarkProps) {
  return (
    <img
      src={logoIcon}
      width={size}
      height={size}
      alt={`${APP_NAME} logo`}
      draggable={false}
      className={`select-none shrink-0 ${className}`}
    />
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
