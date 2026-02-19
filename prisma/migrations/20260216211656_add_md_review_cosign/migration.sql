-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Chart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "appointmentId" TEXT,
    "encounterId" TEXT,
    "templateId" TEXT,
    "createdById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "chiefComplaint" TEXT,
    "areasTreated" TEXT,
    "productsUsed" TEXT,
    "dosageUnits" TEXT,
    "technique" TEXT,
    "aftercareNotes" TEXT,
    "additionalNotes" TEXT,
    "providerSignedAt" DATETIME,
    "providerSignedById" TEXT,
    "signedById" TEXT,
    "signedByName" TEXT,
    "signedAt" DATETIME,
    "recordHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Chart_providerSignedById_fkey" FOREIGN KEY ("providerSignedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Chart_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Chart_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Chart_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Chart_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Chart_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChartTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Chart_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Chart_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Chart" ("additionalNotes", "aftercareNotes", "appointmentId", "areasTreated", "chiefComplaint", "clinicId", "createdAt", "createdById", "deletedAt", "dosageUnits", "encounterId", "id", "patientId", "productsUsed", "recordHash", "signedAt", "signedById", "signedByName", "status", "technique", "templateId", "updatedAt") SELECT "additionalNotes", "aftercareNotes", "appointmentId", "areasTreated", "chiefComplaint", "clinicId", "createdAt", "createdById", "deletedAt", "dosageUnits", "encounterId", "id", "patientId", "productsUsed", "recordHash", "signedAt", "signedById", "signedByName", "status", "technique", "templateId", "updatedAt" FROM "Chart";
DROP TABLE "Chart";
ALTER TABLE "new_Chart" RENAME TO "Chart";
CREATE UNIQUE INDEX "Chart_appointmentId_key" ON "Chart"("appointmentId");
CREATE UNIQUE INDEX "Chart_encounterId_key" ON "Chart"("encounterId");
CREATE INDEX "Chart_clinicId_idx" ON "Chart"("clinicId");
CREATE INDEX "Chart_patientId_idx" ON "Chart"("patientId");
CREATE INDEX "Chart_status_idx" ON "Chart"("status");
CREATE INDEX "Chart_createdById_idx" ON "Chart"("createdById");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerified" DATETIME,
    "role" TEXT NOT NULL DEFAULT 'Provider',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "phone" TEXT,
    "alias" TEXT,
    "pronouns" TEXT,
    "profileImageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "requiresMDReview" BOOLEAN NOT NULL DEFAULT false,
    "supervisingMDId" TEXT,
    CONSTRAINT "User_supervisingMDId_fkey" FOREIGN KEY ("supervisingMDId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("alias", "clinicId", "createdAt", "email", "emailVerified", "id", "isActive", "name", "passwordHash", "phone", "profileImageUrl", "pronouns", "role", "updatedAt") SELECT "alias", "clinicId", "createdAt", "email", "emailVerified", "id", "isActive", "name", "passwordHash", "phone", "profileImageUrl", "pronouns", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_clinicId_idx" ON "User"("clinicId");
CREATE INDEX "User_email_idx" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
