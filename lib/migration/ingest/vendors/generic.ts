// Generic AI-guided navigation for unknown EMRs
// Falls back to pure AI exploration when no vendor-specific script exists.

import type { VendorNavigationScript } from "./types";

export const genericScript: VendorNavigationScript = {
  vendor: "generic",
  // All methods use the default AI-guided behavior in browser-agent.ts
  // This script exists as an explicit fallback entry point
};
