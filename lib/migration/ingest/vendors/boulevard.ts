// Boulevard-specific navigation hints for Stagehand browser agent
// Extracted from knowledge of Boulevard's dashboard structure.

import type { VendorNavigationScript } from "./types";
import type { RawRecord } from "../types";

export const boulevardScript: VendorNavigationScript = {
  vendor: "boulevard",

  async login(stagehand: unknown, credentials: Record<string, string>) {
    const sh = stagehand as {
      act: (opts: { action: string }) => Promise<void>;
    };

    // Boulevard login flow
    await sh.act({ action: `Type "${credentials.email}" into the email field` });
    await sh.act({ action: "Click continue or next" });
    await sh.act({ action: `Type "${credentials.password}" into the password field` });
    await sh.act({ action: "Click the sign in button" });

    // Wait for dashboard to load
    await sh.act({ action: "Wait for the dashboard to fully load" });
  },

  async discoverEntities(stagehand: unknown) {
    const sh = stagehand as {
      extract: (opts: { instruction: string; schema: unknown }) => Promise<unknown>;
    };

    // Boulevard has a consistent sidebar navigation
    const result = await sh.extract({
      instruction:
        "Look at the left sidebar navigation. List all main sections. " +
        "Boulevard typically has: Clients, Calendar, Sales, Reports, Settings.",
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

    // Map Boulevard sections to entity types
    return [
      { entityType: "patients", available: sections.some((s) => /client/i.test(s.name)), accessMethod: "navigation" },
      { entityType: "appointments", available: sections.some((s) => /calendar/i.test(s.name)), accessMethod: "navigation" },
      { entityType: "invoices", available: sections.some((s) => /sales/i.test(s.name)), accessMethod: "navigation" },
      { entityType: "photos", available: true, accessMethod: "per-client" },
      { entityType: "consents", available: true, accessMethod: "per-client" },
      { entityType: "documents", available: true, accessMethod: "per-client" },
    ];
  },

  async *extractEntity(stagehand: unknown, entityType: string): AsyncGenerator<RawRecord> {
    const sh = stagehand as {
      act: (opts: { action: string }) => Promise<void>;
      extract: (opts: { instruction: string; schema: unknown }) => Promise<unknown>;
    };

    if (entityType === "patients") {
      // Navigate to Clients section
      await sh.act({ action: "Click on 'Clients' in the sidebar navigation" });

      let hasMore = true;
      while (hasMore) {
        const result = await sh.extract({
          instruction:
            "Extract all client records visible in the list. " +
            "For each client, get: name, email, phone, and any other visible fields.",
          schema: {
            type: "object",
            properties: {
              records: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    email: { type: "string" },
                    phone: { type: "string" },
                  },
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

        for (const data of extracted?.records || []) {
          yield {
            sourceId: String(data.id || data.name || Math.random().toString(36).substring(7)),
            entityType: "patients",
            data,
            extractedAt: new Date().toISOString(),
          };
        }

        hasMore = extracted?.hasNextPage === true;
        if (hasMore) {
          await sh.act({ action: "Click the next page button or scroll down to load more clients" });
        }
      }
    }
    // Additional entity type handlers would go here
  },
};
