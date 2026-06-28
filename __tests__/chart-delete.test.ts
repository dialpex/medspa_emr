import { describe, it, expect } from "vitest";
import { type Role } from "@prisma/client";
import { hasPermission } from "@/lib/rbac-core";

/**
 * Inline test version of deleteChart logic (no Next.js deps).
 * Mirrors the permission and status checks in lib/actions/charts.ts.
 */
function testDeleteChart(
  chart: { status: string; createdById: string | null; clinicId: string },
  user: { id: string; role: Role; clinicId: string }
): { success: boolean; error?: string } {
  // Tenant isolation
  if (chart.clinicId !== user.clinicId) {
    return { success: false, error: "Chart not found" };
  }

  // Permission: charts.delete (Owner/Admin) OR creator
  const canDeleteAny = hasPermission(user.role, "charts", "delete");
  if (!canDeleteAny && chart.createdById !== user.id) {
    return { success: false, error: "You do not have permission to delete this chart" };
  }

  // Only drafts
  if (chart.status !== "Draft") {
    return { success: false, error: "Only draft charts can be deleted" };
  }

  return { success: true };
}

const CLINIC_ID = "clinic-1";

const ownerUser = { id: "user-owner", role: "Owner" as Role, clinicId: CLINIC_ID };
const adminUser = { id: "user-admin", role: "Admin" as Role, clinicId: CLINIC_ID };
const providerUser = { id: "user-provider", role: "Provider" as Role, clinicId: CLINIC_ID };
const otherProvider = { id: "user-other", role: "Provider" as Role, clinicId: CLINIC_ID };
const frontDeskUser = { id: "user-fd", role: "FrontDesk" as Role, clinicId: CLINIC_ID };
const readOnlyUser = { id: "user-ro", role: "ReadOnly" as Role, clinicId: CLINIC_ID };
const otherClinicUser = { id: "user-x", role: "Owner" as Role, clinicId: "clinic-other" };

const draftChart = { status: "Draft", createdById: providerUser.id, clinicId: CLINIC_ID };
const needsSignOffChart = { status: "NeedsSignOff", createdById: providerUser.id, clinicId: CLINIC_ID };
const signedChart = { status: "MDSigned", createdById: providerUser.id, clinicId: CLINIC_ID };

describe("deleteChart", () => {
  describe("Owner/Admin can delete any draft", () => {
    it("Owner can delete a draft chart", () => {
      expect(testDeleteChart(draftChart, ownerUser)).toEqual({ success: true });
    });

    it("Admin can delete a draft chart", () => {
      expect(testDeleteChart(draftChart, adminUser)).toEqual({ success: true });
    });
  });

  describe("Creator can delete own drafts", () => {
    it("Provider can delete their own draft", () => {
      expect(testDeleteChart(draftChart, providerUser)).toEqual({ success: true });
    });

    it("Another provider cannot delete someone else's draft", () => {
      const result = testDeleteChart(draftChart, otherProvider);
      expect(result.success).toBe(false);
      expect(result.error).toContain("permission");
    });
  });

  describe("Non-draft charts cannot be deleted", () => {
    it("Owner cannot delete NeedsSignOff chart", () => {
      const result = testDeleteChart(needsSignOffChart, ownerUser);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Only draft");
    });

    it("Owner cannot delete signed chart", () => {
      const result = testDeleteChart(signedChart, ownerUser);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Only draft");
    });

    it("Creator cannot delete their own signed chart", () => {
      const result = testDeleteChart(signedChart, providerUser);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Only draft");
    });
  });

  describe("Roles without delete permission cannot delete others' drafts", () => {
    it("FrontDesk cannot delete a draft", () => {
      const result = testDeleteChart(draftChart, frontDeskUser);
      expect(result.success).toBe(false);
      expect(result.error).toContain("permission");
    });

    it("ReadOnly cannot delete a draft", () => {
      const result = testDeleteChart(draftChart, readOnlyUser);
      expect(result.success).toBe(false);
      expect(result.error).toContain("permission");
    });
  });

  describe("Tenant isolation", () => {
    it("User from another clinic cannot delete chart", () => {
      const result = testDeleteChart(draftChart, otherClinicUser);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });
});
