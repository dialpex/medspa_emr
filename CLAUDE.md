# Neuvvia EMR

## Project Context

Neuvvia is an **AI-first electronic medical records platform for medical spas**. Unlike traditional medspa management software, Neuvvia treats AI agents as the primary differentiator — not an add-on. The platform reduces practitioner burden so they can focus on patients, not systems.

Every feature should ask: **"how can AI make this smarter?"** — self-healing, better context, intelligent defaults, proactive suggestions. Be cost-mindful but always optimize for intelligence.

## Platform Capabilities

- **Patient Management** — demographics, medical history, communication preferences, consent tracking
- **Scheduling** — appointment booking, calendar views, provider scheduling, resource management
- **Charting** — structured chart templates (`fieldsConfig` JSON), per-encounter-per-provider documentation, photo annotations
- **Forms & Templates** — AI-generated chart/form templates, PDF import with AI field extraction, template gallery
- **Billing & Invoicing** — service pricing, invoice generation, revenue reporting
- **Data Migration** — 8-phase AI-powered pipeline to import data from external vendor systems
- **Messaging** — SMS/patient communication with opt-in enforcement and provider inbox
- **Marketing** — campaign management, patient outreach, automated follow-ups, promotional offers
- **AI Agents** — Neuvvia Insights (conversational assistant), Neuvvia Recommend (smart upsell), Neuvvia Migrate (migration intelligence), Neuvvia Scribe (voice-to-chart, future)

## Engineering Guardrails

- **HIPAA Compliance**: All features enforce PHI protection — encryption, audit logging, RBAC, minimum necessary access, secure sessions, BAAs for third-party integrations including AI providers.
- **Zero Tolerance for Assumptions**: Never assume components (auth, schemas, API clients, validation) exist — verify in code first. If missing, flag or implement natively.
- **No Placeholders**: No mock functions, truncated logic, or `// TODO` comments. All code must be fully realized, production-ready, type-safe TypeScript.
- **No Clinical Recommendations from AI**: AI agents must NEVER make clinical recommendations, diagnose conditions, suggest treatments, or provide medical advice. AI assists with operational tasks (scheduling, data lookup, documentation, upsell suggestions) — clinical decisions are exclusively the practitioner's responsibility.
- **Mandatory Multi-Turn Loop**: Before editing/creating files for non-trivial features: (1) search & inspect repo to map existing files/types, (2) output a bulleted technical plan, (3) wait for manual approval before writing code.

## Tech Stack

- **Framework**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Database**: SQLite for dev (`file:./dev.db`), Prisma ORM
- **Auth**: NextAuth.js, RBAC via `lib/rbac.ts` / `lib/rbac-core.ts`
- **Testing**: Vitest, test files in `__tests__/`
- **AI**: Anthropic SDK, multi-provider LLM abstraction (`lib/agents/_shared/llm/`)

## Architecture Patterns

### Server Actions & API-Readiness
- Pattern: `"use server"`, `ActionResult<T>` return type, `requirePermission()` guard, `prisma` queries, `revalidatePath()`
- Audit logs via `createAuditLog()` from `lib/audit.ts`
- **Service layer pattern** (mobile app coming): Business logic in `lib/services/` (pure functions, no Next.js deps). Server Actions are thin wrappers. API routes will wrap the same services.
- Zod schemas for input validation. Pass auth context as parameter, never reach for Next.js globals in business logic.

### UI Conventions
- Sidebar: `components/sidebar.tsx`, collapsible left sidebar
- Styling: Tailwind, purple-50/purple-700 for active states, gray-50 backgrounds
- **Sliding indicator pattern**: All vertical nav lists use a sliding `bg-purple-50` indicator with `top 150ms cubic-bezier(0.4, 0, 0.2, 1)` transition

### Database
- Prisma requires `@unique` on the foreign key field for one-to-one relations
- Force-reset requires `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` env var

## AI Agent Framework

**Read `.claude/agents/guardrails.md` before building or modifying any agent.**

Individual agent specs live in `.claude/agents/` as YAML-frontmatter Markdown files:
- `guardrails.md` — Non-negotiable rules: true agent definition, cascading tiers, creation checklist
- `insights.md` — Neuvvia Insights (active, true agent, executor tier, 5 tools)
- `recommend.md` — Neuvvia Recommend (active, partial agent, triage tier)
- `migrate.md` — Neuvvia Migrate (active, partial agent, triage tier)
- `scribe.md` — Neuvvia Scribe (future, planned true agent)

### Core Rules

- **True agent = tool loop (`runToolLoop()`) + self-correction + DB-persisted state.** Anything less is a prompt file, not an agent.
- **Cascading tiers**: `triage` (Haiku) → `executor` (Sonnet) → `supervisor` (Sonnet). Always use `getLLMProviderForTier()`. If executor fails validation, escalate to supervisor — don't retry at same tier.
- **No fake agents**: Prompt-only features go as `.ts` files under the most related true agent. Do NOT create a new agent directory for prompt-only features.
- **PHI safety**: Use `SafeContextBuilder` from `_shared/phi/`. Never send patient identifiers to LLMs — structure/metadata only.
- All AI code lives under `lib/agents/`. User-facing AI features use **"Neuvvia"** brand prefix.

## Key Directories

```
lib/agents/              — All AI agent code (Neuvvia-branded)
lib/agents/_shared/      — LLM providers, PHI redaction, caching
lib/agents/insights/     — Neuvvia Insights agent + template prompts
lib/agents/recommend/    — Neuvvia Recommend (upsell)
lib/agents/migrate/      — Neuvvia Migrate (data migration AI)
lib/services/            — Service layer (business logic, no Next.js deps)
lib/actions/             — Server Actions (thin wrappers)
lib/migration/pipeline/  — 8-phase migration orchestrator
app/(dashboard)/         — Dashboard pages (sidebar layout)
app/api/                 — API routes
components/              — Shared React components
scripts/                 — Dev/ops utilities (NOT production code)
.claude/agents/          — Declarative agent specifications
```

## Migration Pipeline

8-phase orchestrator: Ingest → Profile → Draft Mapping → [APPROVE] → Transform → Validate → Load → Reconcile. See `.claude/agents/migrate.md` for the AI layer. Supports importing data from external vendor systems with vendor-specific knowledge packs. AI classification runs in the Transform phase. Validation is a hard gate. Self-correction loop retries up to 2 times.

## Testing

- Vitest, files in `__tests__/`, inline test versions of server logic to avoid Next.js deps
- Tests run against seeded dev.db
- Test with real vendors, not just mock — mock hides vendor-specific data divergence bugs
