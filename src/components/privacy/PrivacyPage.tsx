import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errMessage, api } from "../../lib";
import { motion, AnimatePresence } from "framer-motion";
import { load, type Store } from "@tauri-apps/plugin-store";
import { toast } from "sonner";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Eye,
  Activity,
  Sparkles,
  Search,
  BellOff,
  BadgeCheck,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Camera,
  Mic,
  MapPin,
  Users,
  FolderOpen,
  Clock,
  Circle,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "../ui/Card";
import { ProFeatureGate } from "../ui/ProFeatureGate";
import { PrivacyDriftPanel } from "./PrivacyDriftPanel";
import type {
  AppPermission,
  PrivacyCategory,
  PrivacyRisk,
  PrivacySetting,
} from "../../types/privacy";

type Tab = "settings" | "permissions" | "audit" | "drift";

const categoryOrder: PrivacyCategory[] = [
  "Telemetry",
  "Advertising",
  "Activity",
  "AiCopilot",
  "Search",
  "Suggestions",
  "Permissions",
];

const categoryMeta: Record<
  PrivacyCategory,
  { label: string; icon: LucideIcon; blurb: string }
> = {
  Telemetry: {
    label: "Telemetry",
    icon: Eye,
    blurb: "Data sent to Microsoft about how you use Windows.",
  },
  Advertising: {
    label: "Advertising",
    icon: Sparkles,
    blurb: "Personalized ads and suggested content.",
  },
  Activity: {
    label: "Activity History",
    icon: Activity,
    blurb: "Timeline, clipboard, and app-launch tracking.",
  },
  AiCopilot: {
    label: "AI & Copilot",
    icon: BadgeCheck,
    blurb: "Windows Recall and Copilot assistants.",
  },
  Search: {
    label: "Search",
    icon: Search,
    blurb: "Bing and web results in the Start search box.",
  },
  Suggestions: {
    label: "Suggestions & Tips",
    icon: BellOff,
    blurb: "Start menu suggestions and notification nags.",
  },
  Permissions: {
    label: "App Permissions",
    icon: Lock,
    blurb: "Per-app access to sensors and data.",
  },
};

const riskMeta: Record<
  PrivacyRisk,
  { label: string; tone: string; dot: string }
> = {
  Recommended: {
    label: "Recommended",
    tone: "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/20",
    dot: "bg-[var(--success)]",
  },
  Limited: {
    label: "Limited",
    tone: "bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/20",
    dot: "bg-[var(--warning)]",
  },
  Advanced: {
    label: "Advanced",
    tone: "bg-[var(--error)]/15 text-[var(--error)] border-[var(--error)]/20",
    dot: "bg-[var(--error)]",
  },
};

const capabilityMeta: Record<string, { label: string; icon: LucideIcon }> = {
  webcam: { label: "Camera", icon: Camera },
  microphone: { label: "Microphone", icon: Mic },
  location: { label: "Location", icon: MapPin },
  contacts: { label: "Contacts", icon: Users },
  broadFileSystemAccess: { label: "File System", icon: FolderOpen },
  activity: { label: "Activity", icon: Activity },
};

function humanizeRelative(iso: string | null): string {
  if (!iso) return "Never";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "Unknown";
  const diff = Date.now() - then;
  if (diff < 0) return "Just now";
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function PrivacyPage() {
  return (
    <ProFeatureGate feature="privacy" mode="blur">
      <PrivacyPageInner />
    </ProFeatureGate>
  );
}

function PrivacyPageInner() {
  const [tab, setTab] = useState<Tab>("settings");

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Privacy Dashboard</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Lock down Windows telemetry, advertising, and per-app permissions
          </p>
        </div>
      </header>

      <TabBar tab={tab} onChange={setTab} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {tab === "settings" && <SettingsTab />}
          {tab === "permissions" && <PermissionsTab />}
          {tab === "audit" && <AuditTab />}
          {tab === "drift" && <PrivacyDriftPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "settings", label: "Settings", icon: Shield },
    { id: "permissions", label: "App Permissions", icon: Lock },
    { id: "audit", label: "Quick Audit", icon: BadgeCheck },
    { id: "drift", label: "Drift Detection", icon: ShieldAlert },
  ];
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active
                ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]"
            }`}
          >
            <Icon className="w-4 h-4" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ───────── Settings tab ─────────

function SettingsTab() {
  const [settings, setSettings] = useState<PrivacySetting[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [desired, setDesired] = useState<Record<string, boolean>>({});
  const storeRef = useRef<Store | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const list = await api.getPrivacySettings();
      setSettings(list);
    } catch (e) {
      toast.error(errMessage(e, "Failed to load privacy settings"));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const store = await load("privacy.json", { autoSave: true, defaults: {} });
        if (cancelled) return;
        storeRef.current = store;
        const stored = ((await store.get<Record<string, boolean>>("desired")) ?? {}) as Record<
          string,
          boolean
        >;
        if (!cancelled) setDesired(stored);
      } catch {
        // Store unavailable outside Tauri runtime — non-fatal.
      }
      await fetchSettings();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchSettings]);

  const handleToggle = useCallback(
    async (setting: PrivacySetting) => {
      const next = !setting.currentValue;
      setPendingIds((prev) => new Set(prev).add(setting.id));
      try {
        await api.applyPrivacySetting({
          settingId: setting.id,
          enablePrivacy: next,
        });
        if (storeRef.current) {
          const updated = { ...desired, [setting.id]: next };
          setDesired(updated);
          await storeRef.current.set("desired", updated);
        }
        toast.success(`${setting.name} — ${next ? "enabled" : "disabled"}`);
        await fetchSettings();
      } catch (e) {
        toast.error(errMessage(e, "Failed to apply setting"));
      } finally {
        setPendingIds((prev) => {
          const next2 = new Set(prev);
          next2.delete(setting.id);
          return next2;
        });
      }
    },
    [desired, fetchSettings],
  );

  if (loading || !settings) {
    return <LoadingCard label="Reading current privacy state…" />;
  }

  const grouped = groupByCategory(settings);

  return (
    <div className="space-y-4">
      {categoryOrder
        .filter((cat) => grouped[cat] && grouped[cat].length > 0)
        .map((cat) => {
          const meta = categoryMeta[cat];
          const Icon = meta.icon;
          const items = grouped[cat];
          return (
            <Card key={cat} className="overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-card)]">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--accent-subtle)]">
                  <Icon className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{meta.label}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{meta.blurb}</p>
                </div>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {items.map((s) => (
                  <SettingRow
                    key={s.id}
                    setting={s}
                    pending={pendingIds.has(s.id)}
                    drifted={
                      desired[s.id] !== undefined && desired[s.id] !== s.currentValue
                    }
                    onToggle={() => handleToggle(s)}
                  />
                ))}
              </ul>
            </Card>
          );
        })}
    </div>
  );
}

function SettingRow({
  setting,
  pending,
  drifted,
  onToggle,
}: {
  setting: PrivacySetting;
  pending: boolean;
  drifted: boolean;
  onToggle: () => void;
}) {
  const risk = riskMeta[setting.risk];
  return (
    <li className="flex items-center gap-4 px-5 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[var(--text-primary)]">{setting.name}</span>
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${risk.tone}`}
          >
            {risk.label}
          </span>
          {drifted && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--warning)] bg-[var(--warning)]/10 border border-[var(--warning)]/20 px-1.5 py-0.5 rounded">
              <AlertTriangle className="w-3 h-3" />
              Drift detected
            </span>
          )}
        </div>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{setting.description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        aria-label={`Toggle ${setting.name}`}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          setting.currentValue ? "bg-[var(--accent)]" : "bg-white/[0.1]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            setting.currentValue ? "translate-x-6" : "translate-x-1"
          }`}
        />
        {pending && (
          <Loader2 className="absolute inset-0 m-auto w-3 h-3 text-white animate-spin" />
        )}
      </button>
    </li>
  );
}

function groupByCategory(list: PrivacySetting[]): Record<PrivacyCategory, PrivacySetting[]> {
  const out = {} as Record<PrivacyCategory, PrivacySetting[]>;
  for (const s of list) {
    if (!out[s.category]) out[s.category] = [];
    out[s.category].push(s);
  }
  return out;
}

// ───────── Permissions tab ─────────

function PermissionsTab() {
  const [permissions, setPermissions] = useState<AppPermission[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [capabilityFilter, setCapabilityFilter] = useState<string>("all");

  const fetchPermissions = useCallback(async () => {
    try {
      const list = await api.getAppPermissions();
      setPermissions(list);
    } catch (e) {
      toast.error(errMessage(e, "Failed to load app permissions"));
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchPermissions();
      setLoading(false);
    })();
  }, [fetchPermissions]);

  const handleRevoke = useCallback(
    async (perm: AppPermission) => {
      const key = `${perm.capability}::${perm.appPath ?? perm.appName}`;
      setRevoking(key);
      try {
        // Backend matches on raw subkey name — for non-packaged apps that's the `#`-encoded path,
        // reconstructed below. Packaged apps use the raw name.
        const appKey = perm.appPath
          ? perm.appPath.replace(/\\/g, "#")
          : perm.appName;
        await api.revokeAppPermission({
          appKey,
          capability: perm.capability,
        });
        toast.success(`Revoked ${capabilityMeta[perm.capability]?.label ?? perm.capability} for ${perm.appName}`);
        await fetchPermissions();
      } catch (e) {
        toast.error(errMessage(e, "Failed to revoke permission"));
      } finally {
        setRevoking(null);
      }
    },
    [fetchPermissions],
  );

  if (loading || !permissions) {
    return <LoadingCard label="Scanning app permissions…" />;
  }

  const capabilities = Array.from(new Set(permissions.map((p) => p.capability)));
  const filtered = permissions.filter(
    (p) => capabilityFilter === "all" || p.capability === capabilityFilter,
  );
  const sorted = [...filtered].sort((a, b) => {
    if (a.isActiveNow !== b.isActiveNow) return a.isActiveNow ? -1 : 1;
    if (a.allowed !== b.allowed) return a.allowed ? -1 : 1;
    const at = a.lastUsed ? Date.parse(a.lastUsed) : 0;
    const bt = b.lastUsed ? Date.parse(b.lastUsed) : 0;
    return bt - at;
  });

  const activeCount = permissions.filter((p) => p.isActiveNow).length;

  return (
    <div className="space-y-4">
      {activeCount > 0 && (
        <Card className="px-5 py-3 flex items-center gap-3 border-[var(--error)]/40 bg-[var(--error)]/5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--error)] opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--error)]" />
          </span>
          <p className="text-sm text-[var(--text-primary)]">
            <span className="font-semibold text-[var(--error)]">{activeCount}</span>{" "}
            {activeCount === 1 ? "app is" : "apps are"} using a sensor right now
          </p>
        </Card>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <FilterChip
          label="All"
          active={capabilityFilter === "all"}
          onClick={() => setCapabilityFilter("all")}
        />
        {capabilities.map((cap) => (
          <FilterChip
            key={cap}
            label={capabilityMeta[cap]?.label ?? cap}
            icon={capabilityMeta[cap]?.icon}
            active={capabilityFilter === cap}
            onClick={() => setCapabilityFilter(cap)}
          />
        ))}
      </div>

      {sorted.length === 0 ? (
        <Card className="px-6 py-10 text-center">
          <p className="text-sm text-[var(--text-secondary)]">No apps have requested this capability.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_140px_110px_110px_100px] gap-4 px-5 py-2.5 border-b border-[var(--border)] bg-[var(--bg-card)] text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
            <span>App</span>
            <span>Capability</span>
            <span>Access</span>
            <span>Last Used</span>
            <span className="text-right">Action</span>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {sorted.map((p, i) => {
              const capMeta = capabilityMeta[p.capability];
              const CapIcon = capMeta?.icon ?? Circle;
              const key = `${p.capability}::${p.appPath ?? p.appName}::${i}`;
              const revokeKey = `${p.capability}::${p.appPath ?? p.appName}`;
              return (
                <li
                  key={key}
                  className="grid grid-cols-1 md:grid-cols-[1fr_140px_110px_110px_100px] gap-4 items-center px-5 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {p.appName}
                      </span>
                      {p.isActiveNow && (
                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-white bg-[var(--error)] px-1.5 py-0.5 rounded animate-pulse">
                          <Circle className="w-2 h-2 fill-current" />
                          Active Now
                        </span>
                      )}
                    </div>
                    {p.appPath && (
                      <p
                        className="text-[10px] font-mono text-[var(--text-muted)] truncate mt-0.5"
                        title={p.appPath}
                      >
                        {p.appPath}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                    <CapIcon className="w-3.5 h-3.5" />
                    {capMeta?.label ?? p.capability}
                  </div>
                  <div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                        p.allowed
                          ? "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/20"
                          : "bg-white/[0.04] text-[var(--text-muted)] border-[var(--border)]"
                      }`}
                    >
                      {p.allowed ? "Allowed" : "Denied"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                    <Clock className="w-3 h-3" />
                    {humanizeRelative(p.lastUsed)}
                  </div>
                  <div className="md:text-right">
                    {p.allowed && (
                      <button
                        onClick={() => handleRevoke(p)}
                        disabled={revoking === revokeKey}
                        className="px-2.5 py-1 rounded-md text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--error)]/10 hover:text-[var(--error)] hover:border-[var(--error)]/40 transition-colors disabled:opacity-50"
                      >
                        {revoking === revokeKey ? (
                          <Loader2 className="w-3 h-3 animate-spin inline" />
                        ) : (
                          "Revoke"
                        )}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function FilterChip({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon?: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? "bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent)]/30"
          : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
      }`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </button>
  );
}

// ───────── Audit tab ─────────

function AuditTab() {
  const [settings, setSettings] = useState<PrivacySetting[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [expandedIssues, setExpandedIssues] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const list = await api.getPrivacySettings();
      setSettings(list);
    } catch (e) {
      toast.error(errMessage(e, "Failed to load privacy settings"));
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchSettings();
      setLoading(false);
    })();
  }, [fetchSettings]);

  const stats = useMemo(() => {
    if (!settings) return null;
    const recommended = settings.filter((s) => s.risk === "Recommended");
    const active = recommended.filter((s) => s.currentValue);
    const score = recommended.length
      ? Math.round((active.length / recommended.length) * 100)
      : 100;
    const byCategory = {} as Record<PrivacyCategory, { total: number; active: number }>;
    for (const s of settings) {
      if (!byCategory[s.category]) byCategory[s.category] = { total: 0, active: 0 };
      byCategory[s.category].total++;
      if (s.currentValue) byCategory[s.category].active++;
    }
    const unfixed = recommended.filter((s) => !s.currentValue);
    return { recommended, active, score, byCategory, unfixed };
  }, [settings]);

  const applyAll = useCallback(async () => {
    if (!stats || stats.unfixed.length === 0) return;
    setApplying(true);
    const loadingToast = toast.loading(`Applying 0 of ${stats.unfixed.length}…`);
    let done = 0;
    let failed = 0;
    for (const s of stats.unfixed) {
      try {
        await api.applyPrivacySetting({
          settingId: s.id,
          enablePrivacy: true,
        });
        done++;
      } catch {
        failed++;
      }
      toast.loading(`Applying ${done + failed} of ${stats.unfixed.length}…`, {
        id: loadingToast,
      });
    }
    toast.dismiss(loadingToast);
    if (failed === 0) {
      toast.success(`Applied ${done} recommended settings`);
    } else {
      toast.warning(`Applied ${done}, ${failed} failed`);
    }
    await fetchSettings();
    setApplying(false);
  }, [stats, fetchSettings]);

  if (loading || !settings || !stats) {
    return <LoadingCard label="Calculating privacy score…" />;
  }

  const { score, recommended, active, byCategory, unfixed } = stats;
  const scoreTone =
    score >= 80
      ? { text: "text-[var(--success)]", ring: "stroke-[var(--success)]", bg: "bg-[var(--success)]/15", icon: ShieldCheck, label: "Strong" }
      : score >= 50
      ? { text: "text-[var(--warning)]", ring: "stroke-[var(--warning)]", bg: "bg-[var(--warning)]/15", icon: Shield, label: "Moderate" }
      : { text: "text-[var(--error)]", ring: "stroke-[var(--error)]", bg: "bg-[var(--error)]/15", icon: ShieldAlert, label: "Weak" };
  const ScoreIcon = scoreTone.icon;
  const dash = 2 * Math.PI * 52;
  const dashOffset = dash * (1 - score / 100);

  return (
    <div className="space-y-4">
      <Card className="px-8 py-8 flex flex-col md:flex-row items-center gap-8">
        <div className="relative flex items-center justify-center shrink-0">
          <svg width="140" height="140" viewBox="0 0 120 120" className="-rotate-90">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              className={scoreTone.ring}
              strokeDasharray={dash}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 600ms ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold tabular-nums ${scoreTone.text}`}>{score}</span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Score</span>
          </div>
        </div>
        <div className="flex-1 min-w-0 text-center md:text-left">
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <ScoreIcon className={`w-5 h-5 ${scoreTone.text}`} />
            <h2 className={`text-xl font-bold ${scoreTone.text}`}>{scoreTone.label} privacy posture</h2>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {active.length} of {recommended.length} recommended privacy controls are active.
          </p>
          {unfixed.length > 0 && (
            <button
              onClick={applyAll}
              disabled={applying}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mx-auto md:mx-0"
            >
              {applying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Apply {unfixed.length} recommended
            </button>
          )}
        </div>
      </Card>

      <Card className="px-5 py-4">
        <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] mb-3">
          Breakdown by category
        </p>
        <ul className="space-y-2">
          {categoryOrder
            .filter((c) => byCategory[c])
            .map((c) => {
              const stat = byCategory[c];
              const meta = categoryMeta[c];
              const Icon = meta.icon;
              const pct = stat.total ? (stat.active / stat.total) * 100 : 0;
              return (
                <li key={c} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  <span className="text-sm text-[var(--text-primary)] w-40 shrink-0">{meta.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-[var(--text-muted)] tabular-nums w-12 text-right shrink-0">
                    {stat.active}/{stat.total}
                  </span>
                </li>
              );
            })}
        </ul>
      </Card>

      {unfixed.length > 0 && (
        <Card className="overflow-hidden">
          <button
            onClick={() => setExpandedIssues((v) => !v)}
            className="flex items-center justify-between w-full px-5 py-3 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {unfixed.length} recommended{" "}
                {unfixed.length === 1 ? "setting is" : "settings are"} not active
              </p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${
                expandedIssues ? "rotate-180" : ""
              }`}
            />
          </button>
          <AnimatePresence initial={false}>
            {expandedIssues && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="border-t border-[var(--border)]"
              >
                <ul className="divide-y divide-[var(--border)]">
                  {unfixed.map((s) => (
                    <li key={s.id} className="px-5 py-2.5">
                      <p className="text-sm text-[var(--text-primary)]">{s.name}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">{s.description}</p>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <Card className="px-8 py-12 flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
    </Card>
  );
}
