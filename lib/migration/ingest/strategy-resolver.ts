// Strategy Resolver — picks ingestion strategy based on vendor + available config

import type { IngestStrategy } from "./types";

interface StrategyInput {
  vendor: string;
  hasCredentials: boolean;
  hasUploadedFiles: boolean;
  emrUrl?: string;
}

// Known vendor → strategy mappings
const VENDOR_STRATEGIES: Record<string, IngestStrategy> = {
  boulevard: "api",     // Boulevard has a known GraphQL API
  mock: "api",          // Mock provider for testing
  csv: "upload",
  generic: "upload",
  json: "upload",
  fhir: "upload",
};

// Known EMR URL patterns that support browser automation
const BROWSER_URL_PATTERNS = [
  /boulevard\.io/i,
  /aestheticspro\.com/i,
  /nextech\.com/i,
  /patientnow\.com/i,
  /zenoti\.com/i,
];

export function resolveStrategy(input: StrategyInput): IngestStrategy {
  // 1. If files were uploaded, use upload strategy
  if (input.hasUploadedFiles) {
    return "upload";
  }

  // 2. Check known vendor strategies
  const vendorStrategy = VENDOR_STRATEGIES[input.vendor.toLowerCase()];
  if (vendorStrategy === "api" && input.hasCredentials) {
    return "api";
  }

  // 3. Check if URL matches a known EMR for browser automation
  if (input.emrUrl && input.hasCredentials) {
    const supportsBrowser = BROWSER_URL_PATTERNS.some((p) => p.test(input.emrUrl!));
    if (supportsBrowser) return "browser";
  }

  // 4. If credentials are available but no known strategy, try browser
  if (input.hasCredentials && input.emrUrl) {
    return "browser";
  }

  // 5. Fallback to upload
  return "upload";
}
