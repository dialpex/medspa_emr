export type FieldType =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "number"
  | "json-areas"
  | "json-products";

export interface TemplateFieldConfig {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  defaultValue?: string;
  placeholder?: string;
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

export type Annotation = PointAnnotation | LineAnnotation | FreehandAnnotation;

export type AnnotationTool = "point" | "line" | "freehand";
