import type {
  MigrationProvider,
  MigrationCredentials,
  ConnectionTestResult,
  FetchOptions,
  FetchResult,
  SourcePatient,
  SourceService,
  SourceAppointment,
  SourceInvoice,
  SourcePhoto,
  SourceChart,
  SourceDocument,
} from "./types";

const MOCK_PATIENTS: SourcePatient[] = [
  {
    sourceId: "mock-p-1",
    firstName: "Sarah",
    lastName: "Johnson",
    email: "sarah.johnson@example.com",
    phone: "+15551234567",
    dateOfBirth: "1985-03-15",
    gender: "Female",
    address: "123 Main St",
    city: "Beverly Hills",
    state: "CA",
    zipCode: "90210",
    allergies: "Latex",
    rawData: { id: "mock-p-1", source: "mock" },
  },
  {
    sourceId: "mock-p-2",
    firstName: "Emily",
    lastName: "Chen",
    email: "emily.chen@example.com",
    phone: "+15559876543",
    dateOfBirth: "1992-07-22",
    gender: "Female",
    rawData: { id: "mock-p-2", source: "mock" },
  },
  {
    sourceId: "mock-p-3",
    firstName: "Michael",
    lastName: "Rivera",
    email: "m.rivera@example.com",
    phone: "+15555551234",
    dateOfBirth: "1978-11-08",
    gender: "Male",
    rawData: { id: "mock-p-3", source: "mock" },
  },
  {
    sourceId: "mock-p-4",
    firstName: "Sarah",
    lastName: "Johnson-Smith",
    email: "sarah.johnson@example.com", // Duplicate email with mock-p-1
    phone: "+15551234567",
    dateOfBirth: "1985-03-15",
    rawData: { id: "mock-p-4", source: "mock" },
  },
  {
    sourceId: "mock-p-5",
    firstName: "Jennifer",
    lastName: "Williams",
    // Missing email — data quality issue
    phone: "+15553334444",
    dateOfBirth: "1990-01-20",
    gender: "Female",
    rawData: { id: "mock-p-5", source: "mock" },
  },
];

const MOCK_SERVICES: SourceService[] = [
  {
    sourceId: "mock-s-1",
    name: "Botox - Forehead",
    description: "Botulinum toxin injection for forehead lines",
    duration: 30,
    price: 350,
    category: "Injectables",
    isActive: true,
    rawData: { id: "mock-s-1", source: "mock" },
  },
  {
    sourceId: "mock-s-2",
    name: "Botox - Glabella (20 units)",
    description: "Botulinum toxin for glabella lines, 20 units",
    duration: 15,
    price: 260,
    category: "Injectables",
    isActive: true,
    rawData: { id: "mock-s-2", source: "mock" },
  },
  {
    sourceId: "mock-s-3",
    name: "Juvederm Voluma - Cheeks",
    description: "Hyaluronic acid filler for cheek augmentation",
    duration: 45,
    price: 800,
    category: "Dermal Fillers",
    isActive: true,
    rawData: { id: "mock-s-3", source: "mock" },
  },
  {
    sourceId: "mock-s-4",
    name: "HydraFacial Platinum",
    description: "Premium HydraFacial with LED and lymphatic drainage",
    duration: 90,
    price: 350,
    category: "Facials",
    isActive: true,
    rawData: { id: "mock-s-4", source: "mock" },
  },
  {
    sourceId: "mock-s-5",
    name: "Lip Flip",
    description: "Botox lip flip for subtle upper lip enhancement",
    duration: 15,
    price: 150,
    category: "Injectables",
    isActive: true,
    rawData: { id: "mock-s-5", source: "mock" },
  },
  {
    sourceId: "mock-s-6",
    name: "Consultation - New Patient",
    description: "Initial consultation for new patients",
    duration: 30,
    price: 0,
    category: "Consultations",
    isActive: true,
    rawData: { id: "mock-s-6", source: "mock" },
  },
  {
    sourceId: "mock-s-7",
    name: "New Patient Consult",
    description: "New patient consultation", // Duplicate of mock-s-6
    duration: 30,
    price: 0,
    category: "Consultations",
    isActive: false,
    rawData: { id: "mock-s-7", source: "mock" },
  },
];

const MOCK_APPOINTMENTS: SourceAppointment[] = [
  {
    sourceId: "mock-a-1",
    patientSourceId: "mock-p-1",
    providerName: "Dr. Kim",
    serviceSourceId: "mock-s-1",
    serviceName: "Botox - Forehead",
    startTime: "2025-06-15T10:00:00Z",
    endTime: "2025-06-15T10:30:00Z",
    status: "completed",
    notes: "Patient tolerated well. Follow-up in 3 months.",
    rawData: { id: "mock-a-1", source: "mock" },
  },
  {
    sourceId: "mock-a-2",
    patientSourceId: "mock-p-2",
    providerName: "Dr. Kim",
    serviceSourceId: "mock-s-3",
    serviceName: "Juvederm Voluma - Cheeks",
    startTime: "2025-07-01T14:00:00Z",
    endTime: "2025-07-01T14:45:00Z",
    status: "completed",
    rawData: { id: "mock-a-2", source: "mock" },
  },
  {
    sourceId: "mock-a-3",
    patientSourceId: "mock-p-3",
    providerName: "Dr. Patel",
    serviceSourceId: "mock-s-4",
    serviceName: "HydraFacial Platinum",
    startTime: "2025-08-10T09:00:00Z",
    endTime: "2025-08-10T10:30:00Z",
    status: "completed",
    rawData: { id: "mock-a-3", source: "mock" },
  },
  {
    sourceId: "mock-a-4",
    patientSourceId: "mock-p-1",
    providerName: "Dr. Unknown",
    serviceSourceId: "mock-s-99", // References non-existent service
    serviceName: "Laser Hair Removal",
    startTime: "2025-09-05T11:00:00Z",
    endTime: "2025-09-05T12:00:00Z",
    status: "no-show",
    rawData: { id: "mock-a-4", source: "mock" },
  },
];

const MOCK_INVOICES: SourceInvoice[] = [
  {
    sourceId: "mock-inv-1",
    patientSourceId: "mock-p-1",
    invoiceNumber: "INV-001",
    status: "paid",
    total: 350,
    subtotal: 350,
    taxAmount: 0,
    paidAt: "2025-06-15T11:00:00Z",
    lineItems: [
      {
        description: "Botox - Forehead",
        serviceSourceId: "mock-s-1",
        quantity: 1,
        unitPrice: 350,
        total: 350,
      },
    ],
    rawData: { id: "mock-inv-1", source: "mock" },
  },
  {
    sourceId: "mock-inv-2",
    patientSourceId: "mock-p-2",
    invoiceNumber: "INV-002",
    status: "paid",
    total: 800,
    subtotal: 800,
    taxAmount: 0,
    paidAt: "2025-07-01T15:00:00Z",
    lineItems: [
      {
        description: "Juvederm Voluma - Cheeks",
        serviceSourceId: "mock-s-3",
        quantity: 1,
        unitPrice: 800,
        total: 800,
      },
    ],
    rawData: { id: "mock-inv-2", source: "mock" },
  },
];

const MOCK_PHOTOS: SourcePhoto[] = [
  {
    sourceId: "mock-photo-1",
    patientSourceId: "mock-p-1",
    url: "https://example.com/photos/patient1-before.jpg",
    filename: "patient1-before.jpg",
    mimeType: "image/jpeg",
    category: "before",
    caption: "Before treatment - frontal view",
    rawData: { id: "mock-photo-1", source: "mock" },
  },
  {
    sourceId: "mock-photo-2",
    patientSourceId: "mock-p-1",
    url: "https://example.com/photos/patient1-after.jpg",
    filename: "patient1-after.jpg",
    mimeType: "image/jpeg",
    category: "after",
    caption: "After treatment - frontal view",
    rawData: { id: "mock-photo-2", source: "mock" },
  },
];

const MOCK_CHARTS: SourceChart[] = [
  {
    sourceId: "mock-chart-1",
    patientSourceId: "mock-p-1",
    appointmentSourceId: "mock-a-1",
    date: "2025-06-15",
    providerName: "Dr. Kim",
    notes: "Botox 20 units to forehead. Patient tolerated well. No complications. Follow-up in 3 months for re-evaluation.",
    structuredData: {
      treatment: "Botox",
      area: "Forehead",
      units: 20,
      complications: "None",
    },
    rawData: { id: "mock-chart-1", source: "mock" },
  },
  {
    sourceId: "mock-chart-2",
    patientSourceId: "mock-p-2",
    appointmentSourceId: "mock-a-2",
    date: "2025-07-01",
    providerName: "Dr. Kim",
    notes: "Juvederm Voluma 1 syringe to each cheek. Mild swelling expected. Ice applied post-procedure.",
    structuredData: {
      treatment: "Juvederm Voluma",
      area: "Cheeks",
      syringes: 2,
      complications: "Mild swelling",
    },
    rawData: { id: "mock-chart-2", source: "mock" },
  },
  {
    sourceId: "mock-chart-3",
    patientSourceId: "mock-p-3",
    appointmentSourceId: "mock-a-3",
    date: "2025-08-10",
    providerName: "Dr. Patel",
    notes: "HydraFacial Platinum with LED therapy and lymphatic drainage. Skin analysis shows improvement in hydration levels.",
    rawData: { id: "mock-chart-3", source: "mock" },
  },
];

const MOCK_DOCUMENTS: SourceDocument[] = [
  {
    sourceId: "mock-doc-1",
    patientSourceId: "mock-p-1",
    url: "https://example.com/docs/consent-botox-sarah.pdf",
    filename: "consent-botox-sarah.pdf",
    mimeType: "application/pdf",
    category: "consent",
    rawData: { id: "mock-doc-1", source: "mock" },
  },
  {
    sourceId: "mock-doc-2",
    patientSourceId: "mock-p-2",
    url: "https://example.com/docs/consent-filler-emily.pdf",
    filename: "consent-filler-emily.pdf",
    mimeType: "application/pdf",
    category: "consent",
    rawData: { id: "mock-doc-2", source: "mock" },
  },
  {
    sourceId: "mock-doc-3",
    patientSourceId: "mock-p-1",
    url: "https://example.com/docs/intake-sarah.pdf",
    filename: "intake-form-sarah.pdf",
    mimeType: "application/pdf",
    category: "intake",
    rawData: { id: "mock-doc-3", source: "mock" },
  },
];

export class MockMigrationProvider implements MigrationProvider {
  readonly source = "Mock";

  async testConnection(credentials: MigrationCredentials): Promise<ConnectionTestResult> {
    // Simulate connection delay
    await new Promise((r) => setTimeout(r, 500));

    // Support both email/password and legacy apiKey auth for backwards compat
    if (credentials.email && credentials.password) {
      if (credentials.password === "invalid") {
        return { connected: false, errorMessage: "Invalid credentials" };
      }
      return { connected: true, businessName: "Mock MedSpa Clinic" };
    }

    // Legacy apiKey check
    if (credentials.apiKey === "invalid") {
      return { connected: false, errorMessage: "Invalid API key" };
    }

    if (!credentials.email && !credentials.apiKey) {
      return { connected: false, errorMessage: "Email and password are required" };
    }

    return { connected: true, businessName: "Mock MedSpa Clinic" };
  }

  async fetchPatients(
    _credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourcePatient>> {
    await new Promise((r) => setTimeout(r, 300));
    const limit = options?.limit ?? 50;
    const startIndex = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const slice = MOCK_PATIENTS.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;

    return {
      data: slice,
      nextCursor: nextIndex < MOCK_PATIENTS.length ? String(nextIndex) : undefined,
      totalCount: MOCK_PATIENTS.length,
    };
  }

  async fetchServices(
    _credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceService>> {
    await new Promise((r) => setTimeout(r, 200));
    const limit = options?.limit ?? 50;
    const startIndex = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const slice = MOCK_SERVICES.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;

    return {
      data: slice,
      nextCursor: nextIndex < MOCK_SERVICES.length ? String(nextIndex) : undefined,
      totalCount: MOCK_SERVICES.length,
    };
  }

  async fetchAppointments(
    _credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceAppointment>> {
    await new Promise((r) => setTimeout(r, 300));
    const limit = options?.limit ?? 50;
    const startIndex = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const slice = MOCK_APPOINTMENTS.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;

    return {
      data: slice,
      nextCursor: nextIndex < MOCK_APPOINTMENTS.length ? String(nextIndex) : undefined,
      totalCount: MOCK_APPOINTMENTS.length,
    };
  }

  async fetchInvoices(
    _credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceInvoice>> {
    await new Promise((r) => setTimeout(r, 200));
    const limit = options?.limit ?? 50;
    const startIndex = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const slice = MOCK_INVOICES.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;

    return {
      data: slice,
      nextCursor: nextIndex < MOCK_INVOICES.length ? String(nextIndex) : undefined,
      totalCount: MOCK_INVOICES.length,
    };
  }

  async fetchPhotos(
    _credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourcePhoto>> {
    await new Promise((r) => setTimeout(r, 200));
    const limit = options?.limit ?? 50;
    const startIndex = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const slice = MOCK_PHOTOS.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;

    return {
      data: slice,
      nextCursor: nextIndex < MOCK_PHOTOS.length ? String(nextIndex) : undefined,
      totalCount: MOCK_PHOTOS.length,
    };
  }

  async fetchCharts(
    _credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceChart>> {
    await new Promise((r) => setTimeout(r, 250));
    const limit = options?.limit ?? 50;
    const startIndex = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const slice = MOCK_CHARTS.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;

    return {
      data: slice,
      nextCursor: nextIndex < MOCK_CHARTS.length ? String(nextIndex) : undefined,
      totalCount: MOCK_CHARTS.length,
    };
  }

  async fetchDocuments(
    _credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceDocument>> {
    await new Promise((r) => setTimeout(r, 200));
    const limit = options?.limit ?? 50;
    const startIndex = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const slice = MOCK_DOCUMENTS.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;

    return {
      data: slice,
      nextCursor: nextIndex < MOCK_DOCUMENTS.length ? String(nextIndex) : undefined,
      totalCount: MOCK_DOCUMENTS.length,
    };
  }
}
