import { prisma } from "@/lib/prisma";

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
 * Uses deterministic matching (exact email, exact phone) first,
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
  // 1. Exact email match
  if (sourcePatient.email) {
    const emailMatch = await prisma.patient.findFirst({
      where: {
        clinicId,
        email: sourcePatient.email.toLowerCase(),
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

  // 2. Exact phone match (E.164 normalized)
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

    const phoneMatch = patients.find(
      (p) => p.phone && normalizePhone(p.phone) === normalized
    );

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
      const firstSimilar =
        p.firstName.toLowerCase().trim() === sourcePatient.firstName.toLowerCase().trim() ||
        p.firstName.toLowerCase().startsWith(sourcePatient.firstName.toLowerCase().substring(0, 3));
      const lastSimilar =
        p.lastName.toLowerCase().trim() === sourcePatient.lastName.toLowerCase().trim();
      return firstSimilar && lastSimilar;
    });

    if (fuzzyMatch) {
      return {
        isDuplicate: true,
        existingPatientId: fuzzyMatch.id,
        matchType: "fuzzy_name_dob",
        reasoning: `Matched to existing patient "${fuzzyMatch.firstName} ${fuzzyMatch.lastName}" by similar name + same date of birth`,
      };
    }
  }

  return {
    isDuplicate: false,
    reasoning: "No matching patient found in Neuvvia",
  };
}
