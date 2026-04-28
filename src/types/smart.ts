// Mirrors src-tauri/src/commands/smart_monitor.rs.

export type SmartStatus = "Ok" | "Caution" | "Critical" | "Unknown";

export interface SmartAttribute {
  id: number;
  name: string;
  rawValue: number;
  normalizedValue: number | null;
  threshold: number | null;
  flagged: boolean;
}

export interface SmartReading {
  diskId: string;
  capturedAt: string;
  model: string;
  serial: string;
  diskType: string;
  temperatureC: number | null;
  powerOnHours: number | null;
  attributes: SmartAttribute[];
  overallStatus: SmartStatus;
}
