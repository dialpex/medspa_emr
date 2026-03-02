// Adapter Registry

import type { VendorAdapter } from "./types";
import { GenericCSVAdapter } from "./generic-csv";

export type { VendorAdapter, SourceProfile, SourceEntityProfile, SourceFieldProfile } from "./types";

export function createAdapter(vendor: string, tenantId: string): VendorAdapter {
  switch (vendor) {
    case "csv":
    case "generic":
    default:
      // All vendors use GenericCSVAdapter; vendor key comes from mappingSpec.sourceVendor at transform time
      return new GenericCSVAdapter(tenantId);
  }
}
