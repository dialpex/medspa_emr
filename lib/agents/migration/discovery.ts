/**
 * Deterministic migration discovery and verification.
 *
 * These functions replace the legacy OpenAI agent with straightforward
 * data fetching and aggregation. AI is used where it genuinely adds value
 * (field inference, semantic classification) — not for counting entities.
 */

import type { MigrationJob } from "@prisma/client";
import type { MigrationProvider, MigrationCredentials } from "@/lib/migration/providers/types";
import { decrypt } from "@/lib/migration/crypto";
import type { DiscoveryResponse, MappingResponse, VerificationResponse } from "./types";

function decryptCredentials(job: MigrationJob): MigrationCredentials {
  if (!job.credentialsEncrypted) {
    throw new Error("No encrypted credentials on migration job");
  }
  return JSON.parse(decrypt(job.credentialsEncrypted));
}

/**
 * Discover what data exists in the source platform.
 * Pure data fetching + deterministic analysis — no LLM needed.
 */
export async function discoverSourceData(
  job: MigrationJob,
  provider: MigrationProvider
): Promise<DiscoveryResponse> {
  const credentials = decryptCredentials(job);

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

  // Sample forms and documents from first 5 patients
  let formCount = 0;
  let documentCount = 0;
  const samplePatients = patients.data.slice(0, 5);
  const sampleSize = Math.min(5, patients.data.length);

  if (sampleSize > 0) {
    for (const p of samplePatients) {
      if (provider.fetchForms) {
        try {
          const forms = await provider.fetchForms(credentials, { cursor: p.sourceId });
          formCount += forms.data.length;
        } catch {
          // Non-critical — continue sampling
        }
      }
      if (provider.fetchDocuments) {
        try {
          const docs = await provider.fetchDocuments(credentials, { cursor: p.sourceId });
          documentCount += docs.data.length;
        } catch {
          // Non-critical — continue sampling
        }
      }
    }
    const totalPatients = patients.totalCount ?? patients.data.length;
    formCount = Math.round((formCount / sampleSize) * totalPatients);
    documentCount = Math.round((documentCount / sampleSize) * totalPatients);
  }

  const patientCount = patients.totalCount ?? patients.data.length;
  const serviceCount = services.totalCount ?? services.data.length;
  const appointmentCount = appointments.totalCount ?? appointments.data.length;
  const invoiceCount = invoices.totalCount ?? invoices.data.length;

  return {
    summary: `Found ${patientCount} patients, ${serviceCount} services, ${appointmentCount} appointments, ${invoiceCount} invoices, ${photoCount} photos, ~${formCount} forms, and ~${documentCount} documents.`,
    entities: [
      { type: "Patient", count: patientCount, sampleNames: patients.data.slice(0, 3).map(p => `${p.firstName} ${p.lastName}`) },
      { type: "Service", count: serviceCount, sampleNames: services.data.slice(0, 3).map(s => s.name) },
      { type: "Appointment", count: appointmentCount, sampleNames: [] },
      { type: "Invoice", count: invoiceCount, sampleNames: [] },
      { type: "Photo", count: photoCount, sampleNames: [] },
      { type: "Form", count: formCount, sampleNames: [] },
      { type: "Document", count: documentCount, sampleNames: [] },
    ],
    issues: detectDataIssues(patients.data, services.data, appointments.data),
    recommendations: buildRecommendations(patients.data, services.data),
  };
}

/**
 * Propose service mappings — exact name match, otherwise create new.
 * Service mapping is ultimately a user decision (UI review step), not an AI guess.
 */
export async function proposeServiceMappings(
  job: MigrationJob,
  provider: MigrationProvider,
  neuvviaServices: Array<{ id: string; name: string; category?: string | null; price: number }>
): Promise<MappingResponse> {
  const credentials = decryptCredentials(job);
  const sourceServices = await provider.fetchServices(credentials);

  const mappings = sourceServices.data.map((s) => {
    // Exact name match (case-insensitive)
    const match = neuvviaServices.find(
      (ns) => ns.name.toLowerCase().trim() === s.name.toLowerCase().trim()
    );

    if (match) {
      return {
        sourceId: s.sourceId,
        sourceName: s.name,
        action: "map_existing" as const,
        confidence: 1.0,
        reasoning: `Exact name match: "${match.name}"`,
        targetId: match.id,
        targetName: match.name,
      };
    }

    return {
      sourceId: s.sourceId,
      sourceName: s.name,
      action: "create_new" as const,
      confidence: 1.0,
      reasoning: "No matching service — will create new",
      targetId: null,
      targetName: null,
    };
  });

  return {
    mappings,
    autoResolved: mappings.length,
    needsInput: 0,
  };
}

/**
 * Generate verification report from migration logs.
 * Pure aggregation — counts by entity type and status.
 */
export function generateVerificationReport(
  migrationLogs: Array<{
    entityType: string;
    status: string;
    aiReasoning?: string | null;
    errorMessage?: string | null;
  }>
): VerificationResponse {
  const counts: Record<string, Record<string, number>> = {};
  for (const log of migrationLogs) {
    if (!counts[log.entityType]) {
      counts[log.entityType] = {};
    }
    counts[log.entityType][log.status] = (counts[log.entityType][log.status] || 0) + 1;
  }

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

  const warnings: string[] = [];
  if (totalFailed > 0) {
    warnings.push(`${totalFailed} records failed to import — review error details.`);
  }
  for (const r of results) {
    if (r.failed > 0) {
      warnings.push(`${r.entityType}: ${r.failed} failures out of ${r.sourceCount} records.`);
    }
  }

  return {
    summary: `Migration complete. ${totalImported} records imported across ${results.length} entity types.${totalFailed > 0 ? ` ${totalFailed} failures need review.` : ""}`,
    results,
    warnings,
  };
}

// --- Deterministic data quality checks ---

function detectDataIssues(
  patients: Array<{ sourceId: string; firstName: string; lastName: string; email?: string; phone?: string; dateOfBirth?: string }>,
  services: Array<{ sourceId: string; name: string }>,
  appointments: Array<{ sourceId: string; patientSourceId: string; serviceSourceId?: string; providerName?: string }>
): DiscoveryResponse["issues"] {
  const issues: DiscoveryResponse["issues"] = [];

  const noEmail = patients.filter((p) => !p.email);
  if (noEmail.length > 0) {
    issues.push({
      severity: "warning",
      entityType: "Patient",
      description: `${noEmail.length} patients have no email address`,
      count: noEmail.length,
    });
  }

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
      description: `${dupEmails.length} duplicate email addresses (possible duplicate patients)`,
      count: dupEmails.length,
    });
  }

  const svcNames = new Map<string, number>();
  for (const s of services) {
    svcNames.set(s.name.toLowerCase().trim(), (svcNames.get(s.name.toLowerCase().trim()) || 0) + 1);
  }
  const dupSvcs = [...svcNames.entries()].filter(([, c]) => c > 1);
  if (dupSvcs.length > 0) {
    issues.push({
      severity: "info",
      entityType: "Service",
      description: `${dupSvcs.length} possible duplicate services by name`,
      count: dupSvcs.length,
    });
  }

  const serviceIds = new Set(services.map((s) => s.sourceId));
  const patientIds = new Set(patients.map((p) => p.sourceId));

  const orphanedService = appointments.filter(
    (a) => a.serviceSourceId && !serviceIds.has(a.serviceSourceId)
  );
  if (orphanedService.length > 0) {
    issues.push({
      severity: "warning",
      entityType: "Appointment",
      description: `${orphanedService.length} appointments reference unknown services`,
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
      description: `${orphanedPatient.length} appointments reference unknown patients`,
      count: orphanedPatient.length,
    });
  }

  const providerNames = new Set(appointments.map((a) => a.providerName).filter(Boolean));
  if (providerNames.size > 0) {
    issues.push({
      severity: "info",
      entityType: "Appointment",
      description: `${providerNames.size} unique providers: ${[...providerNames].join(", ")}`,
      count: providerNames.size,
    });
  }

  return issues;
}

function buildRecommendations(
  patients: Array<{ email?: string }>,
  services: Array<{ sourceId: string; name: string }>
): string[] {
  const recs: string[] = [];
  const noEmail = patients.filter((p) => !p.email).length;
  if (noEmail > 0) {
    recs.push(`${noEmail} patients lack email — consider adding emails post-migration for communication.`);
  }
  if (services.length > 0) {
    recs.push("Review service mappings to match your current catalog before importing.");
  }
  return recs;
}
