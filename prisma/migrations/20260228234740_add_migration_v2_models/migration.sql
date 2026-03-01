-- CreateTable
CREATE TABLE "MigrationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "sourceVendor" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Created',
    "currentPhase" TEXT,
    "artifactManifest" TEXT,
    "sourceProfile" TEXT,
    "phiClassification" TEXT,
    "mappingSpecVersion" INTEGER NOT NULL DEFAULT 0,
    "mappingApprovedAt" DATETIME,
    "mappingApprovedById" TEXT,
    "progress" TEXT NOT NULL DEFAULT '{}',
    "lastCheckpoint" TEXT,
    "consentText" TEXT,
    "consentSignedAt" DATETIME,
    "startedById" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MigrationRun_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MigrationArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storedAt" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MigrationArtifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MigrationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MigrationMappingSpec" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "spec" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MigrationMappingSpec_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MigrationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MigrationRecordLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "canonicalChecksum" TEXT,
    "errorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MigrationRecordLedger_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MigrationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MigrationAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MigrationAuditEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MigrationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CanonicalStagingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'staged',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CanonicalStagingRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MigrationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MigrationRun_clinicId_idx" ON "MigrationRun"("clinicId");

-- CreateIndex
CREATE INDEX "MigrationRun_status_idx" ON "MigrationRun"("status");

-- CreateIndex
CREATE INDEX "MigrationArtifact_runId_idx" ON "MigrationArtifact"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationArtifact_runId_key_key" ON "MigrationArtifact"("runId", "key");

-- CreateIndex
CREATE INDEX "MigrationMappingSpec_runId_idx" ON "MigrationMappingSpec"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationMappingSpec_runId_version_key" ON "MigrationMappingSpec"("runId", "version");

-- CreateIndex
CREATE INDEX "MigrationRecordLedger_runId_status_idx" ON "MigrationRecordLedger"("runId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationRecordLedger_runId_entityType_sourceRecordId_key" ON "MigrationRecordLedger"("runId", "entityType", "sourceRecordId");

-- CreateIndex
CREATE INDEX "MigrationAuditEvent_runId_idx" ON "MigrationAuditEvent"("runId");

-- CreateIndex
CREATE INDEX "CanonicalStagingRecord_runId_status_idx" ON "CanonicalStagingRecord"("runId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalStagingRecord_runId_entityType_canonicalId_key" ON "CanonicalStagingRecord"("runId", "entityType", "canonicalId");
