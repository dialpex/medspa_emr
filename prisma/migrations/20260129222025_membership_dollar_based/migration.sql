/*
  Warnings:

  - You are about to drop the `CreditLedger` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MembershipCredit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `credits` on the `MembershipPlan` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `MembershipPlan` table. All the data in the column will be lost.
  - You are about to drop the column `validityDays` on the `MembershipPlan` table. All the data in the column will be lost.
  - Added the required column `monthlyPrice` to the `MembershipPlan` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CreditLedger_membershipCreditId_idx";

-- DropIndex
DROP INDEX "CreditLedger_clinicId_idx";

-- DropIndex
DROP INDEX "MembershipCredit_expiresAt_idx";

-- DropIndex
DROP INDEX "MembershipCredit_patientId_idx";

-- DropIndex
DROP INDEX "MembershipCredit_clinicId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CreditLedger";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MembershipCredit";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "MembershipPlanService" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "MembershipPlanService_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MembershipPlanService_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MembershipPlanService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PatientMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextBillDate" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatientMembership_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PatientMembership_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PatientMembership_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Clinic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "logoUrl" TEXT,
    "locationName" TEXT,
    "externalId" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "website" TEXT,
    "locationHours" TEXT,
    "socialAccounts" TEXT,
    "calendarSettings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Clinic" ("address", "createdAt", "email", "id", "name", "phone", "slug", "timezone", "updatedAt") SELECT "address", "createdAt", "email", "id", "name", "phone", "slug", "timezone", "updatedAt" FROM "Clinic";
DROP TABLE "Clinic";
ALTER TABLE "new_Clinic" RENAME TO "Clinic";
CREATE UNIQUE INDEX "Clinic_slug_key" ON "Clinic"("slug");
CREATE TABLE "new_MembershipPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" REAL NOT NULL,
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
CREATE INDEX "MembershipPlanService_clinicId_idx" ON "MembershipPlanService"("clinicId");

-- CreateIndex
CREATE INDEX "MembershipPlanService_planId_idx" ON "MembershipPlanService"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPlanService_planId_serviceId_key" ON "MembershipPlanService"("planId", "serviceId");

-- CreateIndex
CREATE INDEX "PatientMembership_clinicId_idx" ON "PatientMembership"("clinicId");

-- CreateIndex
CREATE INDEX "PatientMembership_patientId_idx" ON "PatientMembership"("patientId");

-- CreateIndex
CREATE INDEX "PatientMembership_status_idx" ON "PatientMembership"("status");
