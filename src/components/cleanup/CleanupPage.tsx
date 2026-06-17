import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errMessage, api } from "../../lib";
import { motion, AnimatePresence } from "framer-motion";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import {
  Trash2,
  Scan,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
  FileText,
  Image,
  Globe,
  Recycle,
  Archive,
  Bug,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "../ui/Card";
import { ProFeatureGate } from "../ui/ProFeatureGate";
import type {
  CleanupCategory,
  CleanupResult,
  CleanupRisk,
  CleanupScanProgress,
  CleanupProgress,
} from "../../types/cleanup";

type Phase = "idle" | "scanning" | "results" | "cleaning" | "done";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

const riskMeta: Record<
  CleanupRisk,
  { label: string; tone: string; dot: string }
> = {
  Safe: {
    label: "Safe",
    tone: "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/20",
    dot: "bg-[var(--success)]",
  },
  Moderate: {
    label: "Moderate",
    tone: "bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/20",
    dot: "bg-[var(--warning)]",
  },
  Expert: {
    label: "Expert",
    tone: "bg-[var(--error)]/15 text-[var(--error)] border-[var(--error)]/20",
    dot: "bg-[var(--error)]",
  },
};

export function CleanupPage() {
  return (
    <ProFeatureGate feature="disk_cleanup" mode="blur">
      <CleanupPageInner />
    </ProFeatureGate>
  );
}

function CleanupPageInner() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [categories, setCategories] = useState<CleanupCategory[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [scanProgress, setScanProgress] = useState<Record<string, CleanupScanProgress>>({});
  const [cleanProgress, setCleanProgress] = useState<Record<string, CleanupProgress>>({});
  const [results, setResults] = useState<CleanupResult[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const scanUnlistenRef = useRef<(() => void) | null>(null);
  const cleanUnlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      scanUnlistenRef.current?.();
      cleanUnlistenRef.current?.();
    };
  }, []);

  const totalSelectedBytes = useMemo(
    () =>
      categories
        .filter((c) => selected.has(c.id))
        .reduce((sum, c) => sum + c.totalBytes, 0),
    [categories, selected],
  );
  const totalSelectedFiles = useMemo(
    () =>
      categories
        .filter((c) => selected.has(c.id))
        .reduce((sum, c) => sum + c.fileCount, 0),
    [categories, selected],
  );
  const totalScannedBytes = useMemo(
    () => categories.reduce((sum, c) => sum + c.totalBytes, 0),
    [categories],
  );
  const totalScannedFiles = useMemo(
    () => categories.reduce((sum, c) => sum + c.fileCount, 0),
    [categories],
  );
  const totalFreedBytes = useMemo(
    () => results.reduce((sum, r) => sum + r.bytesFreed, 0),
    [results],
  );
  const totalFreedFiles = useMemo(
    () => results.reduce((sum, r) => sum + r.filesDeleted, 0),
    [results],
  );
  const anyNonSafeSelected = useMemo(
    () =>
      categories
        .filter((c) => selected.has(c.id))
        .some((c) => c.risk !== "Safe"),
    [categories, selected],
  );

  const runScan = useCallback(async () => {
    setPhase("scanning");
    setScanProgress({});
    setResults([]);
    setCleanProgress({});
    setSelected(new Set());
    setExpanded(new Set());
    try {
      scanUnlistenRef.current?.();
      scanUnlistenRef.current = await listen<CleanupScanProgress>(
        "cleanup-scan-progress",
        (event) => {
          setScanProgress((prev) => ({ ...prev, [event.payload.categoryId]: event.payload }));
        },
      );
      const result = await api.scanCleanup();
      setCategories(result);
      setSelected(new Set(result.filter((c) => c.enabledByDefault).map((c) => c.id)));
      setPhase("results");
    } catch (e) {
      toast.error(errMessage(e, "Failed to scan for junk files"));
      setPhase("idle");
    } finally {
      scanUnlistenRef.current?.();
      scanUnlistenRef.current = null;
    }
  }, []);

  const runClean = useCallback(async () => {
    setConfirmOpen(false);
    setPhase("cleaning");
    setCleanProgress({});
    setResults([]);
    try {
      cleanUnlistenRef.current?.();
      cleanUnlistenRef.current = await listen<CleanupProgress>(
        "cleanup-progress",
        (event) => {
          setCleanProgress((prev) => ({ ...prev, [event.payload.categoryId]: event.payload }));
        },
      );
      const result = await api.runCleanup({
        categoryIds: Array.from(selected),
      });
      setResults(result);
      setPhase("done");
      const freed = result.reduce((s, r) => s + r.bytesFreed, 0);
      toast.success(`Freed ${formatBytes(freed)}`);
    } catch (e) {
      toast.error(errMessage(e, "Cleanup failed"));
      setPhase("results");
    } finally {
      cleanUnlistenRef.current?.();
      cleanUnlistenRef.current = null;
    }
  }, [selected]);

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const resetToIdle = useCallback(() => {
    setPhase("idle");
    setCategories([]);
    setSelected(new Set());
    setExpanded(new Set());
    setScanProgress({});
    setCleanProgress({});
    setResults([]);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Disk Cleanup</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Find and remove temporary files, caches, and other junk
          </p>
        </div>
        {phase === "results" && (
          <button
            onClick={runScan}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] text-xs font-medium hover:bg-white/[0.04] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors active:scale-[0.97] transition-transform duration-100"
            title="Rescan"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Rescan
          </button>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {phase === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <IdleHero onScan={runScan} />
          </motion.div>
        )}

        {phase === "scanning" && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <ScanningState progress={scanProgress} />
          </motion.div>
        )}

        {phase === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            <ResultsSummaryStrip
              files={totalScannedFiles}
              bytes={totalScannedBytes}
              selectedBytes={totalSelectedBytes}
              selectedFiles={totalSelectedFiles}
            />
            <motion.ul
              className="space-y-2"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.02 } },
              }}
            >
              {categories.map((cat) => (
                <motion.li
                  key={cat.id}
                  variants={{
                    hidden: { opacity: 0, y: 4 },
                    visible: { opacity: 1, y: 0 },
                  }}
                >
                  <CategoryRow
                    category={cat}
                    checked={selected.has(cat.id)}
                    expanded={expanded.has(cat.id)}
                    onToggle={() => toggleSelected(cat.id)}
                    onExpand={() => toggleExpanded(cat.id)}
                  />
                </motion.li>
              ))}
            </motion.ul>
            <CleanFooter
              files={totalSelectedFiles}
              bytes={totalSelectedBytes}
              disabled={selected.size === 0}
              onClean={() => setConfirmOpen(true)}
            />
          </motion.div>
        )}

        {phase === "cleaning" && (
          <motion.div
            key="cleaning"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <CleaningState
              categories={categories.filter((c) => selected.has(c.id))}
              progress={cleanProgress}
            />
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <DoneSummary
              files={totalFreedFiles}
              bytes={totalFreedBytes}
              results={results}
              categories={categories}
              onReset={resetToIdle}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmOpen && (
          <ConfirmModal
            files={totalSelectedFiles}
            bytes={totalSelectedBytes}
            riskHigh={anyNonSafeSelected}
            categories={categories.filter((c) => selected.has(c.id))}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={runClean}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Empty-state preview: shows the user what *kinds* of things will be scanned
// before they commit. Mirrors the canonical category list returned by
// `scan_cleanup` on Windows; the actual scan may surface more or fewer
// depending on installed software.
const SCAN_PREVIEW: { icon: LucideIcon; label: string; description: string }[] = [
  { icon: FileText, label: "Windows Temp",     description: "%TEMP% + %SystemRoot%\\Temp" },
  { icon: Globe,    label: "Browser Cache",    description: "Edge, Chrome, Firefox" },
  { icon: Recycle,  label: "Recycle Bin",      description: "Per-volume" },
  { icon: Bug,      label: "Crash Dumps",      description: "Memory.dmp, minidumps" },
  { icon: Archive,  label: "Update Cleanup",   description: "Old Windows components" },
  { icon: Image,    label: "Thumbnail Cache",  description: "Explorer thumbnails.db" },
];

function IdleHero({ onScan }: { onScan: () => void }) {
  return (
    <Card className="px-8 py-10 flex flex-col items-center text-center gap-5">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent-subtle)] ring-1 ring-[var(--accent-ring)]">
        <Trash2 className="w-8 h-8 text-[var(--accent)]" />
      </div>
      <div className="space-y-1.5 max-w-md">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Find junk files on your disk
        </h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Scan for temporary files, crash dumps, caches, and other reclaimable
          space across Windows and installed applications. Nothing is deleted
          until you review and confirm.
        </p>
      </div>
      <button
        onClick={onScan}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors active:scale-[0.98] transition-transform duration-100"
      >
        <Scan className="w-4 h-4" />
        Scan for junk files
      </button>

      {/* What we'll look at — preview grid. Educates users + gives the empty
          state visual weight so the card doesn't float in dead space. */}
      <div className="w-full max-w-2xl pt-6 mt-2 border-t border-[var(--border)]">
        <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-3">
          What gets scanned
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {SCAN_PREVIEW.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-md bg-[var(--bg-card-hover)] border border-[var(--border)] text-left"
              >
                <Icon className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-[var(--text-primary)] leading-tight">
                    {item.label}
                  </p>
                  <p className="text-[10.5px] text-[var(--text-muted)] mt-0.5 truncate">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function ScanningState({
  progress,
}: {
  progress: Record<string, CleanupScanProgress>;
}) {
  const entries = Object.values(progress);
  const totalFiles = entries.reduce((s, e) => s + e.fileCount, 0);
  const totalBytes = entries.reduce((s, e) => s + e.totalBytes, 0);
  return (
    <Card className="px-8 py-12 flex flex-col items-center text-center gap-4">
      <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Scanning for junk files…
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          {entries.length === 0
            ? "Starting up…"
            : `${totalFiles.toLocaleString()} files · ${formatBytes(totalBytes)} found so far`}
        </p>
      </div>
    </Card>
  );
}

function ResultsSummaryStrip({
  files,
  bytes,
  selectedFiles,
  selectedBytes,
}: {
  files: number;
  bytes: number;
  selectedFiles: number;
  selectedBytes: number;
}) {
  return (
    <Card className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--accent-subtle)]">
          <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            Reclaimable space found
          </p>
          <p className="text-base font-semibold text-[var(--text-primary)] tabular-nums">
            {files.toLocaleString()} files · {formatBytes(bytes)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
          Selected to clean
        </p>
        <p className="text-base font-semibold text-[var(--accent)] tabular-nums">
          {selectedFiles.toLocaleString()} files · {formatBytes(selectedBytes)}
        </p>
      </div>
    </Card>
  );
}

function CategoryRow({
  category,
  checked,
  expanded,
  onToggle,
  onExpand,
}: {
  category: CleanupCategory;
  checked: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
}) {
  const risk = riskMeta[category.risk];
  const empty = category.fileCount === 0 && category.id !== "recycle_bin";

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          disabled={empty}
          className="w-4 h-4 shrink-0 accent-[var(--accent)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={`Select ${category.name}`}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {category.name}
            </span>
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${risk.tone}`}
            >
              {risk.label}
            </span>
            {category.risk !== "Safe" && checked && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--warning)]">
                <AlertTriangle className="w-3 h-3" />
                Review samples before cleaning
              </span>
            )}
          </div>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5 truncate" title={category.description}>
            {category.description}
          </p>
        </div>

        <div className="hidden md:flex flex-col items-end shrink-0 min-w-[120px]">
          <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
            {category.id === "recycle_bin" && category.totalBytes === 0
              ? "—"
              : formatBytes(category.totalBytes)}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
            {category.id === "recycle_bin" && category.fileCount === 0
              ? "varies"
              : `${category.fileCount.toLocaleString()} files`}
          </span>
        </div>

        <button
          type="button"
          onClick={onExpand}
          disabled={category.paths.length === 0}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={expanded ? "Hide samples" : "Show samples"}
        >
          <ChevronRight
            className={`w-4 h-4 transition-transform duration-150 ${
              expanded ? "rotate-90" : ""
            }`}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && category.paths.length > 0 && (
          <motion.div
            key="samples"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="border-t border-[var(--border)] bg-[var(--bg-card-hover)]"
          >
            <div className="px-4 py-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Sample paths ({category.paths.length})
              </p>
              {category.paths.map((p, i) => (
                <p
                  key={i}
                  className="text-[11px] font-mono text-[var(--text-secondary)] truncate"
                  title={p}
                >
                  {p}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function CleanFooter({
  files,
  bytes,
  disabled,
  onClean,
}: {
  files: number;
  bytes: number;
  disabled: boolean;
  onClean: () => void;
}) {
  return (
    <Card className="px-5 py-4 flex items-center justify-between gap-4 sticky bottom-4">
      <div className="text-sm">
        <p className="text-[var(--text-primary)] font-medium tabular-nums">
          {files.toLocaleString()} files ·{" "}
          <span className="text-[var(--accent)]">{formatBytes(bytes)}</span> can be freed
        </p>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
          Files are deleted permanently, not moved to the Recycle Bin.
        </p>
      </div>
      <button
        onClick={onClean}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors active:scale-[0.98] transition-transform duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Trash2 className="w-4 h-4" />
        Clean Selected
      </button>
    </Card>
  );
}

function CleaningState({
  categories,
  progress,
}: {
  categories: CleanupCategory[];
  progress: Record<string, CleanupProgress>;
}) {
  return (
    <div className="space-y-3">
      <Card className="px-5 py-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Cleaning…</p>
          <p className="text-[11px] text-[var(--text-muted)]">
            Deleting files in {categories.length} {categories.length === 1 ? "category" : "categories"}
          </p>
        </div>
      </Card>
      <ul className="space-y-2">
        {categories.map((cat) => {
          const done = progress[cat.id];
          const total = cat.totalBytes || 1;
          const freed = done?.bytesFreed ?? 0;
          const ratio = Math.min(1, freed / total);
          return (
            <li key={cat.id}>
              <Card className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {cat.name}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                    {done ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 inline mr-1 text-[var(--success)]" />
                        {done.filesDeleted.toLocaleString()} files · {formatBytes(done.bytesFreed)}
                      </>
                    ) : (
                      <span className="text-[var(--text-muted)]">Waiting…</span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-200"
                    style={{ width: `${ratio * 100}%` }}
                  />
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DoneSummary({
  files,
  bytes,
  results,
  categories,
  onReset,
}: {
  files: number;
  bytes: number;
  results: CleanupResult[];
  categories: CleanupCategory[];
  onReset: () => void;
}) {
  const nameFor = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? id;
  const allErrors = results.flatMap((r) =>
    r.errors.map((e) => ({ id: r.categoryId, error: e })),
  );
  return (
    <div className="space-y-4">
      <Card className="px-8 py-10 flex flex-col items-center text-center gap-3">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--success)]/15">
          <CheckCircle2 className="w-8 h-8 text-[var(--success)] animate-check-pop" />
        </div>
        <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
          Total space freed
        </p>
        <p className="text-4xl font-bold text-[var(--text-primary)] tabular-nums">
          {formatBytes(bytes)}
        </p>
        <p className="text-sm text-[var(--text-secondary)] tabular-nums">
          {files.toLocaleString()} files deleted
        </p>
        <button
          onClick={onReset}
          className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-sm hover:bg-white/[0.04] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors active:scale-[0.98] transition-transform duration-100"
        >
          <RefreshCw className="w-4 h-4" />
          Scan again
        </button>
      </Card>

      <Card className="px-5 py-4">
        <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] mb-2">
          Breakdown
        </p>
        <ul className="divide-y divide-[var(--border)]">
          {results.map((r) => (
            <li key={r.categoryId} className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--text-primary)]">{nameFor(r.categoryId)}</span>
              <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                {r.filesDeleted.toLocaleString()} files · {formatBytes(r.bytesFreed)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {allErrors.length > 0 && (
        <Card className="px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
            <p className="text-[11px] uppercase tracking-wide text-[var(--warning)]">
              {allErrors.length} {allErrors.length === 1 ? "error" : "errors"}
            </p>
          </div>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {allErrors.slice(0, 30).map((err, i) => (
              <li
                key={i}
                className="text-[11px] font-mono text-[var(--text-muted)] truncate"
                title={err.error}
              >
                [{nameFor(err.id)}] {err.error}
              </li>
            ))}
            {allErrors.length > 30 && (
              <li className="text-[11px] text-[var(--text-muted)] italic">
                …and {allErrors.length - 30} more
              </li>
            )}
          </ul>
        </Card>
      )}
    </div>
  );
}

function ConfirmModal({
  files,
  bytes,
  riskHigh,
  categories,
  onCancel,
  onConfirm,
}: {
  files: number;
  bytes: number;
  riskHigh: boolean;
  categories: CleanupCategory[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm cleanup"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-md bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.5)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Confirm cleanup</h3>
          <button
            onClick={onCancel}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            You are about to permanently delete{" "}
            <span className="text-[var(--text-primary)] font-semibold">
              {files.toLocaleString()} files
            </span>{" "}
            totaling{" "}
            <span className="text-[var(--accent)] font-semibold">{formatBytes(bytes)}</span>{" "}
            across {categories.length}{" "}
            {categories.length === 1 ? "category" : "categories"}.
          </p>
          <ul className="space-y-1.5">
            {categories.map((c) => {
              const risk = riskMeta[c.risk];
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 text-xs py-1.5 px-2.5 rounded-md bg-[var(--bg-card)] border border-[var(--border)]"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${risk.dot}`} />
                    <span className="text-[var(--text-primary)] truncate">{c.name}</span>
                  </span>
                  <span className="text-[var(--text-muted)] tabular-nums shrink-0">
                    {formatBytes(c.totalBytes)}
                  </span>
                </li>
              );
            })}
          </ul>
          {riskHigh && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-[var(--error)]/10 border border-[var(--error)]/30">
              <AlertTriangle className="w-4 h-4 text-[var(--error)] shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--error)]">
                This cannot be undone. Files are deleted permanently and not moved to the Recycle Bin.
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-card)]">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded-md text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[var(--error)] text-white text-sm font-semibold hover:brightness-110 transition active:scale-[0.98] transition-transform duration-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete permanently
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
