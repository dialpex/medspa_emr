/**
 * Template-specific structured data schemas for treatment cards.
 * Pure TypeScript — no Next.js deps.
 */

// ---------------------------------------------------------------------------
// Injectable
// ---------------------------------------------------------------------------
export interface InjectableData {
  productName: string;
  areas: Array<{ areaLabel: string; units: number }>;
  totalUnits: number;
  lotEntries: Array<{ lotNumber: string; expirationDate: string }>;
  outcome: string;
  followUpPlan: string;
  aftercare: string;
}

// ---------------------------------------------------------------------------
// Laser
// ---------------------------------------------------------------------------
export interface LaserData {
  deviceName: string;
  areasTreated: string[];
  parameters: { energy: string; pulseDuration?: string; passes: number };
  outcome: string;
  aftercare: string;
}

// ---------------------------------------------------------------------------
// Esthetics
// ---------------------------------------------------------------------------
export interface EstheticsData {
  areasTreated: string;
  productsUsed: string;
  skinResponse: string;
  outcome: string;
  aftercare: string;
}

// ---------------------------------------------------------------------------
// Defaults keyed by TreatmentCardType
// ---------------------------------------------------------------------------
export const DEFAULT_STRUCTURED_DATA: Record<string, unknown> = {
  Injectable: {
    productName: "",
    areas: [],
    totalUnits: 0,
    lotEntries: [],
    outcome: "",
    followUpPlan: "",
    aftercare: "",
  } satisfies InjectableData,

  Laser: {
    deviceName: "",
    areasTreated: [],
    parameters: { energy: "", passes: 0 },
    outcome: "",
    aftercare: "",
  } satisfies LaserData,

  Esthetics: {
    areasTreated: "",
    productsUsed: "",
    skinResponse: "",
    outcome: "",
    aftercare: "",
  } satisfies EstheticsData,

  Other: {},
};

// ---------------------------------------------------------------------------
// Parser — returns typed defaults when JSON is empty or invalid
// ---------------------------------------------------------------------------
export function parseStructuredData<T = unknown>(
  templateType: string,
  rawJson: string
): T {
  const defaults = DEFAULT_STRUCTURED_DATA[templateType] ?? {};

  if (!rawJson || rawJson === "{}" || rawJson.trim() === "") {
    return { ...defaults } as T;
  }

  try {
    const parsed = JSON.parse(rawJson);
    // Merge with defaults so missing keys get filled in
    return { ...defaults, ...parsed } as T;
  } catch {
    return { ...defaults } as T;
  }
}
