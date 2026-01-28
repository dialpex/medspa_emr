/*
  Warnings:

  - Added the required column `clinicId` to the `CreditLedger` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clinicId` to the `InvoiceItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clinicId` to the `MembershipCredit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clinicId` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CreditLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "membershipCreditId" TEXT NOT NULL,
    "change" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditLedger_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CreditLedger_membershipCreditId_fkey" FOREIGN KEY ("membershipCreditId") REFERENCES "MembershipCredit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CreditLedger" ("balance", "change", "createdAt", "description", "id", "membershipCreditId") SELECT "balance", "change", "createdAt", "description", "id", "membershipCreditId" FROM "CreditLedger";
DROP TABLE "CreditLedger";
ALTER TABLE "new_CreditLedger" RENAME TO "CreditLedger";
CREATE INDEX "CreditLedger_clinicId_idx" ON "CreditLedger"("clinicId");
CREATE INDEX "CreditLedger_membershipCreditId_idx" ON "CreditLedger"("membershipCreditId");
CREATE TABLE "new_InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "serviceId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL,
    "total" REAL NOT NULL,
    CONSTRAINT "InvoiceItem_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceItem" ("description", "id", "invoiceId", "quantity", "serviceId", "total", "unitPrice") SELECT "description", "id", "invoiceId", "quantity", "serviceId", "total", "unitPrice" FROM "InvoiceItem";
DROP TABLE "InvoiceItem";
ALTER TABLE "new_InvoiceItem" RENAME TO "InvoiceItem";
CREATE INDEX "InvoiceItem_clinicId_idx" ON "InvoiceItem"("clinicId");
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE TABLE "new_MembershipCredit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "totalCredits" INTEGER NOT NULL,
    "usedCredits" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "purchasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MembershipCredit_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MembershipCredit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MembershipCredit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MembershipCredit" ("createdAt", "expiresAt", "id", "patientId", "planId", "purchasedAt", "totalCredits", "updatedAt", "usedCredits") SELECT "createdAt", "expiresAt", "id", "patientId", "planId", "purchasedAt", "totalCredits", "updatedAt", "usedCredits" FROM "MembershipCredit";
DROP TABLE "MembershipCredit";
ALTER TABLE "new_MembershipCredit" RENAME TO "MembershipCredit";
CREATE INDEX "MembershipCredit_clinicId_idx" ON "MembershipCredit"("clinicId");
CREATE INDEX "MembershipCredit_patientId_idx" ON "MembershipCredit"("patientId");
CREATE INDEX "MembershipCredit_expiresAt_idx" ON "MembershipCredit"("expiresAt");
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "createdAt", "id", "invoiceId", "notes", "paymentMethod", "reference") SELECT "amount", "createdAt", "id", "invoiceId", "notes", "paymentMethod", "reference" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_clinicId_idx" ON "Payment"("clinicId");
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
