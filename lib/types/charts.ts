export type TemplateStatus = "Active" | "Draft" | "Archived";

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
