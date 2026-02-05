"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export type ProductItem = {
  id: string;
  name: string;
  description: string | null;
  size: string | null;
  sku: string | null;
  upc: string | null;
  category: string | null;
  retailPrice: number;
  wholesaleCost: number;
  vendor: string | null;
  inventoryCount: number;
  taxable: boolean;
  isActive: boolean;
};

type ProductInput = {
  name: string;
  description?: string;
  size?: string;
  sku?: string;
  upc?: string;
  category?: string;
  retailPrice: number;
  wholesaleCost: number;
  vendor?: string;
  inventoryCount: number;
  taxable: boolean;
};

export async function getProductsForClinic(): Promise<ProductItem[]> {
  const user = await requirePermission("patients", "view");
  const products = await prisma.product.findMany({
    where: { clinicId: user.clinicId },
    orderBy: { name: "asc" },
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    size: p.size,
    sku: p.sku,
    upc: p.upc,
    category: p.category,
    retailPrice: p.retailPrice,
    wholesaleCost: p.wholesaleCost,
    vendor: p.vendor,
    inventoryCount: p.inventoryCount,
    taxable: p.taxable,
    isActive: p.isActive,
  }));
}

export async function getProduct(id: string): Promise<ProductItem | null> {
  const user = await requirePermission("patients", "view");
  const p = await prisma.product.findFirst({
    where: { id, clinicId: user.clinicId },
  });
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    size: p.size,
    sku: p.sku,
    upc: p.upc,
    category: p.category,
    retailPrice: p.retailPrice,
    wholesaleCost: p.wholesaleCost,
    vendor: p.vendor,
    inventoryCount: p.inventoryCount,
    taxable: p.taxable,
    isActive: p.isActive,
  };
}

export async function createProduct(input: ProductInput) {
  const user = await requirePermission("patients", "create");
  if (!input.name.trim()) {
    throw new Error("Product name is required");
  }
  if (input.retailPrice < 0 || input.wholesaleCost < 0) {
    throw new Error("Prices cannot be negative");
  }
  const product = await prisma.product.create({
    data: {
      clinicId: user.clinicId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      size: input.size?.trim() || null,
      sku: input.sku?.trim() || null,
      upc: input.upc?.trim() || null,
      category: input.category || null,
      retailPrice: input.retailPrice,
      wholesaleCost: input.wholesaleCost,
      vendor: input.vendor?.trim() || null,
      inventoryCount: input.inventoryCount,
      taxable: input.taxable,
    },
  });
  revalidatePath("/settings/products");
  return product;
}

export async function updateProduct(id: string, input: ProductInput) {
  const user = await requirePermission("patients", "create");
  if (!input.name.trim()) {
    throw new Error("Product name is required");
  }
  if (input.retailPrice < 0 || input.wholesaleCost < 0) {
    throw new Error("Prices cannot be negative");
  }
  const existing = await prisma.product.findFirst({
    where: { id, clinicId: user.clinicId },
  });
  if (!existing) throw new Error("Product not found");

  await prisma.product.update({
    where: { id },
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      size: input.size?.trim() || null,
      sku: input.sku?.trim() || null,
      upc: input.upc?.trim() || null,
      category: input.category || null,
      retailPrice: input.retailPrice,
      wholesaleCost: input.wholesaleCost,
      vendor: input.vendor?.trim() || null,
      inventoryCount: input.inventoryCount,
      taxable: input.taxable,
    },
  });
  revalidatePath("/settings/products");
  revalidatePath(`/settings/products/${id}`);
}

export async function toggleProductActive(id: string) {
  const user = await requirePermission("patients", "create");
  const existing = await prisma.product.findFirst({
    where: { id, clinicId: user.clinicId },
  });
  if (!existing) throw new Error("Product not found");
  await prisma.product.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });
  revalidatePath("/settings/products");
}
