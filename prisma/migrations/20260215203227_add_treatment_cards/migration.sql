-- CreateTable
CREATE TABLE "TreatmentCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chartId" TEXT NOT NULL,
    "templateType" TEXT NOT NULL DEFAULT 'Other',
    "title" TEXT NOT NULL,
    "narrativeText" TEXT NOT NULL DEFAULT '',
    "structuredData" TEXT NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TreatmentCard_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "Chart" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TreatmentCard_chartId_idx" ON "TreatmentCard"("chartId");
