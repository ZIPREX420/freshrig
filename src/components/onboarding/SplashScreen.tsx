// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { History } from "lucide-react";
import { BrandMark, BrandWordmark } from "../ui/BrandMark";
import { HeroCTA } from "../ui/HeroCTA";
import { CircuitBackdrop } from "../ui/CircuitBackdrop";
import { APP_TAGLINE } from "../../config/app";
import { useHardwareStore } from "../../stores/hardwareStore";
import { useT } from "../../i18n";

export type SplashVariant = "first-launch" | "returning";

export interface SplashScreenProps {
  variant?: SplashVariant;
  onStart: () => void;
  onLogin?: () => void;
  onLoadLast?: () => void;
}

export function SplashScreen({
  variant = "first-launch",
  onStart,
  onLogin,
  onLoadLast,
}: SplashScreenProps) {
  if (variant === "returning") {
    return <ReturningSplash onStart={onStart} onLoadLast={onLoadLast} />;
  }
  return <FirstLaunchSplash onStart={onStart} onLogin={onLogin} />;
}

function FirstLaunchSplash({
  onStart,
  onLogin,
}: {
  onStart: () => void;
  onLogin?: () => void;
}) {
  const t = useT();
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      <CircuitBackdrop accent="dual" density="dense" showCityscape />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        <BrandMark size={120} />
        <BrandWordmark className="mt-6 text-[36px]" />
        <p className="mt-4 text-[12px] uppercase tracking-[0.32em] text-text-secondary">
          {APP_TAGLINE}
        </p>

        <p className="mt-12 text-text-secondary text-[15px] leading-relaxed">
          {t("splash.intro")}
        </p>

        <div className="mt-10 w-full">
          <HeroCTA accent="cyan" onClick={onStart}>
            {t("splash.start")}
          </HeroCTA>
        </div>

        {onLogin && (
          <button
            type="button"
            onClick={onLogin}
            className="mt-6 text-[12px] uppercase tracking-[0.18em] text-text-secondary hover:text-text-primary transition-colors"
          >
            {t("splash.signin")}
          </button>
        )}
      </div>
    </div>
  );
}

function ReturningSplash({
  onStart,
  onLoadLast,
}: {
  onStart: () => void;
  onLoadLast?: () => void;
}) {
  const t = useT();
  const { summary } = useHardwareStore();

  return (
    <div className="relative min-h-screen flex items-center px-8 lg:px-14 overflow-hidden">
      <CircuitBackdrop accent="dual" density="normal" showCityscape />

      {/* Left brand column */}
      <div className="relative z-10 flex flex-col items-center justify-center w-[36%] max-w-sm shrink-0">
        <BrandMark size={130} />
        <p className="mt-6 text-[11px] uppercase tracking-[0.32em] text-text-muted text-center">
          {APP_TAGLINE}
        </p>
      </div>

      {/* Centre: CTA copy */}
      <div className="relative z-10 flex-1 min-w-0 px-8 lg:px-12">
        <p className="text-text-muted text-[13px] mb-2">{t("splash.welcomeBack")}</p>
        <h1
          className="text-[36px] lg:text-[44px] leading-tight font-semibold mb-5 uppercase"
          style={{ color: "var(--accent-magenta)" }}
        >
          {t("splash.readyHeadline")}
        </h1>
        <p className="text-text-secondary text-[14px] mb-8 max-w-sm">
          {t("splash.pickOption")}
        </p>
        <HeroCTA accent="cyan" fullWidth={false} onClick={onStart}>
          {t("splash.getStarted")}
        </HeroCTA>
        {onLoadLast && (
          <button
            type="button"
            onClick={onLoadLast}
            className="mt-5 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-text-secondary hover:text-text-primary transition-colors"
          >
            <History className="w-4 h-4" />
            {t("splash.loadLast")}
          </button>
        )}
      </div>

      {/* Right: System overview card (matches mockup top-left second image) */}
      {summary && (
        <div className="relative z-10 w-[260px] shrink-0 hidden lg:block">
          <div className="rounded-lg border border-[var(--accent-cyan-rim)] bg-[var(--bg-card)]"
               style={{ boxShadow: "0 0 0 1px var(--accent-cyan-rim), 0 0 24px -8px var(--accent-cyan-glow)" }}>
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                System overview
              </span>
            </div>
            <dl className="px-4 py-3 space-y-2.5">
              {[
                { label: "OS",  value: summary.system?.osVersion },
                { label: "CPU", value: summary.cpu?.name },
                { label: "GPU", value: summary.gpus?.[0]?.name },
                { label: "RAM", value: `${Math.round(summary.system?.totalRamGb ?? 0)} GB` },
              ].filter(r => r.value).map(({ label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <dt className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-muted w-10 shrink-0 pt-0.5">{label}</dt>
                  <dd className="text-[11.5px] font-mono text-text-secondary leading-tight truncate" title={value}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

export default SplashScreen;
