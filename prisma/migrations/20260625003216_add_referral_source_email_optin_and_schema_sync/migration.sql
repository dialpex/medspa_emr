-- AlterTable
ALTER TABLE "MigrationJob" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "NotificationTemplate" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "PatientConsent" ADD COLUMN "integrityHash" TEXT;

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
    "referralSource" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "emailHash" TEXT,
    "phoneHash" TEXT,
    "avatarPhotoId" TEXT,
    CONSTRAINT "Patient_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Patient_avatarPhotoId_fkey" FOREIGN KEY ("avatarPhotoId") REFERENCES "Photo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Patient" ("address", "allergies", "city", "clinicId", "createdAt", "dateOfBirth", "deletedAt", "email", "firstName", "gender", "id", "isActive", "lastName", "medicalNotes", "phone", "state", "status", "tags", "updatedAt", "zipCode") SELECT "address", "allergies", "city", "clinicId", "createdAt", "dateOfBirth", "deletedAt", "email", "firstName", "gender", "id", "isActive", "lastName", "medicalNotes", "phone", "state", "status", "tags", "updatedAt", "zipCode" FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "new_Patient" RENAME TO "Patient";
CREATE UNIQUE INDEX "Patient_avatarPhotoId_key" ON "Patient"("avatarPhotoId");
CREATE INDEX "Patient_clinicId_idx" ON "Patient"("clinicId");
CREATE INDEX "Patient_emailHash_idx" ON "Patient"("emailHash");
CREATE INDEX "Patient_phoneHash_idx" ON "Patient"("phoneHash");
CREATE TABLE "new_PatientCommunicationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "phoneE164" TEXT,
    "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "smsOptInAt" DATETIME,
    "smsOptOutAt" DATETIME,
    "emailOptIn" BOOLEAN NOT NULL DEFAULT false,
    "consentSource" TEXT NOT NULL DEFAULT 'FrontDesk',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatientCommunicationPreference_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PatientCommunicationPreference_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PatientCommunicationPreference" ("clinicId", "consentSource", "createdAt", "id", "patientId", "phoneE164", "smsOptIn", "smsOptInAt", "smsOptOutAt", "updatedAt") SELECT "clinicId", "consentSource", "createdAt", "id", "patientId", "phoneE164", "smsOptIn", "smsOptInAt", "smsOptOutAt", "updatedAt" FROM "PatientCommunicationPreference";
DROP TABLE "PatientCommunicationPreference";
ALTER TABLE "new_PatientCommunicationPreference" RENAME TO "PatientCommunicationPreference";
CREATE UNIQUE INDEX "PatientCommunicationPreference_patientId_key" ON "PatientCommunicationPreference"("patientId");
CREATE INDEX "PatientCommunicationPreference_clinicId_idx" ON "PatientCommunicationPreference"("clinicId");
CREATE INDEX "PatientCommunicationPreference_patientId_idx" ON "PatientCommunicationPreference"("patientId");
CREATE UNIQUE INDEX "PatientCommunicationPreference_clinicId_patientId_key" ON "PatientCommunicationPreference"("clinicId", "patientId");
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
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpVerifiedAt" DATETIME,
    "backupCodes" TEXT,
    "requiresMDReview" BOOLEAN NOT NULL DEFAULT false,
    "supervisingMDId" TEXT,
    CONSTRAINT "User_supervisingMDId_fkey" FOREIGN KEY ("supervisingMDId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("alias", "clinicId", "createdAt", "email", "emailVerified", "id", "isActive", "name", "passwordHash", "phone", "profileImageUrl", "pronouns", "requiresMDReview", "role", "supervisingMDId", "updatedAt") SELECT "alias", "clinicId", "createdAt", "email", "emailVerified", "id", "isActive", "name", "passwordHash", "phone", "profileImageUrl", "pronouns", "requiresMDReview", "role", "supervisingMDId", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_clinicId_idx" ON "User"("clinicId");
CREATE INDEX "User_email_idx" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
