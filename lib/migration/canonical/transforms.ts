// Allowlisted Transform Functions
// Only these transforms can be used in MappingSpecs.
// No arbitrary code execution — this is the safety boundary.

export type AllowedTransform =
  | "normalizeDate"
  | "normalizePhone"
  | "normalizeEmail"
  | "trim"
  | "toUpper"
  | "toLower"
  | "mapEnum"
  | "splitName"
  | "concat"
  | "defaultValue"
  | "hashToken";

export interface TransformContext {
  enumMap?: Record<string, string>;
  defaultValue?: string;
  separator?: string;
  concatFields?: string[];
  nameComponent?: "first" | "last";
}

function normalizeDate(value: string): string {
  // Try parsing common date formats
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }

  // Try MM/DD/YYYY
  const parts = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (parts) {
    const month = parts[1].padStart(2, "0");
    const day = parts[2].padStart(2, "0");
    const year = parts[3].length === 2 ? `20${parts[3]}` : parts[3];
    return `${year}-${month}-${day}`;
  }

  return value;
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function splitName(value: string, component: "first" | "last"): string {
  const parts = value.trim().split(/\s+/);
  if (component === "first") return parts[0] || "";
  return parts.slice(1).join(" ") || "";
}

import { createHmac } from "crypto";

function hashToken(value: string): string {
  const secret = process.env.MIGRATION_MASKING_SECRET || "dev-secret";
  return createHmac("sha256", secret).update(value).digest("hex").substring(0, 16);
}

// Execute a single allowlisted transform
export function executeTransform(
  transform: AllowedTransform,
  value: string | null | undefined,
  context?: TransformContext
): string {
  if (value === null || value === undefined) {
    if (transform === "defaultValue" && context?.defaultValue !== undefined) {
      return context.defaultValue;
    }
    return "";
  }

  const v = String(value);

  switch (transform) {
    case "normalizeDate":
      return normalizeDate(v);
    case "normalizePhone":
      return normalizePhone(v);
    case "normalizeEmail":
      return normalizeEmail(v);
    case "trim":
      return v.trim();
    case "toUpper":
      return v.toUpperCase();
    case "toLower":
      return v.toLowerCase();
    case "mapEnum":
      return context?.enumMap?.[v] ?? v;
    case "splitName":
      return splitName(v, context?.nameComponent || "first");
    case "concat":
      // For concat, value is primary; additional fields provided via context
      return v;
    case "defaultValue":
      return v || context?.defaultValue || "";
    case "hashToken":
      return hashToken(v);
    default:
      return v;
  }
}

// Validate that a transform name is in the allowlist
export function isAllowedTransform(name: string): name is AllowedTransform {
  const ALLOWED: Set<string> = new Set([
    "normalizeDate", "normalizePhone", "normalizeEmail",
    "trim", "toUpper", "toLower",
    "mapEnum", "splitName", "concat",
    "defaultValue", "hashToken",
  ]);
  return ALLOWED.has(name);
}
