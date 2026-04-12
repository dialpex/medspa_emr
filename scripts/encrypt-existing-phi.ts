#!/usr/bin/env tsx
/**
 * One-time migration script to encrypt existing plaintext PHI fields
 * and populate blind indexes (emailHash, phoneHash).
 *
 * Usage: ENCRYPTION_KEY=... npx tsx scripts/encrypt-existing-phi.ts
 *
 * Safe to run multiple times — skips already-encrypted values.
 */

import { PrismaClient } from "@prisma/client";
import { encryptField, isEncrypted, blindIndexOptional } from "../lib/encryption/field-encryption";

const prisma = new PrismaClient();

const PATIENT_STRING_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "address",
] as const;

async function main() {
  if (!process.env.ENCRYPTION_KEY && !process.env.MIGRATION_ENCRYPTION_KEY) {
    console.error("Set ENCRYPTION_KEY env var before running this script.");
    process.exit(1);
  }

  console.log("Encrypting Patient PHI fields and populating blind indexes...");
  const patients = await prisma.patient.findMany({
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true, address: true,
      emailHash: true, phoneHash: true,
    },
  });

  let updated = 0;
  for (const patient of patients) {
    const data: Record<string, string | null> = {};
    let needsUpdate = false;

    // Store plaintext values for blind index before encryption
    const plaintextEmail = patient.email && !isEncrypted(patient.email) ? patient.email : null;
    const plaintextPhone = patient.phone && !isEncrypted(patient.phone) ? patient.phone : null;

    for (const field of PATIENT_STRING_FIELDS) {
      const value = patient[field];
      if (value == null) continue;
      if (isEncrypted(value)) continue;

      data[field] = encryptField(value);
      needsUpdate = true;
    }

    // Populate blind indexes if missing
    if (!patient.emailHash && (plaintextEmail || patient.email)) {
      const email = plaintextEmail || patient.email;
      if (email) {
        data.emailHash = blindIndexOptional(email);
        needsUpdate = true;
      }
    }
    if (!patient.phoneHash && (plaintextPhone || patient.phone)) {
      const phone = plaintextPhone || patient.phone;
      if (phone) {
        data.phoneHash = blindIndexOptional(phone);
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await prisma.patient.update({ where: { id: patient.id }, data });
      updated++;
    }
  }
  console.log(`Updated ${updated}/${patients.length} patient records.`);

  console.log("Encrypting PatientConsent signatureData...");
  const consents = await prisma.patientConsent.findMany({
    where: { signatureData: { not: null } },
    select: { id: true, signatureData: true },
  });

  let consentUpdated = 0;
  for (const consent of consents) {
    if (!consent.signatureData || isEncrypted(consent.signatureData)) continue;
    await prisma.patientConsent.update({
      where: { id: consent.id },
      data: { signatureData: encryptField(consent.signatureData) },
    });
    consentUpdated++;
  }
  console.log(`Encrypted ${consentUpdated}/${consents.length} consent signatures.`);

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
