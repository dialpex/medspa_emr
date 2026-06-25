import { getProductsForClinic } from "@/lib/actions/products";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { ProductsClient } from "./products-client";
import { Breadcrumbs, buildBreadcrumbItems } from "@/components/ui/breadcrumbs";

export default async function ProductsPage() {
  const user = await requirePermission("patients", "view");
  const [products, clinic] = await Promise.all([
    getProductsForClinic(),
    prisma.clinic.findUnique({
      where: { id: user.clinicId },
      select: { defaultTaxRate: true },
    }),
  ]);

  return (
    <>
      <div className="p-6 pb-0 max-w-6xl mx-auto">
        <Breadcrumbs items={buildBreadcrumbItems(
          { label: "System Config", href: "/settings" },
          { label: "Products" }
        )} />
      </div>
      <ProductsClient
        products={products}
        defaultTaxRate={clinic?.defaultTaxRate ?? null}
      />
    </>
  );
}
