// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import {
  LayoutDashboard,
  Cpu,
  Package,
  BookMarked,
  Sparkles,
  Rocket,
  Trash2,
  Shield,
  Globe,
  Menu,
  Cog,
  Eye,
  FileChartColumn,
  Server,
  Settings,
  Keyboard,
  Info,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { APP_VERSION } from "../../config/app";
import { BrandMark, BrandWordmark } from "../ui/BrandMark";
import { usePlatform } from "../../hooks/usePlatform";
import { useLicenseStore } from "../../stores/licenseStore";
import { preloadModule } from "../../lib";

// Preload-on-hover map. Each entry mirrors a `lazyNamed(...)` call in App.tsx
// so the chunk download starts as soon as the user signals intent (hover or
// keyboard focus). Dynamic imports dedupe — multiple hovers cost nothing.
//
// Keep this in sync with the lazy routes in App.tsx. If a key is missing,
// the click still works; the chunk just loads on demand instead of warmed.
const ROUTE_PRELOADERS: Record<string, () => Promise<unknown>> = {
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
  /** When true, item is hidden on non-Windows platforms. */
  windowsOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  /** When provided, the entire group is hidden unless the predicate passes. */
  visibleWhen?: (ctx: { isBusiness: boolean }) => boolean;
}

// Six functional groups, each capped at <=4 items so the working-memory load
// stays manageable. Tier badges signal Pro/Business gating up front so users
// don't hit a paywall by surprise. Keep IDs in sync with App.tsx routing.
const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "Ctrl+1" },
    ],
  },
  {
    label: "Setup",
    items: [
      { id: "drivers", label: "Drivers", icon: Cpu, shortcut: "Ctrl+2" },
      { id: "apps", label: "Apps", icon: Package, shortcut: "Ctrl+3" },
      { id: "profiles", label: "Profiles", icon: BookMarked, shortcut: "Ctrl+4", windowsOnly: true },
    ],
  },
  {
    label: "Tune-up",
    items: [
      { id: "optimize", label: "Optimize", icon: Sparkles, shortcut: "Ctrl+5", windowsOnly: true },
      { id: "startup", label: "Startup", icon: Rocket, shortcut: "Ctrl+6" },
      { id: "services", label: "Services", icon: Cog, tier: "pro" },
      { id: "contextMenu", label: "Context Menu", icon: Menu, tier: "pro", windowsOnly: true },
    ],
  },
  {
    label: "Maintain",
    items: [
      { id: "cleanup", label: "Cleanup", icon: Trash2, shortcut: "Ctrl+7", tier: "pro" },
      { id: "watchdog", label: "Watchdog", icon: Eye, tier: "pro" },
      { id: "report", label: "Health Report", icon: FileChartColumn, tier: "pro" },
    ],
  },
  {
    label: "Protect",
    items: [
      { id: "privacy", label: "Privacy", icon: Shield, shortcut: "Ctrl+8", tier: "pro" },
      { id: "network", label: "Network", icon: Globe, shortcut: "Ctrl+9", tier: "pro" },
    ],
  },
  {
    label: "Business",
    visibleWhen: ({ isBusiness }) => isBusiness,
    items: [
      { id: "fleet", label: "Fleet", icon: Server, tier: "business" },
    ],
  },
];

const secondaryNav: NavItem[] = [
  { id: "settings", label: "Settings", icon: Settings, shortcut: "Ctrl+," },
  { id: "about", label: "About", icon: Info },
];

export function Sidebar({ currentView, onNavigate, onShowShortcuts }: SidebarProps) {
  const { isWindows } = usePlatform();
  const isBusiness = useLicenseStore((s) => s.isBusiness());
  const isPro = useLicenseStore((s) => s.isPro());

  // Filter platform-specific items, drop empty groups, drop groups gated by
  // visibleWhen. Keeps the rendering loop simple and side-effect-free.
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !(item.windowsOnly && !isWindows)),
    }))
    .filter((group) => group.items.length > 0)
    .filter((group) => !group.visibleWhen || group.visibleWhen({ isBusiness }));

  return (
    <aside className="flex flex-col w-[260px] shrink-0 h-full bg-[var(--bg-sidebar)] border-r border-[var(--border)] overflow-y-auto">
      {/* Logo / app name */}
      <div className="flex items-center gap-3 px-5 py-5">
        <BrandMark size={32} />
        <div>
          <BrandWordmark className="text-[15px] leading-tight" />
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 tracking-[0.18em] uppercase">Setup any PC</p>
        </div>
      </div>

      {/* Primary navigation -- grouped by function */}
      <nav className="flex-1 px-3 pb-2">
        {visibleGroups.map((group) => (
          <NavSection
            key={group.label}
            label={group.label}
            items={group.items}
            currentView={currentView}
            onNavigate={onNavigate}
            isPro={isPro}
            isBusiness={isBusiness}
          />
        ))}
      </nav>

      {/* Secondary navigation */}
      <div className="px-3 pt-3 pb-3 border-t border-[var(--border)]">
        <NavSection
          label="More"
          items={secondaryNav}
          currentView={currentView}
          onNavigate={onNavigate}
          isPro={isPro}
          isBusiness={isBusiness}
        />
      </div>

      {/* Footer: version chip + shortcut helper */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
        <span className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">
          v{APP_VERSION}
        </span>
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
    </aside>
  );
}

function NavSection({
  label,
  items,
  currentView,
  onNavigate,
  isPro,
  isBusiness,
}: {
  label: string;
  items: NavItem[];
  currentView: string;
  onNavigate: (view: string) => void;
  isPro: boolean;
  isBusiness: boolean;
}) {
  return (
    <div className="space-y-1 mt-3 first:mt-1">
      <p className="text-[10.5px] uppercase tracking-[0.1em] font-semibold text-[var(--text-muted)] px-3 pt-1 pb-1.5">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => (
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
  // A tier is "owned" when the user already has access -- badge dims to imply
  // "you have this" instead of "buy this".
  const tierOwned =
    (item.tier === "pro" && isPro) || (item.tier === "business" && isBusiness);

  return (
    <li className="relative group">
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-full"
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
        className={`flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm transition-colors ${
          active
            ? "bg-[var(--accent-cyan-soft)] text-[var(--text-primary)] font-medium"
            : "text-[var(--text-secondary)] hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${active ? "text-[var(--accent)]" : ""}`} />
        <span className="truncate">{item.label}</span>

        {/* Right-aligned slot: tier badge (if any) wins over keyboard shortcut. */}
        <span className="ml-auto flex items-center gap-1.5">
          {item.tier === "pro" && (
            <TierBadge label="PRO" owned={tierOwned} variant="pro" />
          )}
          {item.tier === "business" && (
            <TierBadge label="BIZ" owned={tierOwned} variant="business" />
          )}
          {item.shortcut && !item.tier && (
            <span className="text-[10px] font-mono text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
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
