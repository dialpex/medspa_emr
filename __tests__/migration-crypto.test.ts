import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Set encryption key before importing crypto module
const TEST_KEY = "a".repeat(64); // 32 bytes hex-encoded

describe("Migration Credential Encryption", () => {
  const originalEnv = process.env.MIGRATION_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.MIGRATION_ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.MIGRATION_ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.MIGRATION_ENCRYPTION_KEY;
    }
  });

  it("encrypts and decrypts a simple string", async () => {
    const { encrypt, decrypt } = await import("../lib/migration/crypto");
    const plaintext = "hello world";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("encrypts and decrypts JSON credentials", async () => {
    const { encrypt, decrypt } = await import("../lib/migration/crypto");
    const credentials = JSON.stringify({
      apiKey: "sk-test-12345",
      businessId: "biz-abc-def",
    });
    const encrypted = encrypt(credentials);
    const decrypted = decrypt(encrypted);
    expect(JSON.parse(decrypted)).toEqual({
      apiKey: "sk-test-12345",
      businessId: "biz-abc-def",
    });
  });

  it("produces different ciphertexts for the same plaintext (random IV)", async () => {
    const { encrypt } = await import("../lib/migration/crypto");
    const plaintext = "same input";
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("fails decryption with tampered ciphertext", async () => {
    const { encrypt, decrypt } = await import("../lib/migration/crypto");
    const encrypted = encrypt("sensitive data");
    // Tamper with the ciphertext
    const buf = Buffer.from(encrypted, "base64");
    buf[20] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(() => decrypt(tampered)).toThrow();
  });
});
