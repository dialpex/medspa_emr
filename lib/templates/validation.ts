/**
 * Treatment card validation — pure functions, no Next.js deps.
 * Importable by tests directly.
 */

import { parseStructuredData, type InjectableData, type LaserData } from "./schemas";

export interface ValidationResult {
  missingHighRiskFields: string[];
  missingNonCriticalFields: string[];
  warnings: string[];
  isSignBlocking: boolean;
}

export type CardStatus = "Complete" | "Missing" | "MissingHighRisk";

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------
export function validateTreatmentCard(
  templateType: string,
  structuredData: string
): ValidationResult {
  switch (templateType) {
    case "Injectable":
      return validateInjectable(structuredData);
    case "Laser":
      return validateLaser(structuredData);
    case "Esthetics":
      return validateEsthetics(structuredData);
    default:
      return { missingHighRiskFields: [], missingNonCriticalFields: [], warnings: [], isSignBlocking: false };
  }
}

// ---------------------------------------------------------------------------
// Injectable
// ---------------------------------------------------------------------------
function validateInjectable(raw: string): ValidationResult {
  const data = parseStructuredData<InjectableData>("Injectable", raw);
  const missing: string[] = [];
  const nonCritical: string[] = [];
  const warnings: string[] = [];

  // Only enforce high-risk when card has substantive data
  const hasSubstantiveData =
    !!data.productName ||
    data.areas.some((a) => a.units > 0);

  if (hasSubstantiveData) {
    // Lot entries required
    const hasValidLot = data.lotEntries.length > 0 &&
      data.lotEntries.some((l) => !!l.lotNumber && !!l.expirationDate);
    if (!hasValidLot) {
      missing.push("lotEntries");
    }

    // Total units must be > 0
    if (!data.totalUnits || data.totalUnits <= 0) {
      missing.push("totalUnits");
    }

    // Mismatch warning
    const areasSum = data.areas.reduce((sum, a) => sum + (a.units || 0), 0);
    if (data.totalUnits > 0 && areasSum > 0 && data.totalUnits !== areasSum) {
      warnings.push(`totalUnits (${data.totalUnits}) does not match sum of area units (${areasSum})`);
    }
  }

  // Non-critical
  if (!data.outcome) nonCritical.push("outcome");
  if (!data.followUpPlan) nonCritical.push("followUpPlan");
  if (!data.aftercare) nonCritical.push("aftercare");

  return {
    missingHighRiskFields: missing,
    missingNonCriticalFields: nonCritical,
    warnings,
    isSignBlocking: missing.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Laser
// ---------------------------------------------------------------------------
function validateLaser(raw: string): ValidationResult {
  const data = parseStructuredData<LaserData>("Laser", raw);
  const missing: string[] = [];
  const nonCritical: string[] = [];

  // Check if any field has been set
  const hasAnyData =
    !!data.deviceName ||
    data.areasTreated.length > 0 ||
    !!data.parameters.energy ||
    (data.parameters.passes && data.parameters.passes > 0);

  if (hasAnyData) {
    if (!data.deviceName) missing.push("deviceName");
    if (!data.parameters.energy) missing.push("parameters.energy");
    if (!data.parameters.passes || data.parameters.passes <= 0) missing.push("parameters.passes");
  }

  if (!data.outcome) nonCritical.push("outcome");
  if (!data.aftercare) nonCritical.push("aftercare");

  return {
    missingHighRiskFields: missing,
    missingNonCriticalFields: nonCritical,
    warnings: [],
    isSignBlocking: missing.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Esthetics — no high-risk fields
// ---------------------------------------------------------------------------
function validateEsthetics(raw: string): ValidationResult {
  const data = parseStructuredData<{ outcome: string; aftercare: string }>("Esthetics", raw);
  const nonCritical: string[] = [];
  if (!data.outcome) nonCritical.push("outcome");
  if (!data.aftercare) nonCritical.push("aftercare");

  return {
    missingHighRiskFields: [],
    missingNonCriticalFields: nonCritical,
    warnings: [],
    isSignBlocking: false,
  };
}

// ---------------------------------------------------------------------------
// Helper — derive card status from validation
// ---------------------------------------------------------------------------
export function getCardStatus(validation: ValidationResult): CardStatus {
  if (validation.isSignBlocking) return "MissingHighRisk";
  if (validation.missingNonCriticalFields.length > 0) return "Missing";
  return "Complete";
}
