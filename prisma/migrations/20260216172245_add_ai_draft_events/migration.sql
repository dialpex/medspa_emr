-- CreateTable
CREATE TABLE "AiDraftEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "treatmentCardId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'TYPED',
    "inputSummaryText" TEXT NOT NULL,
    "modelInfo" TEXT NOT NULL DEFAULT '{}',
    "structuredPatch" TEXT NOT NULL DEFAULT '{}',
    "narrativeDraftText" TEXT NOT NULL DEFAULT '',
    "missingHighRisk" TEXT NOT NULL DEFAULT '[]',
    "conflicts" TEXT NOT NULL DEFAULT '[]',
    "warnings" TEXT NOT NULL DEFAULT '[]',
    "appliedAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiDraftEvent_treatmentCardId_fkey" FOREIGN KEY ("treatmentCardId") REFERENCES "TreatmentCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiDraftEvent_treatmentCardId_idx" ON "AiDraftEvent"("treatmentCardId");

-- CreateIndex
CREATE INDEX "AiDraftEvent_clinicId_idx" ON "AiDraftEvent"("clinicId");
