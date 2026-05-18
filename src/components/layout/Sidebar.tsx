// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import {
  Home,
  Zap,
  Layers,
  BookMarked,
  Wrench,
  Server,
  Settings,
  Keyboard,
  Info,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { APP_VERSION } from "../../config/app";
import { BrandMark, BrandWordmark } from "../ui/BrandMark";
import { SidebarSystemCard } from "./SidebarSystemCard";
import { useHardwareStore } from "../../stores/hardwareStore";
import { useLicenseStore } from "../../stores/licenseStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { SUPPORTED_LOCALES } from "../../i18n";
import { preloadModule } from "../../lib";

// Preload-on-hover map. Each entry mirrors a `lazyNamed(...)` call in App.tsx
// so the chunk download starts as soon as the user signals intent (hover or
// keyboard focus). Dynamic imports dedupe — multiple hovers cost nothing.
//
// Keep this in sync with the lazy routes in App.tsx. If a key is missing,
// the click still works; the chunk just loads on demand instead of warmed.
const ROUTE_PRELOADERS: Record<string, () => Promise<unknown>> = {
  // Hub pages (new in v2.4)
  quickSetup:  () => import("../quick-setup/QuickSetupPage"),
  customSetup: () => import("../custom-setup/CustomSetupPage"),
  tools:       () => import("../tools/ToolsPage"),
  // Existing pages — still routable from the Tools hub or shortcuts
  drivers:     () => import("../drivers/DriversPage"),
  apps:        () => import("../apps/AppsPage"),
  profiles:    () => import("../profiles/ProfilesPage"),
  optimize:    () => import("../optimize/OptimizePage"),
  startup:     () => import("../startup/StartupPage"),
  cleanup:     () => import("../cleanup/CleanupPage"),
  privacy:     () => import("../privacy/PrivacyPage"),
  network:     () => import("../network/NetworkPage"),
  contextMenu: () => import("../context_menu/ContextMenuPage"),
  services:    () => import("../services/ServicesPage"),
  watchdog:    () => import("../watchdog/WatchdogPage"),
  fleet:       () => import("../fleet/FleetDashboard"),
  report:      () => import("../report/ReportPage"),
  settings:    () => import("../settings/SettingsPage"),
  about:       () => import("../about/AboutPage"),
};

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onShowShortcuts?: () => void;
}

type Tier = "pro" | "business";

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  /** When set, item shows a tier badge. Free items omit this field. */
  tier?: Tier;
  /** Hidden when isBusiness === false (sidebar-level filter). */
  businessOnly?: boolean;
}

// Hub-and-spoke nav. Each item is a top-level destination that either
// shows a hero hex page directly (Quick Setup, Custom Setup) or routes
// into a sub-hub (Tools). About / Changelog / Help / Upgrade all live
// inside Settings now.
const PRIMARY_NAV: NavItem[] = [
  { id: "dashboard",  label: "Home",         icon: Home,       shortcut: "Ctrl+1" },
  { id: "quickSetup",  label: "Quick setup",  icon: Zap,        shortcut: "Ctrl+2" },
  { id: "customSetup", label: "Custom setup", icon: Layers,     shortcut: "Ctrl+3" },
  { id: "profiles",   label: "Profiles",     icon: BookMarked, shortcut: "Ctrl+4" },
  { id: "tools",      label: "Tools",        icon: Wrench,     shortcut: "Ctrl+5" },
  { id: "fleet",      label: "Fleet",        icon: Server,     tier: "business", businessOnly: true },
];

const SECONDARY_NAV: NavItem[] = [
  { id: "settings", label: "Settings", icon: Settings, shortcut: "Ctrl+," },
  { id: "about",    label: "About",    icon: Info },
];

export function Sidebar({ currentView, onNavigate, onShowShortcuts }: SidebarProps) {
  const isBusiness = useLicenseStore((s) => s.isBusiness());
  const isPro = useLicenseStore((s) => s.isPro());

  const visiblePrimary = PRIMARY_NAV.filter(
    (item) => !item.businessOnly || isBusiness,
  );

  return (
    <aside className="flex flex-col w-[260px] shrink-0 h-full bg-[var(--bg-sidebar)] border-r border-[var(--border)] overflow-y-auto">
      {/* Logo / app name */}
      <div className="flex items-center gap-3 px-5 py-5">
        <BrandMark size={32} />
        <div>
          <BrandWordmark className="text-[15px] leading-tight" />
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 tracking-[0.18em] uppercase">PC setup, simplified</p>
        </div>
      </div>

      {/* Primary navigation -- flat list, no group headers (mockup style) */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {visiblePrimary.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={currentView === item.id}
              onSelect={() => onNavigate(item.id)}
              isPro={isPro}
              isBusiness={isBusiness}
            />
          ))}
        </ul>

        {/* Subtle divider before secondary nav */}
        <div className="mt-6 mb-3 h-px bg-[var(--border)]" />

        <ul className="space-y-1">
          {SECONDARY_NAV.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={currentView === item.id}
              onSelect={() => onNavigate(item.id)}
              isPro={isPro}
              isBusiness={isBusiness}
            />
          ))}
        </ul>
      </nav>

      {/* System status card — bottom slot per mockup. Expanded variant on
          the Home/Dashboard view (matches mockup-2 with full hardware specs);
          compact variant elsewhere to give nav more vertical room. */}
      <SidebarSystemCardConnected
        currentView={currentView}
        onDetailsClick={() => onNavigate("dashboard")}
      />

      {/* Footer: version chip + locale toggle + shortcut helper */}
      <SidebarFooter onShowShortcuts={onShowShortcuts} />
    </aside>
  );
}

function SidebarFooter({
  onShowShortcuts,
}: {
  onShowShortcuts?: () => void;
}) {
  const locale = useSettingsStore((s) => s.settings.locale);
  const setSetting = useSettingsStore((s) => s.setSetting);
  const cycleLocale = () => {
    const idx = SUPPORTED_LOCALES.findIndex((l) => l.id === locale);
    const next = SUPPORTED_LOCALES[(idx + 1) % SUPPORTED_LOCALES.length];
    setSetting("locale", next.id);
  };
  const current = SUPPORTED_LOCALES.find((l) => l.id === locale) ?? SUPPORTED_LOCALES[0];
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
      <span className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">
        v{APP_VERSION}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={cycleLocale}
          className="flex items-center gap-1 px-2 h-6 rounded-md text-[10px] uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors active:scale-[0.97]"
          title={`Language: ${current.label} (click to switch)`}
        >
          <span>{current.flag}</span>
          <span className="font-semibold">{current.id.toUpperCase()}</span>
        </button>
        {onShowShortcuts && (
          <button
            onClick={onShowShortcuts}
            className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors active:scale-[0.97] duration-100"
            title="Keyboard Shortcuts"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function NavButton({
  item,
  active,
  onSelect,
  isPro,
  isBusiness,
}: {
  item: NavItem;
  active: boolean;
  onSelect: () => void;
  isPro: boolean;
  isBusiness: boolean;
}) {
  const Icon = item.icon;
  const tierOwned =
    (item.tier === "pro" && isPro) || (item.tier === "business" && isBusiness);

  return (
    <li className="relative group">
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-[3px] rounded-full"
          style={{
            background: "var(--gradient-neon-edge)",
            boxShadow: "0 0 8px var(--accent-cyan-glow)",
          }}
        />
      )}
      <button
        onClick={onSelect}
        onMouseEnter={() => {
          const loader = ROUTE_PRELOADERS[item.id];
          if (loader) preloadModule(loader);
        }}
        onFocus={() => {
          const loader = ROUTE_PRELOADERS[item.id];
          if (loader) preloadModule(loader);
        }}
        onTouchStart={() => {
          const loader = ROUTE_PRELOADERS[item.id];
          if (loader) preloadModule(loader);
        }}
        className={`flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-[13px] uppercase tracking-[0.08em] font-semibold transition-colors ${
          active
            ? "bg-[var(--accent-cyan-soft)] text-[var(--text-primary)]"
            : "text-[var(--text-secondary)] hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${active ? "text-[var(--accent)]" : ""}`} />
        <span className="truncate">{item.label}</span>

        <span className="ml-auto flex items-center gap-1.5">
          {item.tier === "pro" && (
            <TierBadge label="PRO" owned={tierOwned} variant="pro" />
          )}
          {item.tier === "business" && (
            <TierBadge label="BIZ" owned={tierOwned} variant="business" />
          )}
          {item.shortcut && !item.tier && (
            <span className="text-[10px] font-mono text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity normal-case tracking-normal">
              {item.shortcut}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function TierBadge({
  label,
  owned,
  variant,
}: {
  label: string;
  owned: boolean;
  variant: "pro" | "business";
}) {
  const palette =
    variant === "pro"
      ? "bg-[var(--accent-cyan-soft)] text-[var(--accent-cyan)] ring-[var(--accent-cyan-rim)]"
      : "bg-[var(--accent-magenta-soft)] text-[var(--accent-magenta)] ring-[var(--accent-magenta-rim)]";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-[1px] rounded text-[9px] font-bold tracking-wider font-mono ring-1 ${palette} ${
        owned ? "opacity-50" : "opacity-100"
      }`}
      title={owned ? `${label} (active)` : `${label} feature`}
    >
      {label}
    </span>
  );
}

function SidebarSystemCardConnected({
  currentView,
  onDetailsClick,
}: {
  currentView: string;
  onDetailsClick: () => void;
}) {
  const summary = useHardwareStore((s) => s.summary);
  const driverIssues = useHardwareStore((s) => s.driverIssues);

  // On the home/dashboard view we render the expanded variant matching
  // mockup-2; everywhere else we use compact so the nav has room to breathe.
  const variant = currentView === "dashboard" ? "expanded" : "compact";

  // Health derives from driver-issue count: 0 = optimal, 1-2 = warning,
  // 3+ = critical. Mirrors the dashboard score thresholds at low cost.
  const health: "optimal" | "warning" | "critical" | "unknown" = !summary
    ? "unknown"
    : driverIssues.length === 0
    ? "optimal"
    : driverIssues.length <= 2
    ? "warning"
    : "critical";

  // Pull short forms of the spec fields for the expanded card. Trim aggressively
  // — the sidebar is 260px wide so anything past ~24 chars wraps awkwardly.
  const osName = summary
    ? `${summary.system.osVersion}${summary.system.osBuild ? " " + summary.system.osBuild : ""}`.slice(0, 28)
    : undefined;
  const cpu = summary?.cpu?.name?.slice(0, 28);
  const gpu = summary?.gpus?.[0]?.name?.slice(0, 28);
  const ram = summary ? `${Math.round(summary.system.totalRamGb)} GB` : undefined;

  return (
    <SidebarSystemCard
      variant={variant}
      health={health}
      lastScanLabel="Today"
      osName={osName}
      cpu={cpu}
      gpu={gpu}
      ram={ram}
      onDetailsClick={onDetailsClick}
    />
  );
}

