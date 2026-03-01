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
} from "./types";

const BOULEVARD_BASE = "https://dashboard.boulevard.io";
const BOULEVARD_SESSION_URL = `${BOULEVARD_BASE}/auth/sessions`;
const BOULEVARD_IDENTITY_URL = `${BOULEVARD_BASE}/auth/identities`;
const BOULEVARD_GRAPH_URL = `${BOULEVARD_BASE}/api/v1.0/graph`;

interface GraphQLResponse {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string }>;
}

/**
 * Boulevard form content query — uses inline fragments for the CustomFormComponent union.
 * Each component type has different answer fields (textAnswer, checkboxAnswer, dateAnswer, etc.).
 * Components are positioned on a grid (x, y, w, h) — we use `y` for sort ordering.
 */
const BOULEVARD_FORM_CONTENT_QUERY = `query GetFormContent($id: ID!) {
  customForm(id: $id) {
    id
    formUrl
    version {
      template { name }
      components {
        __typename
        ... on CustomFormComponentTextV2 { id y value }
        ... on CustomFormComponentTextInputV2 { id y label textAnswer placeholder connectedField }
        ... on CustomFormComponentTextarea { id y label textAnswer textareaAnswer }
        ... on CustomFormComponentText { id y label textAnswer }
        ... on CustomFormComponentCheckboxV2 { id y label checkboxAnswer values { label } enableOther otherAnswer }
        ... on CustomFormComponentCheckbox { id y label checkboxAnswer values { label } }
        ... on CustomFormComponentDateV2 { id y label dateAnswer connectedField }
        ... on CustomFormComponentDate { id y label dateAnswer }
        ... on CustomFormComponentDropdownV2 { id y label dropdownAnswer values { label } }
        ... on CustomFormComponentSelect { id y label selectAnswer values { label } }
        ... on CustomFormComponentMultipleChoiceV2 { id y label radioAnswer values { label } }
        ... on CustomFormComponentRadio { id y label radioAnswer values { label } }
        ... on CustomFormComponentSignatureV2 { id y label }
        ... on CustomFormComponentSignature { id y label }
        ... on CustomFormComponentImageUploaderV2 { id y label }
        ... on CustomFormComponentImageV2 { id y label src }
        ... on CustomFormComponentH1 { id y label }
        ... on CustomFormComponentH2 { id y label }
        ... on CustomFormComponentDividerV2 { id y }
        ... on CustomFormComponentLogoV2 { id y }
        ... on CustomFormComponentLogo { id y }
        ... on CustomFormComponentMarkdown { id y markdownContent }
      }
    }
  }
}`;

/**
 * Parse Boulevard form components into normalized FormFieldContent array.
 * Skips decorative elements (dividers, logos) and focuses on data-bearing components.
 * Components are sorted by y position to preserve form layout order.
 */
function parseBoulevardFormComponents(
  components: Array<Record<string, unknown>>
): FormFieldContent[] {
  const fields: FormFieldContent[] = [];

  for (const comp of components) {
    const typename = comp.__typename as string;
    const id = (comp.id as string) || "";
    const y = (comp.y as number) ?? 0;

    // Skip decorative/layout components
    if (
      typename.includes("Divider") ||
      typename.includes("Logo") ||
      typename === "CustomFormComponentMarkdown"
    ) {
      continue;
    }

    // Static text headings (H1, H2, TextV2)
    if (typename === "CustomFormComponentH1" || typename === "CustomFormComponentH2") {
      const label = comp.label as string;
      if (label) {
        fields.push({ fieldId: id, label, type: "heading", value: null, sortOrder: y });
      }
      continue;
    }

    if (typename === "CustomFormComponentTextV2") {
      const value = comp.value as string;
      if (value) {
        fields.push({ fieldId: id, label: value, type: "heading", value: null, sortOrder: y });
      }
      continue;
    }

    // Text inputs
    if (
      typename === "CustomFormComponentTextInputV2" ||
      typename === "CustomFormComponentText"
    ) {
      fields.push({
        fieldId: id,
        label: (comp.label as string) || "",
        type: (comp.connectedField as string) ? "connected_text" : "text",
        value: (comp.textAnswer as string) || null,
        sortOrder: y,
      });
      continue;
    }

    // Textareas
    if (typename === "CustomFormComponentTextarea") {
      fields.push({
        fieldId: id,
        label: (comp.label as string) || "",
        type: "textarea",
        value: (comp.textareaAnswer as string) || (comp.textAnswer as string) || null,
        sortOrder: y,
      });
      continue;
    }

    // Checkboxes
    if (
      typename === "CustomFormComponentCheckboxV2" ||
      typename === "CustomFormComponentCheckbox"
    ) {
      const checkboxAnswer = (comp.checkboxAnswer as string[]) || [];
      const values = (comp.values as Array<{ label: string }>) || [];
      const otherAnswer = comp.otherAnswer as string | undefined;
      const selected = [...checkboxAnswer];
      if (otherAnswer) selected.push(otherAnswer);

      fields.push({
        fieldId: id,
        label: (comp.label as string) || "",
        type: "checkbox",
        value: selected.join(", ") || null,
        selectedOptions: selected.length > 0 ? selected : undefined,
        availableOptions: values.map((v) => v.label),
        sortOrder: y,
      });
      continue;
    }

    // Dates
    if (
      typename === "CustomFormComponentDateV2" ||
      typename === "CustomFormComponentDate"
    ) {
      fields.push({
        fieldId: id,
        label: (comp.label as string) || "",
        type: (comp.connectedField as string) ? "connected_date" : "date",
        value: (comp.dateAnswer as string) || null,
        sortOrder: y,
      });
      continue;
    }

    // Dropdowns
    if (typename === "CustomFormComponentDropdownV2") {
      const dropdownAnswer = (comp.dropdownAnswer as string[]) || [];
      const values = (comp.values as Array<{ label: string }>) || [];
      fields.push({
        fieldId: id,
        label: (comp.label as string) || "",
        type: "dropdown",
        value: dropdownAnswer.join(", ") || null,
        selectedOptions: dropdownAnswer.length > 0 ? dropdownAnswer : undefined,
        availableOptions: values.map((v) => v.label),
        sortOrder: y,
      });
      continue;
    }

    // Selects
    if (typename === "CustomFormComponentSelect") {
      const selectAnswer = (comp.selectAnswer as string[]) || [];
      const values = (comp.values as Array<{ label: string }>) || [];
      fields.push({
        fieldId: id,
        label: (comp.label as string) || "",
        type: "select",
        value: selectAnswer.join(", ") || null,
        selectedOptions: selectAnswer.length > 0 ? selectAnswer : undefined,
        availableOptions: values.map((v) => v.label),
        sortOrder: y,
      });
      continue;
    }

    // Multiple choice / Radio
    if (
      typename === "CustomFormComponentMultipleChoiceV2" ||
      typename === "CustomFormComponentRadio"
    ) {
      const values = (comp.values as Array<{ label: string }>) || [];
      fields.push({
        fieldId: id,
        label: (comp.label as string) || "",
        type: "radio",
        value: (comp.radioAnswer as string) || null,
        availableOptions: values.map((v) => v.label),
        sortOrder: y,
      });
      continue;
    }

    // Signatures
    if (
      typename === "CustomFormComponentSignatureV2" ||
      typename === "CustomFormComponentSignature"
    ) {
      fields.push({
        fieldId: id,
        label: (comp.label as string) || "Signature",
        type: "signature",
        value: "[signed]",
        sortOrder: y,
      });
      continue;
    }

    // Image uploaders
    if (
      typename === "CustomFormComponentImageUploaderV2" ||
      typename === "CustomFormComponentImageV2"
    ) {
      fields.push({
        fieldId: id,
        label: (comp.label as string) || "Photo",
        type: "image",
        value: (comp.src as string) || null,
        sortOrder: y,
      });
      continue;
    }
  }

  // Sort by y position to preserve form layout order
  fields.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return fields;
}

/**
 * Parse Set-Cookie headers from a fetch Response and merge into existing cookie string.
 * Node.js fetch returns Set-Cookie as a comma-separated string via getSetCookie() or
 * headers.getSetCookie(). We extract cookie name=value pairs from each.
 */
function extractCookies(res: Response, existingCookies: string): string {
  const cookieMap = new Map<string, string>();

  // Parse existing cookies into map
  if (existingCookies) {
    for (const pair of existingCookies.split("; ")) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx > 0) {
        cookieMap.set(pair.substring(0, eqIdx), pair.substring(eqIdx + 1));
      }
    }
  }

  // Extract new cookies from Set-Cookie headers
  const setCookieHeaders = res.headers.getSetCookie?.() ?? [];
  for (const header of setCookieHeaders) {
    // Each Set-Cookie header: "name=value; path=/; ..."
    const nameValue = header.split(";")[0].trim();
    const eqIdx = nameValue.indexOf("=");
    if (eqIdx > 0) {
      cookieMap.set(nameValue.substring(0, eqIdx), nameValue.substring(eqIdx + 1));
    }
  }

  // Rebuild cookie string
  return Array.from(cookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

export class BoulevardProvider implements MigrationProvider {
  readonly source = "Boulevard";
  private sessionCookies: string = "";
  private csrfToken: string = "";
  private credentials: MigrationCredentials | null = null;
  private authenticated = false;

  private async authenticate(credentials: MigrationCredentials): Promise<void> {
    if (!credentials.email || !credentials.password) {
      throw new Error("Boulevard requires email and password credentials");
    }

    this.sessionCookies = "";
    this.csrfToken = "";
    this.authenticated = false;

    // Step 1: POST to /auth/sessions with { email, password }
    // Returns 204 No Content with Set-Cookie containing _sched_cookie
    const sessionRes = await fetch(BOULEVARD_SESSION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: BOULEVARD_BASE,
        Referer: `${BOULEVARD_BASE}/login-v2/`,
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
      redirect: "manual",
    });

    if (sessionRes.status !== 204 && sessionRes.status !== 200) {
      const text = await sessionRes.text().catch(() => "");
      throw new Error(
        `Boulevard login failed (${sessionRes.status}): ${text || "Invalid credentials"}`
      );
    }

    this.sessionCookies = extractCookies(sessionRes, this.sessionCookies);

    // Step 2: GET /auth/identities to validate session and get csrf-token
    const identityRes = await fetch(BOULEVARD_IDENTITY_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: this.sessionCookies,
      },
      redirect: "manual",
    });

    if (identityRes.status === 401) {
      throw new Error("Boulevard login failed: invalid email or password");
    }

    this.sessionCookies = extractCookies(identityRes, this.sessionCookies);

    // Extract csrf-token from cookies
    const csrfMatch = this.sessionCookies.match(/csrf-token=([^;]+)/);
    if (csrfMatch) {
      this.csrfToken = decodeURIComponent(csrfMatch[1]);
    }

    this.credentials = credentials;
    this.authenticated = true;
  }

  private async ensureAuthenticated(credentials: MigrationCredentials): Promise<void> {
    if (!this.authenticated || this.credentials?.email !== credentials.email) {
      await this.authenticate(credentials);
    }
  }

  private buildGraphHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json;charset=UTF-8",
      Accept: "application/json, text/plain, */*",
      Cookie: this.sessionCookies,
      Origin: BOULEVARD_BASE,
      Referer: `${BOULEVARD_BASE}/home`,
    };

    if (this.csrfToken) {
      headers["csrf-token"] = this.csrfToken;
    }

    return headers;
  }

  private async query(
    credentials: MigrationCredentials,
    queryStr: string,
    variables?: Record<string, unknown>
  ): Promise<GraphQLResponse> {
    await this.ensureAuthenticated(credentials);

    const res = await fetch(BOULEVARD_GRAPH_URL, {
      method: "POST",
      headers: this.buildGraphHeaders(),
      body: JSON.stringify({ query: queryStr, variables }),
    });

    // Update cookies from response (session refresh)
    this.sessionCookies = extractCookies(res, this.sessionCookies);

    if (res.status === 401 || res.status === 403) {
      // Session expired — re-authenticate and retry once
      this.authenticated = false;
      await this.authenticate(credentials);

      const retryRes = await fetch(BOULEVARD_GRAPH_URL, {
        method: "POST",
        headers: this.buildGraphHeaders(),
        body: JSON.stringify({ query: queryStr, variables }),
      });

      this.sessionCookies = extractCookies(retryRes, this.sessionCookies);

      if (!retryRes.ok) {
        const text = await retryRes.text();
        throw new Error(`Boulevard API error after re-auth (${retryRes.status}): ${text}`);
      }

      return retryRes.json();
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Boulevard API error (${res.status}): ${text}`);
    }

    return res.json();
  }

  async testConnection(credentials: MigrationCredentials): Promise<ConnectionTestResult> {
    try {
      await this.authenticate(credentials);

      // Query business info + locations to verify full API access
      const result = await this.query(
        credentials,
        `query { business { id name locations { edges { node { id name } } } } }`
      );

      if (result.errors?.length) {
        return {
          connected: false,
          errorMessage: result.errors[0].message,
        };
      }

      const business = result.data?.business as {
        name?: string;
        locations?: { edges: Array<{ node: { id: string; name: string } }> };
      } | undefined;

      // Use the first location ID for document fetching
      const locationId = business?.locations?.edges?.[0]?.node?.id;

      return {
        connected: true,
        businessName: business?.name ?? "Unknown Business",
        locationId,
      };
    } catch (err) {
      return {
        connected: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async fetchPatients(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourcePatient>> {
    const pageSize = options?.limit ?? 50;
    // Boulevard uses page-number pagination (0-indexed), not cursor-based
    const pageNumber = options?.cursor ? parseInt(options.cursor, 10) : 0;

    const result = await this.query(
      credentials,
      `query ClientSearch($query: String, $pageSize: Int, $pageNumber: Int, $filter: JSON) {
        clientSearch(query: $query, pageSize: $pageSize, pageNumber: $pageNumber, filter: $filter) {
          totalEntries
          clients {
            id
            firstName
            lastName
            fullName
            email
            phoneNumber
            dob
            pronoun
            sexAssignedAtBirth
            active
            address {
              line1
              line2
              city
              state
              zip
            }
            tags { id name }
            bookingMemo { text }
          }
        }
      }`,
      { query: "", pageSize, pageNumber, filter: "null" }
    );

    const searchData = result.data?.clientSearch as {
      totalEntries: number;
      clients: Array<Record<string, unknown>>;
    };

    if (!searchData || searchData.clients.length === 0) {
      return { data: [], totalCount: 0 };
    }

    const data: SourcePatient[] = searchData.clients.map((n) => {
      const addr = n.address as { line1?: string; line2?: string; city?: string; state?: string; zip?: string } | null;
      const tags = n.tags as Array<{ name: string }> | null;
      const memo = n.bookingMemo as { text?: string } | null;

      return {
        sourceId: n.id as string,
        firstName: (n.firstName as string) || "",
        lastName: (n.lastName as string) || "",
        email: (n.email as string) || undefined,
        phone: (n.phoneNumber as string) || undefined,
        dateOfBirth: (n.dob as string) || undefined,
        gender: (n.pronoun as string) || (n.sexAssignedAtBirth as string) || undefined,
        address: addr?.line1,
        city: addr?.city,
        state: addr?.state,
        zipCode: addr?.zip,
        medicalNotes: memo?.text || undefined,
        tags: tags?.map((t) => t.name),
        rawData: n,
      };
    });

    // Calculate if there are more pages
    const totalFetched = (pageNumber + 1) * pageSize;
    const hasMore = totalFetched < searchData.totalEntries;

    return {
      data,
      nextCursor: hasMore ? String(pageNumber + 1) : undefined,
      totalCount: searchData.totalEntries,
    };
  }

  async fetchServices(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceService>> {
    const limit = options?.limit ?? 50;
    const result = await this.query(
      credentials,
      `query($first: Int, $after: String) {
        services(first: $first, after: $after) {
          edges {
            node {
              id
              name
              description
              duration
              price
              category { name }
              disabled
            }
          }
          pageInfo { hasNextPage endCursor }
          totalCount
        }
      }`,
      { first: limit, after: options?.cursor || null }
    );

    const services = result.data?.services as {
      edges: Array<{ node: Record<string, unknown> }>;
      pageInfo: { hasNextPage: boolean; endCursor: string };
      totalCount: number;
    };

    if (!services) {
      return { data: [], totalCount: 0 };
    }

    const data: SourceService[] = services.edges.map((edge) => {
      const n = edge.node;
      const cat = n.category as { name: string } | null;
      return {
        sourceId: n.id as string,
        name: (n.name as string) || "",
        description: (n.description as string) || undefined,
        duration: (n.duration as number) || undefined,
        price: (n.price as number) || undefined,
        category: cat?.name,
        isActive: !(n.disabled as boolean),
        rawData: n,
      };
    });

    return {
      data,
      nextCursor: services.pageInfo.hasNextPage ? services.pageInfo.endCursor : undefined,
      totalCount: services.totalCount,
    };
  }

  async fetchAppointments(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceAppointment>> {
    const limit = options?.limit ?? 50;
    const result = await this.query(
      credentials,
      `query($first: Int, $after: String) {
        appointments(first: $first, after: $after) {
          edges {
            node {
              id
              client { id }
              staff { firstName lastName }
              service { id name }
              startAt
              endAt
              state
              notes
            }
          }
          pageInfo { hasNextPage endCursor }
          totalCount
        }
      }`,
      { first: limit, after: options?.cursor || null }
    );

    const appointments = result.data?.appointments as {
      edges: Array<{ node: Record<string, unknown> }>;
      pageInfo: { hasNextPage: boolean; endCursor: string };
      totalCount: number;
    };

    if (!appointments) {
      return { data: [], totalCount: 0 };
    }

    const data: SourceAppointment[] = appointments.edges.map((edge) => {
      const n = edge.node;
      const client = n.client as { id: string } | null;
      const staff = n.staff as { firstName: string; lastName: string } | null;
      const service = n.service as { id: string; name: string } | null;

      return {
        sourceId: n.id as string,
        patientSourceId: client?.id || "",
        providerName: staff ? `${staff.firstName} ${staff.lastName}` : undefined,
        serviceSourceId: service?.id,
        serviceName: service?.name,
        startTime: (n.startAt as string) || "",
        endTime: (n.endAt as string) || undefined,
        status: (n.state as string) || "unknown",
        notes: (n.notes as string) || undefined,
        rawData: n,
      };
    });

    return {
      data,
      nextCursor: appointments.pageInfo.hasNextPage ? appointments.pageInfo.endCursor : undefined,
      totalCount: appointments.totalCount,
    };
  }

  async fetchInvoices(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceInvoice>> {
    const limit = options?.limit ?? 50;
    const result = await this.query(
      credentials,
      `query($first: Int, $after: String) {
        orders(first: $first, after: $after) {
          edges {
            node {
              id
              client { id }
              number
              state
              total
              subtotal
              totalTax
              notes
              closedAt
              lineItems {
                description
                service { id }
                quantity
                unitPrice
                total
              }
            }
          }
          pageInfo { hasNextPage endCursor }
          totalCount
        }
      }`,
      { first: limit, after: options?.cursor || null }
    );

    const orders = result.data?.orders as {
      edges: Array<{ node: Record<string, unknown> }>;
      pageInfo: { hasNextPage: boolean; endCursor: string };
      totalCount: number;
    };

    if (!orders) {
      return { data: [], totalCount: 0 };
    }

    const data: SourceInvoice[] = orders.edges.map((edge) => {
      const n = edge.node;
      const client = n.client as { id: string } | null;
      const items = (n.lineItems as Array<Record<string, unknown>>) || [];

      return {
        sourceId: n.id as string,
        patientSourceId: client?.id || "",
        invoiceNumber: (n.number as string) || undefined,
        status: (n.state as string) || "unknown",
        total: (n.total as number) || 0,
        subtotal: (n.subtotal as number) || undefined,
        taxAmount: (n.totalTax as number) || undefined,
        notes: (n.notes as string) || undefined,
        paidAt: (n.closedAt as string) || undefined,
        lineItems: items.map((item) => ({
          description: (item.description as string) || "",
          serviceSourceId: (item.service as { id: string } | null)?.id,
          quantity: (item.quantity as number) || 1,
          unitPrice: (item.unitPrice as number) || 0,
          total: (item.total as number) || 0,
        })),
        rawData: n,
      };
    });

    return {
      data,
      nextCursor: orders.pageInfo.hasNextPage ? orders.pageInfo.endCursor : undefined,
      totalCount: orders.totalCount,
    };
  }

  async fetchPhotos(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourcePhoto>> {
    // Boulevard photo gallery is per-client, so we need to fetch patients first
    // then iterate. For the pipeline, this is called with a patientSourceId in options.
    // If no specific patient, we return empty (photos are fetched per-patient during import).
    const patientId = options?.cursor;
    if (!patientId) {
      return { data: [], totalCount: 0 };
    }

    const result = await this.query(
      credentials,
      `query getPhotoGallery($clientId: ID!, $options: GetPhotoGalleryOptions) {
        photoGallery(clientId: $clientId, options: $options) {
          cursor
          items {
            appointmentId
            customFormId
            serviceStaffIds
            entity
            id
            insertedAt
            label
            url
          }
        }
      }`,
      {
        clientId: patientId,
        options: { limit: options?.limit ?? 100 },
      }
    );

    const gallery = result.data?.photoGallery as {
      cursor: string | null;
      items: Array<Record<string, unknown>>;
    };

    if (!gallery || !gallery.items?.length) {
      return { data: [], totalCount: 0 };
    }

    const data: SourcePhoto[] = gallery.items.map((item) => ({
      sourceId: item.id as string,
      patientSourceId: patientId,
      url: item.url as string,
      label: (item.label as string) || undefined,
      appointmentSourceId: (item.appointmentId as string) || undefined,
      takenAt: (item.insertedAt as string) || undefined,
      rawData: item,
    }));

    return {
      data,
      nextCursor: gallery.cursor || undefined,
      totalCount: data.length,
    };
  }

  /**
   * Fetch photos for a specific Boulevard client by ID.
   * Convenience method used by the test import script and pipeline.
   */
  async fetchPatientPhotos(
    credentials: MigrationCredentials,
    clientId: string,
    limit = 100
  ): Promise<SourcePhoto[]> {
    const result = await this.fetchPhotos(credentials, { cursor: clientId, limit });
    return result.data;
  }

  async fetchForms(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceForm>> {
    // Boulevard forms are per-client. Pass patientSourceId via cursor.
    const patientId = options?.cursor;
    if (!patientId) {
      return { data: [], totalCount: 0 };
    }

    const result = await this.query(
      credentials,
      `query GetClientForms($id: ID!) {
        client(id: $id) {
          id
          customForms {
            id
            submittedByStaff {
              firstName
              lastName
            }
            submittedByClient {
              firstName
              lastName
            }
            updatedAt
            submittedAt
            offline
            status
            expirationDate
            version {
              template {
                id
                name
                internal
              }
              templatingVersion
            }
            appointment {
              id
            }
          }
        }
      }`,
      { id: patientId }
    );

    const clientData = result.data?.client as Record<string, unknown> | null;
    const customForms = (clientData?.customForms as Array<Record<string, unknown>>) || [];

    if (!customForms.length) {
      return { data: [], totalCount: 0 };
    }

    const data: SourceForm[] = customForms.map((f) => {
      const version = f.version as { template?: { id?: string; name?: string; internal?: boolean } } | null;
      const staff = f.submittedByStaff as { firstName?: string; lastName?: string } | null;
      const client = f.submittedByClient as { firstName?: string; lastName?: string } | null;
      const appt = f.appointment as { id?: string } | null;

      let submittedByName: string | undefined;
      let submittedByRole: "staff" | "client" | undefined;
      if (staff?.firstName) {
        submittedByName = `${staff.firstName} ${staff.lastName || ""}`.trim();
        submittedByRole = "staff";
      } else if (client?.firstName) {
        submittedByName = `${client.firstName} ${client.lastName || ""}`.trim();
        submittedByRole = "client";
      }

      return {
        sourceId: f.id as string,
        patientSourceId: patientId,
        templateId: version?.template?.id,
        templateName: version?.template?.name || "Unknown Form",
        status: (f.status as string) || undefined,
        isInternal: version?.template?.internal,
        submittedAt: (f.submittedAt as string) || undefined,
        expirationDate: (f.expirationDate as string) || undefined,
        submittedByName,
        submittedByRole,
        appointmentSourceId: appt?.id,
        rawData: f,
      };
    });

    return {
      data,
      totalCount: customForms.length,
    };
  }

  /**
   * Fetch forms for a specific Boulevard client by ID.
   * Convenience method used by the test import script and pipeline.
   */
  async fetchPatientForms(
    credentials: MigrationCredentials,
    clientId: string
  ): Promise<SourceForm[]> {
    const result = await this.fetchForms(credentials, { cursor: clientId });
    return result.data;
  }

  async fetchFormContent(
    credentials: MigrationCredentials,
    formSourceId: string
  ): Promise<FormFieldContent[]> {
    try {
      const result = await this.query(
        credentials,
        BOULEVARD_FORM_CONTENT_QUERY,
        { id: formSourceId }
      );

      const formData = result.data?.customForm as Record<string, unknown> | null;
      const version = formData?.version as { components?: Array<Record<string, unknown>> } | null;

      if (!version?.components) {
        return [];
      }

      return parseBoulevardFormComponents(version.components);
    } catch (err) {
      console.warn(
        `[Boulevard] Failed to fetch form content for ${formSourceId}: ${err instanceof Error ? err.message : String(err)}`
      );
      return [];
    }
  }

  async fetchDocuments(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceDocument>> {
    // Boulevard files are per-client + per-location.
    // Pass "clientId:locationId" via cursor (colon-separated).
    const cursorParts = options?.cursor?.split(":") ?? [];
    const clientId = cursorParts[0];
    const locationId = cursorParts[1];

    if (!clientId || !locationId) {
      return { data: [], totalCount: 0 };
    }

    const result = await this.query(
      credentials,
      `query getMigratedFiles($input: MigratedFilesInput!) {
        migratedFiles(input: $input) {
          migratedFiles {
            fileName
            id
            insertedAt
            originallyCreatedAt
            url
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          totalCount
        }
      }`,
      {
        input: {
          clientId,
          locationId,
          limit: options?.limit ?? 50,
        },
      }
    );

    const filesData = result.data?.migratedFiles as {
      migratedFiles: Array<Record<string, unknown>>;
      pageInfo: { hasNextPage: boolean; endCursor: string };
      totalCount: number;
    };

    if (!filesData || !filesData.migratedFiles?.length) {
      return { data: [], totalCount: filesData?.totalCount ?? 0 };
    }

    const data: SourceDocument[] = filesData.migratedFiles.map((f) => ({
      sourceId: f.id as string,
      patientSourceId: clientId,
      url: f.url as string,
      filename: (f.fileName as string) || "unknown",
      category: "migrated_file",
      rawData: f,
    }));

    return {
      data,
      nextCursor: filesData.pageInfo.hasNextPage
        ? `${clientId}:${locationId}:${filesData.pageInfo.endCursor}`
        : undefined,
      totalCount: filesData.totalCount,
    };
  }

  /**
   * Fetch documents/files for a specific Boulevard client + location.
   * Convenience method used by the test import script and pipeline.
   */
  async fetchPatientDocuments(
    credentials: MigrationCredentials,
    clientId: string,
    locationId: string
  ): Promise<SourceDocument[]> {
    const result = await this.fetchDocuments(credentials, {
      cursor: `${clientId}:${locationId}`,
    });
    return result.data;
  }
}
