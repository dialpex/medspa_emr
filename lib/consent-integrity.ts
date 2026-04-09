import { createHash } from "crypto";

type ConsentForHash = {
  patientId: string;
  templateId: string;
  templateSnapshot: string | null;
  signatureData: string | null;
  signedAt: Date | null;
};

export function generateConsentIntegrityHash(consent: ConsentForHash): string {
  const content = JSON.stringify({
    patientId: consent.patientId,
    templateId: consent.templateId,
    templateSnapshot: consent.templateSnapshot,
    signatureData: consent.signatureData,
    signedAt: consent.signedAt?.toISOString() ?? null,
  });
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export function verifyConsentIntegrity(
  consent: ConsentForHash & { integrityHash: string | null }
): boolean {
  if (!consent.integrityHash) {
    return false; // No hash stored — cannot verify
  }
  const computed = generateConsentIntegrityHash(consent);
  return computed === consent.integrityHash;
}
