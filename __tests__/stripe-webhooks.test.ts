import { describe, it, expect } from "vitest";

describe("stripe-webhooks logic", () => {
  describe("idempotency", () => {
    it("second call with same event ID should be no-op", () => {
      const processedEvents = new Set<string>();
      function shouldProcess(eventId: string): boolean {
        if (processedEvents.has(eventId)) return false;
        processedEvents.add(eventId);
        return true;
      }

      expect(shouldProcess("evt_123")).toBe(true);
      expect(shouldProcess("evt_123")).toBe(false);
      expect(shouldProcess("evt_456")).toBe(true);
    });
  });

  describe("updateInvoicePaymentStatus", () => {
    type PaymentRecord = { amount: number; stripeStatus: string | null };

    function computeStatus(
      payments: PaymentRecord[],
      invoiceTotal: number,
      currentStatus: string
    ): string {
      const netPaid = payments
        .filter((p) => !p.stripeStatus || p.stripeStatus === "succeeded")
        .reduce((s, p) => s + p.amount, 0);

      if (netPaid >= invoiceTotal) return "Paid";
      if (netPaid > 0) return "PartiallyPaid";
      if (netPaid <= 0 && currentStatus === "Paid") return "Refunded";
      return currentStatus;
    }

    it("marks Paid when net equals total", () => {
      const payments = [{ amount: 100, stripeStatus: "succeeded" }];
      expect(computeStatus(payments, 100, "Sent")).toBe("Paid");
    });

    it("marks Paid when net exceeds total", () => {
      const payments = [{ amount: 150, stripeStatus: "succeeded" }];
      expect(computeStatus(payments, 100, "Sent")).toBe("Paid");
    });

    it("marks PartiallyPaid for partial payment", () => {
      const payments = [{ amount: 50, stripeStatus: "succeeded" }];
      expect(computeStatus(payments, 100, "Sent")).toBe("PartiallyPaid");
    });

    it("marks Refunded when net is zero and was Paid", () => {
      const payments = [
        { amount: 100, stripeStatus: "succeeded" },
        { amount: -100, stripeStatus: "succeeded" },
      ];
      expect(computeStatus(payments, 100, "Paid")).toBe("Refunded");
    });

    it("excludes failed payments from total", () => {
      const payments = [
        { amount: 100, stripeStatus: "failed" },
        { amount: 50, stripeStatus: "succeeded" },
      ];
      expect(computeStatus(payments, 100, "Sent")).toBe("PartiallyPaid");
    });

    it("includes non-stripe payments (null status)", () => {
      const payments = [{ amount: 100, stripeStatus: null }];
      expect(computeStatus(payments, 100, "Sent")).toBe("Paid");
    });

    it("does not change status when net is zero and was not Paid", () => {
      const payments: PaymentRecord[] = [];
      expect(computeStatus(payments, 100, "Sent")).toBe("Sent");
    });
  });

  describe("deposit payments with null invoiceId", () => {
    it("should not crash when invoiceId is null", () => {
      const payment = {
        id: "pay_1",
        invoiceId: null as string | null,
        clinicId: "clinic_1",
        paymentType: "deposit",
      };

      // Simulates the guard in webhook handler
      function handlePaymentSucceeded(p: typeof payment) {
        if (p.invoiceId) {
          // would call updateInvoicePaymentStatus
          return "updated_invoice";
        }
        return "skipped_invoice_update";
      }

      expect(handlePaymentSucceeded(payment)).toBe("skipped_invoice_update");
    });

    it("should update invoice when invoiceId exists", () => {
      const payment = {
        id: "pay_1",
        invoiceId: "inv_1",
        clinicId: "clinic_1",
        paymentType: "payment",
      };

      function handlePaymentSucceeded(p: typeof payment) {
        if (p.invoiceId) {
          return "updated_invoice";
        }
        return "skipped_invoice_update";
      }

      expect(handlePaymentSucceeded(payment)).toBe("updated_invoice");
    });
  });
});
