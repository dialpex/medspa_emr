import { prisma } from "@/lib/prisma";

// Common PHI patterns
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const PHONE_PATTERN = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const DOB_PATTERN = /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/g;

/**
 * Redact PHI patterns from text before sending to LLMs.
 * Handles regex-based pattern detection and known patient name lookup.
 */
export async function redactTextPHI(text: string, clinicId: string): Promise<string> {
  let redacted = text;

  // Redact common patterns
  redacted = redacted.replace(SSN_PATTERN, "[REDACTED-SSN]");
  redacted = redacted.replace(PHONE_PATTERN, "[REDACTED-PHONE]");
  redacted = redacted.replace(EMAIL_PATTERN, "[REDACTED-EMAIL]");
  redacted = redacted.replace(DOB_PATTERN, "[REDACTED-DOB]");

  // Look up patient names for this clinic and redact them
  try {
    const patients = await prisma.patient.findMany({
      where: { clinicId, deletedAt: null },
      select: { firstName: true, lastName: true },
    });

    for (const patient of patients) {
      const firstName = patient.firstName;
      const lastName = patient.lastName;

      if (firstName.length >= 2) {
        const firstNameRegex = new RegExp(`\\b${escapeRegex(firstName)}\\b`, "gi");
        redacted = redacted.replace(firstNameRegex, "[REDACTED-NAME]");
      }
      if (lastName.length >= 2) {
        const lastNameRegex = new RegExp(`\\b${escapeRegex(lastName)}\\b`, "gi");
        redacted = redacted.replace(lastNameRegex, "[REDACTED-NAME]");
      }
    }
  } catch {
    // If patient lookup fails, continue with pattern-based redaction only
  }

  return redacted;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
