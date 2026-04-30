// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Pro Business integrations — RepairShopr, generic webhook, SMTP. All
// secrets live in the OS keyring; this UI shows "********" once a value
// has been saved and only sends new values when the operator types one.

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  Briefcase,
  CheckCircle,
  Globe,
  Loader2,
  Mail,
  Plug,
  Save,
  TestTube,
} from "lucide-react";
import { ProFeatureGate } from "../ui/ProFeatureGate";
import { useLicenseStore } from "../../stores/licenseStore";
import {
  DEFAULT_INTEGRATIONS,
  type IntegrationConfig,
  type WebhookProvider,
} from "../../types/integrations";

export function IntegrationsSection() {
  const isBusiness = useLicenseStore((s) => s.isBusiness());
  const [cfg, setCfg] = useState<IntegrationConfig>(DEFAULT_INTEGRATIONS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<WebhookProvider | null>(null);

  useEffect(() => {
    invoke<IntegrationConfig>("get_integrations")
      .then(setCfg)
      .catch(() => {
        // Keep defaults.
      })
      .finally(() => setLoaded(true));
  }, []);

  const updateRepairshopr = (
    fn: (curr: IntegrationConfig["repairshopr"]) => IntegrationConfig["repairshopr"],
  ) => setCfg((c) => ({ ...c, repairshopr: fn(c.repairshopr) }));

  const updateSmtp = (
    fn: (curr: IntegrationConfig["smtp"]) => IntegrationConfig["smtp"],
  ) => setCfg((c) => ({ ...c, smtp: fn(c.smtp) }));

  const onSave = async () => {
    setSaving(true);
    try {
      await invoke("set_integrations", { config: cfg, isBusiness });
      // Refresh to pick up the masked secrets.
      const fresh = await invoke<IntegrationConfig>("get_integrations");
      setCfg(fresh);
      toast.success("Integrations saved");
    } catch (err) {
      toast.error(`Save failed: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const onTest = async (provider: WebhookProvider) => {
    setTesting(provider);
    try {
      await invoke("test_webhook", { provider });
      toast.success(`${provider} connection looks good`);
    } catch (err) {
      toast.error(`Test failed: ${err}`);
    } finally {
      setTesting(null);
    }
  };

  return (
    <ProFeatureGate feature="MSP Integrations" tier="business" mode="overlay">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Plug className="w-4 h-4 text-blue-400" />
          Integrations
        </h2>
        <div className="bg-bg-card border border-border rounded-lg p-5 space-y-6">
          {/* RepairShopr */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary inline-flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              RepairShopr / Syncro
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field
                label="Subdomain"
                value={cfg.repairshopr?.subdomain ?? ""}
                placeholder="acme"
                onChange={(v) =>
                  updateRepairshopr((curr) => ({
                    apiKey: curr?.apiKey ?? "",
                    subdomain: v,
                  }))
                }
              />
              <Field
                label="API key"
                type="password"
                value={cfg.repairshopr?.apiKey ?? ""}
                placeholder="API key (stored in keyring)"
                onChange={(v) =>
                  updateRepairshopr((curr) => ({
                    apiKey: v,
                    subdomain: curr?.subdomain ?? "",
                  }))
                }
              />
            </div>
            <button
              onClick={() => onTest("repairshopr")}
              disabled={!loaded || testing !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-border transition-colors disabled:opacity-60"
            >
              {testing === "repairshopr" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <TestTube className="w-3.5 h-3.5" />
              )}
              Test connection
            </button>
          </div>

          {/* Generic webhook */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-text-primary inline-flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Generic webhook
            </h3>
            <Field
              label="Webhook URL"
              value={cfg.genericWebhookUrl ?? ""}
              placeholder="https://hooks.example.com/freshrig"
              onChange={(v) => setCfg((c) => ({ ...c, genericWebhookUrl: v || null }))}
            />
            <button
              onClick={() => onTest("generic")}
              disabled={!loaded || testing !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-border transition-colors disabled:opacity-60"
            >
              {testing === "generic" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <TestTube className="w-3.5 h-3.5" />
              )}
              Test connection
            </button>
          </div>

          {/* SMTP */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-text-primary inline-flex items-center gap-2">
              <Mail className="w-4 h-4" />
              SMTP (used by maintenance contracts)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field
                label="Host"
                value={cfg.smtp?.host ?? ""}
                placeholder="smtp.example.com"
                onChange={(v) =>
                  updateSmtp((curr) => ({
                    host: v,
                    port: curr?.port ?? 587,
                    username: curr?.username ?? "",
                    password: curr?.password ?? "",
                    fromAddress: curr?.fromAddress ?? "",
                  }))
                }
              />
              <Field
                label="Port"
                type="number"
                value={String(cfg.smtp?.port ?? 587)}
                onChange={(v) =>
                  updateSmtp((curr) => ({
                    host: curr?.host ?? "",
                    port: Number(v) || 587,
                    username: curr?.username ?? "",
                    password: curr?.password ?? "",
                    fromAddress: curr?.fromAddress ?? "",
                  }))
                }
              />
              <Field
                label="Username"
                value={cfg.smtp?.username ?? ""}
                placeholder="hello@example.com"
                onChange={(v) =>
                  updateSmtp((curr) => ({
                    host: curr?.host ?? "",
                    port: curr?.port ?? 587,
                    username: v,
                    password: curr?.password ?? "",
                    fromAddress: curr?.fromAddress ?? "",
                  }))
                }
              />
              <Field
                label="Password"
                type="password"
                value={cfg.smtp?.password ?? ""}
                placeholder="App password"
                onChange={(v) =>
                  updateSmtp((curr) => ({
                    host: curr?.host ?? "",
                    port: curr?.port ?? 587,
                    username: curr?.username ?? "",
                    password: v,
                    fromAddress: curr?.fromAddress ?? "",
                  }))
                }
              />
              <Field
                label="From address"
                value={cfg.smtp?.fromAddress ?? ""}
                placeholder="reports@example.com"
                onChange={(v) =>
                  updateSmtp((curr) => ({
                    host: curr?.host ?? "",
                    port: curr?.port ?? 587,
                    username: curr?.username ?? "",
                    password: curr?.password ?? "",
                    fromAddress: v,
                  }))
                }
              />
            </div>
            <button
              onClick={() => onTest("smtp")}
              disabled={!loaded || testing !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-border transition-colors disabled:opacity-60"
            >
              {testing === "smtp" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <TestTube className="w-3.5 h-3.5" />
              )}
              Send test email
            </button>
          </div>

          {/* Save */}
          <div className="flex justify-end pt-4 border-t border-border">
            <button
              onClick={onSave}
              disabled={!loaded || saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-bg-primary text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save integrations
            </button>
          </div>

          <p className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
            <CheckCircle className="w-3 h-3 text-emerald-500" />
            All API keys and SMTP passwords are stored in your OS keyring.
          </p>
        </div>
      </section>
    </ProFeatureGate>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password" | "number";
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-text-secondary">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
      />
    </div>
  );
}
