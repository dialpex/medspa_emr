/*
  Warnings:

  - You are about to drop the column `areasTreeated` on the `Chart` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Chart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "chiefComplaint" TEXT,
    "areasTreated" TEXT,
    "productsUsed" TEXT,
    "dosageUnits" TEXT,
    "technique" TEXT,
    "aftercareNotes" TEXT,
    "additionalNotes" TEXT,
    "signedById" TEXT,
    "signedByName" TEXT,
    "signedAt" DATETIME,
    "recordHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Chart_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Chart_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Chart_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Chart_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Chart_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Chart" ("additionalNotes", "aftercareNotes", "appointmentId", "chiefComplaint", "clinicId", "createdAt", "createdById", "deletedAt", "dosageUnits", "id", "patientId", "productsUsed", "recordHash", "signedAt", "signedById", "signedByName", "status", "technique", "updatedAt") SELECT "additionalNotes", "aftercareNotes", "appointmentId", "chiefComplaint", "clinicId", "createdAt", "createdById", "deletedAt", "dosageUnits", "id", "patientId", "productsUsed", "recordHash", "signedAt", "signedById", "signedByName", "status", "technique", "updatedAt" FROM "Chart";
DROP TABLE "Chart";
ALTER TABLE "new_Chart" RENAME TO "Chart";
CREATE UNIQUE INDEX "Chart_appointmentId_key" ON "Chart"("appointmentId");
CREATE INDEX "Chart_clinicId_idx" ON "Chart"("clinicId");
CREATE INDEX "Chart_patientId_idx" ON "Chart"("patientId");
CREATE INDEX "Chart_status_idx" ON "Chart"("status");
CREATE INDEX "Chart_createdById_idx" ON "Chart"("createdById");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
