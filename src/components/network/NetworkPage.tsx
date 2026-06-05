import { useCallback, useEffect, useMemo, useState } from "react";
import { errMessage, runAction } from "../../lib";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  Globe,
  RefreshCw,
  Wrench,
  Wifi,
  Eye,
  EyeOff,
  Copy,
  AlertTriangle,
  Check,
  Loader2,
  Signal,
  ShieldCheck,
} from "lucide-react";
import { Card } from "../ui/Card";
import { ProFeatureGate } from "../ui/ProFeatureGate";
import {
  DNS_PRESETS,
  type DnsPreset,
  type NetworkInterface,
  type WifiProfile,
} from "../../types/network";

export function NetworkPage() {
  return (
    <ProFeatureGate feature="network" mode="blur">
      <NetworkPageInner />
    </ProFeatureGate>
  );
}

function NetworkPageInner() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Network Tools</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Flush DNS, reset the network stack, configure DNS servers, and recover saved Wi-Fi passwords
        </p>
      </header>

      <QuickActions />
      <DnsConfiguration />
      <WifiPasswords />
    </div>
  );
}

// ───────── Quick Actions ─────────

function QuickActions() {
  const [flushing, setFlushing] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleFlush = useCallback(async () => {
    await runAction(setFlushing, () => invoke("network_reset_dns"), {
      success: "DNS cache flushed",
      failure: "Failed to flush DNS",
    });
  }, []);

  const handleFullReset = useCallback(async () => {
    const ok = await runAction(setResetting, () => invoke("network_reset_full"), {
      success: "Network stack reset — reboot required",
      failure: "Failed to reset network",
    });
    if (ok) setConfirmReset(false);
  }, []);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Flush DNS Cache</h3>
              <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                Clear stale DNS entries. Fixes most "site can't be reached" hiccups without a reboot.
              </p>
              <button
                onClick={handleFlush}
                disabled={flushing}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--accent)] text-black text-sm font-medium hover:brightness-110 disabled:opacity-60 transition"
              >
                {flushing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Flushing…
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Flush Now
                  </>
                )}
              </button>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 rounded-lg bg-[var(--warning)]/15 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Full Network Reset</h3>
              <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                Reset Winsock and TCP/IP stack. Last-resort fix for deep connectivity issues. Requires reboot.
              </p>
              <button
                onClick={() => setConfirmReset(true)}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--warning)]/40 text-[var(--warning)] text-sm font-medium hover:bg-[var(--warning)]/10 transition"
              >
                <Wrench className="w-4 h-4" />
                Reset Network Stack…
              </button>
            </div>
          </div>
        </Card>
      </div>

      {confirmReset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => !resetting && setConfirmReset(false)}
        >
          <div
            className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[var(--warning)]/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Reboot required</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
                  This flushes DNS, resets Winsock, and resets IPv4/IPv6. Your PC will lose network
                  connectivity until you restart. Save any open work first.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmReset(false)}
                disabled={resetting}
                className="px-3 py-1.5 rounded-md text-sm text-[var(--text-secondary)] hover:bg-white/[0.04] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleFullReset}
                disabled={resetting}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--warning)] text-black text-sm font-medium hover:brightness-110 disabled:opacity-60 transition"
              >
                {resetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Resetting…
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4" />
                    Reset Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ───────── DNS Configuration ─────────

function DnsConfiguration() {
  const [interfaces, setInterfaces] = useState<NetworkInterface[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [applying, setApplying] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await invoke<NetworkInterface[]>("get_network_interfaces");
        setInterfaces(list);
        if (list.length > 0) setSelected(list[0].name);
      } catch (e) {
        setInterfaces([]);
        toast.error(errMessage(e, "Failed to load interfaces"));
      }
    })();
  }, []);

  const applyPreset = useCallback((preset: DnsPreset) => {
    setPrimary(preset.primary);
    setSecondary(preset.secondary);
    setActivePreset(preset.name);
  }, []);

  const handleApply = useCallback(async () => {
    if (!selected) {
      toast.error("Select a network interface first");
      return;
    }
    if (!primary.trim()) {
      toast.error("Primary DNS is required");
      return;
    }
    await runAction(
      setApplying,
      () =>
        invoke("set_dns_servers", {
          interfaceName: selected,
          primary: primary.trim(),
          secondary: secondary.trim() || null,
        }),
      { success: `DNS updated on ${selected}`, failure: "Failed to apply DNS" },
    );
  }, [selected, primary, secondary]);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-4 h-4 text-[var(--accent)]" />
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">DNS Configuration</h3>
      </div>

      {/* Interface selector */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
            Network interface
          </label>
          {interfaces === null ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning interfaces…
            </div>
          ) : interfaces.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No active physical interfaces found.</p>
          ) : (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              {interfaces.map((iface) => (
                <option key={iface.index} value={iface.name}>
                  {iface.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Preset pills */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
            Presets
          </label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {DNS_PRESETS.map((preset) => {
              const active = activePreset === preset.name;
              return (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className={`text-left px-3 py-2 rounded-md border text-sm transition ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)]"
                      : "border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <div className="font-medium flex items-center gap-1.5">
                    {active && <Check className="w-3 h-3 text-[var(--accent)]" />}
                    {preset.name}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5 font-mono">
                    {preset.primary}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
              Primary DNS
            </label>
            <input
              type="text"
              value={primary}
              onChange={(e) => {
                setPrimary(e.target.value);
                setActivePreset(null);
              }}
              placeholder="e.g. 1.1.1.1"
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-md px-3 py-2 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
              Secondary DNS (optional)
            </label>
            <input
              type="text"
              value={secondary}
              onChange={(e) => {
                setSecondary(e.target.value);
                setActivePreset(null);
              }}
              placeholder="e.g. 1.0.0.1"
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-md px-3 py-2 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <button
          onClick={handleApply}
          disabled={applying || !selected || !primary.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--accent)] text-black text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {applying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Applying…
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Apply DNS
            </>
          )}
        </button>
      </div>
    </Card>
  );
}

// ───────── WiFi Passwords ─────────

function WifiPasswords() {
  const [profiles, setProfiles] = useState<WifiProfile[] | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await invoke<WifiProfile[]>("get_wifi_passwords");
      setProfiles(list);
    } catch (e) {
      setProfiles([]);
      toast.error(errMessage(e, "Failed to read Wi-Fi profiles"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = useCallback((ssid: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(ssid)) next.delete(ssid);
      else next.add(ssid);
      return next;
    });
  }, []);

  const copy = useCallback(async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Password copied");
    } catch {
      toast.error("Clipboard unavailable");
    }
  }, []);

  const sorted = useMemo(
    () => (profiles ?? []).slice().sort((a, b) => a.ssid.localeCompare(b.ssid)),
    [profiles],
  );

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Saved Wi-Fi Passwords</h3>
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

      {loading && profiles === null ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Reading saved profiles…
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-[var(--text-muted)]">
          <Signal className="w-8 h-8 opacity-40" />
          <p className="text-sm">No saved Wi-Fi profiles found.</p>
        </div>
      ) : (
        <div className="overflow-hidden border border-[var(--border)] rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">SSID</th>
                <th className="text-left px-3 py-2 font-medium">Auth</th>
                <th className="text-left px-3 py-2 font-medium">Password</th>
                <th className="w-20 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((profile) => {
                const hasPassword = profile.password !== null && profile.password !== "";
                const show = revealed.has(profile.ssid);
                return (
                  <tr
                    key={profile.ssid}
                    className="border-t border-[var(--border)] hover:bg-white/[0.02]"
                  >
                    <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{profile.ssid}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{profile.authType}</td>
                    <td className="px-3 py-2 font-mono text-[var(--text-primary)]">
                      {hasPassword
                        ? show
                          ? profile.password
                          : "••••••••••"
                        : <span className="text-[var(--text-muted)] italic font-sans">No PSK (Enterprise)</span>}
                    </td>
                    <td className="px-3 py-2">
                      {hasPassword && (
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => toggle(profile.ssid)}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition"
                            title={show ? "Hide" : "Reveal"}
                          >
                            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => profile.password && copy(profile.password)}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition"
                            title="Copy"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      )}
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
