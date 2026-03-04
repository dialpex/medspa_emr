/**
 * Adds the system SOAP Note template to all clinics that don't have one yet.
 * Run: npx tsx scripts/add-soap-template.ts
 */
import { PrismaClient } from "@prisma/client";

import path from "path";
const dbPath = path.resolve(__dirname, "../prisma/dev.db");
const prisma = new PrismaClient({ datasourceUrl: `file:${dbPath}` });

const SOAP_FIELDS = JSON.stringify([
  { key: "subjective", label: "Subjective — Client reported status", type: "textarea", required: true, placeholder: "Patient's reported symptoms, history, and concerns..." },
  { key: "objective", label: "Objective — Service provider findings", type: "textarea", required: true, placeholder: "Clinical findings, vital signs, examination results..." },
  { key: "assessment", label: "Assessment — Client's response to services or treatments", type: "textarea", required: true, placeholder: "Diagnosis, clinical impression, and analysis..." },
  { key: "plan", label: "Plan — Recommendations for future care", type: "textarea", required: true, placeholder: "Treatment plan, follow-up, prescriptions, referrals..." },
  { key: "additional_notes", label: "Additional notes", type: "textarea", placeholder: "Any additional observations or notes..." },
  { key: "provider_signature", label: "Service provider signature", type: "signature", required: true },
  { key: "treatment_date", label: "Treatment date", type: "date", required: true },
]);

async function main() {
  const clinics = await prisma.clinic.findMany({ select: { id: true, name: true } });
  let created = 0;

  for (const clinic of clinics) {
    const existing = await prisma.chartTemplate.findFirst({
      where: { clinicId: clinic.id, name: "SOAP Note", isSystem: true },
    });

    if (!existing) {
      await prisma.chartTemplate.create({
        data: {
          clinicId: clinic.id,
          type: "chart",
          name: "SOAP Note",
          description: "Subjective, Objective, Assessment, Plan",
          category: "General",
          isSystem: true,
          fieldsConfig: SOAP_FIELDS,
        },
      });
      created++;
      console.log(`Created SOAP Note template for clinic: ${clinic.name}`);
    } else {
      console.log(`SOAP Note template already exists for clinic: ${clinic.name}`);
    }
  }

  console.log(`Done. Created ${created} template(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
