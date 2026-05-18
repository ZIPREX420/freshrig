import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Cpu,
  Package,
  BookMarked,
  Sparkles,
  Rocket,
  Trash2,
  Settings,
  RefreshCw,
  ShieldAlert,
  Palette,
  RotateCcw,
  Zap,
  Gamepad2,
  Code,
  Shield,
  Globe,
  Menu,
  Cog,
  Camera,
  Server,
  Briefcase,
  Home,
  Layers,
  Wrench,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useAppStore } from "../../stores/appStore";
import { useUpdateStore } from "../../stores/updateStore";
import { useSettingsStore } from "../../stores/settingsStore";
import type { PresetProfile } from "../../types/presets";

interface CommandPaletteProps {
  onClose: () => void;
  onNavigate: (view: string) => void;
}

interface Command {
  id: string;
  label: string;
  category: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
}

const presetIcons: Record<string, React.ElementType> = {
  Zap,
  Gamepad2,
  Code,
  Shield,
  Palette: Palette,
  Briefcase,
};

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function CommandPalette({ onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [presets, setPresets] = useState<PresetProfile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const { catalog } = useAppStore();

  // Store previously focused element and focus input on mount; restore on unmount
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    invoke<PresetProfile[]>("get_presets")
      .then(setPresets)
      .catch(() => {});
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  const commands: Command[] = [
    // Pages — primary v2.4 hub-and-spoke nav (Ctrl+1–5)
    {
      id: "nav-dashboard",
      label: "Go to Home",
      category: "Pages",
      icon: Home,
      shortcut: "Ctrl+1",
      action: () => onNavigate("dashboard"),
    },
    {
      id: "nav-quick-setup",
      label: "Go to Quick Setup",
      category: "Pages",
      icon: Zap,
      shortcut: "Ctrl+2",
      action: () => onNavigate("quickSetup"),
    },
    {
      id: "nav-custom-setup",
      label: "Go to Custom Setup",
      category: "Pages",
      icon: Layers,
      shortcut: "Ctrl+3",
      action: () => onNavigate("customSetup"),
    },
    {
      id: "nav-profiles",
      label: "Go to Profiles",
      category: "Pages",
      icon: BookMarked,
      shortcut: "Ctrl+4",
      action: () => onNavigate("profiles"),
    },
    {
      id: "nav-tools",
      label: "Go to Tools",
      category: "Pages",
      icon: Wrench,
      shortcut: "Ctrl+5",
      action: () => onNavigate("tools"),
    },
    // Pages — individual tools, reachable via Tools hub or directly (Ctrl+6–9)
    {
      id: "nav-drivers",
      label: "Go to Drivers",
      category: "Pages",
      icon: Cpu,
      shortcut: "Ctrl+6",
      action: () => onNavigate("drivers"),
    },
    {
      id: "nav-apps",
      label: "Go to Apps",
      category: "Pages",
      icon: Package,
      shortcut: "Ctrl+7",
      action: () => onNavigate("apps"),
    },
    {
      id: "nav-optimize",
      label: "Go to Optimize",
      category: "Pages",
      icon: Sparkles,
      shortcut: "Ctrl+8",
      action: () => onNavigate("optimize"),
    },
    {
      id: "nav-cleanup",
      label: "Go to Cleanup",
      category: "Pages",
      icon: Trash2,
      shortcut: "Ctrl+9",
      action: () => onNavigate("cleanup"),
    },
    // Remaining tools (no Ctrl+N shortcut, still searchable from palette)
    {
      id: "nav-startup",
      label: "Go to Startup",
      category: "Pages",
      icon: Rocket,
      action: () => onNavigate("startup"),
    },
    {
      id: "nav-privacy",
      label: "Go to Privacy",
      category: "Pages",
      icon: Shield,
      action: () => onNavigate("privacy"),
    },
    {
      id: "nav-network",
      label: "Go to Network",
      category: "Pages",
      icon: Globe,
      action: () => onNavigate("network"),
    },
    {
      id: "nav-context-menu",
      label: "Go to Context Menu",
      category: "Pages",
      icon: Menu,
      action: () => onNavigate("contextMenu"),
    },
    {
      id: "nav-services",
      label: "Go to Services",
      category: "Pages",
      icon: Cog,
      action: () => onNavigate("services"),
    },
    {
      id: "nav-watchdog",
      label: "Go to Watchdog",
      category: "Pages",
      icon: Camera,
      action: () => onNavigate("watchdog"),
    },
    {
      id: "nav-fleet",
      label: "Go to Fleet (Pro Business)",
      category: "Pages",
      icon: Server,
      action: () => onNavigate("fleet"),
    },
    {
      id: "nav-settings",
      label: "Go to Settings",
      category: "Pages",
      icon: Settings,
      shortcut: "Ctrl+,",
      action: () => onNavigate("settings"),
    },
    // Actions
    {
      id: "action-check-updates",
      label: "Check for Updates",
      category: "Actions",
      icon: RefreshCw,
      action: () => {
        useUpdateStore.getState().checkForUpdates(false);
        toast.info("Checking for updates...");
      },
    },
    {
      id: "action-create-restore",
      label: "Create Restore Point",
      category: "Actions",
      icon: ShieldAlert,
      action: () => {
        invoke("create_restore_point")
          .then(() => toast.success("Restore point created"))
          .catch(() => toast.error("Failed to create restore point"));
      },
    },
    {
      id: "action-reset-settings",
      label: "Reset Settings",
      category: "Actions",
      icon: RotateCcw,
      action: () => {
        useSettingsStore.getState().resetSettings();
        toast.success("Settings reset to defaults");
      },
    },
    // Presets
    ...presets.map((p) => ({
      id: `preset-${p.id}`,
      label: `Apply ${p.name} Preset`,
      category: "Presets",
      icon: presetIcons[p.icon] ?? Zap,
      action: () => {
        const catalogIds = new Set(catalog.map((a) => a.id));
        const validIds = p.appIds.filter((id) => catalogIds.has(id));
        useAppStore.setState({ selectedIds: new Set(validIds) });
        toast.success(`Applied ${p.name} preset — ${validIds.length} apps selected`);
        onNavigate("apps");
      },
    })),
  ];

  const filtered = query
    ? commands.filter((c) => fuzzyMatch(query, c.label))
    : commands;

  // Group by category
  const groups: Record<string, Command[]> = {};
  for (const cmd of filtered) {
    if (!groups[cmd.category]) groups[cmd.category] = [];
    groups[cmd.category].push(cmd);
  }

  const flatFiltered = filtered;

  const executeCommand = useCallback(
    (cmd: Command) => {
      cmd.action();
      onClose();
    },
    [onClose]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (flatFiltered[activeIndex]) {
          executeCommand(flatFiltered[activeIndex]);
        }
      } else if (e.key === "Tab") {
        const container = overlayRef.current;
        if (!container) return;
        const focusable = container.querySelectorAll<HTMLElement>(
          'input, button, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, flatFiltered, activeIndex, executeCommand]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[90] flex items-start justify-center pt-[20vh] bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-bg-elevated border border-border rounded-xl shadow-elevated overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search aria-hidden="true" className="w-4 h-4 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-haspopup="listbox"
            aria-controls="cp-results"
            aria-autocomplete="list"
            aria-activedescendant={flatFiltered[activeIndex] ? `cp-option-${flatFiltered[activeIndex].id}` : undefined}
            aria-label="Search commands"
            type="text"
            placeholder="Search commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <kbd aria-label="Press Escape to close" className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted border border-border">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          id="cp-results"
          ref={listRef}
          role="listbox"
          aria-label="Commands"
          className="max-h-[300px] overflow-y-auto py-2"
        >
          {Object.entries(groups).map(([category, cmds]) => (
            <div key={category} role="group" aria-label={category}>
              <p aria-hidden="true" className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-4 py-1.5">
                {category}
              </p>
              {cmds.map((cmd) => {
                const globalIndex = flatFiltered.indexOf(cmd);
                const isActive = globalIndex === activeIndex;
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    id={`cp-option-${cmd.id}`}
                    role="option"
                    aria-selected={isActive}
                    data-index={globalIndex}
                    onClick={() => executeCommand(cmd)}
                    onMouseEnter={() => setActiveIndex(globalIndex)}
                    className={`flex items-center gap-3 w-full px-4 py-2 text-sm transition-colors ${
                      isActive ? "bg-accent-muted text-accent" : "text-text-secondary hover:bg-bg-tertiary"
                    }`}
                  >
                    <Icon aria-hidden="true" className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left">{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd aria-label={cmd.shortcut} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted border border-border">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <p role="status" className="text-sm text-text-muted text-center py-6">No commands found</p>
          )}
        </div>
      </div>
    </div>
  );
}
