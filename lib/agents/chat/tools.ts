import { getServicesForClinic, getService, updateService } from "@/lib/actions/services";
import { searchPatients, getProviders, getRooms, getAppointments, createAppointment, updateAppointmentStatus } from "@/lib/actions/appointments";
import { getPatient, getPatientTimeline } from "@/lib/actions/patients";
import { getTodayAppointments } from "@/lib/actions/today";
import { getInvoices } from "@/lib/actions/invoices";
import { getPayments } from "@/lib/actions/payments";
import { getProductsForClinic, getProduct, updateProduct } from "@/lib/actions/products";
import { receiveStock, createProductFromInvoice } from "@/lib/actions/inventory";
import type { AppointmentStatus } from "@prisma/client";
import type { PlanStep } from "./types";

export interface ToolResult {
  step_id: string;
  tool_name: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

type ToolHandler = (args: Record<string, unknown>) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>;

/** Strip punctuation and collapse whitespace for fuzzy matching */
function normalizeSearch(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

/** Check if needle matches haystack — full-string first, then all-words fallback */
function fuzzyMatch(haystack: string, needle: string): boolean {
  const h = normalizeSearch(haystack);
  const n = normalizeSearch(needle);
  if (h.includes(n)) return true;
  const words = n.split(" ").filter(Boolean);
  return words.length > 1 && words.every((w) => h.includes(w));
}

function serializeDates(obj: unknown): unknown {
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeDates);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, serializeDates(v)])
    );
  }
  return obj;
}

const toolRegistry: Record<string, ToolHandler> = {
  lookup_service: async (args) => {
    const name = String(args.name ?? "");
    if (!name) {
      return { success: false, error: "name argument is required" };
    }
    const services = await getServicesForClinic();
    const matches = services.filter((s) => fuzzyMatch(s.name, name));
    if (matches.length === 0) {
      return { success: true, data: { matches: [], message: `No services found matching "${name}". Try a shorter or alternative keyword.` } };
    }
    return {
      success: true,
      data: {
        matches: matches.map((s) => ({
          id: s.id,
          name: s.name,
          price: s.price,
          duration: s.duration,
          category: s.category,
          isActive: s.isActive,
        })),
      },
    };
  },

  update_service: async (args) => {
    const serviceId = String(args.service_id ?? "");
    if (!serviceId) {
      return { success: false, error: "service_id argument is required" };
    }

    // Get existing service to merge partial update
    const existing = await getService(serviceId);
    if (!existing) {
      return { success: false, error: `Service not found: ${serviceId}` };
    }

    const mergedInput = {
      name: args.name != null ? String(args.name) : existing.name,
      description: args.description != null ? String(args.description) : existing.description ?? undefined,
      category: existing.category ?? undefined,
      duration: args.duration != null ? Number(args.duration) : existing.duration,
      price: args.price != null ? Number(args.price) : existing.price,
      templateIds: existing.templateIds,
    };

    await updateService(serviceId, mergedInput);

    return {
      success: true,
      data: {
        service_id: serviceId,
        updated_fields: Object.fromEntries(
          Object.entries({ name: args.name, price: args.price, duration: args.duration, description: args.description })
            .filter(([, v]) => v != null)
        ),
        previous: {
          name: existing.name,
          price: existing.price,
          duration: existing.duration,
        },
        current: {
          name: mergedInput.name,
          price: mergedInput.price,
          duration: mergedInput.duration,
        },
      },
    };
  },

  // --- Scheduling tools ---

  lookup_patient: async (args) => {
    const query = String(args.query ?? "");
    if (!query || query.length < 2) {
      return { success: false, error: "query argument is required (min 2 characters)" };
    }
    const matches = await searchPatients(query);
    return {
      success: true,
      data: {
        matches: matches.map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          phone: p.phone,
        })),
      },
    };
  },

  lookup_provider: async (args) => {
    const providers = await getProviders();
    const name = args.name ? String(args.name) : "";
    const filtered = name
      ? providers.filter((p) => fuzzyMatch(p.name, name))
      : providers;
    return {
      success: true,
      data: {
        providers: filtered.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
        })),
      },
    };
  },

  lookup_room: async () => {
    const rooms = await getRooms();
    return {
      success: true,
      data: {
        rooms: rooms.map((r) => ({ id: r.id, name: r.name })),
      },
    };
  },

  get_appointments: async (args) => {
    const startDate = String(args.start_date ?? "");
    const endDate = String(args.end_date ?? "");
    if (!startDate || !endDate) {
      return { success: false, error: "start_date and end_date are required (ISO format)" };
    }
    const filters: { providerId?: string; roomId?: string } = {};
    if (args.provider_id) filters.providerId = String(args.provider_id);
    if (args.room_id) filters.roomId = String(args.room_id);
    const appointments = await getAppointments(new Date(startDate), new Date(endDate), filters);
    return {
      success: true,
      data: {
        appointments: appointments.map((a) => ({
          id: a.id,
          patientId: a.patientId,
          patientName: a.patientName,
          providerId: a.providerId,
          providerName: a.providerName,
          serviceId: a.serviceId,
          serviceName: a.serviceName,
          roomId: a.roomId,
          roomName: a.roomName,
          startTime: a.startTime.toISOString(),
          endTime: a.endTime.toISOString(),
          status: a.status,
          notes: a.notes,
        })),
      },
    };
  },

  create_appointment: async (args) => {
    const patientId = String(args.patient_id ?? "");
    const providerId = String(args.provider_id ?? "");
    const startTime = String(args.start_time ?? "");
    const endTime = String(args.end_time ?? "");
    if (!patientId || !providerId || !startTime || !endTime) {
      return { success: false, error: "patient_id, provider_id, start_time, and end_time are required" };
    }
    const result = await createAppointment({
      patientId,
      providerId,
      serviceId: args.service_id ? String(args.service_id) : undefined,
      roomId: args.room_id ? String(args.room_id) : undefined,
      startTime,
      endTime,
      notes: args.notes ? String(args.notes) : undefined,
    });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    const apt = result.data!;
    return {
      success: true,
      data: {
        id: apt.id,
        patientName: apt.patientName,
        providerName: apt.providerName,
        serviceName: apt.serviceName,
        roomName: apt.roomName,
        startTime: apt.startTime.toISOString(),
        endTime: apt.endTime.toISOString(),
        status: apt.status,
      },
    };
  },

  update_appointment_status: async (args) => {
    const appointmentId = String(args.appointment_id ?? "");
    const status = String(args.status ?? "");
    if (!appointmentId || !status) {
      return { success: false, error: "appointment_id and status are required" };
    }
    const result = await updateAppointmentStatus(appointmentId, status as AppointmentStatus);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, data: { appointment_id: appointmentId, status } };
  },

  // --- Patient tools ---

  get_patient: async (args) => {
    const patientId = String(args.patient_id ?? "");
    if (!patientId) {
      return { success: false, error: "patient_id is required" };
    }
    const patient = await getPatient(patientId);
    if (!patient) {
      return { success: false, error: "Patient not found" };
    }
    return {
      success: true,
      data: serializeDates({
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        address: patient.address,
        city: patient.city,
        state: patient.state,
        zipCode: patient.zipCode,
        allergies: patient.allergies,
        tags: patient.tags,
        status: patient.status,
        createdAt: patient.createdAt,
      }) as Record<string, unknown>,
    };
  },

  get_patient_timeline: async (args) => {
    const patientId = String(args.patient_id ?? "");
    if (!patientId) {
      return { success: false, error: "patient_id is required" };
    }
    const timeline = await getPatientTimeline(patientId);
    return {
      success: true,
      data: {
        counts: {
          appointments: timeline.appointments.length,
          charts: timeline.charts.length,
          photos: timeline.photos.length,
          consents: timeline.consents.length,
          invoices: timeline.invoices.length,
          documents: timeline.documents.length,
        },
        recent_appointments: timeline.appointments.slice(0, 5).map((a) => ({
          id: a.id,
          startTime: a.startTime.toISOString(),
          endTime: a.endTime.toISOString(),
          status: a.status,
          service: a.service?.name ?? null,
          provider: a.provider.name,
        })),
        recent_charts: timeline.charts.slice(0, 5).map((c) => ({
          id: c.id,
          status: c.status,
          chiefComplaint: c.chiefComplaint,
          createdAt: c.createdAt.toISOString(),
        })),
        recent_invoices: timeline.invoices.slice(0, 5).map((i) => ({
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          status: i.status,
          total: i.total,
          createdAt: i.createdAt.toISOString(),
        })),
      },
    };
  },

  // --- Today / Revenue / Inventory tools ---

  get_today_appointments: async (args) => {
    const filters: { providerId?: string; roomId?: string; search?: string } = {};
    if (args.provider_id) filters.providerId = String(args.provider_id);
    if (args.room_id) filters.roomId = String(args.room_id);
    if (args.search) filters.search = String(args.search);
    const appointments = await getTodayAppointments(filters);
    return {
      success: true,
      data: {
        appointments: appointments.map((a) => ({
          id: a.id,
          patientId: a.patientId,
          patientName: a.patientName,
          providerId: a.providerId,
          providerName: a.providerName,
          serviceName: a.serviceName,
          roomName: a.roomName,
          startTime: a.startTime.toISOString(),
          endTime: a.endTime.toISOString(),
          status: a.status,
          phase: a.phase,
          notes: a.notes,
        })),
      },
    };
  },

  get_invoices: async (args) => {
    const filters: { status?: string; search?: string; dateFrom?: string; dateTo?: string } = {};
    if (args.status) filters.status = String(args.status);
    if (args.search) filters.search = String(args.search);
    if (args.date_from) filters.dateFrom = String(args.date_from);
    if (args.date_to) filters.dateTo = String(args.date_to);
    const invoices = await getInvoices(filters);
    return {
      success: true,
      data: {
        invoices: invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
          total: inv.total,
          subtotal: inv.subtotal,
          discountAmount: inv.discountAmount,
          taxAmount: inv.taxAmount,
          patientName: `${inv.patient.firstName} ${inv.patient.lastName}`,
          createdAt: inv.createdAt.toISOString(),
          dueDate: inv.dueDate?.toISOString() ?? null,
          paidAt: inv.paidAt?.toISOString() ?? null,
          paymentCount: inv._count.payments,
        })),
      },
    };
  },

  get_payments: async (args) => {
    const filters: { search?: string; dateFrom?: string; dateTo?: string; method?: string } = {};
    if (args.search) filters.search = String(args.search);
    if (args.date_from) filters.dateFrom = String(args.date_from);
    if (args.date_to) filters.dateTo = String(args.date_to);
    if (args.method) filters.method = String(args.method);
    const payments = await getPayments(filters);
    return {
      success: true,
      data: {
        payments: payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          reference: p.reference,
          invoiceNumber: p.invoice.invoiceNumber,
          patientName: `${p.invoice.patient.firstName} ${p.invoice.patient.lastName}`,
          createdAt: p.createdAt.toISOString(),
        })),
      },
    };
  },

  lookup_product: async (args) => {
    const name = String(args.name ?? "");
    if (!name) {
      return { success: false, error: "name argument is required" };
    }
    const products = await getProductsForClinic();
    const matches = products.filter((p) => fuzzyMatch(p.name, name));
    return {
      success: true,
      data: {
        matches: matches.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          retailPrice: p.retailPrice,
          wholesaleCost: p.wholesaleCost,
          inventoryCount: p.inventoryCount,
          isActive: p.isActive,
        })),
      },
    };
  },

  receive_stock: async (args) => {
    const productId = String(args.product_id ?? "");
    const quantity = Number(args.quantity ?? 0);
    if (!productId) {
      return { success: false, error: "product_id is required" };
    }
    if (!quantity || quantity <= 0) {
      return { success: false, error: "quantity must be greater than 0" };
    }
    const result = await receiveStock({
      productId,
      quantity,
      lotNumber: args.lot_number ? String(args.lot_number) : undefined,
      expirationDate: args.expiration_date ? String(args.expiration_date) : undefined,
      unitCost: args.unit_cost != null ? Number(args.unit_cost) : undefined,
      vendor: args.vendor ? String(args.vendor) : undefined,
      reference: args.reference ? String(args.reference) : undefined,
    });
    return {
      success: true,
      data: {
        product_id: productId,
        product_name: result.productName,
        quantity_received: result.quantityReceived,
        new_count: result.newCount,
        lot_number: result.lotNumber,
        expiration_date: result.expirationDate,
        transaction_id: result.transactionId,
      },
    };
  },

  create_product: async (args) => {
    const name = String(args.name ?? "");
    const wholesaleCost = Number(args.wholesale_cost ?? 0);
    if (!name) {
      return { success: false, error: "name is required" };
    }
    if (wholesaleCost < 0) {
      return { success: false, error: "wholesale_cost cannot be negative" };
    }
    const result = await createProductFromInvoice({
      name,
      wholesaleCost,
      category: args.category ? String(args.category) : undefined,
      retailPrice: args.retail_price != null ? Number(args.retail_price) : undefined,
      vendor: args.vendor ? String(args.vendor) : undefined,
      sku: args.sku ? String(args.sku) : undefined,
    });
    return {
      success: true,
      data: {
        id: result.id,
        name: result.name,
        wholesale_cost: result.wholesaleCost,
        retail_price: result.retailPrice,
      },
    };
  },

  update_product: async (args) => {
    const productId = String(args.product_id ?? "");
    if (!productId) {
      return { success: false, error: "product_id is required" };
    }
    const existing = await getProduct(productId);
    if (!existing) {
      return { success: false, error: `Product not found: ${productId}` };
    }

    const mergedInput = {
      name: args.name != null ? String(args.name) : existing.name,
      description: existing.description ?? undefined,
      size: existing.size ?? undefined,
      sku: existing.sku ?? undefined,
      upc: existing.upc ?? undefined,
      category: existing.category ?? undefined,
      retailPrice: args.retail_price != null ? Number(args.retail_price) : existing.retailPrice,
      wholesaleCost: args.wholesale_cost != null ? Number(args.wholesale_cost) : existing.wholesaleCost,
      vendor: args.vendor != null ? String(args.vendor) : existing.vendor ?? undefined,
      inventoryCount: existing.inventoryCount,
      taxable: existing.taxable,
    };

    await updateProduct(productId, mergedInput);

    return {
      success: true,
      data: {
        product_id: productId,
        updated_fields: Object.fromEntries(
          Object.entries({
            name: args.name,
            wholesale_cost: args.wholesale_cost,
            retail_price: args.retail_price,
            vendor: args.vendor,
          }).filter(([, v]) => v != null)
        ),
        previous: {
          name: existing.name,
          wholesaleCost: existing.wholesaleCost,
          retailPrice: existing.retailPrice,
          vendor: existing.vendor,
        },
        current: {
          name: mergedInput.name,
          wholesaleCost: mergedInput.wholesaleCost,
          retailPrice: mergedInput.retailPrice,
          vendor: mergedInput.vendor,
        },
      },
    };
  },
};

export const READ_ONLY_TOOLS = new Set([
  "lookup_service", "lookup_patient", "lookup_provider", "lookup_room",
  "get_appointments", "get_patient", "get_patient_timeline",
  "get_today_appointments", "get_invoices", "get_payments", "lookup_product",
]);

export function isReadOnlyTool(toolName: string): boolean {
  return READ_ONLY_TOOLS.has(toolName);
}

export function getToolHandler(toolName: string): ToolHandler | undefined {
  return toolRegistry[toolName];
}

export async function executePlanStep(step: PlanStep): Promise<ToolResult> {
  const handler = getToolHandler(step.tool_name);
  if (!handler) {
    return {
      step_id: step.step_id,
      tool_name: step.tool_name,
      success: false,
      error: `Unknown tool: ${step.tool_name}`,
    };
  }

  try {
    const result = await handler(step.args);
    return {
      step_id: step.step_id,
      tool_name: step.tool_name,
      ...result,
    };
  } catch (err) {
    return {
      step_id: step.step_id,
      tool_name: step.tool_name,
      success: false,
      error: err instanceof Error ? err.message : "Tool execution failed",
    };
  }
}
