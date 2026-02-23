-- CreateTable
CREATE TABLE "ClinicFeatureOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClinicFeatureOverride_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "tier" TEXT NOT NULL DEFAULT 'Standard',
    "website" TEXT,
    "locationHours" TEXT,
    "socialAccounts" TEXT,
    "calendarSettings" TEXT,
    "defaultTaxRate" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Clinic" ("address", "addressLine2", "calendarSettings", "city", "country", "createdAt", "defaultTaxRate", "email", "externalId", "id", "locationHours", "locationName", "logoUrl", "name", "phone", "slug", "socialAccounts", "state", "timezone", "updatedAt", "website", "zipCode") SELECT "address", "addressLine2", "calendarSettings", "city", "country", "createdAt", "defaultTaxRate", "email", "externalId", "id", "locationHours", "locationName", "logoUrl", "name", "phone", "slug", "socialAccounts", "state", "timezone", "updatedAt", "website", "zipCode" FROM "Clinic";
DROP TABLE "Clinic";
ALTER TABLE "new_Clinic" RENAME TO "Clinic";
CREATE UNIQUE INDEX "Clinic_slug_key" ON "Clinic"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ClinicFeatureOverride_clinicId_idx" ON "ClinicFeatureOverride"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicFeatureOverride_clinicId_feature_key" ON "ClinicFeatureOverride"("clinicId", "feature");
