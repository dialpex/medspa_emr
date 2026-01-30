-- CreateTable
CREATE TABLE "ServiceTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    CONSTRAINT "ServiceTemplate_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChartTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ServiceTemplate_serviceId_idx" ON "ServiceTemplate"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceTemplate_templateId_idx" ON "ServiceTemplate"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTemplate_serviceId_templateId_key" ON "ServiceTemplate"("serviceId", "templateId");
