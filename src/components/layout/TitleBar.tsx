import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { BrandMark, BrandWordmark } from "../ui/BrandMark";
import { isTauri } from "../../lib";

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const appWindow = getCurrentWindow();
    appWindow.isMaximized().then((m) => {
      if (!cancelled) setMaximized(m);
    });

    appWindow
      .onResized(async () => {
        if (cancelled) return;
        setMaximized(await appWindow.isMaximized());
      })
      .then((fn) => {
        // If unmount happened during the await, detach immediately —
        // otherwise hold the reference for the cleanup function.
        if (cancelled) fn();
        else unlisten = fn;
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const handleMinimize = () => {
    if (!isTauri()) return;
    void getCurrentWindow().minimize();
  };
  const handleMaximize = () => {
    if (!isTauri()) return;
    void getCurrentWindow().toggleMaximize();
  };
  const handleClose = () => {
    if (!isTauri()) return;
    void getCurrentWindow().hide();
  };

  return (
    <div
      data-tauri-drag-region
      className="flex items-center h-8 bg-bg-secondary border-b border-border select-none shrink-0"
      onDoubleClick={handleMaximize}
    >
      {/* Left: App icon + wordmark */}
      <div className="flex items-center gap-2 px-3 pointer-events-none">
        <BrandMark size={14} idSuffix="-titlebar" />
        <BrandWordmark className="text-[11px]" />
      </div>

      {/* Spacer (draggable) */}
      <div data-tauri-drag-region className="flex-1" />

      {/* Right: Window controls */}
      <div className="flex h-full">
        <button
          onClick={handleMinimize}
          className="flex items-center justify-center w-11 h-full hover:bg-[var(--titlebar-btn-hover)] transition-colors"
          aria-label="Minimize"
        >
          <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" className="text-text-secondary" />
          </svg>
        </button>

        <button
          onClick={handleMaximize}
          className="flex items-center justify-center w-11 h-full hover:bg-[var(--titlebar-btn-hover)] transition-colors"
          aria-label={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? (
            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" className="text-text-secondary">
              <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" rx="0.5" />
              <rect x="0" y="2" width="8" height="8" fill="var(--bg-card)" stroke="currentColor" strokeWidth="1" rx="0.5" />
            </svg>
          ) : (
            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" className="text-text-secondary">
              <rect x="0" y="0" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1" rx="0.5" />
            </svg>
          )}
        </button>

        <button
          onClick={handleClose}
          className="flex items-center justify-center w-11 h-full hover:bg-[#c42b1c] transition-colors group"
          aria-label="Close"
        >
          <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1" className="text-text-secondary group-hover:text-white" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1" className="text-text-secondary group-hover:text-white" />
          </svg>
        </button>
      </div>
    </div>
  );
}
