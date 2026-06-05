import { useCallback, useEffect, useMemo, useState } from "react";
import { errMessage } from "../../lib";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  Rocket,
  Search,
  RefreshCw,
  Lock,
  Folder,
  TerminalSquare,
  RotateCcw,
  Loader2,
  CheckCircle2,
  MinusCircle,
} from "lucide-react";
import { Card } from "../ui/Card";
import type {
  StartupEntry,
  StartupSource,
  StartupScope,
  StartupImpact,
} from "../../types/startup";

const PROTECTED_NAMES = ["securityhealth", "windows defender", "explorer"];

function isProtected(name: string): boolean {
  const lower = name.toLowerCase();
  return PROTECTED_NAMES.some((p) => lower.includes(p));
}

const sourceMeta: Record<
  StartupSource,
  { label: string; icon: React.ElementType; tone: string }
> = {
  RegistryRun: {
    label: "Registry",
    icon: TerminalSquare,
    tone: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  },
  RegistryRunOnce: {
    label: "Run Once",
    icon: RotateCcw,
    tone: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  },
  StartupFolder: {
    label: "Folder",
    icon: Folder,
    tone: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  },
  TaskScheduler: {
    label: "Task",
    icon: RefreshCw,
    tone: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  },
};

const scopeLabels: Record<StartupScope, string> = {
  CurrentUser: "User",
  AllUsers: "Machine",
};

const impactMeta: Record<StartupImpact, { label: string; tone: string }> = {
  High: {
    label: "High",
    tone: "bg-[var(--error)]/15 text-[var(--error)] border-[var(--error)]/20",
  },
  Medium: {
    label: "Medium",
    tone: "bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/20",
  },
  Low: {
    label: "Low",
    tone: "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/20",
  },
  NotMeasured: {
    label: "—",
    tone: "bg-white/[0.04] text-[var(--text-muted)] border-[var(--border)]",
  },
};

function displayName(name: string): string {
  return name
    .replace(/\.lnk$/i, "")
    .replace(/\.exe$/i, "")
    .replace(/\.bat$/i, "");
}

type StatusFilter = "all" | "enabled" | "disabled";

export function StartupPage() {
  const [entries, setEntries] = useState<StartupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<StartupEntry[]>("get_startup_entries");
      setEntries(result);
    } catch (e) {
      setError(errMessage(e, "Failed to load startup entries"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const toggle = useCallback(
    async (entry: StartupEntry, next: boolean) => {
      if (isProtected(entry.name)) {
        toast.error(`${displayName(entry.name)} is protected and cannot be toggled`);
        return;
      }
      setTogglingId(entry.id);
      // Optimistic update
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, enabled: next } : e)),
      );
      try {
        await invoke("toggle_startup_entry", {
          id: entry.id,
          name: entry.name,
          enabled: next,
        });
        toast.success(
          `${displayName(entry.name)} ${next ? "enabled" : "disabled"} at startup`,
        );
      } catch (e) {
        // Rollback
        setEntries((prev) =>
          prev.map((x) => (x.id === entry.id ? { ...x, enabled: !next } : x)),
        );
        toast.error(errMessage(e, "Failed to toggle entry"));
      } finally {
        setTogglingId(null);
      }
    },
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => {
        if (statusFilter === "enabled" && !e.enabled) return false;
        if (statusFilter === "disabled" && e.enabled) return false;
        if (!q) return true;
        return (
          e.name.toLowerCase().includes(q) ||
          e.command.toLowerCase().includes(q) ||
          (e.publisher?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => {
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
        return displayName(a.name).localeCompare(displayName(b.name), undefined, {
          sensitivity: "base",
        });
      });
  }, [entries, query, statusFilter]);

  const enabledCount = entries.filter((e) => e.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Startup Manager</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Control which programs run when Windows starts
          </p>
        </div>
        <button
          onClick={fetchEntries}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] text-xs font-medium hover:bg-white/[0.04] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors active:scale-[0.97] transition-transform duration-100 disabled:opacity-60"
          title="Rescan"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Rescan
        </button>
      </div>

      {/* Stat strip */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatChip
            icon={Rocket}
            label="Total Entries"
            value={entries.length.toString()}
          />
          <StatChip
            icon={CheckCircle2}
            label="Enabled"
            value={enabledCount.toString()}
            accent
          />
          <StatChip
            icon={MinusCircle}
            label="Disabled"
            value={(entries.length - enabledCount).toString()}
          />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, command, or publisher..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-ring)] transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
          {(["all", "enabled", "disabled"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                statusFilter === f
                  ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchEntries} />
      ) : filtered.length === 0 ? (
        <EmptyState hasQuery={query.length > 0 || statusFilter !== "all"} />
      ) : (
        <motion.ul
          className="space-y-2"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.02 } },
          }}
        >
          <AnimatePresence initial={false}>
            {filtered.map((entry) => (
              <motion.li
                key={entry.id}
                layout
                variants={{
                  hidden: { opacity: 0, y: 4 },
                  visible: { opacity: 1, y: 0 },
                }}
                exit={{ opacity: 0 }}
              >
                <StartupRow
                  entry={entry}
                  toggling={togglingId === entry.id}
                  onToggle={(next) => toggle(entry, next)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card className="px-4 py-3 flex items-center gap-3">
      <div
        className={`flex items-center justify-center w-9 h-9 rounded-lg ${
          accent ? "bg-[var(--accent-subtle)]" : "bg-white/[0.04]"
        }`}
      >
        <Icon
          className={`w-4 h-4 ${
            accent ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
          }`}
        />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
          {label}
        </p>
        <p className="text-lg font-semibold tabular-nums text-[var(--text-primary)]">
          {value}
        </p>
      </div>
    </Card>
  );
}

function StartupRow({
  entry,
  toggling,
  onToggle,
}: {
  entry: StartupEntry;
  toggling: boolean;
  onToggle: (next: boolean) => void;
}) {
  const source = sourceMeta[entry.source];
  const impact = impactMeta[entry.impact];
  const protectedEntry = isProtected(entry.name);
  const SourceIcon = source.icon;

  return (
    <Card
      interactive
      className={`px-4 py-3 flex items-center gap-4 ${
        !entry.enabled ? "opacity-70" : ""
      }`}
    >
      {/* Source icon */}
      <div
        className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border ${source.tone}`}
        title={source.label}
      >
        <SourceIcon className="w-4 h-4" />
      </div>

      {/* Name + command */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {displayName(entry.name)}
          </span>
          {protectedEntry && (
            <span
              className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/[0.04] text-[var(--text-muted)] border border-[var(--border)]"
              title="Protected system component"
            >
              <Lock className="w-2.5 h-2.5" />
              Protected
            </span>
          )}
        </div>
        <p
          className="text-[11px] text-[var(--text-muted)] truncate font-mono mt-0.5"
          title={entry.command}
        >
          {entry.command}
        </p>
      </div>

      {/* Badges */}
      <div className="hidden md:flex items-center gap-1.5 shrink-0">
        <Badge tone="muted">{scopeLabels[entry.scope]}</Badge>
        <Badge tone={source.tone} borderless>
          {source.label}
        </Badge>
        <Badge tone={impact.tone} borderless>
          {impact.label}
        </Badge>
      </div>

      {/* Toggle */}
      <div className="shrink-0">
        <ToggleSwitch
          enabled={entry.enabled}
          disabled={protectedEntry || toggling}
          toggling={toggling}
          onToggle={onToggle}
          label={`${entry.enabled ? "Disable" : "Enable"} ${displayName(entry.name)}`}
        />
      </div>
    </Card>
  );
}

function Badge({
  children,
  tone,
  borderless,
}: {
  children: React.ReactNode;
  tone: string;
  borderless?: boolean;
}) {
  const cls = tone === "muted"
    ? "bg-white/[0.04] text-[var(--text-muted)] border border-[var(--border)]"
    : `${tone}${borderless ? "" : " border"}`;
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}
    >
      {children}
    </span>
  );
}

function ToggleSwitch({
  enabled,
  disabled,
  toggling,
  onToggle,
  label,
}: {
  enabled: boolean;
  disabled?: boolean;
  toggling?: boolean;
  onToggle: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={disabled}
      onClick={() => onToggle(!enabled)}
      className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] ${
        enabled
          ? "bg-[var(--accent)]"
          : "bg-white/[0.1]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block w-4 h-4 rounded-full bg-white shadow transform transition-transform duration-150 ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
      {toggling && (
        <Loader2 className="absolute inset-0 m-auto w-3 h-3 text-white animate-spin" />
      )}
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-[68px] rounded-xl bg-[var(--bg-card)] border border-[var(--border)] animate-pulse"
        />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
      <div className="w-14 h-14 rounded-full bg-[var(--error)]/10 flex items-center justify-center mb-4">
        <span className="text-[var(--error)] text-xl">!</span>
      </div>
      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
        Failed to load startup entries
      </h3>
      <p className="text-sm text-[var(--text-secondary)] max-w-md text-center mb-4">
        {message}
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-md bg-[var(--accent)] text-black text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors active:scale-[0.97] transition-transform duration-100"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
        <Rocket className="w-6 h-6 text-[var(--text-muted)]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
        {hasQuery ? "No entries match your filters" : "No startup entries detected"}
      </h3>
      <p className="text-sm text-[var(--text-secondary)] max-w-md">
        {hasQuery
          ? "Try clearing the search or changing the status filter."
          : "Nothing is configured to launch when Windows starts."}
      </p>
    </div>
  );
}
