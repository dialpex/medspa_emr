// Re-export all pure functions from rbac-core
export {
  ROLE_PERMISSIONS,
  hasPermission,
  enforceTenantIsolation,
  isMedicalDirector,
  canSignCharts,
  AuthorizationError,
  TenantIsolationError,
  type Resource,
  type Action,
  type AuthenticatedUser,
} from "./rbac-core";

import { auth } from "./auth";
import {
  hasPermission,
  AuthorizationError,
  enforceTenantIsolation,
  type Resource,
  type Action,
  type AuthenticatedUser,
} from "./rbac-core";

/**
 * Get the current authenticated session
 * Throws if not authenticated
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await auth();

  if (!session?.user) {
    throw new AuthorizationError("Authentication required");
  }

  return session.user as AuthenticatedUser;
}

/**
 * Require specific permission for a resource action
 * Throws if not authorized
 */
export async function requirePermission(
  resource: Resource,
  action: Action
): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  if (!hasPermission(user.role, resource, action)) {
    throw new AuthorizationError(
      `Permission denied: ${user.role} cannot ${action} ${resource}`
    );
  }

  return user;
}

/**
 * Combined guard: require permission and enforce tenant isolation
 */
export async function requirePermissionForClinic(
  resource: Resource,
  action: Action,
  resourceClinicId: string
): Promise<AuthenticatedUser> {
  const user = await requirePermission(resource, action);
  enforceTenantIsolation(user, resourceClinicId);
  return user;
}
