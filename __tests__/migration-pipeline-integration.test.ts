import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalArtifactStore } from "../lib/migration/storage/local-store";
import { GenericCSVAdapter } from "../lib/migration/adapters/generic-csv";
import { SafeContextBuilder } from "../lib/migration/agent/safe-context-builder";
import { executeValidate } from "../lib/migration/pipeline/phases/validate";
import { validateMappingSpec, type MappingSpec } from "../lib/migration/canonical/mapping-spec";
import { executeTransform as transformPhase } from "../lib/migration/pipeline/phases/transform";
import { isAllowedTransform, executeTransform } from "../lib/migration/canonical/transforms";
import { resolveStrategy } from "../lib/migration/ingest/strategy-resolver";
import { rm } from "fs/promises";
import path from "path";

const TEST_RUN_ID = "test-run-integration";
const TEST_STORE_DIR = path.join("storage", "migration-test");

describe("Migration Pipeline Integration", () => {
  let store: LocalArtifactStore;

  beforeEach(() => {
    store = new LocalArtifactStore(TEST_STORE_DIR);
  });

  afterEach(async () => {
    try {
      await rm(TEST_STORE_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe("ArtifactStore", () => {
    it("stores and retrieves artifacts", async () => {
      const data = Buffer.from("test data content");
      const ref = await store.put(TEST_RUN_ID, "test-file.csv", data);

      expect(ref.runId).toBe(TEST_RUN_ID);
      expect(ref.key).toBe("test-file.csv");
      expect(ref.sizeBytes).toBe(data.length);
      expect(ref.hash).toHaveLength(64); // SHA-256 hex

      const retrieved = await store.get(ref);
      expect(retrieved.toString()).toBe("test data content");
    });

    it("lists artifacts for a run", async () => {
      await store.put(TEST_RUN_ID, "file1.csv", Buffer.from("data1"));
      await store.put(TEST_RUN_ID, "file2.json", Buffer.from("data2"));

      const refs = await store.list(TEST_RUN_ID);
      expect(refs.length).toBe(2);
      expect(refs.map((r) => r.key).sort()).toEqual(["file1.csv", "file2.json"]);
    });

    it("deletes all artifacts for a run", async () => {
      await store.put(TEST_RUN_ID, "file.csv", Buffer.from("data"));
      await store.delete(TEST_RUN_ID);

      const refs = await store.list(TEST_RUN_ID);
      expect(refs.length).toBe(0);
    });

    it("computes consistent hashes", async () => {
      const data = Buffer.from("consistent content");
      const ref1 = await store.put(TEST_RUN_ID, "f1.txt", data);
      const ref2 = await store.put(TEST_RUN_ID, "f2.txt", data);
      expect(ref1.hash).toBe(ref2.hash);
    });
  });

  describe("GenericCSVAdapter — Profile", () => {
    it("profiles a CSV file", async () => {
      const csv = [
        "id,firstName,lastName,email,phone,dob,status",
        '1,Jane,Doe,jane@example.com,+15551234567,1990-01-15,active',
        '2,John,Smith,john@example.com,+15559876543,1985-03-22,active',
        '3,Bob,Wilson,,+15555555555,1978-11-30,inactive',
      ].join("\n");

      const ref = await store.put(TEST_RUN_ID, "patients.csv", Buffer.from(csv));
      const adapter = new GenericCSVAdapter("test-clinic", "csv");
      const profile = await adapter.profile([ref], store);

      expect(profile.entities).toHaveLength(1);
      const entity = profile.entities[0];
      expect(entity.type).toBe("patients");
      expect(entity.recordCount).toBe(3);
      expect(entity.fields.length).toBe(7);

      // Check PHI classification
      const firstNameField = entity.fields.find((f) => f.name === "firstName");
      expect(firstNameField?.isPHI).toBe(true);

      const emailField = entity.fields.find((f) => f.name === "email");
      expect(emailField?.isPHI).toBe(true);
      expect(emailField?.inferredType).toBe("email");

      const statusField = entity.fields.find((f) => f.name === "status");
      expect(statusField?.isPHI).toBe(false);
    });

    it("profiles a JSON file", async () => {
      const json = JSON.stringify([
        { id: "1", name: "Botox", price: 300, active: true },
        { id: "2", name: "Filler", price: 500, active: true },
        { id: "3", name: "Chemical Peel", price: 150, active: false },
      ]);

      const ref = await store.put(TEST_RUN_ID, "services.json", Buffer.from(json));
      const adapter = new GenericCSVAdapter("test-clinic");
      const profile = await adapter.profile([ref], store);

      expect(profile.entities).toHaveLength(1);
      expect(profile.entities[0].recordCount).toBe(3);
    });

    it("detects relationship hints", async () => {
      const csv = [
        "id,patientId,providerName,startTime,status",
        "1,p-001,Dr. Smith,2025-01-15T10:00:00Z,completed",
      ].join("\n");

      const ref = await store.put(TEST_RUN_ID, "appointments.csv", Buffer.from(csv));
      const adapter = new GenericCSVAdapter("test-clinic");
      const profile = await adapter.profile([ref], store);

      const hints = profile.entities[0].relationshipHints;
      expect(hints.length).toBeGreaterThan(0);
      expect(hints.some((h) => h.field === "patientId" && h.targetEntity === "patients")).toBe(true);
    });
  });

  describe("GenericCSVAdapter — Transform", () => {
    it("transforms CSV records with a mapping spec", async () => {
      const csv = [
        "id,first_name,last_name,email_addr",
        "1,Jane,Doe,jane@example.com",
        "2,John,Smith,john@test.com",
      ].join("\n");

      const ref = await store.put(TEST_RUN_ID, "patients.csv", Buffer.from(csv));

      const mappingSpec: MappingSpec = {
        version: 1,
        sourceVendor: "csv",
        entityMappings: [
          {
            sourceEntity: "patients",
            targetEntity: "patient",
            fieldMappings: [
              { sourceField: "id", targetField: "sourceRecordId", transform: null, confidence: 1, requiresApproval: false },
              { sourceField: "first_name", targetField: "firstName", transform: "trim", confidence: 0.95, requiresApproval: false },
              { sourceField: "last_name", targetField: "lastName", transform: "trim", confidence: 0.95, requiresApproval: false },
              { sourceField: "email_addr", targetField: "email", transform: "normalizeEmail", confidence: 0.9, requiresApproval: false },
            ],
            enumMaps: {},
          },
        ],
      };

      const adapter = new GenericCSVAdapter("test-clinic", "csv");
      const results = [];
      for await (const item of adapter.transform([ref], store, mappingSpec)) {
        results.push(item);
      }

      expect(results).toHaveLength(2);
      expect(results[0].entityType).toBe("patient");

      const record = results[0].record as Record<string, unknown>;
      expect(record.firstName).toBe("Jane");
      expect(record.lastName).toBe("Doe");
      expect(record.email).toBe("jane@example.com");
      expect(record.canonicalId).toBeDefined();
      expect(record.sourceRecordId).toBe("1");

      // Idempotent: same input → same canonicalId
      const results2 = [];
      for await (const item of adapter.transform([ref], store, mappingSpec)) {
        results2.push(item);
      }
      expect((results2[0].record as Record<string, unknown>).canonicalId)
        .toBe(record.canonicalId);
    });
  });

  describe("Transforms", () => {
    it("validates allowlisted transforms", () => {
      expect(isAllowedTransform("normalizeDate")).toBe(true);
      expect(isAllowedTransform("normalizePhone")).toBe(true);
      expect(isAllowedTransform("trim")).toBe(true);
      expect(isAllowedTransform("eval")).toBe(false);
      expect(isAllowedTransform("exec")).toBe(false);
    });

    it("normalizes dates", () => {
      expect(executeTransform("normalizeDate", "01/15/1990")).toBe("1990-01-15");
      expect(executeTransform("normalizeDate", "2025-03-22")).toBe("2025-03-22");
    });

    it("normalizes phones", () => {
      expect(executeTransform("normalizePhone", "(555) 123-4567")).toBe("+15551234567");
      expect(executeTransform("normalizePhone", "5551234567")).toBe("+15551234567");
    });

    it("normalizes emails", () => {
      expect(executeTransform("normalizeEmail", "  Jane@Example.COM  ")).toBe("jane@example.com");
    });

    it("handles null values with defaultValue", () => {
      expect(executeTransform("defaultValue", null, { defaultValue: "N/A" })).toBe("N/A");
      expect(executeTransform("defaultValue", "actual", { defaultValue: "N/A" })).toBe("actual");
    });

    it("maps enums", () => {
      const enumMap = { active: "Active", inactive: "Inactive", cancelled: "Cancelled" };
      expect(executeTransform("mapEnum", "active", { enumMap })).toBe("Active");
      expect(executeTransform("mapEnum", "unknown", { enumMap })).toBe("unknown"); // passthrough
    });
  });

  describe("Validate Phase", () => {
    it("passes valid records", () => {
      const records = [
        {
          entityType: "patient" as const,
          canonicalId: "p-1",
          sourceRecordId: "s-1",
          record: { canonicalId: "p-1", sourceRecordId: "s-1", firstName: "Jane", lastName: "Doe" },
        },
      ];

      const result = executeValidate({ records });
      expect(result.passed).toBe(true);
      expect(result.report.validRecords).toBe(1);
      expect(result.samplingPacket.totalRecords).toBe(1);
    });

    it("fails with hard-stop errors", () => {
      const records = [
        {
          entityType: "patient" as const,
          canonicalId: "p-1",
          sourceRecordId: "s-1",
          record: { canonicalId: "p-1", sourceRecordId: "s-1", firstName: "", lastName: "" },
        },
      ];

      const result = executeValidate({ records });
      expect(result.passed).toBe(false);
      expect(result.report.invalidRecords).toBe(1);
    });

    it("detects referential integrity failures", () => {
      const records = [
        {
          entityType: "appointment" as const,
          canonicalId: "a-1",
          sourceRecordId: "s-a1",
          record: {
            canonicalId: "a-1", sourceRecordId: "s-a1",
            canonicalPatientId: "p-nonexistent",
            providerName: "Dr. X", startTime: "2025-01-01T10:00:00Z", status: "Completed",
          },
        },
      ];

      const result = executeValidate({ records });
      expect(result.referentialErrors.length).toBeGreaterThan(0);
      expect(result.passed).toBe(false);
    });
  });

  describe("Strategy Resolver", () => {
    it("picks upload for uploaded files", () => {
      expect(resolveStrategy({
        vendor: "boulevard",
        hasCredentials: true,
        hasUploadedFiles: true,
      })).toBe("upload");
    });

    it("picks api for known API vendor with credentials", () => {
      expect(resolveStrategy({
        vendor: "boulevard",
        hasCredentials: true,
        hasUploadedFiles: false,
      })).toBe("api");
    });

    it("picks browser for unknown vendor with URL and credentials", () => {
      expect(resolveStrategy({
        vendor: "unknown-emr",
        hasCredentials: true,
        hasUploadedFiles: false,
        emrUrl: "https://unknown-emr.com/dashboard",
      })).toBe("browser");
    });

    it("falls back to upload when no credentials", () => {
      expect(resolveStrategy({
        vendor: "anything",
        hasCredentials: false,
        hasUploadedFiles: false,
      })).toBe("upload");
    });
  });

  describe("Full CSV Pipeline (Ingest → Profile → Transform → Validate)", () => {
    it("processes a synthetic CSV through the full pipeline", async () => {
      // 1. Ingest: store CSV as artifact
      const csv = [
        "id,firstName,lastName,email,phone,dateOfBirth",
        "1,Alice,Johnson,alice@example.com,+15551111111,1992-06-15",
        "2,Bob,Williams,bob@example.com,+15552222222,1988-12-01",
        "3,Carol,Brown,carol@example.com,+15553333333,1975-03-20",
      ].join("\n");

      const ref = await store.put(TEST_RUN_ID, "patients.csv", Buffer.from(csv));

      // 2. Profile
      const adapter = new GenericCSVAdapter("test-clinic", "csv");
      const profile = await adapter.profile([ref], store);

      expect(profile.entities).toHaveLength(1);
      expect(profile.entities[0].recordCount).toBe(3);

      // 3. SafeContext (verify no PHI)
      const builder = new SafeContextBuilder();
      const context = builder.buildFromProfile(profile);
      const contextStr = JSON.stringify(context);

      // Verify no PHI in context
      expect(contextStr).not.toContain("Alice");
      expect(contextStr).not.toContain("Johnson");
      expect(contextStr).not.toContain("alice@example.com");
      expect(contextStr).not.toContain("1992-06-15");

      // 4. Use a hand-crafted mapping spec (skipping Bedrock for test)
      const mappingSpec: MappingSpec = {
        version: 1,
        sourceVendor: "csv",
        entityMappings: [
          {
            sourceEntity: "patients",
            targetEntity: "patient",
            fieldMappings: [
              { sourceField: "id", targetField: "sourceRecordId", transform: null, confidence: 1, requiresApproval: false },
              { sourceField: "firstName", targetField: "firstName", transform: "trim", confidence: 0.95, requiresApproval: false },
              { sourceField: "lastName", targetField: "lastName", transform: "trim", confidence: 0.95, requiresApproval: false },
              { sourceField: "email", targetField: "email", transform: "normalizeEmail", confidence: 0.95, requiresApproval: false },
              { sourceField: "phone", targetField: "phone", transform: "normalizePhone", confidence: 0.9, requiresApproval: false },
              { sourceField: "dateOfBirth", targetField: "dateOfBirth", transform: "normalizeDate", confidence: 0.9, requiresApproval: false },
            ],
            enumMaps: {},
          },
        ],
      };

      expect(validateMappingSpec(mappingSpec).valid).toBe(true);

      // 5. Transform
      const transformResult = await transformPhase(
        { runId: TEST_RUN_ID, vendor: "csv", tenantId: "test-clinic", artifacts: [ref], mappingSpec },
        store
      );

      expect(transformResult.records).toHaveLength(3);
      expect(transformResult.counts["patient"]).toBe(3);

      // Check idempotent canonical IDs
      const ids = transformResult.records.map((r) => r.canonicalId);
      expect(new Set(ids).size).toBe(3); // all unique

      // 6. Validate
      const validateResult = executeValidate({
        records: transformResult.records.map((r) => ({
          entityType: r.entityType,
          canonicalId: r.canonicalId,
          record: r.record,
          sourceRecordId: r.sourceRecordId,
        })),
      });

      expect(validateResult.passed).toBe(true);
      expect(validateResult.report.validRecords).toBe(3);
      expect(validateResult.report.invalidRecords).toBe(0);
      expect(validateResult.samplingPacket.entityDistribution["patient"]).toBe(3);
    });
  });
});
