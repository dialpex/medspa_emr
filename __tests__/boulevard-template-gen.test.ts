import { describe, it, expect } from "vitest";
import { mapFieldType } from "@/lib/migration/pipeline/phases/transform";

describe("mapFieldType (Boulevard field type mapping)", () => {
  it("maps heading → heading", () => {
    expect(mapFieldType("heading")).toBe("heading");
  });

  it("maps text → text", () => {
    expect(mapFieldType("text")).toBe("text");
  });

  it("maps connected_text → text", () => {
    expect(mapFieldType("connected_text")).toBe("text");
  });

  it("maps textarea → textarea", () => {
    expect(mapFieldType("textarea")).toBe("textarea");
  });

  it("maps checkbox → checklist", () => {
    expect(mapFieldType("checkbox")).toBe("checklist");
  });

  it("maps date → date", () => {
    expect(mapFieldType("date")).toBe("date");
  });

  it("maps connected_date → date", () => {
    expect(mapFieldType("connected_date")).toBe("date");
  });

  it("maps dropdown → select", () => {
    expect(mapFieldType("dropdown")).toBe("select");
  });

  it("maps select → select", () => {
    expect(mapFieldType("select")).toBe("select");
  });

  it("maps radio → select", () => {
    expect(mapFieldType("radio")).toBe("select");
  });

  it("maps signature → signature", () => {
    expect(mapFieldType("signature")).toBe("signature");
  });

  it("maps image → photo-single", () => {
    expect(mapFieldType("image")).toBe("photo-single");
  });

  it("defaults unknown types to text", () => {
    expect(mapFieldType("unknown_type")).toBe("text");
    expect(mapFieldType("")).toBe("text");
    expect(mapFieldType("foobar")).toBe("text");
  });
});
