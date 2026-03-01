// Canonical Clinical Model — V1
// These types represent the normalized intermediate format
// between any source EMR and Neuvvia's domain tables.

export interface CanonicalAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface CanonicalPatient {
  canonicalId: string;
  sourceRecordId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string; // ISO 8601
  gender?: string;
  address?: CanonicalAddress;
  allergies?: string;
  medicalNotes?: string;
  tags?: string[];
}

export interface CanonicalAppointment {
  canonicalId: string;
  sourceRecordId: string;
  canonicalPatientId: string;
  providerName: string;
  serviceName?: string;
  startTime: string; // ISO 8601
  endTime?: string;
  status: string;
  notes?: string;
}

export interface CanonicalChartSection {
  title: string;
  content: string;
  type?: string;
}

export interface CanonicalChart {
  canonicalId: string;
  sourceRecordId: string;
  canonicalPatientId: string;
  canonicalAppointmentId?: string;
  providerName: string;
  chiefComplaint?: string;
  sections: CanonicalChartSection[];
  signedAt?: string;
}

export interface CanonicalEncounter {
  canonicalId: string;
  sourceRecordId: string;
  canonicalPatientId: string;
  canonicalAppointmentId?: string;
  providerName: string;
  date: string;
  notes?: string;
  status: string;
}

export interface CanonicalConsent {
  canonicalId: string;
  sourceRecordId: string;
  canonicalPatientId: string;
  templateName: string;
  signedAt?: string;
  signedByName?: string;
  content?: string;
  status: string;
}

export interface CanonicalPhoto {
  canonicalId: string;
  sourceRecordId: string;
  canonicalPatientId: string;
  canonicalAppointmentId?: string;
  filename: string;
  mimeType?: string;
  category?: string;
  caption?: string;
  takenAt?: string;
  artifactKey: string; // reference to ArtifactStore binary
}

export interface CanonicalDocument {
  canonicalId: string;
  sourceRecordId: string;
  canonicalPatientId: string;
  filename: string;
  mimeType?: string;
  category?: string;
  artifactKey: string;
}

export interface CanonicalInvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  serviceSourceId?: string;
}

export interface CanonicalInvoice {
  canonicalId: string;
  sourceRecordId: string;
  canonicalPatientId: string;
  invoiceNumber?: string;
  status: string;
  total: number;
  subtotal?: number;
  taxAmount?: number;
  notes?: string;
  paidAt?: string;
  lineItems: CanonicalInvoiceLineItem[];
}

// Union of all canonical entity types
export type CanonicalRecord =
  | CanonicalPatient
  | CanonicalAppointment
  | CanonicalChart
  | CanonicalEncounter
  | CanonicalConsent
  | CanonicalPhoto
  | CanonicalDocument
  | CanonicalInvoice;

export type CanonicalEntityType =
  | "patient"
  | "appointment"
  | "chart"
  | "encounter"
  | "consent"
  | "photo"
  | "document"
  | "invoice";

// Canonical schema description for SafeContext (no PHI)
export interface CanonicalFieldDescription {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface CanonicalEntityDescription {
  entityType: CanonicalEntityType;
  fields: CanonicalFieldDescription[];
  relationships: Array<{
    field: string;
    targetEntity: CanonicalEntityType;
    required: boolean;
  }>;
}

export type CanonicalSchemaDescription = CanonicalEntityDescription[];

// Static description of canonical schema (safe for AI context)
export const CANONICAL_SCHEMA_DESCRIPTION: CanonicalSchemaDescription = [
  {
    entityType: "patient",
    fields: [
      { name: "canonicalId", type: "string", required: true },
      { name: "sourceRecordId", type: "string", required: true },
      { name: "firstName", type: "string", required: true },
      { name: "lastName", type: "string", required: true },
      { name: "email", type: "string", required: false },
      { name: "phone", type: "string", required: false },
      { name: "dateOfBirth", type: "date", required: false },
      { name: "gender", type: "string", required: false },
      { name: "address", type: "object", required: false },
      { name: "allergies", type: "string", required: false },
      { name: "medicalNotes", type: "string", required: false },
      { name: "tags", type: "string[]", required: false },
    ],
    relationships: [],
  },
  {
    entityType: "appointment",
    fields: [
      { name: "canonicalId", type: "string", required: true },
      { name: "sourceRecordId", type: "string", required: true },
      { name: "canonicalPatientId", type: "string", required: true },
      { name: "providerName", type: "string", required: true },
      { name: "serviceName", type: "string", required: false },
      { name: "startTime", type: "datetime", required: true },
      { name: "endTime", type: "datetime", required: false },
      { name: "status", type: "string", required: true },
      { name: "notes", type: "string", required: false },
    ],
    relationships: [
      { field: "canonicalPatientId", targetEntity: "patient", required: true },
    ],
  },
  {
    entityType: "chart",
    fields: [
      { name: "canonicalId", type: "string", required: true },
      { name: "sourceRecordId", type: "string", required: true },
      { name: "canonicalPatientId", type: "string", required: true },
      { name: "canonicalAppointmentId", type: "string", required: false },
      { name: "providerName", type: "string", required: true },
      { name: "chiefComplaint", type: "string", required: false },
      { name: "sections", type: "object[]", required: true },
      { name: "signedAt", type: "datetime", required: false },
    ],
    relationships: [
      { field: "canonicalPatientId", targetEntity: "patient", required: true },
      { field: "canonicalAppointmentId", targetEntity: "appointment", required: false },
    ],
  },
  {
    entityType: "encounter",
    fields: [
      { name: "canonicalId", type: "string", required: true },
      { name: "sourceRecordId", type: "string", required: true },
      { name: "canonicalPatientId", type: "string", required: true },
      { name: "canonicalAppointmentId", type: "string", required: false },
      { name: "providerName", type: "string", required: true },
      { name: "date", type: "date", required: true },
      { name: "notes", type: "string", required: false },
      { name: "status", type: "string", required: true },
    ],
    relationships: [
      { field: "canonicalPatientId", targetEntity: "patient", required: true },
      { field: "canonicalAppointmentId", targetEntity: "appointment", required: false },
    ],
  },
  {
    entityType: "consent",
    fields: [
      { name: "canonicalId", type: "string", required: true },
      { name: "sourceRecordId", type: "string", required: true },
      { name: "canonicalPatientId", type: "string", required: true },
      { name: "templateName", type: "string", required: true },
      { name: "signedAt", type: "datetime", required: false },
      { name: "signedByName", type: "string", required: false },
      { name: "content", type: "string", required: false },
      { name: "status", type: "string", required: true },
    ],
    relationships: [
      { field: "canonicalPatientId", targetEntity: "patient", required: true },
    ],
  },
  {
    entityType: "photo",
    fields: [
      { name: "canonicalId", type: "string", required: true },
      { name: "sourceRecordId", type: "string", required: true },
      { name: "canonicalPatientId", type: "string", required: true },
      { name: "canonicalAppointmentId", type: "string", required: false },
      { name: "filename", type: "string", required: true },
      { name: "mimeType", type: "string", required: false },
      { name: "category", type: "string", required: false },
      { name: "caption", type: "string", required: false },
      { name: "takenAt", type: "datetime", required: false },
      { name: "artifactKey", type: "string", required: true },
    ],
    relationships: [
      { field: "canonicalPatientId", targetEntity: "patient", required: true },
      { field: "canonicalAppointmentId", targetEntity: "appointment", required: false },
    ],
  },
  {
    entityType: "document",
    fields: [
      { name: "canonicalId", type: "string", required: true },
      { name: "sourceRecordId", type: "string", required: true },
      { name: "canonicalPatientId", type: "string", required: true },
      { name: "filename", type: "string", required: true },
      { name: "mimeType", type: "string", required: false },
      { name: "category", type: "string", required: false },
      { name: "artifactKey", type: "string", required: true },
    ],
    relationships: [
      { field: "canonicalPatientId", targetEntity: "patient", required: true },
    ],
  },
  {
    entityType: "invoice",
    fields: [
      { name: "canonicalId", type: "string", required: true },
      { name: "sourceRecordId", type: "string", required: true },
      { name: "canonicalPatientId", type: "string", required: true },
      { name: "invoiceNumber", type: "string", required: false },
      { name: "status", type: "string", required: true },
      { name: "total", type: "number", required: true },
      { name: "subtotal", type: "number", required: false },
      { name: "taxAmount", type: "number", required: false },
      { name: "notes", type: "string", required: false },
      { name: "paidAt", type: "datetime", required: false },
      { name: "lineItems", type: "object[]", required: true },
    ],
    relationships: [
      { field: "canonicalPatientId", targetEntity: "patient", required: true },
    ],
  },
];
