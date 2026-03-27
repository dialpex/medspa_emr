/*
  Warnings:

  - You are about to drop the `AiDraftEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TreatmentCard` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `treatmentCardId` on the `Photo` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "AiDraftEvent_clinicId_idx";

-- DropIndex
DROP INDEX "AiDraftEvent_treatmentCardId_idx";

-- DropIndex
DROP INDEX "TreatmentCard_chartId_idx";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "recurrenceGroupId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "recurrenceIndex" INTEGER;
ALTER TABLE "Appointment" ADD COLUMN "recurrenceRule" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AiDraftEvent";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TreatmentCard";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lotNumber" TEXT,
    "expirationDate" DATETIME,
    "unitCost" REAL,
    "vendor" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "InventoryTransaction_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "dateOfBirth" DATETIME,
    "gender" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "allergies" TEXT,
    "medicalNotes" TEXT,
    "tags" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Patient_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Patient" ("address", "allergies", "city", "clinicId", "createdAt", "dateOfBirth", "deletedAt", "email", "firstName", "gender", "id", "isActive", "lastName", "medicalNotes", "phone", "state", "tags", "updatedAt", "zipCode") SELECT "address", "allergies", "city", "clinicId", "createdAt", "dateOfBirth", "deletedAt", "email", "firstName", "gender", "id", "isActive", "lastName", "medicalNotes", "phone", "state", "tags", "updatedAt", "zipCode" FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "new_Patient" RENAME TO "Patient";
CREATE INDEX "Patient_clinicId_idx" ON "Patient"("clinicId");
CREATE INDEX "Patient_lastName_firstName_idx" ON "Patient"("lastName", "firstName");
CREATE INDEX "Patient_email_idx" ON "Patient"("email");
CREATE INDEX "Patient_phone_idx" ON "Patient"("phone");
CREATE TABLE "new_Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "chartId" TEXT,
    "takenById" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "category" TEXT,
    "annotations" TEXT,
    "caption" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Photo_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Photo_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Photo_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "Chart" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Photo_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Photo" ("annotations", "caption", "category", "chartId", "clinicId", "createdAt", "deletedAt", "filename", "id", "mimeType", "patientId", "sizeBytes", "storagePath", "takenById", "updatedAt") SELECT "annotations", "caption", "category", "chartId", "clinicId", "createdAt", "deletedAt", "filename", "id", "mimeType", "patientId", "sizeBytes", "storagePath", "takenById", "updatedAt" FROM "Photo";
DROP TABLE "Photo";
ALTER TABLE "new_Photo" RENAME TO "Photo";
CREATE INDEX "Photo_clinicId_idx" ON "Photo"("clinicId");
CREATE INDEX "Photo_patientId_idx" ON "Photo"("patientId");
CREATE INDEX "Photo_chartId_idx" ON "Photo"("chartId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "InventoryTransaction_clinicId_idx" ON "InventoryTransaction"("clinicId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_productId_idx" ON "InventoryTransaction"("productId");

-- CreateIndex
CREATE INDEX "Appointment_recurrenceGroupId_idx" ON "Appointment"("recurrenceGroupId");
