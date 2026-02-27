"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { MigrationSource } from "@prisma/client";
import { encrypt } from "@/lib/migration/crypto";
import { getMigrationProvider } from "@/lib/migration/providers";
import type { MigrationCredentials } from "@/lib/migration/providers/types";
import {
  discoverSourceData as agentDiscover,
  proposeMappings as agentProposeMappings,
  generateVerificationReport as agentVerify,
} from "@/lib/migration/agent";
import { executeMigration as runPipeline } from "@/lib/migration/pipeline";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================================
// Job Lifecycle
// ============================================================

export async function createMigrationJob(
  source: MigrationSource
): Promise<ActionResult<{ jobId: string }>> {
  try {
    const user = await requirePermission("migration", "create");

    const job = await prisma.migrationJob.create({
      data: {
        clinicId: user.clinicId,
        source,
        status: "Connecting",
        startedById: user.id,
        startedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "MigrationStart",
        entityType: "MigrationJob",
        entityId: job.id,
        details: JSON.stringify({ source }),
      },
    });

    revalidatePath("/settings/migration");
    return { success: true, data: { jobId: job.id } };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    throw error;
  }
}

export async function connectMigrationSource(
  jobId: string,
  credentials: MigrationCredentials,
  consentAcknowledged: boolean
): Promise<ActionResult<{ businessName?: string }>> {
  try {
    const user = await requirePermission("migration", "create");

    if (!consentAcknowledged) {
      return { success: false, error: "You must acknowledge the authorization consent to proceed." };
    }

    // Verify job belongs to this clinic
    const job = await prisma.migrationJob.findFirst({
      where: { id: jobId, clinicId: user.clinicId },
    });
    if (!job) return { success: false, error: "Migration job not found" };

    // Test connection
    const provider = getMigrationProvider(job.source);
    const result = await provider.testConnection(credentials);

    if (!result.connected) {
      return { success: false, error: result.errorMessage || "Connection failed" };
    }

    // Record consent and encrypt credentials
    const headersList = await headers();
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      "unknown";

    const sourceName = job.source;
    const consentText = `I authorize Neuvvia to connect to ${sourceName} using the credentials I've provided and to read my clinic's data (patients, appointments, services, charts, photos, and invoices) for the purpose of migrating it to Neuvvia. Neuvvia will NOT modify or delete any data on ${sourceName}.`;

    await prisma.migrationJob.update({
      where: { id: jobId },
      data: {
        status: "Connected",
        credentialsEncrypted: encrypt(JSON.stringify(credentials)),
        connectionValidatedAt: new Date(),
        consentText,
        consentSignedAt: new Date(),
        consentSignedById: user.id,
        consentIpAddress: ipAddress,
      },
    });

    revalidatePath(`/settings/migration/${jobId}`);
    return { success: true, data: { businessName: result.businessName } };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    throw error;
  }
}

// ============================================================
// AI Agent Steps
// ============================================================

export async function discoverMigrationData(
  jobId: string
): Promise<ActionResult<null>> {
  try {
    const user = await requirePermission("migration", "edit");

    const job = await prisma.migrationJob.findFirst({
      where: { id: jobId, clinicId: user.clinicId },
    });
    if (!job) return { success: false, error: "Migration job not found" };

    await prisma.migrationJob.update({
      where: { id: jobId },
      data: { status: "Discovering" },
    });

    const provider = getMigrationProvider(job.source);
    const discovery = await agentDiscover(job, provider);

    await prisma.migrationJob.update({
      where: { id: jobId },
      data: {
        status: "Discovered",
        sourceDiscovery: JSON.stringify(discovery),
      },
    });

    revalidatePath(`/settings/migration/${jobId}`);
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    // Update job status to failed
    await prisma.migrationJob.update({
      where: { id: jobId },
      data: {
        status: "Failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => {});
    throw error;
  }
}

export async function getMappingProposal(
  jobId: string
): Promise<ActionResult<null>> {
  try {
    const user = await requirePermission("migration", "edit");

    const job = await prisma.migrationJob.findFirst({
      where: { id: jobId, clinicId: user.clinicId },
    });
    if (!job) return { success: false, error: "Migration job not found" };

    await prisma.migrationJob.update({
      where: { id: jobId },
      data: { status: "MappingInProgress" },
    });

    // Get existing Neuvvia services for mapping
    const neuvviaServices = await prisma.service.findMany({
      where: { clinicId: user.clinicId },
      select: { id: true, name: true, category: true, price: true },
    });

    const provider = getMigrationProvider(job.source);
    const mapping = await agentProposeMappings(job, provider, neuvviaServices);

    // Separate auto-resolved from needs_input
    const autoResolved = mapping.mappings.filter((m) => m.action !== "needs_input");
    const needsInput = mapping.mappings.filter((m) => m.action === "needs_input");

    await prisma.migrationJob.update({
      where: { id: jobId },
      data: {
        status: "MappingReview",
        mappingConfig: JSON.stringify({ mappings: autoResolved }),
        pendingDecisions: needsInput.length > 0 ? JSON.stringify(needsInput) : null,
      },
    });

    revalidatePath(`/settings/migration/${jobId}`);
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    throw error;
  }
}

export async function resolveDecision(
  jobId: string,
  sourceId: string,
  action: "map_existing" | "create_new" | "skip",
  targetId?: string,
  targetName?: string
): Promise<ActionResult<null>> {
  try {
    const user = await requirePermission("migration", "edit");

    const job = await prisma.migrationJob.findFirst({
      where: { id: jobId, clinicId: user.clinicId },
    });
    if (!job) return { success: false, error: "Migration job not found" };

    const mappingConfig = job.mappingConfig ? JSON.parse(job.mappingConfig) : { mappings: [] };
    const pendingDecisions = job.pendingDecisions ? JSON.parse(job.pendingDecisions) : [];

    // Find and remove the decision from pending
    const decisionIndex = pendingDecisions.findIndex(
      (d: { sourceId: string }) => d.sourceId === sourceId
    );
    if (decisionIndex === -1) {
      return { success: false, error: "Decision not found in pending list" };
    }

    const decision = pendingDecisions[decisionIndex];
    pendingDecisions.splice(decisionIndex, 1);

    // Add resolved decision to mapping config
    mappingConfig.mappings.push({
      ...decision,
      action,
      targetId: targetId || null,
      targetName: targetName || null,
    });

    await prisma.migrationJob.update({
      where: { id: jobId },
      data: {
        mappingConfig: JSON.stringify(mappingConfig),
        pendingDecisions: pendingDecisions.length > 0 ? JSON.stringify(pendingDecisions) : null,
      },
    });

    revalidatePath(`/settings/migration/${jobId}`);
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    throw error;
  }
}

export async function approveMappingAndStart(
  jobId: string
): Promise<ActionResult<null>> {
  try {
    const user = await requirePermission("migration", "edit");

    const job = await prisma.migrationJob.findFirst({
      where: { id: jobId, clinicId: user.clinicId },
    });
    if (!job) return { success: false, error: "Migration job not found" };

    if (job.pendingDecisions) {
      const pending = JSON.parse(job.pendingDecisions);
      if (pending.length > 0) {
        return { success: false, error: `${pending.length} decisions still need your input` };
      }
    }

    await prisma.migrationJob.update({
      where: { id: jobId },
      data: { status: "Migrating" },
    });

    // Run pipeline async (fire and forget — client polls for status)
    const provider = getMigrationProvider(job.source);
    const updatedJob = await prisma.migrationJob.findUnique({ where: { id: jobId } });
    if (updatedJob) {
      runPipeline(updatedJob, provider).catch(async (err) => {
        console.error("[Migration] Pipeline error:", err);
        await prisma.migrationJob.update({
          where: { id: jobId },
          data: {
            status: "Failed",
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        });
      });
    }

    revalidatePath(`/settings/migration/${jobId}`);
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    throw error;
  }
}

// ============================================================
// Pause / Resume
// ============================================================

export async function pauseMigration(
  jobId: string
): Promise<ActionResult<null>> {
  try {
    const user = await requirePermission("migration", "edit");

    const job = await prisma.migrationJob.findFirst({
      where: { id: jobId, clinicId: user.clinicId, status: "Migrating" },
    });
    if (!job) return { success: false, error: "No active migration to pause" };

    await prisma.migrationJob.update({
      where: { id: jobId },
      data: { status: "Paused" },
    });

    revalidatePath(`/settings/migration/${jobId}`);
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    throw error;
  }
}

export async function resumeMigration(
  jobId: string
): Promise<ActionResult<null>> {
  try {
    const user = await requirePermission("migration", "edit");

    const job = await prisma.migrationJob.findFirst({
      where: { id: jobId, clinicId: user.clinicId, status: "Paused" },
    });
    if (!job) return { success: false, error: "No paused migration to resume" };

    await prisma.migrationJob.update({
      where: { id: jobId },
      data: { status: "Migrating" },
    });

    // Resume pipeline
    const provider = getMigrationProvider(job.source);
    const updatedJob = await prisma.migrationJob.findUnique({ where: { id: jobId } });
    if (updatedJob) {
      runPipeline(updatedJob, provider).catch(async (err) => {
        console.error("[Migration] Pipeline error:", err);
        await prisma.migrationJob.update({
          where: { id: jobId },
          data: {
            status: "Failed",
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        });
      });
    }

    revalidatePath(`/settings/migration/${jobId}`);
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    throw error;
  }
}

// ============================================================
// Status & Logs
// ============================================================

export async function getMigrationStatus(jobId: string) {
  try {
    const user = await requirePermission("migration", "view");

    const job = await prisma.migrationJob.findFirst({
      where: { id: jobId, clinicId: user.clinicId },
      include: {
        _count: {
          select: {
            logs: true,
            entityMaps: true,
          },
        },
      },
    });

    if (!job) return null;

    return {
      id: job.id,
      source: job.source,
      status: job.status,
      sourceDiscovery: job.sourceDiscovery ? JSON.parse(job.sourceDiscovery) : null,
      mappingConfig: job.mappingConfig ? JSON.parse(job.mappingConfig) : null,
      pendingDecisions: job.pendingDecisions ? JSON.parse(job.pendingDecisions) : null,
      progress: JSON.parse(job.progress),
      agentLog: job.agentLog,
      consentSignedAt: job.consentSignedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      errorMessage: job.errorMessage,
      logCount: job._count.logs,
      entityMapCount: job._count.entityMaps,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
}

export async function getMigrationLogs(
  jobId: string,
  options?: { entityType?: string; status?: string; page?: number; limit?: number }
) {
  try {
    const user = await requirePermission("migration", "view");

    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;

    const where = {
      jobId,
      job: { clinicId: user.clinicId },
      ...(options?.entityType ? { entityType: options.entityType as never } : {}),
      ...(options?.status ? { status: options.status } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.migrationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.migrationLog.count({ where }),
    ]);

    return { logs, total, page, limit };
  } catch (error) {
    if (error instanceof AuthorizationError) return { logs: [], total: 0, page: 1, limit: 50 };
    throw error;
  }
}

// ============================================================
// Completion & Cleanup
// ============================================================

export async function completeMigration(
  jobId: string
): Promise<ActionResult<null>> {
  try {
    const user = await requirePermission("migration", "edit");

    const job = await prisma.migrationJob.findFirst({
      where: { id: jobId, clinicId: user.clinicId, status: "Verifying" },
    });
    if (!job) return { success: false, error: "No migration to complete" };

    // Generate verification report
    const logs = await prisma.migrationLog.findMany({
      where: { jobId },
      select: { entityType: true, status: true, aiReasoning: true, errorMessage: true },
    });

    const report = await agentVerify(logs);

    await prisma.migrationJob.update({
      where: { id: jobId },
      data: {
        status: "Completed",
        completedAt: new Date(),
        agentLog: (job.agentLog || "") + `\n[${new Date().toISOString()}] Verification report:\n${report.summary}`,
      },
    });

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "MigrationComplete",
        entityType: "MigrationJob",
        entityId: jobId,
        details: JSON.stringify(report),
      },
    });

    revalidatePath("/settings/migration");
    revalidatePath(`/settings/migration/${jobId}`);
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    throw error;
  }
}

export async function deleteMigrationJob(
  jobId: string
): Promise<ActionResult<null>> {
  try {
    const user = await requirePermission("migration", "delete");

    const job = await prisma.migrationJob.findFirst({
      where: { id: jobId, clinicId: user.clinicId },
    });
    if (!job) return { success: false, error: "Migration job not found" };

    // Don't delete active migrations
    if (job.status === "Migrating") {
      return { success: false, error: "Cannot delete an active migration. Pause it first." };
    }

    await prisma.migrationJob.delete({ where: { id: jobId } });

    revalidatePath("/settings/migration");
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    throw error;
  }
}

// ============================================================
// List Jobs
// ============================================================

export async function getMigrationJobs() {
  try {
    const user = await requirePermission("migration", "view");

    return prisma.migrationJob.findMany({
      where: { clinicId: user.clinicId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        source: true,
        status: true,
        startedAt: true,
        completedAt: true,
        errorMessage: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) return [];
    throw error;
  }
}
