import { describe, it, expect } from "vitest";
import { validatePasswordStrength, PASSWORD_REQUIREMENTS } from "../lib/validation/password";

describe("Password Validation (HIPAA)", () => {
  it("rejects passwords shorter than 12 characters", () => {
    const result = validatePasswordStrength("Short1!aB");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  });

  it("rejects passwords without uppercase", () => {
    const result = validatePasswordStrength("alllowercase1!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain at least one uppercase letter");
  });

  it("rejects passwords without lowercase", () => {
    const result = validatePasswordStrength("ALLUPPERCASE1!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain at least one lowercase letter");
  });

  it("rejects passwords without digits", () => {
    const result = validatePasswordStrength("NoDigitsHere!!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain at least one digit");
  });

  it("rejects passwords without special characters", () => {
    const result = validatePasswordStrength("NoSpecialChar1A");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain at least one special character");
  });

  it("accepts a strong password", () => {
    const result = validatePasswordStrength("MyStr0ng!Pass");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns multiple errors for very weak passwords", () => {
    const result = validatePasswordStrength("abc");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
