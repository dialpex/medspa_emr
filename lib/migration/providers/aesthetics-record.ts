/**
 * Aesthetics Record Migration Provider
 *
 * Fetches data from Aesthetics Record via their web app (no public API).
 * Uses session-based authentication with SMS/Email OTP support.
 *
 * Flow:
 *   1. testConnection() → POST login with email/password
 *   2. AR returns OTP challenge → we return { otpRequired: true, otpSessionToken }
 *   3. UI prompts user for OTP code
 *   4. submitOTP() → POST OTP code → session established
 *   5. All fetch* methods use the authenticated session cookies
 */

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
  SourceForm,
  SourceDocument,
  FormFieldContent,
  OTPCapableProvider,
} from "./types";

// --- Constants ---
const AR_BASE = "https://app.aestheticsrecord.com";
const AR_API_BASE = `${AR_BASE}/api`;
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// --- Helpers ---

function extractCookies(
  res: Response,
  existingCookies: string
): string {
  const cookieMap = new Map<string, string>();

  if (existingCookies) {
    for (const pair of existingCookies.split("; ")) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx > 0) {
        cookieMap.set(pair.substring(0, eqIdx), pair.substring(eqIdx + 1));
      }
    }
  }

  const setCookieHeaders = res.headers.getSetCookie?.() ?? [];
  for (const header of setCookieHeaders) {
    const nameValue = header.split(";")[0].trim();
    const eqIdx = nameValue.indexOf("=");
    if (eqIdx > 0) {
      cookieMap.set(nameValue.substring(0, eqIdx), nameValue.substring(eqIdx + 1));
    }
  }

  return Array.from(cookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function buildHeaders(cookies: string, extraHeaders?: Record<string, string>): Record<string, string> {
  return {
    "User-Agent": BROWSER_UA,
    "Accept": "application/json",
    "Content-Type": "application/json",
    ...(cookies ? { Cookie: cookies } : {}),
    ...extraHeaders,
  };
}

// --- Provider ---

export class AestheticsRecordProvider implements MigrationProvider, OTPCapableProvider {
  readonly source = "AestheticsRecord";
  readonly perPatientEntities = ["photos", "forms", "documents"];
  locationId?: string;

  // Session state — persisted across calls within a single migration run
  private sessionCookies = "";
  private authToken = "";
  private authenticated = false;
  private clinicId = "";
  private clinicName = "";

  // ========================================================
  // Authentication
  // ========================================================

  /**
   * Step 1: Test connection — initiates login, may return OTP challenge.
   */
  async testConnection(
    credentials: MigrationCredentials
  ): Promise<ConnectionTestResult> {
    try {
      // If we already have a valid session (e.g., OTP was already submitted), just validate it
      if (this.authenticated && this.authToken) {
        return this.validateSession();
      }

      // Attempt login
      const loginRes = await fetch(`${AR_API_BASE}/auth/login`, {
        method: "POST",
        headers: buildHeaders(""),
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
        redirect: "manual",
      });

      this.sessionCookies = extractCookies(loginRes, this.sessionCookies);

      const loginBody = await loginRes.json().catch(() => null);

      // Check if OTP is required
      if (
        loginRes.status === 200 &&
        loginBody &&
        (loginBody.otp_required || loginBody.mfa_required || loginBody.two_factor_required)
      ) {
        const sessionToken = loginBody.session_token || loginBody.token || loginBody.temp_token || "";
        const deliveryHint =
          loginBody.otp_delivery_hint ||
          loginBody.mfa_hint ||
          "your registered phone/email";

        return {
          connected: false,
          otpRequired: true,
          otpSessionToken: JSON.stringify({
            sessionToken,
            cookies: this.sessionCookies,
          }),
          otpDeliveryHint: `Code sent to ${deliveryHint}`,
        };
      }

      // Some platforms return 401/403 with an OTP challenge in the response body
      if (
        (loginRes.status === 401 || loginRes.status === 403) &&
        loginBody &&
        (loginBody.otp_required || loginBody.mfa_required || loginBody.requires_verification)
      ) {
        const sessionToken = loginBody.session_token || loginBody.token || loginBody.temp_token || "";
        return {
          connected: false,
          otpRequired: true,
          otpSessionToken: JSON.stringify({
            sessionToken,
            cookies: this.sessionCookies,
          }),
          otpDeliveryHint: loginBody.otp_delivery_hint || "your registered phone/email",
        };
      }

      // Login failed
      if (!loginRes.ok && !loginBody?.token) {
        return {
          connected: false,
          errorMessage:
            loginBody?.message ||
            loginBody?.error ||
            `Login failed (HTTP ${loginRes.status})`,
        };
      }

      // Direct login success (no OTP required)
      if (loginBody?.token || loginBody?.access_token) {
        this.authToken = loginBody.token || loginBody.access_token;
        this.authenticated = true;
        return this.validateSession();
      }

      // Fallback — check cookies for session
      if (this.sessionCookies) {
        this.authenticated = true;
        return this.validateSession();
      }

      return {
        connected: false,
        errorMessage: "Unexpected login response",
      };
    } catch (error) {
      return {
        connected: false,
        errorMessage: `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Step 2: Submit OTP code to complete authentication.
   */
  async submitOTP(
    credentials: MigrationCredentials,
    otpCode: string,
    sessionToken: string
  ): Promise<ConnectionTestResult> {
    try {
      const parsed = JSON.parse(sessionToken);
      this.sessionCookies = parsed.cookies || "";
      const tempToken = parsed.sessionToken || "";

      const otpRes = await fetch(`${AR_API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: buildHeaders(this.sessionCookies, {
          ...(tempToken ? { Authorization: `Bearer ${tempToken}` } : {}),
        }),
        body: JSON.stringify({
          otp: otpCode,
          code: otpCode,
          verification_code: otpCode,
          session_token: tempToken,
          email: credentials.email,
        }),
        redirect: "manual",
      });

      this.sessionCookies = extractCookies(otpRes, this.sessionCookies);
      const otpBody = await otpRes.json().catch(() => null);

      if (!otpRes.ok && !otpBody?.token) {
        return {
          connected: false,
          errorMessage:
            otpBody?.message ||
            otpBody?.error ||
            `OTP verification failed (HTTP ${otpRes.status})`,
        };
      }

      if (otpBody?.token || otpBody?.access_token) {
        this.authToken = otpBody.token || otpBody.access_token;
      }

      this.authenticated = true;
      return this.validateSession();
    } catch (error) {
      return {
        connected: false,
        errorMessage: `OTP verification failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Validate the current session by fetching clinic/account info.
   */
  private async validateSession(): Promise<ConnectionTestResult> {
    try {
      // Try common endpoints for account/clinic info
      const endpoints = [
        "/account/profile",
        "/clinic/info",
        "/user/me",
        "/account",
        "/clinics",
      ];

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(`${AR_API_BASE}${endpoint}`, {
            headers: this.buildAuthHeaders(),
          });
          if (res.ok) {
            const data = await res.json();
            this.clinicName =
              data.clinic_name ||
              data.business_name ||
              data.name ||
              data.clinic?.name ||
              data.data?.clinic_name ||
              "Aesthetics Record Clinic";
            this.clinicId =
              data.clinic_id ||
              data.id ||
              data.clinic?.id ||
              data.data?.id ||
              "";
            if (this.clinicId) {
              this.locationId = this.clinicId;
            }
            return {
              connected: true,
              businessName: this.clinicName,
              locationId: this.clinicId || undefined,
            };
          }
        } catch {
          continue;
        }
      }

      // Even if we can't find the account endpoint, if we have auth, consider connected
      if (this.authenticated) {
        return {
          connected: true,
          businessName: "Aesthetics Record",
        };
      }

      return {
        connected: false,
        errorMessage: "Session validation failed — could not verify account",
      };
    } catch (error) {
      return {
        connected: false,
        errorMessage: `Session validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private buildAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent": BROWSER_UA,
      Accept: "application/json",
    };
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }
    if (this.sessionCookies) {
      headers["Cookie"] = this.sessionCookies;
    }
    return headers;
  }

  /**
   * Make an authenticated API request. Re-throws on auth failure.
   */
  private async apiGet<T = unknown>(path: string): Promise<T> {
    const res = await fetch(`${AR_API_BASE}${path}`, {
      headers: this.buildAuthHeaders(),
    });

    if (res.status === 401 || res.status === 403) {
      this.authenticated = false;
      throw new Error("Session expired — re-authentication required");
    }

    if (!res.ok) {
      throw new Error(`API request failed: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }

  // ========================================================
  // Data Fetching
  // ========================================================

  async fetchPatients(
    _credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourcePatient>> {
    this.ensureAuthenticated();
    const page = options?.cursor ? parseInt(options.cursor, 10) : 1;
    const limit = options?.limit || 50;

    try {
      // Try common AR patient/client endpoints
      const data = await this.apiGet<Record<string, unknown>>(
        `/patients?page=${page}&per_page=${limit}`
      );

      const records = (data.data || data.patients || data.clients || []) as Array<Record<string, unknown>>;
      const total = (data.total || (data.meta as Record<string, unknown>)?.total || 0) as number;

      const patients: SourcePatient[] = records.map((r) => ({
        sourceId: String(r.id || r.patient_id || r.client_id || ""),
        firstName: String(r.first_name || r.firstname || ""),
        lastName: String(r.last_name || r.lastname || ""),
        email: (r.email as string) || undefined,
        phone: (r.phone || r.phone_number || r.mobile) as string | undefined,
        dateOfBirth: (r.date_of_birth || r.dob || r.birthday) as string | undefined,
        gender: (r.gender || r.sex) as string | undefined,
        address: (r.address || r.street_address || r.address_line_1) as string | undefined,
        city: (r.city) as string | undefined,
        state: (r.state || r.province) as string | undefined,
        zipCode: (r.zip || r.zip_code || r.postal_code) as string | undefined,
        allergies: (r.allergies) as string | undefined,
        medicalNotes: (r.medical_notes || r.notes || r.medical_history) as string | undefined,
        tags: Array.isArray(r.tags)
          ? r.tags.map((t: unknown) => (typeof t === "string" ? t : (t as Record<string, string>).name || String(t)))
          : undefined,
        rawData: r,
      }));

      const hasMore = records.length >= limit;
      return {
        data: patients,
        nextCursor: hasMore ? String(page + 1) : undefined,
        totalCount: total || undefined,
      };
    } catch (error) {
      console.error("[AR] fetchPatients error:", error);
      return { data: [] };
    }
  }

  async fetchServices(
    _credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceService>> {
    this.ensureAuthenticated();

    try {
      const data = await this.apiGet<Record<string, unknown>>(
        `/services?page=${options?.cursor || "1"}&per_page=${options?.limit || 100}`
      );

      const records = (data.data || data.services || []) as Array<Record<string, unknown>>;

      const services: SourceService[] = records.map((r) => ({
        sourceId: String(r.id || r.service_id || ""),
        name: String(r.name || r.title || r.service_name || ""),
        description: (r.description || r.details) as string | undefined,
        duration: (r.duration || r.duration_minutes) as number | undefined,
        price: (r.price || r.cost || r.base_price) as number | undefined,
        category: (r.category || r.category_name || r.type) as string | undefined,
        isActive: r.is_active !== false && r.active !== false && r.status !== "inactive",
        rawData: r,
      }));

      return { data: services };
    } catch (error) {
      console.error("[AR] fetchServices error:", error);
      return { data: [] };
    }
  }

  async fetchAppointments(
    _credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceAppointment>> {
    this.ensureAuthenticated();
    const page = options?.cursor ? parseInt(options.cursor, 10) : 1;
    const limit = options?.limit || 50;

    try {
      const data = await this.apiGet<Record<string, unknown>>(
        `/appointments?page=${page}&per_page=${limit}&start_date=2020-01-01`
      );

      const records = (data.data || data.appointments || []) as Array<Record<string, unknown>>;

      const appointments: SourceAppointment[] = records.map((r) => {
        const patient = r.patient || r.client;
        const patientId =
          (r.patient_id || r.client_id || (patient as Record<string, unknown>)?.id || "") as string;

        return {
          sourceId: String(r.id || r.appointment_id || ""),
          patientSourceId: String(patientId),
          providerName: (r.provider_name || r.practitioner_name || r.staff_name ||
            (r.provider as Record<string, unknown>)?.name ||
            (r.practitioner as Record<string, unknown>)?.name) as string | undefined,
          serviceSourceId: (r.service_id) as string | undefined,
          serviceName: (r.service_name || r.treatment_name ||
            (r.service as Record<string, unknown>)?.name) as string | undefined,
          startTime: String(r.start_time || r.starts_at || r.start_date || r.date || ""),
          endTime: (r.end_time || r.ends_at || r.end_date) as string | undefined,
          status: String(r.status || "scheduled"),
          notes: (r.notes || r.comments) as string | undefined,
          rawData: r,
        };
      });

      const hasMore = records.length >= limit;
      return {
        data: appointments,
        nextCursor: hasMore ? String(page + 1) : undefined,
      };
    } catch (error) {
      console.error("[AR] fetchAppointments error:", error);
      return { data: [] };
    }
  }

  async fetchInvoices(
    _credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceInvoice>> {
    this.ensureAuthenticated();
    const page = options?.cursor ? parseInt(options.cursor, 10) : 1;
    const limit = options?.limit || 50;

    try {
      const data = await this.apiGet<Record<string, unknown>>(
        `/invoices?page=${page}&per_page=${limit}`
      );

      const records = (data.data || data.invoices || []) as Array<Record<string, unknown>>;

      const invoices: SourceInvoice[] = records.map((r) => {
        const items = (r.line_items || r.items || r.invoice_items || []) as Array<Record<string, unknown>>;
        return {
          sourceId: String(r.id || r.invoice_id || ""),
          patientSourceId: String(r.patient_id || r.client_id || ""),
          invoiceNumber: (r.invoice_number || r.number) as string | undefined,
          status: String(r.status || "completed"),
          total: Number(r.total || r.amount || 0),
          subtotal: (r.subtotal || r.sub_total) as number | undefined,
          taxAmount: (r.tax || r.tax_amount) as number | undefined,
          paidAt: (r.paid_at || r.payment_date) as string | undefined,
          lineItems: items.map((item) => ({
            description: String(item.description || item.name || item.service_name || ""),
            serviceSourceId: (item.service_id) as string | undefined,
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unit_price || item.price || 0),
            total: Number(item.total || item.amount || 0),
          })),
          rawData: r,
        };
      });

      const hasMore = records.length >= limit;
      return {
        data: invoices,
        nextCursor: hasMore ? String(page + 1) : undefined,
      };
    } catch (error) {
      console.error("[AR] fetchInvoices error:", error);
      return { data: [] };
    }
  }

  async fetchPhotos(
    _credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourcePhoto>> {
    this.ensureAuthenticated();
    const patientId = options?.cursor;
    if (!patientId) return { data: [] };

    try {
      const data = await this.apiGet<Record<string, unknown>>(
        `/patients/${patientId}/photos`
      );

      const records = (data.data || data.photos || []) as Array<Record<string, unknown>>;

      const photos: SourcePhoto[] = records.map((r) => ({
        sourceId: String(r.id || r.photo_id || ""),
        patientSourceId: patientId,
        url: String(r.url || r.image_url || r.file_url || r.src || ""),
        filename: (r.filename || r.file_name || r.name) as string | undefined,
        mimeType: (r.mime_type || r.content_type) as string | undefined,
        category: (r.category || r.type || r.label) as string | undefined,
        caption: (r.caption || r.description || r.notes) as string | undefined,
        label: (r.label || r.tag) as string | undefined,
        appointmentSourceId: (r.appointment_id) as string | undefined,
        takenAt: (r.taken_at || r.created_at || r.date) as string | undefined,
        rawData: r,
      }));

      return { data: photos };
    } catch (error) {
      console.error("[AR] fetchPhotos error:", error);
      return { data: [] };
    }
  }

  async fetchForms(
    _credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceForm>> {
    this.ensureAuthenticated();
    const patientId = options?.cursor;
    if (!patientId) return { data: [] };

    try {
      const data = await this.apiGet<Record<string, unknown>>(
        `/patients/${patientId}/forms`
      );

      const records = (data.data || data.forms || data.consent_forms || []) as Array<Record<string, unknown>>;

      const forms: SourceForm[] = records.map((r) => {
        const fields = (r.fields || r.form_fields || r.answers || []) as Array<Record<string, unknown>>;
        return {
          sourceId: String(r.id || r.form_id || ""),
          patientSourceId: patientId,
          templateId: (r.template_id || r.form_template_id) as string | undefined,
          templateName: String(r.name || r.title || r.template_name || r.form_name || "Unknown Form"),
          status: (r.status) as string | undefined,
          isInternal: (r.is_internal || r.internal) as boolean | undefined,
          submittedAt: (r.submitted_at || r.completed_at || r.signed_at || r.created_at) as string | undefined,
          submittedByName: (r.submitted_by || r.signed_by) as string | undefined,
          submittedByRole: (r.submitted_by_role === "staff" ? "staff" : "client") as "staff" | "client" | undefined,
          appointmentSourceId: (r.appointment_id) as string | undefined,
          fields: fields.map((f) => this.parseFormField(f)),
          rawData: r,
        };
      });

      return { data: forms };
    } catch (error) {
      console.error("[AR] fetchForms error:", error);
      return { data: [] };
    }
  }

  async fetchFormContent(
    _credentials: MigrationCredentials,
    formSourceId: string
  ): Promise<FormFieldContent[]> {
    this.ensureAuthenticated();

    try {
      const data = await this.apiGet<Record<string, unknown>>(
        `/forms/${formSourceId}`
      );

      const fields = (data.fields || data.form_fields || data.answers ||
        (data.data as Record<string, unknown>)?.fields || []) as Array<Record<string, unknown>>;

      return fields.map((f) => this.parseFormField(f));
    } catch (error) {
      console.error("[AR] fetchFormContent error:", error);
      return [];
    }
  }

  async fetchDocuments(
    _credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceDocument>> {
    this.ensureAuthenticated();
    const patientId = options?.cursor?.split(":")[0];
    if (!patientId) return { data: [] };

    try {
      const data = await this.apiGet<Record<string, unknown>>(
        `/patients/${patientId}/documents`
      );

      const records = (data.data || data.documents || data.files || []) as Array<Record<string, unknown>>;

      const documents: SourceDocument[] = records.map((r) => ({
        sourceId: String(r.id || r.document_id || ""),
        patientSourceId: patientId,
        url: String(r.url || r.file_url || r.download_url || ""),
        filename: String(r.filename || r.file_name || r.name || "document"),
        mimeType: (r.mime_type || r.content_type) as string | undefined,
        category: (r.category || r.type) as string | undefined,
        rawData: r,
      }));

      return { data: documents };
    } catch (error) {
      console.error("[AR] fetchDocuments error:", error);
      return { data: [] };
    }
  }

  // ========================================================
  // Helpers
  // ========================================================

  private ensureAuthenticated(): void {
    if (!this.authenticated) {
      throw new Error(
        "Not authenticated — call testConnection() and submitOTP() first"
      );
    }
  }

  private parseFormField(f: Record<string, unknown>): FormFieldContent {
    const availableOptions = (f.options || f.choices || f.values || []) as Array<unknown>;

    return {
      fieldId: String(f.id || f.field_id || ""),
      label: String(f.label || f.name || f.question || f.title || ""),
      type: String(f.type || f.field_type || f.input_type || "text"),
      value: (f.value || f.answer || f.text_answer || f.response || null) as string | null,
      selectedOptions: Array.isArray(f.selected_options || f.selected_values || f.checked)
        ? ((f.selected_options || f.selected_values || f.checked) as string[])
        : undefined,
      availableOptions: availableOptions.length > 0
        ? availableOptions.map((o) =>
            typeof o === "string" ? o : (o as Record<string, string>).label || (o as Record<string, string>).name || String(o)
          )
        : undefined,
      sortOrder: (f.sort_order || f.position || f.order || f.y) as number | undefined,
      connectedFieldName: (f.connected_field || f.mapped_field) as string | undefined,
    };
  }
}
