import type { AiProvider, AIResponse, ChatRequest } from "./types";

// Domain routing per system prompt hard triggers
const SCHEDULING_KEYWORDS = [
  "schedule", "appointment", "book", "reschedule", "cancel",
  "move", "availability", "openings", "next opening", "slot",
  "morning", "afternoon", "evening", "tomorrow", "next week",
];
const REVENUE_KEYWORDS = [
  "revenue", "refund", "reverse", "write-off", "payment", "charge",
  "ar", "collections", "reconcile", "invoice", "billing", "sales",
  "income", "earnings", "money", "financial",
];
const INVENTORY_KEYWORDS = [
  "stock", "inventory", "lot", "expiration", "sku", "received",
  "reorder", "low stock", "supply", "supplies", "units",
];
const SERVICE_KEYWORDS = [
  "price", "pricing", "cost", "service", "treatment", "botox",
  "filler", "laser", "facial", "peel", "sculptra", "radiesse",
  "juvederm", "restylane", "dysport", "xeomin", "kybella",
  "hydrafacial", "microneedling", "ipl", "coolsculpting",
  "update", "change", "edit", "modify", "set",
];
const PATIENT_KEYWORDS = [
  "patient", "client", "chart", "record", "medical history",
  "consent", "intake", "allergies", "notes",
];

function detectDomain(text: string): "scheduling" | "revenue" | "inventory" | "general" {
  const t = text.toLowerCase();
  if (SCHEDULING_KEYWORDS.some((k) => t.includes(k))) return "scheduling";
  if (REVENUE_KEYWORDS.some((k) => t.includes(k))) return "revenue";
  if (INVENTORY_KEYWORDS.some((k) => t.includes(k))) return "inventory";
  return "general";
}

function matchesAny(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k));
}

export class MockAiProvider implements AiProvider {
  async chat(request: ChatRequest): Promise<AIResponse> {
    await new Promise((resolve) => setTimeout(resolve, 800));

    const lastMessage = request.messages[request.messages.length - 1];
    const text = lastMessage.content.toLowerCase();
    const domain = detectDomain(text);
    const role = request.context.userRole;

    // Confirmation flow
    if (text === "confirm" || text === "yes" || text.includes("go ahead")) {
      return {
        type: "result",
        domain: "general",
        rationale_muted: "User confirmed. Action executed successfully.",
        clarification: null,
        plan: null,
        result: {
          summary: "Action completed successfully.",
          details: { status: "completed", timestamp: new Date().toISOString() },
        },
        permission_check: { allowed: true, reason_if_denied: null },
      };
    }

    // Cancel flow
    if (text === "cancel" || text === "no" || text === "nevermind") {
      return {
        type: "result",
        domain: "general",
        rationale_muted: "User cancelled the action.",
        clarification: null,
        plan: null,
        result: {
          summary: "Action cancelled. No changes were made.",
          details: {},
        },
        permission_check: { allowed: true, reason_if_denied: null },
      };
    }

    // Revenue domain — RBAC check: only Owner and Billing
    if (domain === "revenue") {
      if (role !== "Owner" && role !== "Billing") {
        return {
          type: "refuse",
          domain: "revenue",
          rationale_muted: "Revenue data is restricted to Owner and Billing roles.",
          clarification: null,
          plan: null,
          result: null,
          permission_check: {
            allowed: false,
            reason_if_denied: `Your role (${role}) does not have access to revenue data. Please contact an Owner or Billing team member.`,
          },
        };
      }
      return {
        type: "result",
        domain: "revenue",
        rationale_muted: "Revenue summary for the default period (last 30 days).",
        clarification: null,
        plan: null,
        result: {
          summary: "Revenue for the last 30 days: $47,250. Net after refunds: $45,800.",
          details: {
            gross_revenue: "$47,250",
            refunds: "$1,450",
            net_revenue: "$45,800",
            period: "Last 30 days",
          },
        },
        permission_check: { allowed: true, reason_if_denied: null },
      };
    }

    // Scheduling domain
    if (domain === "scheduling") {
      // If vague, clarify
      if (!text.match(/\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|\d{1,2}\/\d{1,2})\b/)) {
        return {
          type: "clarify",
          domain: "scheduling",
          rationale_muted: "Need a timeframe to search for available slots.",
          clarification: {
            question: "When would you like to schedule this?",
            choices: [
              { id: "today", label: "Today" },
              { id: "tomorrow", label: "Tomorrow" },
              { id: "next_week", label: "Next week" },
              { id: "specific", label: "A specific date" },
            ],
          },
          plan: null,
          result: null,
          permission_check: { allowed: true, reason_if_denied: null },
        };
      }
      return {
        type: "plan",
        domain: "scheduling",
        rationale_muted: "Proposing a scheduling action based on availability and patient preferences.",
        clarification: null,
        plan: {
          execution_mode_prompt: false,
          steps: [
            {
              step_id: "1",
              tool_name: "check_availability",
              args: { date: "2026-02-15", provider: "Dr. Smith" },
              preview: "Check provider availability for the requested date",
            },
            {
              step_id: "2",
              tool_name: "create_appointment",
              args: { time: "10:00 AM", duration: 60 },
              preview: "Create appointment at the best available slot",
            },
          ],
          confirm_prompt: "Shall I book this appointment for tomorrow at 10:00 AM with Dr. Smith?",
        },
        result: null,
        permission_check: { allowed: true, reason_if_denied: null },
      };
    }

    // Inventory domain
    if (domain === "inventory") {
      return {
        type: "clarify",
        domain: "inventory",
        rationale_muted: "Need to identify the specific inventory item.",
        clarification: {
          question: "What would you like to do with inventory?",
          choices: [
            { id: "check_stock", label: "Check stock levels" },
            { id: "add_receipt", label: "Add a new receipt" },
            { id: "low_stock", label: "View low stock alerts" },
            { id: "expiring", label: "View expiring items" },
          ],
        },
        plan: null,
        result: null,
        permission_check: { allowed: true, reason_if_denied: null },
      };
    }

    // Service/pricing modifications → plan with clarification
    if (matchesAny(text, SERVICE_KEYWORDS) && matchesAny(text, ["update", "change", "edit", "modify", "set", "price", "pricing", "cost"])) {
      // Extract a service name hint from the message
      const serviceHint = extractServiceName(text);
      return {
        type: "clarify",
        domain: "general",
        rationale_muted: "Need to confirm the exact service and new value before proposing changes.",
        clarification: {
          question: serviceHint
            ? `What would you like to update for ${serviceHint}?`
            : "Which service would you like to update?",
          choices: serviceHint
            ? [
                { id: "price", label: "Update the price" },
                { id: "duration", label: "Update the duration" },
                { id: "description", label: "Update the description" },
                { id: "status", label: "Activate or deactivate" },
              ]
            : [
                { id: "botox", label: "Botox" },
                { id: "filler", label: "Dermal Fillers" },
                { id: "laser", label: "Laser Treatments" },
                { id: "facial", label: "Facials & Peels" },
              ],
        },
        plan: null,
        result: null,
        permission_check: { allowed: true, reason_if_denied: null },
      };
    }

    // Patient-related queries
    if (matchesAny(text, PATIENT_KEYWORDS)) {
      return {
        type: "clarify",
        domain: "general",
        rationale_muted: "Need more information to identify the patient and action.",
        clarification: {
          question: "What would you like to do?",
          choices: [
            { id: "view", label: "View patient details" },
            { id: "schedule", label: "Schedule an appointment" },
            { id: "chart", label: "View chart notes" },
            { id: "billing", label: "View billing history" },
          ],
        },
        plan: null,
        result: null,
        permission_check: { allowed: true, reason_if_denied: null },
      };
    }

    // Handle choice selections from clarify responses (e.g. "Update the price")
    if (matchesAny(text, ["update the price", "update the duration", "update the description"])) {
      return {
        type: "plan",
        domain: "general",
        rationale_muted: "Proposing a service update based on user selection.",
        clarification: null,
        plan: {
          execution_mode_prompt: false,
          steps: [
            {
              step_id: "1",
              tool_name: "lookup_service",
              args: { query: text },
              preview: "Look up the current service details",
            },
            {
              step_id: "2",
              tool_name: "update_service",
              args: { field: "price" },
              preview: "Update the service with the new value",
            },
          ],
          confirm_prompt: "I'll look up the service and prepare the update. What should the new value be?",
        },
        result: null,
        permission_check: { allowed: true, reason_if_denied: null },
      };
    }

    // Greeting / general
    if (matchesAny(text, ["hello", "hi", "hey", "help", "what can you"])) {
      return {
        type: "result",
        domain: "general",
        rationale_muted: "Greeting the user with available capabilities.",
        clarification: null,
        plan: null,
        result: {
          summary: `Hi ${request.context.userName}! I'm your EMR assistant. I can help with:`,
          details: {
            capabilities: [
              "Scheduling — book, reschedule, or cancel appointments",
              "Revenue — view reports, process refunds (Owner/Billing only)",
              "Inventory — check stock, add receipts, flag expiring items",
              "Services — update pricing, durations, and descriptions",
              "Patients — look up records, charts, and history",
            ],
          },
        },
        permission_check: { allowed: true, reason_if_denied: null },
      };
    }

    // General fallback — clarify intent instead of showing help
    return {
      type: "clarify",
      domain: "general",
      rationale_muted: "Could not determine intent from the message. Asking for clarification.",
      clarification: {
        question: "I'd like to help! What area are you looking for assistance with?",
        choices: [
          { id: "scheduling", label: "Scheduling & Appointments" },
          { id: "revenue", label: "Revenue & Billing" },
          { id: "inventory", label: "Inventory & Supplies" },
          { id: "patients", label: "Patients & Charts" },
        ],
      },
      plan: null,
      result: null,
      permission_check: { allowed: true, reason_if_denied: null },
    };
  }
}

function extractServiceName(text: string): string | null {
  const services = [
    "botox", "dysport", "xeomin", "filler", "juvederm", "restylane",
    "sculptra", "radiesse", "kybella", "hydrafacial", "microneedling",
    "ipl", "coolsculpting", "laser", "facial", "peel",
  ];
  const t = text.toLowerCase();
  const found = services.find((s) => t.includes(s));
  if (found) return found.charAt(0).toUpperCase() + found.slice(1);
  return null;
}
