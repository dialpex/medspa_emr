// Mapping Proposer — Domain-specific intelligence for proposing MappingSpecs.
// Uses LLMProvider.complete() to call Bedrock/Anthropic/OpenAI for mapping proposals.
// NEVER logs prompt content. Only logs: runId, token counts, latency.

import type { LLMProvider } from "@/lib/agents/_shared/llm/types";
import { extractJSON } from "@/lib/agents/_shared/llm/utils";
import { getLLMProvider } from "@/lib/agents/_shared/llm";
import type { SafeContext } from "@/lib/agents/_shared/phi/safe-context";
import type { MappingSpec } from "@/lib/migration/canonical/mapping-spec";
import { validateMappingSpec } from "@/lib/migration/canonical/mapping-spec";
import type { AllowedTransform } from "@/lib/migration/canonical/transforms";
import { MAPPING_SYSTEM_PROMPT, ENUM_MAPPING_PROMPT } from "./prompts";

export class MappingProposer {
  private provider: LLMProvider;

  constructor(provider?: LLMProvider) {
    this.provider = provider || getLLMProvider({ provider: "bedrock" });
  }

  async proposeMappingSpec(safeContext: SafeContext, runId?: string): Promise<MappingSpec> {
    const startTime = Date.now();

    const userMessage = `Analyze this source data profile and propose field mappings to the canonical schema.\n\n${JSON.stringify(safeContext, null, 2)}`;

    const result = await this.provider.complete(
      MAPPING_SYSTEM_PROMPT,
      userMessage
    );

    const latencyMs = Date.now() - startTime;
    console.log(`[MappingProposer] proposeMappingSpec runId=${runId || "unknown"} latency=${latencyMs}ms`);

    if (!result.text) {
      // Provider returned empty (mock/unavailable) — use mock response
      return this.generateMockMappingSpec(safeContext);
    }

    const spec = extractJSON<MappingSpec>(result.text);
    const validation = validateMappingSpec(spec);
    if (!validation.valid) {
      throw new Error(`Invalid MappingSpec: ${validation.errors.map((e) => e.message).join(", ")}`);
    }

    return spec;
  }

  async suggestEnumMappings(
    sourceEnums: string[],
    targetEnums: string[]
  ): Promise<Record<string, string>> {
    const result = await this.provider.complete(
      ENUM_MAPPING_PROMPT,
      `Source values: ${JSON.stringify(sourceEnums)}\nTarget values: ${JSON.stringify(targetEnums)}`
    );

    if (!result.text) {
      return {};
    }

    return extractJSON<Record<string, string>>(result.text);
  }

  // --- Mock fallback ---

  private generateMockMappingSpec(context: SafeContext): MappingSpec {
    const entityMappings = context.sourceProfile.entities
      .map((entity) => {
        const targetEntity = this.matchCanonicalEntity(entity.type);
        if (!targetEntity) return null;

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

        if (fieldMappings.length === 0) return null;

        return {
          sourceEntity: entity.type,
          targetEntity,
          fieldMappings,
          enumMaps: {} as Record<string, Record<string, string>>,
        };
      })
      .filter((em): em is NonNullable<typeof em> => em !== null);

    return {
      version: 1,
      sourceVendor: "mock",
      entityMappings,
    };
  }

  private matchCanonicalEntity(sourceType: string): MappingSpec["entityMappings"][0]["targetEntity"] | null {
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
    return map[lower] || null;
  }

  private matchCanonicalField(
    sourceField: string,
    targetEntity?: { fields: Array<{ name: string }> }
  ): string | null {
    if (!targetEntity) return null;
    const lower = sourceField.toLowerCase();

    const direct = targetEntity.fields.find(
      (f) => f.name.toLowerCase() === lower
    );
    if (direct) return direct.name;

    const aliases: Record<string, string> = {
      fname: "firstName", first_name: "firstName", firstname: "firstName",
      lname: "lastName", last_name: "lastName", lastname: "lastName",
      dob: "dateOfBirth", date_of_birth: "dateOfBirth", birthdate: "dateOfBirth", birthday: "dateOfBirth",
      phone_number: "phone", mobile: "phone", cell: "phone", phonenumber: "phone",
      email_address: "email", mail: "email",
      sex: "gender", pronoun: "gender", sexassignedatbirth: "gender",
      sex_assigned_at_birth: "gender",
      allergy: "allergies", allergy_list: "allergies",
      medical_notes: "medicalNotes", medicalnotes: "medicalNotes",
      notes: "medicalNotes", booking_memo: "medicalNotes",
      tag: "tags",
      provider: "providerName", provider_name: "providerName", doctor: "providerName",
      providername: "providerName",
      service: "serviceName", service_name: "serviceName", servicename: "serviceName",
      start: "startTime", start_time: "startTime", start_date: "startTime",
      starttime: "startTime",
      end: "endTime", end_time: "endTime", end_date: "endTime", endtime: "endTime",
      id: "sourceRecordId", source_id: "sourceRecordId", sourceid: "sourceRecordId",
      patient_id: "canonicalPatientId", client_id: "canonicalPatientId",
      patientid: "canonicalPatientId", clientid: "canonicalPatientId",
      patientsourceid: "canonicalPatientId", patient_source_id: "canonicalPatientId",
      appointment_id: "canonicalAppointmentId", appointmentid: "canonicalAppointmentId",
      appointmentsourceid: "canonicalAppointmentId", appointment_source_id: "canonicalAppointmentId",
      chief_complaint: "chiefComplaint", chiefcomplaint: "chiefComplaint",
      template_name: "templateName", templatename: "templateName",
      signed_at: "signedAt", signedat: "signedAt",
      invoice_number: "invoiceNumber", invoicenumber: "invoiceNumber",
      paid_at: "paidAt", paidat: "paidAt",
      tax_amount: "taxAmount", taxamount: "taxAmount",
      file_name: "filename", name: "filename",
      mime_type: "mimeType", content_type: "mimeType", mimetype: "mimeType",
      taken_at: "takenAt", takenat: "takenAt",
      url: "artifactKey",
      lineitems: "lineItems", line_items: "lineItems",
      address: "address.line1", street: "address.line1", address1: "address.line1",
      street_address: "address.line1", line1: "address.line1", address_line1: "address.line1",
      address2: "address.line2", line2: "address.line2", address_line2: "address.line2",
      apt: "address.line2", suite: "address.line2",
      city: "address.city",
      state: "address.state", province: "address.state",
      zipcode: "address.zip", zip: "address.zip", zip_code: "address.zip",
      postal_code: "address.zip", postalcode: "address.zip",
      country: "address.country",
    };

    const alias = aliases[lower];
    if (alias) {
      if (alias.startsWith("address.")) return alias;
      if (targetEntity.fields.find((f) => f.name === alias)) return alias;
    }

    return null;
  }

  private suggestTransform(
    sourceField: { inferredType: string; name: string },
    targetField: string
  ): AllowedTransform | null {
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
}
