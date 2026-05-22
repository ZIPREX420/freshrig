// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Passphrase modal used by the Encrypted Profile Sync feature.
//
// Two modes:
//   * "encrypt" — confirm-passphrase + zxcvbn strength meter (5 segments).
//     Submit blocked while score < 2 OR confirmation mismatch.
//   * "decrypt" — single passphrase field, no strength meter.
//
// Mirrors the SaveProfileDialog modal frame (backdrop, escape close,
// fade-in, header/body/footer rhythm) so the visual language stays
// consistent across the Profiles page.
import { useEffect, useState } from "react";
import { Eye, EyeOff, X, Lock, ShieldCheck, KeyRound } from "lucide-react";
import type { ZxcvbnResult } from "@zxcvbn-ts/core";

// zxcvbn + its English dictionary are ~1 MB. They load on demand the first
// time the encrypt dialog needs a strength score — never at cold start and
// never on the Profiles route. The `import type` above is erased at build
// time, so it adds nothing to any bundle; the dynamic import() below is what
// pulls the code, and only when this dialog actually computes a score.
let zxcvbnFn: ((pass: string) => ZxcvbnResult) | null = null;
let zxcvbnLoading: Promise<void> | null = null;

function loadZxcvbn(): Promise<void> {
  if (zxcvbnFn) return Promise.resolve();
  if (!zxcvbnLoading) {
    zxcvbnLoading = Promise.all([
      import("@zxcvbn-ts/core"),
      import("@zxcvbn-ts/language-en"),
    ]).then(([core, en]) => {
      core.zxcvbnOptions.setOptions({
        translations: en.translations,
        dictionary: { ...en.dictionary },
      });
      zxcvbnFn = core.zxcvbn;
    });
  }
  return zxcvbnLoading;
}

interface PassphraseDialogProps {
  mode: "encrypt" | "decrypt";
  title?: string;
  description?: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (passphrase: string) => Promise<void> | void;
}

const SCORE_LABELS = ["Very weak", "Weak", "Fair", "Strong", "Excellent"];
const SCORE_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-400",
  "bg-emerald-500",
  "bg-emerald-400",
];
const MIN_ENCRYPT_SCORE = 2;

export function PassphraseDialog({
  mode,
  title,
  description,
  busy = false,
  onClose,
  onSubmit,
}: PassphraseDialogProps) {
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isEncrypt = mode === "encrypt";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Strength is async now — zxcvbn loads lazily on first use (see loadZxcvbn).
  // Until it resolves, `strength` is null and the Encrypt button stays
  // disabled, exactly as it would for an empty passphrase.
  const [strength, setStrength] = useState<ZxcvbnResult | null>(null);

  useEffect(() => {
    if (!isEncrypt || pass.length === 0) {
      setStrength(null);
      return;
    }
    let cancelled = false;
    loadZxcvbn().then(() => {
      if (cancelled || !zxcvbnFn) return;
      try {
        setStrength(zxcvbnFn(pass));
      } catch {
        setStrength(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pass, isEncrypt]);

  const confirmMismatch =
    isEncrypt && confirm.length > 0 && confirm !== pass;

  const canSubmit =
    !busy &&
    !submitting &&
    pass.length > 0 &&
    (isEncrypt
      ? confirm === pass &&
        strength !== null &&
        strength.score >= MIN_ENCRYPT_SCORE
      : true);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(pass);
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canSubmit) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const score = strength?.score ?? 0;
  const segments = 5;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-bg-elevated border border-border rounded-xl shadow-elevated w-full max-w-md mx-4 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            {isEncrypt ? (
              <Lock className="w-4 h-4 text-accent" />
            ) : (
              <KeyRound className="w-4 h-4 text-accent" />
            )}
            <h2 className="text-lg font-semibold text-text-primary">
              {title ?? (isEncrypt ? "Set passphrase" : "Enter passphrase")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-text-secondary">
            {description ??
              (isEncrypt
                ? "Pick a strong passphrase. You'll need it to decrypt this profile later. We never store it — losing it means the profile is unrecoverable."
                : "Enter the passphrase used when this profile was encrypted.")}
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">
              Passphrase
            </label>
            <div className="relative">
              <input
                type={reveal ? "text" : "password"}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={onKeyDownInput}
                autoFocus
                className="w-full px-3 py-2 pr-10 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors font-mono"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                className="absolute inset-y-0 right-0 px-2.5 flex items-center text-text-muted hover:text-text-primary transition-colors"
                aria-label={reveal ? "Hide passphrase" : "Show passphrase"}
              >
                {reveal ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {isEncrypt && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">
                  Confirm passphrase
                </label>
                <input
                  type={reveal ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={onKeyDownInput}
                  className={`w-full px-3 py-2 rounded-lg bg-bg-tertiary border text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-colors font-mono ${
                    confirmMismatch
                      ? "border-rose-500/60 focus:border-rose-500"
                      : "border-border focus:border-accent/50"
                  }`}
                  placeholder="••••••••"
                />
                {confirmMismatch && (
                  <p className="text-[11px] text-rose-400">
                    Passphrases do not match.
                  </p>
                )}
              </div>

              {/* Strength meter */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">
                    Strength
                  </span>
                  <span className="text-[11px] text-text-muted">
                    {pass.length === 0 ? "—" : SCORE_LABELS[score]}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: segments }).map((_, i) => {
                    const filled = pass.length > 0 && i <= score;
                    return (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          filled ? SCORE_COLORS[score] : "bg-bg-tertiary"
                        }`}
                      />
                    );
                  })}
                </div>
                {pass.length > 0 && score < MIN_ENCRYPT_SCORE && (
                  <p className="text-[11px] text-amber-400">
                    {strength?.feedback?.warning ||
                      "Choose a longer or less common passphrase."}
                  </p>
                )}
                {strength?.feedback?.suggestions?.[0] &&
                  pass.length > 0 &&
                  score < 4 && (
                    <p className="text-[11px] text-text-muted">
                      Tip: {strength.feedback.suggestions[0]}
                    </p>
                  )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              canSubmit
                ? "bg-accent text-bg-primary hover:bg-accent-hover"
                : "bg-bg-tertiary text-text-muted cursor-not-allowed"
            }`}
          >
            {isEncrypt ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            {submitting || busy
              ? isEncrypt
                ? "Encrypting…"
                : "Decrypting…"
              : isEncrypt
                ? "Encrypt"
                : "Decrypt"}
          </button>
        </div>
      </div>
    </div>
  );
}
