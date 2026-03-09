#!/usr/bin/env npx tsx
/**
 * Test the Migration Intelligence Layer against live Boulevard data.
 *
 * Exercises:
 *   - AI-driven field type inference (inferFieldTypes)
 *   - Enhanced form classification (classifyForms)
 *   - VendorKnowledge enrichment for Boulevard
 *   - Self-healing retry wrapper (completionWithRetry)
 *   - Heuristic fallback comparison
 *
 * Usage:
 *   npx tsx scripts/test-intelligence-layer.ts               # default: 15 patients
 *   npx tsx scripts/test-intelligence-layer.ts --limit=5      # 5 patients
 *
 * Requires: ANTHROPIC_API_KEY (or OPENAI_API_KEY) in env for AI path.
 * Without an LLM key, falls back to heuristics (same as before).
 */

import * as readline from "readline";
import { BoulevardProvider } from "../lib/migration/providers/boulevard";
import type { MigrationCredentials, SourceForm, FormFieldContent } from "../lib/migration/providers/types";
import { inferFieldTypes, heuristicFieldType } from "../lib/agents/migration/field-inference";
import { classifyForms } from "../lib/agents/migration/classification";
import { getVendorKnowledge } from "../lib/agents/migration/vendor-knowledge";
import { mapFieldType as mapBoulevardFieldType } from "../lib/migration/pipeline/phases/transform";

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      process.stdout.write(question);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      if (stdin.setRawMode) stdin.setRawMode(true);
      let input = "";
      const onData = (ch: Buffer) => {
        const c = ch.toString();
        if (c === "\n" || c === "\r") {
          stdin.removeListener("data", onData);
          if (stdin.setRawMode) stdin.setRawMode(wasRaw ?? false);
          process.stdout.write("\n");
          rl.close();
          resolve(input);
        } else if (c === "\u0003") {
          process.exit(0);
        } else if (c === "\u007F" || c === "\b") {
          input = input.slice(0, -1);
        } else {
          input += c;
        }
      };
      stdin.on("data", onData);
    } else {
      rl.question(question, (answer) => { rl.close(); resolve(answer); });
    }
  });
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const patientLimit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 15;

  // Check for LLM provider
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const llmLabel = hasAnthropic ? "Anthropic" : hasOpenAI ? "OpenAI" : "NONE (heuristic only)";

  console.log(`=== Migration Intelligence Layer Test ===`);
  console.log(`  LLM provider: ${llmLabel}`);
  console.log(`  Patient limit: ${patientLimit}`);
  console.log(`  Vendor knowledge: Boulevard\n`);

  // Authenticate — prefer env vars for non-interactive use
  const email = process.env.BOULEVARD_EMAIL || await prompt("Boulevard email: ");
  const password = process.env.BOULEVARD_PASSWORD || await prompt("Boulevard password: ", true);

  const provider = new BoulevardProvider();
  const credentials: MigrationCredentials = { email, password };

  console.log("\nTesting connection...");
  const conn = await provider.testConnection(credentials);
  if (!conn.connected) {
    console.error(`Connection failed: ${conn.errorMessage}`);
    process.exit(1);
  }
  console.log(`Connected: ${conn.businessName}\n`);

  // Fetch patients
  console.log(`--- Fetching ${patientLimit} patients ---`);
  const patients = await provider.fetchPatients(credentials, { limit: patientLimit });
  console.log(`Fetched ${patients.data.length} patients (total: ${patients.totalCount})\n`);

  // Collect all forms across patients
  const allForms: Array<SourceForm & { fields?: FormFieldContent[] }> = [];
  const templateFields = new Map<string, { name: string; fields: Map<string, FormFieldContent> }>();

  for (const patient of patients.data) {
    try {
      const formsResult = await provider.fetchForms!(credentials, { cursor: patient.sourceId });
      if (formsResult.data.length === 0) continue;

      console.log(`  ${patient.firstName} ${patient.lastName}: ${formsResult.data.length} form(s)`);

      for (const form of formsResult.data) {
        let fields: FormFieldContent[] | undefined;
        try {
          fields = await provider.fetchFormContent!(credentials, form.sourceId);
          if (fields.length === 0) fields = undefined;
        } catch {
          // Content fetch failed
        }

        const formWithFields = { ...form, fields };
        allForms.push(formWithFields);

        // Accumulate field union per template
        if (form.templateId && fields) {
          let entry = templateFields.get(form.templateId);
          if (!entry) {
            entry = { name: form.templateName, fields: new Map() };
            templateFields.set(form.templateId, entry);
          }
          for (const field of fields) {
            if (!entry.fields.has(field.fieldId)) {
              entry.fields.set(field.fieldId, field);
            }
          }
        }
      }
    } catch (err) {
      console.log(`  ${patient.firstName} ${patient.lastName}: ERROR - ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nTotal: ${allForms.length} forms across ${patients.data.length} patients`);
  console.log(`Unique templates: ${templateFields.size}\n`);

  if (allForms.length === 0) {
    console.log("No forms found. Nothing to test.");
    process.exit(0);
  }

  // ============================================================
  // TEST 1: AI Field Type Inference
  // ============================================================
  console.log("=".repeat(60));
  console.log("TEST 1: AI Field Type Inference");
  console.log("=".repeat(60));

  const vendorKnowledge = getVendorKnowledge("Boulevard");
  let totalFields = 0;
  let aiDiffCount = 0;

  for (const [templateId, tmpl] of templateFields) {
    console.log(`\n  Template: "${tmpl.name}" (${tmpl.fields.size} fields)`);

    const startTime = Date.now();
    const aiTypes = await inferFieldTypes(tmpl.name, tmpl.fields, vendorKnowledge);
    const elapsed = Date.now() - startTime;

    console.log(`  AI inference completed in ${elapsed}ms`);

    for (const [fieldId, field] of tmpl.fields) {
      const aiType = aiTypes.get(fieldId) || "text";
      const heuristicType = heuristicFieldType(field);
      const legacyType = mapBoulevardFieldType(field.type);
      const differs = aiType !== legacyType;

      totalFields++;
      if (differs) aiDiffCount++;

      const diffMarker = differs ? " ***" : "";
      console.log(`    ${field.label.padEnd(35)} src=${field.type.padEnd(16)} legacy=${legacyType.padEnd(14)} ai=${aiType}${diffMarker}`);
    }
  }

  console.log(`\n  Summary: ${totalFields} fields, ${aiDiffCount} differ between AI and legacy mapping`);

  // ============================================================
  // TEST 2: Enhanced Form Classification
  // ============================================================
  console.log(`\n${"=".repeat(60)}`);
  console.log("TEST 2: Enhanced Form Classification");
  console.log("=".repeat(60));

  const startClassify = Date.now();
  const classification = await classifyForms(allForms, vendorKnowledge);
  const classifyElapsed = Date.now() - startClassify;

  console.log(`\n  Classification completed in ${classifyElapsed}ms for ${allForms.length} forms\n`);

  // Group by classification
  const groups: Record<string, Array<{ name: string; confidence: number; reasoning: string }>> = {
    consent: [],
    clinical_chart: [],
    intake: [],
    skip: [],
  };

  for (const cls of classification.classifications) {
    const form = allForms.find((f) => f.sourceId === cls.formSourceId);
    const name = form?.templateName || cls.formSourceId;
    groups[cls.classification].push({
      name,
      confidence: cls.confidence,
      reasoning: cls.reasoning,
    });
  }

  for (const [category, items] of Object.entries(groups)) {
    if (items.length === 0) continue;
    console.log(`  [${category.toUpperCase()}] (${items.length} forms):`);
    // Deduplicate by template name for cleaner output
    const seen = new Set<string>();
    for (const item of items) {
      const dedup = `${item.name}|${item.confidence}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      console.log(`    ${item.name.padEnd(45)} confidence=${item.confidence.toFixed(2)}  ${item.reasoning}`);
    }
    console.log();
  }

  console.log(`  Summary:`);
  console.log(`    Consent:        ${groups.consent.length}`);
  console.log(`    Clinical Chart: ${groups.clinical_chart.length}`);
  console.log(`    Intake:         ${groups.intake.length}`);
  console.log(`    Skip:           ${groups.skip.length}`);
  console.log(`    Total:          ${classification.classifications.length}`);
  console.log(`\n=== Done ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
