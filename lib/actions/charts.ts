"use server";

import { prisma } from "@/lib/prisma";
import {
  requirePermission,
  enforceTenantIsolation,
  AuthorizationError,
  type AuthenticatedUser,
} from "@/lib/rbac";
import { createHash } from "crypto";
import { validateTreatmentCard } from "@/lib/templates/validation";
import { revalidatePath } from "next/cache";

export interface ChartUpdateInput {
  chiefComplaint?: string;
  areasTreated?: string;
  productsUsed?: string;
  dosageUnits?: string;

  aftercareNotes?: string;
  additionalNotes?: string;
}

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Generate a hash of the chart content for integrity verification
 */
function generateRecordHash(chart: {
  id: string;
  chiefComplaint: string | null;
  areasTreated: string | null;
  productsUsed: string | null;
  dosageUnits: string | null;

  aftercareNotes: string | null;
  additionalNotes: string | null;
  treatmentCards?: Array<{
    narrativeText: string;
    structuredData: string;
    sortOrder: number;
  }>;
}): string {
  const cards = (chart.treatmentCards ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({ narrative: c.narrativeText, structured: c.structuredData }));

  const content = JSON.stringify({
    id: chart.id,
    chiefComplaint: chart.chiefComplaint,
    areasTreated: chart.areasTreated,
    productsUsed: chart.productsUsed,
    dosageUnits: chart.dosageUnits,

    aftercareNotes: chart.aftercareNotes,
    additionalNotes: chart.additionalNotes,
    treatmentCards: cards,
  });
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

/**
 * Create a new chart
 */
export async function createChart(input: {
  patientId: string;
  appointmentId?: string;
  templateId?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("charts", "create");

    const chart = await prisma.chart.create({
      data: {
        clinicId: user.clinicId,
        patientId: input.patientId,
        appointmentId: input.appointmentId,
        templateId: input.templateId,
        createdById: user.id,
        status: "Draft",
      },
    });

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "ChartCreate",
        entityType: "Chart",
        entityId: chart.id,
        details: JSON.stringify({
          patientId: input.patientId,
          appointmentId: input.appointmentId,
          templateId: input.templateId,
        }),
      },
    });

    return { success: true, data: { id: chart.id } };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * List charts with optional filters
 */
export async function getCharts(filters?: {
  status?: string;
  patientId?: string;
  providerId?: string;
}) {
  const user = await requirePermission("charts", "view");

  return prisma.chart.findMany({
    where: {
      clinicId: user.clinicId,
      deletedAt: null,
      ...(filters?.status && { status: filters.status as "Draft" | "NeedsSignOff" | "MDSigned" }),
      ...(filters?.patientId && { patientId: filters.patientId }),
      ...(filters?.providerId && { createdById: filters.providerId }),
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      createdBy: { select: { name: true } },
      encounter: { select: { id: true, status: true, provider: { select: { name: true } } } },
      template: { select: { name: true } },
      appointment: { select: { startTime: true, service: { select: { name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Get chart with photos and template for editor/detail view
 */
export async function getChartWithPhotos(chartId: string) {
  const user = await requirePermission("charts", "view");

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    include: {
      patient: {
        select: {
          id: true, firstName: true, lastName: true, allergies: true,
          dateOfBirth: true, tags: true, medicalNotes: true,
          appointments: {
            where: { deletedAt: null },
            orderBy: { startTime: "desc" as const },
            take: 1,
            select: { startTime: true },
          },
        },
      },
      createdBy: { select: { name: true } },
      signedBy: { select: { name: true } },
      providerSignedBy: { select: { name: true } },
      encounter: {
        select: {
          id: true,
          status: true,
          startedAt: true,
          finalizedAt: true,
          provider: { select: { name: true } },
          patient: { select: { firstName: true, lastName: true } },
        },
      },
      template: true,
      photos: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
      },
      treatmentCards: {
        orderBy: { sortOrder: "asc" },
        include: {
          photos: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      appointment: {
        select: { startTime: true, service: { select: { name: true } } },
      },
    },
  });

  if (!chart) return null;
  enforceTenantIsolation(user, chart.clinicId);

  await prisma.auditLog.create({
    data: {
      clinicId: user.clinicId,
      userId: user.id,
      action: "ChartView",
      entityType: "Chart",
      entityId: chartId,
      details: JSON.stringify({ patientId: chart.patientId }),
    },
  });

  return chart;
}

/**
 * Get a chart by ID with permission and tenant checks
 */
export async function getChart(chartId: string): Promise<ActionResult<{
  id: string;
  clinicId: string;
  patientId: string;
  status: string;
  chiefComplaint: string | null;
  areasTreated: string | null;
  productsUsed: string | null;
  dosageUnits: string | null;

  aftercareNotes: string | null;
  additionalNotes: string | null;
  signedById: string | null;
  signedByName: string | null;
  signedAt: Date | null;
  recordHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}>> {
  try {
    const user = await requirePermission("charts", "view");

    const chart = await prisma.chart.findUnique({
      where: { id: chartId },
    });

    if (!chart) {
      return { success: false, error: "Chart not found" };
    }

    enforceTenantIsolation(user, chart.clinicId);

    // Log chart view
    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "ChartView",
        entityType: "Chart",
        entityId: chartId,
        details: JSON.stringify({ patientId: chart.patientId }),
      },
    });

    return { success: true, data: chart };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Update chart content - NOT allowed for MedicalDirector
 */
export async function updateChart(
  chartId: string,
  data: ChartUpdateInput
): Promise<ActionResult> {
  try {
    const user = await requirePermission("charts", "edit");

    const chart = await prisma.chart.findUnique({
      where: { id: chartId },
      include: { encounter: { select: { status: true } } },
    });

    if (!chart) {
      return { success: false, error: "Chart not found" };
    }

    enforceTenantIsolation(user, chart.clinicId);

    // Cannot edit non-draft charts (covers NeedsSignOff/PendingReview and MDSigned/Finalized)
    const effectiveStatus = chart.encounter
      ? (chart.encounter.status === "Draft" ? "Draft" : "Locked")
      : (chart.status === "Draft" ? "Draft" : "Locked");
    if (effectiveStatus !== "Draft") {
      const isFinalized = chart.encounter
        ? chart.encounter.status === "Finalized"
        : chart.status === "MDSigned";
      return {
        success: false,
        error: isFinalized
          ? "Encounter finalized. Changes require addendum."
          : "Cannot edit a non-draft chart",
      };
    }

    await prisma.chart.update({
      where: { id: chartId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    // Log chart update
    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "ChartUpdate",
        entityType: "Chart",
        entityId: chartId,
        details: JSON.stringify({ fields: Object.keys(data) }),
      },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Update a treatment card's narrative text
 */
export async function updateTreatmentCard(
  cardId: string,
  data: { narrativeText?: string; structuredData?: string }
): Promise<ActionResult> {
  try {
    const user = await requirePermission("charts", "edit");

    const card = await prisma.treatmentCard.findUnique({
      where: { id: cardId },
      include: {
        chart: {
          select: {
            id: true,
            clinicId: true,
            status: true,
            encounter: { select: { status: true } },
          },
        },
      },
    });

    if (!card) {
      return { success: false, error: "Treatment card not found" };
    }

    enforceTenantIsolation(user, card.chart.clinicId);

    // Check encounter status when available, fall back to chart status
    const isDraft = card.chart.encounter
      ? card.chart.encounter.status === "Draft"
      : card.chart.status === "Draft";
    if (!isDraft) {
      const isFinalized = card.chart.encounter
        ? card.chart.encounter.status === "Finalized"
        : card.chart.status === "MDSigned";
      return {
        success: false,
        error: isFinalized
          ? "Encounter finalized. Changes require addendum."
          : "Cannot edit treatment cards on a non-draft chart",
      };
    }

    // Validate structuredData is parseable JSON when provided
    if (data.structuredData !== undefined) {
      try {
        JSON.parse(data.structuredData);
      } catch {
        return { success: false, error: "Invalid JSON in structuredData" };
      }
    }

    const updateData: { narrativeText?: string; structuredData?: string } = {};
    if (data.narrativeText !== undefined) updateData.narrativeText = data.narrativeText;
    if (data.structuredData !== undefined) updateData.structuredData = data.structuredData;

    await prisma.treatmentCard.update({
      where: { id: cardId },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "ChartUpdate",
        entityType: "TreatmentCard",
        entityId: cardId,
        details: JSON.stringify({ chartId: card.chart.id, fields: Object.keys(data) }),
      },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Submit chart for Medical Director review
 */
export async function submitChartForReview(chartId: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("charts", "edit");

    const chart = await prisma.chart.findUnique({
      where: { id: chartId },
      include: { encounter: { select: { id: true, status: true } } },
    });

    if (!chart) {
      return { success: false, error: "Chart not found" };
    }

    enforceTenantIsolation(user, chart.clinicId);

    // Check encounter status when available
    const isDraft = chart.encounter
      ? chart.encounter.status === "Draft"
      : chart.status === "Draft";
    if (!isDraft) {
      return { success: false, error: "Only draft charts can be submitted for review" };
    }

    // Dual-write: update chart status AND encounter status
    await prisma.chart.update({
      where: { id: chartId },
      data: {
        status: "NeedsSignOff",
        updatedAt: new Date(),
      },
    });

    if (chart.encounter) {
      await prisma.encounter.update({
        where: { id: chart.encounter.id },
        data: { status: "PendingReview" },
      });
    }

    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Sign a chart - transitions NeedsSignOff -> MDSigned
 * Only allowed for users with chart sign permission (MedicalDirector, Owner, Admin)
 */
export async function signChart(chartId: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("charts", "sign");

    const chart = await prisma.chart.findUnique({
      where: { id: chartId },
      include: { encounter: { select: { id: true, status: true } } },
    });

    if (!chart) {
      return { success: false, error: "Chart not found" };
    }

    enforceTenantIsolation(user, chart.clinicId);

    // Check encounter status when available
    const isNeedsSignOff = chart.encounter
      ? chart.encounter.status === "PendingReview"
      : chart.status === "NeedsSignOff";
    if (!isNeedsSignOff) {
      return {
        success: false,
        error: "Only charts with NeedsSignOff status can be signed",
      };
    }

    // Generate record hash for integrity
    const recordHash = generateRecordHash(chart);
    const signedAt = new Date();

    // Dual-write: update chart signing fields AND encounter status
    await prisma.chart.update({
      where: { id: chartId },
      data: {
        status: "MDSigned",
        signedById: user.id,
        signedByName: user.name,
        signedAt,
        recordHash,
        updatedAt: signedAt,
      },
    });

    if (chart.encounter) {
      await prisma.encounter.update({
        where: { id: chart.encounter.id },
        data: { status: "Finalized", finalizedAt: signedAt },
      });
    }

    // Log chart signing
    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "ChartSign",
        entityType: "Chart",
        entityId: chartId,
        details: JSON.stringify({
          patientId: chart.patientId,
          encounterId: chart.encounter?.id,
          previousStatus: "NeedsSignOff",
          newStatus: "MDSigned",
          recordHash,
        }),
      },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Direct sign chart function for testing purposes
 * This bypasses the session-based auth and accepts a user object directly
 */
export async function signChartWithUser(
  chartId: string,
  user: AuthenticatedUser
): Promise<ActionResult> {
  try {
    const { hasPermission, enforceTenantIsolation: enforce } = await import("@/lib/rbac");

    if (!hasPermission(user.role, "charts", "sign")) {
      return {
        success: false,
        error: `Permission denied: ${user.role} cannot sign charts`,
      };
    }

    const chart = await prisma.chart.findUnique({
      where: { id: chartId },
      include: { encounter: { select: { id: true, status: true } } },
    });

    if (!chart) {
      return { success: false, error: "Chart not found" };
    }

    enforce(user, chart.clinicId);

    const isNeedsSignOff = chart.encounter
      ? chart.encounter.status === "PendingReview"
      : chart.status === "NeedsSignOff";
    if (!isNeedsSignOff) {
      return {
        success: false,
        error: "Only charts with NeedsSignOff status can be signed",
      };
    }

    const recordHash = generateRecordHash(chart);
    const signedAt = new Date();

    await prisma.chart.update({
      where: { id: chartId },
      data: {
        status: "MDSigned",
        signedById: user.id,
        signedByName: user.name,
        signedAt,
        recordHash,
        updatedAt: signedAt,
      },
    });

    if (chart.encounter) {
      await prisma.encounter.update({
        where: { id: chart.encounter.id },
        data: { status: "Finalized", finalizedAt: signedAt },
      });
    }

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "ChartSign",
        entityType: "Chart",
        entityId: chartId,
        details: JSON.stringify({
          patientId: chart.patientId,
          encounterId: chart.encounter?.id,
          previousStatus: "NeedsSignOff",
          newStatus: "MDSigned",
          recordHash,
        }),
      },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Direct update chart function for testing purposes
 * This bypasses the session-based auth and accepts a user object directly
 */
export async function updateChartWithUser(
  chartId: string,
  data: ChartUpdateInput,
  user: AuthenticatedUser
): Promise<ActionResult> {
  try {
    const { hasPermission, enforceTenantIsolation: enforce } = await import("@/lib/rbac");

    if (!hasPermission(user.role, "charts", "edit")) {
      return {
        success: false,
        error: `Permission denied: ${user.role} cannot edit charts`,
      };
    }

    const chart = await prisma.chart.findUnique({
      where: { id: chartId },
      include: { encounter: { select: { status: true } } },
    });

    if (!chart) {
      return { success: false, error: "Chart not found" };
    }

    enforce(user, chart.clinicId);

    const isDraft = chart.encounter
      ? chart.encounter.status === "Draft"
      : chart.status === "Draft";
    if (!isDraft) {
      const isFinalized = chart.encounter
        ? chart.encounter.status === "Finalized"
        : chart.status === "MDSigned";
      return {
        success: false,
        error: isFinalized
          ? "Encounter finalized. Changes require addendum."
          : "Cannot edit a non-draft chart",
      };
    }

    await prisma.chart.update({
      where: { id: chartId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "ChartUpdate",
        entityType: "Chart",
        entityId: chartId,
        details: JSON.stringify({ fields: Object.keys(data) }),
      },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Provider Sign & Lock — transitions Draft → MDSigned/Finalized directly.
 * Validates all treatment cards for high-risk blocking fields before signing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function providerSignChart(chartId: string): Promise<ActionResult<any>> {
  try {
    const user = await requirePermission("charts", "edit");
    return _providerSign(chartId, user);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Test variant — bypasses session-based auth.
 */
export async function providerSignChartWithUser(
  chartId: string,
  user: AuthenticatedUser
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<ActionResult<any>> {
  const { hasPermission } = await import("@/lib/rbac");
  if (!hasPermission(user.role, "charts", "edit")) {
    return { success: false, error: `Permission denied: ${user.role} cannot edit charts` };
  }
  return _providerSign(chartId, user);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function _providerSign(
  chartId: string,
  user: AuthenticatedUser
): Promise<ActionResult<any>> {
  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    include: {
      encounter: { select: { id: true, status: true } },
      treatmentCards: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!chart) {
    return { success: false, error: "Chart not found" };
  }

  enforceTenantIsolation(user, chart.clinicId);

  // Must be Draft
  const isDraft = chart.encounter
    ? chart.encounter.status === "Draft"
    : chart.status === "Draft";
  if (!isDraft) {
    const isFinalized = chart.encounter
      ? chart.encounter.status === "Finalized"
      : chart.status === "MDSigned";
    return {
      success: false,
      error: isFinalized
        ? "Encounter finalized. Changes require addendum."
        : "Only draft charts can be signed",
    };
  }

  // Validate all treatment cards
  const blockingErrors: Array<{ cardId: string; cardTitle: string; missingFields: string[] }> = [];
  for (const card of chart.treatmentCards) {
    const result = validateTreatmentCard(card.templateType, card.structuredData);
    if (result.isSignBlocking) {
      blockingErrors.push({
        cardId: card.id,
        cardTitle: card.title,
        missingFields: result.missingHighRiskFields,
      });
    }
  }

  if (blockingErrors.length > 0) {
    return {
      success: false,
      error: "High-risk fields are incomplete on one or more treatment cards",
      data: { blockingErrors },
    };
  }

  // Load full user record to check supervision requirement
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { requiresMDReview: true },
  });

  const signedAt = new Date();
  const recordHash = generateRecordHash({ ...chart, treatmentCards: chart.treatmentCards });

  if (fullUser?.requiresMDReview) {
    // Supervised provider: submit for MD review
    await prisma.$transaction(async (tx) => {
      await tx.chart.update({
        where: { id: chartId },
        data: {
          status: "NeedsSignOff",
          providerSignedAt: signedAt,
          providerSignedById: user.id,
          recordHash,
          updatedAt: signedAt,
        },
      });

      if (chart.encounter) {
        await tx.encounter.update({
          where: { id: chart.encounter.id },
          data: { status: "PendingReview" },
        });
      }

      await tx.auditLog.create({
        data: {
          clinicId: user.clinicId,
          userId: user.id,
          action: "ChartProviderSign",
          entityType: "Chart",
          entityId: chartId,
          details: JSON.stringify({
            patientId: chart.patientId,
            encounterId: chart.encounter?.id,
            submittedForReview: true,
            recordHash,
          }),
        },
      });
    });
  } else {
    // Non-supervised provider: finalize directly
    await prisma.$transaction(async (tx) => {
      await tx.chart.update({
        where: { id: chartId },
        data: {
          status: "MDSigned",
          signedById: user.id,
          signedByName: user.name,
          signedAt,
          recordHash,
          updatedAt: signedAt,
        },
      });

      if (chart.encounter) {
        await tx.encounter.update({
          where: { id: chart.encounter.id },
          data: { status: "Finalized", finalizedAt: signedAt },
        });
      }

      await tx.auditLog.create({
        data: {
          clinicId: user.clinicId,
          userId: user.id,
          action: "ChartProviderSign",
          entityType: "Chart",
          entityId: chartId,
          details: JSON.stringify({
            patientId: chart.patientId,
            encounterId: chart.encounter?.id,
            finalizedDirectly: true,
            recordHash,
          }),
        },
      });
    });
  }

  revalidatePath(`/charts/${chartId}`);
  return { success: true };
}

/**
 * Test variant of updateTreatmentCard — bypasses session-based auth.
 */
export async function updateTreatmentCardWithUser(
  cardId: string,
  data: { narrativeText?: string; structuredData?: string },
  user: AuthenticatedUser
): Promise<ActionResult> {
  const { hasPermission, enforceTenantIsolation: enforce } = await import("@/lib/rbac");
  if (!hasPermission(user.role, "charts", "edit")) {
    return { success: false, error: `Permission denied: ${user.role} cannot edit charts` };
  }

  const card = await prisma.treatmentCard.findUnique({
    where: { id: cardId },
    include: {
      chart: {
        select: { id: true, clinicId: true, status: true, encounter: { select: { status: true } } },
      },
    },
  });

  if (!card) return { success: false, error: "Treatment card not found" };

  enforce(user, card.chart.clinicId);

  const isDraft = card.chart.encounter
    ? card.chart.encounter.status === "Draft"
    : card.chart.status === "Draft";
  if (!isDraft) {
    const isFinalized = card.chart.encounter
      ? card.chart.encounter.status === "Finalized"
      : card.chart.status === "MDSigned";
    return {
      success: false,
      error: isFinalized
        ? "Encounter finalized. Changes require addendum."
        : "Cannot edit treatment cards on a non-draft chart",
    };
  }

  if (data.structuredData !== undefined) {
    try { JSON.parse(data.structuredData); } catch {
      return { success: false, error: "Invalid JSON in structuredData" };
    }
  }

  const updateData: { narrativeText?: string; structuredData?: string } = {};
  if (data.narrativeText !== undefined) updateData.narrativeText = data.narrativeText;
  if (data.structuredData !== undefined) updateData.structuredData = data.structuredData;

  await prisma.treatmentCard.update({ where: { id: cardId }, data: updateData });
  return { success: true };
}

/**
 * MD Co-sign — transitions PendingReview/NeedsSignOff → Finalized/MDSigned
 * Only allowed for users with chart sign permission (MedicalDirector, Owner, Admin)
 */
export async function coSignChart(chartId: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("charts", "sign");
    return _coSign(chartId, user);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Test variant — bypasses session-based auth.
 */
export async function coSignChartWithUser(
  chartId: string,
  user: AuthenticatedUser
): Promise<ActionResult> {
  const { hasPermission } = await import("@/lib/rbac");
  if (!hasPermission(user.role, "charts", "sign")) {
    return { success: false, error: `Permission denied: ${user.role} cannot co-sign charts` };
  }
  return _coSign(chartId, user);
}

async function _coSign(
  chartId: string,
  user: AuthenticatedUser
): Promise<ActionResult> {
  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    include: {
      encounter: { select: { id: true, status: true } },
      treatmentCards: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!chart) {
    return { success: false, error: "Chart not found" };
  }

  enforceTenantIsolation(user, chart.clinicId);

  // Must be NeedsSignOff / PendingReview
  const isNeedsSignOff = chart.encounter
    ? chart.encounter.status === "PendingReview"
    : chart.status === "NeedsSignOff";
  if (!isNeedsSignOff) {
    return { success: false, error: "Only charts pending review can be co-signed" };
  }

  // Provider must have already signed
  if (!chart.providerSignedAt) {
    return { success: false, error: "Chart has not been provider-signed yet" };
  }

  const signedAt = new Date();
  const recordHash = generateRecordHash({ ...chart, treatmentCards: chart.treatmentCards });

  await prisma.$transaction(async (tx) => {
    await tx.chart.update({
      where: { id: chartId },
      data: {
        status: "MDSigned",
        signedById: user.id,
        signedByName: user.name,
        signedAt,
        recordHash,
        updatedAt: signedAt,
      },
    });

    if (chart.encounter) {
      await tx.encounter.update({
        where: { id: chart.encounter.id },
        data: { status: "Finalized", finalizedAt: signedAt },
      });
    }

    await tx.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "MDCoSign",
        entityType: "Chart",
        entityId: chartId,
        details: JSON.stringify({
          patientId: chart.patientId,
          encounterId: chart.encounter?.id,
          providerSignedById: chart.providerSignedById,
          recordHash,
        }),
      },
    });
  });

  revalidatePath(`/charts/${chartId}`);
  return { success: true };
}

/**
 * Get the most recent previous treatment for a patient (excluding the current chart).
 * Used to display context in the chart editor.
 */
export interface PreviousTreatmentSummary {
  chartId: string;
  date: Date;
  cards: Array<{
    title: string;
    templateType: string;
    details: string;
  }>;
}

export async function getPreviousTreatment(
  patientId: string,
  currentChartId: string,
  clinicId: string
): Promise<PreviousTreatmentSummary | null> {
  const chart = await prisma.chart.findFirst({
    where: {
      patientId,
      clinicId,
      id: { not: currentChartId },
      deletedAt: null,
      OR: [
        { status: "MDSigned" },
        { encounter: { status: "Finalized" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      treatmentCards: {
        orderBy: { sortOrder: "asc" },
        select: {
          title: true,
          templateType: true,
          structuredData: true,
        },
      },
    },
  });

  if (!chart) return null;

  return {
    chartId: chart.id,
    date: chart.updatedAt,
    cards: chart.treatmentCards.map((card) => ({
      title: card.title,
      templateType: card.templateType,
      details: summarizeStructuredData(card.templateType, card.structuredData),
    })),
  };
}

function summarizeStructuredData(templateType: string, structuredData: string): string {
  try {
    const data = JSON.parse(structuredData);
    switch (templateType) {
      case "Injectable": {
        const parts: string[] = [];
        if (data.product) parts.push(data.product);
        if (data.areas && data.totalUnits) parts.push(`${data.areas} ${data.totalUnits}u`);
        else if (data.areas) parts.push(data.areas);
        return parts.join(" — ") || "No details";
      }
      case "Laser": {
        const parts: string[] = [];
        if (data.device) parts.push(data.device);
        if (data.areas) parts.push(data.areas);
        return parts.join(" — ") || "No details";
      }
      case "Esthetics": {
        const parts: string[] = [];
        if (data.treatmentType) parts.push(data.treatmentType);
        if (data.areas) parts.push(data.areas);
        return parts.join(" — ") || "No details";
      }
      default:
        return "No details";
    }
  } catch {
    return "No details";
  }
}
