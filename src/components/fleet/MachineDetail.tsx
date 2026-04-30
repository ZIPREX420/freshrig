// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Per-endpoint detail drawer. Shows hardware summary, change-log timeline,
// recent reports, and a maintenance-contract section (Feature E) with
// frequency, email recipient, action checkboxes, and "Run now".

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
  Mail,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useLicenseStore } from "../../stores/licenseStore";
import type { ContractFrequency, EndpointBundle } from "../../types/fleet";

const ALL_ACTIONS = [
  "Run cleanup (safe)",
  "Apply privacy preset",
  "Refresh SMART history",
  "Generate health report",
  "Push report to RepairShopr",
];

interface Props {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}

export function MachineDetail({ id, onClose, onChanged }: Props) {
  const isBusiness = useLicenseStore((s) => s.isBusiness());
  const [bundle, setBundle] = useState<EndpointBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingContract, setSavingContract] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const b = await invoke<EndpointBundle>("get_machine_detail", { id });
      setBundle(b);
    } catch (err) {
      toast.error(`Could not load machine: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 flex items-stretch justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl h-full overflow-y-auto bg-bg-elevated border-l border-border animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-bg-elevated z-10 flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {bundle?.machine.hostname ?? "Machine"}
            </h2>
            {bundle && (
              <p className="text-xs text-text-muted">
                Owner: {bundle.machine.ownerName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-6 space-y-6">
          {loading || !bundle ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
            </div>
          ) : (
            <>
              {/* Hardware summary */}
              <section className="bg-bg-card border border-border rounded-lg p-4 text-sm space-y-1">
                <p className="text-xs uppercase tracking-wider text-text-muted">Hardware</p>
                <p className="text-text-primary">{bundle.machine.hardwareSummary}</p>
                {bundle.machine.serialNumber && (
                  <p className="text-xs text-text-muted font-mono">
                    Serial: {bundle.machine.serialNumber}
                  </p>
                )}
                {bundle.machine.notes && (
                  <p className="text-xs text-text-secondary mt-2 whitespace-pre-wrap">
                    {bundle.machine.notes}
                  </p>
                )}
              </section>

              {/* Maintenance contract */}
              <ContractSection
                key={`${bundle.contracts[0]?.id ?? "new"}-${bundle.contracts[0]?.lastRun ?? "0"}`}
                bundle={bundle}
                isBusiness={isBusiness}
                saving={savingContract}
                setSaving={setSavingContract}
                onRefresh={async () => {
                  await refresh();
                  onChanged();
                }}
              />

              {/* Recent reports */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Recent reports
                </h3>
                {bundle.recentReports.length === 0 ? (
                  <p className="text-xs text-text-muted">No reports yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {bundle.recentReports.map((r) => (
                      <li
                        key={r.id}
                        className="px-3 py-2 rounded-md bg-bg-tertiary border border-border text-xs flex items-center justify-between"
                      >
                        <div>
                          <p className="text-text-primary">{r.kind}</p>
                          <p className="text-text-muted font-mono text-[11px] truncate">
                            {r.filePath}
                          </p>
                        </div>
                        <span className="text-text-muted">
                          {new Date(r.timestamp).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Timeline */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Activity
                </h3>
                {bundle.changeLog.length === 0 ? (
                  <p className="text-xs text-text-muted">No activity recorded yet.</p>
                ) : (
                  <ol className="border-l border-border pl-3 space-y-2">
                    {bundle.changeLog.map((entry) => (
                      <li key={entry.id} className="text-xs space-y-0.5">
                        <p className="text-text-primary font-medium">{entry.action}</p>
                        <p className="text-text-muted">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ContractSection({
  bundle,
  isBusiness,
  saving,
  setSaving,
  onRefresh,
}: {
  bundle: EndpointBundle;
  isBusiness: boolean;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onRefresh: () => Promise<void>;
}) {
  const existing = bundle.contracts[0] ?? null;
  const [enabled, setEnabled] = useState(!!existing);
  const [frequency, setFrequency] = useState<ContractFrequency>(
    (existing?.frequency as ContractFrequency) ?? "monthly",
  );
  const [emailTo, setEmailTo] = useState(existing?.emailTo ?? "");
  const [actions, setActions] = useState<Set<string>>(
    new Set(existing?.autoActions ?? ["Run cleanup (safe)", "Generate health report"]),
  );

  const toggleAction = (a: string) => {
    setActions((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  };

  const onSave = async () => {
    setSaving(true);
    try {
      if (enabled) {
        const id = existing?.id ?? `con_${Math.random().toString(36).slice(2, 10)}`;
        const nextRunIso = computeNextRun(frequency);
        await invoke("create_contract", {
          contract: {
            id,
            machineId: bundle.machine.id,
            frequency,
            nextRun: nextRunIso,
            emailTo: emailTo.trim() || null,
            autoActions: Array.from(actions),
            lastRun: existing?.lastRun ?? null,
          },
          isBusiness,
        });
        toast.success("Contract saved");
      } else if (existing) {
        await invoke("delete_contract", { id: existing.id, isBusiness });
        toast.success("Contract removed");
      }
      await onRefresh();
    } catch (err) {
      toast.error(`Save failed: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const onRunNow = async () => {
    if (!existing) return;
    try {
      await invoke("run_contract_now", { id: existing.id, isBusiness });
      toast.success("Contract run queued");
      await onRefresh();
    } catch (err) {
      toast.error(`Run failed: ${err}`);
    }
  };

  return (
    <section className="bg-bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" />
          Maintenance contract
        </h3>
        <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-accent"
          />
          {enabled ? "Enabled" : "Disabled"}
        </label>
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="space-y-1.5">
              <label className="text-xs text-text-secondary">Frequency</label>
              <div className="relative">
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as ContractFrequency)}
                  className="w-full appearance-none px-3 py-2 pr-8 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="ondemand">On-demand</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-text-secondary inline-flex items-center gap-1">
                <Mail className="w-3 h-3" />
                Email report to (optional)
              </label>
              <input
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="customer@example.com"
                className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-text-secondary inline-flex items-center gap-1">
              <CheckSquare className="w-3 h-3" />
              Automated actions
            </p>
            {ALL_ACTIONS.map((a) => (
              <label key={a} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={actions.has(a)}
                  onChange={() => toggleAction(a)}
                  className="accent-accent"
                />
                {a}
              </label>
            ))}
          </div>

          {existing && (
            <div className="text-[11px] text-text-muted">
              Next run: {new Date(existing.nextRun).toLocaleString()}
              {existing.lastRun && ` · Last: ${new Date(existing.lastRun).toLocaleString()}`}
            </div>
          )}
        </>
      )}

      <div className="flex justify-between gap-2">
        {existing && enabled && (
          <button
            onClick={onRunNow}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-border transition-colors disabled:opacity-60"
          >
            <Send className="w-3.5 h-3.5" />
            Run now
          </button>
        )}
        <button
          onClick={onSave}
          disabled={saving}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ml-auto ${
            saving
              ? "bg-bg-tertiary text-text-muted cursor-not-allowed"
              : "bg-accent text-bg-primary hover:bg-accent-hover"
          }`}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : enabled ? <Plus className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
          {enabled ? "Save contract" : "Remove"}
        </button>
      </div>
    </section>
  );
}

function computeNextRun(freq: ContractFrequency): string {
  const days = freq === "monthly" ? 30 : freq === "quarterly" ? 90 : 365;
  const next = new Date(Date.now() + days * 86400 * 1000);
  return next.toISOString();
}
