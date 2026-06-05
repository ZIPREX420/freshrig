import { useCallback, useEffect, useMemo, useState } from "react";
import { errMessage } from "../../lib";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  Menu as MenuIcon,
  Loader2,
  RefreshCw,
  Check,
  Search,
  ShieldCheck,
  Puzzle,
} from "lucide-react";
import { Card } from "../ui/Card";
import { ProFeatureGate } from "../ui/ProFeatureGate";
import type { ShellExtension } from "../../types/contextMenu";

type Filter = "all" | "third-party" | "blocked";

export function ContextMenuPage() {
  return (
    <ProFeatureGate feature="context-menu" mode="blur">
      <ContextMenuPageInner />
    </ProFeatureGate>
  );
}

function ContextMenuPageInner() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Context Menu Editor</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Restore the classic Windows 10 right-click menu and manage shell extensions
        </p>
      </header>

      <ClassicMenuToggle />
      <ShellExtensionsPanel />
    </div>
  );
}

// ───────── Classic Menu Toggle ─────────

function ClassicMenuToggle() {
  const [classicEnabled, setClassicEnabled] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    try {
      const enabled = await invoke<boolean>("get_classic_menu_status");
      setClassicEnabled(enabled);
    } catch (e) {
      toast.error(errMessage(e, "Failed to read classic menu status"));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = useCallback(async () => {
    if (classicEnabled === null) return;
    const next = !classicEnabled;
    setToggling(true);
    try {
      await invoke("toggle_classic_menu", { enable: next });
      setClassicEnabled(next);
      toast.success(
        next ? "Classic menu enabled — Explorer restarted" : "Windows 11 menu restored — Explorer restarted",
      );
    } catch (e) {
      toast.error(errMessage(e, "Failed to toggle classic menu"));
    } finally {
      setToggling(false);
    }
  }, [classicEnabled]);

  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 shrink-0 rounded-lg bg-[var(--accent-subtle)] ring-1 ring-[var(--accent-ring)] flex items-center justify-center">
          <MenuIcon className="w-6 h-6 text-[var(--accent)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Right-click menu style
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed">
            Windows 11 hides long-tail shell extensions behind a "Show more options" item. Switching
            to the classic menu brings every entry back to the top level.
          </p>
          <p className="text-[12px] text-[var(--text-muted)] mt-2">
            Explorer will restart automatically — any open File Explorer windows close.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          {classicEnabled === null ? (
            <Loader2 className="w-5 h-5 text-[var(--text-muted)] animate-spin" />
          ) : (
            <div className="text-right">
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                {classicEnabled ? "Classic (Win10)" : "Windows 11"}
              </p>
              <button
                onClick={handleToggle}
                disabled={toggling}
                className="mt-1.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--accent)] text-black text-sm font-medium hover:brightness-110 disabled:opacity-60 transition"
              >
                {toggling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Applying…
                  </>
                ) : classicEnabled ? (
                  "Restore Win11 menu"
                ) : (
                  "Enable classic menu"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ───────── Shell Extensions Panel ─────────

function ShellExtensionsPanel() {
  const [extensions, setExtensions] = useState<ShellExtension[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("third-party");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await invoke<ShellExtension[]>("get_shell_extensions");
      setExtensions(list);
    } catch (e) {
      setExtensions([]);
      toast.error(errMessage(e, "Failed to scan shell extensions"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = useCallback(
    async (ext: ShellExtension) => {
      const block = !ext.isBlocked;
      setPending((prev) => new Set(prev).add(ext.clsid));
      try {
        await invoke("toggle_shell_extension", { clsid: ext.clsid, block });
        setExtensions((prev) =>
          (prev ?? []).map((e) => (e.clsid === ext.clsid ? { ...e, isBlocked: block } : e)),
        );
        toast.success(`${ext.name} ${block ? "blocked" : "unblocked"} — restart Explorer to apply`);
      } catch (e) {
        toast.error(errMessage(e, "Failed to toggle extension"));
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(ext.clsid);
          return next;
        });
      }
    },
    [],
  );

  const filtered = useMemo(() => {
    if (!extensions) return [];
    const q = search.trim().toLowerCase();
    return extensions.filter((ext) => {
      if (filter === "third-party" && ext.isMicrosoft) return false;
      if (filter === "blocked" && !ext.isBlocked) return false;
      if (q && !ext.name.toLowerCase().includes(q) && !ext.dllPath.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [extensions, filter, search]);

  const thirdPartyCount = useMemo(
    () => (extensions ?? []).filter((e) => !e.isMicrosoft).length,
    [extensions],
  );
  const blockedCount = useMemo(
    () => (extensions ?? []).filter((e) => e.isBlocked).length,
    [extensions],
  );

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Puzzle className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Shell Extensions</h3>
          {extensions && (
            <span className="text-xs text-[var(--text-muted)] ml-1">
              {filtered.length} / {extensions.length}
            </span>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition disabled:opacity-60"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </FilterChip>
        <FilterChip active={filter === "third-party"} onClick={() => setFilter("third-party")}>
          Third-party · {thirdPartyCount}
        </FilterChip>
        <FilterChip active={filter === "blocked"} onClick={() => setFilter("blocked")}>
          Blocked · {blockedCount}
        </FilterChip>
        <div className="flex items-center gap-2 ml-auto bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-md px-2.5 py-1">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or DLL…"
            className="bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none w-48"
          />
        </div>
      </div>

      {loading && extensions === null ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Scanning registry for shell extensions…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] text-center py-8">
          No extensions match the current filter.
        </p>
      ) : (
        <div className="overflow-hidden border border-[var(--border)] rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Source</th>
                <th className="text-left px-3 py-2 font-medium">DLL</th>
                <th className="text-right px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ext) => {
                const isPending = pending.has(ext.clsid);
                return (
                  <tr
                    key={ext.clsid}
                    className="border-t border-[var(--border)] hover:bg-white/[0.02]"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-[var(--text-primary)] truncate max-w-[280px]">
                        {ext.name}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono truncate max-w-[280px]">
                        {ext.clsid}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {ext.isMicrosoft ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20">
                          <ShieldCheck className="w-3 h-3" />
                          Microsoft
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--warning)]/15 text-[var(--warning)] border border-[var(--warning)]/20">
                          Third-party
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div
                        className="font-mono text-[11px] text-[var(--text-secondary)] truncate max-w-[280px]"
                        title={ext.dllPath || "(no DLL registered)"}
                      >
                        {ext.dllPath || <span className="italic text-[var(--text-muted)]">(unknown)</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleToggle(ext)}
                        disabled={isPending}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition disabled:opacity-60 ${
                          ext.isBlocked
                            ? "bg-[var(--error)]/15 text-[var(--error)] border border-[var(--error)]/20 hover:bg-[var(--error)]/25"
                            : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : ext.isBlocked ? (
                          "Blocked"
                        ) : (
                          <>
                            <Check className="w-3 h-3" />
                            Enabled
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
        active
          ? "bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent)]/30"
          : "bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)]"
      }`}
    >
      {children}
    </button>
  );
}
