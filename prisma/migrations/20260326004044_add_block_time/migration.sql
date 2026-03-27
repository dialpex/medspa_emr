-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "providerId" TEXT NOT NULL,
    "serviceId" TEXT,
    "roomId" TEXT,
    "resourceId" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "notes" TEXT,
    "isBlock" BOOLEAN NOT NULL DEFAULT false,
    "blockTitle" TEXT,
    "checkedInAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "checkedOutAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "recurrenceGroupId" TEXT,
    "recurrenceRule" TEXT,
    "recurrenceIndex" INTEGER,
    CONSTRAINT "Appointment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("checkedInAt", "checkedOutAt", "clinicId", "completedAt", "createdAt", "deletedAt", "endTime", "id", "notes", "patientId", "providerId", "recurrenceGroupId", "recurrenceIndex", "recurrenceRule", "resourceId", "roomId", "serviceId", "startTime", "startedAt", "status", "updatedAt") SELECT "checkedInAt", "checkedOutAt", "clinicId", "completedAt", "createdAt", "deletedAt", "endTime", "id", "notes", "patientId", "providerId", "recurrenceGroupId", "recurrenceIndex", "recurrenceRule", "resourceId", "roomId", "serviceId", "startTime", "startedAt", "status", "updatedAt" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
CREATE INDEX "Appointment_clinicId_idx" ON "Appointment"("clinicId");
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");
CREATE INDEX "Appointment_providerId_idx" ON "Appointment"("providerId");
CREATE INDEX "Appointment_startTime_idx" ON "Appointment"("startTime");
CREATE INDEX "Appointment_recurrenceGroupId_idx" ON "Appointment"("recurrenceGroupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
