import { describe, it, expect } from "vitest";
import { mapBoulevardFieldType } from "@/lib/migration/pipeline";

describe("mapBoulevardFieldType", () => {
  it("maps heading → heading", () => {
    expect(mapBoulevardFieldType("heading")).toBe("heading");
  });

  it("maps text → text", () => {
    expect(mapBoulevardFieldType("text")).toBe("text");
  });

  it("maps connected_text → text", () => {
    expect(mapBoulevardFieldType("connected_text")).toBe("text");
  });

  it("maps textarea → textarea", () => {
    expect(mapBoulevardFieldType("textarea")).toBe("textarea");
  });

  it("maps checkbox → checklist", () => {
    expect(mapBoulevardFieldType("checkbox")).toBe("checklist");
  });

  it("maps date → date", () => {
    expect(mapBoulevardFieldType("date")).toBe("date");
  });

  it("maps connected_date → date", () => {
    expect(mapBoulevardFieldType("connected_date")).toBe("date");
  });

  it("maps dropdown → select", () => {
    expect(mapBoulevardFieldType("dropdown")).toBe("select");
  });

  it("maps select → select", () => {
    expect(mapBoulevardFieldType("select")).toBe("select");
  });

  it("maps radio → select", () => {
    expect(mapBoulevardFieldType("radio")).toBe("select");
  });

  it("maps signature → signature", () => {
    expect(mapBoulevardFieldType("signature")).toBe("signature");
  });

  it("maps image → photo-single", () => {
    expect(mapBoulevardFieldType("image")).toBe("photo-single");
  });

  it("defaults unknown types to text", () => {
    expect(mapBoulevardFieldType("unknown_type")).toBe("text");
    expect(mapBoulevardFieldType("")).toBe("text");
    expect(mapBoulevardFieldType("foobar")).toBe("text");
  });
});
