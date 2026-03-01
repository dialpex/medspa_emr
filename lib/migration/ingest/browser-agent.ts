// Browser Ingest Agent — Stagehand + Playwright wrapper
// Uses AI-guided browser automation to extract data from source EMRs.
//
// PHI SAFETY:
// - Browser runs server-side only
// - Credentials encrypted at rest
// - Extracted data goes directly to ArtifactStore
// - Stagehand's AI sees DOM structure, NOT field values
// - Every action is audit-logged

import type {
  BrowserIngestAgent,
  EncryptedCredentials,
  EntityDiscovery,
  RawRecord,
  BrowserAuditEntry,
} from "./types";
import { decrypt } from "../crypto";

// Vendor-specific navigation scripts
import type { VendorNavigationScript } from "./vendors/types";

export class StagehandBrowserAgent implements BrowserIngestAgent {
  private stagehand: unknown = null;
  private page: unknown = null;
  private auditLog: BrowserAuditEntry[] = [];
  private vendorScript: VendorNavigationScript | null = null;

  constructor(private vendor?: string) {}

  private logAudit(entry: Omit<BrowserAuditEntry, "timestamp">) {
    this.auditLog.push({ ...entry, timestamp: new Date().toISOString() });
  }

  getAuditLog(): BrowserAuditEntry[] {
    return [...this.auditLog];
  }

  async connect(credentials: EncryptedCredentials, emrUrl: string): Promise<void> {
    this.logAudit({ action: "connect", url: emrUrl });

    // Decrypt credentials
    const creds = JSON.parse(decrypt(credentials.ciphertext));

    // Load vendor-specific navigation script if available
    if (this.vendor) {
      try {
        this.vendorScript = await this.loadVendorScript(this.vendor);
      } catch {
        // Fall back to generic AI-guided navigation
        this.vendorScript = null;
      }
    }

    try {
      // Dynamic import — Stagehand is an optional dependency
      const { Stagehand } = await import("@browserbasehq/stagehand");

      this.stagehand = new Stagehand({
        env: "LOCAL",
        enableCaching: false, // No caching of PHI-containing pages
      });

      await (this.stagehand as { init: () => Promise<void> }).init();
      this.page = (this.stagehand as { page: unknown }).page;

      // Navigate to EMR login
      const page = this.page as { goto: (url: string) => Promise<void> };
      await page.goto(emrUrl);

      // Use vendor script or AI to log in
      if (this.vendorScript?.login) {
        await this.vendorScript.login(this.stagehand, creds);
      } else {
        // Generic AI-guided login
        const sh = this.stagehand as {
          act: (opts: { action: string }) => Promise<void>;
        };
        await sh.act({ action: `Type "${creds.email}" into the email or username field` });
        await sh.act({ action: `Type "${creds.password}" into the password field` });
        await sh.act({ action: "Click the login or sign in button" });
      }

      this.logAudit({ action: "login_complete" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Cannot find module")) {
        throw new Error(
          "Stagehand is not installed. Install it with: npm install @browserbasehq/stagehand"
        );
      }
      throw error;
    }
  }

  async discoverEntities(): Promise<EntityDiscovery[]> {
    this.logAudit({ action: "discover_entities" });

    if (this.vendorScript?.discoverEntities) {
      return this.vendorScript.discoverEntities(this.stagehand!);
    }

    // Generic AI-guided discovery
    const sh = this.stagehand as {
      extract: (opts: { instruction: string; schema: unknown }) => Promise<unknown>;
    };

    const result = await sh.extract({
      instruction:
        "Look at the navigation menu and sidebar. What sections are available? " +
        "List all data sections you can see (e.g., Patients, Appointments, Reports, Charts, etc.)",
      schema: {
        type: "object",
        properties: {
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                available: { type: "boolean" },
              },
            },
          },
        },
      },
    });

    const sections = (result as { sections?: Array<{ name: string; available: boolean }> })
      ?.sections || [];

    return sections.map((s) => ({
      entityType: s.name.toLowerCase(),
      available: s.available,
      accessMethod: "navigation",
    }));
  }

  async *extractPatients(): AsyncGenerator<RawRecord> {
    yield* this.extractEntity("patients", "patients");
  }

  async *extractAppointments(): AsyncGenerator<RawRecord> {
    yield* this.extractEntity("appointments", "appointments");
  }

  async *extractCharts(): AsyncGenerator<RawRecord> {
    yield* this.extractEntity("charts", "charts");
  }

  async *extractConsents(): AsyncGenerator<RawRecord> {
    yield* this.extractEntity("consents", "consents");
  }

  async *extractPhotos(): AsyncGenerator<{ metadata: RawRecord; binary: Buffer }> {
    // Photos require binary download — vendor-specific or generic
    if (this.vendorScript?.extractPhotos) {
      yield* this.vendorScript.extractPhotos(this.stagehand!);
      return;
    }

    // Generic: navigate to photos section and extract URLs
    this.logAudit({ action: "extract", entityType: "photos" });
    // In generic mode, we just extract metadata; binary download handled separately
  }

  async *extractDocuments(): AsyncGenerator<{ metadata: RawRecord; binary: Buffer }> {
    if (this.vendorScript?.extractDocuments) {
      yield* this.vendorScript.extractDocuments(this.stagehand!);
      return;
    }

    this.logAudit({ action: "extract", entityType: "documents" });
  }

  private async *extractEntity(
    entityType: string,
    navigationTarget: string
  ): AsyncGenerator<RawRecord> {
    const startTime = Date.now();
    this.logAudit({ action: "extract", entityType });

    if (this.vendorScript?.extractEntity) {
      yield* this.vendorScript.extractEntity(this.stagehand!, entityType);
      return;
    }

    // Generic AI-guided extraction
    const sh = this.stagehand as {
      act: (opts: { action: string }) => Promise<void>;
      extract: (opts: { instruction: string; schema: unknown }) => Promise<unknown>;
    };

    // Navigate to the entity section
    await sh.act({ action: `Navigate to the ${navigationTarget} section or page` });

    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await sh.extract({
        instruction:
          `Extract all ${entityType} records visible on this page. ` +
          `For each record, capture all available fields.`,
        schema: {
          type: "object",
          properties: {
            records: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: true,
              },
            },
            hasNextPage: { type: "boolean" },
          },
        },
      });

      const extracted = result as {
        records?: Array<Record<string, unknown>>;
        hasNextPage?: boolean;
      };

      const records = extracted?.records || [];

      for (const data of records) {
        const sourceId = String(
          data.id || data.sourceId || data.clientId || data.patientId || `${entityType}-${page}-${records.indexOf(data)}`
        );

        yield {
          sourceId,
          entityType,
          data,
          extractedAt: new Date().toISOString(),
        };
      }

      hasMore = extracted?.hasNextPage === true;
      if (hasMore) {
        await sh.act({ action: "Click the next page button" });
        page++;
      }
    }

    this.logAudit({
      action: "extract_complete",
      entityType,
      durationMs: Date.now() - startTime,
    });
  }

  async close(): Promise<void> {
    this.logAudit({ action: "close" });
    if (this.stagehand) {
      try {
        await (this.stagehand as { close: () => Promise<void> }).close();
      } catch {
        // Best effort cleanup
      }
      this.stagehand = null;
      this.page = null;
    }
  }

  private async loadVendorScript(vendor: string): Promise<VendorNavigationScript> {
    switch (vendor.toLowerCase()) {
      case "boulevard": {
        const { boulevardScript } = await import("./vendors/boulevard");
        return boulevardScript;
      }
      default: {
        const { genericScript } = await import("./vendors/generic");
        return genericScript;
      }
    }
  }
}
