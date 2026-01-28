"use server";

import { prisma } from "@/lib/prisma";
import {
  requirePermission,
  enforceTenantIsolation,
  AuthorizationError,
  type AuthenticatedUser,
} from "@/lib/rbac";
import { createHash } from "crypto";

export interface ChartUpdateInput {
  chiefComplaint?: string;
  areasTreated?: string;
  productsUsed?: string;
  dosageUnits?: string;
  technique?: string;
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
  technique: string | null;
  aftercareNotes: string | null;
  additionalNotes: string | null;
}): string {
  const content = JSON.stringify({
    id: chart.id,
    chiefComplaint: chart.chiefComplaint,
    areasTreated: chart.areasTreated,
    productsUsed: chart.productsUsed,
    dosageUnits: chart.dosageUnits,
    technique: chart.technique,
    aftercareNotes: chart.aftercareNotes,
    additionalNotes: chart.additionalNotes,
  });
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
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
  technique: string | null;
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
    });

    if (!chart) {
      return { success: false, error: "Chart not found" };
    }

    enforceTenantIsolation(user, chart.clinicId);

    // Cannot edit signed charts
    if (chart.status === "MDSigned") {
      return { success: false, error: "Cannot edit a signed chart" };
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
 * Submit chart for Medical Director review
 */
export async function submitChartForReview(chartId: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("charts", "edit");

    const chart = await prisma.chart.findUnique({
      where: { id: chartId },
    });

    if (!chart) {
      return { success: false, error: "Chart not found" };
    }

    enforceTenantIsolation(user, chart.clinicId);

    if (chart.status !== "Draft") {
      return { success: false, error: "Only draft charts can be submitted for review" };
    }

    await prisma.chart.update({
      where: { id: chartId },
      data: {
        status: "NeedsSignOff",
        updatedAt: new Date(),
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
 * Sign a chart - transitions NeedsSignOff -> MDSigned
 * Only allowed for users with chart sign permission (MedicalDirector, Owner, Admin)
 */
export async function signChart(chartId: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("charts", "sign");

    const chart = await prisma.chart.findUnique({
      where: { id: chartId },
    });

    if (!chart) {
      return { success: false, error: "Chart not found" };
    }

    enforceTenantIsolation(user, chart.clinicId);

    if (chart.status !== "NeedsSignOff") {
      return {
        success: false,
        error: "Only charts with NeedsSignOff status can be signed",
      };
    }

    // Generate record hash for integrity
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
    });

    if (!chart) {
      return { success: false, error: "Chart not found" };
    }

    enforce(user, chart.clinicId);

    if (chart.status !== "NeedsSignOff") {
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

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "ChartSign",
        entityType: "Chart",
        entityId: chartId,
        details: JSON.stringify({
          patientId: chart.patientId,
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
    });

    if (!chart) {
      return { success: false, error: "Chart not found" };
    }

    enforce(user, chart.clinicId);

    if (chart.status === "MDSigned") {
      return { success: false, error: "Cannot edit a signed chart" };
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
