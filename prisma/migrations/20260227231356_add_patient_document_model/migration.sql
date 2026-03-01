-- CreateTable
CREATE TABLE "PatientDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "PatientDocument_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PatientDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PatientDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MigrationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Connecting',
    "credentialsEncrypted" TEXT,
    "connectionValidatedAt" DATETIME,
    "consentText" TEXT,
    "consentSignedAt" DATETIME,
    "consentSignedById" TEXT,
    "consentIpAddress" TEXT,
    "sourceDiscovery" TEXT,
    "mappingConfig" TEXT,
    "pendingDecisions" TEXT,
    "progress" TEXT NOT NULL DEFAULT '{}',
    "lastCheckpoint" TEXT,
    "agentLog" TEXT,
    "startedById" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MigrationJob_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MigrationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT,
    "status" TEXT NOT NULL,
    "aiReasoning" TEXT,
    "errorMessage" TEXT,
    "rawData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MigrationLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MigrationJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MigrationEntityMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MigrationEntityMap_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MigrationJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PatientDocument_clinicId_idx" ON "PatientDocument"("clinicId");

-- CreateIndex
CREATE INDEX "PatientDocument_patientId_idx" ON "PatientDocument"("patientId");

-- CreateIndex
CREATE INDEX "PatientDocument_createdAt_idx" ON "PatientDocument"("createdAt");

-- CreateIndex
CREATE INDEX "MigrationJob_clinicId_idx" ON "MigrationJob"("clinicId");

-- CreateIndex
CREATE INDEX "MigrationJob_status_idx" ON "MigrationJob"("status");

-- CreateIndex
CREATE INDEX "MigrationLog_jobId_idx" ON "MigrationLog"("jobId");

-- CreateIndex
CREATE INDEX "MigrationLog_jobId_entityType_idx" ON "MigrationLog"("jobId", "entityType");

-- CreateIndex
CREATE INDEX "MigrationLog_sourceId_idx" ON "MigrationLog"("sourceId");

-- CreateIndex
CREATE INDEX "MigrationEntityMap_jobId_idx" ON "MigrationEntityMap"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationEntityMap_jobId_entityType_sourceId_key" ON "MigrationEntityMap"("jobId", "entityType", "sourceId");
