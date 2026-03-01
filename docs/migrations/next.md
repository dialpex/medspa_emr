# Migration Agent — v.next Roadmap

Documented here for future implementation. Do not implement yet.

## 1. Vendor-Specific Browser Scripts
Pre-built navigation scripts for top EMRs: AestheticsPro, Nextech, PatientNow, Zenoti. Reduces AI dependency and speeds up extraction.

## 2. Browser Agent Learning
Agent records successful navigation paths and replays them for future migrations from the same EMR. Evolves per-vendor knowledge over time.

## 3. Delta Migrations
Snapshot + incremental sync + freeze window. Allows migrations to capture changes that happened between initial extraction and final cutover.

## 4. Advanced Entity Resolution
Probabilistic patient matching + merge workflows. Move beyond exact email/phone matching to fuzzy name matching with configurable thresholds.

## 5. Human Review UI
Full mapping review UI, exceptions triage, sampling packet review, and approval gates. Currently V1 uses API-only approval.

## 6. Migration Memory
Pattern learning from successful migrations — form classification, service mapping, common field aliases. Build institutional knowledge.

## 7. Performance
Streaming transforms, parallel entity pipelines, queue-based execution. Currently V1 processes entities sequentially.

## 8. Multi-Model Routing
Cheap classifier for simple mappings + strong mapper for complex ones. Per-vendor prompt templates tuned for specific EMR field naming conventions.

## 9. Photo Intelligence
Vision-based dedup (aspect ratio clustering, perceptual hashing), format analysis, metadata extraction from EXIF data.

## 10. Boulevard Adapter
Convert existing BoulevardProvider into a full VendorAdapter with profile + transform, bypassing the generic adapter for Boulevard-specific optimizations.

## 11. FHIR/HL7 Adapters
For EMRs that support healthcare interoperability standards. Parse FHIR Bundle resources into canonical records.

## 12. Browserbase Cloud
Move from local Playwright to Browserbase's cloud browser infrastructure for scalability and session management.
