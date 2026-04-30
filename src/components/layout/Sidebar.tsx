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
  Camera,
  Server,
  Settings,
  Monitor,
  Keyboard,
  Info,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { APP_NAME, APP_VERSION } from "../../config/app";
import { usePlatform } from "../../hooks/usePlatform";
import { useLicenseStore } from "../../stores/licenseStore";

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onShowShortcuts?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
}

const primaryNav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "Ctrl+1" },
  { id: "drivers", label: "Drivers", icon: Cpu, shortcut: "Ctrl+2" },
  { id: "apps", label: "Apps", icon: Package, shortcut: "Ctrl+3" },
  { id: "profiles", label: "Profiles", icon: BookMarked, shortcut: "Ctrl+4" },
  { id: "optimize", label: "Optimize", icon: Sparkles, shortcut: "Ctrl+5" },
  { id: "startup", label: "Startup", icon: Rocket, shortcut: "Ctrl+6" },
  { id: "cleanup", label: "Cleanup", icon: Trash2, shortcut: "Ctrl+7" },
  { id: "privacy", label: "Privacy", icon: Shield, shortcut: "Ctrl+8" },
  { id: "network", label: "Network", icon: Globe, shortcut: "Ctrl+9" },
  { id: "contextMenu", label: "Context Menu", icon: Menu },
  { id: "services", label: "Services", icon: Cog },
  { id: "watchdog", label: "Watchdog", icon: Camera },
  { id: "fleet", label: "Fleet", icon: Server },
];

const secondaryNav: NavItem[] = [
  { id: "settings", label: "Settings", icon: Settings, shortcut: "Ctrl+," },
  { id: "about", label: "About", icon: Info },
];

export function Sidebar({ currentView, onNavigate, onShowShortcuts }: SidebarProps) {
  // Optimize + Context Menu rely on Win32/WMI/shell extensions and Profiles
  // uses Windows-specific JSON profile storage — hide all three on every
  // non-Windows platform. Future platforms inherit the same hiding for free.
  // Fleet is gated to Pro Business and hidden entirely from Free/Pro.
  const { isWindows } = usePlatform();
  const isBusiness = useLicenseStore((s) => s.isBusiness());
  const WINDOWS_ONLY = new Set(["optimize", "contextMenu", "profiles"]);
  const BUSINESS_ONLY = new Set(["fleet"]);
  const visibleNav = primaryNav.filter((item) => {
    if (!isWindows && WINDOWS_ONLY.has(item.id)) return false;
    if (!isBusiness && BUSINESS_ONLY.has(item.id)) return false;
    return true;
  });

  return (
    <aside className="flex flex-col w-[260px] shrink-0 h-full bg-[var(--bg-sidebar)] border-r border-[var(--border)] overflow-y-auto">
      {/* Logo / App Name */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--accent-subtle)] ring-1 ring-[var(--accent-ring)]">
          <Monitor className="w-4.5 h-4.5 text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">{APP_NAME}</h1>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">System Setup Tool</p>
        </div>
      </div>

      {/* Primary navigation */}
      <nav className="flex-1 px-3">
        <NavSection label="Navigate" items={visibleNav} currentView={currentView} onNavigate={onNavigate} />
      </nav>

      {/* Secondary navigation */}
      <div className="px-3 pt-3 pb-3 border-t border-[var(--border)]">
        <NavSection label="More" items={secondaryNav} currentView={currentView} onNavigate={onNavigate} />
      </div>

      {/* Footer: version chip + shortcut helper */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
        <span className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">
          v{APP_VERSION}
        </span>
        {onShowShortcuts && (
          <button
            onClick={onShowShortcuts}
            className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors active:scale-[0.97] transition-transform duration-100"
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
}: {
  label: string;
  items: NavItem[];
  currentView: string;
  onNavigate: (view: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-[0.08em] font-medium text-[var(--text-muted)] px-3 pt-2 pb-1.5">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={currentView === item.id}
            onSelect={() => onNavigate(item.id)}
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
}: {
  item: NavItem;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = item.icon;
  return (
    <li className="relative group">
      {/* 3px left accent bar shown on active */}
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-[var(--accent)]"
        />
      )}
      <button
        onClick={onSelect}
        className={`flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm transition-colors ${
          active
            ? "bg-[var(--accent-subtle)] text-[var(--text-primary)] font-medium"
            : "text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]"
        }`}
      >
        <Icon className={`w-4 h-4 ${active ? "text-[var(--accent)]" : ""}`} />
        <span>{item.label}</span>
        {item.shortcut && (
          <span className="ml-auto text-[10px] font-mono text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
            {item.shortcut}
          </span>
        )}
      </button>
    </li>
  );
}
