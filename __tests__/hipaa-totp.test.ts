import { describe, it, expect } from "vitest";
import * as OTPAuth from "otpauth";
import {
  generateTOTPSecret,
  verifyTOTP,
  generateBackupCodes,
  verifyBackupCode,
} from "../lib/mfa/totp";

describe("TOTP MFA", () => {
  it("generates a secret and URI", () => {
    const { secret, uri } = generateTOTPSecret("test@example.com");
    expect(secret).toBeTruthy();
    expect(secret.length).toBeGreaterThan(10);
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("test%40example.com");
    expect(uri).toContain("Neuvvia");
  });

  it("verifies a valid TOTP token", () => {
    const { secret } = generateTOTPSecret("verify@example.com");
    // Generate the current valid token
    const totp = new OTPAuth.TOTP({
      issuer: "Neuvvia EMR",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const token = totp.generate();
    expect(verifyTOTP(secret, token)).toBe(true);
  });

  it("rejects an invalid TOTP token", () => {
    const { secret } = generateTOTPSecret("reject@example.com");
    expect(verifyTOTP(secret, "000000")).toBe(false);
    expect(verifyTOTP(secret, "123456")).toBe(false);
  });

  it("generates 10 backup codes", () => {
    const { codes, hashes } = generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(hashes).toHaveLength(10);
    // All codes are unique
    expect(new Set(codes).size).toBe(10);
    // Codes are 8-char hex strings
    for (const code of codes) {
      expect(code).toMatch(/^[0-9A-F]{8}$/);
    }
  });

  it("verifies a valid backup code and removes it", () => {
    const { codes, hashes } = generateBackupCodes();
    const result = verifyBackupCode(codes[0], hashes);
    expect(result.valid).toBe(true);
    expect(result.remainingHashes).toHaveLength(9);
  });

  it("rejects an invalid backup code", () => {
    const { hashes } = generateBackupCodes();
    const result = verifyBackupCode("ZZZZZZZZ", hashes);
    expect(result.valid).toBe(false);
    expect(result.remainingHashes).toHaveLength(10);
  });

  it("backup code verification is case-insensitive", () => {
    const { codes, hashes } = generateBackupCodes();
    const result = verifyBackupCode(codes[0].toLowerCase(), hashes);
    expect(result.valid).toBe(true);
  });
});
