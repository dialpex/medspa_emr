import { describe, it, expect } from "vitest";
import { MockMigrationProvider } from "../lib/migration/providers/mock";

const provider = new MockMigrationProvider();
const credentials = { email: "admin@clinic.com", password: "test-password" };

describe("MockMigrationProvider", () => {
  it("returns connected for valid email/password credentials", async () => {
    const result = await provider.testConnection(credentials);
    expect(result.connected).toBe(true);
    expect(result.businessName).toBe("Mock MedSpa Clinic");
  });

  it("returns error for invalid password", async () => {
    const result = await provider.testConnection({ email: "admin@clinic.com", password: "invalid" });
    expect(result.connected).toBe(false);
    expect(result.errorMessage).toBe("Invalid credentials");
  });

  it("returns error when no credentials provided", async () => {
    const result = await provider.testConnection({});
    expect(result.connected).toBe(false);
    expect(result.errorMessage).toBe("Email and password are required");
  });

  it("still supports legacy apiKey credentials", async () => {
    const result = await provider.testConnection({ apiKey: "test-key" });
    expect(result.connected).toBe(true);
    expect(result.businessName).toBe("Mock MedSpa Clinic");
  });

  it("returns error for invalid legacy apiKey", async () => {
    const result = await provider.testConnection({ apiKey: "invalid" });
    expect(result.connected).toBe(false);
    expect(result.errorMessage).toBe("Invalid API key");
  });

  it("fetches patients with pagination", async () => {
    const first = await provider.fetchPatients(credentials, { limit: 2 });
    expect(first.data.length).toBe(2);
    expect(first.totalCount).toBe(5);
    expect(first.nextCursor).toBeDefined();

    const second = await provider.fetchPatients(credentials, {
      limit: 2,
      cursor: first.nextCursor,
    });
    expect(second.data.length).toBe(2);

    const third = await provider.fetchPatients(credentials, {
      limit: 2,
      cursor: second.nextCursor,
    });
    expect(third.data.length).toBe(1);
    expect(third.nextCursor).toBeUndefined();
  });

  it("fetches all patients at once", async () => {
    const result = await provider.fetchPatients(credentials);
    expect(result.data.length).toBe(5);
    expect(result.nextCursor).toBeUndefined();
  });

  it("patient records have required fields", async () => {
    const result = await provider.fetchPatients(credentials);
    for (const patient of result.data) {
      expect(patient.sourceId).toBeTruthy();
      expect(patient.firstName).toBeTruthy();
      expect(patient.lastName).toBeTruthy();
      expect(patient.rawData).toBeDefined();
    }
  });

  it("includes duplicate patient records for AI dedup testing", async () => {
    const result = await provider.fetchPatients(credentials);
    const emails = result.data.map((p) => p.email).filter(Boolean);
    const uniqueEmails = new Set(emails);
    // mock-p-1 and mock-p-4 share the same email
    expect(emails.length).toBeGreaterThan(uniqueEmails.size);
  });

  it("includes patient with missing email for data quality testing", async () => {
    const result = await provider.fetchPatients(credentials);
    const noEmail = result.data.filter((p) => !p.email);
    expect(noEmail.length).toBeGreaterThanOrEqual(1);
  });

  it("fetches services", async () => {
    const result = await provider.fetchServices(credentials);
    expect(result.data.length).toBe(7);
    for (const svc of result.data) {
      expect(svc.sourceId).toBeTruthy();
      expect(svc.name).toBeTruthy();
      expect(svc.rawData).toBeDefined();
    }
  });

  it("fetches appointments", async () => {
    const result = await provider.fetchAppointments(credentials);
    expect(result.data.length).toBe(4);
    for (const apt of result.data) {
      expect(apt.sourceId).toBeTruthy();
      expect(apt.patientSourceId).toBeTruthy();
      expect(apt.startTime).toBeTruthy();
      expect(apt.rawData).toBeDefined();
    }
  });

  it("fetches invoices", async () => {
    const result = await provider.fetchInvoices(credentials);
    expect(result.data.length).toBe(2);
    for (const inv of result.data) {
      expect(inv.sourceId).toBeTruthy();
      expect(inv.patientSourceId).toBeTruthy();
      expect(inv.lineItems.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("fetches forms", async () => {
    const result = await provider.fetchForms!(credentials);
    expect(result.data.length).toBe(5);
    for (const form of result.data) {
      expect(form.sourceId).toBeTruthy();
      expect(form.patientSourceId).toBeTruthy();
      expect(form.templateName).toBeTruthy();
      expect(form.rawData).toBeDefined();
    }
  });

  it("forms include submission metadata", async () => {
    const result = await provider.fetchForms!(credentials);
    const withSubmitter = result.data.filter((f) => f.submittedByName);
    expect(withSubmitter.length).toBe(5);
    const staffForms = result.data.filter((f) => f.submittedByRole === "staff");
    expect(staffForms.length).toBeGreaterThanOrEqual(1);
    const clientForms = result.data.filter((f) => f.submittedByRole === "client");
    expect(clientForms.length).toBeGreaterThanOrEqual(1);
  });

  it("forms include internal flag", async () => {
    const result = await provider.fetchForms!(credentials);
    const internalForms = result.data.filter((f) => f.isInternal);
    expect(internalForms.length).toBeGreaterThanOrEqual(1);
  });

  it("fetches photos", async () => {
    const result = await provider.fetchPhotos!(credentials);
    expect(result.data.length).toBe(2);
    for (const photo of result.data) {
      expect(photo.sourceId).toBeTruthy();
      expect(photo.url).toBeTruthy();
    }
  });

  it("fetches charts", async () => {
    const result = await provider.fetchCharts!(credentials);
    expect(result.data.length).toBe(3);
    for (const chart of result.data) {
      expect(chart.sourceId).toBeTruthy();
      expect(chart.patientSourceId).toBeTruthy();
      expect(chart.date).toBeTruthy();
      expect(chart.rawData).toBeDefined();
    }
  });

  it("chart records include clinical notes", async () => {
    const result = await provider.fetchCharts!(credentials);
    const withNotes = result.data.filter((c) => c.notes);
    expect(withNotes.length).toBe(3);
  });

  it("chart records link to appointments", async () => {
    const result = await provider.fetchCharts!(credentials);
    const withAppointment = result.data.filter((c) => c.appointmentSourceId);
    expect(withAppointment.length).toBe(3);
  });

  it("fetches documents", async () => {
    const result = await provider.fetchDocuments!(credentials);
    expect(result.data.length).toBe(3);
    for (const doc of result.data) {
      expect(doc.sourceId).toBeTruthy();
      expect(doc.patientSourceId).toBeTruthy();
      expect(doc.url).toBeTruthy();
      expect(doc.filename).toBeTruthy();
      expect(doc.rawData).toBeDefined();
    }
  });

  it("documents have category metadata", async () => {
    const result = await provider.fetchDocuments!(credentials);
    const categories = result.data.map((d) => d.category).filter(Boolean);
    expect(categories).toContain("consent");
    expect(categories).toContain("intake");
  });
});

describe("MigrationProvider interface compliance", () => {
  it("provider is read-only (no write methods)", () => {
    const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(provider));
    const writeMethods = proto.filter((m) =>
      /^(create|update|delete|write|put|post|patch|remove)/.test(m)
    );
    expect(writeMethods).toEqual([]);
  });

  it("has source identifier", () => {
    expect(provider.source).toBe("Mock");
  });
});
