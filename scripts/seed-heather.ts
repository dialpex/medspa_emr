/**
 * Seed script: Create test patient "Heather Smiles" with two Botox visits and photos.
 *
 * Usage: npx tsx scripts/seed-heather.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs/promises";
import * as path from "path";

const prisma = new PrismaClient();

const CLINIC_ID = "cmm5iduux0000phcwzu3gm6f6";
const PROVIDER_ID = "cmm5iduv6000cphcw20ut80zr"; // Jessica Adams, NP
const SERVICE_ID = "cmm5iduv8000lphcwfvd0e131"; // Botox - Forehead

const BEFORE_PHOTOS = [
  { src: "Before 1.png", category: "before", caption: "Frontal — frowning" },
  { src: "Before 2.png", category: "before", caption: "Frontal — smiling" },
  { src: "Before 3.png", category: "before", caption: "Frontal — eyebrows raised" },
];

const AFTER_PHOTOS = [
  { src: "After 1.png", category: "after", caption: "Frontal — relaxed (post-Botox)" },
  { src: "After 2.png", category: "after", caption: "Frontal — slight expression (post-Botox)" },
  { src: "After 3.png", category: "after", caption: "Frontal — neutral (post-Botox)" },
];

async function main() {
  console.log("Creating patient Heather Smiles...");

  // 1. Create the patient
  const patient = await prisma.patient.create({
    data: {
      clinicId: CLINIC_ID,
      firstName: "Heather",
      lastName: "Smiles",
      email: "heather.smiles@example.com",
      phone: "(555) 867-5309",
      dateOfBirth: new Date("1990-06-15"),
      gender: "Female",
      address: "742 Evergreen Terrace",
      city: "Boston",
      state: "MA",
      zipCode: "02101",
      allergies: "None known",
      medicalNotes: "Test patient for photo comparison feature.",
      tags: "test,botox",
      status: "Active",
    },
  });
  console.log(`  Patient created: ${patient.id}`);

  // 2. Create Visit 1 — Jan 1, 2026 (initial Botox treatment)
  const appt1 = await prisma.appointment.create({
    data: {
      clinicId: CLINIC_ID,
      patientId: patient.id,
      providerId: PROVIDER_ID,
      serviceId: SERVICE_ID,
      startTime: new Date("2026-01-01T10:00:00"),
      endTime: new Date("2026-01-01T10:30:00"),
      status: "Completed",
      notes: "Initial Botox consultation and treatment — forehead lines.",
    },
  });
  console.log(`  Appointment 1 (Jan 1): ${appt1.id}`);

  const encounter1 = await prisma.encounter.create({
    data: {
      appointmentId: appt1.id,
      clinicId: CLINIC_ID,
      patientId: patient.id,
      providerId: PROVIDER_ID,
      status: "Finalized",
    },
  });

  const chart1 = await prisma.chart.create({
    data: {
      clinicId: CLINIC_ID,
      patientId: patient.id,
      appointmentId: appt1.id,
      encounterId: encounter1.id,
      createdById: PROVIDER_ID,
      status: "MDSigned",
      chiefComplaint: "Forehead lines and glabellar frown lines",
      areasTreated: JSON.stringify(["Forehead", "Glabella"]),
      productsUsed: JSON.stringify(["Botox 50 units"]),
      dosageUnits: "50 units",
      technique: "Standard injection pattern — 5 points forehead, 5 points glabella",
      aftercareNotes: "Avoid rubbing area for 4 hours. No strenuous exercise for 24 hours.",
    },
  });
  console.log(`  Chart 1: ${chart1.id}`);

  // 3. Create Visit 2 — Jan 20, 2026 (follow-up)
  const appt2 = await prisma.appointment.create({
    data: {
      clinicId: CLINIC_ID,
      patientId: patient.id,
      providerId: PROVIDER_ID,
      serviceId: SERVICE_ID,
      startTime: new Date("2026-01-20T14:00:00"),
      endTime: new Date("2026-01-20T14:30:00"),
      status: "Completed",
      notes: "Follow-up visit — assess Botox results at ~3 weeks.",
    },
  });
  console.log(`  Appointment 2 (Jan 20): ${appt2.id}`);

  const encounter2 = await prisma.encounter.create({
    data: {
      appointmentId: appt2.id,
      clinicId: CLINIC_ID,
      patientId: patient.id,
      providerId: PROVIDER_ID,
      status: "Finalized",
    },
  });

  const chart2 = await prisma.chart.create({
    data: {
      clinicId: CLINIC_ID,
      patientId: patient.id,
      appointmentId: appt2.id,
      encounterId: encounter2.id,
      createdById: PROVIDER_ID,
      status: "MDSigned",
      chiefComplaint: "Botox follow-up — 3 week post-treatment assessment",
      additionalNotes:
        "Patient reports satisfaction with results. Forehead lines significantly reduced. No adverse effects reported.",
    },
  });
  console.log(`  Chart 2: ${chart2.id}`);

  // 4. Copy photos and create DB records
  const photoDir = path.join(
    process.cwd(),
    "storage",
    "photos",
    CLINIC_ID,
    patient.id
  );
  await fs.mkdir(photoDir, { recursive: true });
  console.log(`  Photo directory: ${photoDir}`);

  const desktopDir = path.join("/Users/diegopeixoto/Desktop");

  // Before photos → linked to chart1 (Jan 1 visit)
  for (const p of BEFORE_PHOTOS) {
    const srcPath = path.join(desktopDir, p.src);
    const stat = await fs.stat(srcPath);
    const storageName = p.src.toLowerCase().replace(/\s/g, "-");
    const destPath = path.join(photoDir, storageName);
    await fs.copyFile(srcPath, destPath);

    const photo = await prisma.photo.create({
      data: {
        clinicId: CLINIC_ID,
        patientId: patient.id,
        chartId: chart1.id,
        takenById: PROVIDER_ID,
        filename: p.src,
        storagePath: path.join(
          "storage",
          "photos",
          CLINIC_ID,
          patient.id,
          storageName
        ),
        mimeType: "image/png",
        sizeBytes: stat.size,
        category: p.category,
        caption: p.caption,
        createdAt: new Date("2026-01-01T10:05:00"),
      },
    });
    console.log(`  Photo (before): ${photo.id} — ${p.src}`);
  }

  // After photos → linked to chart2 (Jan 20 visit)
  for (const p of AFTER_PHOTOS) {
    const srcPath = path.join(desktopDir, p.src);
    const stat = await fs.stat(srcPath);
    const storageName = p.src.toLowerCase().replace(/\s/g, "-");
    const destPath = path.join(photoDir, storageName);
    await fs.copyFile(srcPath, destPath);

    const photo = await prisma.photo.create({
      data: {
        clinicId: CLINIC_ID,
        patientId: patient.id,
        chartId: chart2.id,
        takenById: PROVIDER_ID,
        filename: p.src,
        storagePath: path.join(
          "storage",
          "photos",
          CLINIC_ID,
          patient.id,
          storageName
        ),
        mimeType: "image/png",
        sizeBytes: stat.size,
        category: p.category,
        caption: p.caption,
        createdAt: new Date("2026-01-20T14:05:00"),
      },
    });
    console.log(`  Photo (after): ${photo.id} — ${p.src}`);
  }

  console.log("\nDone! Heather Smiles created with 2 visits and 6 photos.");
  console.log(`Patient ID: ${patient.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
