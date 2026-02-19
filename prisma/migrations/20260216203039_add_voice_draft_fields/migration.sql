-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiDraftEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "treatmentCardId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'TYPED',
    "inputSummaryText" TEXT NOT NULL DEFAULT '',
    "audioUrl" TEXT,
    "transcriptText" TEXT,
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
INSERT INTO "new_AiDraftEvent" ("appliedAt", "clinicId", "conflicts", "createdAt", "createdById", "id", "inputSummaryText", "kind", "missingHighRisk", "modelInfo", "narrativeDraftText", "structuredPatch", "treatmentCardId", "warnings") SELECT "appliedAt", "clinicId", "conflicts", "createdAt", "createdById", "id", "inputSummaryText", "kind", "missingHighRisk", "modelInfo", "narrativeDraftText", "structuredPatch", "treatmentCardId", "warnings" FROM "AiDraftEvent";
DROP TABLE "AiDraftEvent";
ALTER TABLE "new_AiDraftEvent" RENAME TO "AiDraftEvent";
CREATE INDEX "AiDraftEvent_treatmentCardId_idx" ON "AiDraftEvent"("treatmentCardId");
CREATE INDEX "AiDraftEvent_clinicId_idx" ON "AiDraftEvent"("clinicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
