// Bedrock Claude Client — Intelligence Layer
// Sends SafeContext to Claude via AWS Bedrock, receives MappingSpec.
// NEVER logs prompt content. Only logs: runId, token counts, latency.

import type { SafeContext } from "./safe-context-builder";
import type { MappingSpec } from "../canonical/mapping-spec";
import { validateMappingSpec } from "../canonical/mapping-spec";
import { MAPPING_SYSTEM_PROMPT, ENUM_MAPPING_PROMPT } from "./prompts";

interface BedrockConfig {
  region: string;
  modelId: string;
}

function getConfig(): BedrockConfig {
  return {
    region: process.env.AWS_REGION || "us-east-1",
    modelId: process.env.BEDROCK_MODEL_ID || "anthropic.claude-sonnet-4-5-20250929-v1:0",
  };
}

export class BedrockClaudeClient {
  private config: BedrockConfig;

  constructor(config?: Partial<BedrockConfig>) {
    const defaults = getConfig();
    this.config = { ...defaults, ...config };
  }

  async proposeMappingSpec(safeContext: SafeContext, runId?: string): Promise<MappingSpec> {
    const startTime = Date.now();

    const userMessage = JSON.stringify(safeContext, null, 2);

    const response = await this.invokeModel(
      MAPPING_SYSTEM_PROMPT,
      `Analyze this source data profile and propose field mappings to the canonical schema.\n\n${userMessage}`
    );

    const latencyMs = Date.now() - startTime;
    // Log metadata only — never log prompt content
    console.log(`[Bedrock] proposeMappingSpec runId=${runId || "unknown"} latency=${latencyMs}ms`);

    // Parse and validate
    const spec = this.extractJSON<MappingSpec>(response);
    const validation = validateMappingSpec(spec);
    if (!validation.valid) {
      throw new Error(`Invalid MappingSpec from Bedrock: ${validation.errors.map((e) => e.message).join(", ")}`);
    }

    return spec;
  }

  async suggestEnumMappings(
    sourceEnums: string[],
    targetEnums: string[]
  ): Promise<Record<string, string>> {
    const response = await this.invokeModel(
      ENUM_MAPPING_PROMPT,
      `Source values: ${JSON.stringify(sourceEnums)}\nTarget values: ${JSON.stringify(targetEnums)}`
    );

    return this.extractJSON<Record<string, string>>(response);
  }

  private async invokeModel(systemPrompt: string, userMessage: string): Promise<string> {
    // Check if AWS SDK is available
    try {
      const { BedrockRuntimeClient, InvokeModelCommand } = await import(
        "@aws-sdk/client-bedrock-runtime"
      );

      const client = new BedrockRuntimeClient({ region: this.config.region });

      const body = JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      const command = new InvokeModelCommand({
        modelId: this.config.modelId,
        contentType: "application/json",
        accept: "application/json",
        body: new TextEncoder().encode(body),
      });

      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      return responseBody.content?.[0]?.text || "";
    } catch (error: unknown) {
      // If AWS SDK not installed or credentials missing, fall through to mock
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes("Cannot find module") ||
        message.includes("credentials") ||
        message.includes("Could not load")
      ) {
        console.warn("[Bedrock] AWS SDK unavailable, using mock response");
        return this.mockResponse(systemPrompt, userMessage);
      }
      throw error;
    }
  }

  private mockResponse(_systemPrompt: string, userMessage: string): string {
    // Generate a sensible mock MappingSpec from the SafeContext
    try {
      const context = JSON.parse(userMessage.split("\n\n").slice(1).join("\n\n")) as SafeContext;
      return JSON.stringify(this.generateMockMappingSpec(context));
    } catch {
      return JSON.stringify({
        version: 1,
        sourceVendor: "unknown",
        entityMappings: [],
      });
    }
  }

  private generateMockMappingSpec(context: SafeContext): MappingSpec {
    const entityMappings = context.sourceProfile.entities.map((entity) => {
      // Find matching canonical entity
      const targetEntity = this.matchCanonicalEntity(entity.type);
      const targetEntityDesc = context.targetSchema.find((s) => s.entityType === targetEntity);

      const fieldMappings = entity.fields
        .map((field) => {
          const targetField = this.matchCanonicalField(field.name, targetEntityDesc);
          if (!targetField) return null;

          const transform = this.suggestTransform(field, targetField);
          const confidence = this.estimateConfidence(field.name, targetField);

          return {
            sourceField: field.name,
            targetField,
            transform,
            confidence,
            requiresApproval: confidence < 0.8,
          };
        })
        .filter((fm): fm is NonNullable<typeof fm> => fm !== null);

      return {
        sourceEntity: entity.type,
        targetEntity,
        fieldMappings,
        enumMaps: {} as Record<string, Record<string, string>>,
      };
    });

    return {
      version: 1,
      sourceVendor: "mock",
      entityMappings,
    };
  }

  private matchCanonicalEntity(sourceType: string): MappingSpec["entityMappings"][0]["targetEntity"] {
    const lower = sourceType.toLowerCase();
    const map: Record<string, MappingSpec["entityMappings"][0]["targetEntity"]> = {
      patients: "patient", patient: "patient", clients: "patient", client: "patient",
      appointments: "appointment", appointment: "appointment", bookings: "appointment",
      charts: "chart", chart: "chart",
      encounters: "encounter", encounter: "encounter",
      consents: "consent", consent: "consent",
      photos: "photo", photo: "photo",
      documents: "document", document: "document",
      invoices: "invoice", invoice: "invoice",
    };
    return map[lower] || "patient";
  }

  private matchCanonicalField(
    sourceField: string,
    targetEntity?: { fields: Array<{ name: string }> }
  ): string | null {
    if (!targetEntity) return null;
    const lower = sourceField.toLowerCase();

    // Direct name matches
    const direct = targetEntity.fields.find(
      (f) => f.name.toLowerCase() === lower
    );
    if (direct) return direct.name;

    // Common aliases
    const aliases: Record<string, string> = {
      fname: "firstName", first_name: "firstName", firstname: "firstName",
      lname: "lastName", last_name: "lastName", lastname: "lastName",
      dob: "dateOfBirth", date_of_birth: "dateOfBirth", birthdate: "dateOfBirth", birthday: "dateOfBirth",
      phone_number: "phone", mobile: "phone", cell: "phone",
      email_address: "email", mail: "email",
      provider: "providerName", provider_name: "providerName", doctor: "providerName",
      service: "serviceName", service_name: "serviceName",
      start: "startTime", start_time: "startTime", start_date: "startTime",
      end: "endTime", end_time: "endTime", end_date: "endTime",
      id: "sourceRecordId", source_id: "sourceRecordId",
      patient_id: "canonicalPatientId", client_id: "canonicalPatientId", patientid: "canonicalPatientId",
      appointment_id: "canonicalAppointmentId",
      chief_complaint: "chiefComplaint",
      template_name: "templateName",
      signed_at: "signedAt",
      invoice_number: "invoiceNumber",
      paid_at: "paidAt",
      tax_amount: "taxAmount",
      file_name: "filename", name: "filename",
      mime_type: "mimeType", content_type: "mimeType",
      taken_at: "takenAt",
    };

    const alias = aliases[lower];
    if (alias && targetEntity.fields.find((f) => f.name === alias)) return alias;

    return null;
  }

  private suggestTransform(
    sourceField: { inferredType: string; name: string },
    targetField: string
  ): string | null {
    if (targetField === "dateOfBirth" || targetField === "startTime" || targetField === "endTime" || targetField === "signedAt" || targetField === "paidAt" || targetField === "takenAt") {
      return "normalizeDate";
    }
    if (targetField === "phone") return "normalizePhone";
    if (targetField === "email") return "normalizeEmail";
    if (targetField === "firstName" || targetField === "lastName") {
      if (sourceField.name.toLowerCase().includes("full") || sourceField.name.toLowerCase() === "name") {
        return "splitName";
      }
      return "trim";
    }
    return null;
  }

  private estimateConfidence(sourceField: string, targetField: string): number {
    const lower = sourceField.toLowerCase().replace(/[_-]/g, "");
    const targetLower = targetField.toLowerCase();

    if (lower === targetLower) return 0.95;
    if (lower.includes(targetLower) || targetLower.includes(lower)) return 0.85;
    return 0.6;
  }

  private extractJSON<T>(text: string): T {
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Bedrock response");
    }
    return JSON.parse(jsonMatch[0]);
  }
}
