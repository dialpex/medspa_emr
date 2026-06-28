import { describe, it, expect } from "vitest";
import {
  generateGiftCardCode,
  formatGiftCardCode,
  normalizeCode,
  maskCode,
} from "@/lib/utils/gift-card-code";

const ALLOWED_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

describe("generateGiftCardCode", () => {
  it("generates a 12-character code", () => {
    const code = generateGiftCardCode();
    expect(code).toHaveLength(12);
  });

  it("only uses allowed alphabet (no I, O, 0, 1)", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateGiftCardCode();
      for (const char of code) {
        expect(ALLOWED_CHARS).toContain(char);
      }
    }
  });

  it("generates unique codes (1000 codes, no duplicates)", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      codes.add(generateGiftCardCode());
    }
    expect(codes.size).toBe(1000);
  });
});

describe("formatGiftCardCode", () => {
  it("formats as XXXX-XXXX-XXXX", () => {
    expect(formatGiftCardCode("ABCD1234EFGH")).toBe("ABCD-1234-EFGH");
  });
});

describe("normalizeCode", () => {
  it("strips dashes and spaces, uppercases", () => {
    expect(normalizeCode("abcd-1234-efgh")).toBe("ABCD1234EFGH");
    expect(normalizeCode("ABCD 1234 EFGH")).toBe("ABCD1234EFGH");
    expect(normalizeCode("abcd1234efgh")).toBe("ABCD1234EFGH");
  });
});

describe("maskCode", () => {
  it("masks first 8 chars, shows last 4", () => {
    expect(maskCode("ABCD1234EFGH")).toBe("****-****-EFGH");
  });
});
