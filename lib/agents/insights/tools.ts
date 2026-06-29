import { getServicesForClinic, getService, updateService } from "@/lib/actions/services";
import type { PlanStep } from "./types";

export interface ToolResult {
  step_id: string;
  tool_name: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

type ToolHandler = (args: Record<string, unknown>) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>;

const toolRegistry: Record<string, ToolHandler> = {
  lookup_service: async (args) => {
    const name = String(args.name ?? "");
    if (!name) {
      return { success: false, error: "name argument is required" };
    }
    const services = await getServicesForClinic();
    const needle = name.toLowerCase();
    const matches = services.filter((s) =>
      s.name.toLowerCase().includes(needle)
    );
    if (matches.length === 0) {
      return { success: true, data: { matches: [], message: `No services found matching "${name}"` } };
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
};

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
