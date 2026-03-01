"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export type LocationData = {
  name: string;
  locationName: string;
  externalId: string;
  address: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  timezone: string;
  email: string;
  phone: string;
  website: string;
  logoUrl: string;
  defaultTaxRate: number;
  locationHours: Record<string, { enabled: boolean; start: string; end: string }>;
  socialAccounts: Record<string, string>;
  calendarSettings: {
    timeInterval: string;
    startTime: string;
    endTime: string;
    colorUsage: string;
    firstDayOfWeek: string;
  };
};

export async function getLocationData(): Promise<LocationData> {
  const user = await requirePermission("patients", "view");
  const clinic = await prisma.clinic.findUnique({
    where: { id: user.clinicId },
  });
  if (!clinic) throw new Error("Clinic not found — please sign out and back in");

  const defaultHours: Record<string, { enabled: boolean; start: string; end: string }> = {};
  for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) {
    defaultHours[day] = { enabled: ["mon", "tue", "wed", "thu", "fri"].includes(day), start: "09:00", end: "17:00" };
  }

  return {
    name: clinic.name,
    locationName: clinic.locationName ?? "",
    externalId: clinic.externalId ?? "",
    address: clinic.address ?? "",
    addressLine2: clinic.addressLine2 ?? "",
    city: clinic.city ?? "",
    state: clinic.state ?? "",
    zipCode: clinic.zipCode ?? "",
    country: clinic.country,
    timezone: clinic.timezone,
    email: clinic.email ?? "",
    phone: clinic.phone ?? "",
    website: clinic.website ?? "",
    logoUrl: clinic.logoUrl ?? "",
    defaultTaxRate: clinic.defaultTaxRate ?? 0,
    locationHours: clinic.locationHours ? JSON.parse(clinic.locationHours) : defaultHours,
    socialAccounts: clinic.socialAccounts ? JSON.parse(clinic.socialAccounts) : {},
    calendarSettings: clinic.calendarSettings
      ? JSON.parse(clinic.calendarSettings)
      : { timeInterval: "15", startTime: "08:00", endTime: "18:00", colorUsage: "service", firstDayOfWeek: "monday" },
  };
}

export async function updateLocationData(data: LocationData) {
  const user = await requirePermission("patients", "create");
  await prisma.clinic.update({
    where: { id: user.clinicId },
    data: {
      name: data.name,
      locationName: data.locationName || null,
      externalId: data.externalId || null,
      address: data.address || null,
      addressLine2: data.addressLine2 || null,
      city: data.city || null,
      state: data.state || null,
      zipCode: data.zipCode || null,
      country: data.country,
      timezone: data.timezone,
      email: data.email || null,
      phone: data.phone || null,
      website: data.website || null,
      logoUrl: data.logoUrl || null,
      defaultTaxRate: data.defaultTaxRate || null,
      locationHours: JSON.stringify(data.locationHours),
      socialAccounts: JSON.stringify(data.socialAccounts),
      calendarSettings: JSON.stringify(data.calendarSettings),
    },
  });
  revalidatePath("/settings/location");
  return { success: true };
}
