/*
  Warnings:

  - You are about to drop the column `medications` on the `Patient` table. All the data in the column will be lost.

*/
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
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
