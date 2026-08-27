-- CreateEnum
CREATE TYPE "CampaignReportStatus" AS ENUM ('pending', 'included', 'excluded');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "propertyId" TEXT,
    "status" "CampaignReportStatus" NOT NULL DEFAULT 'pending',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_propertyId_idx" ON "campaigns"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_platform_adAccountId_externalId_key" ON "campaigns"("platform", "adAccountId", "externalId");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
