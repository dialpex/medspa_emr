# Engineering Standards

This document defines implementation-level discipline.

---

## 1. Testing

Must include tests for:
- Encounter creation idempotency
- Signing workflow
- MD review workflow
- High-risk blocking
- Tenant isolation
- RBAC enforcement

Test types:
- Unit tests for domain logic
- Integration tests for API + DB
- E2E tests for critical flows

---

## 2. Object Creation & Mutation

- All writes go through domain service functions.
- Route handlers orchestrate only.
- Multi-entity writes must use Prisma transactions.
- No business logic in UI layer.

---

## 3. Database Rules

- All tables include clinicId.
- All queries must scope by clinicId.
- Add indexes on:
  - clinicId
  - patientId
  - encounterId
  - createdAt
- No SQLite-only constructs.

---

## 4. Error Handling

- Never expose raw DB errors.
- Map to domain-safe errors.
- Log internal stack traces server-side only.
- Do not log raw PHI.

---

## 5. Audit Logging

All state mutations must generate audit logs.

Required events:
- Begin Service
- Encounter creation
- Sign
- Co-sign
- Addendum creation
- AI draft application

Audit logs must include:
- userId
- clinicId
- entityId
- timestamp
- event type

---

## 6. Performance

- No N+1 queries.
- Pagination required for lists.
- Do not load image blobs in list queries.
- Use select() to limit returned fields.

---

## 7. Linting

- Strict TypeScript
- No `any`
- ESLint + Prettier
- No console.log in production

---

## 8. TypeScript Conventions

- `interface` for component props named `ComponentNameProps` when 3+ props; inline `{ prop: Type }` is fine for 1-2 props
- `type` for unions/intersections, `interface` for extensible object shapes
- String unions (`'primary' | 'secondary'`) over enums
- `Record<string, unknown>` for arbitrary keys, `Record<string, never>` for empty objects
- `unknown` over `any`, narrow with type guards
- TSDoc for exported function/type documentation

---

## 9. React Components

- Function components with hooks only
- Destructure props in function parameters
- Unique identifiers as keys, not array indices — use item IDs, unique values, or stable string prefixes (`key={`skeleton-${i}`}`) for static/skeleton lists
- Memoization only when clear performance benefit
- `data-testid` attributes for test selectors (add incrementally as E2E tests are introduced)
- Colocate related files (component, styles, tests)
- Controlled components for forms
- Event handlers named `handleX` (e.g., `handleClick`, `handleSubmit`)


## 10. Feature Implementation

- All features must be implemented in a modular and maintainable way.
- All features must be implemented in a way that is consistent with the existing codebase.
- All features must be implemented behind a feature flag for ease of management and product decisions.