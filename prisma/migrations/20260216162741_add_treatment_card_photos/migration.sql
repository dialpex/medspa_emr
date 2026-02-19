-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "chartId" TEXT,
    "treatmentCardId" TEXT,
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
    CONSTRAINT "Photo_treatmentCardId_fkey" FOREIGN KEY ("treatmentCardId") REFERENCES "TreatmentCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Photo_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Photo" ("annotations", "caption", "category", "chartId", "clinicId", "createdAt", "deletedAt", "filename", "id", "mimeType", "patientId", "sizeBytes", "storagePath", "takenById", "updatedAt") SELECT "annotations", "caption", "category", "chartId", "clinicId", "createdAt", "deletedAt", "filename", "id", "mimeType", "patientId", "sizeBytes", "storagePath", "takenById", "updatedAt" FROM "Photo";
DROP TABLE "Photo";
ALTER TABLE "new_Photo" RENAME TO "Photo";
CREATE INDEX "Photo_clinicId_idx" ON "Photo"("clinicId");
CREATE INDEX "Photo_patientId_idx" ON "Photo"("patientId");
CREATE INDEX "Photo_chartId_idx" ON "Photo"("chartId");
CREATE INDEX "Photo_treatmentCardId_idx" ON "Photo"("treatmentCardId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
