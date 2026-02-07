-- CreateTable
CREATE TABLE "PatientCommunicationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "phoneE164" TEXT,
    "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "smsOptInAt" DATETIME,
    "smsOptOutAt" DATETIME,
    "consentSource" TEXT NOT NULL DEFAULT 'FrontDesk',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatientCommunicationPreference_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PatientCommunicationPreference_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Patient',
    "patientId" TEXT NOT NULL,
    "lastMessageAt" DATETIME,
    "lastMessagePreview" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'SMS',
    "purpose" TEXT NOT NULL DEFAULT 'Generic',
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "bodyTextSnapshot" TEXT NOT NULL,
    "bodyHash" TEXT NOT NULL,
    "mediaUrls" TEXT,
    "vendor" TEXT,
    "vendorMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Queued',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdByUserId" TEXT,
    "sentAt" DATETIME,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'Generic',
    "bodyText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MessageTemplate_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientCommunicationPreference_patientId_key" ON "PatientCommunicationPreference"("patientId");

-- CreateIndex
CREATE INDEX "PatientCommunicationPreference_clinicId_idx" ON "PatientCommunicationPreference"("clinicId");

-- CreateIndex
CREATE INDEX "PatientCommunicationPreference_patientId_idx" ON "PatientCommunicationPreference"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientCommunicationPreference_clinicId_patientId_key" ON "PatientCommunicationPreference"("clinicId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_patientId_key" ON "Conversation"("patientId");

-- CreateIndex
CREATE INDEX "Conversation_clinicId_idx" ON "Conversation"("clinicId");

-- CreateIndex
CREATE INDEX "Conversation_patientId_idx" ON "Conversation"("patientId");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_clinicId_patientId_key" ON "Conversation"("clinicId", "patientId");

-- CreateIndex
CREATE INDEX "Message_clinicId_idx" ON "Message"("clinicId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_patientId_idx" ON "Message"("patientId");

-- CreateIndex
CREATE INDEX "Message_appointmentId_idx" ON "Message"("appointmentId");

-- CreateIndex
CREATE INDEX "Message_status_idx" ON "Message"("status");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "MessageTemplate_clinicId_idx" ON "MessageTemplate"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_clinicId_key_key" ON "MessageTemplate"("clinicId", "key");
