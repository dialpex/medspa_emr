// Vendor-specific navigation script interface
// These provide hints to Stagehand for navigating specific EMR UIs.

import type { RawRecord } from "../types";

export interface VendorNavigationScript {
  vendor: string;

  login?(stagehand: unknown, credentials: Record<string, string>): Promise<void>;
  discoverEntities?(stagehand: unknown): Promise<Array<{
    entityType: string;
    available: boolean;
    estimatedCount?: number;
    accessMethod: string;
  }>>;
  extractEntity?(stagehand: unknown, entityType: string): AsyncGenerator<RawRecord>;
  extractPhotos?(stagehand: unknown): AsyncGenerator<{ metadata: RawRecord; binary: Buffer }>;
  extractDocuments?(stagehand: unknown): AsyncGenerator<{ metadata: RawRecord; binary: Buffer }>;
}
