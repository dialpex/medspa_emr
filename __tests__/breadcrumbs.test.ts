import { describe, it, expect } from "vitest";
import { buildBreadcrumbItems } from "@/components/ui/breadcrumbs";

describe("buildBreadcrumbItems", () => {
  it("strips href from last item", () => {
    const items = buildBreadcrumbItems(
      { label: "Settings", href: "/settings" },
      { label: "Users", href: "/settings/users" },
      { label: "New User", href: "/settings/users/new" }
    );
    expect(items).toEqual([
      { label: "Settings", href: "/settings" },
      { label: "Users", href: "/settings/users" },
      { label: "New User" },
    ]);
  });

  it("handles single item", () => {
    const items = buildBreadcrumbItems({ label: "Home", href: "/" });
    expect(items).toEqual([{ label: "Home" }]);
  });

  it("preserves intermediate hrefs", () => {
    const items = buildBreadcrumbItems(
      { label: "A", href: "/a" },
      { label: "B", href: "/b" },
      { label: "C", href: "/c" },
      { label: "D" }
    );
    expect(items).toEqual([
      { label: "A", href: "/a" },
      { label: "B", href: "/b" },
      { label: "C", href: "/c" },
      { label: "D" },
    ]);
  });

  it("handles empty input", () => {
    const items = buildBreadcrumbItems();
    expect(items).toEqual([]);
  });
});
