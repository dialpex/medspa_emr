-- AlterTable
ALTER TABLE "ConsentTemplate" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "PatientConsent" ADD COLUMN "deletedAt" DATETIME;
