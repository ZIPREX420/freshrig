// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Watchdog Mode page — capture, list, delete, and diff system snapshots.
// Pro-gated for the whole page (mode="blur"). Snapshots persist to the
// shared SQLite db.

import { useCallback, useEffect, useState } from "react";
import { errMessage, api } from "../../lib";
import {
  Camera,
  Check,
  ChevronRight,
  GitCompareArrows,
  Loader2,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "../ui/Card";
import { ProFeatureGate } from "../ui/ProFeatureGate";
import type {
  InstalledApp,
  Snapshot,
  SnapshotDiff,
  StartupSnapshot,
} from "../../types/watchdog";

function humanizeRelative(iso: string): string {
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
  return iso.slice(0, 10);
}

export function WatchdogPage() {
  return (
    <ProFeatureGate feature="Watchdog Mode" mode="blur">
      <WatchdogPageInner />
    </ProFeatureGate>
  );
}

function WatchdogPageInner() {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [label, setLabel] = useState("");
  const [taking, setTaking] = useState(false);
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [diffing, setDiffing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await api.listSnapshots();
      setSnapshots(list);
    } catch (e) {
      toast.error(errMessage(e, "Failed to list snapshots"));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onTake = async () => {
    if (!label.trim()) {
      toast.error("Add a label so you can find this snapshot later.");
      return;
    }
    setTaking(true);
    try {
      const snap = await api.takeSnapshot({ label: label.trim() });
      toast.success(`Snapshot "${snap.label}" captured.`);
      setLabel("");
      await refresh();
    } catch (e) {
      toast.error(errMessage(e, "Failed to capture snapshot"));
    } finally {
      setTaking(false);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await api.deleteSnapshot({ id });
      if (beforeId === id) setBeforeId(null);
      if (afterId === id) setAfterId(null);
      if (diff && (diff.beforeId === id || diff.afterId === id)) setDiff(null);
      await refresh();
    } catch (e) {
      toast.error(errMessage(e, "Failed to delete snapshot"));
    }
  };

  const onCompare = async () => {
    if (!beforeId || !afterId) {
      toast.error("Pick a before and after snapshot.");
      return;
    }
    if (beforeId === afterId) {
      toast.error("Pick two different snapshots.");
      return;
    }
    setDiffing(true);
    try {
      const d = await api.diffSnapshots({ beforeId, afterId });
      setDiff(d);
    } catch (e) {
      toast.error(errMessage(e, "Failed to compare snapshots"));
    } finally {
      setDiffing(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Watchdog</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Capture system state before risky changes. Compare two snapshots to see what got installed,
          which services flipped, and what startup entries were added.
        </p>
      </header>

      {/* Take snapshot */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--accent-subtle)] shrink-0">
            <Camera className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Take snapshot</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5 mb-3">
              Captures running services, startup programs, and installed software.
              On Windows we also create a System Restore Point in the same call.
            </p>
            <div className="flex items-center gap-2">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder='e.g. "Before debloat"'
                className="flex-1 px-3 py-2 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40"
              />
              <button
                onClick={onTake}
                disabled={taking || !label.trim()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-[var(--accent)] text-[var(--bg-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
              >
                {taking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                Capture
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Snapshot list */}
      <Card>
        <h3 className="text-base font-semibold text-[var(--text-primary)] mb-3">
          Snapshots {snapshots ? `(${snapshots.length})` : ""}
        </h3>
        {snapshots === null ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : snapshots.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-4">No snapshots yet.</p>
        ) : (
          <ul className="space-y-2">
            {snapshots.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 p-3 rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)]"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">{s.label}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-3">
                    <span>{humanizeRelative(s.createdAt)}</span>
                    <span className="font-mono">{s.services.length} svc</span>
                    <span className="font-mono">{s.startupEntries.length} startup</span>
                    <span className="font-mono">{s.installedSoftware.length} apps</span>
                    {s.restorePointId !== null && <span className="text-[var(--accent)]">Restore point ✓</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <CompareSlot
                    role="before"
                    selected={beforeId === s.id}
                    onSelect={() => setBeforeId(s.id)}
                  />
                  <CompareSlot
                    role="after"
                    selected={afterId === s.id}
                    onSelect={() => setAfterId(s.id)}
                  />
                  <button
                    onClick={() => onDelete(s.id)}
                    aria-label={`Delete ${s.label}`}
                    className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-white/[0.04] transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Compare */}
      <Card>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Compare</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Pick a before + after snapshot from the list, then run the diff.
            </p>
          </div>
          <button
            onClick={onCompare}
            disabled={diffing || !beforeId || !afterId || beforeId === afterId}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-[var(--accent)] text-[var(--bg-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
          >
            {diffing ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompareArrows className="w-4 h-4" />}
            Compare
          </button>
        </div>
        {diff && <DiffPanel diff={diff} />}
      </Card>
    </div>
  );
}

function CompareSlot({
  role,
  selected,
  onSelect,
}: {
  role: "before" | "after";
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        selected
          ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
          : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]"
      }`}
      title={`Mark as ${role}`}
    >
      {selected ? <Check className="w-3 h-3 inline" /> : null} {role}
    </button>
  );
}

function DiffPanel({ diff }: { diff: SnapshotDiff }) {
  const sections: Array<{
    title: string;
    added: number;
    removed: number;
    changed?: number;
    items: React.ReactNode;
  }> = [
    {
      title: "Services",
      added: diff.servicesAdded.length,
      removed: diff.servicesRemoved.length,
      changed: diff.servicesStateChanged.length,
      items: (
        <>
          {diff.servicesAdded.map((n) => (
            <DiffRow key={`sa-${n}`} kind="added" text={n} />
          ))}
          {diff.servicesRemoved.map((n) => (
            <DiffRow key={`sr-${n}`} kind="removed" text={n} />
          ))}
          {diff.servicesStateChanged.map((c) => (
            <DiffRow
              key={`sc-${c.name}`}
              kind="changed"
              text={`${c.name}: ${c.before} → ${c.after}`}
            />
          ))}
        </>
      ),
    },
    {
      title: "Startup entries",
      added: diff.startupAdded.length,
      removed: diff.startupRemoved.length,
      items: (
        <>
          {diff.startupAdded.map((s: StartupSnapshot) => (
            <DiffRow key={`ua-${s.name}`} kind="added" text={`${s.name} (${s.source})`} />
          ))}
          {diff.startupRemoved.map((s: StartupSnapshot) => (
            <DiffRow key={`ur-${s.name}`} kind="removed" text={`${s.name} (${s.source})`} />
          ))}
        </>
      ),
    },
    {
      title: "Installed software",
      added: diff.softwareAdded.length,
      removed: diff.softwareRemoved.length,
      items: (
        <>
          {diff.softwareAdded.map((a: InstalledApp) => (
            <DiffRow
              key={`ia-${a.name}`}
              kind="added"
              text={`${a.name}${a.version ? ` ${a.version}` : ""}`}
            />
          ))}
          {diff.softwareRemoved.map((a: InstalledApp) => (
            <DiffRow
              key={`ir-${a.name}`}
              kind="removed"
              text={`${a.name}${a.version ? ` ${a.version}` : ""}`}
            />
          ))}
        </>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <details
          key={s.title}
          className="rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] overflow-hidden"
          open={s.added + s.removed + (s.changed ?? 0) > 0}
        >
          <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm">
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="font-medium text-[var(--text-primary)]">{s.title}</span>
            <span className="ml-auto flex items-center gap-2 text-xs">
              {s.added > 0 && (
                <span className="text-[var(--success)]">+{s.added}</span>
              )}
              {s.removed > 0 && (
                <span className="text-[var(--error)]">−{s.removed}</span>
              )}
              {s.changed !== undefined && s.changed > 0 && (
                <span className="text-[var(--warning)]">~{s.changed}</span>
              )}
              {s.added + s.removed + (s.changed ?? 0) === 0 && (
                <span className="text-[var(--text-muted)]">no change</span>
              )}
            </span>
          </summary>
          <div className="px-3 pb-3 pt-1 space-y-1">{s.items}</div>
        </details>
      ))}
    </div>
  );
}

function DiffRow({ kind, text }: { kind: "added" | "removed" | "changed"; text: string }) {
  const tone =
    kind === "added"
      ? "text-[var(--success)]"
      : kind === "removed"
        ? "text-[var(--error)]"
        : "text-[var(--warning)]";
  const Icon = kind === "added" ? Plus : kind === "removed" ? Minus : ChevronRight;
  return (
    <div className={`flex items-center gap-2 text-xs ${tone}`}>
      <Icon className="w-3 h-3 shrink-0" />
      <span className="font-mono truncate">{text}</span>
    </div>
  );
}
