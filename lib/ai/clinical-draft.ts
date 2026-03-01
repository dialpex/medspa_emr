/**
 * AI Clinical Draft — system prompts, mock stub, patch logic, OpenAI call.
 * Pure module (no Next.js deps) so it's testable directly.
 */

import type { InjectableData, LaserData, EstheticsData } from "@/lib/templates/schemas";
import { DEFAULT_STRUCTURED_DATA, parseStructuredData } from "@/lib/templates/schemas";
import { validateTreatmentCard } from "@/lib/templates/validation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiDraftResult {
  structuredDataPatch: Record<string, unknown>;
  narrativeDraftText: string;
  missingHighRisk: Array<{ field: string; reason: string }>;
  conflicts: Array<{ field: string; existing: unknown; proposed: unknown }>;
  warnings: string[];
}

export interface PatchResult {
  merged: Record<string, unknown>;
  conflicts: Array<{ field: string; existing: unknown; proposed: unknown }>;
}

// ---------------------------------------------------------------------------
// System prompts per template type
// ---------------------------------------------------------------------------

const INJECTABLE_RULES = `You are a medical charting assistant for an aesthetic/medspa clinic.
The provider has typed a quick summary of an Injectable treatment. Your job is to reorganize
their input into structured fields and a professional clinical narrative.

STRUCTURED FIELDS (Injectable):
- productName: string (e.g. "Botox", "Dysport", "Juvederm")
- areas: Array<{ areaLabel: string, units: number }> (injection sites with units)
- totalUnits: number (sum of all area units)
- lotEntries: Array<{ lotNumber: string, expirationDate: string }> (lot tracking)
- outcome: string (immediate outcome observations)
- followUpPlan: string
- aftercare: string

RULES:
- Only extract data the provider explicitly mentioned. Never invent data.
- Do NOT provide medical advice or recommendations.
- If the provider mentions units for areas, compute totalUnits as the sum.
- Format lot entries with ISO dates when recognizable (e.g. "2027-06" → "2027-06").
- The narrative should be a professional clinical note restating the provider's input.`;

const LASER_RULES = `You are a medical charting assistant for an aesthetic/medspa clinic.
The provider has typed a quick summary of a Laser treatment. Your job is to reorganize
their input into structured fields and a professional clinical narrative.

STRUCTURED FIELDS (Laser):
- deviceName: string (e.g. "Candela GentleMax Pro", "Lumenis", "IPL")
- areasTreated: string[] (treatment areas)
- parameters: { energy: string, pulseDuration?: string, passes: number }
- outcome: string
- aftercare: string

RULES:
- Only extract data the provider explicitly mentioned. Never invent data.
- Do NOT provide medical advice or recommendations.
- The narrative should be a professional clinical note restating the provider's input.`;

const ESTHETICS_RULES = `You are a medical charting assistant for an aesthetic/medspa clinic.
The provider has typed a quick summary of an Esthetics treatment. Your job is to reorganize
their input into structured fields and a professional clinical narrative.

STRUCTURED FIELDS (Esthetics):
- areasTreated: string (treatment areas)
- productsUsed: string (products/serums used)
- skinResponse: string (skin response observations)
- outcome: string
- aftercare: string

RULES:
- Only extract data the provider explicitly mentioned. Never invent data.
- Do NOT provide medical advice or recommendations.
- The narrative should be a professional clinical note restating the provider's input.`;

const SYSTEM_PROMPTS: Record<string, string> = {
  Injectable: INJECTABLE_RULES,
  Laser: LASER_RULES,
  Esthetics: ESTHETICS_RULES,
};

const JSON_OUTPUT_INSTRUCTION = `

Respond ONLY with valid JSON matching this schema:
{
  "structuredDataPatch": { ... only non-empty fields to merge ... },
  "narrativeDraftText": "...",
  "missingHighRisk": [{ "field": "...", "reason": "..." }],
  "conflicts": [{ "field": "...", "existing": ..., "proposed": ... }],
  "warnings": ["..."]
}

For structuredDataPatch, only include fields that have actual values from the summary.
For conflicts, flag any fields where the proposed value differs from the existing non-empty value.
For missingHighRisk, list any required safety fields not provided in the summary.`;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export function buildClinicalDraftPrompt(
  templateType: string,
  currentStructured: Record<string, unknown>,
  currentNarrative: string,
  userSummary: string
): { system: string; user: string } {
  const systemBase = SYSTEM_PROMPTS[templateType] ?? ESTHETICS_RULES;

  const system = systemBase + JSON_OUTPUT_INSTRUCTION;

  const user = `CURRENT STRUCTURED DATA:
${JSON.stringify(currentStructured, null, 2)}

CURRENT NARRATIVE:
${currentNarrative || "(empty)"}

PROVIDER'S SUMMARY:
${userSummary}`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// OpenAI call
// ---------------------------------------------------------------------------

export async function generateClinicalDraft(opts: {
  templateType: string;
  currentStructured: Record<string, unknown>;
  currentNarrative: string;
  userSummary: string;
}): Promise<AiDraftResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return mockClinicalDraft(opts.templateType, opts.currentStructured, opts.userSummary);
  }

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey });

  const { system, user } = buildClinicalDraftPrompt(
    opts.templateType,
    opts.currentStructured,
    opts.currentNarrative,
    opts.userSummary
  );

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.3,
    max_tokens: 2048,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty AI response");
  }

  const parsed = JSON.parse(content) as AiDraftResult;
  return parsed;
}

// ---------------------------------------------------------------------------
// Transcription
// ---------------------------------------------------------------------------

export async function transcribeAudio(audioPath: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return mockTranscribeAudio();
  }

  const { default: OpenAI } = await import("openai");
  const { createReadStream } = await import("fs");
  const openai = new OpenAI({ apiKey });

  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: createReadStream(audioPath) as unknown as File,
    language: "en",
  });

  return response.text;
}

export function mockTranscribeAudio(): string {
  return "Botox 20 units forehead, 10 units glabella, lot number C5678, expiration 2027-08. Patient tolerated well, no immediate adverse reactions. Follow up in two weeks.";
}

// ---------------------------------------------------------------------------
// Mock clinical draft — smart parse for dev/test
// ---------------------------------------------------------------------------

export function mockClinicalDraft(
  templateType: string,
  currentStructured: Record<string, unknown>,
  userSummary: string
): AiDraftResult {
  const summary = userSummary.toLowerCase();

  switch (templateType) {
    case "Injectable":
      return mockInjectableDraft(summary, userSummary, currentStructured);
    case "Laser":
      return mockLaserDraft(summary, userSummary, currentStructured);
    case "Esthetics":
      return mockEstheticsDraft(summary, userSummary, currentStructured);
    default:
      return {
        structuredDataPatch: {},
        narrativeDraftText: userSummary,
        missingHighRisk: [],
        conflicts: [],
        warnings: [],
      };
  }
}

function mockInjectableDraft(
  lc: string,
  original: string,
  current: Record<string, unknown>
): AiDraftResult {
  const patch: Partial<InjectableData> = {};

  // Product name
  const products = ["botox", "dysport", "xeomin", "juvederm", "restylane", "sculptra", "radiesse"];
  for (const p of products) {
    if (lc.includes(p)) {
      patch.productName = p.charAt(0).toUpperCase() + p.slice(1);
      break;
    }
  }

  // Areas with units: "20 units forehead" or "forehead 20u"
  const areaMap: Record<string, string> = {
    forehead: "Forehead",
    glabella: "Glabella",
    "crow": "Crow's Feet",
    lips: "Lips",
    cheeks: "Cheeks",
    chin: "Chin",
    jawline: "Jawline",
    "nasolabial": "Nasolabial Folds",
    "marionette": "Marionette Lines",
    perioral: "Perioral",
    temples: "Temples",
    "under eye": "Under Eye",
    "tear trough": "Tear Trough",
  };

  const areas: Array<{ areaLabel: string; units: number }> = [];

  // Pattern: "N units AREA" or "AREA N units" or "Nu AREA" or "AREA Nu"
  const unitPatterns = [
    /(\d+)\s*(?:units?|u)\s+(?:of\s+)?(\w[\w\s]*?)(?:,|;|\.|and\s|$)/gi,
    /([\w\s]+?)\s+(\d+)\s*(?:units?|u)(?:,|;|\.|and\s|$)/gi,
  ];

  for (const pattern of unitPatterns) {
    let match;
    while ((match = pattern.exec(lc)) !== null) {
      const [, g1, g2] = match;
      // Determine which group is units and which is area
      const num1 = parseInt(g1);
      const num2 = parseInt(g2);
      let units: number;
      let areaRaw: string;
      if (!isNaN(num1) && isNaN(num2)) {
        units = num1;
        areaRaw = g2.trim();
      } else if (isNaN(num1) && !isNaN(num2)) {
        units = num2;
        areaRaw = g1.trim();
      } else {
        continue;
      }

      // Match area to known areas
      let areaLabel = areaRaw.charAt(0).toUpperCase() + areaRaw.slice(1);
      for (const [key, label] of Object.entries(areaMap)) {
        if (areaRaw.includes(key)) {
          areaLabel = label;
          break;
        }
      }

      if (!areas.some((a) => a.areaLabel === areaLabel)) {
        areas.push({ areaLabel, units });
      }
    }
  }

  if (areas.length > 0) {
    patch.areas = areas;
    patch.totalUnits = areas.reduce((sum, a) => sum + a.units, 0);
  }

  // Lot number: "lot C1234" or "lot #C1234" — match against original to preserve case
  const lotMatch = original.match(/lot\s*#?\s*([A-Za-z0-9]+)/i);
  const expMatch = original.match(/exp(?:iration)?\s*(?:date)?\s*:?\s*([\d]{4}-[\d]{2}(?:-[\d]{2})?)/i);
  if (lotMatch || expMatch) {
    patch.lotEntries = [{
      lotNumber: lotMatch?.[1] ?? "",
      expirationDate: expMatch?.[1] ?? "",
    }];
  }

  // Build narrative
  const parts: string[] = [];
  if (patch.productName) parts.push(`${patch.productName} was administered`);
  if (patch.areas && patch.areas.length > 0) {
    const areaDesc = patch.areas.map((a) => `${a.units} units to the ${a.areaLabel}`).join(", ");
    parts.push(parts.length > 0 ? `with ${areaDesc}` : `Treatment administered: ${areaDesc}`);
  }
  if (patch.totalUnits) parts.push(`Total: ${patch.totalUnits} units`);
  if (patch.lotEntries?.[0]?.lotNumber) {
    const lot = patch.lotEntries[0];
    parts.push(`Lot: ${lot.lotNumber}${lot.expirationDate ? `, Exp: ${lot.expirationDate}` : ""}`);
  }
  const narrativeDraftText = parts.length > 0
    ? parts.join(". ") + ". Patient tolerated the procedure well."
    : original;

  // Compute conflicts
  const conflicts = computeConflicts(current, patch as Record<string, unknown>);

  // Compute missing high-risk using validation
  const mergedForValidation = { ...parseStructuredData<Record<string, unknown>>("Injectable", JSON.stringify(current)), ...patch };
  const validation = validateTreatmentCard("Injectable", JSON.stringify(mergedForValidation));
  const missingHighRisk = validation.missingHighRiskFields.map((f) => ({
    field: f,
    reason: `Required for sign-off`,
  }));

  return {
    structuredDataPatch: patch as Record<string, unknown>,
    narrativeDraftText,
    missingHighRisk,
    conflicts,
    warnings: validation.warnings,
  };
}

function mockLaserDraft(
  lc: string,
  original: string,
  current: Record<string, unknown>
): AiDraftResult {
  const patch: Partial<LaserData> = {};

  // Device names
  const devices = ["candela", "lumenis", "ipl", "gentlemax", "picosure", "fraxel", "halo", "bbl"];
  for (const d of devices) {
    if (lc.includes(d)) {
      patch.deviceName = d === "ipl" ? "IPL" : d === "bbl" ? "BBL" : d.charAt(0).toUpperCase() + d.slice(1);
      break;
    }
  }

  // Areas
  const laserAreas = ["face", "neck", "chest", "hands", "legs", "arms", "back", "abdomen", "bikini", "underarms"];
  const found: string[] = [];
  for (const a of laserAreas) {
    if (lc.includes(a)) found.push(a.charAt(0).toUpperCase() + a.slice(1));
  }
  if (found.length > 0) patch.areasTreated = found;

  // Energy
  const energyMatch = original.match(/([\d.]+)\s*(mJ|J|W)/i);
  const passMatch = original.match(/(\d+)\s*pass(?:es)?/i);
  if (energyMatch || passMatch) {
    patch.parameters = {
      energy: energyMatch ? `${energyMatch[1]} ${energyMatch[2]}` : "",
      passes: passMatch ? parseInt(passMatch[1]) : 0,
    };
  }

  const parts: string[] = [];
  if (patch.deviceName) parts.push(`${patch.deviceName} laser treatment performed`);
  if (patch.areasTreated?.length) parts.push(`on ${patch.areasTreated.join(", ")}`);
  if (patch.parameters?.energy) parts.push(`at ${patch.parameters.energy}`);
  if (patch.parameters?.passes) parts.push(`${patch.parameters.passes} passes`);
  const narrativeDraftText = parts.length > 0
    ? parts.join(", ") + ". Patient tolerated the procedure well."
    : original;

  const conflicts = computeConflicts(current, patch as Record<string, unknown>);
  const mergedForValidation = { ...parseStructuredData<Record<string, unknown>>("Laser", JSON.stringify(current)), ...patch };
  const validation = validateTreatmentCard("Laser", JSON.stringify(mergedForValidation));

  return {
    structuredDataPatch: patch as Record<string, unknown>,
    narrativeDraftText,
    missingHighRisk: validation.missingHighRiskFields.map((f) => ({ field: f, reason: "Required for sign-off" })),
    conflicts,
    warnings: validation.warnings,
  };
}

function mockEstheticsDraft(
  lc: string,
  original: string,
  current: Record<string, unknown>
): AiDraftResult {
  const patch: Partial<EstheticsData> = {};

  const esthAreas = ["face", "neck", "décolletage", "back", "hands"];
  const found: string[] = [];
  for (const a of esthAreas) {
    if (lc.includes(a)) found.push(a.charAt(0).toUpperCase() + a.slice(1));
  }
  if (found.length > 0) patch.areasTreated = found.join(", ");

  // Products
  const esthProducts = ["glycolic", "salicylic", "lactic", "retinol", "vitamin c", "hyaluronic", "peel", "microdermabrasion"];
  const foundProducts: string[] = [];
  for (const p of esthProducts) {
    if (lc.includes(p)) foundProducts.push(p.charAt(0).toUpperCase() + p.slice(1));
  }
  if (foundProducts.length > 0) patch.productsUsed = foundProducts.join(", ");

  const narrativeDraftText = original
    ? `Esthetics treatment performed. ${original}`
    : "Esthetics treatment performed.";

  const conflicts = computeConflicts(current, patch as Record<string, unknown>);

  return {
    structuredDataPatch: patch as Record<string, unknown>,
    narrativeDraftText,
    missingHighRisk: [],
    conflicts,
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// Patch logic
// ---------------------------------------------------------------------------

export function applyStructuredPatch(
  currentData: Record<string, unknown>,
  patch: Record<string, unknown>
): PatchResult {
  const merged = { ...currentData };
  const conflicts: Array<{ field: string; existing: unknown; proposed: unknown }> = [];

  for (const [key, proposedValue] of Object.entries(patch)) {
    if (proposedValue === undefined || proposedValue === null) continue;

    const existing = merged[key];

    if (isEmptyValue(existing)) {
      // Empty field — apply patch
      merged[key] = proposedValue;
    } else {
      // Non-empty field — keep existing, record conflict
      conflicts.push({ field: key, existing, proposed: proposedValue });
    }
  }

  return { merged, conflicts };
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value === "number" && value === 0) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return Object.values(value).every(isEmptyValue);
  }
  return false;
}

function computeConflicts(
  current: Record<string, unknown>,
  patch: Record<string, unknown>
): Array<{ field: string; existing: unknown; proposed: unknown }> {
  const conflicts: Array<{ field: string; existing: unknown; proposed: unknown }> = [];
  for (const [key, proposed] of Object.entries(patch)) {
    const existing = current[key];
    if (!isEmptyValue(existing) && JSON.stringify(existing) !== JSON.stringify(proposed)) {
      conflicts.push({ field: key, existing, proposed });
    }
  }
  return conflicts;
}
