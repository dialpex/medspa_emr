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

      // Query business info to verify full API access
      const result = await this.query(
        credentials,
        `query { business { id name } }`
      );

      if (result.errors?.length) {
        return {
          connected: false,
          errorMessage: result.errors[0].message,
        };
      }

      const business = result.data?.business as { name?: string } | undefined;
      return {
        connected: true,
        businessName: business?.name ?? "Unknown Business",
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
    const limit = options?.limit ?? 50;
    const result = await this.query(
      credentials,
      `query($first: Int, $after: String) {
        clients(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              firstName
              lastName
              email
              mobilePhone
              dob
              gender
              address {
                line1
                city
                state
                zip
              }
              notes
              tags { name }
            }
          }
          pageInfo { hasNextPage endCursor }
          totalCount
        }
      }`,
      { first: limit, after: options?.cursor || null }
    );

    const clients = result.data?.clients as {
      edges: Array<{ node: Record<string, unknown>; cursor: string }>;
      pageInfo: { hasNextPage: boolean; endCursor: string };
      totalCount: number;
    };

    if (!clients) {
      return { data: [], totalCount: 0 };
    }

    const data: SourcePatient[] = clients.edges.map((edge) => {
      const n = edge.node;
      const addr = n.address as { line1?: string; city?: string; state?: string; zip?: string } | null;
      const tags = n.tags as Array<{ name: string }> | null;

      return {
        sourceId: n.id as string,
        firstName: (n.firstName as string) || "",
        lastName: (n.lastName as string) || "",
        email: (n.email as string) || undefined,
        phone: (n.mobilePhone as string) || undefined,
        dateOfBirth: (n.dob as string) || undefined,
        gender: (n.gender as string) || undefined,
        address: addr?.line1,
        city: addr?.city,
        state: addr?.state,
        zipCode: addr?.zip,
        medicalNotes: (n.notes as string) || undefined,
        tags: tags?.map((t) => t.name),
        rawData: n,
      };
    });

    return {
      data,
      nextCursor: clients.pageInfo.hasNextPage ? clients.pageInfo.endCursor : undefined,
      totalCount: clients.totalCount,
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
}
