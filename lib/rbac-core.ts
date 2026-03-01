import type { Role } from "@prisma/client";

// Permission definitions by role
export const ROLE_PERMISSIONS = {
  Owner: {
    patients: { view: true, create: true, edit: true, delete: true },
    charts: { view: true, create: true, edit: true, delete: true, sign: true },
    photos: { view: true, create: true, edit: true, delete: true },
    consents: { view: true, create: true, edit: true, delete: true },
    appointments: { view: true, create: true, edit: true, delete: true },
    invoices: { view: true, create: true, edit: true, delete: true },
    users: { view: true, create: true, edit: true, delete: true },
    reports: { view: true },
    messaging: { view: true, create: true, edit: false, delete: false },
    ai: { view: true, create: true },
    migration: { view: true, create: true, edit: true, delete: true },
  },
  Admin: {
    patients: { view: true, create: true, edit: true, delete: true },
    charts: { view: true, create: true, edit: true, delete: true, sign: true },
    photos: { view: true, create: true, edit: true, delete: true },
    consents: { view: true, create: true, edit: true, delete: true },
    appointments: { view: true, create: true, edit: true, delete: true },
    invoices: { view: true, create: true, edit: true, delete: true },
    users: { view: true, create: true, edit: true, delete: true },
    reports: { view: true },
    messaging: { view: true, create: true, edit: false, delete: false },
    ai: { view: true, create: true },
    migration: { view: false, create: false, edit: false, delete: false },
  },
  Provider: {
    patients: { view: true, create: true, edit: true, delete: false },
    charts: { view: true, create: true, edit: true, delete: false, sign: false },
    photos: { view: true, create: true, edit: true, delete: false },
    consents: { view: true, create: true, edit: false, delete: false },
    appointments: { view: true, create: true, edit: true, delete: false },
    invoices: { view: true, create: true, edit: true, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    reports: { view: true },
    messaging: { view: true, create: true, edit: false, delete: false },
    ai: { view: true, create: true },
    migration: { view: false, create: false, edit: false, delete: false },
  },
  FrontDesk: {
    patients: { view: true, create: true, edit: true, delete: false },
    charts: { view: false, create: false, edit: false, delete: false, sign: false },
    photos: { view: false, create: false, edit: false, delete: false },
    consents: { view: true, create: true, edit: false, delete: false },
    appointments: { view: true, create: true, edit: true, delete: true },
    invoices: { view: true, create: true, edit: true, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    reports: { view: false },
    messaging: { view: true, create: true, edit: false, delete: false },
    ai: { view: true, create: true },
    migration: { view: false, create: false, edit: false, delete: false },
  },
  Billing: {
    patients: { view: true, create: false, edit: false, delete: false },
    charts: { view: false, create: false, edit: false, delete: false, sign: false },
    photos: { view: false, create: false, edit: false, delete: false },
    consents: { view: false, create: false, edit: false, delete: false },
    appointments: { view: true, create: false, edit: false, delete: false },
    invoices: { view: true, create: true, edit: true, delete: true },
    users: { view: false, create: false, edit: false, delete: false },
    reports: { view: true },
    messaging: { view: false, create: false, edit: false, delete: false },
    ai: { view: true, create: true },
    migration: { view: false, create: false, edit: false, delete: false },
  },
  MedicalDirector: {
    patients: { view: true, create: false, edit: false, delete: false },
    charts: { view: true, create: false, edit: false, delete: false, sign: true },
    photos: { view: true, create: false, edit: false, delete: false },
    consents: { view: true, create: false, edit: false, delete: false },
    appointments: { view: true, create: false, edit: false, delete: false },
    invoices: { view: false, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    reports: { view: true },
    messaging: { view: false, create: false, edit: false, delete: false },
    ai: { view: true, create: true },
    migration: { view: false, create: false, edit: false, delete: false },
  },
  ReadOnly: {
    patients: { view: true, create: false, edit: false, delete: false },
    charts: { view: true, create: false, edit: false, delete: false, sign: false },
    photos: { view: true, create: false, edit: false, delete: false },
    consents: { view: true, create: false, edit: false, delete: false },
    appointments: { view: true, create: false, edit: false, delete: false },
    invoices: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    reports: { view: true },
    messaging: { view: false, create: false, edit: false, delete: false },
    ai: { view: false, create: false },
    migration: { view: false, create: false, edit: false, delete: false },
  },
} as const;

export type Resource = keyof (typeof ROLE_PERMISSIONS)["Owner"];
export type Action = "view" | "create" | "edit" | "delete" | "sign";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  clinicId: string;
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class TenantIsolationError extends Error {
  constructor(message: string = "Access denied: resource belongs to different clinic") {
    super(message);
    this.name = "TenantIsolationError";
  }
}

/**
 * Check if a role has permission for a specific action on a resource
 */
export function hasPermission(role: Role, resource: Resource, action: Action): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;

  const resourcePerms = permissions[resource];
  if (!resourcePerms) return false;

  return (resourcePerms as Record<string, boolean>)[action] ?? false;
}

/**
 * Enforce tenant isolation - verify resource belongs to user's clinic
 */
export function enforceTenantIsolation(
  user: AuthenticatedUser,
  resourceClinicId: string
): void {
  if (user.clinicId !== resourceClinicId) {
    throw new TenantIsolationError();
  }
}

/**
 * Check if user is a Medical Director
 */
export function isMedicalDirector(role: Role): boolean {
  return role === "MedicalDirector";
}

/**
 * Check if user can sign charts (only MedicalDirector, Owner, Admin)
 */
export function canSignCharts(role: Role): boolean {
  return hasPermission(role, "charts", "sign");
}
