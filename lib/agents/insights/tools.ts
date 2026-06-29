// Neuvvia Insights tools — ToolHandler[] for runToolLoop().

import type { ToolHandler } from "@/lib/agents/_shared/llm/types";
import { prisma } from "@/lib/prisma";

function insightsTools(clinicId: string): ToolHandler[] {
  return [
    {
      name: "lookup_service",
      description:
        "Search services by partial name. Returns matching services with IDs, prices, durations, and categories.",
      input_schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Partial service name to search for",
          },
        },
        required: ["name"],
      },
      handler: async (input) => {
        const name = String(input.name ?? "");
        if (!name) return { error: "name argument is required" };

        const services = await prisma.service.findMany({
          where: { clinicId },
        });
        const needle = name.toLowerCase();
        const matches = services.filter((s) =>
          s.name.toLowerCase().includes(needle)
        );

        if (matches.length === 0) {
          return { matches: [], message: `No services found matching "${name}"` };
        }

        return {
          matches: matches.map((s) => ({
            id: s.id,
            name: s.name,
            price: s.price,
            duration: s.duration,
            category: s.category,
            isActive: s.isActive,
          })),
        };
      },
    },
    {
      name: "update_service",
      description:
        "Update one or more fields on a service. Requires service_id from a prior lookup. " +
        "IMPORTANT: Always confirm with the user before calling this tool.",
      input_schema: {
        type: "object",
        properties: {
          service_id: { type: "string", description: "Service ID from lookup" },
          name: { type: "string", description: "New service name" },
          price: { type: "number", description: "New price" },
          duration: { type: "number", description: "New duration in minutes" },
          description: { type: "string", description: "New description" },
        },
        required: ["service_id"],
      },
      handler: async (input) => {
        const serviceId = String(input.service_id ?? "");
        if (!serviceId) return { error: "service_id argument is required" };

        const existing = await prisma.service.findFirst({
          where: { id: serviceId, clinicId },
        });
        if (!existing) return { error: `Service not found: ${serviceId}` };

        const data: Record<string, unknown> = {};
        if (input.name != null) data.name = String(input.name);
        if (input.price != null) data.price = Number(input.price);
        if (input.duration != null) data.duration = Number(input.duration);
        if (input.description != null) data.description = String(input.description);

        if (Object.keys(data).length === 0) {
          return { error: "No fields to update" };
        }

        await prisma.service.update({ where: { id: serviceId }, data });

        return {
          updated: true,
          service_id: serviceId,
          previous: { name: existing.name, price: existing.price, duration: existing.duration },
          updated_fields: data,
        };
      },
    },
    {
      name: "lookup_patient",
      description:
        "Search patients by name. Returns matching patients with IDs and basic demographics (no PHI values beyond name).",
      input_schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Patient name or partial name to search",
          },
        },
        required: ["name"],
      },
      handler: async (input) => {
        const name = String(input.name ?? "");
        if (!name) return { error: "name argument is required" };

        const patients = await prisma.patient.findMany({
          where: {
            clinicId,
            OR: [
              { firstName: { contains: name } },
              { lastName: { contains: name } },
            ],
          },
          take: 10,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        });

        if (patients.length === 0) {
          return { matches: [], message: `No patients found matching "${name}"` };
        }

        return {
          matches: patients.map((p) => ({
            id: p.id,
            name: `${p.firstName} ${p.lastName}`,
            status: p.status,
          })),
        };
      },
    },
    {
      name: "list_appointments",
      description:
        "List appointments for a date range. Returns appointment details including patient name, service, provider, status, and time.",
      input_schema: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format. Defaults to today.",
          },
          patient_id: {
            type: "string",
            description: "Optional patient ID to filter by",
          },
        },
      },
      handler: async (input) => {
        const dateStr = input.date ? String(input.date) : new Date().toISOString().split("T")[0];
        const startOfDay = new Date(`${dateStr}T00:00:00`);
        const endOfDay = new Date(`${dateStr}T23:59:59`);

        const where: Record<string, unknown> = {
          clinicId,
          startTime: { gte: startOfDay, lte: endOfDay },
        };
        if (input.patient_id) {
          where.patientId = String(input.patient_id);
        }

        const appointments = await prisma.appointment.findMany({
          where,
          include: {
            patient: { select: { firstName: true, lastName: true } },
            provider: { select: { name: true } },
            service: { select: { name: true } },
          },
          orderBy: { startTime: "asc" },
          take: 50,
        });

        return {
          date: dateStr,
          count: appointments.length,
          appointments: appointments.map((a) => ({
            id: a.id,
            time: a.startTime.toISOString(),
            patient: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : "N/A",
            service: a.service?.name ?? "N/A",
            provider: a.provider.name,
            status: a.status,
            durationMin: Math.round((a.endTime.getTime() - a.startTime.getTime()) / 60000),
          })),
        };
      },
    },
    {
      name: "get_revenue_summary",
      description:
        "Get revenue summary for a date range. Only available to Owner and Billing roles. " +
        "Returns totals for invoices, payments, and refunds.",
      input_schema: {
        type: "object",
        properties: {
          start_date: {
            type: "string",
            description: "Start date in YYYY-MM-DD format. Defaults to 30 days ago.",
          },
          end_date: {
            type: "string",
            description: "End date in YYYY-MM-DD format. Defaults to today.",
          },
        },
      },
      handler: async (input) => {
        const endDate = input.end_date
          ? new Date(`${String(input.end_date)}T23:59:59`)
          : new Date();
        const startDate = input.start_date
          ? new Date(`${String(input.start_date)}T00:00:00`)
          : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

        const invoices = await prisma.invoice.findMany({
          where: {
            clinicId,
            createdAt: { gte: startDate, lte: endDate },
            deletedAt: null,
          },
          select: { total: true, status: true },
        });

        const payments = await prisma.payment.findMany({
          where: {
            clinicId,
            createdAt: { gte: startDate, lte: endDate },
            deletedAt: null,
          },
          select: { amount: true },
        });

        const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
        const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
        const paidCount = invoices.filter((i) => i.status === "Paid").length;
        const outstandingCount = invoices.filter(
          (i) => i.status !== "Paid" && i.status !== "Void" && i.status !== "Refunded"
        ).length;

        return {
          period: {
            start: startDate.toISOString().split("T")[0],
            end: endDate.toISOString().split("T")[0],
          },
          total_invoiced: totalInvoiced,
          total_collected: totalCollected,
          invoice_count: invoices.length,
          paid_invoices: paidCount,
          outstanding_invoices: outstandingCount,
        };
      },
    },
  ];
}

export { insightsTools };
