// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Fleet Dashboard (Pro Business). Lists customer endpoints in a sortable
// table, lets the operator add/remove endpoints, and slots in the bulk
// profile deployment panel and per-machine detail drawer.

import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  open as openFileDialog,
  save as saveFileDialog,
} from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronRight,
  Download,
  FileUp,
  Loader2,
  RefreshCw,
  Server,
  Trash2,
  Upload,
} from "lucide-react";
import { ProFeatureGate } from "../ui/ProFeatureGate";
import { useLicenseStore } from "../../stores/licenseStore";
import type { Machine } from "../../types/fleet";
import { MachineDetail } from "./MachineDetail";
import { BulkDeployPanel } from "./BulkDeployPanel";

type SortField = "ownerName" | "hostname" | "lastHealthScore" | "lastSeen";
type SortDir = "asc" | "desc";

export function FleetDashboard() {
  const isBusiness = useLicenseStore((s) => s.isBusiness());
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("lastSeen");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await invoke<Machine[]>("list_machines");
      setMachines(list);
    } catch (err) {
      toast.error(`Could not list machines: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const sorted = useMemo(() => {
    const filterLower = filter.trim().toLowerCase();
    let list = machines;
    if (filterLower) {
      list = list.filter(
        (m) =>
          m.hostname.toLowerCase().includes(filterLower) ||
          m.ownerName.toLowerCase().includes(filterLower) ||
          (m.serialNumber ?? "").toLowerCase().includes(filterLower),
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = (a[sortField] ?? "") as string | number;
      const bv = (b[sortField] ?? "") as string | number;
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });
  }, [machines, filter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const onAdd = async () => {
    try {
      const picked = await openFileDialog({
        multiple: false,
        filters: [{ name: "FreshRig endpoint", extensions: ["json"] }],
      });
      if (!picked || typeof picked !== "string") return;
      const m = await invoke<Machine>("import_endpoint_summary", {
        path: picked,
        isBusiness,
      });
      toast.success(`Added ${m.hostname}`);
      await refresh();
    } catch (err) {
      const msg = String(err);
      if (msg.includes("ENDPOINT_CAP_REACHED")) {
        toast.error("Endpoint cap reached (25). Upgrade to Site for more.");
      } else if (msg.includes("PRO_REQUIRED")) {
        toast.error("Pro Business required");
      } else {
        toast.error(`Add failed: ${msg}`);
      }
    }
  };

  const onExportSelfBundle = async () => {
    try {
      const json = await invoke<string>("export_endpoint_summary");
      const path = await saveFileDialog({
        defaultPath: "freshrig-endpoint.json",
        filters: [{ name: "FreshRig endpoint", extensions: ["json"] }],
      });
      if (!path) {
        // No path picked; copy to clipboard as a fallback so the operator
        // can paste it into a chat.
        await navigator.clipboard.writeText(json);
        toast.success("Endpoint JSON copied to clipboard");
        return;
      }
      // Persist via the dialog plugin's save flow — no plugin-fs needed:
      // pipe the JSON back through a Tauri command. Currently no helper
      // exists, so call the writeTextFile equivalent via @tauri-apps/api fs?
      // Simpler: re-invoke a dedicated path. We use a small frontend trick:
      // create a Blob and trigger a download via a hidden link.
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = path.split(/[\\/]/).pop() ?? "freshrig-endpoint.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Endpoint summary saved`);
    } catch (err) {
      toast.error(`Export failed: ${err}`);
    }
  };

  const onDelete = async (id: string, hostname: string) => {
    if (!confirm(`Remove ${hostname} from the fleet? Reports and contracts for this machine will also be deleted.`)) {
      return;
    }
    try {
      await invoke("delete_machine", { id, isBusiness });
      toast.success(`Removed ${hostname}`);
      if (selectedId === id) setSelectedId(null);
      await refresh();
    } catch (err) {
      toast.error(`Delete failed: ${err}`);
    }
  };

  const togglePick = (id: string) => {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pickedMachines = machines.filter((m) => pickedIds.has(m.id));

  return (
    <ProFeatureGate feature="Fleet Dashboard" tier="business" mode="blur">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20">
              <Server className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                Fleet
                <span className="text-[10px] font-medium text-blue-400 border border-blue-500/30 rounded-full px-1.5 py-0.5">
                  BUSINESS
                </span>
              </h1>
              <p className="text-sm text-text-secondary mt-0.5">
                Manage up to 25 customer endpoints
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onExportSelfBundle}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
              title="Export this machine as a freshrig-endpoint.json"
            >
              <Download className="w-4 h-4" />
              Generate endpoint bundle
            </button>
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <FileUp className="w-4 h-4" />
              Add machine
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </button>
          </div>
        </div>

        {/* Filter + Bulk button */}
        <div className="flex items-center justify-between gap-3">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by owner, hostname, or serial…"
            className="flex-1 px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
          />
          <button
            onClick={() => setShowBulk(true)}
            disabled={pickedIds.size === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            Bulk deploy ({pickedIds.size})
          </button>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-tertiary text-text-muted">
              <tr>
                <th className="w-10 px-3 py-2 text-center"></th>
                <Th label="Owner" field="ownerName" current={sortField} dir={sortDir} onClick={toggleSort} />
                <Th label="Hostname" field="hostname" current={sortField} dir={sortDir} onClick={toggleSort} />
                <Th
                  label="Health"
                  field="lastHealthScore"
                  current={sortField}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <Th label="Last seen" field="lastSeen" current={sortField} dir={sortDir} onClick={toggleSort} />
                <th className="text-right px-3 py-2 font-medium text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-center px-4 py-12 text-text-muted">
                    No endpoints yet. Use <strong>Generate endpoint bundle</strong> on a customer machine, then{" "}
                    <strong>Add machine</strong> here.
                  </td>
                </tr>
              )}
              {sorted.map((m) => (
                <tr
                  key={m.id}
                  className="border-t border-border hover:bg-bg-tertiary transition-colors"
                >
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={pickedIds.has(m.id)}
                      onChange={() => togglePick(m.id)}
                      className="accent-accent"
                    />
                  </td>
                  <td className="px-3 py-2 text-text-primary">{m.ownerName}</td>
                  <td className="px-3 py-2 text-text-secondary font-mono text-xs">
                    {m.hostname}
                  </td>
                  <td className="px-3 py-2">
                    <HealthBadge score={m.lastHealthScore} />
                  </td>
                  <td className="px-3 py-2 text-xs text-text-muted">
                    {humanizeRelative(m.lastSeen)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setSelectedId(m.id)}
                        className="px-2.5 py-1 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors"
                      >
                        Open
                        <ChevronRight className="inline w-3 h-3 ml-0.5" />
                      </button>
                      <button
                        onClick={() => onDelete(m.id, m.hostname)}
                        className="px-2 py-1 rounded-md text-xs text-error hover:bg-error/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-text-muted">
          Cap: 25 endpoints on the Pro Business tier. Site licensing for higher caps coming soon.
        </p>

        {/* Detail drawer */}
        {selectedId && (
          <MachineDetail id={selectedId} onClose={() => setSelectedId(null)} onChanged={refresh} />
        )}

        {/* Bulk deploy modal */}
        {showBulk && (
          <BulkDeployPanel
            machines={pickedMachines}
            onClose={() => setShowBulk(false)}
          />
        )}
      </div>
    </ProFeatureGate>
  );
}

function Th({
  label,
  field,
  current,
  dir,
  onClick,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onClick: (f: SortField) => void;
}) {
  const active = current === field;
  return (
    <th
      onClick={() => onClick(field)}
      className="text-left px-3 py-2 font-medium text-xs uppercase tracking-wider cursor-pointer select-none"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active &&
          (dir === "asc" ? (
            <ArrowUpAZ className="w-3 h-3" />
          ) : (
            <ArrowDownAZ className="w-3 h-3" />
          ))}
      </span>
    </th>
  );
}

function HealthBadge({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-xs text-text-muted">—</span>;
  }
  const tone =
    score >= 80
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : score >= 60
        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
        : "bg-rose-500/15 text-rose-400 border-rose-500/30";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${tone}`}>
      {score}
    </span>
  );
}

function humanizeRelative(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "—";
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

