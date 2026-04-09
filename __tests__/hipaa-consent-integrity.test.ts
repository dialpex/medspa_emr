import { describe, it, expect } from "vitest";
import {
  generateConsentIntegrityHash,
  verifyConsentIntegrity,
} from "../lib/consent-integrity";

describe("Consent Signing Integrity", () => {
  const baseConsent = {
    patientId: "patient-123",
    templateId: "template-456",
    templateSnapshot: "<p>Consent text here</p>",
    signatureData: "data:image/png;base64,abc123",
    signedAt: new Date("2026-01-15T10:00:00Z"),
  };

  it("generates a SHA-256 hash", () => {
    const hash = generateConsentIntegrityHash(baseConsent);
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("produces the same hash for the same input", () => {
    const hash1 = generateConsentIntegrityHash(baseConsent);
    const hash2 = generateConsentIntegrityHash(baseConsent);
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", () => {
    const hash1 = generateConsentIntegrityHash(baseConsent);
    const hash2 = generateConsentIntegrityHash({
      ...baseConsent,
      signatureData: "data:image/png;base64,TAMPERED",
    });
    expect(hash1).not.toBe(hash2);
  });

  it("verifyConsentIntegrity returns true for matching hash", () => {
    const hash = generateConsentIntegrityHash(baseConsent);
    expect(verifyConsentIntegrity({ ...baseConsent, integrityHash: hash })).toBe(true);
  });

  it("verifyConsentIntegrity returns false for tampered data", () => {
    const hash = generateConsentIntegrityHash(baseConsent);
    const tampered = {
      ...baseConsent,
      signatureData: "TAMPERED",
      integrityHash: hash,
    };
    expect(verifyConsentIntegrity(tampered)).toBe(false);
  });

  it("verifyConsentIntegrity returns false when no hash stored", () => {
    expect(verifyConsentIntegrity({ ...baseConsent, integrityHash: null })).toBe(false);
  });
});
