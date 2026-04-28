// Mirrors src-tauri/src/commands/watchdog.rs.

export interface ServiceSnapshot {
  name: string;
  state: string;
}

export interface StartupSnapshot {
  name: string;
  command: string;
  source: string;
  enabled: boolean;
}

export interface InstalledApp {
  name: string;
  version: string | null;
  publisher: string | null;
}

export interface Snapshot {
  id: string;
  createdAt: string;
  label: string;
  restorePointId: number | null;
  registryExportPath: string | null;
  services: ServiceSnapshot[];
  startupEntries: StartupSnapshot[];
  installedSoftware: InstalledApp[];
}

export interface ServiceStateChange {
  name: string;
  before: string;
  after: string;
}

export interface SnapshotDiff {
  beforeId: string;
  afterId: string;
  servicesAdded: string[];
  servicesRemoved: string[];
  servicesStateChanged: ServiceStateChange[];
  startupAdded: StartupSnapshot[];
  startupRemoved: StartupSnapshot[];
  softwareAdded: InstalledApp[];
  softwareRemoved: InstalledApp[];
}
