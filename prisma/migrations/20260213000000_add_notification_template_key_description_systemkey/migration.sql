-- AlterTable
ALTER TABLE "NotificationTemplate" ADD COLUMN "key" TEXT;
ALTER TABLE "NotificationTemplate" ADD COLUMN "description" TEXT;
ALTER TABLE "NotificationTemplate" ADD COLUMN "systemKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_clinicId_key_key" ON "NotificationTemplate"("clinicId", "key");

-- CreateIndex
CREATE INDEX "NotificationTemplate_clinicId_systemKey_idx" ON "NotificationTemplate"("clinicId", "systemKey");
