export type TemplateStatus = "Active" | "Draft" | "Archived";

export type FormSection = "header" | "body" | "footer";

export type FieldType =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "number"
  | "date"
  | "checklist"
  | "signature"
  | "photo-pair"
  | "photo-single"
  | "json-areas"
  | "json-products"
  | "heading"
  | "first-name"
  | "last-name"
  | "logo";

export interface TemplateFieldConfig {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  defaultValue?: string;
  placeholder?: string;
  /** For photo-pair: labels for before/after slots e.g. ["Before Photo", "After Photo"] */
  photoLabels?: [string, string];
  /** Width as percentage (1-100). Defaults to 100 (full row). */
  width?: number;
  /** Which form section this field belongs to. Defaults to "body". */
  section?: FormSection;
}

/**
 * Groups consecutive fields into visual rows based on cumulative widths.
 * - Headings always get their own row.
 * - When cumulative width reaches 100 or would overflow, close the row and start a new one.
 * - Fields without `width` default to 100 (full row).
 */
export function groupFieldsIntoRows(fields: TemplateFieldConfig[]): TemplateFieldConfig[][] {
  const rows: TemplateFieldConfig[][] = [];
  let currentRow: TemplateFieldConfig[] = [];
  let currentWidth = 0;

  for (const field of fields) {
    const w = field.width ?? 100;

    // Headings always get their own row
    if (field.type === "heading") {
      if (currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [];
        currentWidth = 0;
      }
      rows.push([field]);
      continue;
    }

    // Would overflow — close current row first
    if (currentWidth + w > 100 && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [];
      currentWidth = 0;
    }

    currentRow.push(field);
    currentWidth += w;

    // Exactly 100 — close row
    if (currentWidth >= 100) {
      rows.push(currentRow);
      currentRow = [];
      currentWidth = 0;
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Groups fields by their section property (header / body / footer).
 * Fields without a section default to "body".
 */
export function groupFieldsBySections(fields: TemplateFieldConfig[]) {
  return {
    header: fields.filter((f) => f.section === "header"),
    body: fields.filter((f) => !f.section || f.section === "body"),
    footer: fields.filter((f) => f.section === "footer"),
  };
}

export interface PointAnnotation {
  type: "point";
  id: string;
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  number: number;
  color: string;
  label?: string;
}

export interface LineAnnotation {
  type: "line";
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export interface FreehandAnnotation {
  type: "freehand";
  id: string;
  points: { x: number; y: number }[];
  color: string;
}

export interface ArrowAnnotation {
  type: "arrow";
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export interface RectAnnotation {
  type: "rect";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export interface TextAnnotation {
  type: "text";
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

export type Annotation =
  | PointAnnotation
  | LineAnnotation
  | FreehandAnnotation
  | ArrowAnnotation
  | RectAnnotation
  | TextAnnotation;

export type AnnotationTool = "point" | "line" | "freehand" | "arrow" | "rect" | "text";
