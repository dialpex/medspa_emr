import { z } from "zod";

// Common validators
const cuidString = z.string().min(1, "ID is required");
const optionalString = z.string().optional();
const optionalEmail = z.string().email("Invalid email").optional().or(z.literal(""));
const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Invalid date format").optional().or(z.literal(""));

export const createPatientSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: optionalEmail,
  phone: z.string().max(30).optional().or(z.literal("")),
  dateOfBirth: isoDateString,
  gender: z.string().max(50).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(100).optional().or(z.literal("")),
  zipCode: z.string().max(20).optional().or(z.literal("")),
  allergies: z.string().max(2000).optional().or(z.literal("")),
  medicalNotes: z.string().max(5000).optional().or(z.literal("")),
  tags: z.string().max(500).optional().or(z.literal("")),
  status: z.enum(["Active", "Fired"]).optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export const chartUpdateSchema = z.object({
  chiefComplaint: z.string().max(2000).optional(),
  areasTreated: z.string().max(5000).optional(),
  productsUsed: z.string().max(5000).optional(),
  dosageUnits: z.string().max(500).optional(),
  aftercareNotes: z.string().max(5000).optional(),
  additionalNotes: z.string().max(10000).optional(),
});

export const appointmentSchema = z.object({
  patientId: cuidString.optional(),
  providerId: cuidString,
  serviceId: cuidString.optional(),
  roomId: cuidString.optional(),
  resourceId: cuidString.optional(),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  notes: z.string().max(2000).optional().or(z.literal("")),
  isBlock: z.boolean().optional(),
  blockTitle: z.string().max(200).optional().or(z.literal("")),
  status: z.enum(["Scheduled", "Confirmed", "CheckedIn", "InProgress", "Completed", "NoShow", "Cancelled"]).optional(),
});

export const invoiceItemSchema = z.object({
  serviceId: cuidString.optional(),
  description: z.string().min(1, "Description is required").max(500),
  quantity: z.number().int().min(1).max(10000),
  unitPrice: z.number().min(0).max(1000000),
});

export const invoiceSchema = z.object({
  patientId: cuidString,
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  discountAmount: z.number().min(0).optional(),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
  taxRate: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().max(2000).optional(),
  dueDate: isoDateString,
  status: z.enum(["Draft", "Sent"]).optional(),
});

export const userCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email"),
  role: z.enum(["Owner", "Admin", "Provider", "FrontDesk", "Billing", "MedicalDirector", "ReadOnly"]),
  phone: z.string().max(30).optional().or(z.literal("")),
  alias: z.string().max(100).optional().or(z.literal("")),
  pronouns: z.string().max(50).optional().or(z.literal("")),
  password: z.string().min(1, "Password is required"),
});

export const userUpdateSchema = userCreateSchema.extend({
  password: z.string().optional().or(z.literal("")),
});

export const messageSchema = z.object({
  conversationId: cuidString.optional(),
  patientId: cuidString,
  body: z.string().min(1, "Message body is required").max(1600),
});

export const consentSchema = z.object({
  patientId: cuidString,
  templateId: cuidString,
  signatureData: z.string().min(1).optional(),
});

export const chatMessageSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(50000),
  })).min(1, "At least one message is required"),
});
