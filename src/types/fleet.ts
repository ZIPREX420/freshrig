// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Mirror of `commands::fleet::*` Rust structs. snake_case → camelCase
// done by `#[serde(rename_all = "camelCase")]` on the Rust side.

export interface Machine {
  id: string;
  hostname: string;
  ownerName: string;
  serialNumber: string | null;
  hardwareSummary: string;
  lastHealthScore: number | null;
  lastSeen: string;
  notes: string | null;
}

export interface ChangeLogEntry {
  id: number;
  machineId: string;
  timestamp: string;
  action: string;
  detailsJson: string | null;
}

export interface ReportRef {
  id: number;
  machineId: string;
  timestamp: string;
  filePath: string;
  kind: string;
}

export type ContractFrequency = "monthly" | "quarterly" | "ondemand";

export interface MaintenanceContract {
  id: string;
  machineId: string;
  frequency: ContractFrequency;
  nextRun: string;
  emailTo: string | null;
  autoActions: string[];
  lastRun: string | null;
}

export interface EndpointBundle {
  machine: Machine;
  changeLog: ChangeLogEntry[];
  recentReports: ReportRef[];
  contracts: MaintenanceContract[];
}
