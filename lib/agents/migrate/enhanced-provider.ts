// Agent-Enhanced Provider — Wraps any base MigrationProvider with
// AI-discovered queries. Falls back to base provider if agent unavailable.
// Same MigrationProvider interface, transparent to the pipeline.

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
  SourceChart,
  FormFieldContent,
} from "@/lib/migration/providers/types";
import { AnthropicProvider } from "@/lib/agents/_shared/llm/anthropic";
import { discoverAndBuildQueries, type SeedQuery } from "./schema-discovery";
import type { GraphQLExecutor } from "./tools";
import type { CachedQueryPattern } from "./schema-cache";

interface AgentEnhancedConfig {
  baseProvider: MigrationProvider;
  getExecutor: (credentials: MigrationCredentials) => GraphQLExecutor;
  getSeedQueries: () => SeedQuery[];
}

export class AgentEnhancedProvider implements MigrationProvider {
  readonly source: string;
  readonly perPatientEntities?: string[];
  locationId?: string;

  private base: MigrationProvider;
  private getExecutor: (credentials: MigrationCredentials) => GraphQLExecutor;
  private seedQueries: SeedQuery[];
  private discoveredQueries: Record<string, CachedQueryPattern> = {};
  private initialized = false;
  private executor: GraphQLExecutor | null = null;
  private credentials: MigrationCredentials | null = null;

  constructor(config: AgentEnhancedConfig) {
    this.base = config.baseProvider;
    this.source = config.baseProvider.source;
    this.perPatientEntities = config.baseProvider.perPatientEntities;
    this.getExecutor = config.getExecutor;
    this.seedQueries = config.getSeedQueries();
  }

  /**
   * Initialize the agent — runs schema discovery once to find working queries.
   * Must be called after testConnection succeeds.
   */
  async initialize(credentials: MigrationCredentials): Promise<void> {
    if (this.initialized) return;

    const provider = new AnthropicProvider();
    if (!provider.isAvailable()) {
      console.log("[enhanced-provider] ANTHROPIC_API_KEY not set, using base provider only");
      this.initialized = true;
      return;
    }

    this.credentials = credentials;
    this.executor = this.getExecutor(credentials);

    try {
      // Only discover entities that need AI query discovery.
      // Per-patient entities (photos, forms, documents) are handled directly
      // by the base provider via patient-scoped queries — no discovery needed.
      const entityTypes = [
        "patients",
        "services",
        "appointments",
        "invoices",
      ];

      const result = await discoverAndBuildQueries(
        this.source,
        credentials,
        this.executor,
        entityTypes,
        this.seedQueries
      );

      this.discoveredQueries = result.queries;
      console.log(
        `[enhanced-provider] Discovery complete: ${Object.keys(this.discoveredQueries).length} queries ` +
        `(${result.fromCache ? "cached" : `${result.toolCallCount} tool calls`})`
      );
    } catch (err) {
      console.warn(
        `[enhanced-provider] Discovery failed, falling back to base provider: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    this.initialized = true;
  }

  async testConnection(credentials: MigrationCredentials): Promise<ConnectionTestResult> {
    const result = await this.base.testConnection(credentials);
    if (result.connected) {
      this.locationId = result.locationId || this.base.locationId;
      // Initialize agent after successful connection
      await this.initialize(credentials);
    }
    return result;
  }

  async fetchPatients(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourcePatient>> {
    // For patients, we always use the base provider since it has pagination
    // logic and patient hydration that's hard to replicate from a raw query.
    return this.base.fetchPatients(credentials, options);
  }

  async fetchServices(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceService>> {
    const agentQuery = this.discoveredQueries["services"];
    if (agentQuery?.verified && this.executor) {
      try {
        const result = await this.executor(credentials, agentQuery.query, agentQuery.variables);
        if (result.data && !result.errors?.length) {
          const services = this.extractServices(result.data);
          if (services.length > 0) {
            console.log(`[enhanced-provider] fetchServices: ${services.length} via agent query`);
            return { data: services, totalCount: services.length };
          }
        }
      } catch (err) {
        console.warn(`[enhanced-provider] Agent query for services failed, falling back: ${err instanceof Error ? err.message : err}`);
      }
    }
    return this.base.fetchServices(credentials, options);
  }

  async fetchAppointments(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceAppointment>> {
    // Try discovered query (location-based with date range)
    const agentQuery = this.discoveredQueries["appointments"];
    if (agentQuery?.verified && this.executor && this.locationId) {
      try {
        // Use discovered query with actual locationId and wide date range
        const variables = {
          ...agentQuery.variables,
          locationId: this.locationId,
          from: "2020-01-01",
          to: new Date().toISOString().split("T")[0],
        };
        const result = await this.executor(credentials, agentQuery.query, variables);
        if (result.data && !result.errors?.length) {
          const appointments = this.extractAppointments(result.data);
          if (appointments.length > 0) {
            console.log(`[enhanced-provider] fetchAppointments: ${appointments.length} via agent query`);
            return { data: appointments, totalCount: appointments.length };
          }
        }
      } catch (err) {
        console.warn(`[enhanced-provider] Agent query for appointments failed, falling back: ${err instanceof Error ? err.message : err}`);
      }
    }
    return this.base.fetchAppointments(credentials, options);
  }

  async fetchInvoices(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceInvoice>> {
    // Try discovered query first
    const agentQuery = this.discoveredQueries["invoices"];
    if (agentQuery?.verified && this.executor) {
      try {
        const variables = {
          ...agentQuery.variables,
          locationId: this.locationId || agentQuery.variables?.locationId,
        };
        const result = await this.executor(credentials, agentQuery.query, variables);
        if (result.data && !result.errors?.length) {
          const invoices = this.extractInvoices(result.data);
          if (invoices.length > 0) {
            console.log(`[enhanced-provider] fetchInvoices: ${invoices.length} via agent query`);
            return { data: invoices, totalCount: invoices.length };
          }
        }
      } catch (err) {
        console.warn(`[enhanced-provider] Agent query for invoices failed, falling back: ${err instanceof Error ? err.message : err}`);
      }
    }
    return this.base.fetchInvoices(credentials, options);
  }

  async fetchPhotos(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourcePhoto>> {
    return this.base.fetchPhotos?.(credentials, options) ?? { data: [], totalCount: 0 };
  }

  async fetchForms(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceForm>> {
    return this.base.fetchForms?.(credentials, options) ?? { data: [], totalCount: 0 };
  }

  async fetchFormContent(
    credentials: MigrationCredentials,
    formSourceId: string
  ): Promise<FormFieldContent[]> {
    return this.base.fetchFormContent?.(credentials, formSourceId) ?? [];
  }

  async fetchCharts(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceChart>> {
    return this.base.fetchCharts?.(credentials, options) ?? { data: [], totalCount: 0 };
  }

  async fetchDocuments(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceDocument>> {
    return this.base.fetchDocuments?.(credentials, options) ?? { data: [], totalCount: 0 };
  }

  // --- Helpers ---

  private extractAppointments(data: Record<string, unknown>): SourceAppointment[] {
    // Discovered query shape: location.appointments = [{ id, startAt, endAt, ... }]
    const location = data.location as Record<string, unknown> | undefined;
    if (!location) return [];

    const appointments = location.appointments as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(appointments) || appointments.length === 0) return [];

    return appointments.map((n) => {
      const client = n.client as { id?: string; firstName?: string; lastName?: string } | null;
      const services = (n.appointmentServices as Array<{
        service?: { id?: string; name?: string };
      }>) || [];
      const staff = n.staff as { id?: string; firstName?: string; lastName?: string } | null;
      const firstService = services[0];
      const staffName = staff
        ? `${staff.firstName || ""} ${staff.lastName || ""}`.trim()
        : undefined;

      return {
        sourceId: (n.id as string) || (n.clientId as string) || "",
        patientSourceId: client?.id || (n.clientId as string) || "",
        providerName: staffName,
        serviceSourceId: firstService?.service?.id,
        serviceName: firstService?.service?.name,
        startTime: (n.startAt as string) || new Date().toISOString(),
        endTime: (n.endAt as string) || undefined,
        status: (n.state as string) || (n.cancelled ? "CANCELLED" : "COMPLETED"),
        notes: (n.notes as string) || undefined,
        rawData: n,
      };
    });
  }

  private extractInvoices(data: Record<string, unknown>): SourceInvoice[] {
    // Try multiple response shapes for orders/invoices
    const orders = data.orders as Record<string, unknown> | undefined;
    if (!orders) return [];

    // Shape: orders.entries or orders.results or direct array
    let items: Array<Record<string, unknown>> = [];
    if (Array.isArray(orders.entries)) {
      items = orders.entries;
    } else if (Array.isArray(orders.results)) {
      items = orders.results;
    } else if (Array.isArray(orders)) {
      items = orders as unknown as Array<Record<string, unknown>>;
    }

    if (items.length === 0) return [];

    return items.map((n) => {
      const client = n.client as { id: string } | null;
      return {
        sourceId: n.id as string,
        patientSourceId: client?.id || "",
        invoiceNumber: (n.number as string) || undefined,
        status: (n.state as string) || (n.status as string) || "unknown",
        total: (n.total as number) || 0,
        subtotal: (n.subtotal as number) || undefined,
        taxAmount: (n.totalTax as number) || undefined,
        notes: (n.note as string) || (n.notes as string) || undefined,
        paidAt: (n.closedAt as string) || undefined,
        lineItems: [],
        rawData: n,
      };
    });
  }

  private extractServices(data: Record<string, unknown>): SourceService[] {
    // Navigate common GraphQL response shapes for services
    const business = data.business as Record<string, unknown> | undefined;
    if (!business) return [];

    let items: Array<Record<string, unknown>> = [];

    if (business.menuItems) {
      items = business.menuItems as Array<Record<string, unknown>>;
    } else if (business.services) {
      const services = business.services as unknown;
      if (Array.isArray(services)) {
        // Flat array shape: business.services = [{ id, name, ... }]
        items = services;
      } else {
        // Connection shape: business.services.edges = [{ node: { ... } }]
        const conn = services as { edges?: Array<{ node: Record<string, unknown> }> };
        items = conn.edges?.map((e) => e.node) || [];
      }
    } else if (business.menuCategories) {
      // Hierarchical shape: business.menuCategories = [{ name, menuItems: [...] }]
      const cats = business.menuCategories as Array<{ name: string; menuItems?: Array<Record<string, unknown>> }>;
      for (const cat of cats) {
        for (const item of cat.menuItems || []) {
          item._categoryName = cat.name;
          items.push(item);
        }
      }
    }

    return items.map((n) => {
      const cat = n.category as { name: string } | null;
      return {
        sourceId: n.id as string,
        name: (n.name as string) || "",
        description: (n.description as string) || undefined,
        // Handle both legacy (duration/price) and current (defaultDuration/defaultPrice/basePrice) fields
        duration: (n.duration as number) || (n.defaultDuration as number) || undefined,
        price: (n.price as number) || (n.defaultPrice as number) || (n.basePrice as number) || undefined,
        category: cat?.name || (n._categoryName as string) || undefined,
        isActive: n.active !== undefined ? !!(n.active) : !(n.disabled as boolean),
        rawData: n,
      };
    });
  }
}
