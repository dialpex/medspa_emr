-- AlterTable
ALTER TABLE "NotificationTemplate" ADD COLUMN "bodyHtml" TEXT;
ALTER TABLE "NotificationTemplate" ADD COLUMN "emailEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NotificationTemplate" ADD COLUMN "textEnabled" BOOLEAN NOT NULL DEFAULT false;
