// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { Crown, Clock, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { useLicenseStore } from "../../stores/licenseStore";
import { PRO_PURCHASE_URL, PRO_PRICE_LABEL, TRIAL_DAYS } from "../../config/app";

interface ProFeatureGateProps {
  feature: string;
  children: React.ReactNode;
  mode?: "blur" | "overlay" | "badge" | "hide";
  /**
   * Minimum tier required to view content unblurred. Defaults to "pro" so
   * all existing call sites keep their original behavior. Set to "business"
   * for features that need a Pro Business license; in that case Pro users
   * see a "Pro Business required" upsell instead of full access.
   */
  tier?: "pro" | "business";
  fallback?: React.ReactNode;
}

function openPurchasePage() {
  window.open(PRO_PURCHASE_URL, "_blank", "noopener,noreferrer");
}

function UpsellCard({
  feature,
  compact = false,
  needsBusiness = false,
}: {
  feature: string;
  compact?: boolean;
  needsBusiness?: boolean;
}) {
  const canStartTrial = useLicenseStore((s) => s.canStartTrial());
  const startTrial = useLicenseStore((s) => s.startTrial);
  const isTrial = useLicenseStore((s) => s.isTrial());
  const trialDays = useLicenseStore((s) => s.trialDaysRemaining());

  const onStartTrial = () => {
    const r = startTrial();
    if (r.ok) {
      toast.success(`${TRIAL_DAYS}-day Pro trial started — enjoy!`);
    } else {
      toast.error(r.error ?? "Could not start trial");
    }
  };

  const Icon = needsBusiness ? Briefcase : Crown;
  // Centralized upsell tokens — see --upsell-* in src/styles.css.
  const tone = needsBusiness ? "text-upsell-business" : "text-upsell-pro";

  return (
    <div
      role="region"
      aria-label="Upgrade required"
      className={`flex flex-col items-center gap-2 ${compact ? "" : "max-w-xs"}`}
    >
      <Icon className={compact ? `w-6 h-6 ${tone}` : `w-8 h-8 ${tone}`} />
      <p className="text-text-primary font-semibold">
        {needsBusiness ? "Pro Business required" : `Unlock ${feature}`}
      </p>
      {needsBusiness && (
        <p className="text-xs text-text-secondary text-center">
          {feature} ships with the Pro Business plan.
        </p>
      )}
      <button
        onClick={openPurchasePage}
        className="inline-flex items-center gap-2 bg-upsell-pro hover:bg-upsell-pro-hover text-black px-4 py-2 rounded-lg font-semibold transition-colors"
      >
        {needsBusiness ? "Upgrade to Pro Business" : "Upgrade to Pro"}
      </button>
      <p className="text-xs text-text-secondary">{PRO_PRICE_LABEL}</p>
      {!needsBusiness && (
        <>
          {isTrial ? (
            <p className="text-xs text-upsell-pro flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Trial: {trialDays} day{trialDays === 1 ? "" : "s"} left
            </p>
          ) : canStartTrial ? (
            <button
              onClick={onStartTrial}
              className="text-xs text-accent hover:text-accent-hover underline underline-offset-2"
            >
              Or start a {TRIAL_DAYS}-day free trial
            </button>
          ) : (
            <p className="text-xs text-text-muted">Trial already activated</p>
          )}
        </>
      )}
    </div>
  );
}

export function ProFeatureGate({
  feature,
  children,
  mode = "overlay",
  tier = "pro",
  fallback,
}: ProFeatureGateProps) {
  const isPro = useLicenseStore((s) => s.isPro());
  const isBusiness = useLicenseStore((s) => s.isBusiness());

  const allowed = tier === "business" ? isBusiness : isPro;

  if (allowed) {
    return <>{children}</>;
  }

  // Pro user looking at a Business-tier feature: still upsell, but with the
  // "Pro Business required" copy via the needsBusiness flag.
  const needsBusiness = tier === "business" && isPro;

  if (mode === "hide") {
    return fallback ? <>{fallback}</> : null;
  }

  if (mode === "badge") {
    return (
      <div className="relative">
        {children}
        <div
          className={`absolute top-2 right-2 flex items-center gap-1 ${
            needsBusiness ? "bg-upsell-business" : "bg-upsell-pro"
          } text-black text-xs font-semibold px-2 py-0.5 rounded-full`}
        >
          {needsBusiness ? (
            <Briefcase className="w-3 h-3" />
          ) : (
            <Crown className="w-3 h-3" />
          )}
          {needsBusiness ? "BUSINESS" : "PRO"}
        </div>
      </div>
    );
  }

  if (mode === "blur") {
    return (
      <div className="relative">
        <div aria-hidden="true" className="blur-sm pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/70 rounded-lg">
          <UpsellCard feature={feature} needsBusiness={needsBusiness} />
        </div>
      </div>
    );
  }

  // overlay mode (default)
  return (
    <div className="relative group">
      <div aria-hidden="true" className="opacity-40 pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-bg-primary/60 rounded-lg">
        <UpsellCard feature={feature} needsBusiness={needsBusiness} />
      </div>
    </div>
  );
}
