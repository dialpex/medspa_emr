import { prisma } from "@/lib/prisma";

// ── Types ──────────────────────────────────────────────────

export type PackageWithItems = {
  id: string;
  name: string;
  description: string | null;
  packagePrice: number;
  validityDays: number | null;
  isActive: boolean;
  createdAt: Date;
  items: {
    id: string;
    serviceId: string;
    serviceName: string;
    servicePrice: number;
    quantity: number;
  }[];
  retailValue: number;
};

export type PackageItemProgress = {
  serviceId: string;
  serviceName: string;
  totalQuantity: number;
  redeemedQuantity: number;
  remainingQuantity: number;
};

export type PatientPackageWithProgress = {
  id: string;
  packageId: string;
  packageName: string;
  status: string;
  purchasePrice: number;
  purchasedAt: Date;
  expiresAt: Date | null;
  notes: string | null;
  items: PackageItemProgress[];
  overallProgress: number;
  redemptions: {
    id: string;
    serviceId: string;
    serviceName: string;
    quantity: number;
    redeemedAt: Date;
    redeemedByName: string;
    appointmentId: string | null;
    notes: string | null;
  }[];
};

export type PackageMatch = {
  patientPackageId: string;
  packageName: string;
  serviceId: string;
  serviceName: string;
  totalQuantity: number;
  redeemedQuantity: number;
  remainingQuantity: number;
};

type CreatePackageInput = {
  name: string;
  description?: string;
  packagePrice: number;
  validityDays?: number | null;
  items: { serviceId: string; quantity: number }[];
};

type UpdatePackageInput = CreatePackageInput;

type SellPackageInput = {
  patientId: string;
  packageId: string;
  purchasePrice?: number;
  notes?: string;
};

type RedeemInput = {
  patientPackageId: string;
  serviceId: string;
  appointmentId?: string;
  quantity?: number;
  notes?: string;
  redeemedById: string;
};

// ── Lazy expiration helper ─────────────────────────────────

async function expireIfNeeded(pp: { id: string; status: string; expiresAt: Date | null }) {
  if (pp.status === "Active" && pp.expiresAt && pp.expiresAt < new Date()) {
    await prisma.patientPackage.update({
      where: { id: pp.id },
      data: { status: "Expired" },
    });
    return "Expired";
  }
  return pp.status;
}

// ── Catalog ────────────────────────────────────────────────

export async function getPackages(clinicId: string): Promise<PackageWithItems[]> {
  const packages = await prisma.servicePackage.findMany({
    where: { clinicId },
    orderBy: { name: "asc" },
    include: {
      items: {
        include: { service: { select: { id: true, name: true, price: true } } },
      },
    },
  });

  return packages.map((p) => {
    const items = p.items.map((i) => ({
      id: i.id,
      serviceId: i.serviceId,
      serviceName: i.service.name,
      servicePrice: i.service.price,
      quantity: i.quantity,
    }));
    const retailValue = items.reduce((sum, i) => sum + i.servicePrice * i.quantity, 0);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      packagePrice: p.packagePrice,
      validityDays: p.validityDays,
      isActive: p.isActive,
      createdAt: p.createdAt,
      items,
      retailValue,
    };
  });
}

export async function getPackage(clinicId: string, packageId: string): Promise<PackageWithItems | null> {
  const p = await prisma.servicePackage.findFirst({
    where: { id: packageId, clinicId },
    include: {
      items: {
        include: { service: { select: { id: true, name: true, price: true } } },
      },
    },
  });
  if (!p) return null;

  const items = p.items.map((i) => ({
    id: i.id,
    serviceId: i.serviceId,
    serviceName: i.service.name,
    servicePrice: i.service.price,
    quantity: i.quantity,
  }));
  const retailValue = items.reduce((sum, i) => sum + i.servicePrice * i.quantity, 0);
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    packagePrice: p.packagePrice,
    validityDays: p.validityDays,
    isActive: p.isActive,
    createdAt: p.createdAt,
    items,
    retailValue,
  };
}

export async function createPackage(clinicId: string, input: CreatePackageInput) {
  return prisma.servicePackage.create({
    data: {
      clinicId,
      name: input.name,
      description: input.description || null,
      packagePrice: input.packagePrice,
      validityDays: input.validityDays ?? null,
      items: {
        create: input.items.map((i) => ({
          serviceId: i.serviceId,
          quantity: i.quantity,
        })),
      },
    },
  });
}

export async function updatePackage(clinicId: string, packageId: string, input: UpdatePackageInput) {
  const existing = await prisma.servicePackage.findFirst({ where: { id: packageId, clinicId } });
  if (!existing) throw new Error("Package not found");

  await prisma.$transaction([
    prisma.servicePackage.update({
      where: { id: packageId },
      data: {
        name: input.name,
        description: input.description || null,
        packagePrice: input.packagePrice,
        validityDays: input.validityDays ?? null,
      },
    }),
    prisma.packageItem.deleteMany({ where: { packageId } }),
    prisma.packageItem.createMany({
      data: input.items.map((i) => ({
        packageId,
        serviceId: i.serviceId,
        quantity: i.quantity,
      })),
    }),
  ]);
}

export async function togglePackageActive(clinicId: string, packageId: string) {
  const existing = await prisma.servicePackage.findFirst({ where: { id: packageId, clinicId } });
  if (!existing) throw new Error("Package not found");
  await prisma.servicePackage.update({
    where: { id: packageId },
    data: { isActive: !existing.isActive },
  });
}

// ── Patient packages ───────────────────────────────────────

export async function getPatientPackages(
  clinicId: string,
  patientId: string
): Promise<PatientPackageWithProgress[]> {
  const patientPackages = await prisma.patientPackage.findMany({
    where: { clinicId, patientId },
    orderBy: { purchasedAt: "desc" },
    include: {
      package: {
        include: {
          items: {
            include: { service: { select: { id: true, name: true } } },
          },
        },
      },
      redemptions: {
        include: {
          service: { select: { name: true } },
          redeemedBy: { select: { name: true } },
        },
        orderBy: { redeemedAt: "desc" },
      },
    },
  });

  const results: PatientPackageWithProgress[] = [];

  for (const pp of patientPackages) {
    const status = await expireIfNeeded(pp);

    const items: PackageItemProgress[] = pp.package.items.map((item) => {
      const redeemedQty = pp.redemptions
        .filter((r) => r.serviceId === item.serviceId)
        .reduce((sum, r) => sum + r.quantity, 0);
      return {
        serviceId: item.serviceId,
        serviceName: item.service.name,
        totalQuantity: item.quantity,
        redeemedQuantity: redeemedQty,
        remainingQuantity: Math.max(0, item.quantity - redeemedQty),
      };
    });

    const totalSessions = items.reduce((s, i) => s + i.totalQuantity, 0);
    const redeemedSessions = items.reduce((s, i) => s + i.redeemedQuantity, 0);
    const overallProgress = totalSessions > 0 ? Math.round((redeemedSessions / totalSessions) * 100) : 0;

    results.push({
      id: pp.id,
      packageId: pp.packageId,
      packageName: pp.package.name,
      status,
      purchasePrice: pp.purchasePrice,
      purchasedAt: pp.purchasedAt,
      expiresAt: pp.expiresAt,
      notes: pp.notes,
      items,
      overallProgress,
      redemptions: pp.redemptions.map((r) => ({
        id: r.id,
        serviceId: r.serviceId,
        serviceName: r.service.name,
        quantity: r.quantity,
        redeemedAt: r.redeemedAt,
        redeemedByName: r.redeemedBy.name,
        appointmentId: r.appointmentId,
        notes: r.notes,
      })),
    });
  }

  return results;
}

export async function sellPackageToPatient(clinicId: string, input: SellPackageInput) {
  const pkg = await prisma.servicePackage.findFirst({
    where: { id: input.packageId, clinicId, isActive: true },
  });
  if (!pkg) throw new Error("Package not found or inactive");

  const expiresAt = pkg.validityDays
    ? new Date(Date.now() + pkg.validityDays * 24 * 60 * 60 * 1000)
    : null;

  return prisma.patientPackage.create({
    data: {
      clinicId,
      patientId: input.patientId,
      packageId: input.packageId,
      purchasePrice: input.purchasePrice ?? pkg.packagePrice,
      expiresAt,
      notes: input.notes || null,
    },
  });
}

export async function cancelPatientPackage(clinicId: string, patientPackageId: string) {
  const pp = await prisma.patientPackage.findFirst({
    where: { id: patientPackageId, clinicId, status: "Active" },
  });
  if (!pp) throw new Error("Active package not found");

  await prisma.patientPackage.update({
    where: { id: patientPackageId },
    data: { status: "Cancelled", cancelledAt: new Date() },
  });
}

// ── Redemption ─────────────────────────────────────────────

export async function redeemSession(clinicId: string, input: RedeemInput) {
  const pp = await prisma.patientPackage.findFirst({
    where: { id: input.patientPackageId, clinicId },
    include: {
      package: {
        include: { items: true },
      },
      redemptions: true,
    },
  });

  if (!pp) throw new Error("Patient package not found");

  // Lazy expiration check
  if (pp.expiresAt && pp.expiresAt < new Date()) {
    await prisma.patientPackage.update({
      where: { id: pp.id },
      data: { status: "Expired" },
    });
    throw new Error("Package has expired");
  }

  if (pp.status !== "Active") {
    throw new Error(`Cannot redeem from a ${pp.status} package`);
  }

  // Check remaining qty for this service
  const item = pp.package.items.find((i) => i.serviceId === input.serviceId);
  if (!item) throw new Error("Service not included in this package");

  const alreadyRedeemed = pp.redemptions
    .filter((r) => r.serviceId === input.serviceId)
    .reduce((sum, r) => sum + r.quantity, 0);

  const qty = input.quantity ?? 1;
  if (alreadyRedeemed + qty > item.quantity) {
    throw new Error(`Only ${item.quantity - alreadyRedeemed} session(s) remaining for this service`);
  }

  const redemption = await prisma.packageRedemption.create({
    data: {
      clinicId,
      patientPackageId: input.patientPackageId,
      serviceId: input.serviceId,
      appointmentId: input.appointmentId || null,
      quantity: qty,
      redeemedById: input.redeemedById,
      notes: input.notes || null,
    },
  });

  // Check if all items are fully redeemed → auto-complete
  const allRedemptions = await prisma.packageRedemption.findMany({
    where: { patientPackageId: pp.id },
  });
  const allComplete = pp.package.items.every((item) => {
    const redeemed = allRedemptions
      .filter((r) => r.serviceId === item.serviceId)
      .reduce((sum, r) => sum + r.quantity, 0);
    return redeemed >= item.quantity;
  });

  if (allComplete) {
    await prisma.patientPackage.update({
      where: { id: pp.id },
      data: { status: "Completed" },
    });
  }

  return redemption;
}

export async function checkPackageAvailability(
  clinicId: string,
  patientId: string,
  serviceId: string
): Promise<PackageMatch[]> {
  const patientPackages = await prisma.patientPackage.findMany({
    where: { clinicId, patientId, status: "Active" },
    include: {
      package: {
        include: {
          items: {
            where: { serviceId },
            include: { service: { select: { name: true } } },
          },
        },
      },
      redemptions: { where: { serviceId } },
    },
  });

  const matches: PackageMatch[] = [];

  for (const pp of patientPackages) {
    // Lazy expiration
    if (pp.expiresAt && pp.expiresAt < new Date()) {
      await prisma.patientPackage.update({
        where: { id: pp.id },
        data: { status: "Expired" },
      });
      continue;
    }

    for (const item of pp.package.items) {
      const redeemed = pp.redemptions.reduce((sum, r) => sum + r.quantity, 0);
      const remaining = item.quantity - redeemed;
      if (remaining > 0) {
        matches.push({
          patientPackageId: pp.id,
          packageName: pp.package.name,
          serviceId: item.serviceId,
          serviceName: item.service.name,
          totalQuantity: item.quantity,
          redeemedQuantity: redeemed,
          remainingQuantity: remaining,
        });
      }
    }
  }

  return matches;
}
