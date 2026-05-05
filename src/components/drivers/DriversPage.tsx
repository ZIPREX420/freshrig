// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { useEffect } from "react";
import { Cpu, Info, RefreshCw } from "lucide-react";
import { useDriverStore } from "../../stores/driverStore";
import { DriverCard } from "./DriverCard";
import { PageShell } from "../ui/PageShell";
import { StatusPill } from "../ui/StatusPill";
import { Button } from "../ui/Button";

export function DriversPage() {
  const { recommendations, loading, error, fetchRecommendations } = useDriverStore();

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const status = !loading && !error && recommendations.length > 0
    ? <StatusPill kind="accent" size="sm" icon={Cpu}>{recommendations.length} recommendation{recommendations.length === 1 ? "" : "s"}</StatusPill>
    : !loading && !error && recommendations.length === 0
    ? <StatusPill kind="success" size="sm">All current</StatusPill>
    : null;

  const actions = (
    <Button variant="secondary" size="sm" onClick={fetchRecommendations} disabled={loading}>
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Scanning…" : "Rescan"}
    </Button>
  );

  return (
    <PageShell
      title="Driver Recommendations"
      subtitle="Based on your detected hardware"
      status={status}
      actions={actions}
    >
      {/* Info banner — only when there are recommendations to act on */}
      {!loading && !error && recommendations.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-info-soft border border-info-rim">
          <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary leading-relaxed">
            Intel devices install the <span className="font-semibold text-text-primary">Intel Driver &amp; Support Assistant</span>{" "}
            via winget, which then keeps drivers up to date. NVIDIA, AMD, and other vendors open the official download page
            in your browser — NVIDIA App and AMD Adrenalin aren't published on winget, so we can't install them silently.
          </p>
        </div>
      )}

      {/* Loading — shimmer instead of pulse */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 rounded-xl skeleton-shimmer border border-border" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-error-soft border border-error-rim flex items-center justify-center mb-4">
            <span className="text-error text-xl">!</span>
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Failed to detect drivers</h3>
          <p className="text-sm text-text-secondary max-w-md text-center mb-4">{error}</p>
          <Button onClick={fetchRecommendations}>Retry</Button>
        </div>
      )}

      {/* Recommendations grid */}
      {!loading && !error && recommendations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {recommendations.map((rec, i) => (
            <DriverCard key={`${rec.category}-${i}`} recommendation={rec} />
          ))}
        </div>
      )}

      {/* Empty state — no recommendations means everything is current */}
      {!loading && !error && recommendations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-success-soft border border-success-rim flex items-center justify-center mb-4">
            <Cpu className="w-6 h-6 text-success" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-1">All drivers current</h3>
          <p className="text-sm text-text-secondary">No driver recommendations for your detected hardware.</p>
        </div>
      )}
    </PageShell>
  );
}
