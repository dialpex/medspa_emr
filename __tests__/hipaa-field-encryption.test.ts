import { describe, it, expect, beforeAll, afterAll } from "vitest";

const TEST_KEY = "b".repeat(64); // 32 bytes hex-encoded

describe("PHI Field Encryption", () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  it("encrypts and decrypts a string", async () => {
    const { encryptField, decryptField } = await import("../lib/encryption/field-encryption");
    const plaintext = "Jane Doe";
    const encrypted = encryptField(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.startsWith("enc:")).toBe(true);
    expect(decryptField(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertexts for the same input (random IV)", async () => {
    const { encryptField } = await import("../lib/encryption/field-encryption");
    const a = encryptField("same");
    const b = encryptField("same");
    expect(a).not.toBe(b);
  });

  it("decryptField passes through unencrypted values", async () => {
    const { decryptField } = await import("../lib/encryption/field-encryption");
    expect(decryptField("plain text")).toBe("plain text");
  });

  it("encryptOptional returns null for null/empty", async () => {
    const { encryptOptional } = await import("../lib/encryption/field-encryption");
    expect(encryptOptional(null)).toBeNull();
    expect(encryptOptional("")).toBeNull();
    expect(encryptOptional(undefined)).toBeNull();
  });

  it("encryptOptional encrypts non-empty strings", async () => {
    const { encryptOptional, decryptField } = await import("../lib/encryption/field-encryption");
    const encrypted = encryptOptional("test@example.com");
    expect(encrypted).not.toBeNull();
    expect(decryptField(encrypted!)).toBe("test@example.com");
  });

  it("isEncrypted detects encrypted values", async () => {
    const { encryptField, isEncrypted } = await import("../lib/encryption/field-encryption");
    expect(isEncrypted(encryptField("test"))).toBe(true);
    expect(isEncrypted("plain text")).toBe(false);
  });

  it("fails decryption with tampered ciphertext", async () => {
    const { encryptField, decryptField } = await import("../lib/encryption/field-encryption");
    const encrypted = encryptField("sensitive");
    const mangled = encrypted.slice(0, -3) + "XXX";
    expect(() => decryptField(mangled)).toThrow();
  });

  it("blindIndex produces deterministic hashes", async () => {
    const { blindIndex } = await import("../lib/encryption/field-encryption");
    expect(blindIndex("test@example.com")).toBe(blindIndex("test@example.com"));
    expect(blindIndex("Test@Example.COM")).toBe(blindIndex("test@example.com")); // case-insensitive
  });

  it("blindIndex produces different hashes for different inputs", async () => {
    const { blindIndex } = await import("../lib/encryption/field-encryption");
    expect(blindIndex("alice@test.com")).not.toBe(blindIndex("bob@test.com"));
  });

  it("encryptPatientData encrypts fields and computes blind indexes", async () => {
    const { encryptPatientData } = await import("../lib/encryption/patient-encryption");
    const { isEncrypted } = await import("../lib/encryption/field-encryption");
    const result = encryptPatientData({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@test.com",
      phone: "555-1234",
      address: "123 Main St",
      clinicId: "c1",
    });
    expect(isEncrypted(result.firstName)).toBe(true);
    expect(isEncrypted(result.lastName)).toBe(true);
    expect(isEncrypted(result.email)).toBe(true);
    expect(isEncrypted(result.phone)).toBe(true);
    expect(isEncrypted(result.address)).toBe(true);
    expect(result.emailHash).toBeTruthy();
    expect(result.phoneHash).toBeTruthy();
    expect(result.clinicId).toBe("c1"); // non-PHI field unchanged
  });

  it("decryptPatientData round-trips with encryptPatientData", async () => {
    const { encryptPatientData, decryptPatientData } = await import("../lib/encryption/patient-encryption");
    const original = { firstName: "Jane", lastName: "Doe", email: "jane@test.com", phone: null };
    const encrypted = encryptPatientData(original);
    const decrypted = decryptPatientData(encrypted);
    expect(decrypted.firstName).toBe("Jane");
    expect(decrypted.lastName).toBe("Doe");
    expect(decrypted.email).toBe("jane@test.com");
    expect(decrypted.phone).toBeNull();
  });
});
