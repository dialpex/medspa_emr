# Writing a Vendor Adapter

## Overview

A `VendorAdapter` profiles ingested artifacts and transforms them into canonical records. If your source EMR has a unique data format, you write an adapter.

## Interface

```typescript
interface VendorAdapter {
  profile(artifacts: ArtifactRef[], store: ArtifactStore): Promise<SourceProfile>;
  transform(
    artifacts: ArtifactRef[],
    store: ArtifactStore,
    mappingSpec: MappingSpec
  ): AsyncGenerator<{ entityType: CanonicalEntityType; record: CanonicalRecord }>;
}
```

## Steps

1. Create `lib/migration/adapters/your-vendor.ts`
2. Implement `profile()` to analyze artifact contents and return a `SourceProfile`
3. Implement `transform()` as an async generator that yields canonical records
4. Register in `lib/migration/adapters/index.ts`

## Profile Output

The `SourceProfile` must contain:
- Entity types found (patients, appointments, etc.)
- Per-field metadata: name, inferred type, null rate, uniqueness
- PHI classification (heuristic: field names like "email", "dob", "ssn")
- Relationship hints (e.g., "appointments.patientId → patients.id")

## Transform Output

Each yielded record must:
- Have a deterministic `canonicalId`: `hash(tenantId + vendorKey + sourceRecordId)`
- Have a `sourceRecordId` for traceability
- Conform to the canonical type for its entity (e.g., `CanonicalPatient`)

## Example

See `GenericCSVAdapter` in `lib/migration/adapters/generic-csv.ts` for a complete reference implementation.
