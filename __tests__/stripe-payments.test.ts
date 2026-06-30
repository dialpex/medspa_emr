import { describe, it, expect } from "vitest";

describe("stripe-payments logic", () => {
  describe("amount capping", () => {
    function capAmount(requested: number | undefined, maxAmount: number): number {
      return requested ? Math.min(requested, maxAmount) : maxAmount;
    }

    it("caps at invoice balance when requested amount exceeds it", () => {
      expect(capAmount(200, 100)).toBe(100);
    });

    it("uses requested amount when it's less than balance", () => {
      expect(capAmount(50, 100)).toBe(50);
    });

    it("uses full balance when no amount specified", () => {
      expect(capAmount(undefined, 100)).toBe(100);
    });

    it("handles equal amounts", () => {
      expect(capAmount(100, 100)).toBe(100);
    });
  });

  describe("amount validation", () => {
    function validateAmount(amount: number): boolean {
      return amount > 0;
    }

    it("rejects negative amounts", () => {
      expect(validateAmount(-10)).toBe(false);
    });

    it("rejects zero amount", () => {
      expect(validateAmount(0)).toBe(false);
    });

    it("accepts positive amounts", () => {
      expect(validateAmount(50)).toBe(true);
    });
  });

  describe("tenant isolation", () => {
    function buildQuery(clinicId: string, paymentId: string) {
      return { id: paymentId, clinicId, deletedAt: null };
    }

    it("always includes clinicId in query", () => {
      const query = buildQuery("clinic-1", "payment-1");
      expect(query.clinicId).toBe("clinic-1");
    });

    it("different clinic produces different query", () => {
      const q1 = buildQuery("clinic-1", "payment-1");
      const q2 = buildQuery("clinic-2", "payment-1");
      expect(q1.clinicId).not.toBe(q2.clinicId);
    });
  });

  describe("payment method ownership", () => {
    function validateOwnership(
      method: { clinicId: string; patientId: string } | null,
      clinicId: string,
      patientId: string
    ): boolean {
      if (!method) return false;
      return method.clinicId === clinicId && method.patientId === patientId;
    }

    it("rejects null method", () => {
      expect(validateOwnership(null, "c1", "p1")).toBe(false);
    });

    it("rejects wrong clinic", () => {
      expect(validateOwnership({ clinicId: "c2", patientId: "p1" }, "c1", "p1")).toBe(false);
    });

    it("rejects wrong patient", () => {
      expect(validateOwnership({ clinicId: "c1", patientId: "p2" }, "c1", "p1")).toBe(false);
    });

    it("accepts matching ownership", () => {
      expect(validateOwnership({ clinicId: "c1", patientId: "p1" }, "c1", "p1")).toBe(true);
    });
  });

  describe("refund amount limit", () => {
    function canRefund(refundAmount: number | undefined, paymentAmount: number): boolean {
      if (refundAmount === undefined) return true; // full refund
      return refundAmount > 0 && refundAmount <= paymentAmount;
    }

    it("allows full refund (no amount specified)", () => {
      expect(canRefund(undefined, 100)).toBe(true);
    });

    it("allows partial refund within limit", () => {
      expect(canRefund(50, 100)).toBe(true);
    });

    it("allows refund equal to payment", () => {
      expect(canRefund(100, 100)).toBe(true);
    });

    it("rejects refund exceeding payment", () => {
      expect(canRefund(150, 100)).toBe(false);
    });

    it("rejects zero refund", () => {
      expect(canRefund(0, 100)).toBe(false);
    });

    it("rejects negative refund", () => {
      expect(canRefund(-10, 100)).toBe(false);
    });
  });
});
