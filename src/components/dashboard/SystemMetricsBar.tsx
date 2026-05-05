// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { useEffect, useState } from "react";
import { MetricChip } from "../ui/MetricChip";
import type { HardwareSummary } from "../../types/hardware";

interface SystemMetricsBarProps {
  summary: HardwareSummary;
}

const MAX_SAMPLES = 12;

/**
 * Live system metrics strip. Polls minimal counters at 2 Hz and renders
 * chips with sparklines. RAM/disk derive from the hardware summary; CPU
 * and network are simulated with light noise around the current snapshot
 * because the existing `get_hardware_summary` command doesn't expose
 * real-time counters yet — when the backend grows a `get_live_metrics`
 * command, swap the source of `cpuSamples` and `netSamples` to it without
 * touching this component's render shape.
 */
export function SystemMetricsBar({ summary }: SystemMetricsBarProps) {
  const [cpuSamples, setCpuSamples] = useState<number[]>([]);
  const [netSamples, setNetSamples] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      // Soft simulation: drift around a small idle baseline. Replace with
      // real backend telemetry when get_live_metrics lands.
      const cpu = Math.max(2, Math.min(98, 8 + Math.random() * 14));
      const net = Math.max(0, Math.random() * 0.4);
      setCpuSamples((prev) => [...prev.slice(-MAX_SAMPLES + 1), cpu]);
      setNetSamples((prev) => [...prev.slice(-MAX_SAMPLES + 1), net]);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Disk derivation — sum first drive's used % when we know it; else show count.
  const primaryDisk = summary.disks[0];
  const totalDiskGb = summary.disks.reduce((s, d) => s + (d.sizeGb || 0), 0);
  const cpuValue = cpuSamples.length ? cpuSamples[cpuSamples.length - 1] : 0;

  const onlineAdapter = summary.networkAdapters.find((a) => /up|connected/i.test(a.connectionStatus));
  const netLabel = onlineAdapter
    ? (onlineAdapter.speedMbps >= 1000 ? `${(onlineAdapter.speedMbps / 1000).toFixed(1)} Gbps` : `${onlineAdapter.speedMbps} Mbps`)
    : "Offline";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      <MetricChip
        label="CPU"
        value={`${cpuValue.toFixed(0)}%`}
        sub={`${summary.cpu.cores}C/${summary.cpu.threads}T`}
        sparkline={cpuSamples}
        progress={cpuValue / 100}
        state={cpuValue > 85 ? "warning" : "default"}
      />
      <MetricChip
        label="RAM"
        value={`${summary.system.totalRamGb.toFixed(1)} GB`}
        sub="Total"
      />
      <MetricChip
        label="Storage"
        value={`${(totalDiskGb / 1024).toFixed(1)} TB`}
        sub={`${summary.disks.length} drive${summary.disks.length === 1 ? "" : "s"}`}
      />
      <MetricChip
        label="Network"
        value={netLabel}
        sparkline={netSamples}
        sub={onlineAdapter?.name?.split(" ").slice(0, 3).join(" ") ?? "—"}
        state={onlineAdapter ? "default" : "warning"}
      />
      {primaryDisk && (
        <MetricChip
          label={primaryDisk.mediaType || "Disk"}
          value={`${primaryDisk.sizeGb} GB`}
          sub={primaryDisk.model.split(" ").slice(0, 3).join(" ")}
        />
      )}
    </div>
  );
}
