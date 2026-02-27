import type { MigrationProvider, ProviderInfo } from "./types";
import { MockMigrationProvider } from "./mock";
import { BoulevardProvider } from "./boulevard";
import type { MigrationSource } from "@prisma/client";

export const PROVIDER_REGISTRY: Record<MigrationSource, ProviderInfo> = {
  Boulevard: {
    source: "Boulevard",
    displayName: "Boulevard",
    description: "Import clients, appointments, services, and invoices from Boulevard",
    strategy: "internal_api",
    credentialFields: [
      { key: "email", label: "Boulevard Admin Email", type: "email", required: true, placeholder: "admin@yourclinic.com" },
      { key: "password", label: "Boulevard Password", type: "password", required: true, placeholder: "Your Boulevard password" },
    ],
  },
  AestheticsRecord: {
    source: "AestheticsRecord",
    displayName: "Aesthetics Record",
    description: "Import from Aesthetics Record",
    strategy: "browser_automation",
    credentialFields: [
      { key: "email", label: "Email", type: "email", required: true },
      { key: "password", label: "Password", type: "password", required: true },
    ],
  },
  CsvUpload: {
    source: "CsvUpload",
    displayName: "CSV Upload",
    description: "Import from CSV files",
    strategy: "csv_import",
    credentialFields: [],
  },
};

export function getProviderInfo(source: MigrationSource): ProviderInfo {
  return PROVIDER_REGISTRY[source];
}

export function getMigrationProvider(source: MigrationSource): MigrationProvider {
  switch (source) {
    case "Boulevard":
      return new BoulevardProvider();
    case "AestheticsRecord":
    case "CsvUpload":
      console.warn(`[Migration] ${source} provider not yet implemented — using MockProvider`);
      return new MockMigrationProvider();
    default:
      return new MockMigrationProvider();
  }
}
