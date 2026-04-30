// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.

export interface RepairShoprConfig {
  apiKey: string;
  subdomain: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromAddress: string;
}

export interface IntegrationConfig {
  repairshopr: RepairShoprConfig | null;
  genericWebhookUrl: string | null;
  smtp: SmtpConfig | null;
}

export type WebhookProvider = "repairshopr" | "generic" | "smtp";

export const DEFAULT_INTEGRATIONS: IntegrationConfig = {
  repairshopr: null,
  genericWebhookUrl: null,
  smtp: null,
};
