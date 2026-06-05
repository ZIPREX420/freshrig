import { useCallback, useEffect, useMemo, useState } from "react";
import { errMessage } from "../../lib";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { toast } from "sonner";
import {
  Cog,
  Loader2,
  RefreshCw,
  Search,
  Lock,
  Zap,
  Shield,
  Gauge,
  AlertTriangle,
  Check,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "../ui/Card";
import { ProFeatureGate } from "../ui/ProFeatureGate";
import type {
  ServiceEntry,
  ServicePreset,
  ServicePresetResult,
  ServiceStartType,
  ServiceState,
} from "../../types/services";

type StartFilter = "all" | ServiceStartType;
type RunFilter = "all" | "running" | "stopped";

const presetMeta: Record<string, { icon: LucideIcon; tone: string }> = {
  gaming: {
    icon: Zap,
    tone: "text-[var(--accent)] bg-[var(--accent-subtle)] ring-[var(--accent-ring)]",
  },
  privacy: {
    icon: Shield,
    tone: "text-[var(--warning)] bg-[var(--warning)]/15 ring-[var(--warning)]/30",
  },
  performance: {
    icon: Gauge,
    tone: "text-emerald-400 bg-emerald-400/10 ring-emerald-400/30",
  },
};

export function ServicesPage() {
  return (
    <ProFeatureGate feature="services" mode="blur">
      <ServicesPageInner />
    </ProFeatureGate>
  );
}

function ServicesPageInner() {
  const [services, setServices] = useState<ServiceEntry[] | null>(null);
  const [presets, setPresets] = useState<ServicePreset[]>([]);
  const [loading, setLoading] = useState(true);

  const loadServices = useCallback(async () => {
    try {
      const list = await invoke<ServiceEntry[]>("get_services");
      setServices(list);
    } catch (e) {
      setServices([]);
      toast.error(errMessage(e, "Failed to load services"));
    }
  }, []);

  const loadPresets = useCallback(async () => {
    try {
      const list = await invoke<ServicePreset[]>("get_service_presets");
      setPresets(list);
    } catch {
      // Non-fatal — presets are purely additive.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([loadServices(), loadPresets()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadServices, loadPresets]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Services Manager</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Review every Windows service, toggle startup type, or apply a curated preset.
        </p>
      </header>

      <PresetCards presets={presets} onApplied={loadServices} />

      <ServicesTable
        services={services}
        loading={loading}
        onRefresh={loadServices}
        onMutate={(updated) =>
          setServices((prev) =>
            prev ? prev.map((s) => (s.name === updated.name ? updated : s)) : prev,
          )
        }
      />
    </div>
  );
}

// ───────── Preset cards ─────────

function PresetCards({
  presets,
  onApplied,
}: {
  presets: ServicePreset[];
  onApplied: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<ServicePreset | null>(null);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState<ServicePresetResult[]>([]);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    (async () => {
      try {
        unlisten = await listen<ServicePresetResult>("service-preset-progress", (event) => {
          setProgress((prev) => [...prev, event.payload]);
        });
      } catch {
        // listen unavailable outside Tauri — non-fatal
      }
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  const handleApply = useCallback(
    async (preset: ServicePreset) => {
      setApplying(true);
      setProgress([]);
      try {
        const results = await invoke<ServicePresetResult[]>("apply_service_preset", {
          presetId: preset.id,
        });
        const ok = results.filter((r) => r.success).length;
        const failed = results.length - ok;
        if (failed === 0) {
          toast.success(`${preset.name} preset applied — ${ok} services updated`);
        } else {
          toast.warning(
            `${preset.name} preset applied with warnings — ${ok} ok, ${failed} skipped`,
          );
        }
        await onApplied();
        setPreview(null);
      } catch (e) {
        toast.error(errMessage(e, "Failed to apply preset"));
      } finally {
        setApplying(false);
      }
    },
    [onApplied],
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {presets.length === 0
          ? [1, 2, 3].map((i) => (
              <Card key={i} className="p-5 opacity-40 animate-pulse">
                <div className="h-5 w-24 bg-white/[0.06] rounded mb-3" />
                <div className="h-3 w-full bg-white/[0.04] rounded mb-2" />
                <div className="h-3 w-3/4 bg-white/[0.04] rounded" />
              </Card>
            ))
          : presets.map((preset) => {
              const meta = presetMeta[preset.id] ?? { icon: Cog, tone: "text-[var(--text-muted)]" };
              const Icon = meta.icon;
              return (
                <Card
                  key={preset.id}
                  className="p-5 cursor-pointer hover:border-[var(--border-hover)]"
                  interactive
                  onClick={() => {
                    setProgress([]);
                    setPreview(preset);
                  }}
                >
                  <div
                    className={`w-10 h-10 rounded-lg ring-1 flex items-center justify-center mb-3 ${meta.tone}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
                    {preset.name}
                  </h3>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                    {preset.description}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-3">
                    Touches {preset.changes.length} service{preset.changes.length === 1 ? "" : "s"}
                  </p>
                </Card>
              );
            })}
      </div>

      {preview && (
        <PresetPreviewModal
          preset={preview}
          applying={applying}
          progress={progress}
          onClose={() => !applying && setPreview(null)}
          onConfirm={() => handleApply(preview)}
        />
      )}
    </>
  );
}

function PresetPreviewModal({
  preset,
  applying,
  progress,
  onClose,
  onConfirm,
}: {
  preset: ServicePreset;
  applying: boolean;
  progress: ServicePresetResult[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  const progressMap = useMemo(
    () => Object.fromEntries(progress.map((p) => [p.serviceName, p])),
    [progress],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--warning)]/15 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Apply {preset.name} preset?
              </h2>
              <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                A System Restore point will be created first. Protected services are skipped.
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-[var(--border)]">
          {preset.changes.map((change) => {
            const result = progressMap[change.serviceName];
            return (
              <div key={change.serviceName} className="py-2.5 flex items-start gap-3">
                <div className="w-5 h-5 shrink-0 mt-0.5">
                  {result ? (
                    result.success ? (
                      <Check className="w-5 h-5 text-[var(--success)]" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
                    )
                  ) : applying ? (
                    <Loader2 className="w-4 h-4 text-[var(--text-muted)] animate-spin" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-[var(--text-muted)] mt-1.5 ml-1.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[13px] text-[var(--text-primary)] truncate">
                      {change.serviceName}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                      → {change.targetStartType}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                    {result?.message ?? change.rationale}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={applying}
            className="px-3 py-1.5 rounded-md text-sm text-[var(--text-secondary)] hover:bg-white/[0.04] transition disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={applying}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--accent)] text-black text-sm font-medium hover:brightness-110 disabled:opacity-60 transition"
          >
            {applying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Applying…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Apply preset
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────── Services table ─────────

function ServicesTable({
  services,
  loading,
  onRefresh,
  onMutate,
}: {
  services: ServiceEntry[] | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onMutate: (updated: ServiceEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const [startFilter, setStartFilter] = useState<StartFilter>("all");
  const [runFilter, setRunFilter] = useState<RunFilter>("all");
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [resetting, setResetting] = useState(false);

  const handleChange = useCallback(
    async (entry: ServiceEntry, next: ServiceStartType) => {
      if (entry.isProtected) return;
      if (next === entry.startType) return;
      setPending((prev) => new Set(prev).add(entry.name));
      try {
        await invoke("set_service_start_type", {
          name: entry.name,
          startType: next,
        });
        onMutate({ ...entry, startType: next });
        toast.success(`${entry.displayName} → ${next}`);
      } catch (e) {
        toast.error(errMessage(e, "Failed to update service"));
      } finally {
        setPending((prev) => {
          const n = new Set(prev);
          n.delete(entry.name);
          return n;
        });
      }
    },
    [onMutate],
  );

  const handleReset = useCallback(async () => {
    if (!services) return;
    const confirmed = window.confirm(
      "Reset all non-protected services to Windows defaults (Manual)?\n\nA restore point is NOT created automatically — use the regular Windows System Restore UI if you need a rollback point first.",
    );
    if (!confirmed) return;
    setResetting(true);
    try {
      const targets = services.filter(
        (s) => !s.isProtected && s.startType !== "Manual",
      );
      let done = 0;
      for (const svc of targets) {
        try {
          await invoke("set_service_start_type", {
            name: svc.name,
            startType: "Manual",
          });
          done += 1;
        } catch {
          // Continue on individual failures.
        }
      }
      toast.success(`Reset ${done} services to Manual`);
      await onRefresh();
    } finally {
      setResetting(false);
    }
  }, [services, onRefresh]);

  const filtered = useMemo(() => {
    if (!services) return [];
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      if (startFilter !== "all" && s.startType !== startFilter) return false;
      if (runFilter === "running" && s.currentState !== "Running") return false;
      if (runFilter === "stopped" && s.currentState !== "Stopped") return false;
      if (q) {
        const hay = `${s.name} ${s.displayName} ${s.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [services, query, startFilter, runFilter]);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Cog className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">All services</h3>
          {services && (
            <span className="text-xs text-[var(--text-muted)]">
              {filtered.length} / {services.length}
            </span>
          )}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-md px-2.5 py-1">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name…"
            className="bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none w-56"
          />
        </div>
        <select
          value={startFilter}
          onChange={(e) => setStartFilter(e.target.value as StartFilter)}
          className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none"
        >
          <option value="all">All start types</option>
          <option value="Automatic">Automatic</option>
          <option value="AutoDelayed">Auto (delayed)</option>
          <option value="Manual">Manual</option>
          <option value="Disabled">Disabled</option>
        </select>
        <select
          value={runFilter}
          onChange={(e) => setRunFilter(e.target.value as RunFilter)}
          className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none"
        >
          <option value="all">Any status</option>
          <option value="running">Running</option>
          <option value="stopped">Stopped</option>
        </select>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition disabled:opacity-60"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={handleReset}
          disabled={!services || resetting}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition disabled:opacity-60"
          title="Reset all non-protected services to Manual"
        >
          {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
          Reset to defaults
        </button>
      </div>

      {loading && services === null ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Reading Win32_Service…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] text-center py-8">
          No services match the current filter.
        </p>
      ) : (
        <div className="overflow-hidden border border-[var(--border)] rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Service</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium w-[200px]">Start type</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((svc) => (
                <ServiceRow
                  key={svc.name}
                  entry={svc}
                  pending={pending.has(svc.name)}
                  onChange={(next) => handleChange(svc, next)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ServiceRow({
  entry,
  pending,
  onChange,
}: {
  entry: ServiceEntry;
  pending: boolean;
  onChange: (next: ServiceStartType) => void;
}) {
  return (
    <tr className="border-t border-[var(--border)] hover:bg-white/[0.02] align-top">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--text-primary)] truncate max-w-[320px]">
            {entry.displayName}
          </span>
          {entry.isProtected && (
            <span title="Protected — cannot be disabled">
              <Lock className="w-3 h-3 text-[var(--warning)]" />
            </span>
          )}
        </div>
        <div className="text-[10px] text-[var(--text-muted)] font-mono truncate max-w-[320px]">
          {entry.name}
        </div>
        {entry.description && (
          <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-snug truncate max-w-[320px]">
            {entry.description}
          </p>
        )}
      </td>
      <td className="px-3 py-2">
        <StateBadge state={entry.currentState} />
      </td>
      <td className="px-3 py-2">
        {entry.isProtected ? (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-[var(--border)] text-[var(--text-muted)] text-xs">
            <Lock className="w-3 h-3" />
            {entry.startType} · protected
          </div>
        ) : (
          <div className="relative inline-flex">
            <select
              value={entry.startType === "Unknown" ? "Manual" : entry.startType}
              disabled={pending}
              onChange={(e) => onChange(e.target.value as ServiceStartType)}
              className="appearance-none bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-md pl-2.5 pr-7 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
            >
              <option value="Automatic">Automatic</option>
              <option value="AutoDelayed">Auto (delayed)</option>
              <option value="Manual">Manual</option>
              <option value="Disabled">Disabled</option>
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
              {pending ? (
                <Loader2 className="w-3 h-3 animate-spin text-[var(--text-muted)]" />
              ) : (
                <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
              )}
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

function StateBadge({ state }: { state: ServiceState }) {
  const label: Record<ServiceState, string> = {
    Running: "Running",
    Stopped: "Stopped",
    StartPending: "Starting…",
    StopPending: "Stopping…",
    Unknown: "Unknown",
  };
  const tone: Record<ServiceState, string> = {
    Running: "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/20",
    Stopped: "bg-white/[0.04] text-[var(--text-muted)] border-[var(--border)]",
    StartPending: "bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent)]/20",
    StopPending: "bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/20",
    Unknown: "bg-white/[0.04] text-[var(--text-muted)] border-[var(--border)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${tone[state]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${state === "Running" ? "bg-[var(--success)]" : state === "Stopped" ? "bg-[var(--text-muted)]" : "bg-current"}`} />
      {label[state]}
    </span>
  );
}
