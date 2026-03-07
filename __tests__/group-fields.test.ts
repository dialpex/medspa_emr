import { describe, it, expect } from "vitest";
import {
  groupFieldsIntoRows,
  groupFieldsBySections,
  type TemplateFieldConfig,
} from "@/lib/types/charts";

function field(overrides: Partial<TemplateFieldConfig> = {}): TemplateFieldConfig {
  return {
    key: overrides.key ?? "k",
    label: overrides.label ?? "Label",
    type: overrides.type ?? "text",
    ...overrides,
  };
}

// ---------- groupFieldsIntoRows ----------

describe("groupFieldsIntoRows", () => {
  it("puts full-width fields in their own rows", () => {
    const fields = [field({ key: "a" }), field({ key: "b" })];
    const rows = groupFieldsIntoRows(fields);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(1);
    expect(rows[1]).toHaveLength(1);
  });

  it("groups fields whose widths sum to 100", () => {
    const fields = [
      field({ key: "a", width: 50 }),
      field({ key: "b", width: 50 }),
    ];
    const rows = groupFieldsIntoRows(fields);
    expect(rows).toHaveLength(1);
    expect(rows[0].map((f) => f.key)).toEqual(["a", "b"]);
  });

  it("starts a new row when width would overflow", () => {
    const fields = [
      field({ key: "a", width: 60 }),
      field({ key: "b", width: 60 }),
    ];
    const rows = groupFieldsIntoRows(fields);
    expect(rows).toHaveLength(2);
  });

  it("headings always get their own row", () => {
    const fields = [
      field({ key: "a", width: 50 }),
      field({ key: "h", type: "heading" }),
      field({ key: "b", width: 50 }),
    ];
    const rows = groupFieldsIntoRows(fields);
    expect(rows).toHaveLength(3);
    expect(rows[1][0].type).toBe("heading");
  });

  it("heading flushes preceding partial row", () => {
    const fields = [
      field({ key: "a", width: 40 }),
      field({ key: "h", type: "heading" }),
    ];
    const rows = groupFieldsIntoRows(fields);
    expect(rows).toHaveLength(2);
    expect(rows[0][0].key).toBe("a");
    expect(rows[1][0].key).toBe("h");
  });

  it("photo-pair always gets its own row", () => {
    const fields = [
      field({ key: "a", width: 50 }),
      field({ key: "pp", type: "photo-pair" }),
      field({ key: "b", width: 50 }),
    ];
    const rows = groupFieldsIntoRows(fields);
    expect(rows).toHaveLength(3);
    expect(rows[1][0].type).toBe("photo-pair");
  });

  it("logo always gets its own row", () => {
    const fields = [
      field({ key: "a", width: 50 }),
      field({ key: "l", type: "logo" }),
      field({ key: "b", width: 50 }),
    ];
    const rows = groupFieldsIntoRows(fields);
    expect(rows).toHaveLength(3);
    expect(rows[1][0].type).toBe("logo");
  });

  it("returns empty array for empty input", () => {
    expect(groupFieldsIntoRows([])).toEqual([]);
  });

  it("handles three fields in one row (33+33+34)", () => {
    const fields = [
      field({ key: "a", width: 33 }),
      field({ key: "b", width: 33 }),
      field({ key: "c", width: 34 }),
    ];
    const rows = groupFieldsIntoRows(fields);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(3);
  });

  it("flushes trailing partial row", () => {
    const fields = [field({ key: "a", width: 40 })];
    const rows = groupFieldsIntoRows(fields);
    expect(rows).toHaveLength(1);
    expect(rows[0][0].key).toBe("a");
  });
});

// ---------- groupFieldsBySections ----------

describe("groupFieldsBySections", () => {
  it("defaults fields without section to body", () => {
    const fields = [field({ key: "a" }), field({ key: "b" })];
    const secs = groupFieldsBySections(fields);
    expect(secs.header).toHaveLength(0);
    expect(secs.body).toHaveLength(2);
    expect(secs.footer).toHaveLength(0);
  });

  it("groups by explicit section", () => {
    const fields = [
      field({ key: "h", section: "header" }),
      field({ key: "b1" }),
      field({ key: "b2", section: "body" }),
      field({ key: "f", section: "footer" }),
    ];
    const secs = groupFieldsBySections(fields);
    expect(secs.header.map((f) => f.key)).toEqual(["h"]);
    expect(secs.body.map((f) => f.key)).toEqual(["b1", "b2"]);
    expect(secs.footer.map((f) => f.key)).toEqual(["f"]);
  });

  it("returns empty arrays for empty input", () => {
    const secs = groupFieldsBySections([]);
    expect(secs.header).toEqual([]);
    expect(secs.body).toEqual([]);
    expect(secs.footer).toEqual([]);
  });
});
