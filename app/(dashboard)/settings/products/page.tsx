import { getProductsForClinic } from "@/lib/actions/products";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { ProductsClient } from "./products-client";

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
    <ProductsClient
      products={products}
      defaultTaxRate={clinic?.defaultTaxRate ?? null}
    />
  );
}
