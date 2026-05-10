// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { History } from "lucide-react";
import { BrandMark, BrandWordmark } from "../ui/BrandMark";
import { HeroCTA } from "../ui/HeroCTA";
import { CircuitBackdrop } from "../ui/CircuitBackdrop";
import { APP_TAGLINE } from "../../config/app";
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
      <CircuitBackdrop accent="dual" density="dense" />

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
  return (
    <div className="relative min-h-screen flex items-center px-12 overflow-hidden">
      <CircuitBackdrop accent="dual" density="normal" />

      <div className="relative z-10 flex flex-col items-center justify-center w-[40%] max-w-md">
        <BrandMark size={140} />
        <p className="mt-8 text-[12px] uppercase tracking-[0.32em] text-text-muted">
          {APP_TAGLINE}
        </p>
      </div>

      <div className="relative z-10 flex-1 max-w-xl pl-12">
        <p className="text-text-muted text-[14px] mb-3">{t("splash.welcomeBack")}</p>
        <h1
          className="text-[44px] leading-tight font-semibold mb-6 uppercase"
          style={{ color: "var(--accent-magenta)" }}
        >
          {t("splash.readyHeadline")}
        </h1>
        <p className="text-text-secondary text-[15px] mb-10">
          {t("splash.pickOption")}
        </p>
        <HeroCTA accent="cyan" fullWidth={false} onClick={onStart}>
          {t("splash.getStarted")}
        </HeroCTA>
        <div className="flex items-center gap-4 mt-8">
          <span className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
            {t("splash.or")}
          </span>
          <span className="h-px flex-1 bg-[var(--border)]" />
        </div>
        {onLoadLast && (
          <button
            type="button"
            onClick={onLoadLast}
            className="mt-6 inline-flex items-center gap-2 text-[13px] uppercase tracking-[0.14em] text-text-secondary hover:text-text-primary transition-colors"
          >
            <History className="w-4 h-4" />
            {t("splash.loadLast")}
          </button>
        )}
      </div>
    </div>
  );
}

export default SplashScreen;
