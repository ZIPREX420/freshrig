export type AppCategory =
  | "Browser"
  | "Gaming"
  | "Communication"
  | "Development"
  | "Media"
  | "Productivity"
  | "Utilities"
  | "Security"
  | "Runtime";

export type InstallStatus = "Pending" | "Installing" | "Completed" | "Failed" | "Skipped";

export type AppTier = "free" | "pro";

export interface AppEntry {
  id: string;
  name: string;
  description: string;
  category: AppCategory;
  iconName: string;
  isPopular: boolean;
  /** v2.0+: 14 essentials are "free", everything else is "pro". */
  tier: AppTier;
  estimatedSizeMb?: number;
}

export interface InstallProgress {
  appId: string;
  appName: string;
  status: InstallStatus;
  message: string;
}

export interface InstallSummary {
  installed: string[];
  failed: string[];
  skipped: string[];
}
