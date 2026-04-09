"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";

interface ReceiveStockInput {
  productId: string;
  quantity: number;
  lotNumber?: string;
  expirationDate?: string;
  unitCost?: number;
  vendor?: string;
  reference?: string;
  notes?: string;
}

interface ReceiveStockResult {
  transactionId: string;
  productName: string;
  quantityReceived: number;
  newCount: number;
  lotNumber: string | null;
  expirationDate: string | null;
}

export async function receiveStock(input: ReceiveStockInput): Promise<ReceiveStockResult> {
  const user = await requirePermission("patients", "create");

  if (!prisma.inventoryTransaction) {
    throw new Error(
      "InventoryTransaction model not available. Restart the dev server after running 'prisma generate'."
    );
  }

  if (input.quantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }

  const product = await prisma.product.findFirst({
    where: { id: input.productId, clinicId: user.clinicId },
  });
  if (!product) {
    throw new Error("Product not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.inventoryTransaction.create({
      data: {
        clinicId: user.clinicId,
        productId: input.productId,
        type: "Receive",
        quantity: input.quantity,
        lotNumber: input.lotNumber || null,
        expirationDate: input.expirationDate ? new Date(input.expirationDate) : null,
        unitCost: input.unitCost ?? null,
        vendor: input.vendor || null,
        reference: input.reference || null,
        notes: input.notes || null,
        createdById: user.id,
      },
    });

    const updateData: { inventoryCount: { increment: number }; wholesaleCost?: number } = {
      inventoryCount: { increment: input.quantity },
    };

    if (input.unitCost != null && input.unitCost !== product.wholesaleCost) {
      updateData.wholesaleCost = input.unitCost;
    }

    const updated = await tx.product.update({
      where: { id: input.productId },
      data: updateData,
    });

    return { transaction, updated };
  });

  await createAuditLog({
    clinicId: user.clinicId,
    userId: user.id,
    action: "PatientCreate", // reusing closest available audit action
    entityType: "Product",
    entityId: input.productId,
    details: JSON.stringify({
      type: "inventory_receive",
      quantity: input.quantity,
      lotNumber: input.lotNumber,
      reference: input.reference,
      transactionId: result.transaction.id,
    }),
  });

  revalidatePath("/settings/products");

  return {
    transactionId: result.transaction.id,
    productName: product.name,
    quantityReceived: input.quantity,
    newCount: result.updated.inventoryCount,
    lotNumber: input.lotNumber || null,
    expirationDate: input.expirationDate || null,
  };
}

interface CreateProductFromInvoiceInput {
  name: string;
  category?: string;
  retailPrice?: number;
  wholesaleCost: number;
  vendor?: string;
  sku?: string;
}

interface CreateProductFromInvoiceResult {
  id: string;
  name: string;
  wholesaleCost: number;
  retailPrice: number;
}

export async function createProductFromInvoice(
  input: CreateProductFromInvoiceInput
): Promise<CreateProductFromInvoiceResult> {
  const user = await requirePermission("patients", "create");

  if (!input.name.trim()) {
    throw new Error("Product name is required");
  }
  if (input.wholesaleCost < 0) {
    throw new Error("Wholesale cost cannot be negative");
  }

  const retailPrice = input.retailPrice ?? input.wholesaleCost * 2;

  const product = await prisma.product.create({
    data: {
      clinicId: user.clinicId,
      name: input.name.trim(),
      category: input.category || null,
      retailPrice,
      wholesaleCost: input.wholesaleCost,
      vendor: input.vendor || null,
      sku: input.sku || null,
      inventoryCount: 0,
      taxable: true,
    },
  });

  revalidatePath("/settings/products");

  return {
    id: product.id,
    name: product.name,
    wholesaleCost: product.wholesaleCost,
    retailPrice: product.retailPrice,
  };
}

interface UpdateProductCostResult {
  productId: string;
  previousCost: number;
  newCost: number;
}

export async function updateProductCost(
  productId: string,
  wholesaleCost: number
): Promise<UpdateProductCostResult> {
  const user = await requirePermission("patients", "create");

  if (wholesaleCost < 0) {
    throw new Error("Wholesale cost cannot be negative");
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, clinicId: user.clinicId },
  });
  if (!product) {
    throw new Error("Product not found");
  }

  await prisma.product.update({
    where: { id: productId },
    data: { wholesaleCost },
  });

  revalidatePath("/settings/products");

  return {
    productId,
    previousCost: product.wholesaleCost,
    newCost: wholesaleCost,
  };
}
