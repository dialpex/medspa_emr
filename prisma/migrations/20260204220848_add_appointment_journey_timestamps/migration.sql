/*
  Warnings:

  - You are about to drop the `MembershipPlanService` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `monthlyPrice` on the `MembershipPlan` table. All the data in the column will be lost.
  - Added the required column `price` to the `MembershipPlan` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "MembershipPlanService_planId_serviceId_key";

-- DropIndex
DROP INDEX "MembershipPlanService_planId_idx";

-- DropIndex
DROP INDEX "MembershipPlanService_clinicId_idx";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "checkedInAt" DATETIME;
ALTER TABLE "Appointment" ADD COLUMN "checkedOutAt" DATETIME;
ALTER TABLE "Appointment" ADD COLUMN "completedAt" DATETIME;
ALTER TABLE "Appointment" ADD COLUMN "startedAt" DATETIME;

-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN "defaultTaxRate" REAL;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "deletedAt" DATETIME;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MembershipPlanService";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "size" TEXT,
    "sku" TEXT,
    "upc" TEXT,
    "category" TEXT,
    "retailPrice" REAL NOT NULL DEFAULT 0,
    "wholesaleCost" REAL NOT NULL DEFAULT 0,
    "vendor" TEXT,
    "inventoryCount" INTEGER NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "serviceId" TEXT,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL,
    "total" REAL NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "InvoiceItem_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceItem" ("clinicId", "description", "id", "invoiceId", "quantity", "serviceId", "total", "unitPrice") SELECT "clinicId", "description", "id", "invoiceId", "quantity", "serviceId", "total", "unitPrice" FROM "InvoiceItem";
DROP TABLE "InvoiceItem";
ALTER TABLE "new_InvoiceItem" RENAME TO "InvoiceItem";
CREATE INDEX "InvoiceItem_clinicId_idx" ON "InvoiceItem"("clinicId");
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE TABLE "new_MembershipPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL NOT NULL,
    "billingCycle" TEXT NOT NULL DEFAULT 'Monthly',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MembershipPlan_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MembershipPlan" ("clinicId", "createdAt", "description", "id", "isActive", "name", "updatedAt") SELECT "clinicId", "createdAt", "description", "id", "isActive", "name", "updatedAt" FROM "MembershipPlan";
DROP TABLE "MembershipPlan";
ALTER TABLE "new_MembershipPlan" RENAME TO "MembershipPlan";
CREATE INDEX "MembershipPlan_clinicId_idx" ON "MembershipPlan"("clinicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Product_clinicId_idx" ON "Product"("clinicId");
