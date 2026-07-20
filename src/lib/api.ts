// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Typed IPC contract — the single source of truth for every Tauri command the
// frontend calls. Each function names a command exactly once and pins its
// argument shape and return type, so a typo in a command name or a wrong
// payload is a compile error instead of a runtime failure.
//
// Before this module, 100+ call sites across 30+ files passed raw command-name
// strings to `invoke<T>(...)` with caller-supplied, unchecked generics. Two
// commands (`list_profiles`, `get_hardware_summary`) had already drifted into
// two different declared return types. Routing every call through `api.*`
// removes the magic strings, removes the per-call generics, and decouples the
// UI layer from `@tauri-apps/api/core`.
//
// Layering: this module (lib) depends only on `types/*`. Stores and components
// depend on this module — never the other way around. IPC response DTOs that
// previously lived inside a store/component (`LicenseResponse`,
// `WingetPackageDetails`) are defined here so that layering holds.
//
// The handful of reads that want "show a toast and return null on failure"
// semantics (get_app_catalog, get_custom_apps, search_winget_packages) stay on
// `invokeOrToast` by design — see ./invoke.ts. Everything else throws, matching
// the try/catch control flow the callers already use.

import { invoke } from "@tauri-apps/api/core";

import type { AppEntry, InstallSummary } from "../types/apps";
import type { CustomAppEntry } from "../types/custom_apps";
import type { PresetProfile } from "../types/presets";
import type { DriverRecommendation } from "../types/drivers";
import type { HardwareSummary, DriverIssue } from "../types/hardware";
import type { DebloatTweak, DebloatResult } from "../types/debloat";
import type { RigProfile, ProfileSummary, SourceHardware } from "../types/profiles";
import type { DetectedProfile } from "../types/profileSync";
import type { CleanupCategory, CleanupResult } from "../types/cleanup";
import type { ShellExtension } from "../types/contextMenu";
import type { SmartReading } from "../types/smart";
import type { PrivacySetting, AppPermission } from "../types/privacy";
import type { DriftEntry, PrivacyBaseline } from "../types/privacyDrift";
import type { NetworkInterface, WifiProfile } from "../types/network";
import type {
  ServiceEntry,
  ServicePreset,
  ServicePresetResult,
  ServiceStartType,
} from "../types/services";
import type { StartupEntry } from "../types/startup";
import type { Snapshot, SnapshotDiff } from "../types/watchdog";
import type { Machine, EndpointBundle, MaintenanceContract } from "../types/fleet";
import type { ReportData } from "../types/report";
import type { Branding } from "../types/branding";
import type { IntegrationConfig, WebhookProvider } from "../types/integrations";

// ── IPC response DTOs owned by the contract layer ──────────────────────────

/** Result of `activate_license` / `validate_license`. */
export interface LicenseResponse {
  valid: boolean;
  // Mirrors LicenseTier ("free" | "pro" | "business") inline so the contract
  // layer never has to import upward from the store.
  tier: "free" | "pro" | "business";
  instanceId: string | null;
  licenseKey: string | null;
  customerName: string | null;
  customerEmail: string | null;
  expiresAt: string | null;
  error: string | null;
}

/** Result of `get_winget_package_info`. */
export interface WingetPackageDetails {
  id: string;
  name: string;
  version: string;
  publisher: string | null;
  description: string | null;
  homepage: string | null;
  license: string | null;
}

/**
 * The typed command surface. Each method is a thin, fully-typed wrapper over a
 * single Tauri command. Field names use camelCase; Tauri converts them to the
 * snake_case the Rust handlers expect.
 */
export const api = {
  // ── Apps ─────────────────────────────────────────────────────────────────
  installApps: (args: { appIds: string[] }) => invoke<InstallSummary>("install_apps", args),
  checkWingetAvailable: () => invoke<boolean>("check_winget_available"),
  checkAppsInstalled: (args: { wingetIds: string[]; catalogNames: string[] }) =>
    invoke<string[]>("check_apps_installed", args),
  saveCustomApp: (args: { app: CustomAppEntry }) => invoke<void>("save_custom_app", args),
  deleteCustomApp: (args: { appId: string }) => invoke<void>("delete_custom_app", args),
  downloadAndInstallCustomApp: (args: { app: CustomAppEntry }) =>
    invoke<void>("download_and_install_custom_app", args),
  getFreeDiskSpaceGb: () => invoke<number>("get_free_disk_space_gb"),
  checkNetworkConnectivity: () => invoke<boolean>("check_network_connectivity"),
  getWingetPackageInfo: (args: { packageId: string }) =>
    invoke<WingetPackageDetails>("get_winget_package_info", args),

  // ── Presets ────────────────────────────────────────────────────────────────
  getPresets: () => invoke<PresetProfile[]>("get_presets"),

  // ── Drivers ──────────────────────────────────────────────────────────────
  getDriverRecommendations: () =>
    invoke<DriverRecommendation[]>("get_driver_recommendations"),
  installDriver: (args: { wingetId: string }) => invoke<string>("install_driver", args),

  // ── Hardware ───────────────────────────────────────────────────────────────
  getHardwareSummary: () => invoke<HardwareSummary>("get_hardware_summary"),
  getDriverIssues: () => invoke<DriverIssue[]>("get_driver_issues"),

  // ── Debloat / Optimize ─────────────────────────────────────────────────────
  getDebloatTweaks: () => invoke<DebloatTweak[]>("get_debloat_tweaks"),
  createRestorePoint: () => invoke<string>("create_restore_point"),
  applyDebloatTweaks: (args: { tweakIds: string[]; dryRun: boolean }) =>
    invoke<DebloatResult[]>("apply_debloat_tweaks", args),

  // ── Profiles ───────────────────────────────────────────────────────────────
  listProfiles: () => invoke<ProfileSummary[]>("list_profiles"),
  saveProfile: (args: { profile: RigProfile }) => invoke<string>("save_profile", args),
  loadProfile: (args: { filePath: string }) => invoke<RigProfile>("load_profile", args),
  deleteProfile: (args: { filePath: string }) => invoke<void>("delete_profile", args),
  exportProfileToFile: (args: { profile: RigProfile }) =>
    invoke<string>("export_profile_to_file", args),
  importProfileFromFile: () => invoke<RigProfile>("import_profile_from_file"),
  exportProfileAsText: (args: { profile: RigProfile; catalog: AppEntry[] }) =>
    invoke<string>("export_profile_as_text", args),
  compressProfile: (args: { profile: RigProfile }) =>
    invoke<string>("compress_profile", args),
  decompressProfile: (args: { encoded: string }) =>
    invoke<RigProfile>("decompress_profile", args),
  getCurrentHardwareSnapshot: () =>
    invoke<SourceHardware>("get_current_hardware_snapshot"),

  // ── Encrypted profile sync ─────────────────────────────────────────────────
  exportProfileEncrypted: (args: {
    profileJson: string;
    passphrase: string;
    outputPath: string;
  }) => invoke<void>("export_profile_encrypted", args),
  importProfileEncrypted: (args: { inputPath: string; passphrase: string }) =>
    invoke<string>("import_profile_encrypted", args),
  detectCloudSyncedProfiles: () =>
    invoke<DetectedProfile[]>("detect_cloud_synced_profiles"),

  // ── License ──────────────────────────────────────────────────────────────
  getMachineFingerprint: () => invoke<string>("get_machine_fingerprint"),
  activateLicense: (args: { licenseKey: string; fingerprint: string }) =>
    invoke<LicenseResponse>("activate_license", args),
  validateLicense: (args: { licenseKey: string | null; instanceId: string | null }) =>
    invoke<LicenseResponse>("validate_license", args),

  // ── Settings ───────────────────────────────────────────────────────────────
  checkPortableMode: () => invoke<boolean>("check_portable_mode"),
  bootstrapPortableDir: (args: { targetPath: string; isBusiness: boolean }) =>
    invoke<void>("bootstrap_portable_dir", args),

  // ── Cleanup ────────────────────────────────────────────────────────────────
  scanCleanup: () => invoke<CleanupCategory[]>("scan_cleanup"),
  runCleanup: (args: { categoryIds: string[] }) =>
    invoke<CleanupResult[]>("run_cleanup", args),

  // ── Context menu ───────────────────────────────────────────────────────────
  getClassicMenuStatus: () => invoke<boolean>("get_classic_menu_status"),
  toggleClassicMenu: (args: { enable: boolean }) =>
    invoke<void>("toggle_classic_menu", args),
  getShellExtensions: () => invoke<ShellExtension[]>("get_shell_extensions"),
  toggleShellExtension: (args: { clsid: string; block: boolean }) =>
    invoke<void>("toggle_shell_extension", args),

  // ── SMART disk health ──────────────────────────────────────────────────────
  checkSmartctlAvailable: () => invoke<boolean>("check_smartctl_available"),
  getSmartInstallCommand: () => invoke<string>("get_smart_install_command"),
  readSmartData: () => invoke<SmartReading[]>("read_smart_data"),
  saveSmartHistory: (args: { readings: SmartReading[] }) =>
    invoke<void>("save_smart_history", args),
  enableSmartSchedule: (args: { isPro: boolean }) =>
    invoke<string>("enable_smart_schedule", args),
  getSmartTrend: (args: { diskId: string; lastN: number }) =>
    invoke<SmartReading[]>("get_smart_trend", args),

  // ── Privacy ────────────────────────────────────────────────────────────────
  getPrivacySettings: () => invoke<PrivacySetting[]>("get_privacy_settings"),
  applyPrivacySetting: (args: { settingId: string; enablePrivacy: boolean }) =>
    invoke<void>("apply_privacy_setting", args),
  getAppPermissions: () => invoke<AppPermission[]>("get_app_permissions"),
  revokeAppPermission: (args: { appKey: string; capability: string }) =>
    invoke<void>("revoke_app_permission", args),

  // ── Privacy drift / baseline ───────────────────────────────────────────────
  checkPrivacyDrift: () => invoke<DriftEntry[]>("check_privacy_drift"),
  createPrivacyBaseline: () => invoke<PrivacyBaseline>("create_privacy_baseline"),
  reapplyPrivacyBaseline: (args: { isPro: boolean }) =>
    invoke<void>("reapply_privacy_baseline", args),
  exportBaseline: (args: { targetPath: string }) =>
    invoke<void>("export_baseline", args),
  importBaseline: (args: { path: string }) =>
    invoke<PrivacyBaseline>("import_baseline", args),

  // ── Network ────────────────────────────────────────────────────────────────
  getNetworkInterfaces: () => invoke<NetworkInterface[]>("get_network_interfaces"),
  setDnsServers: (args: {
    interfaceName: string;
    primary: string;
    secondary: string | null;
  }) => invoke<void>("set_dns_servers", args),
  getWifiPasswords: () => invoke<WifiProfile[]>("get_wifi_passwords"),
  networkResetDns: () => invoke<void>("network_reset_dns"),
  networkResetFull: () => invoke<void>("network_reset_full"),

  // ── Services ───────────────────────────────────────────────────────────────
  getServices: () => invoke<ServiceEntry[]>("get_services"),
  getServicePresets: () => invoke<ServicePreset[]>("get_service_presets"),
  applyServicePreset: (args: { presetId: string }) =>
    invoke<ServicePresetResult[]>("apply_service_preset", args),
  setServiceStartType: (args: { name: string; startType: ServiceStartType }) =>
    invoke<void>("set_service_start_type", args),

  // ── Startup ────────────────────────────────────────────────────────────────
  getStartupEntries: () => invoke<StartupEntry[]>("get_startup_entries"),
  toggleStartupEntry: (args: { id: string; name: string; enabled: boolean }) =>
    invoke<void>("toggle_startup_entry", args),

  // ── Watchdog snapshots ─────────────────────────────────────────────────────
  listSnapshots: () => invoke<Snapshot[]>("list_snapshots"),
  takeSnapshot: (args: { label: string }) => invoke<Snapshot>("take_snapshot", args),
  deleteSnapshot: (args: { id: string }) => invoke<void>("delete_snapshot", args),
  diffSnapshots: (args: { beforeId: string; afterId: string }) =>
    invoke<SnapshotDiff>("diff_snapshots", args),

  // ── Fleet (Business) ───────────────────────────────────────────────────────
  listMachines: () => invoke<Machine[]>("list_machines"),
  importEndpointSummary: (args: { path: string; isBusiness: boolean }) =>
    invoke<Machine>("import_endpoint_summary", args),
  exportEndpointSummary: () => invoke<string>("export_endpoint_summary"),
  deleteMachine: (args: { id: string; isBusiness: boolean }) =>
    invoke<void>("delete_machine", args),
  getMachineDetail: (args: { id: string }) =>
    invoke<EndpointBundle>("get_machine_detail", args),
  createContract: (args: { contract: MaintenanceContract; isBusiness: boolean }) =>
    invoke<void>("create_contract", args),
  deleteContract: (args: { id: string; isBusiness: boolean }) =>
    invoke<void>("delete_contract", args),
  runContractNow: (args: { id: string; isBusiness: boolean }) =>
    invoke<void>("run_contract_now", args),
  createDeploymentBundle: (args: {
    profileId: string;
    profileJson: string;
    targetMachines: Machine[];
    outputDir: string;
    isBusiness: boolean;
  }) =>
    invoke<{ outputDir: string; machineCount: number }>("create_deployment_bundle", args),

  // ── Report ─────────────────────────────────────────────────────────────────
  generateHealthReport: (args: { appVersion: string }) =>
    invoke<ReportData>("generate_health_report", args),

  // ── Branding (Business) ────────────────────────────────────────────────────
  getBranding: () => invoke<Branding>("get_branding"),
  validateLogo: (args: { path: string }) => invoke<void>("validate_logo", args),
  setBranding: (args: { branding: Branding; isPro: boolean }) =>
    invoke<void>("set_branding", args),

  // ── Integrations (Business) ────────────────────────────────────────────────
  getIntegrations: () => invoke<IntegrationConfig>("get_integrations"),
  setIntegrations: (args: { config: IntegrationConfig; isBusiness: boolean }) =>
    invoke<void>("set_integrations", args),
  testWebhook: (args: { provider: WebhookProvider }) =>
    invoke<void>("test_webhook", args),
} as const;
