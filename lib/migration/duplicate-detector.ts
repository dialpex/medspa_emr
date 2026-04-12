import { prisma } from "@/lib/prisma";
import { blindIndex } from "@/lib/encryption/field-encryption";
import { decryptPatientData } from "@/lib/encryption/patient-encryption";

interface PatientMatch {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: Date | null;
}

export interface DuplicateResult {
  isDuplicate: boolean;
  existingPatientId?: string;
  matchType?: "exact_email" | "exact_phone" | "fuzzy_name_dob";
  reasoning: string;
}

/**
 * Normalize phone to E.164 format for comparison.
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

/**
 * Check if a source patient already exists in Neuvvia.
 * Uses deterministic matching (exact email via blind index, exact phone) first,
 * then fuzzy name + DOB matching.
 */
export async function detectDuplicate(
  clinicId: string,
  sourcePatient: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
  }
): Promise<DuplicateResult> {
  // 1. Exact email match via blind index
  if (sourcePatient.email) {
    const hash = blindIndex(sourcePatient.email.toLowerCase());
    const emailMatch = await prisma.patient.findFirst({
      where: {
        clinicId,
        emailHash: hash,
        deletedAt: null,
      },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, dateOfBirth: true },
    });

    if (emailMatch) {
      return {
        isDuplicate: true,
        existingPatientId: emailMatch.id,
        matchType: "exact_email",
        reasoning: `Matched to existing patient by email (${sourcePatient.email})`,
      };
    }
  }

  // 2. Exact phone match (E.164 normalized, decrypt and compare)
  if (sourcePatient.phone) {
    const normalized = normalizePhone(sourcePatient.phone);
    const patients = await prisma.patient.findMany({
      where: {
        clinicId,
        deletedAt: null,
        phone: { not: null },
      },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, dateOfBirth: true },
    });

    const phoneMatch = patients.find((p) => {
      const d = decryptPatientData(p as any);
      return d.phone && normalizePhone(d.phone as string) === normalized;
    });

    if (phoneMatch) {
      return {
        isDuplicate: true,
        existingPatientId: phoneMatch.id,
        matchType: "exact_phone",
        reasoning: `Matched to existing patient by phone number (${sourcePatient.phone})`,
      };
    }
  }

  // 3. Fuzzy name + DOB matching
  if (sourcePatient.dateOfBirth) {
    const dobDate = new Date(sourcePatient.dateOfBirth);
    const nameMatches = await prisma.patient.findMany({
      where: {
        clinicId,
        deletedAt: null,
        dateOfBirth: dobDate,
      },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, dateOfBirth: true },
    });

    const fuzzyMatch = nameMatches.find((p) => {
      const d = decryptPatientData(p as any);
      const fn = (d.firstName as string).toLowerCase().trim();
      const ln = (d.lastName as string).toLowerCase().trim();
      const srcFn = sourcePatient.firstName.toLowerCase().trim();
      const srcLn = sourcePatient.lastName.toLowerCase().trim();
      const firstSimilar = fn === srcFn || fn.startsWith(srcFn.substring(0, 3));
      const lastSimilar = ln === srcLn;
      return firstSimilar && lastSimilar;
    });

    if (fuzzyMatch) {
      const d = decryptPatientData(fuzzyMatch as any);
      return {
        isDuplicate: true,
        existingPatientId: fuzzyMatch.id,
        matchType: "fuzzy_name_dob",
        reasoning: `Matched to existing patient "${d.firstName} ${d.lastName}" by similar name + same date of birth`,
      };
    }
  }

  return {
    isDuplicate: false,
    reasoning: "No matching patient found in Neuvvia",
  };
}
