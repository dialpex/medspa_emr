// Adapter Registry

import type { VendorAdapter } from "./types";
import { GenericCSVAdapter } from "./generic-csv";

export type { VendorAdapter, SourceProfile, SourceEntityProfile, SourceFieldProfile } from "./types";

export function createAdapter(vendor: string, tenantId: string): VendorAdapter {
  switch (vendor) {
    case "csv":
    case "generic":
      return new GenericCSVAdapter(tenantId, vendor);
    default:
      // Default: treat unknown vendors as generic CSV/JSON
      return new GenericCSVAdapter(tenantId, vendor);
  }
}
