import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const consent = await p.patientConsent.findFirst({
    where: {
      patient: { firstName: "Carla", lastName: "Cora" },
      template: { name: { contains: "Cancellation" } },
    },
    include: { template: true },
  });

  if (!consent) {
    console.log("Not found");
    return;
  }

  const snapshot = JSON.parse(consent.templateSnapshot || "{}");
  console.log("Has formFields:", !!snapshot.formFields);
  console.log("Snapshot keys:", Object.keys(snapshot));

  if (snapshot.formFields) {
    console.log(`\nformFields count: ${snapshot.formFields.length}`);
    for (const f of snapshot.formFields) {
      const label = (f.label || "").substring(0, 100);
      const value = (f.value || "").substring(0, 100);
      console.log(`  type=${f.type} | label="${label}" | value="${value}"`);
    }
  }

  // Check ALL fields for HTML content
  console.log("\n--- Raw snapshot (first 2000 chars) ---");
  console.log(JSON.stringify(snapshot, null, 2).substring(0, 2000));
}

main().then(() => p.$disconnect());
