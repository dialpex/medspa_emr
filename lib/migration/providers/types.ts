// Migration Provider Interface — STRICTLY READ-ONLY
// No write/update/delete methods exist by design.
// Implementations must only use GET requests / read queries.

export interface MigrationCredentials {
  email?: string;
  password?: string;
  apiKey?: string;
  businessId?: string;
  [key: string]: string | undefined;
}

export type ProviderStrategy = "internal_api" | "browser_automation" | "csv_import";

export interface CredentialField {
  key: string;
  label: string;
  type: "text" | "password" | "email";
  required: boolean;
  placeholder?: string;
}

export interface ProviderInfo {
  source: string;
  displayName: string;
  description: string;
  strategy: ProviderStrategy;
  credentialFields: CredentialField[];
}

export interface ConnectionTestResult {
  connected: boolean;
  businessName?: string;
  errorMessage?: string;
}

// Normalized source records — each includes rawData for AI context

export interface SourcePatient {
  sourceId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  allergies?: string;
  medicalNotes?: string;
  tags?: string[];
  rawData: Record<string, unknown>;
}

export interface SourceService {
  sourceId: string;
  name: string;
  description?: string;
  duration?: number;
  price?: number;
  category?: string;
  isActive: boolean;
  rawData: Record<string, unknown>;
}

export interface SourceAppointment {
  sourceId: string;
  patientSourceId: string;
  providerName?: string;
  serviceSourceId?: string;
  serviceName?: string;
  startTime: string;
  endTime?: string;
  status: string;
  notes?: string;
  rawData: Record<string, unknown>;
}

export interface SourceInvoice {
  sourceId: string;
  patientSourceId: string;
  invoiceNumber?: string;
  status: string;
  total: number;
  subtotal?: number;
  taxAmount?: number;
  notes?: string;
  paidAt?: string;
  lineItems: Array<{
    description: string;
    serviceSourceId?: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  rawData: Record<string, unknown>;
}

export interface SourcePhoto {
  sourceId: string;
  patientSourceId: string;
  url: string;
  filename?: string;
  mimeType?: string;
  category?: string;
  caption?: string;
  rawData: Record<string, unknown>;
}

export interface SourceChart {
  sourceId: string;
  patientSourceId: string;
  appointmentSourceId?: string;
  date: string;
  providerName?: string;
  notes?: string;
  structuredData?: Record<string, unknown>;
  rawData: Record<string, unknown>;
}

export interface SourceDocument {
  sourceId: string;
  patientSourceId: string;
  url: string;
  filename: string;
  mimeType?: string;
  category?: string;
  rawData: Record<string, unknown>;
}

export interface FetchOptions {
  cursor?: string;
  limit?: number;
}

export interface FetchResult<T> {
  data: T[];
  nextCursor?: string;
  totalCount?: number;
}

/**
 * Migration Provider Interface — STRICTLY READ-ONLY
 *
 * All methods are read-only queries. No write/update/delete operations.
 * The source platform is treated as immutable.
 */
export interface MigrationProvider {
  readonly source: string;

  testConnection(credentials: MigrationCredentials): Promise<ConnectionTestResult>;

  fetchPatients(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourcePatient>>;

  fetchServices(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceService>>;

  fetchAppointments(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceAppointment>>;

  fetchInvoices(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceInvoice>>;

  fetchPhotos?(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourcePhoto>>;

  fetchCharts?(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceChart>>;

  fetchDocuments?(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceDocument>>;
}
