import { z } from "zod";

export const paymentIntentSchema = z.object({
  invoiceId: z.string().min(1, "invoiceId is required"),
  amount: z.number().positive("Amount must be positive").optional(),
});

export const chargeSavedSchema = z.object({
  invoiceId: z.string().min(1, "invoiceId is required"),
  paymentMethodId: z.string().min(1, "paymentMethodId is required"),
  amount: z.number().positive("Amount must be positive").optional(),
});

export const refundSchema = z.object({
  paymentId: z.string().min(1, "paymentId is required"),
  amount: z.number().positive("Amount must be positive").optional(),
});

export const depositSchema = z.object({
  appointmentId: z.string().min(1, "appointmentId is required"),
  amount: z.number().positive("Amount must be positive").optional(),
});
