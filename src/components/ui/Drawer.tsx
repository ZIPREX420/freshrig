// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional subtitle below the title. */
  subtitle?: string;
  /** Width tier — sm=360px, md=440px, lg=560px. Default md. */
  size?: "sm" | "md" | "lg";
  /** Optional status indicator next to the title (e.g., StatusPill). */
  status?: ReactNode;
  /** Optional actions row above the close button. */
  actions?: ReactNode;
  /** Footer slot (e.g., primary action button). */
  footer?: ReactNode;
  children: ReactNode;
}

const sizes = {
  sm: "w-[360px]",
  md: "w-[440px]",
  lg: "w-[560px]",
};

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  size = "md",
  status,
  actions,
  footer,
  children,
}: DrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    // Lock body scroll while open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      className="fixed inset-0 z-[90] flex justify-end"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-drawer-overlay-in"
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        className={`relative flex flex-col h-full bg-bg-elevated border-l border-border shadow-2xl animate-drawer-in ${sizes[size]}`}
      >
        <header className="flex items-start gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="drawer-title" className="text-base font-semibold text-text-primary leading-tight">{title}</h2>
              {status}
            </div>
            {subtitle && (
              <p className="text-xs text-text-secondary mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          {actions}
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close drawer"
            className="flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors active:scale-[0.97] duration-100"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {children}
        </div>
        {footer && (
          <footer className="px-5 py-3 border-t border-border shrink-0">{footer}</footer>
        )}
      </aside>
    </div>
  );
}
