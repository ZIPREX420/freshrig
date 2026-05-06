// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Delays rendering a Suspense fallback by `delayMs`. Chunks that resolve in
// under that window never paint the spinner, eliminating the perceptual
// flash on fast loads (which is most loads when chunks live on local disk).
//
// Default 120 ms — below the Doherty threshold for perceptual flicker;
// long enough that the majority of WebView2 / WebKit2GTK chunk parses
// finish before the spinner ever appears.

import { useEffect, useState } from "react";

interface DelayedFallbackProps {
  delayMs?: number;
  children: React.ReactNode;
}

export function DelayedFallback({ delayMs = 120, children }: DelayedFallbackProps) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  return show ? <>{children}</> : null;
}
