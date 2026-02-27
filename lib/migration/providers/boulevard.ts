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

const BOULEVARD_API = "https://dashboard.boulevard.io/api/2020-01/";

// TODO: Replace with actual Boulevard login endpoint once user provides DevTools data
// Expected: POST https://dashboard.boulevard.io/auth/login (or similar)
const BOULEVARD_LOGIN_URL = "https://dashboard.boulevard.io/auth/login";

interface GraphQLResponse {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string }>;
}

export class BoulevardProvider implements MigrationProvider {
  readonly source = "Boulevard";
  private sessionToken: string | null = null;
  private credentials: MigrationCredentials | null = null;

  private async authenticate(credentials: MigrationCredentials): Promise<void> {
    if (!credentials.email || !credentials.password) {
      throw new Error("Boulevard requires email and password credentials");
    }

    // TODO: Replace with actual Boulevard login once DevTools data is provided.
    // The login endpoint URL, request format, and response format (JWT? cookie? session?)
    // are all pending user's Chrome DevTools inspection of Boulevard's dashboard.
    //
    // Expected flow:
    //   1. POST to login endpoint with { email, password }
    //   2. Extract session/auth token from response
    //   3. Use token in Authorization header for subsequent GraphQL queries
    //
    // For now, attempt the login and fall back gracefully if it fails.
    try {
      const res = await fetch(BOULEVARD_LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // TODO: Extract actual token field once response format is known
        this.sessionToken = data.token || data.accessToken || data.session_token || null;
      }
    } catch {
      // Login endpoint not yet configured — will fall back to error in query()
    }

    this.credentials = credentials;
  }

  private async ensureAuthenticated(credentials: MigrationCredentials): Promise<void> {
    if (!this.sessionToken || this.credentials?.email !== credentials.email) {
      await this.authenticate(credentials);
    }
  }

  private async query(
    credentials: MigrationCredentials,
    queryStr: string,
    variables?: Record<string, unknown>
  ): Promise<GraphQLResponse> {
    await this.ensureAuthenticated(credentials);

    if (!this.sessionToken) {
      throw new Error(
        "Boulevard authentication failed. Session token not available. " +
        "The Boulevard provider is pending DevTools data to configure the login flow."
      );
    }

    const res = await fetch(BOULEVARD_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.sessionToken}`,
        ...(credentials.businessId
          ? { "X-Boulevard-Business-Id": credentials.businessId }
          : {}),
      },
      body: JSON.stringify({ query: queryStr, variables }),
    });

    if (res.status === 401) {
      // Session expired — re-authenticate and retry once
      this.sessionToken = null;
      await this.authenticate(credentials);
      if (!this.sessionToken) {
        throw new Error("Boulevard re-authentication failed after session expiry");
      }

      const retryRes = await fetch(BOULEVARD_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.sessionToken}`,
          ...(credentials.businessId
            ? { "X-Boulevard-Business-Id": credentials.businessId }
            : {}),
        },
        body: JSON.stringify({ query: queryStr, variables }),
      });

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

      if (!this.sessionToken) {
        return {
          connected: false,
          errorMessage:
            "Could not authenticate with Boulevard. " +
            "This provider is pending configuration — the login endpoint details " +
            "need to be captured from Boulevard's dashboard using Chrome DevTools.",
        };
      }

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
