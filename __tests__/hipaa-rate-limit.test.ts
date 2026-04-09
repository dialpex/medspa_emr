import { describe, it, expect } from "vitest";
import { rateLimit } from "../lib/rate-limit";

describe("Rate Limiter", () => {
  it("allows requests within the limit", () => {
    const key = "test-allow-" + Date.now();
    const r1 = rateLimit(key, 5, 60_000);
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(4);

    const r2 = rateLimit(key, 5, 60_000);
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(3);
  });

  it("blocks requests exceeding the limit", () => {
    const key = "test-block-" + Date.now();
    for (let i = 0; i < 5; i++) {
      const r = rateLimit(key, 5, 60_000);
      expect(r.success).toBe(true);
    }
    const blocked = rateLimit(key, 5, 60_000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("uses separate buckets for different keys", () => {
    const key1 = "test-sep-a-" + Date.now();
    const key2 = "test-sep-b-" + Date.now();
    for (let i = 0; i < 5; i++) {
      rateLimit(key1, 5, 60_000);
    }
    // key1 should be exhausted, key2 should still work
    expect(rateLimit(key1, 5, 60_000).success).toBe(false);
    expect(rateLimit(key2, 5, 60_000).success).toBe(true);
  });
});
