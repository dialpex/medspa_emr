"use server";

import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import {
  getPackages,
  getPackage,
  createPackage,
  updatePackage,
  togglePackageActive,
  getPatientPackages,
  sellPackageToPatient,
  cancelPatientPackage,
  redeemSession,
  checkPackageAvailability,
  type PackageWithItems,
  type PatientPackageWithProgress,
  type PackageMatch,
} from "@/lib/services/packages";

export type PackageInput = {
  name: string;
  description?: string;
  packagePrice: number;
  validityDays?: number | null;
  items: { serviceId: string; quantity: number }[];
};

export type SellPackageInput = {
  patientId: string;
  packageId: string;
  purchasePrice?: number;
  notes?: string;
};

export type RedeemSessionInput = {
  patientPackageId: string;
  serviceId: string;
  appointmentId?: string;
  quantity?: number;
  notes?: string;
};

// ── Catalog (Settings) ─────────────────────────────────────

export async function getPackagesForClinic(): Promise<PackageWithItems[]> {
  const user = await requirePermission("packages", "view");
  return getPackages(user.clinicId);
}

export async function getPackageDetail(id: string): Promise<PackageWithItems | null> {
  const user = await requirePermission("packages", "view");
  return getPackage(user.clinicId, id);
}

export async function createPackageAction(input: PackageInput) {
  try {
    const user = await requirePermission("packages", "create");
    if (!input.name.trim()) return { success: false as const, error: "Name is required" };
    if (input.packagePrice < 0) return { success: false as const, error: "Price cannot be negative" };
    if (!input.items.length) return { success: false as const, error: "At least one service is required" };

    await createPackage(user.clinicId, input);
    revalidatePath("/settings/packages");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    throw error;
  }
}

export async function updatePackageAction(id: string, input: PackageInput) {
  try {
    const user = await requirePermission("packages", "edit");
    if (!input.name.trim()) return { success: false as const, error: "Name is required" };
    if (input.packagePrice < 0) return { success: false as const, error: "Price cannot be negative" };
    if (!input.items.length) return { success: false as const, error: "At least one service is required" };

    await updatePackage(user.clinicId, id, input);
    revalidatePath("/settings/packages");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    throw error;
  }
}

export async function togglePackageActiveAction(id: string) {
  try {
    const user = await requirePermission("packages", "edit");
    await togglePackageActive(user.clinicId, id);
    revalidatePath("/settings/packages");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    throw error;
  }
}

// ── Patient-level ──────────────────────────────────────────

export async function getPatientPackageData(patientId: string): Promise<{
  packages: PatientPackageWithProgress[];
  availablePackages: PackageWithItems[];
}> {
  const user = await requirePermission("packages", "view");
  const [packages, availablePackages] = await Promise.all([
    getPatientPackages(user.clinicId, patientId),
    getPackages(user.clinicId),
  ]);
  return {
    packages,
    availablePackages: availablePackages.filter((p) => p.isActive),
  };
}

export async function sellPackageAction(input: SellPackageInput) {
  try {
    const user = await requirePermission("packages", "create");
    await sellPackageToPatient(user.clinicId, input);
    revalidatePath(`/patients/${input.patientId}`);
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    if (error instanceof Error) return { success: false as const, error: error.message };
    throw error;
  }
}

export async function cancelPatientPackageAction(id: string, patientId: string) {
  try {
    const user = await requirePermission("packages", "edit");
    await cancelPatientPackage(user.clinicId, id);
    revalidatePath(`/patients/${patientId}`);
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    if (error instanceof Error) return { success: false as const, error: error.message };
    throw error;
  }
}

export async function redeemSessionAction(input: RedeemSessionInput, patientId: string) {
  try {
    const user = await requirePermission("packages", "edit");
    await redeemSession(user.clinicId, { ...input, redeemedById: user.id });
    revalidatePath(`/patients/${patientId}`);
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    if (error instanceof Error) return { success: false as const, error: error.message };
    throw error;
  }
}

export async function getPackageMatchesForService(
  patientId: string,
  serviceId: string
): Promise<PackageMatch[]> {
  const user = await requirePermission("packages", "view");
  return checkPackageAvailability(user.clinicId, patientId, serviceId);
}
