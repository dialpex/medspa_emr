import OpenAI from "openai";
import type { MigrationJob } from "@prisma/client";
import type { MigrationProvider, MigrationCredentials } from "./providers/types";
import {
  DISCOVERY_SCHEMA,
  MAPPING_SCHEMA,
  VERIFICATION_SCHEMA,
  type DiscoveryResponse,
  type MappingResponse,
  type VerificationResponse,
} from "./agent-schemas";
import {
  DISCOVERY_SYSTEM_PROMPT,
  MAPPING_SYSTEM_PROMPT,
  VERIFICATION_SYSTEM_PROMPT,
} from "./agent-prompts";
import { decrypt } from "./crypto";

// Temperature 0.2 — deterministic for data migration, not creative writing
const TEMPERATURE = 0.2;
const MODEL = "gpt-4o";

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function decryptCredentials(job: MigrationJob): MigrationCredentials {
  if (!job.credentialsEncrypted) {
    throw new Error("No encrypted credentials on migration job");
  }
  return JSON.parse(decrypt(job.credentialsEncrypted));
}

/**
 * Run a structured AI completion. Falls back to mock response if no API key.
 */
async function runAI<T>(
  systemPrompt: string,
  userMessage: string,
  schema: { type: "json_schema"; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } },
  mockResponse: T
): Promise<T> {
  const client = getOpenAIClient();
  if (!client) {
    console.warn("[Migration Agent] No OPENAI_API_KEY — returning mock response");
    return mockResponse;
  }

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response_format: schema as any,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: TEMPERATURE,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI");
    return JSON.parse(content) as T;
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 429) {
      console.warn("[Migration Agent] Rate limited — returning mock response");
      return mockResponse;
    }
    throw new Error(
      `Migration AI error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Step 1: Discover what data exists in the source platform.
 * Fetches samples of each entity type and asks AI to analyze.
 */
export async function discoverSourceData(
  job: MigrationJob,
  provider: MigrationProvider
): Promise<DiscoveryResponse> {
  const credentials = decryptCredentials(job);

  // Fetch first page of each entity type in parallel
  const [patients, services, appointments, invoices] = await Promise.all([
    provider.fetchPatients(credentials, { limit: 50 }),
    provider.fetchServices(credentials, { limit: 50 }),
    provider.fetchAppointments(credentials, { limit: 50 }),
    provider.fetchInvoices(credentials, { limit: 50 }),
  ]);

  let photoCount = 0;
  if (provider.fetchPhotos) {
    const photos = await provider.fetchPhotos(credentials, { limit: 50 });
    photoCount = photos.totalCount ?? photos.data.length;
  }

  const userMessage = `Analyze this source data for migration:

PATIENTS (${patients.totalCount ?? patients.data.length} total, showing first ${patients.data.length}):
${JSON.stringify(patients.data.map(p => ({
  sourceId: p.sourceId,
  name: `${p.firstName} ${p.lastName}`,
  email: p.email || "MISSING",
  phone: p.phone || "MISSING",
  dob: p.dateOfBirth || "MISSING",
})), null, 2)}

SERVICES (${services.totalCount ?? services.data.length} total):
${JSON.stringify(services.data.map(s => ({
  sourceId: s.sourceId,
  name: s.name,
  category: s.category,
  price: s.price,
  isActive: s.isActive,
})), null, 2)}

APPOINTMENTS (${appointments.totalCount ?? appointments.data.length} total, showing first ${appointments.data.length}):
${JSON.stringify(appointments.data.slice(0, 10).map(a => ({
  sourceId: a.sourceId,
  patient: a.patientSourceId,
  service: a.serviceName,
  provider: a.providerName,
  date: a.startTime,
  status: a.status,
})), null, 2)}

INVOICES (${invoices.totalCount ?? invoices.data.length} total):
${JSON.stringify(invoices.data.slice(0, 10).map(i => ({
  sourceId: i.sourceId,
  patient: i.patientSourceId,
  total: i.total,
  status: i.status,
})), null, 2)}

PHOTOS: ${photoCount} total`;

  const mockDiscovery: DiscoveryResponse = {
    summary: `I found ${patients.totalCount ?? patients.data.length} patients, ${appointments.totalCount ?? appointments.data.length} appointments, ${services.totalCount ?? services.data.length} services, ${invoices.totalCount ?? invoices.data.length} invoices, and ${photoCount} photos in the source platform.`,
    entities: [
      { type: "Patient", count: patients.totalCount ?? patients.data.length, sampleNames: patients.data.slice(0, 3).map(p => `${p.firstName} ${p.lastName}`) },
      { type: "Service", count: services.totalCount ?? services.data.length, sampleNames: services.data.slice(0, 3).map(s => s.name) },
      { type: "Appointment", count: appointments.totalCount ?? appointments.data.length, sampleNames: [] },
      { type: "Invoice", count: invoices.totalCount ?? invoices.data.length, sampleNames: [] },
      { type: "Photo", count: photoCount, sampleNames: [] },
    ],
    issues: detectDataIssues(patients.data, services.data, appointments.data),
    recommendations: [
      "Review duplicate patient records before importing",
      "Verify service mappings match your current catalog",
    ],
  };

  return runAI<DiscoveryResponse>(
    DISCOVERY_SYSTEM_PROMPT,
    userMessage,
    DISCOVERY_SCHEMA,
    mockDiscovery
  );
}

/**
 * Step 2: Propose service mappings between source and Neuvvia.
 */
export async function proposeMappings(
  job: MigrationJob,
  provider: MigrationProvider,
  neuvviaServices: Array<{ id: string; name: string; category?: string | null; price: number }>
): Promise<MappingResponse> {
  const credentials = decryptCredentials(job);
  const sourceServices = await provider.fetchServices(credentials);

  const userMessage = `Match these source services to target Neuvvia services.

SOURCE SERVICES:
${JSON.stringify(sourceServices.data.map(s => ({
  sourceId: s.sourceId,
  name: s.name,
  description: s.description,
  category: s.category,
  price: s.price,
  duration: s.duration,
  isActive: s.isActive,
})), null, 2)}

TARGET NEUVVIA SERVICES:
${JSON.stringify(neuvviaServices, null, 2)}

Return a mapping for each source service.`;

  const mockMappings: MappingResponse = {
    mappings: sourceServices.data.map((s) => {
      // Simple name-match for mock
      const match = neuvviaServices.find(
        (ns) => ns.name.toLowerCase() === s.name.toLowerCase()
      );
      if (match) {
        return {
          sourceId: s.sourceId,
          sourceName: s.name,
          action: "map_existing" as const,
          confidence: 0.95,
          reasoning: `Exact name match with "${match.name}"`,
          targetId: match.id,
          targetName: match.name,
        };
      }
      return {
        sourceId: s.sourceId,
        sourceName: s.name,
        action: "create_new" as const,
        confidence: 0.7,
        reasoning: `No matching service found in Neuvvia catalog — will create new`,
        targetId: null,
        targetName: null,
      };
    }),
    autoResolved: sourceServices.data.length,
    needsInput: 0,
  };

  return runAI<MappingResponse>(
    MAPPING_SYSTEM_PROMPT,
    userMessage,
    MAPPING_SCHEMA,
    mockMappings
  );
}

/**
 * Step 5: Generate verification report after migration completes.
 */
export async function generateVerificationReport(
  migrationLogs: Array<{
    entityType: string;
    status: string;
    aiReasoning?: string | null;
    errorMessage?: string | null;
  }>
): Promise<VerificationResponse> {
  // Aggregate counts
  const counts: Record<string, Record<string, number>> = {};
  for (const log of migrationLogs) {
    if (!counts[log.entityType]) {
      counts[log.entityType] = { imported: 0, skipped: 0, failed: 0, duplicate: 0, merged: 0 };
    }
    counts[log.entityType][log.status] = (counts[log.entityType][log.status] || 0) + 1;
  }

  const userMessage = `Generate a migration verification report.

MIGRATION LOGS SUMMARY:
${JSON.stringify(counts, null, 2)}

SAMPLE LOG ENTRIES (showing issues):
${JSON.stringify(
  migrationLogs
    .filter((l) => l.status !== "imported")
    .slice(0, 20)
    .map((l) => ({
      entityType: l.entityType,
      status: l.status,
      reasoning: l.aiReasoning,
      error: l.errorMessage,
    })),
  null,
  2
)}

Total records processed: ${migrationLogs.length}`;

  const results = Object.entries(counts).map(([entityType, c]) => ({
    entityType,
    sourceCount: Object.values(c).reduce((sum, n) => sum + n, 0),
    imported: c.imported || 0,
    skipped: (c.skipped || 0) + (c.duplicate || 0),
    failed: c.failed || 0,
    merged: c.merged || 0,
  }));

  const totalImported = results.reduce((s, r) => s + r.imported, 0);
  const totalFailed = results.reduce((s, r) => s + r.failed, 0);

  const mockVerification: VerificationResponse = {
    summary: `Migration complete. ${totalImported} records imported successfully across ${results.length} entity types. ${totalFailed > 0 ? `${totalFailed} records failed and may need manual review.` : "No failures."}`,
    results,
    warnings: totalFailed > 0
      ? [`${totalFailed} records failed to import — review the error details for each.`]
      : [],
  };

  return runAI<VerificationResponse>(
    VERIFICATION_SYSTEM_PROMPT,
    userMessage,
    VERIFICATION_SCHEMA,
    mockVerification
  );
}

// --- Helper: detect data quality issues from raw data ---

function detectDataIssues(
  patients: Array<{ sourceId: string; firstName: string; lastName: string; email?: string; phone?: string; dateOfBirth?: string }>,
  services: Array<{ sourceId: string; name: string }>,
  appointments: Array<{ sourceId: string; patientSourceId: string; serviceSourceId?: string; providerName?: string }>
) {
  const issues: DiscoveryResponse["issues"] = [];

  // Missing emails
  const noEmail = patients.filter((p) => !p.email);
  if (noEmail.length > 0) {
    issues.push({
      severity: "warning",
      entityType: "Patient",
      description: `${noEmail.length} patients have no email address`,
      count: noEmail.length,
    });
  }

  // Duplicate emails
  const emailCounts = new Map<string, number>();
  for (const p of patients) {
    if (p.email) {
      emailCounts.set(p.email.toLowerCase(), (emailCounts.get(p.email.toLowerCase()) || 0) + 1);
    }
  }
  const dupEmails = [...emailCounts.entries()].filter(([, c]) => c > 1);
  if (dupEmails.length > 0) {
    issues.push({
      severity: "warning",
      entityType: "Patient",
      description: `${dupEmails.length} duplicate email addresses found (possible duplicate patient records)`,
      count: dupEmails.length,
    });
  }

  // Duplicate service names
  const svcNames = new Map<string, number>();
  for (const s of services) {
    const norm = s.name.toLowerCase().trim();
    svcNames.set(norm, (svcNames.get(norm) || 0) + 1);
  }
  const dupSvcs = [...svcNames.entries()].filter(([, c]) => c > 1);
  if (dupSvcs.length > 0) {
    issues.push({
      severity: "info",
      entityType: "Service",
      description: `${dupSvcs.length} possible duplicate services detected by name`,
      count: dupSvcs.length,
    });
  }

  // Orphaned appointment references
  const serviceIds = new Set(services.map((s) => s.sourceId));
  const patientIds = new Set(patients.map((p) => p.sourceId));
  const orphanedService = appointments.filter(
    (a) => a.serviceSourceId && !serviceIds.has(a.serviceSourceId)
  );
  if (orphanedService.length > 0) {
    issues.push({
      severity: "warning",
      entityType: "Appointment",
      description: `${orphanedService.length} appointments reference services not found in source data`,
      count: orphanedService.length,
    });
  }

  const orphanedPatient = appointments.filter(
    (a) => !patientIds.has(a.patientSourceId)
  );
  if (orphanedPatient.length > 0) {
    issues.push({
      severity: "error",
      entityType: "Appointment",
      description: `${orphanedPatient.length} appointments reference patients not found in source data`,
      count: orphanedPatient.length,
    });
  }

  // Unknown providers
  const providerNames = new Set(appointments.map((a) => a.providerName).filter(Boolean));
  if (providerNames.size > 0) {
    issues.push({
      severity: "info",
      entityType: "Appointment",
      description: `Found ${providerNames.size} unique provider names: ${[...providerNames].join(", ")}`,
      count: providerNames.size,
    });
  }

  return issues;
}
