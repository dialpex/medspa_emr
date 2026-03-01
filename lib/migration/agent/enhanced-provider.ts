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
} from "../providers/types";
import { AnthropicClient } from "./anthropic-client";
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

    if (!AnthropicClient.isAvailable()) {
      console.log("[enhanced-provider] ANTHROPIC_API_KEY not set, using base provider only");
      this.initialized = true;
      return;
    }

    this.credentials = credentials;
    this.executor = this.getExecutor(credentials);

    try {
      const entityTypes = [
        "patients",
        "services",
        "appointments",
        "invoices",
        "photos",
        "forms",
        "documents",
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
    // Appointments are complex (per-date-range, per-client) — use base
    return this.base.fetchAppointments(credentials, options);
  }

  async fetchInvoices(
    credentials: MigrationCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<SourceInvoice>> {
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

  private extractServices(data: Record<string, unknown>): SourceService[] {
    // Navigate common GraphQL response shapes for services
    const business = data.business as Record<string, unknown> | undefined;
    if (!business) return [];

    let items: Array<Record<string, unknown>> = [];

    if (business.menuItems) {
      items = business.menuItems as Array<Record<string, unknown>>;
    } else if (business.services) {
      const services = business.services as {
        edges?: Array<{ node: Record<string, unknown> }>;
      };
      items = services.edges?.map((e) => e.node) || [];
    }

    return items.map((n) => {
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
  }
}
