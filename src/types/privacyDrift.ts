// Mirrors src-tauri/src/commands/privacy_drift.rs.

export type DriftSeverity = "High" | "Medium" | "Low";

export interface PrivacyBaseline {
  createdAt: string;
  windowsBuild: string;
  entries: Record<string, string>;
}

export interface DriftEntry {
  registryPath: string;
  settingName: string;
  baselineValue: string | null;
  currentValue: string | null;
  severity: DriftSeverity;
}
