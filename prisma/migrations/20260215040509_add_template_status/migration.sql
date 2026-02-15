-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChartTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'chart',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "fieldsConfig" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ChartTemplate_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ChartTemplate" ("category", "clinicId", "createdAt", "deletedAt", "description", "fieldsConfig", "id", "isActive", "isSystem", "name", "type", "updatedAt") SELECT "category", "clinicId", "createdAt", "deletedAt", "description", "fieldsConfig", "id", "isActive", "isSystem", "name", "type", "updatedAt" FROM "ChartTemplate";
UPDATE "new_ChartTemplate" SET "status" = 'Active' WHERE "isActive" = 1;
UPDATE "new_ChartTemplate" SET "status" = 'Archived' WHERE "isActive" = 0;
DROP TABLE "ChartTemplate";
ALTER TABLE "new_ChartTemplate" RENAME TO "ChartTemplate";
CREATE INDEX "ChartTemplate_clinicId_idx" ON "ChartTemplate"("clinicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
