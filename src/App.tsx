// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { useState, useEffect, useCallback, Suspense } from "react";
import { Toaster, toast } from "sonner";
import { ErrorBoundary } from "react-error-boundary";
import { useHotkeys } from "react-hotkeys-hook";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { MotionConfig, AnimatePresence, motion } from "framer-motion";
import { usePlatform } from "./hooks/usePlatform";
import type { DriftEntry } from "./types/privacyDrift";
import { AppLayout } from "./components/layout/AppLayout";
import { UpdateBanner } from "./components/layout/UpdateBanner";
import { Dashboard } from "./components/dashboard/Dashboard";
import { ErrorFallback } from "./components/ErrorFallback";
import { DelayedFallback } from "./components/ui/DelayedFallback";
// EAGER on purpose: these are first-launch / power-user surfaces. Lazy-
// loading them adds a perceptible spinner exactly when the user expects
// instant feel (Ctrl+K, first run, version-bump day).
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { CommandPalette } from "./components/ui/CommandPalette";
import { ShortcutHelp } from "./components/ui/ShortcutHelp";
import { useSettingsStore } from "./stores/settingsStore";
import { useUpdateStore } from "./stores/updateStore";
import { useLicenseStore } from "./stores/licenseStore";
import { APP_VERSION } from "./config/app";
import { isTauri, lazyNamed, preloadModule } from "./lib";

// Route-level code splitting. The Dashboard is eager (it's the default view
// and almost always the first thing the user sees); the secondary routes
// are lazy-loaded so the initial chunk only ships AppLayout + Dashboard +
// the eager modals + the stores. Heavy vendors (recharts, framer-motion,
// react-markdown, zxcvbn) split into their own chunks via vite.config.ts.
//
// Sidebar wires preload-on-hover for these via the same module specifiers,
// so chunk-load typically completes before the user clicks.
const DriversPage      = lazyNamed(() => import("./components/drivers/DriversPage"), "DriversPage");
const AppsPage         = lazyNamed(() => import("./components/apps/AppsPage"), "AppsPage");
const ProfilesPage     = lazyNamed(() => import("./components/profiles/ProfilesPage"), "ProfilesPage");
const OptimizePage     = lazyNamed(() => import("./components/optimize/OptimizePage"), "OptimizePage");
const StartupPage      = lazyNamed(() => import("./components/startup/StartupPage"), "StartupPage");
const CleanupPage      = lazyNamed(() => import("./components/cleanup/CleanupPage"), "CleanupPage");
const PrivacyPage      = lazyNamed(() => import("./components/privacy/PrivacyPage"), "PrivacyPage");
const NetworkPage      = lazyNamed(() => import("./components/network/NetworkPage"), "NetworkPage");
const ContextMenuPage  = lazyNamed(() => import("./components/context_menu/ContextMenuPage"), "ContextMenuPage");
const ServicesPage     = lazyNamed(() => import("./components/services/ServicesPage"), "ServicesPage");
const WatchdogPage     = lazyNamed(() => import("./components/watchdog/WatchdogPage"), "WatchdogPage");
const FleetDashboard   = lazyNamed(() => import("./components/fleet/FleetDashboard"), "FleetDashboard");
const ReportPage       = lazyNamed(() => import("./components/report/ReportPage"), "ReportPage");
const SettingsPage     = lazyNamed(() => import("./components/settings/SettingsPage"), "SettingsPage");
const AboutPage        = lazyNamed(() => import("./components/about/AboutPage"), "AboutPage");
// WhatsNewModal is lazy because it drags react-markdown (~100 KB). The
// "show" effect below preloads it concurrently with flipping the show flag,
// so the chunk is in the cache by the time React renders the modal.
const WhatsNewModal    = lazyNamed(() => import("./components/layout/WhatsNewModal"), "WhatsNewModal");

if (typeof performance !== "undefined" && performance.mark) {
  performance.mark("freshrig:app-module-evaluated");
}

function App() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { loadSettings, settings, setSetting, loaded } = useSettingsStore();

  const navigate = useCallback((view: string) => setCurrentView(view), []);

  // Keyboard shortcuts
  useHotkeys("ctrl+1", () => navigate("dashboard"), { preventDefault: true });
  useHotkeys("ctrl+2", () => navigate("drivers"), { preventDefault: true });
  useHotkeys("ctrl+3", () => navigate("apps"), { preventDefault: true });
  useHotkeys("ctrl+4", () => navigate("profiles"), { preventDefault: true });
  useHotkeys("ctrl+5", () => navigate("optimize"), { preventDefault: true });
  useHotkeys("ctrl+6", () => navigate("startup"), { preventDefault: true });
  useHotkeys("ctrl+7", () => navigate("cleanup"), { preventDefault: true });
  useHotkeys("ctrl+8", () => navigate("privacy"), { preventDefault: true });
  useHotkeys("ctrl+9", () => navigate("network"), { preventDefault: true });
  useHotkeys("ctrl+comma", () => navigate("settings"), { preventDefault: true });
  useHotkeys("ctrl+k", () => setShowCommandPalette((v) => !v), { preventDefault: true });
  useHotkeys("ctrl+shift+/", () => setShowShortcuts((v) => !v), { preventDefault: true });

  // Performance instrumentation — surface in DevTools → Performance →
  // User timing. Useful for verifying the chunking pass actually helps.
  useEffect(() => {
    if (typeof performance === "undefined" || !performance.mark) return;
    performance.mark("freshrig:app-mounted");
    try {
      performance.measure(
        "freshrig:cold-start",
        "freshrig:app-module-evaluated",
        "freshrig:app-mounted",
      );
    } catch {
      // First mount of the React tree may race with the module-eval mark
      // in dev (Vite hot-update); silently ignore.
    }
  }, []);

  // Load settings on startup
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Check for updates on startup (after a short delay)
  useEffect(() => {
    if (!settings.checkForUpdates) return;
    if (!isTauri()) return;
    const timer = setTimeout(() => {
      useUpdateStore.getState().checkForUpdates(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [settings.checkForUpdates]);

  // Background license revalidation — 6h interval, initial check after 5s.
  useEffect(() => {
    if (!isTauri()) return;
    const revalidate = () => useLicenseStore.getState().revalidate();
    const initial = setTimeout(revalidate, 5000);
    const interval = setInterval(revalidate, 6 * 60 * 60 * 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  // Privacy drift detection — Windows-only. Silent check ~6s after mount;
  // toast once per session if Windows has changed any monitored privacy
  // value since the user's baseline. Backend returns [] if no baseline
  // exists yet (first run), so this is genuinely silent until the user
  // captures one.
  const { isWindows } = usePlatform();
  useEffect(() => {
    if (!isWindows) return;
    if (!isTauri()) return;
    if (sessionStorage.getItem("freshrig.driftToastShown") === "1") return;
    const timer = setTimeout(async () => {
      try {
        const drift = await invoke<DriftEntry[]>("check_privacy_drift");
        if (drift.length === 0) return;
        sessionStorage.setItem("freshrig.driftToastShown", "1");
        toast(
          `${drift.length} privacy setting${drift.length === 1 ? "" : "s"} drifted from your baseline`,
          {
            description: "Windows changed values you previously locked down.",
            action: {
              label: "View",
              onClick: () => navigate("privacy"),
            },
          },
        );
      } catch {
        // Silent — drift check is non-critical and shouldn't surface errors.
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, [isWindows, navigate]);

  // Show "What's New" modal if version changed. Concurrently preload its
  // chunk so the modal renders without a Suspense flash.
  useEffect(() => {
    const { loaded } = useSettingsStore.getState();
    if (!loaded) return;
    if (settings.lastSeenVersion !== APP_VERSION) {
      preloadModule(() => import("./components/layout/WhatsNewModal"));
      setShowWhatsNew(true);
    }
  }, [settings.lastSeenVersion]);

  // Override window close → minimize to tray (only in Tauri)
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    const appWindow = getCurrentWindow();

    appWindow
      .onCloseRequested(async (event) => {
        if (cancelled) return;
        if (settings.minimizeToTray) {
          event.preventDefault();
          await appWindow.hide();
        }
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [settings.minimizeToTray]);

  const handleCloseWhatsNew = () => {
    setShowWhatsNew(false);
    setSetting("lastSeenVersion", APP_VERSION);
  };

  const handleCompleteOnboarding = useCallback(() => {
    setSetting("hasCompletedOnboarding", true);
  }, [setSetting]);

  // Suspense fallback for lazy routes. DelayedFallback prevents the spinner
  // from flashing for sub-120 ms loads (most loads, on local disk).
  const routeFallback = (
    <DelayedFallback>
      <div className="flex items-center justify-center p-8 text-text-muted text-sm">
        Loading…
      </div>
    </DelayedFallback>
  );

  return (
    <MotionConfig transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}>
      <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
        <UpdateBanner />
        <AppLayout currentView={currentView} onNavigate={navigate} onShowShortcuts={() => setShowShortcuts(true)}>
          <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
            {/* Suspense sits OUTSIDE AnimatePresence so the route transition
                animates the resolved component, not the spinner. */}
            <Suspense fallback={routeFallback}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentView}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {currentView === "dashboard" && <Dashboard onNavigate={navigate} />}
                  {currentView === "drivers" && <DriversPage />}
                  {currentView === "apps" && <AppsPage />}
                  {currentView === "profiles" && <ProfilesPage />}
                  {currentView === "optimize" && <OptimizePage />}
                  {currentView === "startup" && <StartupPage />}
                  {currentView === "cleanup" && <CleanupPage />}
                  {currentView === "privacy" && <PrivacyPage />}
                  {currentView === "network" && <NetworkPage />}
                  {currentView === "contextMenu" && <ContextMenuPage />}
                  {currentView === "services" && <ServicesPage />}
                  {currentView === "watchdog" && <WatchdogPage />}
                  {currentView === "fleet" && <FleetDashboard />}
                  {currentView === "report" && <ReportPage />}
                  {currentView === "settings" && <SettingsPage onNavigate={navigate} />}
                  {currentView === "about" && <AboutPage />}
                </motion.div>
              </AnimatePresence>
            </Suspense>
          </ErrorBoundary>
        </AppLayout>
        {/* Eager modals — no Suspense needed; rendered conditionally. */}
        {loaded && !settings.hasCompletedOnboarding && (
          <OnboardingWizard onComplete={handleCompleteOnboarding} />
        )}
        {showCommandPalette && (
          <CommandPalette
            onClose={() => setShowCommandPalette(false)}
            onNavigate={(v) => {
              navigate(v);
              setShowCommandPalette(false);
            }}
          />
        )}
        {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}
        {/* WhatsNewModal stays lazy (drags react-markdown). The show effect
            preloads it concurrently with flipping the flag, and DelayedFallback
            absorbs the residual flicker if the chunk is still in flight. */}
        <Suspense
          fallback={
            <DelayedFallback>
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/60 text-text-muted text-sm">
                Loading what's new…
              </div>
            </DelayedFallback>
          }
        >
          {showWhatsNew && <WhatsNewModal onClose={handleCloseWhatsNew} />}
        </Suspense>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--bg-elevated)",
              border: "1px solid var(--accent-cyan-rim)",
              color: "var(--text-primary)",
              boxShadow:
                "0 0 0 1px var(--accent-cyan-rim), 0 16px 32px rgba(0, 0, 0, 0.6), 0 0 24px -8px var(--accent-cyan-glow)",
            },
            className: "freshrig-toast",
          }}
        />
      </ErrorBoundary>
    </MotionConfig>
  );
}

export default App;
